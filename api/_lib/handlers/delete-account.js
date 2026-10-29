const admin = require('firebase-admin');
const { list, del } = require('@vercel/blob');

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


    // Remove os PDFs da Biblioteca que ficam no Vercel Blob (fora do Firebase).
    // É feito ANTES de apagar o doc do Firestore/Auth: se o Blob falhar, a conta
    // NÃO é excluída, evitando prometer uma exclusão total e reter os arquivos.
    async function deleteUserBlobs() {
      let cursor;
      do {
        const page = await list({ prefix: `users/${uid}/`, cursor, limit: 1000 });
        if (page.blobs.length) {
          await del(page.blobs.map(blob => blob.url));
        }
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
    }
    await deleteUserBlobs();

    // Remove recursos públicos/auxiliares que ficam fora de users/{uid}.
    // Calendar feeds são links públicos por token; sem esta limpeza um link
    // antigo poderia continuar expondo a agenda após a exclusão da conta.
    async function deleteQuery(query) {
      while (true) {
        const snap = await query.limit(200).get();
        if (snap.empty) break;
        const batch = db.batch();
        snap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
    }
    await deleteQuery(db.collection('calendar_feeds').where('uid','==',uid));
    await deleteQuery(db.collection('telegramLinks').where('uid','==',uid));

    // Conteúdo enviado pelo próprio usuário e que guarda o uid/email dele.
    // Feedback e contribuições não são compartilhados com outros usuários;
    // apagar é necessário para não reter dado pessoal após a exclusão da conta.
    await deleteQuery(db.collection('feedback').where('uid','==',uid));
    await deleteQuery(db.collection('community_catalog_submissions').where('sourceUserId','==',uid));
    // Versões antigas das contribuições guardavam o e-mail em vez do uid.
    if (decoded.email) {
      await deleteQuery(db.collection('community_catalog_submissions').where('sourceUserEmail','==',decoded.email));
    }

    // Catálogos comunitários são conteúdo compartilhado (grade curricular) e
    // não devem desaparecer para os outros alunos. Em vez de apagar, remove a
    // autoria (uid) para desvincular o conteúdo da conta excluída.
    async function anonymizeCatalogs() {
      while (true) {
        const snap = await db.collection('community_catalogs')
          .where('createdBy','==',uid).limit(200).get();
        if (snap.empty) break;
        const batch = db.batch();
        snap.docs.forEach(doc => batch.update(doc.ref, {
          createdBy: admin.firestore.FieldValue.delete(),
          updatedBy: admin.firestore.FieldValue.delete()
        }));
        await batch.commit();
      }
    }
    await anonymizeCatalogs();

    await db.collection('user_presence').doc(uid).delete().catch(() => null);

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
