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
// Mesmas duas travas de segurança do api/gemini.js:
//   1) Só aceita chamadas de usuários LOGADOS (valida o Firebase ID token).
//   2) Limite diário por usuário, contado no Firestore (coleção
//      "mentor_usage", separada de "ai_usage").
//
// Variáveis de ambiente necessárias (as mesmas do api/gemini.js — reaproveita):
//   GEMINI_API_KEY, FIREBASE_API_KEY, FIREBASE_PROJECT_ID
// Variável opcional:
//   MENTOR_DAILY_LIMIT → limite de mensagens de chat por usuário/dia (padrão: 60)
//
// Necessário liberar a coleção "mentor_usage" no firestore.rules (já incluído
// nesta atualização, no mesmo bloco de "ai_usage").

const GEMINI_MODELS = ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-2.5-flash'];
const DAILY_LIMIT = parseInt(process.env.MENTOR_DAILY_LIMIT || '60', 10);

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

async function callGeminiWithFallback(geminiKey, contents, systemInstruction) {
  let lastError = null;
  for (let i = 0; i < GEMINI_MODELS.length; i += 1) {
    const model = GEMINI_MODELS[i];
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
      const payload = {
        contents,
        generationConfig: {
          temperature: 0.55,
          maxOutputTokens: 1400,
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
        if (attempt === 0) { await sleep(900); continue; }
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

// Mesmo padrão do api/gemini.js, mas em coleção própria ("mentor_usage") pra
// não competir com o limite de importação de grade.
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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
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
    console.error('[api/mentor-chat] erro ao checar limite de uso:', err.message);
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

    const result = await callGeminiWithFallback(geminiKey, body.contents, body.systemInstruction);

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
