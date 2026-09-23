// Diagnóstico autenticado do agendador de notificações.
const admin=require('firebase-admin');
let app;
function init(){if(app)return app;const raw=process.env.FIREBASE_SERVICE_ACCOUNT_KEY;if(!raw)throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY não configurada.');const service=JSON.parse(Buffer.from(raw,'base64').toString('utf8'));app=admin.apps.length?admin.app():admin.initializeApp({credential:admin.credential.cert(service)});return app;}
function bearer(req){const h=req.headers.authorization||'';return h.startsWith('Bearer ')?h.slice(7):'';}
module.exports=async function(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Método não permitido.'});
  try{
    const token=bearer(req);if(!token)return res.status(401).json({error:'Login necessário.'});
    const decoded=await init().auth().verifyIdToken(token);const db=admin.firestore();
    const [userSnap,healthSnap]=await Promise.all([db.collection('users').doc(decoded.uid).get(),db.collection('system').doc('notificationScheduler').get()]);
    const data=userSnap.data()||{};const h=healthSnap.exists?healthSnap.data():null;
    const subs=Array.isArray(data.pushSubscriptions)?data.pushSubscriptions:[];
    const lastRunMs=h?.lastRunAt?new Date(h.lastRunAt).getTime():null;
    return res.status(200).json({ok:true,permission:!!data.settings?.studyReminders?.enabled,focusPush:!!data.settings?.focusPushEnabled,subscriptions:subs.length,lastRunAt:h?.lastRunAt||null,minutesSinceRun:lastRunMs?Math.max(0,Math.round((Date.now()-lastRunMs)/60000)):null,lastRunSummary:h?.summary||null,lastRunError:h?.error||null});
  }catch(e){return res.status(500).json({error:e.message||'Não foi possível consultar a saúde das notificações.'});}
};
