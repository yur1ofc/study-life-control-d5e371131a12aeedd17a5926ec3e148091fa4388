// api/gemini.js — Vercel Function (proxy seguro para o Google Gemini)
//
// Duas travas para o site ser público sem sua chave "vazar" nem sua cota
// diária sumir por causa de gente/scripts batendo direto nesta URL:
//   1) Só aceita chamadas de usuários LOGADOS no seu app (valida o token do
//      Firebase Auth que o próprio app já gera — não precisa de infra extra).
//   2) Cada usuário tem um limite diário (padrão: 8 importações/dia), contado
//      no Firestore que você já usa. Passar do limite retorna erro 429.
//      Para testes, GEMINI_TEST_EMAIL ou GEMINI_TEST_UID pode isentar UMA conta.
//      Remova essas variáveis do Vercel quando os testes terminarem.
//
// Variáveis de ambiente necessárias no Vercel (Settings → Environment Variables):
//   GEMINI_API_KEY     → grátis em https://aistudio.google.com/apikey
//   FIREBASE_API_KEY    → a mesma que você já usa no front (Web API key do Firebase)
//   FIREBASE_PROJECT_ID → a mesma que você já usa no front
//
// Também é preciso liberar as coleções "ai_usage" e "gemini_usage_global" no
// firestore.rules — veja os blocos em firestore.rules incluídos nesta
// atualização.
//
// PRIORIDADE: esta função (import de grade) é a mais importante pra usuário
// NOVO — é o primeiro contato dele com o app, no onboarding. Por isso ela
// tem prioridade sobre o chat do Mentor IA na cota compartilhada do Gemini:
// só é bloqueada pelo teto GLOBAL absoluto (GEMINI_TOTAL_DAILY_LIMIT), nunca
// pela fatia reservada (GEMINI_IMPORT_RESERVE) — essa fatia é sempre dela.
// Detalhes e como ajustar os números: api/_lib/gemini-shared-quota.js.
const sharedQuota = require('./_lib/gemini-shared-quota');

// Lista de modelos tentados em ordem. "gemini-flash-latest" é o mais rápido/barato,
// mas de vez em quando fica sobrecarregado nos horários de pico do Google e devolve
// 503 ("model is overloaded"/"high demand"). Antes disso derrubava a importação
// direto — agora, se o primeiro modelo estiver sobrecarregado, tentamos o próximo
// da lista antes de desistir e mostrar erro pro usuário.
// Não usar modelos legados aqui. Em contas novas, o Gemini pode responder 404 para
// modelos antigos (ex.: gemini-2.5-flash). Começamos pelo modelo atual e só
// usamos o alias latest como fallback.
const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-3.7-flash'];

const DAILY_LIMIT = 8; // importações de grade por usuário por dia

function isTransientGeminiError(status, data) {
  const msg = (data?.error?.message || '').toLowerCase();
  return [408, 429, 500, 502, 503, 504].includes(status) ||
    /overload|high demand|temporar|unavailable|resource.?exhausted|deadline.?exceeded|timeout/i.test(msg);
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// Uma importação é uma única análise de documento. Não fazemos 6 chamadas
// sequenciais: isso aumenta a chance de outro timeout e pode multiplicar a
// cota consumida. Tentamos no máximo dois modelos, uma vez cada.
async function callGeminiWithFallback(geminiKey, contents) {
  let lastError = null;

  for (let i = 0; i < GEMINI_MODELS.length; i += 1) {
    const model = GEMINI_MODELS[i];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    try {
      const geminiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: { responseMimeType: 'application/json' }
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      const data = await geminiRes.json().catch(() => ({}));

      if (geminiRes.ok) return { ok: true, data, modelUsed: model };

      lastError = { status: geminiRes.status, data, model };
      const msg = data?.error?.message || '';
      const modelUnavailable = geminiRes.status === 404 ||
        (geminiRes.status === 400 && /model.*(not found|not available|unsupported)|not found.*model/i.test(msg));

      if (modelUnavailable) continue;
      if (isTransientGeminiError(geminiRes.status, data)) {
        if (i < GEMINI_MODELS.length - 1) await sleep(800);
        continue;
      }
      return { ok: false, status: geminiRes.status, data };
    } catch (err) {
      clearTimeout(timeout);
      const aborted = err?.name === 'AbortError';
      lastError = {
        status: aborted ? 504 : 503,
        data: { error: { message: aborted ? 'O Gemini excedeu o tempo limite de 25 segundos.' : (err.message || 'Falha de rede ao chamar o Gemini') } },
        model
      };
      if (i < GEMINI_MODELS.length - 1) await sleep(800);
    }
  }

  return { ok: false, status: lastError?.status || 503, data: lastError?.data || {} };
}

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

// Valida o ID token do Firebase Auth enviado pelo front e devolve o uid.
async function verifyFirebaseToken(idToken) {
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) throw new Error('FIREBASE_API_KEY não configurada no servidor.');

  const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken })
  });
  const data = await resp.json();
  const user = data?.users?.[0];
  const uid = user?.localId;
  if (!resp.ok || !uid) throw new Error('unauthorized');
  return { uid, email: String(user.email || '').toLowerCase() };
}

// Lê e incrementa o contador diário do usuário via API REST do Firestore,
// usando o próprio idToken do usuário (respeita as regras de segurança —
// cada um só lê/escreve o próprio contador).
async function checkAndIncrementUsage(idToken, uid, bypassLimit = false) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID não configurada no servidor.');

  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/ai_usage/${uid}`;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` };

  const getResp = await fetch(base, { headers });
  const today = todayKey();
  let count = 0;

  if (getResp.status === 200) {
    const doc = await getResp.json();
    const fields = doc.fields || {};
    const storedDate = fields.date?.stringValue;
    count = storedDate === today ? parseInt(fields.count?.integerValue || '0', 10) : 0;
  } else if (getResp.status !== 404) {
    // Se o Firestore recusar (ex: regra ainda não publicada), não bloqueia o uso —
    // só deixa de contar, pra não travar a função por causa de config pendente.
    return { blocked: false, count: 0 };
  }

  if (!bypassLimit && count >= DAILY_LIMIT) {
    return { blocked: true, count };
  }

  // A gravação do contador é "best-effort" (nunca derruba a importação por
  // causa dela) — então não precisa ser esperada antes de seguir pro Gemini.
  // Antes isso era `await`ado, adicionando mais um round-trip inteiro ao
  // Firestore na frente de cada importação, mesmo sendo um dado descartável.
  fetch(`${base}?updateMask.fieldPaths=date&updateMask.fieldPaths=count`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ fields: { date: { stringValue: today }, count: { integerValue: String(count + 1) } } })
  }).catch(() => {});

  return { blocked: false, count: count + 1 };
}

// CORS travado no domínio do site (+ localhost em dev), em vez de '*'.
// Como a rota já exige Firebase ID token válido, o risco prático do '*' era
// baixo — mas isso fecha a possibilidade de outro site chamar a rota em
// nome de um usuário cujo token vazou por outro motivo (ex.: extensão
// maliciosa no navegador dele).
const ALLOWED_ORIGINS = [
  'https://slcampus.vercel.app',
  'https://study-life-control.vercel.app'
];
function resolveAllowedOrigin(req) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (/^https:\/\/study-life-control(-[a-z0-9-]+)?\.vercel\.app$/.test(origin)) return origin;
  if (/^https:\/\/slcampus(-[a-z0-9-]+)?\.vercel\.app$/.test(origin)) return origin;
  if (/^http:\/\/localhost(:\d+)?$/.test(origin) || /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return origin;
  return ALLOWED_ORIGINS[0];
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', resolveAllowedOrigin(req));
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return res.status(503).json({ error: 'GEMINI_API_KEY não configurada no Vercel. Veja o topo de api/gemini.js.' });
  }

  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!idToken) {
    return res.status(401).json({ error: 'É preciso estar logado no app para usar a importação com IA.' });
  }

  let authUser;
  try {
    authUser = await verifyFirebaseToken(idToken);
  } catch {
    return res.status(401).json({ error: 'Sessão inválida ou expirada. Recarregue a página e faça login novamente.' });
  }

  // As duas checagens de cota (por usuário e global do site) leem documentos
  // diferentes no Firestore e não dependem uma da outra — antes rodavam uma
  // depois da outra (cada uma com sua própria leitura+gravação), somando
  // vários round-trips sequenciais ao Firestore ANTES de sequer começar a
  // chamar o Gemini. Isso sozinho já podia consumir uma fatia grande do
  // tempo máximo de execução da function, contribuindo pra lentidão (e,
  // em arquivos maiores como foto/PDF, pra estourar o tempo e falhar).
  // Rodando as leituras em paralelo, e sem esperar as gravações (que já são
  // "best-effort" internamente), esse trecho fica bem mais rápido.
  const uid = authUser.uid;
  const testEmail = String(process.env.GEMINI_TEST_EMAIL || '').trim().toLowerCase();
  const testUid = String(process.env.GEMINI_TEST_UID || '').trim();
  const testBypass = Boolean((testEmail && authUser.email === testEmail) || (testUid && uid === testUid));
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const [usageResult, sharedCountResult] = await Promise.allSettled([
    checkAndIncrementUsage(idToken, uid, testBypass),
    sharedQuota.readSharedCount(idToken, projectId)
  ]);

  if (usageResult.status === 'fulfilled' && usageResult.value.blocked) {
    return res.status(429).json({ error: `Limite de ${DAILY_LIMIT} importações por dia atingido. Tente novamente amanhã.` });
  }
  if (testBypass) {
    console.warn(`[api/gemini] limite diário de importação temporariamente ignorado para conta de teste configurada no Vercel (${authUser.email || uid}).`);
  }
  if (usageResult.status === 'rejected') {
    console.error('[api/gemini] erro ao checar limite de uso:', usageResult.reason?.message);
    // segue mesmo assim — não deixa um erro de contagem bloquear o usuário
  }

  // Cota GLOBAL compartilhada com o chat do Mentor IA. O import tem
  // prioridade: só é barrado no teto ABSOLUTO do site (nunca pela fatia
  // reservada pra ele — essa é sempre sua). Isso praticamente nunca deve
  // disparar na prática; é só o limite de segurança de última instância.
  if (sharedCountResult.status === 'fulfilled' && sharedCountResult.value !== null) {
    const sharedCount = sharedCountResult.value;
    if (sharedCount >= sharedQuota.TOTAL_DAILY_LIMIT) {
      console.warn(`[api/gemini] teto global absoluto do dia atingido (${sharedCount}/${sharedQuota.TOTAL_DAILY_LIMIT}).`);
      return res.status(503).json({ error: 'O site atingiu o limite de uso de IA por hoje (alta demanda). Tente novamente mais tarde ou cadastre a grade manualmente por enquanto.' });
    }
    sharedQuota.incrementSharedCount(idToken, projectId, sharedCount); // fire-and-forget
  } else if (sharedCountResult.status === 'rejected') {
    console.error('[api/gemini] erro ao checar cota global:', sharedCountResult.reason?.message);
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (!body.contents) {
      return res.status(400).json({ error: 'Requisição inválida: falta "contents".' });
    }

    const result = await callGeminiWithFallback(geminiKey, body.contents);

    if (!result.ok) {
      const overloaded = isTransientGeminiError(result.status, result.data);
      const modelUnavailable = result.status === 404 || /model.*(not found|not available|unsupported)|not found.*model/i.test(result.data?.error?.message || '');
      const msg = overloaded
        ? (result.status === 504
          ? 'O Gemini demorou demais para processar o PDF. O SLCampus tentou outro modelo. Tente novamente; se continuar, use a opção de colar o texto do SIGAA.'
          : 'O Gemini está temporariamente indisponível ou atingiu o limite de requisições. O SLCampus tentou os modelos disponíveis. Aguarde alguns segundos e tente novamente.')
        : modelUnavailable
          ? 'Nenhum modelo Gemini configurado está disponível para a chave do Vercel. Verifique GEMINI_API_KEY.'
          : (result.data?.error?.message || `Erro HTTP ${result.status} do Gemini`);
      if (overloaded) res.setHeader('Retry-After', '3');
      return res.status(result.status || 503).json({ error: msg });
    }

    return res.status(200).json(result.data);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erro interno no proxy do Gemini' });
  }
};
