// SLCampus — webhook do Telegram. Bot API é gratuita; o endpoint roda como
// Vercel Function. Para ativar, configure TELEGRAM_BOT_TOKEN e
// TELEGRAM_WEBHOOK_SECRET e registre o webhook no BotFather/API do Telegram.
const admin=require('firebase-admin');
let app;
function init(){if(app)return app;const raw=process.env.FIREBASE_SERVICE_ACCOUNT_KEY;if(!raw)throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY não configurada.');const service=JSON.parse(Buffer.from(raw,'base64').toString('utf8'));app=admin.apps.length?admin.app():admin.initializeApp({credential:admin.credential.cert(service)});return app;}
const DAY={dom:0,domingo:0,seg:1,segunda:1,ter:2,terça:2,terca:2,qua:3,quarta:3,qui:4,quinta:4,sex:5,sexta:5,sab:6,sábado:6,sabado:6};
function token(){const t=process.env.TELEGRAM_BOT_TOKEN;if(!t)throw new Error('TELEGRAM_BOT_TOKEN não configurado.');return t;}
async function tg(method,body){const r=await fetch(`https://api.telegram.org/bot${token()}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.description||`Telegram ${method} falhou`);return j.result;}
async function reply(chatId,text){return tg('sendMessage',{chat_id:chatId,text});}
function parts(text){return text.split('|').map(x=>x.trim()).filter(Boolean);}
function id(prefix='tg'){return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;}
function addInbox(data,item){const list=Array.isArray(data.telegramInbox)?data.telegramInbox:[];const safe={...item,text:String(item.text||'').slice(0,4000),caption:String(item.caption||'').slice(0,4000),fileName:String(item.fileName||'').slice(0,180),materia:String(item.materia||'').slice(0,180)};return [safe,...list].slice(0,100);}
function help(){return `SLCampus conectado.\n\nComandos:\n/aula | Matéria | seg | 08:00 | 10:00 | Sala\n/tarefa | Matéria | Título | 2026-09-30\n/prova | Matéria | Título | 2026-10-02\n/nota | Matéria | 7.5 | P1 | 20\n/anotar | Matéria | sua anotação\n/status\n\nVocê também pode mandar foto ou PDF. O SLCampus registra o arquivo na caixa de entrada para usar no app.`;}
module.exports=async function(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Método não permitido.'});
  const expected=process.env.TELEGRAM_WEBHOOK_SECRET;
  if(expected && req.headers['x-telegram-bot-api-secret-token']!==expected)return res.status(401).json({error:'Webhook não autorizado.'});
  try{
    const update=req.body||{};const msg=update.message;if(!msg)return res.status(200).json({ok:true,ignored:true});
    const chatId=String(msg.chat?.id||'');if(!chatId)return res.status(200).json({ok:true,ignored:true});
    const db=init().firestore();
    const text=String(msg.text||msg.caption||'').trim();
    // Vinculação /start CODIGO
    if(text.startsWith('/start')){
      const c=text.split(/\s+/)[1]?.trim().toUpperCase();
      if(c){const linkRef=db.collection('telegramLinks').doc(c);const snap=await linkRef.get();const link=snap.exists?snap.data():null;if(link&&new Date(link.expiresAt).getTime()>Date.now()){
        await db.collection('users').doc(link.uid).set({telegram:{chatId,username:msg.from?.username||'',firstName:msg.from?.first_name||'',linkedAt:new Date().toISOString()}},{merge:true});await linkRef.delete();await reply(chatId,'Telegram vinculado ao SLCampus.\n\n'+help());return res.status(200).json({ok:true});
      }}
      await reply(chatId,'Código inválido ou expirado. Gere outro código em SLCampus → Configurações → Telegram.');return res.status(200).json({ok:true});
    }
    const q=await db.collection('users').where('telegram.chatId','==',chatId).limit(1).get();
    if(q.empty){await reply(chatId,'Este Telegram ainda não está vinculado. Gere um código no SLCampus e envie /start CODIGO.');return res.status(200).json({ok:true});}
    const ref=q.docs[0].ref;const data=q.docs[0].data()||{};const lower=text.toLowerCase();
    if(lower==='/ajuda'||lower==='/help'){await reply(chatId,help());return res.status(200).json({ok:true});}
    if(lower==='/desvincular'){await ref.set({telegram:null},{merge:true});await reply(chatId,'Telegram desvinculado.');return res.status(200).json({ok:true});}
    if(lower==='/status'){const subjects=(data.subjects||[]).length;const pending=(data.tasks||[]).filter(x=>!x.concluida).length;const exams=(data.exams||[]).filter(x=>!x.concluida).length;await reply(chatId,`SLCampus\nMatérias: ${subjects}\nTarefas pendentes: ${pending}\nProvas/trabalhos: ${exams}`);return res.status(200).json({ok:true});}
    let inboxItem={id:id('tg'),receivedAt:new Date().toISOString(),chatId,type:'message',caption:msg.caption||'',text:msg.text||''};
    if(msg.document){inboxItem.type='document';inboxItem.fileId=msg.document.file_id;inboxItem.fileName=msg.document.file_name||'arquivo';inboxItem.mimeType=msg.document.mime_type||'';}
    else if(msg.photo?.length){const ph=msg.photo[msg.photo.length-1];inboxItem.type='photo';inboxItem.fileId=ph.file_id;inboxItem.fileName='foto.jpg';inboxItem.mimeType='image/jpeg';}
    if(msg.document||msg.photo){await ref.set({telegramInbox:addInbox(data,inboxItem)},{merge:true});await reply(chatId,'Recebido. O arquivo foi registrado na caixa de entrada do SLCampus.');return res.status(200).json({ok:true});}
    if(lower.startsWith('/aula')){const p=parts(text.replace(/^\/aula\s*/i,''));if(p.length<4){await reply(chatId,'Formato: /aula | Matéria | seg | 08:00 | 10:00 | Sala');return res.status(200).json({ok:true});}const day=DAY[p[1].toLowerCase()];if(day==null){await reply(chatId,'Dia inválido. Use seg, ter, qua, qui, sex ou sáb.');return res.status(200).json({ok:true});}const aula={id:id('aula'),materia:p[0],dia:day,inicio:p[2],fim:p[3],sala:p[4]||'',origem:'telegram'};await ref.set({classSchedule:[...(data.classSchedule||[]),aula]},{merge:true});await reply(chatId,`Aula adicionada: ${aula.materia}, ${p[1]} ${aula.inicio}–${aula.fim}.`);return res.status(200).json({ok:true});}
    if(lower.startsWith('/tarefa')){const p=parts(text.replace(/^\/tarefa\s*/i,''));if(p.length<3){await reply(chatId,'Formato: /tarefa | Matéria | Título | 2026-09-30');return res.status(200).json({ok:true});}const item={id:id('task'),materia:p[0],titulo:p[1],dataLimite:p[2],concluida:false,criadaEm:new Date().toISOString(),origem:'telegram'};await ref.set({tasks:[...(data.tasks||[]),item]},{merge:true});await reply(chatId,`Tarefa adicionada: ${item.titulo}.`);return res.status(200).json({ok:true});}
    if(lower.startsWith('/prova')){const p=parts(text.replace(/^\/prova\s*/i,''));if(p.length<3){await reply(chatId,'Formato: /prova | Matéria | Título | 2026-10-02');return res.status(200).json({ok:true});}const item={id:id('exam'),materia:p[0],titulo:p[1],data:p[2],concluida:false,criadaEm:new Date().toISOString(),origem:'telegram'};await ref.set({exams:[...(data.exams||[]),item]},{merge:true});await reply(chatId,`Prova/trabalho adicionado: ${item.titulo}.`);return res.status(200).json({ok:true});}
    if(lower.startsWith('/nota')){const p=parts(text.replace(/^\/nota\s*/i,''));const value=Number(String(p[1]||'').replace(',','.'));if(p.length<2||!Number.isFinite(value)||value<0||value>10){await reply(chatId,'Formato: /nota | Matéria | 7.5 | P1 | 20');return res.status(200).json({ok:true});}const grade={id:id('grade'),materia:p[0],nome:p[2]||'Nota Telegram',valor:value,peso:Math.min(100,Math.max(0.1,Number(p[3]||20))),data:new Date().toISOString().slice(0,10),origem:'telegram'};await ref.set({grades:[...(data.grades||[]),grade]},{merge:true});await reply(chatId,`Nota registrada: ${value.toFixed(1)} em ${grade.materia}.`);return res.status(200).json({ok:true});}
    if(lower.startsWith('/anotar')){const p=parts(text.replace(/^\/anotar\s*/i,''));if(p.length<2){await reply(chatId,'Formato: /anotar | Matéria | sua anotação');return res.status(200).json({ok:true});}inboxItem.type='note';inboxItem.materia=p[0];inboxItem.text=p.slice(1).join(' | ');await ref.set({telegramInbox:addInbox(data,inboxItem)},{merge:true});await reply(chatId,'Anotação salva na caixa de entrada do SLCampus.');return res.status(200).json({ok:true});}
    await ref.set({telegramInbox:addInbox(data,inboxItem)},{merge:true});await reply(chatId,'Recebi sua mensagem e deixei na caixa de entrada do SLCampus. Use /ajuda para ver os comandos.');
    return res.status(200).json({ok:true});
  }catch(e){console.error('[telegram-webhook]',e);try{if(req.body?.message?.chat?.id)await reply(req.body.message.chat.id,'O SLCampus encontrou um erro ao processar isso. Tente novamente.');}catch(_){}return res.status(200).json({ok:false,error:e.message});}
};
