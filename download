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
// Também é preciso liberar a coleção "ai_usage" no firestore.rules — veja o
// bloco novo em firestore.rules incluído nesta atualização.

const GEMINI_MODEL = 'gemini-flash-latest';
const DAILY_LIMIT = 8; // importações de grade por usuário por dia

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

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (!body.contents) {
      return res.status(400).json({ error: 'Requisição inválida: falta "contents".' });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`;

    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: body.contents,
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
      })
    });

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      const msg = data?.error?.message || `Erro HTTP ${geminiRes.status} do Gemini`;
      return res.status(geminiRes.status).json({ error: msg });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erro interno no proxy do Gemini' });
  }
};
