// SLCampus — proxy seguro do Gemini para importação de histórico/grade.
// A quota é SERVER-ONLY: Firebase Admin + transações atômicas.
const quota = require('./_lib/gemini-admin-quota');

// No máximo dois modelos por importação. Não fazemos chamadas paralelas:
// isso multiplicaria a quota e pode piorar sobrecarga no Free Tier.
const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-3.7-flash'];
// A importação de histórico pode exigir bastante tempo para o Gemini ler PDFs grandes.
// Mantemos até 140s por modelo; com no máximo dois modelos, o endpoint fica abaixo
// do limite de 300s configurado para a Function da Vercel.
const MODEL_TIMEOUT_MS = 140000;
const FALLBACK_DELAY_MS = 700;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function requestId() { return `imp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`; }
function transient(status, data) {
  const msg = String(data?.error?.message || '').toLowerCase();
  return [408, 429, 500, 502, 503, 504].includes(status) || /overload|high demand|temporar|unavailable|resource.?exhausted|deadline.?exceeded|timeout/.test(msg);
}
function modelUnavailable(status, data) {
  const msg = String(data?.error?.message || '');
  return status === 404 || (status === 400 && /model.*(not found|not available|unsupported)|not found.*model/i.test(msg));
}

async function verifyFirebaseToken(idToken) {
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) throw new Error('FIREBASE_API_KEY não configurada no servidor.');
  const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken })
  });
  const data = await resp.json().catch(() => ({}));
  const user = data?.users?.[0];
  if (!resp.ok || !user?.localId) throw new Error('unauthorized');
  return { uid: user.localId, email: String(user.email || '').toLowerCase() };
}

async function callOne(geminiKey, model, contents, meta) {
  const reservation = await quota.reserveGlobalCall({
    uid: meta.uid, email: meta.email, operation: 'import', model, requestId: meta.requestId
  });
  if (reservation.blocked) {
    return { ok: false, blocked: true, blockReason: reservation.reason, status: 503, model };
  }

  const started = Date.now();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
  let status = 503;
  let data = {};
  let outcome = 'error';
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, generationConfig: { responseMimeType: 'application/json' } }),
      signal: controller.signal
    });
    status = response.status;
    data = await response.json().catch(() => ({}));
    outcome = response.ok ? 'success' : (modelUnavailable(status, data) ? 'model-unavailable' : (transient(status, data) ? 'transient-error' : 'error'));
    if (response.ok) return { ok: true, data, modelUsed: model, status };
    return { ok: false, status, data, model, transient: transient(status, data), modelUnavailable: modelUnavailable(status, data) };
  } catch (err) {
    const aborted = err?.name === 'AbortError';
    status = aborted ? 504 : 503;
    data = { error: { message: aborted ? `O modelo excedeu o limite interno de ${Math.round(MODEL_TIMEOUT_MS / 1000)}s.` : (err.message || 'Falha de rede ao chamar o Gemini') } };
    return { ok: false, status, data, model, transient: true };
  } finally {
    clearTimeout(timer);
    await quota.finishCall(reservation.logId, {
      status: outcome,
      httpStatus: status,
      success: outcome === 'success',
      latencyMs: Date.now() - started,
      errorMessage: data?.error?.message || '',
      retryable: transient(status, data)
    });
  }
}

async function callGeminiWithFallback(key, contents, meta) {
  const attempts = [];
  let lastResult = null;
  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    if (i > 0) await sleep(FALLBACK_DELAY_MS);
    const result = await callOne(key, GEMINI_MODELS[i], contents, meta);
    lastResult = result;
    attempts.push({ model: result.model, status: result.status, ok: result.ok });
    if (result.ok) return { ...result, attempts };
    if (result.blocked) return { ...result, attempts };
    if (!result.transient && !result.modelUnavailable) return { ...result, attempts };
  }
  return { ...lastResult, ok: false, last: lastResult, attempts };
}

const ALLOWED_ORIGINS = ['https://slcampus.vercel.app', 'https://study-life-control.vercel.app'];
function resolveAllowedOrigin(req) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (/^https:\/\/(?:slcampus|study-life-control)(-[a-z0-9-]+)?\.vercel\.app$/.test(origin)) return origin;
  if (/^http:\/\/(?:localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return ALLOWED_ORIGINS[0];
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', resolveAllowedOrigin(req));
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: 'GEMINI_API_KEY não configurada no Vercel.' });
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'É preciso estar logado para usar a IA.' });

  let user;
  try { user = await verifyFirebaseToken(token); }
  catch { return res.status(401).json({ error: 'Sessão inválida ou expirada. Recarregue a página e faça login novamente.' }); }

  const rid = requestId();
  const testEmail = String(process.env.GEMINI_TEST_EMAIL || '').trim().toLowerCase();
  const testUid = String(process.env.GEMINI_TEST_UID || '').trim();
  const bypass = Boolean((testEmail && user.email === testEmail) || (testUid && user.uid === testUid));

  try {
    const userUsage = bypass
      ? { blocked: false, userCount: 0, bypassed: true }
      : await quota.reserveUserOperation({ uid: user.uid, email: user.email, operation: 'import', requestId: rid });
    if (userUsage.blocked) {
      console.warn(`[api/gemini] local-user-limit uid=${user.uid} count=${userUsage.userCount}`);
      return res.status(429).json({ error: `Limite de ${quota.USER_IMPORT_LIMIT} importações por dia atingido. Tente novamente amanhã.`, code: 'LOCAL_USER_LIMIT' });
    }
    if (bypass) console.warn(`[api/gemini] test-bypass ativo para ${user.email || user.uid}`);
  } catch (err) {
    // Fail closed: se não conseguimos verificar o contador server-side, não
    // chamamos o Gemini às cegas e queimamos quota sem proteção.
    console.error('[api/gemini] quota-user-unavailable:', err.message);
    return res.status(503).json({ error: 'O controle de uso da IA está temporariamente indisponível. Tente novamente em alguns segundos.', code: 'QUOTA_STORE_UNAVAILABLE' });
  }

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
  catch { return res.status(400).json({ error: 'JSON inválido.' }); }
  if (!body.contents || !Array.isArray(body.contents) || !body.contents.length) return res.status(400).json({ error: 'Requisição inválida: falta "contents".' });

  try {
    const result = await callGeminiWithFallback(key, body.contents, { uid: user.uid, email: user.email, requestId: rid });
    if (result.ok) {
      console.info(`[api/gemini] success uid=${user.uid} operation=import model=${result.modelUsed} attempts=${result.attempts.length}`);
      return res.status(200).json({ ...result.data, meta: { model: result.modelUsed, attempts: result.attempts.length, requestId: rid } });
    }

    const last = result.last || {};
    const status = last.status || result.status || 503;
    if (result.blocked) {
      if (!bypass) await quota.releaseUserOperation({ uid: user.uid, operation: 'import' }).catch(() => {});
      return res.status(503).json({ error: 'O limite global de IA do SLCampus foi atingido temporariamente. A importação fica protegida; tente novamente mais tarde.', code: 'GLOBAL_AI_LIMIT', attempts: result.attempts });
    }
    const reason = last?.status === 429 ? 'GOOGLE_429' : (last?.status === 504 ? 'GOOGLE_504' : (last?.status === 503 ? 'GOOGLE_503' : 'GOOGLE_ERROR'));
    console.warn(`[api/gemini] ${reason} uid=${user.uid} attempts=${JSON.stringify(result.attempts)} message=${last?.data?.error?.message || ''}`);
    res.setHeader('Retry-After', status === 429 ? '10' : '3');
    const msg = status === 504
      ? 'O Gemini demorou para responder. O SLCampus tentou até dois modelos e encerrou a tentativa para não consumir sua cota desnecessariamente.'
      : status === 503
        ? 'O Gemini está temporariamente indisponível ou sobrecarregado. O SLCampus tentou outro modelo automaticamente.'
        : status === 429
          ? 'O Gemini informou limite de requisições. Aguarde alguns segundos e tente novamente.'
          : (last?.data?.error?.message || `Erro HTTP ${status} do Gemini`);
    return res.status(status).json({ error: msg, code: reason, attempts: result.attempts, requestId: rid });
  } catch (err) {
    console.error(`[api/gemini] internal uid=${user.uid}:`, err);
    return res.status(500).json({ error: 'Erro interno no proxy do Gemini. Veja os logs da Vercel.', code: 'PROXY_INTERNAL_ERROR', requestId: rid });
  }
};
