// SLCampus — webhook Telegram. Além dos comandos clássicos, entende frases
// naturais em português sem precisar chamar uma IA paga.
const admin=require('firebase-admin');
const AcademicCore=require('../shared/academic-context.js');
const AI=require('./_lib/ai-core');
const quota=require('./_lib/gemini-admin-quota');
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
function resolveCurrentSubject(data, value){return AcademicCore.resolveSubject(data,value);}
function subjectMatchesCurrent(data, value){const r=resolveCurrentSubject(data,value);return !!r && normalize(r.nome)===normalize(value);}
function duplicateBy(data,key,predicate){return (data[key]||[]).find(predicate)||null;}
function findExistingClass(data,item){return (data.classSchedule||[]).find(a=>Number(a.dia)===Number(item.dia)&&sameSubject(a.materia,item.materia)&&String(a.inicio||'')===String(item.inicio||'')&&String(a.fim||'')===String(item.fim||''));}
function findClassConflict(data,item){return (data.classSchedule||[]).find(a=>Number(a.dia)===Number(item.dia)&&overlaps(a.inicio,a.fim,item.inicio,item.fim)&&!findExistingClass({classSchedule:[a]},item));}
function alreadyProcessed(data,updateId){const ids=Array.isArray(data.telegramProcessedUpdates)?data.telegramProcessedUpdates:[];return updateId!=null&&ids.includes(updateId);}
async function markProcessed(ref,data,updateId){
  if(updateId==null)return;
  await ref.firestore.runTransaction(async tx=>{
    const snap=await tx.get(ref);
    const ids=Array.isArray(snap.data()?.telegramProcessedUpdates)?snap.data().telegramProcessedUpdates:[];
    if(ids.includes(updateId)) return;
    tx.set(ref,{telegramProcessedUpdates:[...ids,updateId].slice(-200)},{merge:true});
  });
}
function agendaText(data,date){const day=dayFromDate(date);const names=['domingo','segunda','terça','quarta','quinta','sexta','sábado'];const items=(data.classSchedule||[]).filter(a=>Number(a.dia)===day).sort((a,b)=>String(a.inicio||'').localeCompare(String(b.inicio||'')));if(!items.length)return `Não encontrei aulas salvas para ${date===todayBR()?'hoje':'esse dia'}.`;return `Aulas de ${names[day]}:
`+items.map(a=>`• ${formatClass(a)}`).join('\n');}
function parseDate(text){
  const n=normalize(text),base=dateObjBR();
  if(/\bdepois de amanha\b/.test(n)){const d=new Date(base);d.setUTCDate(d.getUTCDate()+2);return isoDate(d);}
  if(/\b(amanha|amanha cedo|amanha a noite|amanha de manha)\b/.test(n)){const d=new Date(base);d.setUTCDate(d.getUTCDate()+1);return isoDate(d);}
  if(/\bhoje\b/.test(n))return todayBR();
  if(/\bontem\b/.test(n)){const d=new Date(base);d.setUTCDate(d.getUTCDate()-1);return isoDate(d);}
  if(/\b(fim de semana|final de semana)\b/.test(n)){const d=new Date(base);const add=(6-d.getUTCDay()+7)%7;d.setUTCDate(d.getUTCDate()+add);return isoDate(d);}
  const m=n.match(/\b(?:dia\s*)?(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
  if(m){let y=m[3]?Number(m[3]):base.getUTCFullYear();if(y<100)y+=2000;const d=new Date(Date.UTC(y,Number(m[2])-1,Number(m[1])));if(!isNaN(d))return isoDate(d);}
  const dayOnly=n.match(/\bdia\s+(\d{1,2})\b/);
  if(dayOnly){const d=new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth(),Number(dayOnly[1])));if(!isNaN(d))return isoDate(d);}
  for(const k of Object.keys(DAY).sort((a,b)=>b.length-a.length)){
    const patternDay=`\\b${k.replace(/-/g,'[- ]?')}\\b`;
    if(new RegExp(patternDay,'i').test(n))return nextWeekday(k);
  }
  return null;
}
function parseTimeRange(text){const n=normalize(text).replace(/h\b/g,':00');let m=n.match(/\b(\d{1,2})(?::(\d{2}))?\s*(?:as|a|ate|até|-)\s*(\d{1,2})(?::(\d{2}))?\b/);if(!m)m=n.match(/\b(\d{1,2})(?::(\d{2}))?\s*(?:h)?\s*(?:as|a|ate|até|-)\s*(\d{1,2})(?::(\d{2}))?\s*h?\b/);if(!m)return null;const fmt=(h,min)=>`${String(Math.min(23,Number(h))).padStart(2,'0')}:${String(min||0).padStart(2,'0')}`;return {inicio:fmt(m[1],m[2]),fim:fmt(m[3],m[4])};}
function subjectTokens(s){return normalize(s).split(/[^a-z0-9]+/).filter(x=>x.length>=3&&!['de','da','do','das','dos','com','para'].includes(x));}
function romanToArabic(v){const n=normalize(v);return ({i:1,ii:2,iii:3,iv:4,v:5,vi:6,vii:7,viii:8,ix:9,x:10}[n]||null);}
function subjectAliases(subject){
  const name=String(subject?.nome||subject||'').trim();
  const code=String(subject?.codigo||subject?.code||'').trim();
  const words=normalize(name).split(/[^a-z0-9]+/).filter(Boolean);
  const stop=new Set(['de','da','do','das','dos','e','em','para','a','o','as','os']);
  const significant=words.filter(w=>!stop.has(w));
  const sig=significant.map(w=>w[0]).join('');
  const aliases=new Set();
  if(code) aliases.add(normalize(code).replace(/\s+/g,''));
  if(sig.length>=2) aliases.add(sig);
  if(significant.length){
    aliases.add(significant[0]);
    aliases.add(significant[0].slice(0,4));
    const last=significant.at(-1); const roman=romanToArabic(last);
    if(roman){aliases.add(`${significant[0]}${roman}`);aliases.add(`${sig}${roman}`);}
  }
  const compact=normalize(name).replace(/[^a-z0-9]/g,'');
  if(compact) aliases.add(compact);
  return [...aliases].filter(x=>x.length>=2);
}
function findSubject(text,subjects){
  const n=normalize(text);
  const arr=(subjects||[]).map(s=>typeof s==='string'?{nome:s}:s).filter(s=>s?.nome);
  const exact=arr.filter(s=>n.includes(normalize(s.nome))).sort((a,b)=>normalize(b.nome).length-normalize(a.nome).length);
  if(exact.length)return exact[0];
  const candidates=[];
  for(const s of arr){
    const aliases=subjectAliases(s); let score=0,hits=0;
    for(const alias of aliases){
      const safe=alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      if(new RegExp(`(^|\\s)${safe}(?=\\s|$|[.,!?:;=\-])`,'i').test(n)){
        const weight=alias.length>=4?100:alias.length===3?85:70;
        score=Math.max(score,weight);
      }
    }
    const st=subjectTokens(s.nome), nt=subjectTokens(n);
    for(const u of nt){if(st.some(v=>v===u||v.startsWith(u)||u.startsWith(v)))hits++;}
    score=Math.max(score,hits?Math.round((hits/Math.max(1,st.length))*60):0);
    if(score)candidates.push({s,score,hits});
  }
  candidates.sort((a,b)=>b.score-a.score||b.hits-a.hits||normalize(a.s.nome).length-normalize(b.s.nome).length);
  if(!candidates.length)return null;
  const top=candidates[0],second=candidates[1];
  if(second&&second.score===top.score&&second.hits===top.hits&&top.score<100)return null;
  return top.score>=55?top.s:null;
}
function stripSubject(text,subject){if(!subject)return text;return text.replace(new RegExp(subject.nome.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'ig'),'').replace(/\s{2,}/g,' ').trim();}
function listAgenda(data,date){return agendaText(data,date);}
function formatDateBR(date){if(!date)return '';const [y,m,d]=date.split('-');return `${d}/${m}/${y}`;}
function nowMinBR(){const p=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date());const h=Number(p.find(x=>x.type==='hour')?.value||0),m=Number(p.find(x=>x.type==='minute')?.value||0);return h*60+m;}
function nextClass(data){const d=dateObjBR();const current=nowMinBR();for(let offset=0;offset<=7;offset++){const date=isoDate(new Date(d.getTime()+offset*86400000));const day=dayFromDate(date);const items=(data.classSchedule||[]).filter(a=>Number(a.dia)===day).sort((a,b)=>(timeMin(a.inicio)||0)-(timeMin(b.inicio)||0));for(const item of items){if(offset>0||(timeMin(item.inicio)!=null&&timeMin(item.inicio)>=current))return {item,date};}}return null;}

// O Firestore guarda o estado do semestre atual nos arrays principais. Sem uma
// etiqueta de semestre em cada tarefa/prova/nota antiga, o filtro mais seguro é:
// 1) usar as matérias atualmente ativas como escopo; e
// 2) retirar itens que também aparecem explicitamente dentro de um arquivo
// histórico. Isso evita que consultas do Telegram misturem 2025/2026.1 com o
// semestre em andamento.
function currentSubjectKeys(data){
  return AcademicCore.currentNames(data);
}
function historicalItemKeys(data,key){
  const out=new Set();
  for(const a of (Array.isArray(data?.archivedSemesters)?data.archivedSemesters:[])) for(const item of (Array.isArray(a?.[key])?a[key]:[])){const k=AcademicCore.keysFor(item,key);if(k)out.add(k);}
  return out;
}
function scopedAcademicItems(data,key){ return AcademicCore.items(data,key); }
function formatGroupedBySubject(items, formatter){
  const groups=new Map();
  for(const item of items){const key=item?.materia||'Sem matéria';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item);}
  return [...groups.entries()].map(([materia,list])=>`${materia}\n${list.map(formatter).join('\n')}`).join('\n\n');
}
function daysUntil(date){if(!date)return null;const a=dateObjBR(),b=new Date(`${date}T00:00:00Z`);return Math.round((b-a)/86400000);}
function periodRange(text){
  const n=normalize(text),base=dateObjBR(),dow=base.getUTCDay();
  if(/\bsemana que vem\b/.test(n)){const start=new Date(base);const add=((8-dow)%7)||7;start.setUTCDate(start.getUTCDate()+add);const end=new Date(start);end.setUTCDate(end.getUTCDate()+6);return {start:isoDate(start),end:isoDate(end)};}
  if(/\b(essa|esta|nesta) semana\b/.test(n)){const start=new Date(base);start.setUTCDate(start.getUTCDate()-dow);const end=new Date(start);end.setUTCDate(end.getUTCDate()+6);return {start:isoDate(start),end:isoDate(end)};}
  if(/\b(este|esse|neste|nesse) mes\b/.test(n)||/\bmes\b/.test(n)){const start=new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth(),1));const end=new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth()+1,0));return {start:isoDate(start),end:isoDate(end)};}
  return null;
}
function adaptiveTelegram(data){
  const a=data?.user?.adaptiveLearning||{};
  const max=Math.max(30,Math.round((Number(data?.user?.horasMaximas)||4)*60-(Number(data?.user?.tempoDeslocamento)||0)));
  const target=Math.max(30,Math.min(max,Number(a.dailyTargetMinutes)||Math.round(max*.45/5)*5));
  const today=todayBR();
  const actual=(data.sessions||[]).filter(s=> (s?.concluida||s?.status==='concluida') && String(s?.data||'').slice(0,10)===today).reduce((sum,s)=>sum+Number(s?.duracaoReal||s?.duracaoMin||s?.duracao||0),0);
  return {target,actual,remaining:Math.max(0,target-actual),percent:Math.min(100,Math.round(actual/Math.max(1,target)*100)),reason:a.lastReason||'ponto de partida'};
}
function subjectStatusText(data,subject){
  const name=subject?.nome||subject||'';
  const grades=scopedAcademicItems(data,'grades').filter(x=>sameSubject(x.materia,name));
  const values=grades.map(x=>Number(x.valor)).filter(x=>Number.isFinite(x)&&x>=0&&x<=10);
  const avg=values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
  const sessions=(data.sessions||[]).filter(x=>(x?.concluida||x?.status==='concluida')&&sameSubject(x.materia,name));
  const minutes=sessions.reduce((a,x)=>a+Number(x?.duracaoReal||x?.duracaoMin||x?.duracao||0),0);
  const tasks=scopedAcademicItems(data,'tasks').filter(x=>!x.concluida&&sameSubject(x.materia,name));
  const exams=scopedAcademicItems(data,'exams').filter(x=>!x.concluida&&sameSubject(x.materia,name)&&String(x.data||'')>=todayBR()).sort((a,b)=>String(a.data).localeCompare(String(b.data)));
  const topics=(data.learningMap||[]).filter(x=>sameSubject(x.materia,name)).filter(x=>Number(x.confianca??x.confidence??3)<=2||['fraco','revisar','estudando'].includes(normalize(x.status))).slice(0,3);
  const lines=[`Situação em ${name}:`];
  lines.push(avg===null?'• Notas: ainda não registradas.':`• Média das notas registradas: ${avg.toFixed(1)}.`);
  lines.push(`• Estudo acumulado: ${(minutes/60).toFixed(1)}h.`);
  if(tasks.length)lines.push(`• Tarefas pendentes: ${tasks.length}.`);else lines.push('• Tarefas pendentes: nenhuma.');
  if(exams.length)lines.push(`• Próxima avaliação: ${exams[0].titulo||'Avaliação'} em ${formatDateBR(exams[0].data)}.`);
  if(topics.length)lines.push(`• Tópicos que pedem atenção: ${topics.map(x=>x.nome||x.topico).filter(Boolean).join(', ')}.`);
  return lines.join('\n');
}
function studyPlanText(data){
  const target=adaptiveTelegram(data), subjects=Array.isArray(data.subjects)?data.subjects:[];
  const now=todayBR();
  const score=s=>{
    const name=s.nome||''; const grades=scopedAcademicItems(data,'grades').filter(x=>sameSubject(x.materia,name)).map(x=>Number(x.valor)).filter(Number.isFinite); const avg=grades.length?grades.reduce((a,b)=>a+b,0)/grades.length:7;
    const exam=scopedAcademicItems(data,'exams').filter(x=>!x.concluida&&sameSubject(x.materia,name)&&String(x.data||'')>=now).sort((a,b)=>String(a.data).localeCompare(String(b.data)))[0];
    const days=exam?daysUntil(exam.data):30; const tasks=scopedAcademicItems(data,'tasks').filter(x=>!x.concluida&&sameSubject(x.materia,name)).length;
    const weak=(data.learningMap||[]).filter(x=>sameSubject(x.materia,name)&&Number(x.confianca??3)<=2).length;
    return (exam?Math.max(0,30-days*2):0)+Math.max(0,7-avg)*7+tasks*3+weak*4+Number(s.dificuldade||3)*2;
  };
  const ranked=subjects.map(s=>({s,score:score(s)})).sort((a,b)=>b.score-a.score).slice(0,4);
  if(!ranked.length)return 'Ainda não tenho matérias suficientes para montar um plano.';
  let remaining=target.remaining||target.target; const lines=[`Plano adaptativo de hoje (${Math.round(target.target/60*10)/10}h de meta):`];
  ranked.forEach((row,i)=>{if(remaining<=0)return;const share=i===0?0.4:i===1?0.3:i===2?0.2:0.1;const mins=Math.max(20,Math.min(90,Math.round((remaining*share)/5)*5));remaining-=mins;lines.push(`• ${row.s.nome} — ${mins} min.`);});
  lines.push(`\n${target.actual?`Você já estudou ${Math.round(target.actual)} min hoje. `:''}${target.remaining?`Restam ${target.remaining} min para a meta atual.`:'Meta de hoje já atingida.'}`);
  return lines.join('\n');
}
function naturalQuery(text,data){
  const n=normalize(text),date=parseDate(text),period=periodRange(text),subject=findSubject(text,data.subjects||[]);
  const subjectName=subject?.nome||'';
  if(/\b(qual|quanto|meta|objetivo).*\b(estudar|estudo|estudei|estudar hoje|tempo)\b/.test(n)&&/\b(hoje|agora|dia)\b/.test(n))return {kind:'adaptiveGoal'};
  if(/\b(o que|oq|qual|como)\b.*\b(estudar|estudo|estude|estudaria|plano de estudo)\b/.test(n))return {kind:'studyPlan'};
  if(subject&&/\b(como estou|como esta|como ta|situa[cç]ao|desempenho|rendimento)\b/.test(n))return {kind:'subjectStatus',subject:subjectName};
  const dayContext=!!date||/\b(hoje|amanha|depois de amanha|ontem|segunda|terca|quarta|quinta|sexta|sabado|domingo|semana que vem|fim de semana)\b/.test(n);
  if(/\b(o que|oq|o q|tem o que|tenho o que|tenho alguma coisa|tem alguma coisa)\b/.test(n)&&dayContext)return {kind:'dayOverview',date:date||todayBR(),subject:subjectName};
  if(/\b(agenda|meu dia|minha agenda|como esta meu dia|como ta meu dia)\b/.test(n)&&dayContext)return {kind:'dayOverview',date:date||todayBR(),subject:subjectName};
  if(/\b(proxima|próxima|seguinte)\s+(aula|classe)\b/.test(n)||/\bqual.*(aula|classe).*vem\b/.test(n))return {kind:'nextClass',subject:subjectName};
  const classAction=/\b(adiciona|adicionar|cria|criar|marca|marcar|registra|registrar|coloca|colocar|vou\s+ter|tenho)\b.*\b(aulas?|classe|classes)\b/.test(n);
  const asksClasses=/^\s*(que|quais|qual)\b.*\b(aulas?|horario|horarios)\b/.test(n)
    ||/\b(minhas|meu|meus)\s+(aulas?|horario|horarios)\b/.test(n)
    ||/\b(o que|oq)\s+(eu\s+)?tenho\b.*\b(aulas?|horario|horarios)\b/.test(n)
    ||/\b(como\s+(esta|esta o)|mostra|mostrar|ver)\b.*\b(horario|horarios|grade)\b/.test(n)
    ||/^\s*(aulas?|classes?|grade|horario|horarios)\b.*\b(hoje|amanha|depois de amanha|segunda|terca|quarta|quinta|sexta|sabado|domingo)\b/.test(n)
    ||(/\btenho\s+(aulas?|aula)\b/.test(n)&&/[?]$/.test(String(text).trim()));
  if(asksClasses&&!classAction)return {kind:'agenda',date:date||todayBR(),subject:subjectName};
  if(/\b(que|quais|qual|mostra|mostrar|ver|minhas|meus)\b.*\b(tarefas?|lembretes?|pendencias?|pendências?|entregas?|afazeres?|to-do|todo)\b/.test(n)||/\b(o que|oq)\s+(eu\s+)?tenho\s+(para\s+)?(fazer|entregar)\b/.test(n))return {kind:'tasks',date,period,subject:subjectName};
  const asksNextExam=/\b(proxima|próxima)\b.*\b(prova|avaliacao|avaliação|trabalho|teste|p\s*\d+|av\s*\d+)\b/.test(n)||/\bquando\s+(é|e)\s+(minha|a)\s+(prova|avaliacao|avaliação|teste|p\s*\d+|av\s*\d+)\b/.test(n)||/\bqual\s+(?:é|e)\s+(?:a|minha)\s+(p\s*\d+|prova\s*\d+|av\s*\d+)\b/.test(n);
  if(asksNextExam)return {kind:'exams',date,nextOnly:true,subject:subjectName};
  if(/\b(tenho|tem|ha|há)\s+(alguma|algum)\s+(prova|avaliacao|avaliação|trabalho|teste)\b/.test(n)||/\bqual\s+(?:e|é)\s+(?:a|minha)\s+(prova|avaliacao|avaliação)\b/.test(n))return {kind:'exams',date,nextOnly:false,period,subject:subjectName};
  if(/\b(que|quais|qual|mostra|mostrar|ver|minhas|meus)\b.*\b(provas?|avaliacoes?|avaliações?|trabalhos?|testes?|p\s*\d+|av\s*\d+|n\s*\d+)\b/.test(n))return {kind:'exams',date,nextOnly:false,period,subject:subjectName};
  const gradeAction=/\b(minha|minhas)\s+nota\b.*\b(foi|é|e)\b.*\d/.test(n)||/\b(tirei|fiquei\s+com)\b.*\d/.test(n);
  if(!gradeAction&&(/\b(minhas|meus|quais|qual|mostra|mostrar|ver)\b.*\b(notas?|medias?|médias?|boletim|resultado|resultados)\b/.test(n)||/\bnota\s+(de|em|do|da)\b/.test(n)))return {kind:'grades',subject:subjectName};
  if(/\bquanto\s+(tempo|eu\s+estudei|estudei|tempo\s+de\s+estudo)\b/.test(n)||/\b(horas?|minutos?)\s+(eu\s+)?estudei\b/.test(n)||/\b(estudos?|sessoes?|sessões?)\b.*\b(hoje|ontem|semana|mes|mês)\b/.test(n))return {kind:'studySummary',date,subject:subjectName};
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
    || n.match(/\b(?:p\s*\d+|prova\s*\d+|av\s*\d+)\s+(?:de|da|do|em)\s+(.+?)\s*[:=-]\s*(\d+(?:[\.,]\d+)?)(?:\s|$)/i)
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

  // Prova/avaliação/trabalho e também frases como "tenho P1 de GA sexta".
  if((/\b(tenho|vou\s+ter|marcaram|minha|meu)\b.*\b(?:p\s*\d+|n\s*\d+|prova\s*\d+|prova|avali(?:acao|ção)|trabalho|teste)\b/.test(n) && date && !/[?]$/.test(String(text).trim()))
    || ((/\b(prova|avali(?:acao|ção)|trabalho|teste)\b/.test(n) && date))
    || /\b(?:p\s*\d+|prova\s*\d+)\b.*\b(?:é|e|será|sera)\b/.test(n) && date){
    const materia=subject?.nome||text.match(/\b(?:prova|avalia(?:ção|cao)|trabalho|p\s*\d+|prova\s*\d+)\s+(?:de|da|do)\s+(.+?)(?=\s+(?:amanha|hoje|segunda|terca|terça|quarta|quinta|sexta|sabado|sábado|dia\s+\d|é|e|será|sera|$))/i)?.[1]?.trim()||'';
    const titulo=(n.match(/\b(p\s*\d+|prova\s*\d+|trabalho|avalia(?:cao|ção)\s*\d*)\b/i)?.[1]||'Avaliação').replace(/\s+/g,' ').trim();
    return {kind:'exam',item:{id:id('exam'),materia,titulo:data?titulo:'Avaliação',data:date,concluida:false,criadaEm:new Date().toISOString(),origem:'telegram-natural'}};
  }

  // Sessão: aceita formatos como "estudei Cálculo por 1h30", "45 min de Física" e "fiz 2h de estudo em Cálculo".
  const compactH=n.match(/\b(\d+(?:[\.,]\d+)?)\s*h\s*(\d{1,2})?\b/i);
  const hoursM=n.match(/\b(\d+(?:[\.,]\d+)?)\s*(?:hora|horas)\b(?:\s*e\s*(\d+)\s*(?:min|minuto|minutos))?/i);
  const minsM=n.match(/\b(\d+(?:[\.,]\d+)?)\s*(?:min|minuto|minutos)\b/i);
  if(/\b(estudei|estudo|estudos|estudar|fiz|passei)\b/.test(n)&&(compactH||hoursM||minsM)&&(subject||/\b(estudo|estudando)\b/.test(n))){
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
function compactForAI(data){
  const current=AcademicCore.current(data);
  const clean=v=>String(v??'').slice(0,500);
  const grades=(current.grades||[]).slice().sort((a,b)=>String(b.data||'').localeCompare(String(a.data||''))).slice(0,60).map(g=>({materia:clean(g.materia),avaliacao:clean(g.nome),nota:g.valor,peso:g.peso,data:g.data}));
  const exams=(current.exams||[]).filter(e=>String(e.data||'')>=todayBR()).sort((a,b)=>String(a.data||'').localeCompare(String(b.data||''))).slice(0,40).map(e=>({materia:clean(e.materia),titulo:clean(e.titulo),data:e.data,peso:e.peso,conteudo:clean(e.conteudo)}));
  const tasks=(current.tasks||[]).filter(t=>!t.concluida).sort((a,b)=>String(a.dataLimite||a.data||'').localeCompare(String(b.dataLimite||b.data||''))).slice(0,40).map(t=>({materia:clean(t.materia),titulo:clean(t.titulo),prazo:t.dataLimite||t.data,prioridade:t.prioridade}));
  const sessions=(current.sessions||[]).slice(-40).map(x=>({materia:clean(x.materia),topico:clean(x.topico),min:Number(x.duracaoReal||x.duracaoMin||0),data:x.data||x.inicio}));
  const evidence=(Array.isArray(data.learningEvidence)?data.learningEvidence:[]).slice(-50).map(x=>({materia:clean(x.materia),topico:clean(x.topico),resultado:clean(x.resultado||x.status||x.feedback),confianca:x.confianca,dificuldade:x.dificuldade,data:x.data||x.createdAt}));
  const learning=(Array.isArray(data.learningMap)?data.learningMap:[]).slice(0,80).map(x=>({materia:clean(x.materia),topico:clean(x.topico),status:x.status,confianca:x.confianca,dificuldade:x.dificuldade,proximaRevisao:x.proximaRevisao}));
  const archived=(Array.isArray(data.archivedSemesters)?data.archivedSemesters:[]).map(a=>({periodo:a.periodo,numero:a.numero,materias:(a.subjects||a.curriculum||[]).slice(0,80).map(s=>({nome:clean(s.nome),codigo:s.codigo,status:s.status,nota:s.notaFinal??s.nota,tentativas:s.tentativas?.length||0}))}));
  const user=data.user||{};
  return {
    agora:todayBR(),
    perfil:{nome:user.nome||user.name||'',curso:user.curso||'',instituicao:user.instituicao||'',semestre:user.semestre||null},
    atual:{subjects:current.subjects.map(s=>({nome:clean(s.nome),codigo:s.codigo,status:s.status,dificuldade:s.dificuldade,notaDesejada:s.notaDesejada})),grades,exams,tasks,classSchedule:current.classSchedule||[]},
    aprendizagem:{learning,evidence,adaptive:user.adaptiveLearning||{}},
    execucao:{sessions},
    historico:archived
  };
}
function mentorLikeTelegram(text){
  const n=normalize(text);
  return /\b(como estou|como eu estou|como foi minha evolucao|evolucao|desempenho|risco academico|riscos|o que devo estudar|qual materia devo estudar|o que estudar|prioridade|prioridades|por que .*prioridade|por que .*dificil|materia mais dificil|materias mais dificeis|quanto preciso|media necessaria|ja reprovei|reprovei|historico|diagnostico|raio x|plano de estudos|plano semanal|organizar meus estudos|me ajude a estudar)\b/.test(n);
}
function telegramSystemInstruction(){return `Você é o Mentor IA do SLCampus no Telegram. Você é a mesma inteligência acadêmica disponível no site, não um bot separado. Use somente os dados fornecidos no CONTEXTO ACADÊMICO. Diferencie SEMESTRE ATUAL de HISTÓRICO. Histórico serve para explicar padrões, reprovações e tentativas anteriores, mas não deve virar prova, tarefa ou compromisso atual. Não invente datas, notas, matérias, horários ou fatos. Se faltar dado, diga claramente. Quando fizer uma recomendação de estudo, explique brevemente quais dados objetivos levaram à prioridade. Responda em português do Brasil, de forma natural e útil para Telegram, sem tabelas largas e sem mencionar APIs, provedores ou detalhes internos. Se a pergunta pedir cálculo de média, use somente os valores e pesos disponíveis. Se houver conflito entre dados, prefira o semestre atual e avise sobre a inconsistência.`;}
async function askTelegramMentor({uid,email,text,data}){
  const context=compactForAI(data);
  const prompt=`PERGUNTA DO ALUNO:\n${String(text).slice(0,4000)}\n\nCONTEXTO ACADÊMICO REAL:\n${JSON.stringify(context).slice(0,30000)}`;
  const requestId=AI.requestId('tg');
  const usage=await quota.reserveUserOperation({uid,email,operation:'mentor',requestId});
  if(usage.blocked) return {ok:false,limit:true};
  try{
    const result=await AI.callAI({messages:[{role:'user',content:prompt}],systemInstruction:telegramSystemInstruction(),operation:'mentor',uid,email,requestId,maxTokens:1200,reasoningEffort:'medium'});
    if(result.ok) return {ok:true,text:result.text,provider:result.provider,model:result.modelUsed};
    try{await quota.releaseUserOperation({uid,operation:'mentor'});}catch(_){ }
    return {ok:false,error:result.error,code:result.code};
  }catch(err){try{await quota.releaseUserOperation({uid,operation:'mentor'});}catch(_){ }return {ok:false,error:err.message};}
}
async function downloadTelegramFile(fileId){
  const t=token();
  const metaR=await fetch(`https://api.telegram.org/bot${t}/getFile?file_id=${encodeURIComponent(fileId)}`); const meta=await metaR.json().catch(()=>({}));
  if(!metaR.ok||!meta.ok||!meta.result?.file_path)throw new Error(meta.description||'Não consegui localizar o arquivo no Telegram.');
  const r=await fetch(`https://api.telegram.org/file/bot${t}/${meta.result.file_path}`); if(!r.ok)throw new Error('Não consegui baixar o arquivo recebido.');
  const buf=Buffer.from(await r.arrayBuffer()); if(buf.length>12*1024*1024)throw new Error('O arquivo excede o limite de 12 MB.');
  return {buf,filePath:meta.result.file_path};
}
function mergeTelegramHistory(data,result){
  const archives=Array.isArray(data.archivedSemesters)?data.archivedSemesters:[];
  const groups=Array.isArray(result?.periodos)?result.periodos:[];
  let added=0,updated=0;
  for(const g of groups){
    const periodo=String(g.periodo||'').trim(); if(!periodo)continue;
    const subjects=(g.disciplinas||[]).map(d=>({id:id('hist-sub'),codigo:String(d.codigo||'').trim().toUpperCase(),nome:String(d.nome||'').trim(),semestre:periodo,status:String(d.status||d.situacao||'concluida').toLowerCase().startsWith('reprov')?'reprovada':String(d.status||d.situacao||'concluida').toLowerCase().includes('curs')?'cursando':'concluida',notaFinal:Number.isFinite(Number(d.notaFinal??d.nota??d.media))?Number(d.notaFinal??d.nota??d.media):null,nota:Number.isFinite(Number(d.notaFinal??d.nota??d.media))?Number(d.notaFinal??d.nota??d.media):null,tentativas:Array.isArray(d.tentativas)?d.tentativas:[]})).filter(x=>x.nome);
    if(!subjects.length)continue;
    const numero=Number(String(g.periodo).match(/^(\d+)/)?.[1]||0)||null;
    const incoming={id:id('hist-tg'),tipo:'manual',origem:'TELEGRAM-SIGAA',numero,semestre:numero,periodo,titulo:`${numero?numero+'º semestre — ':''}${periodo}`,subjects,curriculum:subjects,materias:subjects.map(x=>x.nome),grades:[],sessions:[],tasks:[],exams:[],materials:[],learningMap:[],classDiaries:[],reviews:[],classSchedule:[],attendance:{}};
    const idx=archives.findIndex(a=>String(a.periodo||'')===periodo);
    if(idx<0){archives.push(incoming);added++;continue;}
    const old=archives[idx]||{}; const map=new Map((old.subjects||old.curriculum||[]).map(s=>[String(s.codigo||s.nome).toLowerCase(),s])); subjects.forEach(s=>map.set(String(s.codigo||s.nome).toLowerCase(),{...(map.get(String(s.codigo||s.nome).toLowerCase())||{}),...s}));
    archives[idx]={...old,origem:'TELEGRAM-SIGAA',subjects:[...map.values()],curriculum:[...map.values()],materias:[...map.values()].map(x=>x.nome)}; updated++;
  }
  data.archivedSemesters=archives; return {added,updated,periods:groups.length};
}
async function processTelegramHistory(ref,data,inboxItem){
  const {buf}=await downloadTelegramFile(inboxItem.fileId);
  if(!/^application\/pdf$/i.test(inboxItem.mimeType||'') && !/\.pdf$/i.test(inboxItem.fileName||''))throw new Error('Para importar histórico pelo Telegram, envie um PDF.');
  const pdfParse=require('pdf-parse'); const parsed=await pdfParse(buf); const text=String(parsed.text||'');
  const result=AI.parseSigaaHistoryText(text);
  if(!result.periodos?.length)throw new Error('Não consegui identificar períodos do SIGAA nesse PDF. Envie o histórico oficial ou use a importação de histórico no site.');
  const merged=mergeTelegramHistory(data,result); await ref.set({archivedSemesters:data.archivedSemesters,telegramInbox:addInbox(data,{...inboxItem,type:'document-history-processed',processedAt:new Date().toISOString(),text:`Histórico processado: ${merged.periods} período(s).`})},{merge:true}); return merged;
}

function help(){return `SLCampus conectado.\n\nFale comigo naturalmente; comandos são opcionais.\n\nConsultas:\n• O que tenho amanhã?\n• Que aulas tenho quinta?\n• Qual é minha próxima aula?\n• Quais tarefas tenho essa semana?\n• Quando é minha próxima prova?\n• Tenho alguma prova de GA?\n• Minhas notas de Cálculo / GA / FI\n• Quanto estudei hoje / essa semana?\n• Como está meu dia amanhã?\n\nAções:\n• Tenho aula de GA quarta 7:30 às 9:10 sala PD04\n• P1 de Cálculo é sexta\n• Tirei 8,5 em GA na P1 valendo 20%\n• Me lembra da lista de Física sexta\n• Estudei FI por 1h30\n• Anota: revisar regra da cadeia\n\nEntendo nomes, abreviações, siglas e códigos cadastrados para as matérias. Se uma sigla for ambígua, prefiro pedir confirmação a escolher errado.\n\nComandos: /aula, /tarefa, /prova, /nota, /anotar, /agenda, /status, /ajuda, /desvincular.\n\nFotos e PDFs enviados ao bot entram na Caixa de Entrada do SLCampus.`;}
async function saveArray(ref,data,key,item){
  await ref.firestore.runTransaction(async tx=>{
    const snap=await tx.get(ref);
    const latest=Array.isArray(snap.data()?.[key])?snap.data()[key]:[];
    if(item?.id && latest.some(x=>x?.id===item.id)) return;
    tx.set(ref,{[key]:[...latest,item]},{merge:true});
  });
}

module.exports=async function(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Método não permitido.'});
  const expected=String(process.env.TELEGRAM_WEBHOOK_SECRET||'').trim();
  if(!expected) return res.status(503).json({error:'Webhook não configurado com segredo.'});
  const provided=String(req.headers['x-telegram-bot-api-secret-token']||'');
  if(provided!==expected)return res.status(401).json({error:'Webhook não autorizado.'});
  const rawLength=Number(req.headers['content-length']||0);
  if(rawLength>256*1024)return res.status(413).json({error:'Atualização muito grande.'});
  try{
    const update=req.body||{},msg=update.message;if(!msg)return res.status(200).json({ok:true,ignored:true});
    const chatId=String(msg.chat?.id||'');if(!chatId)return res.status(200).json({ok:true,ignored:true});
    const db=init().firestore(),text=String(msg.text||msg.caption||'').trim();
    if(text.startsWith('/start')){const c=text.split(/\s+/)[1]?.trim().toUpperCase();if(c){const linkRef=db.collection('telegramLinks').doc(c),snap=await linkRef.get(),link=snap.exists?snap.data():null;if(link&&new Date(link.expiresAt).getTime()>Date.now()){await db.collection('users').doc(link.uid).set({telegram:{chatId,username:msg.from?.username||'',firstName:msg.from?.first_name||'',linkedAt:new Date().toISOString()}},{merge:true});await linkRef.delete();await reply(chatId,'Telegram vinculado ao SLCampus.\n\n'+help());return res.status(200).json({ok:true});}}await reply(chatId,'Código inválido ou expirado. Gere outro código em SLCampus → Configurações → Telegram.');return res.status(200).json({ok:true});}
    const q=await db.collection('users').where('telegram.chatId','==',chatId).limit(1).get();if(q.empty){await reply(chatId,'Este Telegram ainda não está vinculado. Gere um código no SLCampus → Configurações → Telegram e envie /start CODIGO.');return res.status(200).json({ok:true});}
    const ref=q.docs[0].ref,data=q.docs[0].data()||{};if(alreadyProcessed(data,update.update_id))return res.status(200).json({ok:true,duplicate:true});const mark=()=>markProcessed(ref,data,update.update_id).catch(()=>null);const lower=normalize(text);
    if(lower==='/ajuda'||lower==='/help'){await reply(chatId,help());await mark();return res.status(200).json({ok:true});}
    if(lower==='/desvincular'){await ref.set({telegram:null},{merge:true});await reply(chatId,'Telegram desvinculado.');await mark();return res.status(200).json({ok:true});}
    if(lower==='/status'){const subjects=(data.subjects||[]).length,pending=scopedAcademicItems(data,'tasks').filter(x=>!x.concluida).length,exams=scopedAcademicItems(data,'exams').filter(x=>!x.concluida&&String(x.data||'')>=todayBR()).length,sessions=(data.sessions||[]).length;await reply(chatId,`SLCampus\nMatérias no semestre atual: ${subjects}\nTarefas pendentes: ${pending}\nPróximas avaliações: ${exams}\nSessões registradas: ${sessions}`);await mark();return res.status(200).json({ok:true});}
    if(lower==='/agenda'){await reply(chatId,agendaText(data,todayBR()));await mark();return res.status(200).json({ok:true});}
    let inboxItem={id:id('tg'),receivedAt:new Date().toISOString(),chatId,type:'message',caption:msg.caption||'',text:msg.text||''};
    if(msg.document){inboxItem.type='document';inboxItem.fileId=msg.document.file_id;inboxItem.fileName=msg.document.file_name||'arquivo';inboxItem.mimeType=msg.document.mime_type||'';}
    else if(msg.photo?.length){const ph=msg.photo[msg.photo.length-1];inboxItem.type='photo';inboxItem.fileId=ph.file_id;inboxItem.fileName='foto.jpg';inboxItem.mimeType='image/jpeg';}
    if(msg.document||msg.photo){
      await ref.set({telegramInbox:addInbox(data,inboxItem)},{merge:true});
      const fileText=normalize(`${msg.caption||''} ${msg.document?.file_name||''}`);
      if(msg.document && /historico|histórico|sigaa/.test(fileText) && (/\.pdf$/i.test(msg.document.file_name||'') || /application\/pdf/i.test(msg.document.mime_type||''))){
        try{
          const processed=await processTelegramHistory(ref,data,inboxItem);
          await reply(chatId,`Histórico processado pelo SLCampus. ${processed.added} período(s) novo(s) e ${processed.updated} atualizado(s) foram incorporados ao histórico. Ele já pode ser usado pelo Mentor, pelo planejamento e pelas consultas do Telegram.`);
        }catch(err){await reply(chatId,`Recebi o PDF, mas não consegui importá-lo automaticamente: ${err.message}`);}
      }else{
        await reply(chatId,'Recebido. O arquivo foi registrado na Caixa de Entrada. Se for um histórico SIGAA em PDF, envie novamente com a legenda “histórico” para eu incorporar os semestres ao contexto acadêmico.');
      }
      await mark();return res.status(200).json({ok:true});
    }
    if(lower.startsWith('/aula')){const p=parts(text.replace(/^\/aula\s*/i,''));if(p.length<4){await reply(chatId,'Formato: /aula | Matéria | seg | 08:00 | 10:00 | Sala');await mark();return res.status(200).json({ok:true});}const day=DAY[normalize(p[1])];if(day==null){await reply(chatId,'Dia inválido. Use seg, ter, qua, qui, sex ou sáb.');await mark();return res.status(200).json({ok:true});}const aula={id:id('aula'),materia:p[0],dia:day,inicio:p[2],fim:p[3],sala:p[4]||'',origem:'telegram'};const dup=findExistingClass(data,aula);if(dup){await reply(chatId,`Essa aula já existe no SLCampus: ${formatClass(dup)}.`);await mark();return res.status(200).json({ok:true,duplicate:true});}const conflict=findClassConflict(data,aula);if(conflict){await reply(chatId,`Não adicionei porque há conflito de horário com ${formatClass(conflict)}.`);await mark();return res.status(200).json({ok:true,conflict:true});}await saveArray(ref,data,'classSchedule',aula);await reply(chatId,`Aula adicionada: ${formatClass(aula)}.`);await mark();return res.status(200).json({ok:true});}
    if(lower.startsWith('/tarefa')){const p=parts(text.replace(/^\/tarefa\s*/i,''));if(p.length<3){await reply(chatId,'Formato: /tarefa | Matéria | Título | 2026-09-30');await mark();return res.status(200).json({ok:true});}const item={id:id('task'),materia:p[0],titulo:p[1],dataLimite:p[2],concluida:false,criadaEm:new Date().toISOString(),origem:'telegram'};await saveArray(ref,data,'tasks',item);await reply(chatId,`Tarefa adicionada: ${item.titulo}.`);await mark();return res.status(200).json({ok:true});}
    if(lower.startsWith('/prova')){const p=parts(text.replace(/^\/prova\s*/i,''));if(p.length<3){await reply(chatId,'Formato: /prova | Matéria | Título | 2026-10-02');await mark();return res.status(200).json({ok:true});}const item={id:id('exam'),materia:p[0],titulo:p[1],data:p[2],concluida:false,criadaEm:new Date().toISOString(),origem:'telegram'};await saveArray(ref,data,'exams',item);await reply(chatId,`Prova/trabalho adicionado: ${item.titulo}.`);await mark();return res.status(200).json({ok:true});}
    if(lower.startsWith('/nota')){const p=parts(text.replace(/^\/nota\s*/i,''));const value=Number(String(p[1]||'').replace(',','.'));if(p.length<2||!Number.isFinite(value)||value<0||value>10){await reply(chatId,'Formato: /nota | Matéria | 7.5 | P1 | 20');await mark();return res.status(200).json({ok:true});}const grade={id:id('grade'),materia:p[0],nome:p[2]||'Nota Telegram',valor:value,peso:Math.min(100,Math.max(.1,Number(p[3]||20))),data:todayBR(),origem:'telegram'};await saveArray(ref,data,'grades',grade);await reply(chatId,`Nota registrada: ${value.toFixed(1)} em ${grade.materia}.`);await mark();return res.status(200).json({ok:true});}
    if(lower.startsWith('/anotar')){const p=parts(text.replace(/^\/anotar\s*/i,''));if(p.length<2){await reply(chatId,'Formato: /anotar | Matéria | sua anotação');await mark();return res.status(200).json({ok:true});}inboxItem.type='note';inboxItem.materia=p[0];inboxItem.text=p.slice(1).join(' | ');await ref.set({telegramInbox:addInbox(data,inboxItem)},{merge:true});await reply(chatId,'Anotação salva na caixa de entrada do SLCampus.');await mark();return res.status(200).json({ok:true});}
    const natural=parseNatural(text,data);
    if(natural?.kind==='adaptiveGoal'){
      const g=adaptiveTelegram(data); const h=Math.floor(g.target/60),m=g.target%60; const targetLabel=h?`${h}h${m?` ${m}min`:''}`:`${m}min`; const doneLabel=g.actual>=60?`${Math.floor(g.actual/60)}h ${g.actual%60?`${g.actual%60}min`:''}`.trim():`${g.actual}min`;
      await reply(chatId,`Meta adaptativa de hoje: ${targetLabel}.\nFeito hoje: ${doneLabel}.\n${g.remaining?`Restam ${g.remaining} min.`:'Meta atingida.'}\nO sistema ajusta essa meta com base no seu ritmo real.`);await mark();return res.status(200).json({ok:true});
    }
    if(natural?.kind==='studyPlan'){await reply(chatId,studyPlanText(data));await mark();return res.status(200).json({ok:true});}
    if(natural?.kind==='subjectStatus'){await reply(chatId,subjectStatusText(data,natural.subject));await mark();return res.status(200).json({ok:true});}
    if(natural?.kind==='dayOverview'){
      const target=natural.date||todayBR(), day=dayFromDate(target);
      const classes=(data.classSchedule||[]).filter(a=>Number(a.dia)===day&&(!natural.subject||sameSubject(a.materia,natural.subject))).sort((a,b)=>(timeMin(a.inicio)||0)-(timeMin(b.inicio)||0));
      const tasks=scopedAcademicItems(data,'tasks').filter(x=>!x.concluida&&x.dataLimite===target&&(!natural.subject||sameSubject(x.materia,natural.subject)));
      const exams=scopedAcademicItems(data,'exams').filter(x=>!x.concluida&&x.data===target&&(!natural.subject||sameSubject(x.materia,natural.subject)));
      const reviews=(data.reviews||[]).filter(x=>!x.concluida&&String(x.data||'').slice(0,10)===target&&(!natural.subject||sameSubject(x.materia,natural.subject)));
      const lines=[`Agenda de ${formatDateBR(target)}:`];
      if(classes.length)lines.push(`\nAulas\n${classes.map(a=>`• ${formatClass(a)}`).join('\n')}`);
      if(exams.length)lines.push(`\nAvaliações\n${exams.map(x=>`• ${x.titulo||'Avaliação'} · ${x.materia||'Sem matéria'}`).join('\n')}`);
      if(tasks.length)lines.push(`\nTarefas\n${tasks.map(x=>`• ${x.titulo||'Tarefa'}${x.materia?` · ${x.materia}`:''}`).join('\n')}`);
      if(reviews.length)lines.push(`\nRevisões\n${reviews.map(x=>`• ${x.materia||'Sem matéria'} · ${x.topico||'revisão'}`).join('\n')}`);
      if(lines.length===1)lines.push('\nNada acadêmico encontrado para esse dia.');
      await reply(chatId,lines.join('\n'));await mark();return res.status(200).json({ok:true});
    }
    if(natural?.kind==='agenda'){
      const target=natural.date||todayBR();
      if(natural.subject){const day=dayFromDate(target);const items=(data.classSchedule||[]).filter(a=>Number(a.dia)===day&&sameSubject(a.materia,natural.subject)).sort((a,b)=>(timeMin(a.inicio)||0)-(timeMin(b.inicio)||0));await reply(chatId,items.length?`Aulas de ${formatDateBR(target)} — ${natural.subject}:\n${items.map(a=>`• ${formatClass(a)}`).join('\n')}`:`Não encontrei aula de ${natural.subject} em ${formatDateBR(target)}.`);}else await reply(chatId,listAgenda(data,target));
      await mark();return res.status(200).json({ok:true});
    }
    if(natural?.kind==='nextClass'){
      const upcoming=nextClass(data);
      if(natural.subject){const d=dateObjBR(),current=nowMinBR();let found=null;for(let offset=0;offset<=30&&!found;offset++){const date=isoDate(new Date(d.getTime()+offset*86400000)),day=dayFromDate(date);const items=(data.classSchedule||[]).filter(a=>Number(a.dia)===day&&sameSubject(a.materia,natural.subject)).sort((a,b)=>(timeMin(a.inicio)||0)-(timeMin(b.inicio)||0));for(const item of items){if(offset>0||(timeMin(item.inicio)!=null&&timeMin(item.inicio)>=current)){found={item,date};break;}}}if(!found)await reply(chatId,`Não encontrei próxima aula de ${natural.subject} nos próximos 30 dias.`);else await reply(chatId,`Próxima aula de ${natural.subject}: ${formatClass(found.item)} · ${formatDateBR(found.date)}.`);}else if(!upcoming)await reply(chatId,'Não encontrei nenhuma aula futura cadastrada nos próximos 7 dias.');
      else await reply(chatId,`Próxima aula: ${formatClass(upcoming.item)} · ${formatDateBR(upcoming.date)}.`);
      await mark();return res.status(200).json({ok:true});
    }
    if(natural?.kind==='tasks'){
      let items=scopedAcademicItems(data,'tasks').filter(x=>!x.concluida);
      if(natural.date)items=items.filter(x=>x.dataLimite===natural.date);
      if(natural.period)items=items.filter(x=>String(x.dataLimite||'')>=natural.period.start&&String(x.dataLimite||'')<=natural.period.end);
      if(natural.subject)items=items.filter(x=>sameSubject(x.materia,natural.subject));
      items.sort((a,b)=>String(a.dataLimite||'').localeCompare(String(b.dataLimite||'')));
      if(!items.length){await reply(chatId,natural.date?`Não encontrei tarefas pendentes para ${formatDateBR(natural.date)}.`:'Não encontrei tarefas pendentes.');}
      else await reply(chatId,(natural.date?`Tarefas de ${formatDateBR(natural.date)}:`:natural.period?`Tarefas de ${formatDateBR(natural.period.start)} a ${formatDateBR(natural.period.end)}:`:'Tarefas pendentes:')+'\n'+formatGroupedBySubject(items.slice(0,20),x=>`• ${x.titulo||'Tarefa'}${x.dataLimite?' · '+formatDateBR(x.dataLimite):''}`));
      await mark();return res.status(200).json({ok:true});
    }
    if(natural?.kind==='exams'){
      let items=scopedAcademicItems(data,'exams').filter(x=>!x.concluida);
      const today=todayBR();
      // Consultas de "próxima prova" nunca retornam avaliações já passadas.
      // A mesma regra vale para a listagem de próximas avaliações.
      items=items.filter(x=>String(x.data||'')>=today);
      if(natural.date)items=items.filter(x=>x.data===natural.date);
      if(natural.period)items=items.filter(x=>String(x.data||'')>=natural.period.start&&String(x.data||'')<=natural.period.end);
      if(natural.subject)items=items.filter(x=>sameSubject(x.materia,natural.subject));
      items.sort((a,b)=>String(a.data||'').localeCompare(String(b.data||'')));
      if(natural.nextOnly)items=items.slice(0,1);
      if(!items.length){await reply(chatId,natural.date?`Não encontrei avaliações pendentes para ${formatDateBR(natural.date)}.`:natural.period?`Não encontrei avaliações pendentes de ${formatDateBR(natural.period.start)} a ${formatDateBR(natural.period.end)}.`:natural.nextOnly?'Não encontrei nenhuma próxima prova ou avaliação cadastrada.':'Não encontrei provas, avaliações ou trabalhos futuros cadastrados.');}
      else if(natural.nextOnly){const x=items[0];await reply(chatId,`Sua próxima avaliação é:

${x.titulo||'Avaliação'}
${x.materia||'Sem matéria'}
${formatDateBR(x.data)}`);}
      else await reply(chatId,'Próximas avaliações:\n\n'+formatGroupedBySubject(items.slice(0,20),x=>`• ${x.titulo||'Avaliação'} · ${formatDateBR(x.data)}`));
      await mark();return res.status(200).json({ok:true});
    }
    if(natural?.kind==='grades'){
      let items=scopedAcademicItems(data,'grades').slice().sort((a,b)=>String(b.data||'').localeCompare(String(a.data||'')));
      if(natural.subject)items=items.filter(x=>sameSubject(x.materia,natural.subject));
      if(!items.length)await reply(chatId,'Ainda não encontrei notas registradas no semestre atual do SLCampus.');
      else await reply(chatId,'Notas do semestre atual:\n\n'+formatGroupedBySubject(items.slice(0,30),x=>`• ${x.nome||'Avaliação'}: ${Number(x.valor).toFixed(1)}${x.peso?' · peso '+x.peso+'%':''}`));
      await mark();return res.status(200).json({ok:true});
    }
    if(natural?.kind==='studySummary'){
      const now=dateObjBR();let start=new Date(now);let end=new Date(now);const d=natural.date||todayBR();
      if(!natural.date&&/\b(semana|semanal)\b/.test(normalize(text))){const dow=now.getUTCDay();start.setUTCDate(start.getUTCDate()-dow);end.setUTCDate(start.getUTCDate()+6);}
      else if(!natural.date&&/\b(mes|mês)\b/.test(normalize(text))){start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1));end=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,0));}
      else {start=new Date(`${d}T00:00:00Z`);end=new Date(`${d}T23:59:59Z`);}
      let sessions=(data.sessions||[]).filter(x=>{const t=new Date(x.data||x.inicio||0);return !isNaN(t)&&t>=start&&t<=end;});
      if(natural.subject)sessions=sessions.filter(x=>sameSubject(x.materia,natural.subject));
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
    // Perguntas abertas passam pelo mesmo AI Router do Mentor do site. Isso faz do Telegram
    // uma segunda interface do mesmo cérebro, usando o mesmo histórico/contexto do usuário.
    if(mentorLikeTelegram(text)){
      const answer=await askTelegramMentor({uid:q.docs[0].id,email:String(data.email||''),text,data});
      if(answer.ok){await reply(chatId,answer.text);await mark();return res.status(200).json({ok:true,provider:answer.provider,model:answer.model});}
      if(answer.limit){await reply(chatId,'O limite diário do Mentor IA foi atingido. As consultas acadêmicas básicas continuam disponíveis pelo Telegram.');await mark();return res.status(200).json({ok:true,limited:true});}
      // Se os provedores de IA estiverem indisponíveis, a mensagem ainda fica registrada.
      console.warn('[telegram-webhook] AI fallback:',answer.error||answer.code||'indisponível');
    }
    await ref.set({telegramInbox:addInbox(data,inboxItem)},{merge:true});await reply(chatId,'Recebi. Deixei a mensagem na Caixa de Entrada do SLCampus. Se quiser que eu registre automaticamente, escreva a ação de forma natural, por exemplo: “me lembra de fazer a lista de Física sexta”.');await mark();return res.status(200).json({ok:true});
  }catch(e){console.error('[telegram-webhook]',e);try{if(req.body?.message?.chat?.id)await reply(req.body.message.chat.id,'O SLCampus encontrou um erro ao processar isso. Tente novamente.');}catch(_){}return res.status(200).json({ok:false,error:e.message});}
};
