// api/gemini.js — Vercel Function (proxy seguro para o Google Gemini)
//
// Duas travas para o site ser público sem sua chave "vazar" nem sua cota
// diária sumir por causa de gente/scripts batendo direto nesta URL:
//   1) Só aceita chamadas de usuários LOGADOS no seu app (valida o token do
//      Firebase Auth que o próprio app já gera — não precisa de infra extra).
//   2) Cada usuário tem um limite diário (padrão: 8 importações/dia), contado
//      no Firestore que você já usa. Passar do limite retorna erro 429.
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
const GEMINI_MODELS = ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-2.5-flash'];
const DAILY_LIMIT = 8; // importações de grade por usuário por dia

function isOverloadError(status, data) {
  if (status === 503) return true;
  const msg = (data?.error?.message || '').toLowerCase();
  return msg.includes('overload') || msg.includes('high demand') || msg.includes('unavailable');
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function callGeminiWithFallback(geminiKey, contents) {
  let lastError = null;
  for (let i = 0; i < GEMINI_MODELS.length; i += 1) {
    const model = GEMINI_MODELS[i];
    // Uma pequena espera + nova tentativa no MESMO modelo antes de trocar de
    // modelo — picos de demanda costumam durar poucos segundos.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
      const geminiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
        })
      });
      const data = await geminiRes.json().catch(() => ({}));

      if (geminiRes.ok) return { ok: true, data, modelUsed: model };

      lastError = { status: geminiRes.status, data };
      if (isOverloadError(geminiRes.status, data)) {
        if (attempt === 0) { await sleep(900); continue; } // tenta de novo no mesmo modelo
        break; // desiste desse modelo, tenta o próximo da lista
      }
      // Erro que não é de sobrecarga (ex: chave inválida, request malformado) — não adianta trocar de modelo
      return { ok: false, status: geminiRes.status, data };
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
  const uid = data?.users?.[0]?.localId;
  if (!resp.ok || !uid) throw new Error('unauthorized');
  return uid;
}

// Lê e incrementa o contador diário do usuário via API REST do Firestore,
// usando o próprio idToken do usuário (respeita as regras de segurança —
// cada um só lê/escreve o próprio contador).
async function checkAndIncrementUsage(idToken, uid) {
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

  if (count >= DAILY_LIMIT) {
    return { blocked: true, count };
  }

  await fetch(`${base}?updateMask.fieldPaths=date&updateMask.fieldPaths=count`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ fields: { date: { stringValue: today }, count: { integerValue: String(count + 1) } } })
  }).catch(() => {}); // contagem é best-effort, nunca derruba a importação por causa disso

  return { blocked: false, count: count + 1 };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
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

  let uid;
  try {
    uid = await verifyFirebaseToken(idToken);
  } catch {
    return res.status(401).json({ error: 'Sessão inválida ou expirada. Recarregue a página e faça login novamente.' });
  }

  try {
    const usage = await checkAndIncrementUsage(idToken, uid);
    if (usage.blocked) {
      return res.status(429).json({ error: `Limite de ${DAILY_LIMIT} importações por dia atingido. Tente novamente amanhã.` });
    }
  } catch (err) {
    console.error('[api/gemini] erro ao checar limite de uso:', err.message);
    // segue mesmo assim — não deixa um erro de contagem bloquear o usuário
  }

  // Cota GLOBAL compartilhada com o chat do Mentor IA. O import tem
  // prioridade: só é barrado no teto ABSOLUTO do site (nunca pela fatia
  // reservada pra ele — essa é sempre sua). Isso praticamente nunca deve
  // disparar na prática; é só o limite de segurança de última instância.
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const sharedCount = await sharedQuota.readSharedCount(idToken, projectId);
    if (sharedCount !== null) {
      if (sharedCount >= sharedQuota.TOTAL_DAILY_LIMIT) {
        console.warn(`[api/gemini] teto global absoluto do dia atingido (${sharedCount}/${sharedQuota.TOTAL_DAILY_LIMIT}).`);
        return res.status(503).json({ error: 'O site atingiu o limite de uso de IA por hoje (alta demanda). Tente novamente mais tarde ou cadastre a grade manualmente por enquanto.' });
      }
      await sharedQuota.incrementSharedCount(idToken, projectId, sharedCount);
    }
  } catch (err) {
    console.error('[api/gemini] erro ao checar cota global:', err.message);
    // não bloqueia a importação por causa disso — prioridade é não travar o onboarding
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (!body.contents) {
      return res.status(400).json({ error: 'Requisição inválida: falta "contents".' });
    }

    const result = await callGeminiWithFallback(geminiKey, body.contents);

    if (!result.ok) {
      const overloaded = isOverloadError(result.status, result.data);
      const msg = overloaded
        ? 'A IA está sobrecarregada no momento (todos os modelos tentados falharam). Isso costuma ser temporário — tente novamente em alguns segundos.'
        : (result.data?.error?.message || `Erro HTTP ${result.status} do Gemini`);
      return res.status(result.status || 503).json({ error: msg });
    }

    return res.status(200).json(result.data);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erro interno no proxy do Gemini' });
  }
};
