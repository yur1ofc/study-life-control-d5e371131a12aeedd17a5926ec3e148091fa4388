// Quota de IA SERVER-ONLY.
// Nenhum contador de quota é escrito pelo navegador. O Firebase Admin SDK usa
// uma transação Firestore para tornar a reserva atômica e impedir que duas
// pessoas consumam a mesma "vaga" ao mesmo tempo.

const admin = require('firebase-admin');

let app = null;
function getDb() {
  if (!app) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY não configurada no servidor.');
    const serviceAccount = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    app = admin.apps.length ? admin.app() : admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
  return admin.firestore();
}

function todayKey() {
  return new Date().toISOString().slice(0, 10); // UTC; mesma referência usada pelo painel
}

// IMPORTANTE: este número é um orçamento interno do SLCampus, NÃO uma afirmação
// sobre a quota do Google. Em produção, configure GEMINI_TOTAL_DAILY_LIMIT com
// um valor abaixo do RPD efetivo que aparece no AI Studio para os modelos usados.
const configuredTotal = parseInt(process.env.SLC_AI_TOTAL_DAILY_LIMIT || process.env.GEMINI_TOTAL_DAILY_LIMIT || '200', 10);
const TOTAL_DAILY_LIMIT = Number.isFinite(configuredTotal) && configuredTotal > 0 ? configuredTotal : 20;

const configuredReserve = parseInt(process.env.SLC_AI_IMPORT_RESERVE || process.env.GEMINI_IMPORT_RESERVE || '40', 10);
const IMPORT_RESERVE = Math.max(0, Math.min(TOTAL_DAILY_LIMIT - 1, Number.isFinite(configuredReserve) ? configuredReserve : 40));
const CHAT_CEILING = Math.max(0, TOTAL_DAILY_LIMIT - IMPORT_RESERVE);

const USER_IMPORT_LIMIT = parseInt(process.env.SLC_AI_USER_IMPORT_LIMIT || process.env.GEMINI_USER_IMPORT_LIMIT || '20', 10);
const MENTOR_DAILY_LIMIT = parseInt(process.env.SLC_AI_MENTOR_DAILY_LIMIT || process.env.MENTOR_DAILY_LIMIT || '60', 10);

function globalRef(db) {
  return db.collection('gemini_usage_global').doc('counter');
}
function userRef(db, collection, uid) {
  return db.collection(collection).doc(uid);
}
function logsCollection(db) {
  return db.collection('gemini_ai_logs');
}

async function reserveUserOperation({ uid, email, operation, requestId }) {
  const db = getDb();
  const today = todayKey();
  const isImport = operation === 'import';
  const collection = isImport ? 'ai_usage' : 'mentor_usage';
  const limit = isImport ? USER_IMPORT_LIMIT : MENTOR_DAILY_LIMIT;

  return db.runTransaction(async (tx) => {
    const ref = userRef(db, collection, uid);
    const snap = await tx.get(ref);
    const data = snap.exists ? (snap.data() || {}) : {};
    const count = data.date === today ? Number(data.count || 0) : 0;
    if (count >= limit) return { blocked: true, reason: 'user-limit', userCount: count };
    tx.set(ref, {
      date: today,
      count: count + 1,
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return { blocked: false, userCount: count + 1, userLimit: limit };
  });
}

async function reserveGlobalCall({ uid, email, operation, model, requestId }) {
  const db = getDb();
  const today = todayKey();
  const isImport = operation === 'import';
  const ceiling = isImport ? TOTAL_DAILY_LIMIT : CHAT_CEILING;

  return db.runTransaction(async (tx) => {
    const global = globalRef(db);
    const log = logsCollection(db).doc();
    const snap = await tx.get(global);
    const data = snap.exists ? (snap.data() || {}) : {};
    const count = data.date === today ? Number(data.count || 0) : 0;
    const importCalls = data.date === today ? Number(data.importCalls || 0) : 0;
    const mentorCalls = data.date === today ? Number(data.mentorCalls || 0) : 0;

    if (count >= ceiling) {
      return { blocked: true, reason: isImport ? 'global-limit' : 'chat-limit', globalCount: count };
    }

    const newData = {
      date: today,
      count: count + 1,
      importCalls: importCalls + (isImport ? 1 : 0),
      mentorCalls: mentorCalls + (isImport ? 0 : 1),
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    tx.set(global, newData, { merge: true });
    tx.set(log, {
      requestId: requestId || '', uid, email: email || '', operation, model,
      status: 'reserved', reservedAt: admin.firestore.FieldValue.serverTimestamp(),
      date: today, dailyGlobalCount: count + 1, globalLimit: ceiling,
      userOperationAlreadyCounted: true
    });
    return { blocked: false, logId: log.id, globalCount: count + 1 };
  });
}

async function reserveCall(args) {
  const user = await reserveUserOperation(args);
  if (user.blocked) return user;
  const global = await reserveGlobalCall(args);
  if (global.blocked) return { ...global, userOperationConsumed: true, userCount: user.userCount };
  return { ...user, ...global };
}


async function releaseUserOperation({ uid, operation }) {
  const db = getDb();
  const today = todayKey();
  const collection = operation === 'import' ? 'ai_usage' : 'mentor_usage';
  return db.runTransaction(async (tx) => {
    const ref = userRef(db, collection, uid);
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const data = snap.data() || {};
    if (data.date !== today) return;
    const count = Math.max(0, Number(data.count || 0) - 1);
    tx.set(ref, { date: today, count, lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  });
}

async function finishCall(logId, patch) {
  if (!logId) return;
  try {
    const db = getDb();
    await logsCollection(db).doc(logId).set({
      ...patch,
      finishedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.error('[gemini-quota] falha ao finalizar log:', err.message);
  }
}


async function readGlobalStatus() {
  const db = getDb();
  const snap = await globalRef(db).get();
  const data = snap.exists ? (snap.data() || {}) : {};
  const today = todayKey();
  const count = data.date === today ? Number(data.count || 0) : 0;
  return {
    date: today, count, importCalls: data.date === today ? Number(data.importCalls || 0) : 0,
    mentorCalls: data.date === today ? Number(data.mentorCalls || 0) : 0,
    total: TOTAL_DAILY_LIMIT, reserve: IMPORT_RESERVE, chatCeiling: CHAT_CEILING
  };
}

async function readDashboard() {
  const db = getDb();
  const today = todayKey();
  const globalSnap = await globalRef(db).get();
  const global = globalSnap.exists ? (globalSnap.data() || {}) : {};
  const current = global.date === today ? global : { date: today, count: 0, importCalls: 0, mentorCalls: 0 };
  const recentSnap = await logsCollection(db).orderBy('reservedAt', 'desc').limit(50).get();
  const logs = recentSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  return {
    date: today,
    budget: {
      total: TOTAL_DAILY_LIMIT,
      importReserve: IMPORT_RESERVE,
      chatCeiling: CHAT_CEILING,
      userImportLimit: USER_IMPORT_LIMIT,
      mentorDailyLimit: MENTOR_DAILY_LIMIT,
      source: (process.env.SLC_AI_TOTAL_DAILY_LIMIT || process.env.GEMINI_TOTAL_DAILY_LIMIT) ? 'env' : 'default'
    },
    usage: {
      total: Number(current.count || 0),
      import: Number(current.importCalls || 0),
      mentor: Number(current.mentorCalls || 0),
      remaining: Math.max(0, TOTAL_DAILY_LIMIT - Number(current.count || 0))
    },
    logs
  };
}

async function isAdmin({ uid, email }) {
  const adminUid = String(process.env.GEMINI_ADMIN_UID || '').trim();
  const adminEmail = String(process.env.GEMINI_ADMIN_EMAIL || '').trim().toLowerCase();
  return Boolean((adminUid && uid === adminUid) || (adminEmail && String(email || '').toLowerCase() === adminEmail));
}

module.exports = {
  TOTAL_DAILY_LIMIT,
  IMPORT_RESERVE,
  CHAT_CEILING,
  USER_IMPORT_LIMIT,
  MENTOR_DAILY_LIMIT,
  todayKey,
  reserveCall,
  reserveUserOperation,
  reserveGlobalCall,
  releaseUserOperation,
  finishCall,
  readGlobalStatus,
  readDashboard,
  isAdmin
};
