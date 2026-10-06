// Painel interno de uso da IA — acesso somente pelo allowlist administrativo da Vercel.
const quota = require('./_lib/gemini-admin-quota');
const { authenticateAdmin, sendAuthError } = require('./_lib/admin-auth');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await authenticateAdmin(req);
    const data = await quota.readDashboard();
    return res.status(200).json(data);
  } catch (err) {
    console.error('[admin-ai-usage]', err);
    if (err.statusCode) return sendAuthError(res, err);
    return res.status(503).json({ error: 'Não foi possível carregar o painel de IA.' });
  }
};
