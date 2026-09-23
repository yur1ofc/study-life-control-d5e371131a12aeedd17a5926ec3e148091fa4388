// Diagnóstico autenticado do agendador de notificações.
const admin=require('firebase-admin');
let app;
function init(){if(app)return app;const raw=process.env.FIREBASE_SERVICE_ACCOUNT_KEY;if(!raw)throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY não configurada.');const service=JSON.parse(Buffer.from(raw,'base64').toString('utf8'));app=admin.apps.length?admin.app():admin.initializeApp({credential:admin.credential.cert(service)});return app;}
function bearer(req){const h=req.headers.authorization||'';return h.startsWith('Bearer ')?h.slice(7):'';}
module.exports=async function(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Método não permitido.'});
  try{
    const token=bearer(req);
    const expected=process.env.CRON_SECRET||'';
    const isCron=!!expected && token===expected;
    if(!token)return res.status(401).json({error:'Autenticação necessária.'});
    const db=admin.firestore();
    let decoded=null;
    if(!isCron) decoded=await init().auth().verifyIdToken(token);
    const healthSnap=await db.collection('system').doc('notificationScheduler').get();
    const h=healthSnap.exists?healthSnap.data():null;
    const lastRunMs=h?.lastRunAt?new Date(h.lastRunAt).getTime():null;
    const recent=h?.lastRunAt?Math.max(0,Math.round((Date.now()-lastRunMs)/60000)):null;
    if(isCron){
      return res.status(200).json({ok:true,mode:'cron',status:h?.status||'never_run',healthy:!!(lastRunMs&&Date.now()-lastRunMs<=15*60000),lastRunAt:h?.lastRunAt||null,lastAttemptAt:h?.lastAttemptAt||null,finishedAt:h?.finishedAt||null,minutesSinceRun:recent,lastRunSummary:h?.summary||null,lastRunError:h?.error||null,runId:h?.runId||null,lockUntil:h?.lockUntil||null});
    }
    const userSnap=await db.collection('users').doc(decoded.uid).get();
    const data=userSnap.data()||{};
    const subs=Array.isArray(data.pushSubscriptions)?data.pushSubscriptions:[];
    return res.status(200).json({ok:true,mode:'user',permission:!!data.settings?.studyReminders?.enabled,focusPush:!!data.settings?.focusPushEnabled,subscriptions:subs.length,lastRunAt:h?.lastRunAt||null,minutesSinceRun:recent,lastRunSummary:h?.summary||null,lastRunError:h?.error||null,schedulerStatus:h?.status||'never_run',schedulerHealthy:!!(lastRunMs&&Date.now()-lastRunMs<=15*60000)});
  }catch(e){return res.status(500).json({error:e.message||'Não foi possível consultar a saúde das notificações.'});}
};
