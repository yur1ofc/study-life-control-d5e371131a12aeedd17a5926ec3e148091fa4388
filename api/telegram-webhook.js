// SLCampus — webhook Telegram. Além dos comandos clássicos, entende frases
// naturais em português sem precisar chamar uma IA paga.
const admin=require('firebase-admin');
let app;
function init(){if(app)return app;const raw=process.env.FIREBASE_SERVICE_ACCOUNT_KEY;if(!raw)throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY não configurada.');const service=JSON.parse(Buffer.from(raw,'base64').toString('utf8'));app=admin.apps.length?admin.app():admin.initializeApp({credential:admin.credential.cert(service)});return app;}
const DAY={dom:0,domingo:0,seg:1,segunda:1,"segunda-feira":1,ter:2,terça:2,terca:2,"terça-feira":2,"terca-feira":2,qua:3,quarta:3,"quarta-feira":3,qui:4,quinta:4,"quinta-feira":4,sex:5,sexta:5,"sexta-feira":5,sab:6,sábado:6,sabado:6,"sábado-feira":6};
function token(){const t=process.env.TELEGRAM_BOT_TOKEN;if(!t)throw new Error('TELEGRAM_BOT_TOKEN não configurado.');return t;}
async function tg(method,body){const r=await fetch(`https://api.telegram.org/bot${token()}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.description||`Telegram ${method} falhou`);return j.result;}
async function reply(chatId,text){return tg('sendMessage',{chat_id:chatId,text});}
function parts(text){return text.split('|').map(x=>x.trim()).filter(Boolean);}
function id(prefix='tg'){return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;}
function addInbox(data,item){const list=Array.isArray(data.telegramInbox)?data.telegramInbox:[];const safe={...item,text:String(item.text||'').slice(0,4000),caption:String(item.caption||'').slice(0,4000),fileName:String(item.fileName||'').slice(0,180),materia:String(item.materia||'').slice(0,180)};return [safe,...list].slice(0,100);}
function normalize(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();}
function todayBR(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function dateObjBR(){const [y,m,d]=todayBR().split('-').map(Number);return new Date(Date.UTC(y,m-1,d));}
function isoDate(d){return d.toISOString().slice(0,10);}
function nextWeekday(name){const target=DAY[normalize(name)];if(target==null)return null;const d=dateObjBR();const diff=(target-d.getUTCDay()+7)%7;d.setUTCDate(d.getUTCDate()+(diff===0?7:diff));return isoDate(d);}
function parseDate(text){const n=normalize(text);if(/\bdepois de amanha\b/.test(n)){const d=dateObjBR();d.setUTCDate(d.getUTCDate()+2);return isoDate(d);}if(/\bamanha\b/.test(n)){const d=dateObjBR();d.setUTCDate(d.getUTCDate()+1);return isoDate(d);}if(/\bhoje\b/.test(n))return todayBR();const m=n.match(/\b(?:dia\s*)?(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);if(m){let y=m[3]?Number(m[3]):dateObjBR().getUTCFullYear();if(y<100)y+=2000;const d=new Date(Date.UTC(y,Number(m[2])-1,Number(m[1])));if(!isNaN(d))return isoDate(d);}for(const k of Object.keys(DAY).sort((a,b)=>b.length-a.length)){if(new RegExp(`\\b${k.replace(/-/g,'[- ]?')}\\b`,'i').test(n))return nextWeekday(k);}return null;}
function parseTimeRange(text){const n=normalize(text).replace(/h\b/g,':00');let m=n.match(/\b(\d{1,2})(?::(\d{2}))?\s*(?:as|a|ate|até|-)\s*(\d{1,2})(?::(\d{2}))?\b/);if(!m)m=n.match(/\b(\d{1,2})(?::(\d{2}))?\s*(?:h)?\s*(?:as|a|ate|até|-)\s*(\d{1,2})(?::(\d{2}))?\s*h?\b/);if(!m)return null;const fmt=(h,min)=>`${String(Math.min(23,Number(h))).padStart(2,'0')}:${String(min||0).padStart(2,'0')}`;return {inicio:fmt(m[1],m[2]),fim:fmt(m[3],m[4])};}
function findSubject(text,subjects){const n=normalize(text);const arr=(subjects||[]).map(s=>typeof s==='string'?{nome:s}:s).filter(s=>s?.nome).sort((a,b)=>normalize(b.nome).length-normalize(a.nome).length);return arr.find(s=>n.includes(normalize(s.nome)))||null;}
function stripSubject(text,subject){if(!subject)return text;return text.replace(new RegExp(subject.nome.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'ig'),'').replace(/\s{2,}/g,' ').trim();}
function parseNatural(text,data){
  const n=normalize(text); const subjects=data.subjects||[]; const subject=findSubject(text,subjects); const date=parseDate(text); const times=parseTimeRange(text);
  // Aula: "tenho aula de Cálculo amanhã das 8 às 10 na sala 12"
  if(/\b(aula|classe|class)\b/.test(n) && (date||times)){
    let dayName=null; for(const k of Object.keys(DAY).sort((a,b)=>b.length-a.length)){if(new RegExp(`\\b${k.replace(/-/g,'[- ]?')}\\b`).test(n)){dayName=k;break;}}
    const materia=subject?.nome || (text.match(/\baula\s+(?:de|da|do)\s+(.+?)(?=\s+(?:amanha|hoje|segunda|terca|terça|quarta|quinta|sexta|sabado|sábado|das?\b|às?\b|as?\b|na\s+sala|\d{1,2}:?\d{0,2})|$)/i)?.[1]?.trim());
    if(!materia)return {kind:'help',message:'Entendi que é uma aula, mas não consegui identificar a matéria. Ex.: “Tenho aula de Cálculo amanhã das 8 às 10 na sala 12”.'};
    const day=dayName?DAY[normalize(dayName)]:undefined;
    if(day==null)return {kind:'help',message:'Consigo registrar a aula, mas preciso do dia da semana. Ex.: “Tenho aula de Cálculo segunda das 8 às 10”.'};
    const sala=(text.match(/\b(?:sala|sl)\s*([\w-]+)/i)?.[1]||'').trim();
    return {kind:'class',item:{id:id('aula'),materia,dia:day,inicio:times?.inicio||'',fim:times?.fim||'',sala,origem:'telegram-natural'}};
  }
  // Nota: "tirei 7,5 em Cálculo na P1 valendo 20%"
  const gradeM=n.match(/\b(?:tirei|tirei uma nota de|nota(?: de)?|fiquei com)\s*(\d+(?:[\.,]\d+)?)\s*(?:em|na|no)\s+(.+?)(?=\s+(?:na|no)\s+(?:p\d|prova|avalia)|\s+valendo\s+\d+%|$)/i);
  if(gradeM){const value=Number(gradeM[1].replace(',','.'));const name=(subject?.nome||gradeM[2].trim());const prova=n.match(/\b(?:na|no)\s+(p\d|prova\s*\d+|av\s*\d+)\b/i)?.[1]||'Nota Telegram';const weight=Number(n.match(/\bvalendo\s+(\d+(?:[\.,]\d+)?)\s*%/i)?.[1]?.replace(',','.')||20);return {kind:'grade',item:{id:id('grade'),materia:name,nome:prova.toUpperCase(),valor:Math.max(0,Math.min(10,value)),peso:Math.max(.1,Math.min(100,weight)),data:todayBR(),origem:'telegram-natural'}};}
  // Tarefa/lembrete: "me lembra de fazer a lista de Física sexta" / "tenho que entregar ... amanhã"
  if(/\b(me lembra|me lembre|lembrar|tenho que|preciso (?:fazer|entregar|estudar))\b/.test(n)){
    let title=text.replace(/^\s*(me\s+(?:lembra|lembre)\s+(?:de\s+)?|lembrar\s+(?:de\s+)?|tenho\s+que\s+|preciso\s+(?:fazer|entregar|estudar)\s+)/i,'').trim();
    title=title.replace(/\s+(?:hoje|amanha|depois de amanha|segunda(?:-feira)?|terca(?:-feira)?|terça(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|sabado|sábado)\.?$/i,'').replace(/\s+dia\s+\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?$/i,'').trim();
    const materia=subject?.nome||''; if(!title)return {kind:'help',message:'Posso criar a tarefa. Ex.: “Me lembra de fazer a lista de Física sexta”.'};
    return {kind:'task',item:{id:id('task'),materia,titulo:title,dataLimite:date||todayBR(),concluida:false,criadaEm:new Date().toISOString(),origem:'telegram-natural'}};
  }
  // Prova: "tenho prova de Geometria na próxima terça" / "prova de Cálculo sexta"
  if(/\b(prova|avalia(?:cao|ção)|trabalho)\b/.test(n) && date){
    const materia=subject?.nome||text.match(/\b(?:prova|avalia(?:ção|cao)|trabalho)\s+(?:de|da|do)\s+(.+?)(?=\s+(?:amanha|hoje|segunda|terca|terça|quarta|quinta|sexta|sabado|sábado|dia\s+\d|$))/i)?.[1]?.trim()||'';
    const titulo=(n.match(/\b(p\d|p1|p2|prova\s*\d+|trabalho|avalia(?:cao|ção)\s*\d*)\b/i)?.[1]||'Avaliação').replace(/\s+/g,' ').trim();
    return {kind:'exam',item:{id:id('exam'),materia,titulo,data:date,concluida:false,criadaEm:new Date().toISOString(),origem:'telegram-natural'}};
  }
  // Sessão: "estudei Cálculo por 1h30" / "estudei física por 45 minutos"
  const studyM=n.match(/\bestudei\s+(.+?)\s+(?:por|durante)\s+(\d+(?:[\.,]\d+)?)\s*(h|hora|horas|min|m|minuto|minutos)(?:\s*(?:e|,)?\s*(\d+)\s*(?:min|minuto|minutos))?/i);
  if(studyM){const materia=subject?.nome||studyM[1].trim();let min=Number(studyM[2].replace(',','.'))*(/^h|hora/.test(studyM[3])?60:1);if(studyM[4])min+=Number(studyM[4]);return {kind:'session',item:{id:id('session'),materia,duracaoReal:Math.round(min),duracao:`${Math.round(min)} min`,data:new Date().toISOString(),concluida:true,status:'concluida',origem:'telegram-natural'}};}
  if(/^\s*(anota|anote|salva|salve|registr[ae])\b/i.test(text)){return {kind:'note',text:text.replace(/^\s*(anota|anote|salva|salve|registre|registra)\s*:?[\s-]*/i,'').trim()||text};}
  return null;
}
function help(){return `SLCampus conectado.\n\nVocê pode falar normalmente comigo. Exemplos:\n• Tenho aula de Cálculo amanhã das 8 às 10 na sala 12\n• Me lembra de fazer a lista de Física sexta\n• Tenho prova de Geometria na próxima terça\n• Tirei 7,5 em Cálculo na P1 valendo 20%\n• Estudei Cálculo por 1h30\n• Anota: revisar regra da cadeia\n\nComandos: /aula, /tarefa, /prova, /nota, /anotar, /status, /ajuda, /desvincular\n\nFotos e PDFs enviados ao bot entram na caixa de entrada do SLCampus.`;}
async function saveArray(ref,data,key,item){await ref.set({[key]:[...(data[key]||[]),item]},{merge:true});}
module.exports=async function(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Método não permitido.'});
  const expected=process.env.TELEGRAM_WEBHOOK_SECRET;if(expected&&req.headers['x-telegram-bot-api-secret-token']!==expected)return res.status(401).json({error:'Webhook não autorizado.'});
  try{
    const update=req.body||{},msg=update.message;if(!msg)return res.status(200).json({ok:true,ignored:true});
    const chatId=String(msg.chat?.id||'');if(!chatId)return res.status(200).json({ok:true,ignored:true});
    const db=init().firestore(),text=String(msg.text||msg.caption||'').trim();
    if(text.startsWith('/start')){const c=text.split(/\s+/)[1]?.trim().toUpperCase();if(c){const linkRef=db.collection('telegramLinks').doc(c),snap=await linkRef.get(),link=snap.exists?snap.data():null;if(link&&new Date(link.expiresAt).getTime()>Date.now()){await db.collection('users').doc(link.uid).set({telegram:{chatId,username:msg.from?.username||'',firstName:msg.from?.first_name||'',linkedAt:new Date().toISOString()}},{merge:true});await linkRef.delete();await reply(chatId,'Telegram vinculado ao SLCampus.\n\n'+help());return res.status(200).json({ok:true});}}await reply(chatId,'Código inválido ou expirado. Gere outro código em SLCampus → Configurações → Telegram.');return res.status(200).json({ok:true});}
    const q=await db.collection('users').where('telegram.chatId','==',chatId).limit(1).get();if(q.empty){await reply(chatId,'Este Telegram ainda não está vinculado. Gere um código no SLCampus → Configurações → Telegram e envie /start CODIGO.');return res.status(200).json({ok:true});}
    const ref=q.docs[0].ref,data=q.docs[0].data()||{},lower=normalize(text);
    if(lower==='/ajuda'||lower==='/help'){await reply(chatId,help());return res.status(200).json({ok:true});}
    if(lower==='/desvincular'){await ref.set({telegram:null},{merge:true});await reply(chatId,'Telegram desvinculado.');return res.status(200).json({ok:true});}
    if(lower==='/status'){const subjects=(data.subjects||[]).length,pending=(data.tasks||[]).filter(x=>!x.concluida).length,exams=(data.exams||[]).filter(x=>!x.concluida).length,sessions=(data.sessions||[]).length;await reply(chatId,`SLCampus\nMatérias: ${subjects}\nTarefas pendentes: ${pending}\nProvas/trabalhos: ${exams}\nSessões registradas: ${sessions}`);return res.status(200).json({ok:true});}
    let inboxItem={id:id('tg'),receivedAt:new Date().toISOString(),chatId,type:'message',caption:msg.caption||'',text:msg.text||''};
    if(msg.document){inboxItem.type='document';inboxItem.fileId=msg.document.file_id;inboxItem.fileName=msg.document.file_name||'arquivo';inboxItem.mimeType=msg.document.mime_type||'';}
    else if(msg.photo?.length){const ph=msg.photo[msg.photo.length-1];inboxItem.type='photo';inboxItem.fileId=ph.file_id;inboxItem.fileName='foto.jpg';inboxItem.mimeType='image/jpeg';}
    if(msg.document||msg.photo){await ref.set({telegramInbox:addInbox(data,inboxItem)},{merge:true});await reply(chatId,'Recebido. O arquivo foi registrado na caixa de entrada do SLCampus.');return res.status(200).json({ok:true});}
    if(lower.startsWith('/aula')){const p=parts(text.replace(/^\/aula\s*/i,''));if(p.length<4){await reply(chatId,'Formato: /aula | Matéria | seg | 08:00 | 10:00 | Sala');return res.status(200).json({ok:true});}const day=DAY[normalize(p[1])];if(day==null){await reply(chatId,'Dia inválido. Use seg, ter, qua, qui, sex ou sáb.');return res.status(200).json({ok:true});}const aula={id:id('aula'),materia:p[0],dia:day,inicio:p[2],fim:p[3],sala:p[4]||'',origem:'telegram'};await saveArray(ref,data,'classSchedule',aula);await reply(chatId,`Aula adicionada: ${aula.materia}, ${p[1]} ${aula.inicio}–${aula.fim}.`);return res.status(200).json({ok:true});}
    if(lower.startsWith('/tarefa')){const p=parts(text.replace(/^\/tarefa\s*/i,''));if(p.length<3){await reply(chatId,'Formato: /tarefa | Matéria | Título | 2026-09-30');return res.status(200).json({ok:true});}const item={id:id('task'),materia:p[0],titulo:p[1],dataLimite:p[2],concluida:false,criadaEm:new Date().toISOString(),origem:'telegram'};await saveArray(ref,data,'tasks',item);await reply(chatId,`Tarefa adicionada: ${item.titulo}.`);return res.status(200).json({ok:true});}
    if(lower.startsWith('/prova')){const p=parts(text.replace(/^\/prova\s*/i,''));if(p.length<3){await reply(chatId,'Formato: /prova | Matéria | Título | 2026-10-02');return res.status(200).json({ok:true});}const item={id:id('exam'),materia:p[0],titulo:p[1],data:p[2],concluida:false,criadaEm:new Date().toISOString(),origem:'telegram'};await saveArray(ref,data,'exams',item);await reply(chatId,`Prova/trabalho adicionado: ${item.titulo}.`);return res.status(200).json({ok:true});}
    if(lower.startsWith('/nota')){const p=parts(text.replace(/^\/nota\s*/i,''));const value=Number(String(p[1]||'').replace(',','.'));if(p.length<2||!Number.isFinite(value)||value<0||value>10){await reply(chatId,'Formato: /nota | Matéria | 7.5 | P1 | 20');return res.status(200).json({ok:true});}const grade={id:id('grade'),materia:p[0],nome:p[2]||'Nota Telegram',valor:value,peso:Math.min(100,Math.max(.1,Number(p[3]||20))),data:todayBR(),origem:'telegram'};await saveArray(ref,data,'grades',grade);await reply(chatId,`Nota registrada: ${value.toFixed(1)} em ${grade.materia}.`);return res.status(200).json({ok:true});}
    if(lower.startsWith('/anotar')){const p=parts(text.replace(/^\/anotar\s*/i,''));if(p.length<2){await reply(chatId,'Formato: /anotar | Matéria | sua anotação');return res.status(200).json({ok:true});}inboxItem.type='note';inboxItem.materia=p[0];inboxItem.text=p.slice(1).join(' | ');await ref.set({telegramInbox:addInbox(data,inboxItem)},{merge:true});await reply(chatId,'Anotação salva na caixa de entrada do SLCampus.');return res.status(200).json({ok:true});}
    const natural=parseNatural(text,data);
    if(natural?.kind==='help'){await reply(chatId,natural.message);return res.status(200).json({ok:true});}
    if(natural?.kind==='class'){await saveArray(ref,data,'classSchedule',natural.item);await reply(chatId,`Aula registrada: ${natural.item.materia}, ${Object.keys(DAY).find(k=>DAY[k]===natural.item.dia)||'dia'} ${natural.item.inicio||''}${natural.item.fim?'–'+natural.item.fim:''}${natural.item.sala?' · Sala '+natural.item.sala:''}.`);return res.status(200).json({ok:true});}
    if(natural?.kind==='task'){await saveArray(ref,data,'tasks',natural.item);await reply(chatId,`Tarefa criada: ${natural.item.titulo}${natural.item.materia?' · '+natural.item.materia:''} · prazo ${natural.item.dataLimite}.`);return res.status(200).json({ok:true});}
    if(natural?.kind==='exam'){await saveArray(ref,data,'exams',natural.item);await reply(chatId,`Avaliação registrada: ${natural.item.materia||'Matéria não identificada'} · ${natural.item.titulo} · ${natural.item.data}.`);return res.status(200).json({ok:true});}
    if(natural?.kind==='grade'){await saveArray(ref,data,'grades',natural.item);await reply(chatId,`Nota registrada: ${natural.item.valor.toFixed(1)} em ${natural.item.materia} · ${natural.item.nome} · peso ${natural.item.peso}%.`);return res.status(200).json({ok:true});}
    if(natural?.kind==='session'){await saveArray(ref,data,'sessions',natural.item);await reply(chatId,`Sessão registrada: ${natural.item.materia} · ${natural.item.duracaoReal} min. Ela já entra no histórico de estudos.`);return res.status(200).json({ok:true});}
    if(natural?.kind==='note'){inboxItem.type='note';inboxItem.text=natural.text;await ref.set({telegramInbox:addInbox(data,inboxItem)},{merge:true});await reply(chatId,'Anotação salva na caixa de entrada do SLCampus.');return res.status(200).json({ok:true});}
    await ref.set({telegramInbox:addInbox(data,inboxItem)},{merge:true});await reply(chatId,'Recebi. Deixei a mensagem na Caixa de entrada do SLCampus. Se quiser que eu registre automaticamente, escreva a ação de forma natural, por exemplo: “me lembra de fazer a lista de Física sexta”.');return res.status(200).json({ok:true});
  }catch(e){console.error('[telegram-webhook]',e);try{if(req.body?.message?.chat?.id)await reply(req.body.message.chat.id,'O SLCampus encontrou um erro ao processar isso. Tente novamente.');}catch(_){}return res.status(200).json({ok:false,error:e.message});}
};
