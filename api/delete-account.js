const admin = require('firebase-admin');

let initialized = false;
function initAdmin() {
  if (initialized || admin.apps.length) { initialized = true; return admin.app(); }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY não configurada.');
  const serviceAccount = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  const app = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  initialized = true;
  return app;
}

function tokenFrom(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}

module.exports = async function handler(req,res) {
  if (req.method !== 'POST') return res.status(405).json({error:'Método não permitido.'});
  try {
    const app=initAdmin(), auth=admin.auth(app), db=admin.firestore(app);
    const token=tokenFrom(req);
    if(!token) return res.status(401).json({error:'Sessão não autenticada.'});
    const decoded=await auth.verifyIdToken(token, true);
    const uid=decoded.uid;

    // Exige autenticação recente. O cliente deve reautenticar o Google antes desta chamada.
    if (!decoded.auth_time || (Date.now()/1000 - decoded.auth_time) > 300) {
      return res.status(401).json({error:'Autenticação antiga. Confirme sua identidade novamente.'});
    }

    // Firestore Admin recursive delete remove o documento e subcoleções.
    await db.recursiveDelete(db.collection('users').doc(uid));

    // Remove arquivos privados do usuário, se o bucket estiver configurado.
    try {
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
      const bucket = bucketName ? admin.storage(app).bucket(bucketName) : admin.storage(app).bucket();
      await bucket.deleteFiles({prefix:`users/${uid}/`});
    } catch (e) {
      console.warn('[delete-account] Storage cleanup:', e.message);
    }

    await auth.deleteUser(uid);
    return res.status(200).json({ok:true});
  } catch(e) {
    console.error('[delete-account]',e);
    const status=e.code==='auth/id-token-revoked'||e.code==='auth/argument-error'?401:500;
    return res.status(status).json({error:'Não foi possível excluir a conta agora.'});
  }
};
