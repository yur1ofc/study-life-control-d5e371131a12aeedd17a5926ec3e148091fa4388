// SLCampus — endpoint legado /api/gemini mantido por compatibilidade.
// A implementação não chama mais o Google Gemini: usa o AI Core/Groq.
const quota=require('./_lib/gemini-admin-quota');
const AI=require('./_lib/ai-core');
const ALLOWED_ORIGINS=['https://slcampus.vercel.app','https://study-life-control.vercel.app'];
function origin(req){const o=req.headers.origin||'';if(ALLOWED_ORIGINS.includes(o))return o;if(/^https:\/\/(?:slcampus|study-life-control)(-[a-z0-9-]+)?\.vercel\.app$/.test(o))return o;if(/^http:\/\/(?:localhost|127\.0\.0\.1)(:\d+)?$/.test(o))return o;return ALLOWED_ORIGINS[0];}
async function verifyFirebaseToken(idToken){const apiKey=process.env.FIREBASE_API_KEY;if(!apiKey)throw new Error('FIREBASE_API_KEY não configurada no servidor.');const r=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken})});const d=await r.json().catch(()=>({}));const u=d?.users?.[0];if(!r.ok||!u?.localId)throw new Error('unauthorized');return {uid:u.localId,email:String(u.email||'').toLowerCase()};}
module.exports=async function handler(req,res){res.setHeader('Access-Control-Allow-Origin',origin(req));res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');if(req.method==='OPTIONS')return res.status(200).end();if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 const auth=req.headers.authorization||'';const token=auth.startsWith('Bearer ')?auth.slice(7):'';if(!token)return res.status(401).json({error:'É preciso estar logado para usar a IA.'});let user;try{user=await verifyFirebaseToken(token);}catch{return res.status(401).json({error:'Sessão inválida ou expirada. Recarregue a página e faça login novamente.'});}
 let body;try{body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});}catch{return res.status(400).json({error:'JSON inválido.'});}if(!Array.isArray(body.contents)||!body.contents.length)return res.status(400).json({error:'Requisição inválida: falta "contents".'});
 const rid=AI.requestId('imp');
 try{const usage=await quota.reserveUserOperation({uid:user.uid,email:user.email,operation:'import',requestId:rid});if(usage.blocked)return res.status(429).json({error:`Limite de ${quota.USER_IMPORT_LIMIT} importações por dia atingido. Tente novamente amanhã.`,code:'LOCAL_USER_LIMIT'});}catch(err){console.error('[api/gemini] quota:',err);return res.status(503).json({error:'O controle de uso da IA está temporariamente indisponível.',code:'QUOTA_STORE_UNAVAILABLE'});}
 try{
   const built=await AI.buildMessagesFromGemini(body.contents);
   if(!built.messages.length)return res.status(400).json({error:'Nenhum conteúdo utilizável foi encontrado no arquivo.'});
   if(JSON.stringify(built.messages).length>90000)return res.status(413).json({error:'O documento ficou grande demais após a extração. Divida o arquivo em partes menores.',code:'AI_DOCUMENT_TOO_LARGE'});
   const model=built.hasImage?AI.VISION_MODEL:AI.TEXT_MODEL;
   const prompt=built.hasImage?'Extraia e organize os dados visíveis nas imagens para a finalidade solicitada pelo usuário. Retorne JSON válido e não invente dados.':'Extraia e organize fielmente os dados do conteúdo fornecido para a finalidade solicitada pelo usuário. Retorne JSON válido e não invente dados.';
   const result=await AI.callGroq({messages:built.messages,systemInstruction:prompt,operation:'import',uid:user.uid,email:user.email,requestId:rid,maxTokens:5000,reasoningEffort:'low',model});
   if(result.ok)return res.status(200).json({candidates:[{content:{role:'model',parts:[{text:result.text}]}}],meta:{provider:'groq',model:result.modelUsed,attempts:result.attempts,requestId:rid,pdfCount:built.pdfCount}});
   return res.status(result.status||503).json({error:result.error,code:result.code,provider:'groq',requestId:rid});
 }catch(err){console.error('[api/gemini] internal:',err);return res.status(500).json({error:err.message||'Erro interno na IA.',code:'AI_INTERNAL_ERROR',requestId:rid});}
};
