// Exclui um PDF privado do Vercel Blob depois de validar o Firebase ID token.
const { del } = require('@vercel/blob');
const { requireUser, validPath } = require('./_lib/blob-auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  try {
    const { decoded } = await requireUser(req);
    let body = req.body || {};
    if (Buffer.isBuffer(body)) body = JSON.parse(body.toString('utf8'));
    else if (typeof body === 'string') body = JSON.parse(body);
    const pathname = body.pathname;
    if (!validPath(pathname, decoded.uid)) return res.status(400).json({ error: 'Caminho de arquivo inválido.' });
    try {
      await del(pathname);
    } catch (err) {
      // Se o arquivo já não existe, o registro do Firestore ainda pode ser
      // removido normalmente; não bloqueia a exclusão do recurso.
      console.warn('[blob-delete] arquivo ausente ou falha ao apagar:', err?.message || err);
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[blob-delete]', err);
    const status = err?.status === 401 ? 401 : 400;
    return res.status(status).json({ error: status === 401 ? 'Login necessário.' : 'Não foi possível excluir o PDF.' });
  }
};
