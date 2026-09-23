// api/cron-status.js — diagnóstico protegido do scheduler.
// Não expõe dados acadêmicos. Serve apenas para confirmar que o scheduler
// está sendo executado e quando foi a última execução concluída.

let firebaseAdminApp = null;
function getDb() {
  const admin = require('firebase-admin');
  if (!firebaseAdminApp) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY não configurada no servidor.');
    const serviceAccount = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    firebaseAdminApp = admin.apps.length ? admin.app() : admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
  return admin.firestore();
}

module.exports = async function handler(req, res) {
  const expected = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization || '';
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return res.status(401).json({ error: 'Não autorizado.' });
  }

  try {
    const db = getDb();
    const snap = await db.collection('system').doc('notificationScheduler').get();
    const data = snap.exists ? (snap.data() || {}) : {};
    const lastRunMs = Date.parse(String(data.lastRunAt || data.finishedAt || '')) || 0;
    const ageSeconds = lastRunMs ? Math.max(0, Math.round((Date.now() - lastRunMs) / 1000)) : null;
    const healthy = data.status === 'ok' || data.status === 'completed_with_errors';
    const recentlyRan = ageSeconds != null && ageSeconds <= 180;

    return res.status(200).json({
      scheduler: 'notificationScheduler',
      status: data.status || 'never_run',
      healthy: healthy && recentlyRan,
      recentlyRan,
      lastRunAt: data.lastRunAt || null,
      startedAt: data.startedAt || null,
      finishedAt: data.finishedAt || null,
      ageSeconds,
      runId: data.runId || null,
      lastAttemptAt: data.lastAttemptAt || null,
      summary: data.summary || null,
      error: data.error || null
    });
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }
};
