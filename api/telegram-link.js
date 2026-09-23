// SLCampus — vinculação segura da conta ao bot do Telegram.
const admin=require('firebase-admin');
const crypto=require('crypto');
let app;
function init(){if(app)return app;const raw=process.env.FIREBASE_SERVICE_ACCOUNT_KEY;if(!raw)throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY não configurada.');const service=JSON.parse(Buffer.from(raw,'base64').toString('utf8'));app=admin.apps.length?admin.app():admin.initializeApp({credential:admin.credential.cert(service)});return app;}
function bearer(req){const h=req.headers.authorization||'';return h.startsWith('Bearer ')?h.slice(7):'';}
function code(){return crypto.randomBytes(4).toString('hex').slice(0,6).toUpperCase();}
module.exports=async function(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Método não permitido.'});
  try{
    const t=bearer(req);if(!t)return res.status(401).json({error:'Login necessário.'});
    const decoded=await init().auth().verifyIdToken(t);const db=admin.firestore();const ref=db.collection('users').doc(decoded.uid);const action=req.body?.action||'create';
    if(action==='disconnect'){await ref.set({telegram:null},{merge:true});return res.status(200).json({ok:true,disconnected:true});}
    if(action==='notifications'){const enabled=req.body?.enabled!==false;await ref.set({telegram:{notificationsEnabled:enabled}},{merge:true});return res.status(200).json({ok:true,notificationsEnabled:enabled});}
    if(!process.env.TELEGRAM_WEBHOOK_SECRET)return res.status(503).json({error:'Telegram ainda não está configurado no servidor. Defina TELEGRAM_WEBHOOK_SECRET no Vercel.'});
    const c=code();const expiresAt=new Date(Date.now()+15*60000).toISOString();
    await db.collection('telegramLinks').doc(c).set({uid:decoded.uid,expiresAt,createdAt:new Date().toISOString()});
    await ref.set({telegramLinkCode:{code:c,expiresAt}},{merge:true});
    if(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_AUTO_WEBHOOK !== 'false'){
      const secret=process.env.TELEGRAM_WEBHOOK_SECRET;
      const webhook=`${process.env.APP_PUBLIC_URL||'https://slcampus.vercel.app'}/api/telegram-webhook`;
      const body={url:webhook,allowed_updates:['message'],secret_token:secret};
      try{await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});}catch(e){console.warn('[telegram-link] webhook setup failed:',e.message);}
    }
    return res.status(200).json({ok:true,code:c,expiresAt});
  }catch(e){return res.status(500).json({error:e.message||'Não foi possível gerar o código do Telegram.'});}
};
