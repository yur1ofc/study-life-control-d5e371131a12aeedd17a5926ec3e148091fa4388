// Gera uma URL de leitura temporária para um PDF privado do Vercel Blob.
// A URL expira em 5 minutos e só é emitida para o dono da conta.
const { issueSignedToken, presignUrl } = require('@vercel/blob');
const { requireUser, validPath } = require('./_lib/blob-auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  try {
    const { decoded } = await requireUser(req);
    const pathname = Array.isArray(req.query?.pathname) ? req.query.pathname[0] : req.query?.pathname;
    if (!validPath(pathname, decoded.uid)) return res.status(400).json({ error: 'Caminho de arquivo inválido.' });

    const validUntil = Date.now() + 5 * 60 * 1000;
    const signed = await issueSignedToken({
      pathname,
      operations: ['get'],
      validUntil
    });
    const { presignedUrl } = await presignUrl(signed, {
      operation: 'get',
      pathname,
      access: 'private',
      validUntil
    });
    return res.status(200).json({ url: presignedUrl, expiresAt: validUntil });
  } catch (err) {
    console.error('[blob-url]', err);
    const status = err?.status === 401 ? 401 : 400;
    return res.status(status).json({ error: status === 401 ? 'Login necessário.' : 'Não foi possível abrir o PDF.' });
  }
};
