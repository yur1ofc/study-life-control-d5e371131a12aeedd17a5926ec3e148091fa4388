// api/admin-users.js
// Painel administrativo de usuários. Toda leitura de Firebase Auth e presença
// acontece no servidor; o navegador nunca recebe credenciais privilegiadas.
const admin = require('firebase-admin');
const { getFirebaseAdmin, authenticateAdmin, sendAuthError } = require('./_lib/admin-auth');

const DAY = 24 * 60 * 60 * 1000;

function dateKey(date) {
  const d = new Date(date);
  return d.toISOString().slice(0, 10);
}

function startOfUtcDay(ts) {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function clampNumber(value) {
  return Number.isFinite(value) ? value : 0;
}

async function listAllUsers() {
  const auth = getFirebaseAdmin().auth();
  const users = [];
  let token;

  do {
    const page = await auth.listUsers(1000, token);
    users.push(...page.users);
    token = page.pageToken;
  } while (token);

  return users;
}

function buildRegistrationSeries(users, days = 30) {
  const today = startOfUtcDay(Date.now());
  const map = new Map();

  for (let i = days - 1; i >= 0; i--) {
    const key = dateKey(today - i * DAY);
    map.set(key, 0);
  }

  for (const u of users) {
    const created = u.metadata?.creationTime ? Date.parse(u.metadata.creationTime) : NaN;
    if (!Number.isFinite(created)) continue;
    const key = dateKey(created);
    if (map.has(key)) map.set(key, map.get(key) + 1);
  }

  return [...map.entries()].map(([date, count]) => ({ date, count }));
}

function buildActivitySeries(presences, days = 14) {
  const today = startOfUtcDay(Date.now());
  const map = new Map();

  for (let i = days - 1; i >= 0; i--) {
    const key = dateKey(today - i * DAY);
    map.set(key, new Set());
  }

  // O histórico de presença não é necessário para o "agora". Se um registro
  // tiver lastSeenAt, contamos o usuário no dia correspondente; isso cria uma
  // pequena série útil sem guardar eventos a cada heartbeat.
  for (const p of presences) {
    const last = p.lastSeenAt?.toDate?.() || (p.lastSeenAt ? new Date(p.lastSeenAt) : null);
    if (!last) continue;
    const key = dateKey(last);
    if (map.has(key) && p.uid) map.get(key).add(p.uid);
  }

  return [...map.entries()].map(([date, set]) => ({ date, count: set.size }));
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await authenticateAdmin(req);
    const db = getFirebaseAdmin().firestore();
    const users = await listAllUsers();

    const now = Date.now();
    const dayStart = startOfUtcDay(now);
    const date = new Date(now);
    const monthStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
    const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);

    let registeredToday = 0;
    let activeToday = 0;
    let registeredMonth = 0;
    let registeredYear = 0;

    for (const u of users) {
      const created = u.metadata?.creationTime ? Date.parse(u.metadata.creationTime) : NaN;
      if (!Number.isFinite(created)) continue;
      if (created >= dayStart) registeredToday++;
      if (created >= monthStart) registeredMonth++;
      const lastSignIn = u.metadata?.lastSignInTime ? Date.parse(u.metadata.lastSignInTime) : NaN;
      if (Number.isFinite(lastSignIn) && lastSignIn >= dayStart) activeToday++;
      if (created >= yearStart) registeredYear++;
    }

    const activeSnap = await db.collection('user_presence')
      .where('expiresAt', '>', admin.firestore.Timestamp.now())
      .get();

    const active = activeSnap.docs.map(doc => {
      const p = doc.data() || {};
      const last = p.lastSeenAt?.toDate?.() || null;
      return {
        uid: doc.id,
        email: String(p.email || ''),
        displayName: String(p.displayName || ''),
        lastSeenAt: last ? last.toISOString() : null
      };
    }).sort((a, b) => String(b.lastSeenAt || '').localeCompare(String(a.lastSeenAt || '')));

    // Presenças atuais também alimentam uma pequena série de atividade recente.
    const presenceSnap = await db.collection('user_presence').get();
    const allPresence = presenceSnap.docs.map(d => d.data() || {});

    const registrations = buildRegistrationSeries(users, 30);
    const activity = buildActivitySeries(allPresence, 14);

    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      stats: {
        totalUsers: users.length,
        activeNow: active.length,
        activeToday,
        registeredToday,
        registeredMonth,
        registeredYear
      },
      registrations,
      activity,
      activeUsers: active
    });
  } catch (err) {
    console.error('[admin-users]', err);
    if (err.statusCode) return sendAuthError(res, err);
    return res.status(503).json({ error: 'Não foi possível carregar os dados administrativos.' });
  }
};
