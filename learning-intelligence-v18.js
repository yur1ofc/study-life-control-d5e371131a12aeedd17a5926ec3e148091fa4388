/* SLCampus V18 — Adaptive Learning Brain
 * Deterministic layer for: priorities, active recall, question attempts,
 * learning-map evidence, spaced review signals, grades, exams, history and study planning.
 * It does not claim to predict grades or guarantee outcomes.
 */
(function(){
  'use strict';
  const VERSION='v18';
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const n=(v,d=0)=>{const x=Number(String(v??'').replace(',','.'));return Number.isFinite(x)?x:d;};
  const daysSince=v=>{const d=v?new Date(v):null;if(!d||Number.isNaN(d.getTime()))return 999;return Math.max(0,Math.floor((Date.now()-d.getTime())/86400000));};
  const esc=v=>window.escapeHtml?escapeHtml(v??''):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const id=()=>typeof generateId==='function'?generateId():`v18-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

  function data(){return window.app?.data||{};}
  function ensure(){
    const d=data();
    d.learningEvidence=Array.isArray(d.learningEvidence)?d.learningEvidence:[];
    d.questionAttempts=Array.isArray(d.questionAttempts)?d.questionAttempts:[];
    return d;
  }

  function currentGrades(subject){
    return (data().grades||[]).filter(g=>norm(g?.materia)===norm(subject)&&g?.valor!==undefined&&g?.valor!==null)
      .map(g=>n(g.valor,n(g.nota,null))).filter(Number.isFinite);
  }
  function subjectHistory(subject){
    try{return window.academicIntelligence?.getSubjectHistory?.({nome:subject})||[];}catch(_){return[];}
  }
  function nextExam(subject){
    const now=new Date();
    return (data().exams||[]).filter(e=>!e?.concluida&&norm(e?.materia)===norm(subject)).map(e=>({...e,_d:new Date(e.data||e.date||e.dataProva)})).filter(e=>!Number.isNaN(e._d.getTime())&&e._d>=now).sort((a,b)=>a._d-b._d)[0]||null;
  }
  function topicRows(subject){
    return (data().learningMap||[]).filter(t=>norm(t?.materia)===norm(subject));
  }
  function evidenceRows(subject){
    return (data().learningEvidence||[]).filter(e=>norm(e?.materia||e?.subject)===norm(subject));
  }
  function questionRows(subject){
    return (data().questionAttempts||[]).filter(q=>norm(q?.materia)===norm(subject));
  }

  function topicScore(t, subject){
    const conf=n(t?.confianca??t?.confidence,3);
    const diff=n(t?.dificuldade??t?.difficulty,3);
    const age=daysSince(t?.ultimaRevisao||t?.lastReviewedAt);
    const status=norm(t?.status);
    let score=(5-conf)*16+(diff-1)*5+Math.min(age,30)*0.8;
    if(['fraco','revisar','precisa revisao','estudando','pendente'].includes(status))score+=12;
    const ev=(t?.evidencias||[]).slice(-3);
    ev.forEach(e=>{if(['doubt','review'].includes(e?.level))score+=10;if(e?.level==='exercise')score+=2;if(e?.level==='explain')score-=5;});
    return Math.max(0,score);
  }

  function subjectPriority(subject){
    const name=String(subject?.nome||subject?.name||subject||'').trim();
    if(!name)return null;
    const grades=currentGrades(name);
    const avg=grades.length?grades.reduce((a,b)=>a+b,0)/grades.length:null;
    const exam=nextExam(name);
    const topics=topicRows(name);
    const weak=topics.slice().sort((a,b)=>topicScore(b,name)-topicScore(a,name));
    const reviews=(data().reviews||[]).filter(r=>!r?.concluida&&norm(r?.materia)===norm(name));
    const tasks=(data().tasks||[]).filter(t=>!t?.concluida&&norm(t?.materia)===norm(name));
    const hist=subjectHistory(name);
    const failures=hist.filter(h=>['rep','reprovado','reprovada'].includes(norm(h.status))).length;
    const ev=evidenceRows(name);
    const q=questionRows(name);
    const recentDoubts=ev.filter(e=>['doubt','review'].includes(e.level)&&daysSince(e.answeredAt)<=14).length;
    const qErrors=q.filter(x=>x.result==='erro'||x.result==='partial').filter(x=>daysSince(x.createdAt)<=30).length;
    const materials=(data().materials||[]).filter(m=>norm(m?.materia)===norm(name)).length;
    let score=0;
    if(avg!==null) score += Math.max(0,7-avg)*8;
    if(exam){const d=Math.max(0,Math.ceil((exam._d-Date.now())/86400000));score += Math.max(0,24-d*2);}
    score += Math.min(25, weak.reduce((s,t)=>s+topicScore(t,name),0)/Math.max(1,weak.length));
    score += Math.min(15,reviews.length*3);
    score += Math.min(10,tasks.length*2);
    score += Math.min(10,recentDoubts*4);
    score += Math.min(10,qErrors*2);
    score += Math.min(8,failures*2);
    const last=(data().sessions||[]).filter(s=>s?.concluida&&norm(s?.materia)===norm(name)).sort((a,b)=>new Date(b.data)-new Date(a.data))[0];
    if(last&&daysSince(last.data)>=7)score+=Math.min(8,daysSince(last.data));
    return {name,score:Math.round(Math.min(100,score)),avg,exam,topics,weak,reviews,tasks,failures,recentDoubts,qErrors,materials};
  }

  function getPlan(limit=5){
    const subjects=(data().subjects||[]).map(s=>subjectPriority(s)).filter(Boolean);
    return subjects.sort((a,b)=>b.score-a.score).slice(0,limit);
  }

  function bestTopic(){
    let best=null;
    (data().subjects||[]).forEach(s=>topicRows(s.nome).forEach(t=>{
      const score=topicScore(t,s.nome);
      if(!best||score>best.score)best={topic:t,subject:s.nome,score};
    }));
    if(best)return best;
    const p=getPlan(1)[0];
    return p?.weak?.[0]?{topic:p.weak[0],subject:p.name,score:topicScore(p.weak[0],p.name)}:null;
  }

  async function saveQuestionAttempt(payload){
    const d=ensure();
    const row={id:id(),createdAt:new Date().toISOString(),source:VERSION,...payload};
    d.questionAttempts.push(row);
    await dbService.saveData('questionAttempts',d.questionAttempts);
    const topic=(d.learningMap||[]).find(t=>norm(t?.materia)===norm(row.materia)&&norm(t?.nome)===norm(row.topico));
    if(topic){
      const before=n(topic.confianca,3);
      const delta=row.result==='acerto'?1:row.result==='partial'?0:-1;
      const next=Math.max(1,Math.min(5,before+delta));
      const status=next>=5?'dominado':next>=4?'revisando':next<=2?'estudando':'revisando';
      const ev={level:row.result==='acerto'?'exercise':row.result==='partial'?'doubt':'review',label:'Questão de recuperação ativa',confidence:next,answeredAt:row.createdAt,source:'question-engine-v18'};
      const hist=Array.isArray(topic.evidencias)?topic.evidencias.slice(-9):[];
      await dbService.updateItem('learningMap',topic.id,{confianca:next,status,ultimaRevisao:row.createdAt,ultimaEvidencia:ev,evidencias:[...hist,ev]});
      Object.assign(topic,{confianca:next,status,ultimaRevisao:row.createdAt,ultimaEvidencia:ev,evidencias:[...hist,ev]});
    }
    window.SubjectDifficulty?.recalcAll?.();
    document.dispatchEvent(new CustomEvent('slc-question-attempt',{detail:row}));
    return row;
  }

  function questionPrompts(subject,topic){
    const t=topic||'o conteúdo mais prioritário';
    return [
      {kind:'explain',q:`Sem consultar material: explique ${t} como se tivesse que ensinar para alguém da sua turma. Quais são as ideias e passos essenciais?`},
      {kind:'apply',q:`Sem olhar: qual seria um exercício típico sobre ${t} e como você resolveria? Escreva o raciocínio antes de conferir.`},
      {kind:'error',q:`Qual é o erro mais fácil de cometer em ${t}? Dê um exemplo e explique como você evitaria esse erro.`}
    ];
  }

  function openQuestions(subject,topic){
    document.getElementById('slc-v18-question-modal')?.remove();
    const prompts=questionPrompts(subject,topic);
    const modal=document.createElement('div');modal.id='slc-v18-question-modal';modal.className='modal slc-v18-question-modal';
    modal.innerHTML=`<div class="modal-content slc-v18-question-card"><div class="modal-header"><div><h2><i class="fas fa-brain"></i> Recuperação ativa</h2><p>${esc(subject)}${topic?` • ${esc(topic)}`:''}</p></div><button class="modal-close" id="v18-q-close">&times;</button></div><div class="modal-body"><div class="v18-q-progress">3 questões curtas — responda sem consultar o material.</div>${prompts.map((p,i)=>`<div class="v18-q-block" data-q="${i}"><span>Questão ${i+1}</span><strong>${esc(p.q)}</strong><textarea rows="3" maxlength="1200" placeholder="Sua resposta..."></textarea><div class="v18-q-actions"><button type="button" class="btn-secondary v18-q-result" data-result="erro">Ainda não consigo</button><button type="button" class="btn-secondary v18-q-result" data-result="partial">Parcialmente</button><button type="button" class="btn-primary v18-q-result" data-result="acerto">Consigo recuperar</button></div></div>`).join('')}<div class="modal-actions"><button class="btn-secondary" id="v18-q-close2">Fechar</button><button class="btn-primary" id="v18-q-save"><i class="fas fa-floppy-disk"></i> Salvar resultados</button></div></div></div>`;
    document.body.appendChild(modal);modal.style.display='flex';
    modal.querySelectorAll('.v18-q-result').forEach(btn=>btn.onclick=()=>{const block=btn.closest('.v18-q-block');block.dataset.result=btn.dataset.result;block.querySelectorAll('.v18-q-result').forEach(x=>x.classList.remove('selected'));btn.classList.add('selected');});
    const close=()=>modal.remove();modal.querySelector('#v18-q-close').onclick=close;modal.querySelector('#v18-q-close2').onclick=close;
    modal.querySelector('#v18-q-save').onclick=async()=>{const blocks=[...modal.querySelectorAll('.v18-q-block')];const chosen=blocks.filter(b=>b.dataset.result);if(!chosen.length){showToast?.('Marque pelo menos um resultado.','info');return;}const save=modal.querySelector('#v18-q-save');save.disabled=true;for(const b of chosen){await saveQuestionAttempt({materia:subject,topico:topic||'',question:prompts[Number(b.dataset.q)]?.q||'',answer:b.querySelector('textarea')?.value||'',result:b.dataset.result});}close();showToast?.('Resultados salvos. O Mapa de Aprendizado foi atualizado.','success');window.app?.loadView?.(window.app.currentView||'estudar');};
  }

  function openFocus(subject,topic){
    const app=window.app;if(!app)return;app.pendingFocusMateria=subject||'';app.pendingFocusTopic=topic||'';app.loadView?.('foco');
    setTimeout(()=>{const t=document.getElementById('timer-topico');if(t&&topic)t.value=topic;const s=document.getElementById('timer-materia');if(s&&subject)s.value=subject;s?.dispatchEvent(new Event('change',{bubbles:true}));},100);
  }

  function renderBrain(){
    const container=document.getElementById('view-container');if(!container||window.app?.currentView!=='estudar')return;
    const existing=document.getElementById('slc-v18-brain-card');if(existing)existing.remove();
    const plan=getPlan(4);const best=bestTopic();
    const reviews=(data().reviews||[]).filter(r=>!r?.concluida);const overdue=reviews.filter(r=>{const d=new Date(r.data);return !Number.isNaN(d)&&d<new Date(new Date().toDateString());});
    const card=document.createElement('section');card.id='slc-v18-brain-card';card.className='card slc-v18-brain-card';
    card.innerHTML=`<div class="card-header"><div><span class="slc-card-kicker">MOTOR DE APRENDIZAGEM</span><h3><i class="fas fa-brain"></i> O que vale estudar agora</h3></div><span class="v18-brain-badge">adaptativo</span></div><div class="card-body"><div class="v18-plan-grid">${plan.length?plan.map((p,i)=>`<article class="v18-plan-item"><div class="v18-plan-rank">${i+1}</div><div class="v18-plan-copy"><strong>${esc(p.name)}</strong><small>Prioridade ${p.score}/100${p.avg!==null?` • média ${p.avg.toFixed(1)}`:''}${p.exam?` • avaliação em ${Math.max(0,Math.ceil((p.exam._d-Date.now())/86400000))}d`:''}${p.materials?` • ${p.materials} material(is)`:''}</small><span>${esc(p.weak[0]?.nome|| (p.recentDoubts?'há evidência de dúvida/revisão':'revisão/questões conforme os dados disponíveis'))}</span></div><button class="btn-primary btn-sm v18-focus" data-subject="${esc(p.name)}" data-topic="${esc(p.weak[0]?.nome||'')}">Focar</button></article>`).join(''):`<div class="v18-empty">Cadastre matérias, provas ou tópicos para o motor conseguir priorizar o estudo.</div>`}</div><div class="v18-brain-actions">${best?`<button class="btn-secondary" id="v18-questions"><i class="fas fa-list-check"></i> 3 questões sobre ${esc(best.topic?.nome||best.subject)}</button>`:''}<button class="btn-secondary" id="v18-map"><i class="fas fa-map"></i> Abrir mapa</button><button class="btn-secondary" id="v18-materials"><i class="fas fa-book-open"></i> Materiais</button><button class="btn-secondary" id="v18-mentor"><i class="fas fa-robot"></i> Perguntar ao Mentor</button></div><div class="v18-brain-foot">${overdue.length?`Há <strong>${overdue.length}</strong> revisão(ões) vencida(s).`:''} A prioridade combina evidências de aprendizagem, tópicos fracos, avaliações próximas, notas, tarefas, revisões e histórico quando esses dados existem.</div></div>`;
    const anchor=container.querySelector('.slc-study-main-grid')||container.firstElementChild;anchor?.insertAdjacentElement('afterend',card);
    card.querySelectorAll('.v18-focus').forEach(b=>b.onclick=()=>openFocus(b.dataset.subject,b.dataset.topic));
    card.querySelector('#v18-questions')?.addEventListener('click',()=>openQuestions(best.subject,best.topic?.nome||''));
    card.querySelector('#v18-map')?.addEventListener('click',()=>window.app?.loadView?.('mapa-aprendizado'));
    card.querySelector('#v18-materials')?.addEventListener('click',()=>{const subject=best?.subject||plan[0]?.name||'';window.app?.loadView?.('biblioteca');setTimeout(()=>{const input=document.getElementById('resource-search');if(input&&subject){input.value=subject;input.dispatchEvent(new Event('input',{bubbles:true}));}},250);});
    card.querySelector('#v18-mentor')?.addEventListener('click',()=>{window.app?.loadView?.('mentor-ia');setTimeout(()=>{const input=document.getElementById('chat-input');if(input){input.value='O que devo estudar agora? Cruze mapa de aprendizado, evidências, questões, revisões, provas, notas e histórico.';input.focus();}},180);});
  }

  async function loadLibraryContext(){
    try{
      if(!window.ResourceLibrary?.list)return;
      const rows=await window.ResourceLibrary.list();
      window.__SLCV18LibraryContext=(rows||[]).slice(0,80).map(r=>({titulo:r.titulo,materia:r.materia,tipo:r.tipo,descricao:r.descricao,tags:r.tags||[]}));
    }catch(error){console.warn('[SLC V18] biblioteca:',error?.message||error);}
  }

  function patchMentorContext(){
    const proto=window.AIAssistant?.prototype;if(!proto||proto.__slcV18Context)return;
    if(typeof proto._buildMentorContextSnapshot!=='function')return;
    const original=proto._buildMentorContextSnapshot;
    proto._buildMentorContextSnapshot=function(){
      const base=original.call(this);const plan=getPlan(5);const qs=(data().questionAttempts||[]).slice(-12);
      const lines=['','🧠 Motor adaptativo V18:'];
      if(plan.length)plan.forEach((p,i)=>lines.push(`${i+1}. ${p.name} — prioridade ${p.score}/100${p.avg!==null?`, média ${p.avg.toFixed(1)}`:''}${p.exam?`, avaliação em ${Math.max(0,Math.ceil((p.exam._d-Date.now())/86400000))}d`:''}${p.weak[0]?`, tópico prioritário: ${p.weak[0].nome}`:''}.`));
      if(qs.length)lines.push(`Últimas evidências de questões: ${qs.slice(-6).map(q=>`${q.materia}/${q.topico||'geral'}=${q.result}`).join('; ')}.`);
      const ev=(data().learningEvidence||[]).slice(-8);if(ev.length)lines.push(`Últimas evidências de sessão: ${ev.map(e=>`${e.materia||'?'}=${e.level}`).join('; ')}.`);
      const resources=window.__SLCV18LibraryContext||[];
      if(resources.length)lines.push(`Biblioteca: ${resources.slice(0,30).map(r=>`${r.titulo}${r.materia?` (${r.materia})`:''}${r.tags?.length?` [${r.tags.join(', ')}]`:''}`).join('; ')}.`);
      return `${base}\n${lines.join('\n')}`;
    };proto.__slcV18Context=true;
  }

  function patchLoadView(){
    const proto=window.StudyLifeControl?.prototype;if(!proto||proto.__slcV18Load)return;
    const original=proto.loadView;proto.loadView=function(view,...args){const r=original.call(this,view,...args);if(view==='estudar')setTimeout(renderBrain,80);return r;};proto.__slcV18Load=true;
  }

  function init(){
    ensure();patchLoadView();patchMentorContext();loadLibraryContext();
    document.addEventListener('app-ready',()=>{ensure();loadLibraryContext();setTimeout(()=>{if(window.app?.currentView==='estudar')renderBrain();},120);});
    document.addEventListener('slc-learning-evidence-saved',()=>{ensure();if(window.app?.currentView==='estudar')setTimeout(renderBrain,80);});
    document.addEventListener('slc-question-attempt',()=>{if(window.app?.currentView==='estudar')setTimeout(renderBrain,80);});
    if(window.app?.currentView==='estudar')setTimeout(renderBrain,120);
  }
  window.SLCLearningV18={getPlan,bestTopic,openQuestions,saveQuestionAttempt,renderBrain};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else setTimeout(init,0);
})();
