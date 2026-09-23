// SLCampus — Mentor IA multi-provider. Mantém /api/mentor-chat por compatibilidade.
const quota=require('./_lib/gemini-admin-quota');
const AI=require('./_lib/ai-core');
const ALLOWED_ORIGINS=['https://slcampus.vercel.app','https://study-life-control.vercel.app'];
function origin(req){const o=req.headers.origin||'';if(ALLOWED_ORIGINS.includes(o))return o;if(/^https:\/\/(?:slcampus|study-life-control)(-[a-z0-9-]+)?\.vercel\.app$/.test(o))return o;if(/^http:\/\/(?:localhost|127\.0\.0\.1)(:\d+)?$/.test(o))return o;return ALLOWED_ORIGINS[0];}
async function verifyFirebaseToken(idToken){const apiKey=process.env.FIREBASE_API_KEY;if(!apiKey)throw new Error('FIREBASE_API_KEY não configurada no servidor.');const r=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken})});const d=await r.json().catch(()=>({}));const u=d?.users?.[0];if(!r.ok||!u?.localId)throw new Error('unauthorized');return {uid:u.localId,email:String(u.email||'').toLowerCase()};}
module.exports=async function handler(req,res){res.setHeader('Access-Control-Allow-Origin',origin(req));res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');if(req.method==='OPTIONS')return res.status(200).end();if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 const auth=req.headers.authorization||'';const token=auth.startsWith('Bearer ')?auth.slice(7):'';if(!token)return res.status(401).json({error:'É preciso estar logado no app para conversar com o Mentor IA.'});let user;try{user=await verifyFirebaseToken(token);}catch{return res.status(401).json({error:'Sessão inválida ou expirada. Recarregue a página e faça login novamente.'});}
 let body;try{body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});}catch{return res.status(400).json({error:'JSON inválido.'});}
 if(!Array.isArray(body.contents)||!body.contents.length)return res.status(400).json({error:'Requisição inválida: falta "contents".'});
 if(JSON.stringify(body.contents).length>32000)return res.status(413).json({error:'O contexto enviado ao Mentor ficou grande demais. Tente uma pergunta mais específica.',code:'AI_CONTEXT_TOO_LARGE'});
 const requestId=AI.requestId('chat');
 try{const usage=await quota.reserveUserOperation({uid:user.uid,email:user.email,operation:'mentor',requestId});if(usage.blocked)return res.status(429).json({error:`Você atingiu o limite de ${quota.MENTOR_DAILY_LIMIT} mensagens do Mentor IA por hoje.`,code:'LOCAL_MENTOR_LIMIT'});}catch(err){console.error('[api/mentor-chat] quota:',err);return res.status(503).json({error:'O controle de uso da IA está temporariamente indisponível.',code:'QUOTA_STORE_UNAVAILABLE'});}
 const failOperation=async(status,payload)=>{try{await quota.releaseUserOperation({uid:user.uid,operation:'mentor'});}catch(e){console.warn('[api/mentor-chat] falha ao devolver quota:',e.message);}return res.status(status).json(payload);};
 try{
   const result=await AI.callAI({messages:AI.geminiContentsToGroq(body.contents),systemInstruction:body.systemInstruction||'',operation:'mentor',uid:user.uid,email:user.email,requestId,maxTokens:1100,reasoningEffort:'medium'});
   if(result.ok)return res.status(200).json({candidates:[{content:{role:'model',parts:[{text:result.text}]}}],meta:{provider:result.provider,model:result.modelUsed,attempts:result.attempts||1,requestId}});
   return failOperation(result.status||503,{error:result.error,code:result.code,provider:result.provider||'none',requestId});
 }catch(err){console.error('[api/mentor-chat] internal:',err);return res.status(500).json({error:'Erro interno no Mentor IA.',code:'AI_INTERNAL_ERROR',requestId});}
};
