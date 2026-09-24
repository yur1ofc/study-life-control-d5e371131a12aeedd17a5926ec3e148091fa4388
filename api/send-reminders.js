// api/send-reminders.js — Vercel Function, feita pra rodar de tempos em
// tempos (cron) e não sob demanda de um usuário.
//
// O que faz, a cada execução:
//   1) Busca todo usuário com settings.studyReminders.enabled == true.
//   2) Pra cada um, olha provas/tarefas/sessões e calcula se alguma "vence"
//      dentro da janela de aviso configurada (ex: 24h antes da prova).
//   3) Manda um push de verdade (via web-push + VAPID) pros dispositivos
//      salvos em pushSubscriptions.
//   4) Marca o que já foi avisado em sentReminders, pra não repetir no
//      próximo run.
//
// Isso PRECISA de acesso de administrador ao Firestore (ler/atualizar o
// documento de QUALQUER usuário, não só o de quem está logado) — por isso,
// diferente de api/gemini.js e api/calendar/[token].js, aqui a gente usa o
// firebase-admin com uma Service Account. Essa chave é secreta e só existe
// como variável de ambiente no Vercel — nunca commitada (veja .gitignore).
//
// ── Variáveis de ambiente necessárias no Vercel ─────────────────────────────
//   FIREBASE_SERVICE_ACCOUNT_KEY → JSON da service account, em base64.
//     Como conseguir: Firebase Console → ⚙️ Configurações do projeto →
//     Contas de serviço → "Gerar nova chave privada" (baixa um .json).
//     Depois rode isso pra converter:
//       base64 -w0 sua-chave.json          (Linux)
//       base64 -i sua-chave.json           (macOS)
//     e cole o resultado como valor da variável.
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
//     → gerados com scripts/generate-vapid-keys.js
//   CRON_SECRET → qualquer string longa aleatória, escolhida por você.
//     Precisa bater com o header "Authorization: Bearer <CRON_SECRET>" de
//     quem chama essa rota (o cron do Vercel manda isso sozinho quando
//     CRON_SECRET está configurada; um cron EXTERNO, tipo cron-job.org,
//     precisa ser configurado manualmente pra mandar esse header).
//
// ── Por que um cron externo, além do cron do Vercel? ────────────────────────
// No plano Hobby da Vercel, cron job só roda 1x por dia — o suficiente pra
// um lembrete "prova amanhã", mas fraco demais pra "sua sessão de estudo
// começa em 15 minutos". Recomendado: cadastre esta URL de graça em
// https://cron-job.org (ou similar) pra rodar a cada 10–15 minutos, mandando
// o header Authorization acima. Mantenha também a entrada em vercel.json
// como um fallback diário caso o cron externo falhe.

const AcademicIntelligence = require('./_lib/academic-intelligence-server');

const DEDUPE_LIMIT = 500;
const SCHEDULER_LEASE_MS = 110000; // ~1m50s: evita execuções sobrepostas de cron externo a cada 1 min.

function schedulerRef(db) {
  return db.collection('system').doc('notificationScheduler');
}

async function acquireSchedulerLease(db, runId, nowMs) {
  const ref = schedulerRef(db);
  let acquired = false;
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const current = snap.exists ? (snap.data() || {}) : {};
    const lockUntil = Date.parse(String(current.lockUntil || '')) || 0;
    if (current.status === 'running' && lockUntil > nowMs && current.runId !== runId) return;
    const startedAt = new Date(nowMs).toISOString();
    tx.set(ref, {
      status: 'running',
      runId,
      startedAt,
      lockUntil: new Date(nowMs + SCHEDULER_LEASE_MS).toISOString(),
      updatedAt: startedAt,
      lastAttemptAt: startedAt
    }, { merge: true });
    acquired = true;
  });
  return acquired;
}

async function markScheduler(db, patch) {
  try {
    await schedulerRef(db).set({ ...patch, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (_) {}
}

let firebaseAdminApp = null;
function getDb() {
  const admin = require('firebase-admin');
  if (!firebaseAdminApp) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY não configurada no servidor.');
    const serviceAccount = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    firebaseAdminApp = admin.apps.length ? admin.app() : admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
  return admin.firestore();
}

function setupWebPush() {
  const webpush = require('web-push');
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    throw new Error('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT não configuradas no servidor.');
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  return webpush;
}

function telegramToken(){return process.env.TELEGRAM_BOT_TOKEN||'';}
async function sendTelegram(chatId,text){const t=telegramToken();if(!t||!chatId)return false;const r=await fetch(`https://api.telegram.org/bot${t}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chatId,text})});const j=await r.json().catch(()=>({}));if(!r.ok||!j.ok)throw new Error(j.description||`Telegram sendMessage falhou (${r.status})`);return true;}

// Datas e horários salvos pelo app (exams.data, tasks.dataLimite,
// reviews.data, sessions.data) não guardam fuso horário — vêm de campos
// <input type="date"> / type="datetime-local">, que só têm os dígitos da
// hora LOCAL do navegador de quem preencheu. Assumimos horário de
// Brasília (UTC-3, fixo, já que o Brasil não tem mais horário de verão
// desde 2019). Se algum dia o app atender fora do Brasil, isso precisa
// virar um fuso por usuário salvo no cadastro.
const FUSO_BRASIL = '-03:00';

function dateOnlyToMs(yyyyMmDd) {
  if (!yyyyMmDd) return null;
  const t = Date.parse(`${yyyyMmDd}T00:00:00${FUSO_BRASIL}`);
  return Number.isNaN(t) ? null : t;
}

// "Agora" já deslocado -3h, pra poder ler getUTCHours()/toISOString() e
// obter a hora e a data de calendário corretas em Brasília sem depender
// do fuso do servidor (Vercel roda em UTC).
function agoraBrasilia(now) {
  return new Date(now - 3 * 3600000);
}

function calcularStreakDiario(dailyLogs, hojeStr) {
  const datasComLog = new Set((dailyLogs || []).map(l => l.data));
  let streak = 0;
  const cursor = new Date(`${hojeStr}T00:00:00Z`);
  if (!datasComLog.has(hojeStr)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (datasComLog.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

function localDateTimeToMs(isoLocal) {
  if (!isoLocal) return null;
  const t = Date.parse(isoLocal.length === 16 ? `${isoLocal}:00${FUSO_BRASIL}` : isoLocal);
  return Number.isNaN(t) ? null : t;
}

// Provas, tarefas e trabalhos (tratados como "exams") não usam mais um
// único "X horas antes" configurável — mandam vários avisos fixos,
// ficando mais frequentes perto da data. Cada checkpoint tem uma janela
// de 24h pra disparar (dá folga pro cron não perder o horário certo) e
// é marcado individualmente em sentReminders, então nunca repete.
const CHECKPOINTS_DIAS = [7, 5, 3, 1, 0];
const JANELA_CHECKPOINT_MS = 24 * 3600000;

function labelDias(dias) {
  if (dias === 0) return 'é hoje';
  if (dias === 1) return 'é amanhã';
  return `em ${dias} dias`;
}

function checkpointsDevidos(itemMs, prefixo, id, tipoLabel, corpo, now, already) {
  const due = [];
  for (const dias of CHECKPOINTS_DIAS) {
    const key = `${prefixo}:${id}:${dias}d`;
    if (already.has(key)) continue;
    const triggerMs = itemMs - dias * 86400000;
    if (now >= triggerMs && now < triggerMs + JANELA_CHECKPOINT_MS) {
      due.push({ key, title: `${tipoLabel} ${labelDias(dias)}`, body: corpo });
    }
  }
  return due;
}

// Descobre quais itens de um usuário "vencem" dentro da janela de aviso e
// ainda não foram notificados.
function currentSubjectKeys(data){
  const curriculum=Array.isArray(data?.curriculum)?data.curriculum:[];
  const controlled=curriculum.filter(x=>x?.nome);
  const active=controlled.filter(x=>String(x.status||'').toLowerCase()==='cursando');
  if (active.length) return new Set(active.map(x=>String(x.nome).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()));
  const subjects=Array.isArray(data?.subjects)?data.subjects.filter(x=>x?.nome):[];
  return new Set(subjects.map(x=>String(x.nome).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()));
}
function normSubject(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
function isCurrentSubject(data,materia){
  const n=normSubject(materia); if(!n) return true;
  const keys=currentSubjectKeys(data); return !keys.size || keys.has(n);
}
function timeMin(v){const m=String(v||'').match(/^(\d{1,2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):null;}
function localParts(now){
  const p=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date(now));
  const get=t=>p.find(x=>x.type===t)?.value||'';
  const weekdayMap={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
  return {date:`${get('year')}-${get('month')}-${get('day')}`,weekday:weekdayMap[get('weekday')] ?? 0,hour:Number(get('hour')||0),minute:Number(get('minute')||0)};
}
function formatDateBR(date){const p=String(date||'').split('-');return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:String(date||'');}
function dateOffset(date,delta){const [y,m,d]=String(date).split('-').map(Number);const x=new Date(Date.UTC(y,m-1,d));x.setUTCDate(x.getUTCDate()+delta);return x.toISOString().slice(0,10);}
function scheduleForDate(data,date){
  const wd=new Date(`${date}T00:00:00Z`).getUTCDay();
  return (data.classSchedule||[]).filter(a=>Number(a?.dia)===wd&&a?.inicio&&a?.fim&&isCurrentSubject(data,a.materia)).sort((a,b)=>(timeMin(a.inicio)||0)-(timeMin(b.inicio)||0));
}
function learnedStudyProfile(data){
  const adaptive=data?.user?.adaptiveLearning&&typeof data.user.adaptiveLearning==='object'?data.user.adaptiveLearning:{};
  const windows=adaptive.preferredStudyWindows&&typeof adaptive.preferredStudyWindows==='object'?adaptive.preferredStudyWindows:{};
  const hours=Array.isArray(adaptive.preferredStudyHours)?adaptive.preferredStudyHours.map(Number).filter(Number.isFinite):[];
  const counts={manha:Number(windows.manha||0),tarde:Number(windows.tarde||0),noite:Number(windows.noite||0),madrugada:Number(windows.madrugada||0)};
  const total=Object.values(counts).reduce((a,b)=>a+b,0);
  const preferredBucket=total?Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0]:'';
  const hourCounts={}; hours.forEach(h=>{hourCounts[h]=(hourCounts[h]||0)+1;});
  const preferredHour=Object.keys(hourCounts).length?Number(Object.entries(hourCounts).sort((a,b)=>b[1]-a[1])[0][0]):null;
  const sessionMinutes=Number(adaptive.preferredSessionMinutes)||45;
  return {preferredBucket,preferredHour,sessionMinutes:Math.max(25,Math.min(90,sessionMinutes)),sampleSize:total};
}
function freeWindowNow(data,now,minMinutes=10){
  const p=localParts(now); const intervals=scheduleForDate(data,p.date).map(a=>({start:timeMin(a.inicio),end:timeMin(a.fim)})).filter(x=>x.start!=null&&x.end!=null&&x.end>x.start);
  // Sessões agendadas também ocupam o tempo do usuário. Elas não impedem o
  // lembrete da própria sessão, mas impedem que o sistema invente outra ação.
  (data.sessions||[]).filter(s=>!s?.concluida).forEach(s=>{
    const raw=String(s?.data||'');
    const date=raw.slice(0,10); const start=raw.length>=16?timeMin(raw.slice(11,16)):null;
    const duration=Number(s?.duracaoMin||s?.duracao||45);
    if(date===p.date&&start!=null&&duration>0)intervals.push({start,end:start+Math.min(180,duration)});
  });
  intervals.sort((a,b)=>a.start-b.start);
  const merged=[]; for(const x of intervals){const last=merged.at(-1);if(last&&x.start<=last.end)last.end=Math.max(last.end,x.end);else merged.push({...x});}
  const dayStart=5*60, dayEnd=23*60+30;
  let cursor=dayStart;
  const gaps=[];
  for(const x of merged){if(x.start>cursor)gaps.push({start:cursor,end:Math.min(x.start,dayEnd)});cursor=Math.max(cursor,x.end);if(cursor>=dayEnd)break;}
  if(cursor<dayEnd)gaps.push({start:cursor,end:dayEnd});
  const minute=p.hour*60+p.minute;
  const active=gaps.find(g=>minute>=g.start&&minute<g.end&&g.end-minute>=minMinutes);
  if(!active)return null;
  const learned=learnedStudyProfile(data);
  const h=p.hour;
  const bucket=h>=5&&h<12?'manha':h>=12&&h<18?'tarde':h>=18?'noite':'madrugada';
  let quality=1;
  if(active.end-active.start>=45)quality+=3; else if(active.end-active.start>=30)quality+=2; else if(active.end-active.start>=20)quality+=1;
  if(learned.preferredBucket&&learned.preferredBucket===bucket)quality+=2;
  if(learned.preferredHour!==null&&Math.abs(learned.preferredHour-h)<=1)quality+=2;
  if(h>=12&&h<14&&active.end-active.start>=30)quality+=1;
  return {date:p.date,minute,remaining:active.end-minute,quality,bucket,learned,startsAt:active.start,endsAt:active.end};
}
function todayStudyMinutes(data,date){
  const sessions=(data.sessions||[]).filter(s=>s?.concluida);
  let total=0;
  sessions.forEach(s=>{const raw=s?.data||s?.dataConclusao||s?.inicio||'';if(String(raw).slice(0,10)!==date)return;total+=Number(s?.duracaoReal??s?.duracaoMin??s?.duracao??0)||0;});
  return Math.max(0,total);
}
function smartReminderState(data){
  const state=classCaptureState(data);
  state.studyOpportunity=state.studyOpportunity&&typeof state.studyOpportunity==='object'?state.studyOpportunity:{};
  return state;
}
function studyOpportunity(data,now){
  const p=localParts(now);
  const free=freeWindowNow(data,now,20);
  if(!free)return null;
  const state=smartReminderState(data).studyOpportunity;
  const lastAt=state.lastSentAt?Date.parse(state.lastSentAt):0;
  if(lastAt&&now-lastAt<4*3600000)return null;
  const sentDate=state.lastSentDate===p.date?Number(state.sentToday||0):0;
  if(sentDate>=2)return null;

  const adaptive=data?.user?.adaptiveLearning&&typeof data.user.adaptiveLearning==='object'?data.user.adaptiveLearning:{};
  const target=Number(adaptive.dailyTargetMinutes)||0;
  const actual=todayStudyMinutes(data,p.date);
  const remainingTarget=Math.max(0,target-actual);
  const intelligence=AcademicIntelligence.analyze(data);
  const candidates=(intelligence.priorities||[]).filter(r=>{
    if(!r?.name)return false;
    if(!r.currentEvidence&&!(r.workload?.nextExam?.days!==null&&r.workload?.nextExam?.days<=7))return false;
    const days=r.workload?.nextExam?.days;
    const urgent=Number.isFinite(Number(days))&&Number(days)<=2;
    const score=Number(r.priorityScore)||0;
    return urgent||score>=35||r.learning?.weakTopics>0||r.learning?.pendingReviews>0||r.workload?.overdueTasks>0;
  });
  if(!candidates.length)return null;

  const recentCutoff=now-8*3600000;
  const recentSubjects=new Set((data.sessions||[]).filter(s=>s?.concluida).filter(s=>{const d=new Date(s?.data||s?.inicio||s?.dataConclusao||0);return !Number.isNaN(d.getTime())&&d.getTime()>=recentCutoff;}).map(s=>normSubject(s?.materia)).filter(Boolean));
  const sorted=candidates.slice().sort((a,b)=>{
    const ar=recentSubjects.has(normSubject(a.name))?1:0, br=recentSubjects.has(normSubject(b.name))?1:0;
    const ad=Number.isFinite(Number(a.workload?.nextExam?.days))?Number(a.workload.nextExam.days):999;
    const bd=Number.isFinite(Number(b.workload?.nextExam?.days))?Number(b.workload.nextExam.days):999;
    return ar-br || (b.priorityScore||0)-(a.priorityScore||0) || ad-bd;
  });
  let pick=sorted.find(r=>!recentSubjects.has(normSubject(r.name)))||sorted[0];
  if(!pick)return null;
  const urgent=Number.isFinite(Number(pick.workload?.nextExam?.days))&&pick.workload.nextExam.days<=2;
  if(remainingTarget<=10&&!urgent&&pick.priorityScore<65)return null;
  const preferred=Math.max(25,Math.min(45,Number(free.learned?.sessionMinutes)||45));
  const minutes=Math.max(20,Math.min(preferred,free.remaining));
  if(minutes<20)return null;
  let action='revisar os tópicos mais frágeis';
  if(pick.learning?.weakTopicNames?.length) action=`revisar ${pick.learning.weakTopicNames.slice(0,2).join(' e ')}`;
  else if(pick.learning?.pendingReviews>0) action='fazer as revisões pendentes';
  else if(pick.workload?.overdueTasks>0) action='resolver a tarefa atrasada';
  else if(pick.workload?.nextExam?.title) action=`preparar a próxima avaliação (${pick.workload.nextExam.title})`;
  const exam=pick.workload?.nextExam;
  const examText=exam?` A próxima avaliação é ${exam.title}${exam.days===0?' hoje':exam.days===1?' amanhã':` em ${exam.days} dias`}.`:'';
  const body=`Você está em um intervalo livre de cerca de ${Math.floor(free.remaining)} min e este horário combina com seus horários de estudo registrados. ${pick.name} está entre as prioridades atuais (score ${pick.priorityScore}).${examText} Aproveite ${minutes} min agora para ${action}.`;
  return {key:`smart-study:${p.date}:${Math.floor(p.hour*60+p.minute/30)}`,title:'🧠 Hora útil para estudar',body,quality:free.quality,studyOpportunity:{subject:pick.name,minutes,priorityScore:pick.priorityScore,freeMinutes:free.remaining,bucket:free.bucket,preferredBucket:free.learned.preferredBucket,reason:action,createdAt:new Date(now).toISOString()}};
}
function classCaptureState(data){
  const state=data.smartReminderState&&typeof data.smartReminderState==='object'?data.smartReminderState:{};
  state.classCapture=state.classCapture&&typeof state.classCapture==='object'?state.classCapture:{};
  state.review=state.review&&typeof state.review==='object'?state.review:{};
  state.studyOpportunity=state.studyOpportunity&&typeof state.studyOpportunity==='object'?state.studyOpportunity:{};
  return state;
}
function diaryExistsForClass(data,materia,date){return (data.classDiaries||[]).some(d=>String(d?.data||'').slice(0,10)===date&&normSubject(d?.materia)===normSubject(materia));}
function captureCandidates(data,now){
  const p=localParts(now), state=classCaptureState(data), candidates=[];
  for(let ago=0;ago<=7;ago++){
    const date=dateOffset(p.date,-ago);
    const classes=scheduleForDate(data,date);
    for(const aula of classes){
      const end=timeMin(aula.fim); if(end==null)continue;
      const key=`${aula.id||normSubject(aula.materia)}:${date}`;
      const record=state.classCapture[key]||{};
      if(diaryExistsForClass(data,aula.materia,date)){delete state.classCapture[key];continue;}
      const occurrenceMs=localDateTimeToMs(`${date}T${aula.fim}`); if(occurrenceMs==null||now<occurrenceMs)continue;
      const ageDays=Math.floor((Date.parse(`${p.date}T00:00:00${FUSO_BRASIL}`)-Date.parse(`${date}T00:00:00${FUSO_BRASIL}`))/86400000);
      if(ageDays>7)continue;
      const count=Number(record.count||0);
      const last=record.lastSentAt?Date.parse(record.lastSentAt):0;
      const hoursSince=last?((now-last)/3600000):999;
      let eligible=false;
      if(count===0 && ageDays===0) eligible=true;
      else if(count===1 && ageDays===0 && p.hour>=18 && hoursSince>=4) eligible=true;
      else if(count===1 && ageDays>=1) eligible=true;
      else if(count===2 && ageDays>=3) eligible=true;
      else if(count===3 && ageDays>=7) eligible=true;
      if(!eligible)continue;
      const free=freeWindowNow(data,now,10); if(!free)continue;
      // O primeiro aviso precisa ser depois da própria aula. Nos dias seguintes
      // basta estar em um intervalo livre, mas nunca depois de uma semana.
      if(ageDays===0 && p.hour*60+p.minute<end)continue;
      const reason=count===0?'primeiro horário livre após a aula':count===1?'segunda chance no mesmo dia/seguinte':count===2?'relembrando sem pressionar':'último lembrete da semana';
      candidates.push({key,title:`📚 Registre a aula de ${aula.materia}`,body:`Você teve ${aula.materia}${aula.inicio?` das ${aula.inicio} às ${aula.fim}`:''} e ainda não há Diário de Aula salvo para ${formatDateBR(date)}. ${reason}.`,captureKey:key,quality:free.quality,freeRemaining:free.remaining,count,materia:aula.materia,date});
    }
  }
  candidates.sort((a,b)=>b.quality-a.quality||a.count-b.count);
  return {candidates,state};
}
function reviewCandidates(data,now){
  const p=localParts(now), state=classCaptureState(data), due=(data.reviews||[]).filter(r=>!r?.concluida&&r?.data&&String(r.data).slice(0,10)===p.date&&isCurrentSubject(data,r.materia));
  if(!due.length)return {item:null,state};
  const free=freeWindowNow(data,now,10); if(!free)return {item:null,state};
  const fresh=due.filter(r=>{const key=`${r.id}:${p.date}`;return !state.review[key];});
  if(!fresh.length)return {item:null,state};
  const grouped=new Map();
  fresh.forEach(r=>{const k=r.materia||'Sem matéria';if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(r);});
  const lines=[]; let count=0; const keys=[];
  for(const [materia,items] of grouped){
    lines.push(`• ${materia}: ${items.slice(0,3).map(x=>x.topico||'revisão').join(', ')}`);
    items.forEach(x=>keys.push(`${x.id}:${p.date}`)); count+=items.length;
    if(lines.length>=4)break;
  }
  return {item:{key:`review-bundle:${p.date}`,title:`🔁 Revisões de hoje (${count})`,body:`Você tem conteúdo para revisar hoje, em um intervalo livre.\n${lines.join('\n')}`,reviewKeys:keys,quality:free.quality},state};
}
function findDueReminders(data, now) {
  const prefs = data?.settings?.studyReminders || {};
  const already = new Set(data.sentReminders || []);
  const due = [];
  const freeForAction=freeWindowNow(data,now,20);
  const scopedExams=(data.exams||[]).filter(e=>isCurrentSubject(data,e?.materia));
  const scopedTasks=(data.tasks||[]).filter(t=>isCurrentSubject(data,t?.materia));
  // Alertas acadêmicos que exigem uma ação só saem quando existe uma janela
  // real para agir. Assim o cron não vira uma máquina de cobranças durante aula.
  if(freeForAction){
    scopedExams.forEach(e => { if(e.concluida)return; const ms=dateOnlyToMs(e.data); if(ms==null)return; const corpo=`${e.titulo}${e.materia?` — ${e.materia}`:''}`; checkpointsDevidos(ms,'exam',e.id,'📝 Prova/trabalho',corpo,now,already).forEach(x=>due.push({...x,actionableStudy:true,freeMinutes:freeForAction.remaining})); });
    scopedTasks.forEach(t => { if(t.concluida)return; const ms=dateOnlyToMs(t.dataLimite); if(ms==null)return; const corpo=`${t.titulo}${t.materia?` — ${t.materia}`:''}`; checkpointsDevidos(ms,'task',t.id,'✅ Tarefa',corpo,now,already).forEach(x=>due.push({...x,actionableStudy:true,freeMinutes:freeForAction.remaining})); });
  }

  // Sessões agendadas continuam usando o horário configurado; são compromissos
  // explícitos e não entram no filtro de "tempo livre".
  const sessionsMinutesBefore=Number(prefs.sessionsMinutesBefore??15), FOLGA_JANELA_CURTA_MS=20*60000;
  (data.sessions||[]).filter(s=>isCurrentSubject(data,s?.materia)).forEach(s=>{
    if(s.concluida)return; const key=`session:${s.id}`; if(already.has(key))return; const ms=localDateTimeToMs(s.data); if(ms==null)return; const trigger=ms-sessionsMinutesBefore*60000-FOLGA_JANELA_CURTA_MS; if(now>=trigger&&now<ms)due.push({key,title:'📚 Sessão de estudo já já',body:`${s.materia}${s.topico?` — ${s.topico}`:''}`});
  });

  // Aula: aviso antes do início continua sendo um compromisso, portanto não
  // é bloqueado por janelas livres. O lembrete de registrar o conteúdo é outro
  // fluxo e só aparece depois da aula em uma janela livre.
  const classMinutesBefore=Number(prefs.classMinutesBefore??15), pa=localParts(now), hoje=pa.date, dia=pa.weekday;
  (data.classSchedule||[]).filter(a=>isCurrentSubject(data,a?.materia)).forEach(a=>{
    if(a.dia==null||!a.inicio)return; if(Number(a.dia)!==dia)return; const key=`aula:${a.id}:${hoje}`; if(already.has(key))return; const ms=localDateTimeToMs(`${hoje}T${a.inicio}`); if(ms==null)return; const trigger=ms-classMinutesBefore*60000-FOLGA_JANELA_CURTA_MS; if(now>=trigger&&now<ms)due.push({key,title:'🎓 Aula já já',body:`${a.materia}${a.sala?` — Sala ${a.sala}`:''}`});
  });

  // Registro de aula: no máximo 4 lembretes em até 7 dias, sempre em uma
  // janela livre. O segundo pode ocorrer no fim do mesmo dia; depois a cadência
  // desacelera para não transformar o sistema em cobrança diária.
  const capture=captureCandidates(data,now);
  const bestCapture=capture.candidates[0];
  if(bestCapture){
    const group=capture.candidates.slice(0,2);
    due.push({key:`class-capture-bundle:${pa.date}`,title:group.length>1?`📚 Registre suas aulas (${group.length})`:group[0].title,body:group.map(x=>x.body).join('\n\n'),captureRecords:group.map(x=>({key:x.captureKey,count:x.count})),quality:bestCapture.quality});
  }

  // Revisões: não avisamos 24h antes nem no dia seguinte. Só notificamos no
  // próprio dia marcado e apenas se o usuário estiver realmente em uma janela
  // livre. Vários conteúdos do mesmo momento são agrupados em uma única mensagem.
  const review=reviewCandidates(data,now);
  if(review.item){
    const captureItem=due.find(x=>Array.isArray(x.captureRecords));
    if(captureItem){
      // Uma única notificação reúne ações de aprendizagem do mesmo intervalo
      // livre. Assim o usuário não recebe uma sequência de avisos separados.
      const idx=due.indexOf(captureItem);
      due[idx]={
        key:`learning-window:${pa.date}`,
        title:'🧠 Aproveite este intervalo',
        body:`${captureItem.body}\n\n${review.item.body}`,
        captureRecords:captureItem.captureRecords,
        reviewKeys:review.item.reviewKeys,
        quality:Math.max(captureItem.quality||0,review.item.quality||0)
      };
    } else due.push(review.item);
  }

  // Oportunidade de estudo: só entra quando há uma janela livre, existe algo
  // acadêmico concreto para fazer e o sistema ainda não enviou alertas demais.
  const hasActionableStudy=due.some(x=>x.actionableStudy||x.reviewKeys||x.captureRecords||x.studyOpportunity||String(x.key||'').startsWith('session:')||String(x.key||'').startsWith('aula:')||x.focusPush);
  if(!hasActionableStudy){
    const opportunity=studyOpportunity(data,now);
    if(opportunity)due.push(opportunity);
  }

  // Diário geral continua uma vez por dia, mas só é disparado em horário livre
  // quando possível. Se não houver janela após o horário configurado, não invade
  // um bloco de aula para cobrar o usuário.
  const diaryHour=Number(prefs.diaryReminderHour??20), b=pa;
  if(!already.has(`diario:${b.date}`)&&b.hour>=diaryHour&&!due.some(x=>x.studyOpportunity)){
    const logged=(data.dailyLogs||[]).some(l=>l.data===b.date)||(data.classDiaries||[]).some(d=>d.data===b.date);
    const free=freeWindowNow(data,now,10);
    if(!logged&&free)due.push({key:`diario:${b.date}`,title:'📖 Registre seu dia',body:'Você ainda não registrou seu dia. Estou te lembrando agora porque você está em um intervalo livre.',quality:free.quality});
  }
  return due;
}
module.exports = async function handler(req, res) {
  const expected = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization || '';
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return res.status(401).json({ error: 'Não autorizado.' });
  }

  let db, webpush;
  try {
    db = getDb();
  } catch (err) {
    return res.status(503).json({ error: err.message, scheduler: 'database_unavailable' });
  }

  const now = Date.now();
  const runId = `run_${now}_${Math.random().toString(36).slice(2, 10)}`;
  const acquired = await acquireSchedulerLease(db, runId, now);
  if (!acquired) {
    await markScheduler(db, { status: 'skipped_locked', skippedAt: new Date(now).toISOString() });
    return res.status(200).json({ skipped: true, reason: 'another scheduler run is still active' });
  }

  const summary = { usersChecked: 0, notificationsSent: 0, telegramSent: 0, subscriptionsRemoved: 0, errors: [] };

  try {
    try {
      webpush = setupWebPush();
    } catch (err) {
      await markScheduler(db, { status: 'failed', runId, finishedAt: new Date().toISOString(), error: err.message, summary });
      return res.status(503).json({ error: err.message, ...summary });
    }
    // Dois conjuntos: lembretes gerais e término de foco. O segundo é
    // separado para que ativar Push para o Modo Foco não obrigue o usuário a
    // ativar todos os outros alarmes acadêmicos.
    const [generalSnapshot, focusSnapshot, telegramSnapshot] = await Promise.all([
      db.collection('users').where('settings.studyReminders.enabled', '==', true).get(),
      db.collection('users').where('settings.focusPushEnabled', '==', true).get(),
      db.collection('users').where('telegram.chatId', '>', '').get()
    ]);
    const docs = new Map();
    [...generalSnapshot.docs, ...focusSnapshot.docs, ...telegramSnapshot.docs].forEach(d => docs.set(d.id, d));

    for (const doc of docs.values()) {
      summary.usersChecked++;
      const data = doc.data();
      const subscriptions = Array.isArray(data.pushSubscriptions) ? data.pushSubscriptions : [];
      const telegram = data.telegram || {};
      const telegramEnabled = !!telegram.chatId && telegram.notificationsEnabled !== false;
      const hasPushGeneral = !!data.settings?.studyReminders?.enabled;
      const hasPushFocus = !!data.settings?.focusPushEnabled;
      if (!subscriptions.length && !telegramEnabled) continue;

      const due = [];
      if (hasPushGeneral || telegramEnabled) due.push(...findDueReminders(data, now));
      const focus = data.focusPushSchedule;
      const focusDue = !!(focus && Number(focus.targetMs) && now >= Number(focus.targetMs));
      if (focusDue && (hasPushFocus || telegramEnabled)) due.push({
        key: `focus:${focus.id}`,
        title: 'Foco concluído',
        body: `${focus.subject || 'Seu estudo'}${focus.topic ? ` — ${focus.topic}` : ''}: o bloco terminou. Você pode continuar estudando ou iniciar o descanso recomendado.`,
        focusPush: true
      });
      if (!due.length) continue;

      const stillValidSubs = [];
      const sentKeys = [];
      const telegramSentKeys = [];
      const sentPush = new Set();
      const sentTelegram = new Set();
      let focusPushSent = false;
      let focusTelegramSent = false;
      const alreadyTelegram = new Set(data.sentTelegramReminders || []);
      const alreadyPush = new Set(data.sentReminders || []);

      for (const subscription of subscriptions) {
        let subOk = true;
        for (const item of due) {
          if (alreadyPush.has(item.key)) continue;
          try {
            await webpush.sendNotification(subscription, JSON.stringify({
              title: item.title, body: item.body, url: './', tag: item.key, requireInteraction: true
            }));
            summary.notificationsSent++;
            sentPush.add(item.key);
            if (item.focusPush) focusPushSent = true;
          } catch (err) {
            if (err.statusCode === 404 || err.statusCode === 410) subOk = false;
            else summary.errors.push(`push ${doc.id}: ${err.message}`);
          }
        }
        if (subOk) stillValidSubs.push(subscription);
        else summary.subscriptionsRemoved++;
      }

      if (telegramEnabled) {
        for (const item of due) {
          if (alreadyTelegram.has(item.key)) continue;
          try {
            await sendTelegram(telegram.chatId, `SLCampus\n${item.title}\n${item.body}`);
            summary.telegramSent = (summary.telegramSent || 0) + 1;
            sentTelegram.add(item.key);
            if (item.focusPush) focusTelegramSent = true;
          } catch (err) {
            summary.errors.push(`telegram ${doc.id}: ${err.message}`);
          }
        }
      }

      sentPush.forEach(key => { if (!alreadyPush.has(key)) sentKeys.push(key); });
      sentTelegram.forEach(key => { if (!alreadyTelegram.has(key)) telegramSentKeys.push(key); });
      const mergedSent = [...(data.sentReminders || []), ...sentKeys].slice(-DEDUPE_LIMIT);
      const mergedTelegram = [...(data.sentTelegramReminders || []), ...telegramSentKeys].slice(-DEDUPE_LIMIT);
      const smartState = classCaptureState(data);
      const fullyDelivered = item => {
        const pushOk = !hasPushGeneral || sentPush.has(item.key) || alreadyPush.has(item.key);
        const tgOk = !telegramEnabled || sentTelegram.has(item.key) || alreadyTelegram.has(item.key);
        return pushOk && tgOk;
      };
      for (const item of due) {
        if (!fullyDelivered(item)) continue;
        if (item.studyOpportunity) {
          const prev=smartState.studyOpportunity||{};
          const sameDay=prev.lastSentDate===localParts(now).date;
          smartState.studyOpportunity={
            ...prev,
            lastSentAt:new Date(now).toISOString(),
            lastSentDate:localParts(now).date,
            sentToday:(sameDay?Number(prev.sentToday||0):0)+1,
            lastSubject:item.studyOpportunity.subject,
            lastMinutes:item.studyOpportunity.minutes,
            lastBucket:item.studyOpportunity.bucket,
            lastFreeMinutes:item.studyOpportunity.freeMinutes,
            lastReason:item.studyOpportunity.reason
          };
        }
        if (Array.isArray(item.captureRecords)) {
          for (const record of item.captureRecords) {
            const prev = smartState.classCapture[record.key] || {};
            smartState.classCapture[record.key] = {
              count: Number(prev.count || 0) + 1,
              firstSentAt: prev.firstSentAt || new Date().toISOString(),
              lastSentAt: new Date().toISOString()
            };
          }
        }
        if (Array.isArray(item.reviewKeys)) item.reviewKeys.forEach(k => { smartState.review[k] = new Date().toISOString(); });
      }
      smartState.classCapture = Object.fromEntries(Object.entries(smartState.classCapture).slice(-160));
      smartState.review = Object.fromEntries(Object.entries(smartState.review).slice(-250));
      const update = { sentReminders: mergedSent, sentTelegramReminders: mergedTelegram, pushSubscriptions: stillValidSubs, smartReminderState: smartState };
      // O término do foco só é encerrado no servidor depois que todos os
      // canais habilitados entregarem. Assim, se o Push falhar mas Telegram
      // funcionar (ou vice-versa), o canal que falhou ainda terá outra chance.
      if (focusDue) {
        const pushDone = !hasPushFocus || focusPushSent || alreadyPush.has(`focus:${focus.id}`);
        const telegramDone = !telegramEnabled || focusTelegramSent || alreadyTelegram.has(`focus:${focus.id}`);
        if (pushDone && telegramDone) update.focusPushSchedule = null;
      }
      await doc.ref.update(update);
    }

    await markScheduler(db, {
      status: summary.errors.length ? 'completed_with_errors' : 'ok',
      runId,
      lastRunAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      lockUntil: null,
      summary,
      error: summary.errors.length ? summary.errors.slice(0, 10).join(' | ') : null
    });
    return res.status(200).json({ ...summary, runId });
  } catch (err) {
    await markScheduler(db, {
      status: 'failed',
      runId,
      lastRunAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      lockUntil: null,
      error: err.message,
      summary
    });
    return res.status(500).json({ error: err.message, ...summary, runId });
  }
};
