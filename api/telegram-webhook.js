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
function dayFromDate(date){if(!date)return null;return new Date(`${date}T00:00:00Z`).getUTCDay();}
function timeMin(t){const m=String(t||'').match(/^(\d{1,2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):null;}
function overlaps(a,b,c,d){const x=timeMin(a),y=timeMin(b),u=timeMin(c),v=timeMin(d);if([x,y,u,v].some(n=>n==null))return false;return x<v&&u<y;}
function formatClass(a){return `${a.materia}${a.inicio?` · ${a.inicio}${a.fim?`–${a.fim}`:''}`:''}${a.sala?` · Sala ${a.sala}`:''}`;}
function sameSubject(a,b){return normalize(a)===normalize(b);}
function duplicateBy(data,key,predicate){return (data[key]||[]).find(predicate)||null;}
function findExistingClass(data,item){return (data.classSchedule||[]).find(a=>Number(a.dia)===Number(item.dia)&&sameSubject(a.materia,item.materia)&&String(a.inicio||'')===String(item.inicio||'')&&String(a.fim||'')===String(item.fim||''));}
function findClassConflict(data,item){return (data.classSchedule||[]).find(a=>Number(a.dia)===Number(item.dia)&&overlaps(a.inicio,a.fim,item.inicio,item.fim)&&!findExistingClass({classSchedule:[a]},item));}
function alreadyProcessed(data,updateId){const ids=Array.isArray(data.telegramProcessedUpdates)?data.telegramProcessedUpdates:[];return updateId!=null&&ids.includes(updateId);}
async function markProcessed(ref,data,updateId){if(updateId==null)return;const ids=Array.isArray(data.telegramProcessedUpdates)?data.telegramProcessedUpdates:[];await ref.set({telegramProcessedUpdates:[...ids,updateId].slice(-200)},{merge:true});}
function agendaText(data,date){const day=dayFromDate(date);const names=['domingo','segunda','terça','quarta','quinta','sexta','sábado'];const items=(data.classSchedule||[]).filter(a=>Number(a.dia)===day).sort((a,b)=>String(a.inicio||'').localeCompare(String(b.inicio||'')));if(!items.length)return `Não encontrei aulas salvas para ${date===todayBR()?'hoje':'esse dia'}.`;return `Aulas de ${names[day]}:
`+items.map(a=>`• ${formatClass(a)}`).join('\n');}
function parseDate(text){const n=normalize(text);if(/\bdepois de amanha\b/.test(n)){const d=dateObjBR();d.setUTCDate(d.getUTCDate()+2);return isoDate(d);}if(/\bamanha\b/.test(n)){const d=dateObjBR();d.setUTCDate(d.getUTCDate()+1);return isoDate(d);}if(/\bhoje\b/.test(n))return todayBR();const m=n.match(/\b(?:dia\s*)?(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);if(m){let y=m[3]?Number(m[3]):dateObjBR().getUTCFullYear();if(y<100)y+=2000;const d=new Date(Date.UTC(y,Number(m[2])-1,Number(m[1])));if(!isNaN(d))return isoDate(d);}for(const k of Object.keys(DAY).sort((a,b)=>b.length-a.length)){if(new RegExp(`\\b${k.replace(/-/g,'[- ]?')}\\b`,'i').test(n))return nextWeekday(k);}return null;}
function parseTimeRange(text){const n=normalize(text).replace(/h\b/g,':00');let m=n.match(/\b(\d{1,2})(?::(\d{2}))?\s*(?:as|a|ate|até|-)\s*(\d{1,2})(?::(\d{2}))?\b/);if(!m)m=n.match(/\b(\d{1,2})(?::(\d{2}))?\s*(?:h)?\s*(?:as|a|ate|até|-)\s*(\d{1,2})(?::(\d{2}))?\s*h?\b/);if(!m)return null;const fmt=(h,min)=>`${String(Math.min(23,Number(h))).padStart(2,'0')}:${String(min||0).padStart(2,'0')}`;return {inicio:fmt(m[1],m[2]),fim:fmt(m[3],m[4])};}
function subjectTokens(s){return normalize(s).split(/[^a-z0-9]+/).filter(x=>x.length>=3&&!['de','da','do','das','dos','com','para'].includes(x));}
function findSubject(text,subjects){
  const n=normalize(text);
  const arr=(subjects||[]).map(s=>typeof s==='string'?{nome:s}:s).filter(s=>s?.nome);
  const exact=arr.filter(s=>n.includes(normalize(s.nome))).sort((a,b)=>normalize(b.nome).length-normalize(a.nome).length);
  if(exact.length)return exact[0];
  const nt=subjectTokens(n); if(!nt.length)return null;
  const scored=arr.map(s=>{
    const st=subjectTokens(s.nome);let hits=0;
    for(const u of nt){if(st.some(v=>v===u||v.startsWith(u)||u.startsWith(v)))hits++;}
    return {s,score:hits/Math.max(1,st.length),hits};
  }).filter(x=>x.hits>0).sort((a,b)=>b.score-a.score||b.hits-a.hits||normalize(a.s.nome).length-normalize(b.s.nome).length);
  if(!scored.length||scored[0].score<0.5)return null;
  if(scored.length>1&&scored[1].score===scored[0].score&&scored[1].hits===scored[0].hits)return null;
  return scored[0].s;
}
function stripSubject(text,subject){if(!subject)return text;return text.replace(new RegExp(subject.nome.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'ig'),'').replace(/\s{2,}/g,' ').trim();}
function listAgenda(data,date){return agendaText(data,date);}
function formatDateBR(date){if(!date)return '';const [y,m,d]=date.split('-');return `${d}/${m}/${y}`;}
function nowMinBR(){const p=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date());const h=Number(p.find(x=>x.type==='hour')?.value||0),m=Number(p.find(x=>x.type==='minute')?.value||0);return h*60+m;}
function nextClass(data){const d=dateObjBR();const current=nowMinBR();for(let offset=0;offset<=7;offset++){const date=isoDate(new Date(d.getTime()+offset*86400000));const day=dayFromDate(date);const items=(data.classSchedule||[]).filter(a=>Number(a.dia)===day).sort((a,b)=>(timeMin(a.inicio)||0)-(timeMin(b.inicio)||0));for(const item of items){if(offset>0||(timeMin(item.inicio)!=null&&timeMin(item.inicio)>=current))return {item,date};}}return null;}
function daysUntil(date){if(!date)return null;const a=dateObjBR(),b=new Date(`${date}T00:00:00Z`);return Math.round((b-a)/86400000);}
function naturalQuery(text,data){
  const n=normalize(text);
  const date=parseDate(text);
  if(/\b(proxima|próxima)\s+aula\b/.test(n))return {kind:'nextClass'};
  const classAction=/\b(adiciona|adicionar|cria|criar|marca|marcar|registra|registrar|coloca|colocar|vou\s+ter|tenho)\b.*\b(aulas?|classe|classes)\b/.test(n);
  const asksClasses=/^\s*(que|quais|qual)\b.*\b(aulas?|horario|horarios)\b/.test(n)
    || /\b(minhas|meu|meus)\s+(aulas?|horario|horarios)\b/.test(n)
    || /\b(o que|oq)\s+(eu\s+)?tenho\b.*\b(aulas?|horario|horarios)\b/.test(n)
    || /\b(como\s+(esta|esta o|está|está o)|mostra|mostrar|ver)\b.*\b(horario|horarios|grade)\b/.test(n)
    || /^\s*aulas?\b.*\b(hoje|amanha|depois de amanha|segunda|terca|quarta|quinta|sexta|sabado|domingo)\b/.test(n)
    || (/\btenho\s+(aulas?|aula)\b/.test(n)&&/[?]$/.test(String(text).trim()));
  if(asksClasses&&!classAction){return {kind:'agenda',date:date||todayBR()};}
  if(/\b(que|quais|qual|mostra|mostrar|ver|minhas|meus)\b.*\b(tarefas?|lembretes?|pendencias?|pendências?)\b/.test(n)
    || /\b(o que|oq)\s+(eu\s+)?tenho\s+(para\s+)?(fazer|entregar)\b/.test(n)) return {kind:'tasks',date};
  if(/\b(que|quais|qual|quando|mostra|mostrar|ver|minhas|meus|proxima|próxima)\b.*\b(provas?|avaliacoes?|avaliações?|trabalhos?)\b/.test(n)
    || /\bquando\s+(é|e)\s+(minha|a)\s+prova\b/.test(n)) return {kind:'exams',date};
  const gradeAction=/\b(minha|minhas)\s+nota\b.*\b(foi|é|e)\b.*\d/.test(n) || /\b(tirei|fiquei\s+com)\b.*\d/.test(n);
  if(!gradeAction && (/\b(minhas|meus|quais|qual|mostra|mostrar|ver)\b.*\b(notas?|medias?|médias?|boletim)\b/.test(n)
    || /\bnota\s+(de|em|do|da)\b/.test(n))) return {kind:'grades'};
  if(/\bquanto\s+(tempo|eu\s+estudei|estudei)\b/.test(n)
    || /\b(horas?|minutos?)\s+(eu\s+)?estudei\b/.test(n)
    || /\b(estudos?|sessoes?|sessões?)\b.*\b(hoje|ontem|semana|mes|mês)\b/.test(n)) return {kind:'studySummary',date};
  return null;
}
function parseNatural(text,data){
  const n=normalize(text); const subjects=data.subjects||[]; const subject=findSubject(text,subjects); const date=parseDate(text); const times=parseTimeRange(text);
  const query=naturalQuery(text,data); if(query)return query;

  // Aula: também entende plural/variações de ação: "coloca uma aula...", "vou ter aula..."
  if(/\b(aulas?|classe|classes)\b/.test(n) && (date||times)){
    let dayName=null; for(const k of Object.keys(DAY).sort((a,b)=>b.length-a.length)){if(new RegExp(`\\b${k.replace(/-/g,'[- ]?')}\\b`).test(n)){dayName=k;break;}}
    const materia=subject?.nome || (text.match(/\b(?:aula|aulas)\s+(?:de|da|do)\s+(.+?)(?=\s+(?:amanha|hoje|depois de amanha|segunda|terca|terça|quarta|quinta|sexta|sabado|sábado|das?\b|às?\b|as?\b|na\s+sala|\d{1,2}:?\d{0,2})|$)/i)?.[1]?.trim())
      || (text.match(/\b(?:coloca|adiciona|marca|marque|registra|registre|vou ter)\s+(?:uma\s+)?aula\s+(?:de|da|do)\s+(.+?)(?=\s+(?:amanha|hoje|segunda|terca|terça|quarta|quinta|sexta|sabado|sábado|das?\b|às?\b|as?\b|na\s+sala|\d{1,2}:?\d{0,2})|$)/i)?.[1]?.trim());
    if(!materia)return {kind:'help',message:'Entendi que é uma aula, mas não consegui identificar a matéria. Ex.: “Tenho aula de Cálculo amanhã das 8 às 10 na sala 12”.'};
    const day=dayName?DAY[normalize(dayName)]:dayFromDate(date);
    if(day==null)return {kind:'help',message:'Consigo registrar a aula, mas preciso do dia. Ex.: “Tenho aula de Cálculo amanhã das 8 às 10”.'};
    const existingDay=(data.classSchedule||[]).filter(a=>Number(a.dia)===Number(day)&&sameSubject(a.materia,materia));
    if(!times){if(existingDay.length)return {kind:'existingClass',items:existingDay};return {kind:'help',message:`Encontrei ${materia}, mas falta o horário. Ex.: “Tenho aula de ${materia} amanhã das 8 às 10”.`};}
    const sala=(text.match(/\b(?:sala|sl)\s+([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9 _-]{0,30}?)(?=\s+(?:e|com|para|porque)\b|$)/i)?.[1]||'').trim();
    return {kind:'class',item:{id:id('aula'),materia,dia:day,inicio:times.inicio,fim:times.fim,sala,origem:'telegram-natural'}};
  }

  // Nota: "tirei 7,5 em Cálculo na P1 valendo 20%", "Minha nota em Física foi 8".
  const gradeM=n.match(/\b(?:tirei(?:\s+uma\s+nota)?|nota(?:\s+de)?|fiquei\s+com)\s*(\d+(?:[\.,]\d+)?)\s*(?:em|na|no|de)?\s*(.+?)(?=\s+(?:na|no)\s+(?:p\s*\d+|prova|avalia)|\s+valendo\s+\d+%|$)/i)
    || n.match(/\b(?:minha|minhas)\s+nota\s+(?:em|de|no|na)\s+(.+?)\s+(?:foi|é|e)\s+(\d+(?:[\.,]\d+)?)(?:\s|$)/i)
    || n.match(/\b(?:p\s*\d+|prova\s*\d+|av\s*\d+)\s+(?:de|da|do|em)\s+(.+?)\s+(?:foi|é|e)\s+(\d+(?:[\.,]\d+)?)(?:\s|$)/i);
  if(gradeM){
    let value,name,prova='Nota Telegram';
    if(/^\s*(?:minha|minhas)\s+nota/i.test(gradeM[0])){name=subject?.nome||gradeM[1].trim();value=Number(gradeM[2].replace(',','.'));}
    else if(/^\s*(?:p\s*\d+|prova|av)/i.test(gradeM[0])){prova=(gradeM[0].match(/\b(?:p\s*\d+|prova\s*\d+|av\s*\d+)\b/i)||['Nota Telegram'])[0];value=Number(gradeM[2].replace(',','.'));name=subject?.nome||gradeM[1].trim();}
    else {value=Number(gradeM[1].replace(',','.'));name=subject?.nome||gradeM[2].trim();prova=(n.match(/\b(?:na|no)\s+(p\s*\d+|prova\s*\d+|av\s*\d+)\b/i)?.[1]||'Nota Telegram');}
    const weight=Number(n.match(/\bvalendo\s+(\d+(?:[\.,]\d+)?)\s*%/i)?.[1]?.replace(',','.')||20);
    if(Number.isFinite(value)&&name)return {kind:'grade',item:{id:id('grade'),materia:name,nome:prova.toUpperCase().replace(/\s+/g,''),valor:Math.max(0,Math.min(10,value)),peso:Math.max(.1,Math.min(100,weight)),data:todayBR(),origem:'telegram-natural'}};
  }

  // Tarefa/lembrete: "me lembra de fazer...", "adiciona uma tarefa...", "tenho que entregar..."
  if(/\b(me lembra|me lembre|lembrar|tenho que|preciso (?:fazer|entregar|estudar)|adiciona(?:r)?\s+(?:uma\s+)?tarefa|cria(?:r)?\s+(?:uma\s+)?tarefa|marca(?:r)?\s+(?:um\s+)?lembrete)\b/.test(n)){
    let title=text.replace(/^\s*(me\s+(?:lembra|lembre)\s+(?:de\s+)?|lembrar\s+(?:de\s+)?|tenho\s+que\s+|preciso\s+(?:fazer|entregar|estudar)\s*|(?:adiciona|adicionar|cria|criar|marca|marcar|registre|registrar)\s+(?:uma\s+)?(?:tarefa|lembrete)\s*(?:de\s+)?)/i,'').trim();
    title=title.replace(/\s+(?:hoje|amanha|depois de amanha|segunda(?:-feira)?|terca(?:-feira)?|terça(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|sabado|sábado)\.?$/i,'').replace(/\s+dia\s+\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?$/i,'').trim();
    const materia=subject?.nome||''; if(!title)return {kind:'help',message:'Posso criar a tarefa. Ex.: “Me lembra de fazer a lista de Física sexta”.'};
    return {kind:'task',item:{id:id('task'),materia,titulo:title,dataLimite:date||todayBR(),concluida:false,criadaEm:new Date().toISOString(),origem:'telegram-natural'}};
  }

  // Prova/avaliação/trabalho e também "P1 de Cálculo é sexta".
  if((/\b(prova|avalia(?:cao|ção)|trabalho)\b/.test(n) && date) || /\b(?:p\s*\d+|prova\s*\d+)\b.*\b(?:é|e|será|sera)\b/.test(n) && date){
    const materia=subject?.nome||text.match(/\b(?:prova|avalia(?:ção|cao)|trabalho|p\s*\d+|prova\s*\d+)\s+(?:de|da|do)\s+(.+?)(?=\s+(?:amanha|hoje|segunda|terca|terça|quarta|quinta|sexta|sabado|sábado|dia\s+\d|é|e|será|sera|$))/i)?.[1]?.trim()||'';
    const titulo=(n.match(/\b(p\s*\d+|prova\s*\d+|trabalho|avalia(?:cao|ção)\s*\d*)\b/i)?.[1]||'Avaliação').replace(/\s+/g,' ').trim();
    return {kind:'exam',item:{id:id('exam'),materia,titulo:data?titulo:'Avaliação',data:date,concluida:false,criadaEm:new Date().toISOString(),origem:'telegram-natural'}};
  }

  // Sessão: aceita formatos como "estudei Cálculo por 1h30", "45 min de Física" e "fiz 2h de estudo em Cálculo".
  const compactH=n.match(/\b(\d+(?:[\.,]\d+)?)\s*h\s*(\d{1,2})?\b/i);
  const hoursM=n.match(/\b(\d+(?:[\.,]\d+)?)\s*(?:hora|horas)\b(?:\s*e\s*(\d+)\s*(?:min|minuto|minutos))?/i);
  const minsM=n.match(/\b(\d+(?:[\.,]\d+)?)\s*(?:min|minuto|minutos)\b/i);
  if(/\b(estudei|estudo|estudos|estudar|fiz\s+.*estudo)\b/.test(n)&&(compactH||hoursM||minsM)){
    let min=0;
    if(compactH){min=Number(String(compactH[1]).replace(',','.'))*60+(compactH[2]?Number(compactH[2]):0);}
    else if(hoursM){min=Number(String(hoursM[1]).replace(',','.'))*60+(hoursM[2]?Number(hoursM[2]):0);}
    else min=Number(String(minsM[1]).replace(',','.'));
    const materia=subject?.nome||'';
    return {kind:'session',item:{id:id('session'),materia:materia||'Estudo geral',duracaoReal:Math.round(min),duracao:`${Math.round(min)} min`,data:new Date().toISOString(),concluida:true,status:'concluida',origem:'telegram-natural'}};
  }

  if(/^\s*(anota|anote|salva|salve|registr[ae])\b/i.test(text)){return {kind:'note',text:text.replace(/^\s*(anota|anote|salva|salve|registre|registra)\s*:?[-\s]*/i,'').trim()||text};}
  return null;
}
function help(){return `SLCampus conectado.\n\nVocê pode falar normalmente comigo. Exemplos:\n• Tenho aula de Cálculo amanhã das 8 às 10 na sala 12\n• Que aulas tenho amanhã?\n• Quais são minhas tarefas de sexta?\n• Quando é minha próxima prova?\n• Minhas notas\n• Me lembra de fazer a lista de Física sexta\n• Tenho prova de Geometria na próxima terça\n• Tirei 7,5 em Cálculo na P1 valendo 20%\n• Estudei Cálculo por 1h30\n• Quanto estudei esta semana?\n• Anota: revisar regra da cadeia\n\nComandos: /aula, /tarefa, /prova, /nota, /anotar, /agenda, /status, /ajuda, /desvincular\n\nFotos e PDFs enviados ao bot entram na caixa de entrada do SLCampus.`;}
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
    const ref=q.docs[0].ref,data=q.docs[0].data()||{};if(alreadyProcessed(data,update.update_id))return res.status(200).json({ok:true,duplicate:true});const mark=()=>markProcessed(ref,data,update.update_id).catch(()=>null);const lower=normalize(text);
    if(lower==='/ajuda'||lower==='/help'){await reply(chatId,help());await mark();return res.status(200).json({ok:true});}
    if(lower==='/desvincular'){await ref.set({telegram:null},{merge:true});await reply(chatId,'Telegram desvinculado.');await mark();return res.status(200).json({ok:true});}
    if(lower==='/status'){const subjects=(data.subjects||[]).length,pending=(data.tasks||[]).filter(x=>!x.concluida).length,exams=(data.exams||[]).filter(x=>!x.concluida).length,sessions=(data.sessions||[]).length;await reply(chatId,`SLCampus\nMatérias: ${subjects}\nTarefas pendentes: ${pending}\nProvas/trabalhos: ${exams}\nSessões registradas: ${sessions}`);await mark();return res.status(200).json({ok:true});}
    if(lower==='/agenda'){await reply(chatId,agendaText(data,todayBR()));await mark();return res.status(200).json({ok:true});}
    let inboxItem={id:id('tg'),receivedAt:new Date().toISOString(),chatId,type:'message',caption:msg.caption||'',text:msg.text||''};
    if(msg.document){inboxItem.type='document';inboxItem.fileId=msg.document.file_id;inboxItem.fileName=msg.document.file_name||'arquivo';inboxItem.mimeType=msg.document.mime_type||'';}
    else if(msg.photo?.length){const ph=msg.photo[msg.photo.length-1];inboxItem.type='photo';inboxItem.fileId=ph.file_id;inboxItem.fileName='foto.jpg';inboxItem.mimeType='image/jpeg';}
    if(msg.document||msg.photo){await ref.set({telegramInbox:addInbox(data,inboxItem)},{merge:true});await reply(chatId,'Recebido. O arquivo foi registrado na caixa de entrada do SLCampus.');await mark();return res.status(200).json({ok:true});}
    if(lower.startsWith('/aula')){const p=parts(text.replace(/^\/aula\s*/i,''));if(p.length<4){await reply(chatId,'Formato: /aula | Matéria | seg | 08:00 | 10:00 | Sala');await mark();return res.status(200).json({ok:true});}const day=DAY[normalize(p[1])];if(day==null){await reply(chatId,'Dia inválido. Use seg, ter, qua, qui, sex ou sáb.');await mark();return res.status(200).json({ok:true});}const aula={id:id('aula'),materia:p[0],dia:day,inicio:p[2],fim:p[3],sala:p[4]||'',origem:'telegram'};const dup=findExistingClass(data,aula);if(dup){await reply(chatId,`Essa aula já existe no SLCampus: ${formatClass(dup)}.`);await mark();return res.status(200).json({ok:true,duplicate:true});}const conflict=findClassConflict(data,aula);if(conflict){await reply(chatId,`Não adicionei porque há conflito de horário com ${formatClass(conflict)}.`);await mark();return res.status(200).json({ok:true,conflict:true});}await saveArray(ref,data,'classSchedule',aula);await reply(chatId,`Aula adicionada: ${formatClass(aula)}.`);await mark();return res.status(200).json({ok:true});}
    if(lower.startsWith('/tarefa')){const p=parts(text.replace(/^\/tarefa\s*/i,''));if(p.length<3){await reply(chatId,'Formato: /tarefa | Matéria | Título | 2026-09-30');await mark();return res.status(200).json({ok:true});}const item={id:id('task'),materia:p[0],titulo:p[1],dataLimite:p[2],concluida:false,criadaEm:new Date().toISOString(),origem:'telegram'};await saveArray(ref,data,'tasks',item);await reply(chatId,`Tarefa adicionada: ${item.titulo}.`);await mark();return res.status(200).json({ok:true});}
    if(lower.startsWith('/prova')){const p=parts(text.replace(/^\/prova\s*/i,''));if(p.length<3){await reply(chatId,'Formato: /prova | Matéria | Título | 2026-10-02');await mark();return res.status(200).json({ok:true});}const item={id:id('exam'),materia:p[0],titulo:p[1],data:p[2],concluida:false,criadaEm:new Date().toISOString(),origem:'telegram'};await saveArray(ref,data,'exams',item);await reply(chatId,`Prova/trabalho adicionado: ${item.titulo}.`);await mark();return res.status(200).json({ok:true});}
    if(lower.startsWith('/nota')){const p=parts(text.replace(/^\/nota\s*/i,''));const value=Number(String(p[1]||'').replace(',','.'));if(p.length<2||!Number.isFinite(value)||value<0||value>10){await reply(chatId,'Formato: /nota | Matéria | 7.5 | P1 | 20');await mark();return res.status(200).json({ok:true});}const grade={id:id('grade'),materia:p[0],nome:p[2]||'Nota Telegram',valor:value,peso:Math.min(100,Math.max(.1,Number(p[3]||20))),data:todayBR(),origem:'telegram'};await saveArray(ref,data,'grades',grade);await reply(chatId,`Nota registrada: ${value.toFixed(1)} em ${grade.materia}.`);await mark();return res.status(200).json({ok:true});}
    if(lower.startsWith('/anotar')){const p=parts(text.replace(/^\/anotar\s*/i,''));if(p.length<2){await reply(chatId,'Formato: /anotar | Matéria | sua anotação');await mark();return res.status(200).json({ok:true});}inboxItem.type='note';inboxItem.materia=p[0];inboxItem.text=p.slice(1).join(' | ');await ref.set({telegramInbox:addInbox(data,inboxItem)},{merge:true});await reply(chatId,'Anotação salva na caixa de entrada do SLCampus.');await mark();return res.status(200).json({ok:true});}
    const natural=parseNatural(text,data);
    if(natural?.kind==='agenda'){
      await reply(chatId,listAgenda(data,natural.date||todayBR()));
      await mark();return res.status(200).json({ok:true});
    }
    if(natural?.kind==='nextClass'){
      const upcoming=nextClass(data);
      if(!upcoming)await reply(chatId,'Não encontrei nenhuma aula futura cadastrada nos próximos 7 dias.');
      else await reply(chatId,`Próxima aula: ${formatClass(upcoming.item)} · ${formatDateBR(upcoming.date)}.`);
      await mark();return res.status(200).json({ok:true});
    }
    if(natural?.kind==='tasks'){
      let items=(data.tasks||[]).filter(x=>!x.concluida);
      if(natural.date)items=items.filter(x=>x.dataLimite===natural.date);
      items.sort((a,b)=>String(a.dataLimite||'').localeCompare(String(b.dataLimite||'')));
      if(!items.length){await reply(chatId,natural.date?`Não encontrei tarefas pendentes para ${formatDateBR(natural.date)}.`:'Não encontrei tarefas pendentes.');}
      else await reply(chatId,(natural.date?`Tarefas de ${formatDateBR(natural.date)}:`:'Tarefas pendentes:')+'\n'+items.slice(0,20).map(x=>`• ${x.titulo||'Tarefa'}${x.materia?' · '+x.materia:''}${x.dataLimite?' · '+formatDateBR(x.dataLimite):''}`).join('\n'));
      await mark();return res.status(200).json({ok:true});
    }
    if(natural?.kind==='exams'){
      let items=(data.exams||[]).filter(x=>!x.concluida);
      if(natural.date)items=items.filter(x=>x.data===natural.date);
      items.sort((a,b)=>String(a.data||'').localeCompare(String(b.data||'')));
      if(!items.length){await reply(chatId,natural.date?`Não encontrei avaliações pendentes para ${formatDateBR(natural.date)}.`:'Não encontrei provas, avaliações ou trabalhos pendentes.');}
      else await reply(chatId,(natural.date?`Avaliações de ${formatDateBR(natural.date)}:`:'Próximas avaliações:')+'\n'+items.slice(0,20).map(x=>`• ${x.titulo||'Avaliação'}${x.materia?' · '+x.materia:''}${x.data?' · '+formatDateBR(x.data):''}`).join('\n'));
      await mark();return res.status(200).json({ok:true});
    }
    if(natural?.kind==='grades'){
      const items=(data.grades||[]).slice().sort((a,b)=>String(b.data||'').localeCompare(String(a.data||'')));
      if(!items.length)await reply(chatId,'Ainda não encontrei notas registradas no SLCampus.');
      else await reply(chatId,'Notas registradas:\n'+items.slice(0,30).map(x=>`• ${x.materia||'Matéria'} · ${x.nome||'Avaliação'}: ${Number(x.valor).toFixed(1)}${x.peso?' · peso '+x.peso+'%':''}`).join('\n'));
      await mark();return res.status(200).json({ok:true});
    }
    if(natural?.kind==='studySummary'){
      const now=dateObjBR();let start=new Date(now);let end=new Date(now);const d=natural.date||todayBR();
      if(!natural.date&&/\b(semana|semanal)\b/.test(normalize(text))){const dow=now.getUTCDay();start.setUTCDate(start.getUTCDate()-dow);end.setUTCDate(start.getUTCDate()+6);}
      else if(!natural.date&&/\b(mes|mês)\b/.test(normalize(text))){start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1));end=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,0));}
      else {start=new Date(`${d}T00:00:00Z`);end=new Date(`${d}T23:59:59Z`);}
      const sessions=(data.sessions||[]).filter(x=>{const t=new Date(x.data||x.inicio||0);return !isNaN(t)&&t>=start&&t<=end;});
      const total=sessions.reduce((sum,x)=>sum+Number(x.duracaoReal||x.duracaoMin||0),0);const h=Math.floor(total/60),m=total%60;
      await reply(chatId,`Estudo no período consultado: ${h?`${h}h `:''}${m}min.\nSessões: ${sessions.length}.`);
      await mark();return res.status(200).json({ok:true});
    }
    if(natural?.kind==='help'){await reply(chatId,natural.message);await mark();return res.status(200).json({ok:true});}
    if(natural?.kind==='existingClass'){await reply(chatId,`Já existe esta matéria nesse dia:\n${natural.items.map(formatClass).map(x=>`• ${x}`).join('\n')}\n\nNão adicionei outra aula.`);await mark();return res.status(200).json({ok:true,duplicate:true});}
    if(natural?.kind==='class'){const dup=findExistingClass(data,natural.item);if(dup){await reply(chatId,`Essa aula já existe no SLCampus: ${formatClass(dup)}.`);await mark();return res.status(200).json({ok:true,duplicate:true});}const conflict=findClassConflict(data,natural.item);if(conflict){await reply(chatId,`Não adicionei porque há conflito de horário com ${formatClass(conflict)}.`);await mark();return res.status(200).json({ok:true,conflict:true});}await saveArray(ref,data,'classSchedule',natural.item);await reply(chatId,`Aula registrada: ${formatClass(natural.item)}.`);await mark();return res.status(200).json({ok:true});}
    if(natural?.kind==='task'){const dup=duplicateBy(data,'tasks',x=>sameSubject(x.materia,natural.item.materia)&&normalize(x.titulo)===normalize(natural.item.titulo)&&x.dataLimite===natural.item.dataLimite);if(dup){await reply(chatId,`Essa tarefa já existe: ${dup.titulo}.`);await mark();return res.status(200).json({ok:true,duplicate:true});}await saveArray(ref,data,'tasks',natural.item);await reply(chatId,`Tarefa criada: ${natural.item.titulo}${natural.item.materia?' · '+natural.item.materia:''} · prazo ${natural.item.dataLimite}.`);await mark();return res.status(200).json({ok:true});}
    if(natural?.kind==='exam'){const dup=duplicateBy(data,'exams',x=>sameSubject(x.materia,natural.item.materia)&&normalize(x.titulo)===normalize(natural.item.titulo)&&x.data===natural.item.data);if(dup){await reply(chatId,`Essa avaliação já existe: ${dup.titulo} em ${dup.data}.`);await mark();return res.status(200).json({ok:true,duplicate:true});}await saveArray(ref,data,'exams',natural.item);await reply(chatId,`Avaliação registrada: ${natural.item.materia||'Matéria não identificada'} · ${natural.item.titulo} · ${natural.item.data}.`);await mark();return res.status(200).json({ok:true});}
    if(natural?.kind==='grade'){const dup=duplicateBy(data,'grades',x=>sameSubject(x.materia,natural.item.materia)&&normalize(x.nome)===normalize(natural.item.nome)&&Number(x.valor)===Number(natural.item.valor)&&Number(x.peso)===Number(natural.item.peso)&&x.data===natural.item.data);if(dup){await reply(chatId,'Essa nota já está registrada hoje.');await mark();return res.status(200).json({ok:true,duplicate:true});}await saveArray(ref,data,'grades',natural.item);await reply(chatId,`Nota registrada: ${natural.item.valor.toFixed(1)} em ${natural.item.materia} · ${natural.item.nome} · peso ${natural.item.peso}%.`);await mark();return res.status(200).json({ok:true});}
    if(natural?.kind==='session'){await saveArray(ref,data,'sessions',natural.item);await reply(chatId,`Sessão registrada: ${natural.item.materia} · ${natural.item.duracaoReal} min. Ela já entra no histórico de estudos.`);await mark();return res.status(200).json({ok:true});}
    if(natural?.kind==='note'){inboxItem.type='note';inboxItem.text=natural.text;await ref.set({telegramInbox:addInbox(data,inboxItem)},{merge:true});await reply(chatId,'Anotação salva na caixa de entrada do SLCampus.');await mark();return res.status(200).json({ok:true});}
    await ref.set({telegramInbox:addInbox(data,inboxItem)},{merge:true});await reply(chatId,'Recebi. Deixei a mensagem na Caixa de entrada do SLCampus. Se quiser que eu registre automaticamente, escreva a ação de forma natural, por exemplo: “me lembra de fazer a lista de Física sexta”.');await mark();return res.status(200).json({ok:true});
  }catch(e){console.error('[telegram-webhook]',e);try{if(req.body?.message?.chat?.id)await reply(req.body.message.chat.id,'O SLCampus encontrou um erro ao processar isso. Tente novamente.');}catch(_){}return res.status(200).json({ok:false,error:e.message});}
};
