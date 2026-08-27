(function(){
  'use strict';
  const DAYS=[['0','Dom'],['1','Seg'],['2','Ter'],['3','Qua'],['4','Qui'],['5','Sex'],['6','Sáb']];
  const fullDays=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=v=>window.escapeHtml?window.escapeHtml(String(v??'')):String(v??'');
  const generateIdSafe=()=>window.generateId?window.generateId():'id-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);

  function hoursToday(){
    const sessions=window.app?.data?.sessions||[];
    const today=new Date().toISOString().slice(0,10);
    const mins=sessions.filter(s=>(s.data||'').slice(0,10)===today && s.concluida).reduce((acc,s)=>acc+(parseInt(s.duracao,10)||0),0);
    return mins/60;
  }
  function progressData(){
    const planned=parseFloat(window.app?.data?.user?.horasMaximas||6);
    const done=hoursToday();
    const pct=Math.max(0,Math.min(100,Math.round((done/planned)*100)||0));
    return {planned,done,pct};
  }
  function getUpcomingTasks(){
    const tasks=(window.app?.data?.tasks||[]).filter(t=>!t.concluida);
    return tasks.sort((a,b)=>(a.dataLimite||'').localeCompare(b.dataLimite||'')).slice(0,4);
  }
  function getUpcomingExams(){
    return (window.app?.getUpcomingExams?window.app.getUpcomingExams(10):(window.app?.data?.exams||[]).filter(e=>!e.concluida)).slice(0,4);
  }
  function getNextClass(){ return window.scheduleManager?.getProximaAula?.()||null; }
  function getCurrentClass(){ return window.scheduleManager?.getAulaAtual?.()||null; }
  function getUpcomingClasses(limit){
    const sm=window.scheduleManager; if(!sm) return [];
    sm.loadAulas?.();
    const hoje=new Date();
    const diaSemana=hoje.getDay();
    const minutosAtuais=hoje.getHours()*60+hoje.getMinutes();
    const result=[];
    const aulasHoje=(sm.getAulasPorDia?sm.getAulasPorDia(diaSemana):[]).filter(a=>window.calcularDuracaoMinutos ? window.calcularDuracaoMinutos('00:00',a.inicio) > minutosAtuais : true);
    aulasHoje.forEach(a=>result.push({...a,diaOffset:0}));
    for(let i=1;i<=6 && result.length<limit;i++){
      const proximoDia=(diaSemana+i)%7;
      const aulas=sm.getAulasPorDia?sm.getAulasPorDia(proximoDia):[];
      aulas.forEach(a=>result.push({...a,diaOffset:i}));
    }
    return result.slice(0,limit);
  }
  function dueLabel(dateStr){
    if(!dateStr) return 'Sem data';
    const today=new Date(); today.setHours(0,0,0,0);
    const d=new Date(dateStr+'T00:00:00'); d.setHours(0,0,0,0);
    const diff=Math.round((d-today)/86400000);
    if(diff<0) return `Atrasada ${Math.abs(diff)}d`;
    if(diff===0) return 'Hoje';
    if(diff===1) return 'Amanhã';
    return `${diff} dias`;
  }
  function quickStudyPlan(){
    const arr=window.aiAssistant?.generateDailyPlan?.()||[];
    return arr.slice(0,4);
  }

  function renderSimpleDashboard(){
    const view=this && this.app ? this : null;
    const app=window.app; if(!app) return '<div class="card"><p class="text-secondary">Carregando dashboard...</p></div>';
    const user=app.data?.user||{};
    const current=getCurrentClass();
    const next=getNextClass();
    const proximasAulas=getUpcomingClasses(4).filter(a => !current || a.id !== current.id);
    const tasks=getUpcomingTasks();
    const exams=getUpcomingExams();
    const plan=quickStudyPlan();
    const p=progressData();
    const alerts=(app.generateAlerts?.()||[]).slice(0,3);
    const risk=(app.analyzeAcademicRisk?.()||[]).slice(0,3);
    const horas=view?.getResumoHorasEstudo ? view.getResumoHorasEstudo() : {hoje:p.done,semana:0,total:0};
    const materiasAtrasadas=view?.getMateriasAtrasadas ? view.getMateriasAtrasadas().slice(0,3) : [];
    const todayText=new Date().toLocaleDateString('pt-BR',{weekday:'long', day:'2-digit', month:'long'});
    const semAlertas = !alerts.length && !risk.length;

    return `
      <div class="dashboard-shell">
        <div class="dashboard-header">
          <div>
            <h2>Olá, ${esc(user.nome||'Estudante')} 👋</h2>
            <p>${esc(todayText)} • visão rápida do dia</p>
          </div>
        </div>

        <div class="dashboard-top-grid">
          <section class="dashboard-hero">
            <div class="dashboard-hero-top">
              <div class="dashboard-hero-title">
                <h3>${current ? `Agora: ${esc(current.materia)}` : next ? `Próxima aula: ${esc(next.materia)}` : 'Seu foco de hoje'}</h3>
                <p>${current ? `${esc(current.inicio)} - ${esc(current.fim)}${current.sala ? ` • Sala ${esc(current.sala)}` : ''}` : next ? `${fullDays[parseInt(next.dia,10)]||''} • ${esc(next.inicio)} - ${esc(next.fim)}${next.sala ? ` • Sala ${esc(next.sala)}` : ''}` : 'Cadastre aulas, tarefas ou sessões para começar a receber prioridades automáticas.'}</p>
                ${current && next ? `<p class="dashboard-hero-next"><i class="fas fa-arrow-right"></i> A seguir: ${esc(next.materia)} • ${esc(next.inicio)}${next.sala ? ` • Sala ${esc(next.sala)}` : ''}${parseInt(next.dia,10) !== new Date().getDay() ? ` • ${fullDays[parseInt(next.dia,10)]||''}` : ''}</p>` : ''}
              </div>
              <div class="dashboard-goal">
                <span>Meta do dia</span>
                <strong>${p.done.toFixed(1)}h / ${p.planned}h</strong>
                <small>${p.pct}% concluído</small>
              </div>
            </div>
            <div class="dashboard-progress">
              <div class="dashboard-progress-meta"><span>Progresso de estudo</span><span>${p.pct}%</span></div>
              <div class="progress-bar"><div class="progress-fill" style="width:${p.pct}%"></div></div>
            </div>
            <div class="dashboard-kpi-row">
              <div class="dashboard-kpi"><span>Horas hoje</span><strong>${horas.hoje.toFixed(1)}h</strong></div>
              <div class="dashboard-kpi"><span>Horas semana</span><strong>${horas.semana.toFixed(1)}h</strong></div>
              <div class="dashboard-kpi"><span>Tarefas abertas</span><strong>${(app.data?.tasks||[]).filter(t=>!t.concluida).length}</strong></div>
              <div class="dashboard-kpi"><span>Provas chegando</span><strong>${exams.length}</strong></div>
              <div class="dashboard-kpi"><span>Streak</span><strong>${esc(user.streak||0)} dias</strong></div>
              <div class="dashboard-kpi"><span>Produtividade</span><strong>${esc(app.calcularProdutividade?.()||'0%')}</strong></div>
            </div>
            <div class="quick-actions">
              <button class="btn-primary" id="quick-sessao"><i class="fas fa-clock"></i> Sessão</button>
              <button class="btn-primary" id="quick-tarefa"><i class="fas fa-tasks"></i> Tarefa</button>
              <button class="btn-primary" id="quick-prova"><i class="fas fa-graduation-cap"></i> Prova</button>
              <button class="btn-primary" id="quick-aula"><i class="fas fa-calendar-week"></i> Aula</button>
              <button class="btn-secondary" id="quick-foco"><i class="fas fa-bullseye"></i> Foco</button>
            </div>
          </section>

          <section class="dashboard-side-card">
            <div class="dashboard-section-head"><h3><i class="fas fa-list-check"></i> O que fazer hoje</h3></div>
            <div class="focus-list">
              ${(plan.length?plan:tasks.map(t=>({titulo:t.titulo,materia:t.materia,tipo:'tarefa'}))).slice(0,4).map(item=>`
                <div class="focus-item">
                  <div class="focus-item-main">
                    <strong>${esc(item.titulo||item.materia||'Prioridade')}</strong>
                    <small>${esc(item.materia||item.tipo||'Plano do dia')}</small>
                  </div>
                  <span class="tag ${item.prioridade==='alta'?'high':'medium'}">${esc(item.tipo||'hoje')}</span>
                </div>`).join('') || '<p class="text-secondary">Sem itens para hoje</p>'}
            </div>
          </section>
        </div>

        <div class="dashboard-top-grid">
          <section class="dashboard-main-card">
            <div class="dashboard-section-head"><h3><i class="fas fa-calendar-day"></i> Próximas aulas</h3></div>
            <div class="mini-list">
              ${proximasAulas.map(a=>`<div class="mini-item"><div class="mini-item-main"><strong>${esc(a.materia)}</strong><small>${a.diaOffset===0?'Hoje':a.diaOffset===1?'Amanhã':(fullDays[parseInt(a.dia,10)]||'')} • ${esc(a.inicio)} - ${esc(a.fim)}${a.sala?` • Sala ${esc(a.sala)}`:''}</small></div><span class="tag ${a.diaOffset===0?'high':'medium'}">${a.diaOffset===0?'hoje':a.diaOffset===1?'amanhã':(fullDays[parseInt(a.dia,10)]||'').slice(0,3)}</span></div>`).join('') || '<p class="text-secondary">Nenhuma aula cadastrada na grade.</p>'}
            </div>
          </section>
          <section class="dashboard-list-card">
            <div class="dashboard-section-head"><h3><i class="fas fa-tasks"></i> Entregas e provas</h3></div>
            <div class="mini-list">
              ${tasks.map(t=>`<div class="mini-item"><div class="mini-item-main"><strong>${esc(t.titulo)}</strong><small>${esc(t.materia||'Sem matéria')}</small></div><span class="tag ${((t.prioridade||'').toLowerCase()==='alta' || dueLabel(t.dataLimite).includes('Atrasada') || dueLabel(t.dataLimite)==='Hoje') ? 'high':'warning'}">${esc(dueLabel(t.dataLimite))}</span></div>`).join('')}
              ${exams.slice(0,3).map(e=>`<div class="mini-item"><div class="mini-item-main"><strong>${esc(e.titulo||e.tipo||'Avaliação')}</strong><small>${esc(e.materia||'Sem matéria')}</small></div><span class="tag warning">${esc(dueLabel(e.data))}</span></div>`).join('')}
              ${(!tasks.length && !exams.length) ? '<p class="text-secondary">Nenhuma tarefa ou prova pendente</p>' : ''}
            </div>
          </section>
        </div>

        <section class="dashboard-list-card dashboard-attention-card">
          <div class="dashboard-section-head"><h3><i class="fas fa-bell"></i> Atenção</h3></div>
          <div class="mini-list">
            ${alerts.map(a=>`<div class="mini-item"><div class="mini-item-main"><strong>${esc(a.titulo||'Alerta')}</strong><small>${esc(a.descricao||a.mensagem||'')}</small></div><span class="tag ${(a.tipo||'warning')==='danger'?'high':'warning'}">${esc(a.tipo||'alerta')}</span></div>`).join('')}
            ${risk.map(r=>`<div class="mini-item"><div class="mini-item-main"><strong>${esc(r.materia)}</strong><small>${esc(r.motivo||'Risco acadêmico')}</small></div><span class="tag ${String(r.nivel).toLowerCase().includes('alto')?'high':'warning'}">${esc(r.nivel||'risco')}</span></div>`).join('')}
            ${materiasAtrasadas.map(m=>`<div class="mini-item"><div class="mini-item-main"><strong>${esc(m.materia)}</strong><small>${m.nuncaEstudou?'Sem registro de estudo ainda':`${m.dias} dias sem estudar`}</small></div><span class="tag warning">${m.nuncaEstudou?'novo':`${m.dias}d`}</span></div>`).join('')}
            ${(semAlertas && !materiasAtrasadas.length) ? '<p class="text-secondary">Tudo sob controle por enquanto.</p>' : ''}
            </div>
          </section>
      </div>`;
  }

  function patchDashboard(){
    const wait=setInterval(()=>{
      if(window.ViewRenderer?.prototype){
        window.ViewRenderer.prototype.renderDashboard=renderSimpleDashboard;
        clearInterval(wait);
      }
    },150);
  }

  function ensureNotificationPanel(){
    // A casca do popover (cabeçalho, botão Fechar, botão Marcar como visto)
    // já é criada por script.js (ensureNotificationPopover). Aqui só
    // garantimos que o container da lista existe — sem criar um segundo
    // painel dentro do primeiro, que era o que causava o popup duplicado
    // ("Lembretes internos" dentro de "Notificações").
    let list = $('#notification-popover-list');
    if (!list && window.ensureNotificationPopoverFallback) list = window.ensureNotificationPopoverFallback();
    const markBtn = $('#mark-all-notifications-read');
    if (markBtn && !markBtn.dataset.bound) {
      markBtn.dataset.bound = '1';
      markBtn.addEventListener('click', () => { markNotificationsRead(); renderNotifications(); });
    }
    return list;
  }

  function buildNotifications(){
    const app=window.app; if(!app) return [];
    const notes=[];
    const tasks=(app.data?.tasks||[]).filter(t=>!t.concluida);
    tasks.sort((a,b)=>(a.dataLimite||'').localeCompare(b.dataLimite||''));
    tasks.slice(0,4).forEach(t=>{
      const label=dueLabel(t.dataLimite);
      notes.push({id:'task-'+t.id,title:t.titulo,text:`${t.materia||'Sem matéria'} • ${label}`,level:label.includes('Atrasada')||label==='Hoje'?'danger':'warning'});
    });
    const exams=(app.getUpcomingExams?app.getUpcomingExams(7):(app.data?.exams||[]).filter(e=>!e.concluida)).slice(0,3);
    exams.forEach(e=>notes.push({id:'exam-'+e.id,title:e.titulo||'Avaliação',text:`${e.materia||'Sem matéria'} • ${dueLabel(e.data)}`,level:'warning'}));
    // "Próxima aula" e "Meta do dia" saíram daqui: já aparecem em destaque
    // no card principal do dashboard e no briefing — repetir aqui era
    // notificação de coisa que a pessoa já estava vendo na tela.
    return notes.slice(0,8);
  }

  function notificationsKey(){
    const notes=buildNotifications();
    return 'slc-read-notes:'+notes.map(n=>n.id).join('|');
  }
  function markNotificationsRead(){ localStorage.setItem(notificationsKey(),'1'); updateNotificationBadge(); }
  function updateNotificationBadge(){
    const notes=buildNotifications();
    const unread=localStorage.getItem(notificationsKey()) ? 0 : notes.length;
    const count=$('#notification-count');
    const badge=$('#notification-badge');
    if(count) count.textContent=String(unread);
    badge?.classList.toggle('has-alert', unread>0);
  }
  function renderNotifications(){
    const list = ensureNotificationPanel();
    if (!list) return;
    const notes=buildNotifications();
    list.innerHTML=notes.length ? notes.map(n=>`<div class="notification-item" data-level="${esc(n.level)}"><div class="notification-item-main"><strong>${esc(n.title)}</strong><small>${esc(n.text)}</small></div><span class="tag ${n.level==='danger'?'high':n.level==='warning'?'warning':'success'}">${esc(n.level)}</span></div>`).join('') : '<div class="notification-empty">Sem lembretes agora.</div>';
    updateNotificationBadge();
  }

  function injectAulaEnhancements(){
    const form=$('#form-aula'); if(!form || form.dataset.launchEnhanced==='1') return; form.dataset.launchEnhanced='1';
    const colorGroup=$('#aula-cor')?.closest('.form-group');
    if(colorGroup){
      const block=document.createElement('div');
      block.className='aula-smart-section';
      block.innerHTML=`
        <h3><i class="fas fa-magic"></i> Cadastro rápido de aulas</h3>
        <p class="text-secondary" style="text-align:left;padding:0;margin-top:6px">Use vários dias de uma vez ou cole sua grade em lote.</p>
        <div class="form-group">
          <label>Repetir nos dias</label>
          <div class="aula-days-grid" id="aula-repeat-days">
            ${DAYS.slice(1,6).map(([v,l])=>`<label class="aula-day-pill"><input type="checkbox" value="${v}"> ${l}</label>`).join('')}
            <label class="aula-day-pill"><input type="checkbox" value="6"> Sáb</label>
            <label class="aula-day-pill"><input type="checkbox" value="0"> Dom</label>
          </div>
        </div>
        <div class="form-group">
          <label>Cadastro em lote por texto</label>
          <textarea id="aula-batch-text" class="aula-batch-text" placeholder="Um por linha. Ex:\nCálculo I; seg qua; 08:00; 10:00; Sala 12; Prof. Ana; Bloco A\nFísica I; ter qui; 10:00; 12:00; Lab 2; Prof. Carlos"></textarea>
          <div class="aula-inline-actions">
            <button type="button" class="btn-secondary" id="btn-aula-batch-exemplo"><i class="fas fa-copy"></i> Exemplo</button>
            <button type="button" class="btn-secondary" id="btn-aula-clear-batch"><i class="fas fa-eraser"></i> Limpar lote</button>
          </div>
          <div class="batch-help-card" style="margin-top:10px"><div class="notification-item-main"><strong>Dica</strong><small>Separadores aceitos: ponto e vírgula ou barra vertical. Dias aceitos: seg, ter, qua, qui, sex, sab, dom.</small></div></div>
        </div>`;
      colorGroup.insertAdjacentElement('beforebegin', block);
    }
    $('#btn-aula-batch-exemplo')?.addEventListener('click',()=>{
      $('#aula-batch-text').value='Cálculo I; seg qua; 08:00; 10:00; Sala 12; Prof. Ana; Bloco A\nFísica I; ter qui; 10:00; 12:00; Lab 2; Prof. Carlos';
    });
    $('#btn-aula-clear-batch')?.addEventListener('click',()=>{ $('#aula-batch-text').value=''; });
    $('#aula-materia')?.addEventListener('change',prefillAulaFromHistory);
  }

  function parseDays(raw){
    const map={seg:'1',segunda:'1',ter:'2',terça:'2',terca:'2',qua:'3',quarta:'3',qui:'4',quinta:'4',sex:'5',sexta:'5',sab:'6',sábado:'6',sabado:'6',dom:'0',domingo:'0'};
    const matches=(raw||'').toLowerCase().match(/seg(?:unda)?|ter(?:ça|ca)?|qua(?:rta)?|qui(?:nta)?|sex(?:ta)?|s[áa]b(?:ado)?|dom(?:ingo)?/g)||[];
    const vals=[...new Set(matches.map(m=>map[m]).filter(Boolean))];
    return vals;
  }
  function prefillAulaFromHistory(){
    const materia=$('#aula-materia')?.value; if(!materia||!window.app) return;
    const list=(window.app.data?.classSchedule||[]).filter(a=>a.materia===materia);
    const last=list[list.length-1];
    if(!last) return;
    if($('#aula-professor') && !$('#aula-professor').value) $('#aula-professor').value=last.professor||'';
    if($('#aula-sala') && !$('#aula-sala').value) $('#aula-sala').value=last.sala||'';
    if($('#aula-bloco') && !$('#aula-bloco').value) $('#aula-bloco').value=last.bloco||'';
    if($('#aula-cor') && (!$('#aula-cor').value || $('#aula-cor').value==='#3b82f6')) $('#aula-cor').value=last.cor||'#3b82f6';
  }

  function patchAulaSubmit(){
    const wait=setInterval(()=>{
      if(!window.StudyLifeControl?.prototype?.handleAulaSubmit) return;
      clearInterval(wait);
      const proto=window.StudyLifeControl.prototype;
      proto.handleAulaSubmit=async function(e){
        e.preventDefault();
        const base={
          materia: $('#aula-materia')?.value || '',
          dia: $('#aula-dia')?.value || '1',
          inicio: $('#aula-inicio')?.value || '',
          fim: $('#aula-fim')?.value || '',
          sala: $('#aula-sala')?.value || '',
          professor: $('#aula-professor')?.value || '',
          bloco: $('#aula-bloco')?.value || '',
          cor: $('#aula-cor')?.value || '#3b82f6'
        };
        const batchText=($('#aula-batch-text')?.value||'').trim();
        let items=[];
        if(batchText){
          batchText.split(/\n+/).map(l=>l.trim()).filter(Boolean).forEach(line=>{
            const parts=line.split(/[;|]+/).map(s=>s.trim());
            if(parts.length<4) return;
            const [materia, dayRaw, inicio, fim, sala='', professor='', bloco='']=parts;
            const dias=parseDays(dayRaw);
            dias.forEach(d=>items.push({id:generateIdSafe(), materia, dia:d, inicio, fim, sala, professor, bloco, cor:base.cor}));
          });
          if(!items.length){ window.showToast?.('Não consegui entender o lote. Use uma linha por aula no formato matéria; dias; início; fim; sala; professor; bloco', 'warning'); return; }
        } else {
          const checked=$$('#aula-repeat-days input:checked').map(i=>i.value);
          const dias=[...new Set([base.dia, ...checked])];
          if(this.editingAulaId){
            const success=await window.scheduleManager?.editAula(this.editingAulaId, base);
            if(success){ document.getElementById('modal-aula').style.display='none'; this.editingAulaId=null; this.resetModalStates(); document.dispatchEvent(new Event('aulas-atualizadas')); this.loadView('grade-horaria'); window.showToast?.('Aula atualizada com sucesso!','success'); }
            return;
          }
          items=dias.map(d=>({id:generateIdSafe(), ...base, dia:d}));
        }
        let ok=0, fail=0;
        for(const item of items){
          const success=await window.scheduleManager?.addAula(item);
          success ? ok++ : fail++;
        }
        if(ok){
          document.getElementById('modal-aula').style.display='none';
          this.editingAulaId=null; this.resetModalStates(); document.dispatchEvent(new Event('aulas-atualizadas')); this.loadView('grade-horaria');
          window.showToast?.(fail?`${ok} aula(s) salvas e ${fail} com conflito.`:`${ok} aula(s) salvas com sucesso!`,'success');
        }
      };
    },150);
  }

  function patchOpenModalAndDetail(){
    const wait=setInterval(()=>{
      if(!window.StudyLifeControl?.prototype?.openModal || !window.StudyLifeControl?.prototype?.openAulaModal) return;
      clearInterval(wait);
      const proto=window.StudyLifeControl.prototype;
      const originalOpenModal=proto.openModal;
      proto.openModal=function(type,data={}){
        originalOpenModal.call(this,type,data);
        if(type==='aula'){
          injectAulaEnhancements();
          $$('#aula-repeat-days input').forEach(i=>i.checked=false);
          const title=$('#modal-aula .modal-header h2');
          if(title) title.innerHTML=`<i class="fas fa-calendar-week"></i> ${this.editingAulaId?'Editar Aula':'Nova Aula'}`;
          if(!this.editingAulaId) $('#aula-batch-text') && ($('#aula-batch-text').value='');
          if(data?.dia && !this.editingAulaId){
            $(`#aula-repeat-days input[value="${data.dia}"]`)?.setAttribute('data-same-day','1');
          }
        }
      };
      const originalOpenAulaModal=proto.openAulaModal;
      proto.openAulaModal=function(aulaId){
        originalOpenAulaModal.call(this,aulaId);
        const aula=window.scheduleManager?.aulas?.find(a=>a.id===aulaId); if(!aula) return;
        const box=$('#modal-aula-detail .aula-detail-info'); if(!box) return;
        let actions=$('#modal-aula-detail .aula-detail-actions');
        if(!actions){
          actions=document.createElement('div');
          actions.className='aula-detail-actions';
          box.appendChild(actions);
        }
        actions.innerHTML=`<button class="btn-secondary" id="detail-duplicate-aula"><i class="fas fa-copy"></i> Duplicar horário</button><button class="btn-secondary" id="detail-edit-aula"><i class="fas fa-pen"></i> Editar aula</button>`;
        $('#detail-duplicate-aula')?.addEventListener('click',()=>{ document.getElementById('modal-aula-detail').style.display='none'; this.editingAulaId=null; this.openModal('aula',{...aula}); const title=$('#modal-aula .modal-header h2'); if(title) title.innerHTML='<i class="fas fa-copy"></i> Duplicar Aula'; });
        $('#detail-edit-aula')?.addEventListener('click',()=>{ document.getElementById('modal-aula-detail').style.display='none'; this.editarAula(aulaId); });
      };
      const originalSetupViewEvents=proto.setupViewEvents;
      proto.setupViewEvents=function(view,...rest){
        originalSetupViewEvents.call(this,view,...rest);
        if(view==='dashboard'){
          $('#quick-aula')?.addEventListener('click',()=>this.openModal('aula'));
        }
        setTimeout(()=>{ renderNotifications(); },50);
      };
    },150);
  }

  // A barra inferior mobile (#mobile-quickbar) que existia aqui foi removida:
  // duplicava o #slc-bottom-nav (ux-improvements.js), que já cobre Início,
  // Tarefas e Sessão e ainda tem Hoje e IA. Duas barras fixas na mesma tela
  // não faz sentido — ver LEIA-ISSO-RELATORIO-DA-BAGUNCA.md / limpeza de UI.

  function improveOnboarding(){
    const screen=$('#setup-screen'); const form=$('#setup-form'); if(!screen||!form||$('#quick-onboarding-card')) return;
    const card=document.createElement('div');
    card.id='quick-onboarding-card'; card.className='quick-onboarding-card';
    card.innerHTML=`<div class="dashboard-section-head"><h3><i class="fas fa-rocket"></i> Setup mais rápido</h3></div><p>Use o modo rápido para preencher só o essencial agora e ajustar o resto depois em Configurações.</p><div class="quick-onboarding-actions"><button type="button" class="btn-primary" id="setup-fast-mode">Usar configuração rápida</button><button type="button" class="btn-secondary" id="setup-toggle-advanced">Ocultar opções avançadas</button><button type="button" class="btn-secondary" id="setup-fill-student-night">Perfil estudante à noite</button></div>`;
    form.prepend(card);
    const sections=$$('.form-section',form);
    const advancedSections=sections.slice(1,3);
    const setAdvanced=(hide)=>advancedSections.forEach(s=>s.classList.toggle('setup-advanced-hidden',hide));
    $('#setup-toggle-advanced')?.addEventListener('click',()=>{
      const hide=!advancedSections[0]?.classList.contains('setup-advanced-hidden');
      setAdvanced(hide);
      $('#setup-toggle-advanced').textContent=hide?'Mostrar opções avançadas':'Ocultar opções avançadas';
    });
    $('#setup-fast-mode')?.addEventListener('click',()=>{
      setAdvanced(true);
      const semester=$('#semestre'); if(semester && !semester.value) semester.value='1';
      const turno=$('#turno-principal'); if(turno) turno.value='noite';
      const horas=$('#horas-maximas'); if(horas && !horas.value) horas.value='4';
      const sono=$('#horario-sono'); if(sono && !sono.value) sono.value='23:30 - 07:00';
      const desloc=$('#tempo-deslocamento'); if(desloc && !desloc.value) desloc.value='30';
      const rotina=$('#tipo-rotina'); if(rotina) rotina.value='so-estuda';
      window.showToast?.('Modo rápido aplicado. Preencha nome, curso, universidade e suas matérias.', 'success');
    });
    $('#setup-fill-student-night')?.addEventListener('click',()=>{
      const turno=$('#turno-principal'); if(turno) turno.value='noite';
      const horas=$('#horas-maximas'); if(horas) horas.value='5';
      const rotina=$('#tipo-rotina'); if(rotina) rotina.value='so-estuda';
      window.showToast?.('Perfil noturno aplicado.', 'success');
    });
  }

  function patchLoadViewHooks(){
    const wait=setInterval(()=>{
      if(!window.StudyLifeControl?.prototype?.loadView) return;
      clearInterval(wait);
      const proto=window.StudyLifeControl.prototype;
      const original=proto.loadView;
      proto.loadView=function(view,...rest){
        const res=original.call(this,view,...rest);
        setTimeout(()=>{ renderNotifications(); ensureNotificationPanel(); if($('#setup-screen') && getComputedStyle($('#setup-screen')).display !== 'none') improveOnboarding(); },80);
        return res;
      };
    },150);
  }

  document.addEventListener('DOMContentLoaded',()=>{
    patchDashboard(); patchAulaSubmit(); patchOpenModalAndDetail(); patchLoadViewHooks();
    setTimeout(()=>{ ensureNotificationPanel(); renderNotifications(); injectAulaEnhancements(); improveOnboarding(); },700);
  });
  document.addEventListener('app-ready',()=>{ setTimeout(()=>{ ensureNotificationPanel(); renderNotifications(); improveOnboarding(); },120); });
})();
