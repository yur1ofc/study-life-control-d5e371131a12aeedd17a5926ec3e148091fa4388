// api/mentor-chat.js — Vercel Function (proxy seguro para o Google Gemini)
// dedicado ao CHAT do Mentor IA (conversa aberta com contexto do usuário).
//
// Por que este arquivo é separado do api/gemini.js?
//   api/gemini.js já existia para UMA coisa específica: importar grade
//   horária de PDF/imagem, com limite de 8 chamadas/dia (faz sentido pra
//   import, que é usado raramente). O Mentor IA agora conversa de verdade
//   (múltiplas mensagens por sessão de estudo), então precisa do PRÓPRIO
//   limite diário — bem mais alto — sem disputar cota com a importação de
//   grade nem ser afetado se o usuário "gastar" o limite de import.
//
// IMPORTANTE: este arquivo precisa estar dentro da pasta api/ (não na raiz
// do projeto) para a Vercel reconhecê-lo como Serverless Function. Se ele
// aparecer na raiz do repo em algum momento, é sinal de que o deploy está
// quebrado de novo (mesmo tipo de bug relatado em LEIA-ISSO-RELATORIO-DA-BAGUNCA.md).
//
// Travas de segurança, em camadas:
//   1) Só aceita chamadas de usuários LOGADOS (valida o Firebase ID token).
//   2) Limite diário POR USUÁRIO, contado no Firestore (coleção
//      "mentor_usage", separada de "ai_usage" usada pelo api/gemini.js).
//   3) Limite diário GLOBAL (soma de todos os usuários do site, e também
//      somado ao consumo do import de grade), contado em
//      "gemini_usage_global/counter" — ver api/_lib/gemini-shared-quota.js.
//      A chave GEMINI_API_KEY é uma só, compartilhada por todo mundo, e o
//      import de grade tem PRIORIDADE sobre o chat dentro dessa cota.
//   4) Degradação suave: perto do teto global, a função já passa a gastar
//      menos por chamada (só 1 modelo, sem retry, resposta mais curta) antes
//      de eventualmente recusar. Ao bater no teto, ela nem chama o Gemini —
//      devolve um erro "silencioso" (não é 429) que o front-end já trata
//      caindo pro modo por regras, sem mostrar mensagem feia pro usuário.
//
// Variáveis de ambiente necessárias (as mesmas do api/gemini.js — reaproveita):
//   GEMINI_API_KEY, FIREBASE_API_KEY, FIREBASE_PROJECT_ID
// Variáveis opcionais:
//   MENTOR_DAILY_LIMIT   → limite de mensagens por usuário/dia (padrão: 60)
//   MENTOR_DEGRADE_RATIO → a partir de qual % da cota QUE SOBRA PRO CHAT
//                          (depois de reservar a fatia do import — ver
//                          api/_lib/gemini-shared-quota.js) a função já passa
//                          a economizar por chamada (padrão: 0.75 = 75%)
//
// O teto GLOBAL de verdade (TOTAL_DAILY_LIMIT e IMPORT_RESERVE) mora em
// api/_lib/gemini-shared-quota.js, compartilhado com api/gemini.js — é lá
// que se ajusta GEMINI_TOTAL_DAILY_LIMIT / GEMINI_IMPORT_RESERVE pra deixar
// mais ou menos sobra garantida pra quem está importando grade.
//
// Necessário liberar as coleções "mentor_usage" e "gemini_usage_global" no
// firestore.rules (já incluído nesta atualização).

const sharedQuota = require('./_lib/gemini-shared-quota');

const GEMINI_MODELS = ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-2.5-flash'];
const DAILY_LIMIT = parseInt(process.env.MENTOR_DAILY_LIMIT || '60', 10);
const DEGRADE_RATIO = Math.min(0.95, Math.max(0.3, parseFloat(process.env.MENTOR_DEGRADE_RATIO || '0.75')));
// Quanto da cota total o chat pode usar, no máximo — o resto fica garantido
// pro import de grade mesmo que o chat esteja no talo.
const CHAT_CEILING = Math.max(0, sharedQuota.TOTAL_DAILY_LIMIT - sharedQuota.IMPORT_RESERVE);

// Teto de segurança pro tamanho do contexto que o front manda — o mentor
// monta um "raio-x" grande do usuário (matérias, mapa de aprendizado, diário,
// provas etc.) e isso vira texto dentro do prompt. Sem isso, um usuário com
// MUITOS dados cadastrados poderia gerar um payload gigante sem querer.
const MAX_CONTENTS_CHARS = 60000;

function isOverloadError(status, data) {
  if (status === 503) return true;
  const msg = (data?.error?.message || '').toLowerCase();
  return msg.includes('overload') || msg.includes('high demand') || msg.includes('unavailable');
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// `degraded` reduz o custo por chamada quando a cota global do site está
// perto do fim: usa só o primeiro modelo (sem cair pros de fallback), não
// tenta de novo no mesmo modelo se ele estiver sobrecarregado, e pede uma
// resposta mais curta ao Gemini (menos tokens de saída = mais barato/rápido).
async function callGeminiWithFallback(geminiKey, contents, systemInstruction, degraded) {
  const models = degraded ? GEMINI_MODELS.slice(0, 1) : GEMINI_MODELS;
  const maxAttemptsPerModel = degraded ? 1 : 2;
  let lastError = null;

  for (let i = 0; i < models.length; i += 1) {
    const model = models[i];
    for (let attempt = 0; attempt < maxAttemptsPerModel; attempt += 1) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
      const payload = {
        contents,
        generationConfig: {
          temperature: 0.55,
          maxOutputTokens: degraded ? 700 : 1400,
          topP: 0.9
        }
      };
      if (systemInstruction) payload.systemInstruction = systemInstruction;

      const geminiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await geminiRes.json().catch(() => ({}));

      if (geminiRes.ok) return { ok: true, data, modelUsed: model };

      lastError = { status: geminiRes.status, data };
      if (isOverloadError(geminiRes.status, data)) {
        if (attempt === 0 && attempt < maxAttemptsPerModel - 1) { await sleep(900); continue; }
        break;
      }
      return { ok: false, status: geminiRes.status, data };
    }
  }
  return { ok: false, status: lastError?.status || 503, data: lastError?.data || {} };
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

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

// Contador POR USUÁRIO, em "mentor_usage" — não compete com o limite de
// importação de grade ("ai_usage").
async function checkAndIncrementUsage(idToken, uid) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID não configurada no servidor.');

  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/mentor_usage/${uid}`;
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
    return { blocked: false, count: 0 };
  }

  if (count >= DAILY_LIMIT) {
    return { blocked: true, count };
  }

  await fetch(`${base}?updateMask.fieldPaths=date&updateMask.fieldPaths=count`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ fields: { date: { stringValue: today }, count: { integerValue: String(count + 1) } } })
  }).catch(() => {});

  return { blocked: false, count: count + 1, limit: DAILY_LIMIT };
}

// Cota GLOBAL compartilhada com api/gemini.js (ver api/_lib/gemini-shared-quota.js).
// O chat só pode usar até CHAT_CEILING chamadas do teto total do dia — o
// restante (GEMINI_IMPORT_RESERVE) fica garantido pra importação de grade,
// não importa quanto o chat já tenha consumido.
async function checkGlobalUsage(idToken) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID não configurada no servidor.');

  const count = await sharedQuota.readSharedCount(idToken, projectId);
  if (count === null) {
    // Firestore recusou (regra não publicada, etc.) — não bloqueia nem
    // degrada por causa disso, só deixa de proteger a cota nesta chamada.
    return { blocked: false, degraded: false, count: 0, ratio: 0 };
  }

  const blocked = count >= CHAT_CEILING;
  const ratio = CHAT_CEILING > 0 ? count / CHAT_CEILING : 1;

  if (!blocked) {
    await sharedQuota.incrementSharedCount(idToken, projectId, count);
  }

  return { blocked, degraded: !blocked && ratio >= DEGRADE_RATIO, count, ratio };
}

// CORS travado no domínio do site (+ localhost em dev), em vez de '*'.
// Mesmo raciocínio de api/gemini.js: a rota já exige Firebase ID token
// válido, mas travar a origem fecha o vetor de outro site chamar em nome
// de um usuário com token vazado por outro motivo.
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
    return res.status(503).json({ error: 'GEMINI_API_KEY não configurada no Vercel.' });
  }

  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!idToken) {
    return res.status(401).json({ error: 'É preciso estar logado no app para conversar com o Mentor IA.' });
  }

  let uid;
  try {
    uid = await verifyFirebaseToken(idToken);
  } catch {
    return res.status(401).json({ error: 'Sessão inválida ou expirada. Recarregue a página e faça login novamente.' });
  }

  let usageInfo = null;
  try {
    const usage = await checkAndIncrementUsage(idToken, uid);
    if (usage.blocked) {
      return res.status(429).json({
        error: `Você atingiu o limite de ${DAILY_LIMIT} mensagens do Mentor IA por hoje. Volta amanhã que a cota renova — enquanto isso o mentor ainda responde com as respostas rápidas baseadas nos teus dados.`
      });
    }
    usageInfo = usage;
  } catch (err) {
    console.error('[api/mentor-chat] erro ao checar limite de uso por usuário:', err.message);
  }

  // Limite GLOBAL — protege a cota do projeto inteiro no Gemini, que é
  // compartilhada por todos os usuários do site (ver comentário no topo).
  let degraded = false;
  try {
    const globalUsage = await checkGlobalUsage(idToken);
    degraded = globalUsage.degraded;
    if (globalUsage.blocked) {
      // Status proposital diferente de 429: o front-end (_askMentorAI em
      // ai-assistant.js) só mostra mensagem de erro pro usuário quando o
      // status é 429 (limite pessoal); qualquer outro "not ok" já cai
      // silenciosamente pro modo por regras. Isso é o que dá a "degradação
      // suave" pedida — ninguém vê erro feio, o site inteiro só volta a
      // responder com as regras locais até a cota global renovar.
      console.warn(`[api/mentor-chat] cota do chat esgotada (${globalUsage.count}/${CHAT_CEILING}, reserva de ${sharedQuota.IMPORT_RESERVE} preservada pro import) — degradando para respostas por regra.`);
      return res.status(503).json({ error: 'Mentor IA temporariamente em modo econômico (alta demanda no site). As respostas por regra continuam funcionando normalmente.' });
    }
    if (degraded) {
      console.warn(`[api/mentor-chat] cota do chat perto do teto (${globalUsage.count}/${CHAT_CEILING}, ${Math.round(globalUsage.ratio * 100)}%) — usando modo econômico nesta chamada.`);
    }
  } catch (err) {
    console.error('[api/mentor-chat] erro ao checar limite global:', err.message);
    // Falha ao checar cota global não bloqueia o usuário — só deixa de
    // proteger a cota nessa chamada específica.
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (!body.contents || !Array.isArray(body.contents) || !body.contents.length) {
      return res.status(400).json({ error: 'Requisição inválida: falta "contents".' });
    }

    const approxSize = JSON.stringify(body.contents).length;
    if (approxSize > MAX_CONTENTS_CHARS) {
      return res.status(413).json({ error: 'Contexto grande demais para essa mensagem. Tente novamente (o app ajusta automaticamente o tamanho).' });
    }

    const result = await callGeminiWithFallback(geminiKey, body.contents, body.systemInstruction, degraded);

    if (!result.ok) {
      const overloaded = isOverloadError(result.status, result.data);
      const msg = overloaded
        ? 'O Mentor IA está sobrecarregado no momento (todos os modelos tentados falharam). Tenta de novo em alguns segundos.'
        : (result.data?.error?.message || `Erro HTTP ${result.status} do Gemini`);
      return res.status(result.status || 503).json({ error: msg });
    }

    return res.status(200).json({ ...result.data, usage: usageInfo });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erro interno no proxy do Mentor IA' });
  }
};
