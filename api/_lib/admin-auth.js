// api/_lib/admin-auth.js
// Autenticação administrativa SERVER-ONLY.
// A lista de e-mails permitidos vem exclusivamente das variáveis de ambiente
// da Vercel. Nunca confie em um e-mail enviado pelo navegador.
const admin = require('firebase-admin');

function getFirebaseAdmin() {
  if (admin.apps.length) return admin.app();

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY não configurada no servidor.');

  const serviceAccount = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

function getAllowedEmails() {
  return String(
    process.env.SLC_ADMIN_EMAILS ||
    process.env.SLC_ADMIN_EMAIL ||
    process.env.GEMINI_ADMIN_EMAIL ||
    ''
  )
    .split(',')
    .map(x => x.trim().toLowerCase())
    .filter(Boolean);
}

function getAllowedUids() {
  return String(process.env.SLC_ADMIN_UIDS || process.env.GEMINI_ADMIN_UID || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);
}

async function authenticateAdmin(req) {
  const authHeader = String(req.headers.authorization || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    const err = new Error('Login necessário.');
    err.statusCode = 401;
    throw err;
  }

  const app = getFirebaseAdmin();
  let decoded;
  try {
    decoded = await app.auth().verifyIdToken(token);
  } catch (_) {
    const err = new Error('Sessão inválida.');
    err.statusCode = 401;
    throw err;
  }

  // Exige conta Google/Firebase com e-mail verificado.
  const email = String(decoded.email || '').trim().toLowerCase();
  const allowedEmails = getAllowedEmails();
  const allowedUids = getAllowedUids();

  const allowed =
    (email && allowedEmails.includes(email)) ||
    (decoded.uid && allowedUids.includes(decoded.uid));

  if (!allowed || decoded.email_verified !== true) {
    const err = new Error('Acesso negado.');
    err.statusCode = 403;
    throw err;
  }

  return {
    uid: decoded.uid,
    email,
    emailVerified: decoded.email_verified === true
  };
}

function sendAuthError(res, err) {
  return res.status(err.statusCode || 500).json({
    error: err.statusCode === 403 ? 'Acesso negado.' : (err.message || 'Não autorizado.')
  });
}

module.exports = { getFirebaseAdmin, authenticateAdmin, sendAuthError, getAllowedEmails, getAllowedUids };
