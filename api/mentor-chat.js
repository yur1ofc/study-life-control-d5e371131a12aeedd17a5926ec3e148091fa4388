// SLCampus — Mentor IA. Quota e contadores são exclusivamente server-side.
const quota = require('./_lib/gemini-admin-quota');

const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-3.7-flash'];
const MODEL_TIMEOUT_MS = 7500;
const FALLBACK_DELAY_MS = 500;
const DEGRADE_RATIO = Math.min(0.95, Math.max(0.5, parseFloat(process.env.MENTOR_DEGRADE_RATIO || '0.75')));
const MAX_CONTENTS_CHARS = 60000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function rid() { return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`; }
function transient(status, data) {
  const msg = String(data?.error?.message || '').toLowerCase();
  return [408, 429, 500, 502, 503, 504].includes(status) || /overload|high demand|temporar|unavailable|resource.?exhausted|deadline.?exceeded|timeout/.test(msg);
}
function unavailable(status, data) {
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

async function callOne(key, model, contents, systemInstruction, meta, degraded) {
  const reservation = await quota.reserveGlobalCall({ uid: meta.uid, email: meta.email, operation: 'mentor', model, requestId: meta.requestId });
  if (reservation.blocked) return { ok: false, blocked: true, blockReason: reservation.reason, status: 503, model };
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
  let status = 503, data = {}, outcome = 'error';
  try {
    const payload = {
      contents,
      generationConfig: { maxOutputTokens: degraded ? 700 : 1100 }
    };
    if (systemInstruction) payload.systemInstruction = systemInstruction;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal
    });
    status = response.status;
    data = await response.json().catch(() => ({}));
    outcome = response.ok ? 'success' : (unavailable(status, data) ? 'model-unavailable' : (transient(status, data) ? 'transient-error' : 'error'));
    return response.ok ? { ok: true, data, modelUsed: model, status } : { ok: false, status, data, model, transient: transient(status, data), modelUnavailable: unavailable(status, data) };
  } catch (err) {
    status = err?.name === 'AbortError' ? 504 : 503;
    data = { error: { message: err?.name === 'AbortError' ? `O modelo excedeu ${MODEL_TIMEOUT_MS / 1000}s.` : (err.message || 'Falha de rede ao chamar o Gemini') } };
    return { ok: false, status, data, model, transient: true };
  } finally {
    clearTimeout(timer);
    await quota.finishCall(reservation.logId, {
      status: outcome, httpStatus: status, success: outcome === 'success',
      latencyMs: Date.now() - started, errorMessage: data?.error?.message || '', retryable: transient(status, data), degraded
    });
  }
}

async function callGemini(key, contents, systemInstruction, meta, degraded) {
  const models = degraded ? GEMINI_MODELS.slice(0, 1) : GEMINI_MODELS;
  let last = null; const attempts = [];
  for (let i = 0; i < models.length; i++) {
    if (i) await sleep(FALLBACK_DELAY_MS);
    last = await callOne(key, models[i], contents, systemInstruction, meta, degraded);
    attempts.push({ model: last.model, status: last.status, ok: last.ok });
    if (last.ok || last.blocked) break;
    if (!last.transient && !last.modelUnavailable) break;
  }
  return { ...last, attempts };
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
  if (!token) return res.status(401).json({ error: 'É preciso estar logado no app para conversar com o Mentor IA.' });

  let user;
  try { user = await verifyFirebaseToken(token); }
  catch { return res.status(401).json({ error: 'Sessão inválida ou expirada. Recarregue a página e faça login novamente.' }); }

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
  catch { return res.status(400).json({ error: 'JSON inválido.' }); }
  if (!body.contents || !Array.isArray(body.contents) || !body.contents.length) return res.status(400).json({ error: 'Requisição inválida: falta "contents".' });
  if (JSON.stringify(body.contents).length > MAX_CONTENTS_CHARS) return res.status(413).json({ error: 'Contexto grande demais para esta mensagem.' });

  const requestId = rid();
  try {
    const usage = await quota.reserveUserOperation({ uid: user.uid, email: user.email, operation: 'mentor', requestId });
    if (usage.blocked) return res.status(429).json({ error: `Você atingiu o limite de ${quota.MENTOR_DAILY_LIMIT} mensagens do Mentor IA por hoje.`, code: 'LOCAL_MENTOR_LIMIT' });
  } catch (err) {
    console.error('[api/mentor-chat] quota-user-unavailable:', err.message);
    return res.status(503).json({ error: 'O controle de uso da IA está temporariamente indisponível. Tente novamente em alguns segundos.', code: 'QUOTA_STORE_UNAVAILABLE' });
  }

  let status;
  try { status = await quota.readGlobalStatus(); }
  catch (err) {
    await quota.releaseUserOperation({ uid: user.uid, operation: 'mentor' }).catch(() => {});
    console.error('[api/mentor-chat] quota-global-unavailable:', err.message);
    return res.status(503).json({ error: 'O controle global da IA está temporariamente indisponível.', code: 'QUOTA_STORE_UNAVAILABLE' });
  }

  if (status.count >= status.chatCeiling) {
    await quota.releaseUserOperation({ uid: user.uid, operation: 'mentor' }).catch(() => {});
    console.warn(`[api/mentor-chat] chat-limit count=${status.count}/${status.chatCeiling}`);
    return res.status(503).json({ error: 'Mentor IA está em modo econômico por limite de uso do site. As respostas locais continuam disponíveis.', code: 'GLOBAL_CHAT_LIMIT' });
  }

  const degraded = status.chatCeiling > 0 && (status.count / status.chatCeiling) >= DEGRADE_RATIO;
  if (degraded) console.info(`[api/mentor-chat] economical-mode count=${status.count}/${status.chatCeiling}`);

  try {
    const result = await callGemini(key, body.contents, body.systemInstruction, { uid: user.uid, email: user.email, requestId }, degraded);
    if (result.ok) return res.status(200).json({ ...result.data, meta: { model: result.modelUsed, attempts: result.attempts.length, degraded, requestId } });
    if (result.blocked) {
      await quota.releaseUserOperation({ uid: user.uid, operation: 'mentor' }).catch(() => {});
      return res.status(503).json({ error: 'Mentor IA entrou em modo econômico por alta demanda. Tente novamente em alguns segundos.', code: 'GLOBAL_CHAT_LIMIT', attempts: result.attempts });
    }
    const statusCode = result.status || 503;
    const code = statusCode === 429 ? 'GOOGLE_429' : statusCode === 504 ? 'GOOGLE_504' : statusCode === 503 ? 'GOOGLE_503' : 'GOOGLE_ERROR';
    console.warn(`[api/mentor-chat] ${code} uid=${user.uid} attempts=${JSON.stringify(result.attempts)} message=${result.data?.error?.message || ''}`);
    return res.status(statusCode).json({ error: statusCode === 503 ? 'O Gemini está temporariamente sobrecarregado. O Mentor continuará disponível em modo local quando possível.' : (result.data?.error?.message || `Erro HTTP ${statusCode} do Gemini`), code, attempts: result.attempts, requestId });
  } catch (err) {
    console.error('[api/mentor-chat] internal:', err);
    return res.status(500).json({ error: 'Erro interno no Mentor IA.', code: 'PROXY_INTERNAL_ERROR', requestId });
  }
};
