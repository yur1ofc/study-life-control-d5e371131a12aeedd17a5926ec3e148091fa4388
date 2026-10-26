// Autenticação compartilhada dos endpoints do Vercel Blob.
// Nunca expõe o token do Blob para o navegador: o cliente só recebe um
// token de upload de curta duração, limitado ao próprio usuário.
const admin = require('firebase-admin');

let app;
function init() {
  if (app) return app;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY não configurada.');
  const service = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  app = admin.apps.length ? admin.app() : admin.initializeApp({ credential: admin.credential.cert(service) });
  return app;
}

function bearer(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

async function requireUser(req) {
  const token = bearer(req);
  if (!token) {
    const err = new Error('Login necessário.');
    err.status = 401;
    throw err;
  }
  const firebaseApp = init();
  const decoded = await firebaseApp.auth().verifyIdToken(token, true);
  return { firebaseApp, decoded };
}

function validPath(pathname, uid) {
  return typeof pathname === 'string'
    && pathname.length > 0
    && pathname.length <= 500
    && pathname.startsWith(`users/${uid}/resources/`)
    && !pathname.includes('..')
    && !pathname.includes('\\')
    && /\.pdf$/i.test(pathname);
}

module.exports = { init, requireUser, validPath };
