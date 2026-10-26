// Emite um token de upload do Vercel Blob somente para o dono da conta.
// O arquivo vai direto do navegador para o Blob; não passa pelo corpo da
// função serverless (que tem limite de 4,5 MB no plano Hobby).
const { handleUpload } = require('@vercel/blob/client');
const { requireUser, validPath } = require('./_lib/blob-auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  try {
    const { decoded } = await requireUser(req);
    let body = req.body;
    if (Buffer.isBuffer(body)) body = JSON.parse(body.toString('utf8'));
    else if (typeof body === 'string') body = JSON.parse(body);
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!validPath(pathname, decoded.uid)) throw new Error('Caminho de arquivo inválido.');
        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: 25 * 1024 * 1024,
          addRandomSuffix: false,
          allowOverwrite: false,
          cacheControlMaxAge: 60 * 60 * 24 * 30,
          tokenPayload: JSON.stringify({ uid: decoded.uid })
        };
      }
    });
    return res.status(200).json(result);
  } catch (err) {
    console.error('[blob-upload]', err);
    const status = err?.status === 401 ? 401 : 400;
    return res.status(status).json({ error: status === 401 ? 'Login necessário.' : 'Não foi possível autorizar o upload do PDF.' });
  }
};
