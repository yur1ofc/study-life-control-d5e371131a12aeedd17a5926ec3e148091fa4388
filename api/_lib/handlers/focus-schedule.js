// SLCampus — agenda server-side do término do Modo Foco.
// O navegador informa ao servidor quando o bloco termina; o cron de push
// dispara a notificação mesmo que a aba/Chrome esteja fechado.
const admin = require('firebase-admin');
let initialized = false;
function db(){
  if(!initialized){
    const raw=process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if(!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY não configurada.');
    const service=JSON.parse(Buffer.from(raw,'base64').toString('utf8'));
    if(admin.apps.length) admin.app(); else admin.initializeApp({credential:admin.credential.cert(service)});
    initialized=true;
  }
  return admin.firestore();
}
function token(req){const h=req.headers.authorization||'';return h.startsWith('Bearer ')?h.slice(7):'';}
module.exports=async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Método não permitido.'});
  try{
    const t=token(req);if(!t)return res.status(401).json({error:'Login necessário.'});
    const decoded=await admin.auth().verifyIdToken(t);
    const body=req.body||{};
    const ref=db().collection('users').doc(decoded.uid);
    if(body.action==='cancel'){
      await ref.set({focusPushSchedule:null},{merge:true});
      return res.status(200).json({ok:true,cancelled:true});
    }
    const target=new Date(body.targetAt||'');
    if(Number.isNaN(target.getTime())||target.getTime()<=Date.now()-60000)return res.status(400).json({error:'Horário de término inválido.'});
    const durationSec=Math.max(60,Math.min(14400,Number(body.durationSec)||1500));
    const schedule={
      id:String(body.scheduleId||`focus-${Date.now()}`).slice(0,160),
      subject:String(body.subject||'').slice(0,160),
      topic:String(body.topic||'').slice(0,240),
      targetAt:target.toISOString(),
      targetMs:target.getTime(),
      durationSec,
      createdAt:new Date().toISOString(),
      sent:false
    };
    await ref.set({focusPushSchedule:schedule},{merge:true});
    return res.status(200).json({ok:true,schedule});
  }catch(e){console.error('[focus-schedule]',e);return res.status(500).json({error:'Não foi possível sincronizar o término do foco.'});}
};
