// SLCampus — rate limit de rajada por usuário via Upstash Redis (KV do Marketplace da Vercel).
// Fixed window: INCR por janela de tempo + EXPIRE automático (as chaves se limpam sozinhas).
// Fail-open: se o KV estiver indisponível, a requisição segue normalmente — a IA nunca
// fica fora do ar por conta do rate limit (a proteção de custo diária continua no Firestore).
//
// Configurado automaticamente pela instalação do Upstash no Marketplace:
//   KV_REST_API_URL / KV_REST_API_TOKEN (aliases: UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN)

const BASE = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

async function redisCommand(command) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(command)
  });
  if (!res.ok) throw new Error('Upstash HTTP ' + res.status);
  return res.json();
}

// rateLimit(scope, uid, limit, windowSec) -> { ok, count, limit } ou { ok:true, failed } se o KV cair.
module.exports = async function rateLimit(scope, uid, limit, windowSec) {
  if (!BASE || !TOKEN) return { ok: true, skipped: 'KV não configurado' };
  try {
    const bucket = Math.floor(Date.now() / 1000 / windowSec);
    const key = 'rl:' + scope + ':' + String(uid).slice(0, 64) + ':' + bucket;
    const r = await redisCommand(['INCR', key]);
    const count = Number(r.result || 0);
    if (count === 1) await redisCommand(['EXPIRE', key, windowSec + 5]);
    return { ok: count <= limit, count, limit };
  } catch (err) {
    console.warn('[rate-limit] KV indisponível (fail-open): ' + err.message);
    return { ok: true, failed: true };
  }
};
