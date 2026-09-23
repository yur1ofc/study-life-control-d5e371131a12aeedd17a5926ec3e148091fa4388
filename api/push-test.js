// SLCampus — teste de push do dispositivo atual.
// Usa o Firebase ID token do usuário e a assinatura já salva no Firestore.
const admin = require('firebase-admin');
const webpush = require('web-push');
let app;
function getDb(){
  if(!app){
    const raw=process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if(!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY não configurada.');
    const service=JSON.parse(Buffer.from(raw,'base64').toString('utf8'));
    app=admin.apps.length?admin.app():admin.initializeApp({credential:admin.credential.cert(service)});
  }
  return admin.firestore();
}
function bearer(req){const h=req.headers.authorization||'';return h.startsWith('Bearer ')?h.slice(7):'';}
module.exports=async function(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Método não permitido.'});
  try{
    const token=bearer(req); if(!token) return res.status(401).json({error:'Login necessário.'});
    const decoded=await admin.auth().verifyIdToken(token);
    const data=(await getDb().collection('users').doc(decoded.uid).get()).data()||{};
    const subs=Array.isArray(data.pushSubscriptions)?data.pushSubscriptions:[];
    const endpoint=req.body?.endpoint;
    const selected=endpoint?subs.filter(s=>s.endpoint===endpoint):subs;
    if(!selected.length) return res.status(404).json({error:'Assinatura deste dispositivo não foi encontrada no servidor.'});
    const {VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY,VAPID_SUBJECT}=process.env;
    if(!VAPID_PUBLIC_KEY||!VAPID_PRIVATE_KEY||!VAPID_SUBJECT) return res.status(503).json({error:'VAPID não configurado no servidor.'});
    webpush.setVapidDetails(VAPID_SUBJECT,VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY);
    let sent=0; const valid=[];
    for(const sub of selected){
      try{
        await webpush.sendNotification(sub,JSON.stringify({title:'SLCampus — teste de notificações',body:'Se você recebeu isso, o Push deste dispositivo está funcionando.',url:'./',tag:`push-test:${Date.now()}`,requireInteraction:false}));
        sent++; valid.push(sub);
      }catch(err){ if(err.statusCode!==404&&err.statusCode!==410) throw err; }
    }
    if(sent===0) return res.status(410).json({error:'A assinatura deste dispositivo expirou. Ative os alarmes novamente.'});
    const merged=subs.filter(s=>!selected.some(x=>x.endpoint===s.endpoint)||valid.some(x=>x.endpoint===s.endpoint));
    await getDb().collection('users').doc(decoded.uid).update({pushSubscriptions:merged,lastPushTestAt:new Date().toISOString()});
    return res.status(200).json({ok:true,sent});
  }catch(e){console.error('[push-test]',e);return res.status(500).json({error:e.message||'Falha no teste de Push.'});}
};
