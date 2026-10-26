// Entrega um PDF privado do Vercel Blob somente para o dono da conta.
// O token de leitura do Blob fica no servidor; o navegador recebe o stream.
const { Readable } = require('stream');
const { get } = require('@vercel/blob');
const { requireUser, validPath } = require('./_lib/blob-auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  try {
    const { decoded } = await requireUser(req);
    const pathname = Array.isArray(req.query?.pathname) ? req.query.pathname[0] : req.query?.pathname;
    if (!validPath(pathname, decoded.uid)) return res.status(400).json({ error: 'Caminho de arquivo inválido.' });

    const result = await get(pathname, { access: 'private' });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return res.status(404).json({ error: 'PDF não encontrado.' });
    }

    const filename = (pathname.split('/').pop() || 'documento.pdf').replace(/[^\w.\-]/g, '_');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', String(result.blob.size));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    Readable.fromWeb(result.stream).pipe(res);
  } catch (err) {
    console.error('[blob-download]', err);
    if (!res.headersSent) {
      const status = err?.status === 401 ? 401 : 400;
      return res.status(status).json({ error: status === 401 ? 'Login necessário.' : 'Não foi possível abrir o PDF.' });
    }
    try { res.destroy(err); } catch (_) {}
  }
};
