// api/presence-heartbeat.js
// Presença em tempo real aproximada. Os dados são gravados somente pelo servidor.
const { getFirebaseAdmin } = require('./_lib/admin-auth');
const admin = require('firebase-admin');

function getDb() {
  const app = getFirebaseAdmin();
  return app.firestore();
}

async function verifyUser(req) {
  const authHeader = String(req.headers.authorization || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) throw Object.assign(new Error('Login necessário.'), { statusCode: 401 });
  try {
    return await getFirebaseAdmin().auth().verifyIdToken(token);
  } catch (_) {
    throw Object.assign(new Error('Sessão inválida.'), { statusCode: 401 });
  }
}

module.exports = async function handler(req, res) {
  if (!['POST', 'DELETE'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await verifyUser(req);
    const db = getDb();
    const ref = db.collection('user_presence').doc(user.uid);

    if (req.method === 'DELETE') {
      await ref.delete().catch(() => {});
      return res.status(204).end();
    }

    const now = admin.firestore.Timestamp.now();
    const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 90 * 1000);

    await ref.set({
      uid: user.uid,
      email: String(user.email || '').toLowerCase(),
      displayName: String(user.name || ''),
      lastSeenAt: now,
      expiresAt,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return res.status(204).end();
  } catch (err) {
    console.error('[presence-heartbeat]', err);
    return res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Não foi possível atualizar presença.' });
  }
};
