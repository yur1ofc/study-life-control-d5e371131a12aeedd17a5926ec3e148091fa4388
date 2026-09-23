// SLCampus AI quota — server only.
// Mantém a quota do usuário separada da quota de cada provedor. Uma operação
// do usuário (ex.: uma mensagem do Mentor) conta 1 vez para o usuário, mesmo
// quando o AI Router precisa trocar de Gemini para Groq ou vice-versa.

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
  return new Date().toISOString().slice(0, 10);
}

function envInt(names, fallback) {
  for (const name of names) {
    const n = parseInt(process.env[name] || '', 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return fallback;
}

// Trava interna do SLCampus. Não representa a quota oficial de nenhum provedor.
// As variáveis antigas de quota do Gemini ficam ignoradas de propósito: eram
// uma trava de provedor único e poderiam continuar bloqueando o novo roteador.
// Para ajustar o orçamento combinado, use somente SLC_AI_COMBINED_DAILY_LIMIT.
const TOTAL_DAILY_LIMIT = envInt(['SLC_AI_COMBINED_DAILY_LIMIT'], 400);

const GEMINI_DAILY_LIMIT = Math.min(
  TOTAL_DAILY_LIMIT,
  envInt(['SLC_AI_GEMINI_DAILY_LIMIT', 'GEMINI_DAILY_LIMIT'], Math.min(100, TOTAL_DAILY_LIMIT))
);

const GROQ_DAILY_LIMIT = Math.min(
  TOTAL_DAILY_LIMIT,
  envInt(['SLC_AI_GROQ_DAILY_LIMIT', 'GROQ_DAILY_LIMIT'], TOTAL_DAILY_LIMIT)
);

const configuredReserve = envInt(['SLC_AI_IMPORT_RESERVE', 'GEMINI_IMPORT_RESERVE'], Math.max(1, Math.round(TOTAL_DAILY_LIMIT * 0.20)));
const IMPORT_RESERVE = Math.max(0, Math.min(TOTAL_DAILY_LIMIT - 1, configuredReserve));
const CHAT_CEILING = Math.max(0, TOTAL_DAILY_LIMIT - IMPORT_RESERVE);
const USER_IMPORT_LIMIT = envInt(['SLC_AI_USER_IMPORT_LIMIT', 'GEMINI_USER_IMPORT_LIMIT'], 20);
const MENTOR_DAILY_LIMIT = envInt(['SLC_AI_MENTOR_DAILY_LIMIT', 'MENTOR_DAILY_LIMIT'], 60);

function globalRef(db) {
  return db.collection('gemini_usage_global').doc('counter');
}
function userRef(db, collection, uid) {
  return db.collection(collection).doc(uid);
}
function logsCollection(db) {
  return db.collection('gemini_ai_logs');
}

async function reserveUserOperation({ uid, email, operation }) {
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

async function reserveGlobalCall({ uid, email, operation, model, requestId, provider = 'groq' }) {
  const db = getDb();
  const today = todayKey();
  const normalizedProvider = provider === 'gemini' ? 'gemini' : 'groq';
  const providerLimit = normalizedProvider === 'gemini' ? GEMINI_DAILY_LIMIT : GROQ_DAILY_LIMIT;
  const ceiling = operation === 'import' ? TOTAL_DAILY_LIMIT : CHAT_CEILING;

  return db.runTransaction(async (tx) => {
    const global = globalRef(db);
    const log = logsCollection(db).doc();
    const snap = await tx.get(global);
    const data = snap.exists ? (snap.data() || {}) : {};
    const sameDay = data.date === today;
    const count = sameDay ? Number(data.count || 0) : 0;
    const importCalls = sameDay ? Number(data.importCalls || 0) : 0;
    const mentorCalls = sameDay ? Number(data.mentorCalls || 0) : 0;
    const geminiCalls = sameDay ? Number(data.geminiCalls || 0) : 0;
    const groqCalls = sameDay ? Number(data.groqCalls || 0) : 0;
    const providerCount = normalizedProvider === 'gemini' ? geminiCalls : groqCalls;

    if (count >= ceiling) {
      return { blocked: true, reason: operation === 'import' ? 'global-limit' : 'chat-limit', globalCount: count, provider: normalizedProvider };
    }
    if (providerCount >= providerLimit) {
      return { blocked: true, reason: 'provider-limit', provider: normalizedProvider, providerCount, providerLimit, globalCount: count };
    }

    const newData = {
      date: today,
      count: count + 1,
      importCalls: importCalls + (operation === 'import' ? 1 : 0),
      mentorCalls: mentorCalls + (operation === 'import' ? 0 : 1),
      geminiCalls: geminiCalls + (normalizedProvider === 'gemini' ? 1 : 0),
      groqCalls: groqCalls + (normalizedProvider === 'groq' ? 1 : 0),
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    tx.set(global, newData, { merge: true });
    tx.set(log, {
      requestId: requestId || '', uid, email: email || '', operation, model,
      provider: normalizedProvider,
      status: 'reserved', reservedAt: admin.firestore.FieldValue.serverTimestamp(),
      date: today, dailyGlobalCount: count + 1, globalLimit: ceiling,
      dailyProviderCount: providerCount + 1, providerLimit,
      userOperationAlreadyCounted: true
    });
    return {
      blocked: false,
      logId: log.id,
      globalCount: count + 1,
      provider: normalizedProvider,
      providerCount: providerCount + 1,
      providerLimit
    };
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
    console.error('[ai-quota] falha ao finalizar log:', err.message);
  }
}

async function readGlobalStatus() {
  const db = getDb();
  const snap = await globalRef(db).get();
  const data = snap.exists ? (snap.data() || {}) : {};
  const today = todayKey();
  const sameDay = data.date === today;
  const count = sameDay ? Number(data.count || 0) : 0;
  return {
    date: today,
    count,
    importCalls: sameDay ? Number(data.importCalls || 0) : 0,
    mentorCalls: sameDay ? Number(data.mentorCalls || 0) : 0,
    geminiCalls: sameDay ? Number(data.geminiCalls || 0) : 0,
    groqCalls: sameDay ? Number(data.groqCalls || 0) : 0,
    total: TOTAL_DAILY_LIMIT,
    reserve: IMPORT_RESERVE,
    chatCeiling: CHAT_CEILING,
    geminiLimit: GEMINI_DAILY_LIMIT,
    groqLimit: GROQ_DAILY_LIMIT
  };
}

async function readDashboard() {
  const db = getDb();
  const today = todayKey();
  const globalSnap = await globalRef(db).get();
  const global = globalSnap.exists ? (globalSnap.data() || {}) : {};
  const sameDay = global.date === today;
  const current = sameDay ? global : { date: today, count: 0, importCalls: 0, mentorCalls: 0, geminiCalls: 0, groqCalls: 0 };
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
      geminiDailyLimit: GEMINI_DAILY_LIMIT,
      groqDailyLimit: GROQ_DAILY_LIMIT,
      source: (
        process.env.SLC_AI_COMBINED_DAILY_LIMIT || process.env.SLC_AI_GEMINI_DAILY_LIMIT ||
        process.env.SLC_AI_GROQ_DAILY_LIMIT
      ) ? 'env' : 'default'
    },
    usage: {
      total: Number(current.count || 0),
      import: Number(current.importCalls || 0),
      mentor: Number(current.mentorCalls || 0),
      gemini: Number(current.geminiCalls || 0),
      groq: Number(current.groqCalls || 0),
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
  GEMINI_DAILY_LIMIT,
  GROQ_DAILY_LIMIT,
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
