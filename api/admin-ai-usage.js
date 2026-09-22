// Painel interno de uso da IA. Nunca expõe a service account nem permite
// alteração da quota. A autorização é feita no servidor por UID/e-mail.
const quota = require('./_lib/gemini-admin-quota');

async function verifyFirebaseToken(idToken) {
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) throw new Error('FIREBASE_API_KEY não configurada no servidor.');
  const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken })
  });
  const data = await resp.json().catch(() => ({}));
  const u = data?.users?.[0];
  if (!resp.ok || !u?.localId) throw new Error('unauthorized');
  return { uid: u.localId, email: String(u.email || '').toLowerCase() };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Login necessário.' });
  let user;
  try { user = await verifyFirebaseToken(token); } catch { return res.status(401).json({ error: 'Sessão inválida.' }); }
  if (!(await quota.isAdmin(user))) return res.status(403).json({ error: 'Acesso negado.' });
  try {
    const data = await quota.readDashboard();
    return res.status(200).json(data);
  } catch (err) {
    console.error('[admin-ai-usage]', err);
    return res.status(503).json({ error: 'Não foi possível carregar o painel de IA.', detail: err.message });
  }
};
