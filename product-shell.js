(function(){
  'use strict';
  const esc = v => (window.escapeHtml ? escapeHtml(v ?? '') : String(v ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])));

  function addStudyView(){
    if(!window.ViewRenderer || ViewRenderer.prototype.renderEstudar) return;
    ViewRenderer.prototype.renderEstudar = function(){
      const d=this.app?.data||{};
      const subjects=Array.isArray(d.subjects)?d.subjects:[];
      const tasks=Array.isArray(d.tasks)?d.tasks.filter(x=>!x.concluida&&!x.completed):[];
      const exams=Array.isArray(d.exams)?d.exams.filter(x=>!x.concluida):[];
      const reviews=Array.isArray(d.reviews)?d.reviews.filter(x=>!x.completed&&!x.concluida):[];
      const sessions=Array.isArray(d.sessions)?d.sessions:[];
      const today=new Date();
      const start=new Date(today.getFullYear(),today.getMonth(),today.getDate());
      const soon=exams.filter(x=>{const dt=new Date(x.data||x.date||x.dataProva);return !isNaN(dt)&&dt>=start})
        .sort((a,b)=>new Date(a.data||a.date||a.dataProva)-new Date(b.data||b.date||b.dataProva))[0];
      const recent=sessions.slice().sort((a,b)=>new Date(b.data||b.date||0)-new Date(a.data||a.date||0)).slice(0,3);
      const user=d.user||{};
      return `<section class="slc-study-home slc-study-v14">
        <div class="slc-study-head">
          <div><span class="slc-eyebrow">CENTRAL DE ESTUDO</span><h2>Seu espaço para estudar</h2><p>Aqui você decide <strong>como</strong> vai estudar. O Início mostra o que está acontecendo; esta área concentra as ferramentas para executar.</p></div>
          <button class="btn-primary slc-study-main-cta" data-slcnavigate="foco"><i class="fas fa-play"></i> Começar uma sessão</button>
        </div>

        <div class="slc-study-launch-grid">
          <button class="slc-study-launch primary" data-slcnavigate="foco"><span><i class="fas fa-bullseye"></i></span><div><strong>Modo Foco</strong><small>Escolha uma matéria e comece</small></div><i class="fas fa-arrow-right"></i></button>
          <button class="slc-study-launch" data-slcnavigate="mapa-aprendizado"><span><i class="fas fa-repeat"></i></span><div><strong>Revisões</strong><small>${reviews.length ? reviews.length+' pendente(s) para revisar' : 'Nenhuma pendência agora'}</small></div><i class="fas fa-arrow-right"></i></button>
          <button class="slc-study-launch" data-slcnavigate="biblioteca"><span><i class="fas fa-book-open"></i></span><div><strong>Materiais</strong><small>PDFs, vídeos, e-books e links</small></div><i class="fas fa-arrow-right"></i></button>
          <button class="slc-study-launch" data-slcnavigate="mentor-ia"><span><i class="fas fa-robot"></i></span><div><strong>Mentor IA</strong><small>Descubra o próximo passo</small></div><i class="fas fa-arrow-right"></i></button>
        </div>

        <div class="slc-study-main-grid">
          <div class="card slc-study-plan-card">
            <div class="card-header"><div><span class="slc-card-kicker">EXECUÇÃO</span><h3><i class="fas fa-list-check"></i> Seu próximo estudo</h3></div><button class="btn-secondary btn-sm" data-slcnavigate="mentor-ia">Pedir ao Mentor</button></div>
            <div class="card-body">
              ${soon ? `<div class="slc-study-focus-item"><div class="slc-study-focus-icon"><i class="fas fa-graduation-cap"></i></div><div class="slc-study-focus-copy"><span>Próxima avaliação</span><strong>${esc(soon.titulo||soon.nome||soon.materia||'Avaliação')}</strong><small>${esc(soon.materia||soon.subject||'')} ${soon.data||soon.date?`• ${new Date(soon.data||soon.date||soon.dataProva).toLocaleDateString('pt-BR')}`:''}</small></div><button class="btn-primary btn-sm" data-slcnavigate="foco" data-slcmateria="${esc(soon.materia||soon.subject||'')}">Estudar</button></div>` : `<div class="slc-empty-study"><i class="fas fa-sparkles"></i><div><strong>Você ainda não tem uma próxima avaliação cadastrada.</strong><span>Use o Mentor para definir uma prioridade ou cadastre uma prova.</span></div><div class="slc-inline-actions"><button class="btn-primary btn-sm" data-slcnavigate="mentor-ia">O que estudar?</button><button class="btn-secondary btn-sm" data-slcnavigate="provas">Adicionar prova</button></div></div>`}
              <div class="slc-study-mini-grid"><div><strong>${subjects.length}</strong><span>matérias</span></div><div><strong>${tasks.length}</strong><span>tarefas abertas</span></div><div><strong>${reviews.length}</strong><span>revisões pendentes</span></div><div><strong>${sessions.length}</strong><span>sessões registradas</span></div></div>
            </div>
          </div>

          <div class="card slc-study-recent-card">
            <div class="card-header"><div><span class="slc-card-kicker">HISTÓRICO</span><h3><i class="fas fa-clock-rotate-left"></i> Estudos recentes</h3></div><button class="btn-secondary btn-sm" data-slcnavigate="sessoes">Ver tudo</button></div>
            <div class="card-body">
              ${recent.length ? recent.map(s=>`<div class="slc-recent-study"><span class="slc-recent-icon"><i class="fas fa-book"></i></span><div><strong>${esc(s.materia||s.subject||'Sessão de estudo')}</strong><small>${esc(s.duracao||s.duration||'')} ${s.data||s.date?'• '+new Date(s.data||s.date).toLocaleDateString('pt-BR'):''}</small></div></div>`).join('') : `<div class="slc-empty-compact"><i class="fas fa-hourglass-start"></i><span>Nenhuma sessão registrada ainda.</span></div>`}
            </div>
          </div>
        </div>

        <div class="card slc-study-tools-card"><div class="card-header"><div><span class="slc-card-kicker">FERRAMENTAS</span><h3>Escolha o que precisa agora</h3></div></div><div class="card-body slc-study-tools">
          <button data-slcnavigate="materias"><i class="fas fa-book"></i><span><strong>Matérias</strong><small>Conteúdos e desempenho</small></span></button>
          <button data-slcnavigate="tarefas"><i class="fas fa-check-square"></i><span><strong>Tarefas</strong><small>O que precisa ser entregue</small></span></button>
          <button data-slcnavigate="provas"><i class="fas fa-file-signature"></i><span><strong>Provas</strong><small>Avaliações e trabalhos</small></span></button>
          <button data-slcnavigate="biblioteca"><i class="fas fa-layer-group"></i><span><strong>Biblioteca</strong><small>Seus materiais</small></span></button>
          <button data-slcnavigate="estatisticas"><i class="fas fa-chart-line"></i><span><strong>Desempenho</strong><small>Veja sua evolução</small></span></button>
        </div></div>
      </section>`;
    };
  }

  function navigate(view, options = {}){
    const app = window.app;
    if (options?.materia && app) app.pendingFocusMateria = options.materia;
    if (options?.sessionId && app) app.pendingFocusSessionId = options.sessionId;
    let handled = false;
    // Telegram é uma área própria do produto, mas não precisa entrar no
    // renderer legado. Isso também permite acessá-lo no celular pelo menu Mais.
    if (view === 'telegram' && window.slctelegram?.renderInbox) {
      window.slctelegram.renderInbox();
      if (app) { app.currentView='telegram'; document.body.dataset.view='telegram'; }
      handled = true;
    } else if (app && typeof app.loadView === 'function') {
      app.loadView(view);
      handled = true;
    } else if (app && window.StudyLifeControl?.prototype && typeof window.StudyLifeControl.prototype.loadView === 'function') {
      // Algumas camadas antigas substituem temporariamente o método na instância.
      // O método de protótipo continua sendo a fonte segura para a navegação.
      window.StudyLifeControl.prototype.loadView.call(app, view);
      handled = true;
    }
    if (handled) {
      document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===view));
      document.querySelectorAll('#slc-product-bottom-nav [data-v]').forEach(n=>n.classList.toggle('active',n.dataset.v===view));
      updateTitle(titleFor(view));
      setTimeout(mobileNav, 0);
    }
    document.body.classList.remove('sidebar-open');
  }

  function addProfileView(){
    if(!window.ViewRenderer || ViewRenderer.prototype.renderPerfil) return;
    ViewRenderer.prototype.renderPerfil=function(){
      const u=this.app?.data?.user||{}; const a=window.auth?.currentUser;
      const initials=(u.nome||a?.displayName||'U').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();
      const perfil=u.perfil==='faculdade'?'Faculdade':u.perfil==='concurso'?'Concurso':u.perfil==='ensino_medio'?'Escola':'Estudos';
      const xp=Number(u.gamification?.xp||0); const level=Number(u.gamification?.level||1); const streak=Number(u.streak||0); const goal=Number(u.dailyStudyGoalHours||3);
      const sessions=(this.app?.data?.sessions||[]).filter(s=>s?.concluida||s?.status==='concluida');
      const totalMin=sessions.reduce((n,s)=>n+(Number(s.duracaoReal||s.duracao)||0),0);
      return `<section class="slc-profile-page"><div class="slc-profile-hero"><div class="slc-avatar-xl">${esc(initials)}</div><div><span class="slc-eyebrow">MINHA CONTA</span><h2>${esc(u.nome||a?.displayName||'Usuário')}</h2><p>${esc(a?.email||'')} · ${esc(perfil)}</p></div><button class="btn-secondary" data-slcnavigate="configuracoes"><i class="fas fa-cog"></i> Configurações</button></div><div class="slc-profile-stats"><div><strong>${level}</strong><span>Nível</span></div><div><strong>${xp}</strong><span>XP</span></div><div><strong>${streak}</strong><span>Dias seguidos</span></div><div><strong>${(totalMin/60).toFixed(1)}h</strong><span>Estudadas</span></div></div><div class="slc-profile-grid"><div class="card"><div class="card-header"><h3><i class="fas fa-user-graduate"></i> Perfil acadêmico</h3></div><div class="card-body"><div class="slc-profile-row"><span>Perfil</span><strong>${esc(perfil)}</strong></div><div class="slc-profile-row"><span>Objetivo</span><strong>${esc(u.objetivo||u.curso||u.concurso||'Não definido')}</strong></div><div class="slc-profile-row"><span>Universidade</span><strong>${esc(u.universidade||'Não definida')}</strong></div><div class="slc-profile-row"><span>Semestre atual</span><strong>${esc(u.semestre||'Não definido')}</strong></div><div class="slc-profile-row"><span>Matérias ativas</span><strong>${this.app?.data?.subjects?.length||0}</strong></div><div class="slc-profile-row"><span>Meta diária</span><strong>${goal.toFixed(1)}h</strong></div></div></div><div class="card"><div class="card-header"><h3><i class="fas fa-bolt"></i> Ações rápidas</h3></div><div class="card-body slc-profile-actions"><button data-slcnavigate="configuracoes"><i class="fas fa-user-edit"></i> Editar perfil</button><button data-slcnavigate="estatisticas"><i class="fas fa-chart-line"></i> Meu desempenho</button><button data-slcnavigate="mapa-aprendizado"><i class="fas fa-map"></i> Meu mapa de aprendizado</button><button data-slcnavigate="sessoes"><i class="fas fa-clock"></i> Histórico de estudos</button><button data-slcnavigate="biblioteca"><i class="fas fa-layer-group"></i> Minha biblioteca</button></div></div></div></section>`;
    };
  }

  function patchLoadView(){
    const proto = window.StudyLifeControl?.prototype;
    if (!proto || typeof proto.loadView !== 'function' || proto.__slcProductShellLoadView) return;
    const original = proto.loadView;
    proto.loadView = function(view, ...rest){
      if (view === 'telegram' && window.slctelegram?.renderInbox) {
        this.currentView='telegram'; document.body.dataset.view='telegram'; window.slctelegram.renderInbox();
        updateTitle('Telegram'); updateActive('telegram'); mobileNav(); return;
      }
      if (view === 'perfil') {
        if (!this.viewRenderer) this.viewRenderer = new ViewRenderer(this);
        this.currentView='perfil'; document.body.dataset.view='perfil';
        const c=document.getElementById('view-container');
        if(c && this.viewRenderer?.renderPerfil) c.innerHTML=this.viewRenderer.renderPerfil();
        this.setupViewEvents?.(view); window.aiAssistant?.updateContext(this.data);
        updateTitle('Perfil'); bindStudyActions(); updateActive('perfil'); mobileNav(); return;
      }
      if (view === 'estudar') {
        if (!this.viewRenderer) this.viewRenderer = new ViewRenderer(this);
        this.currentView='estudar'; document.body.dataset.view='estudar';
        const c=document.getElementById('view-container');
        if(c && this.viewRenderer?.renderEstudar) c.innerHTML=this.viewRenderer.renderEstudar();
        this.setupViewEvents?.(view); window.aiAssistant?.updateContext(this.data);
        updateTitle('Estudar'); bindStudyActions(); updateActive('estudar'); mobileNav(); return;
      }
      const result = original.call(this, view, ...rest);
      updateTitle(titleFor(view)); updateActive(view);
      setTimeout(()=>{ bindStudyActions(); mobileNav(); }, 0);
      return result;
    };
    proto.__slcProductShellLoadView = true;
  }
  function titleFor(v){return ({dashboard:'Início',perfil:'Perfil','estudar':'Estudar','mentor-ia':'Mentor IA',telegram:'Telegram',tarefas:'Tarefas',provas:'Provas e trabalhos',biblioteca:'Biblioteca',configuracoes:'Configurações',materias:'Matérias',calendario:'Calendário',foco:'Modo Foco',sessoes:'Sessões de estudo',estatisticas:'Estatísticas','grade-horaria':'Grade horária','grade-curricular':'Grade curricular','mapa-aprendizado':'Mapa de aprendizado','diario':'Diário'}[v]||'SLCampus');}
  function updateTitle(t){const e=document.getElementById('page-title');if(e)e.textContent=t;}
  function updateActive(v){document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===v));}
  function bindStudyActions(){document.querySelectorAll('[data-slcnavigate]').forEach(b=>{if(b.dataset.bound)return;b.dataset.bound='1';b.addEventListener('click',e=>{e.preventDefault();navigate(b.dataset.slcnavigate,{materia:b.dataset.slcmateria||''});});});}

  function restructureNav(){
    const nav=document.getElementById('sidebar-nav'); if(!nav || nav.dataset.v14)return; nav.dataset.v14='1';
    const search=nav.querySelector('.ctrl-k-hint');
    nav.querySelectorAll('.nav-group').forEach(g=>g.remove());
    const old=[...nav.querySelectorAll('.nav-item')];
    old.forEach(x=>x.remove());
    const make=(view,icon,label,extra='')=>{const a=document.createElement('a');a.href='#';a.className='nav-item';a.dataset.view=view;a.innerHTML=`<i class="fas ${icon}"></i><span>${label}</span>${extra}`;a.addEventListener('click',e=>{e.preventDefault();navigate(view)});return a;};
    const section=(label)=>{const d=document.createElement('div');d.className='slc-nav-section';d.textContent=label;return d;};
    if(search)nav.append(search);
    nav.append(make('dashboard','fa-house','Início'),make('estudar','fa-compass','Estudar','<span class="nav-pill">CENTRAL</span>'),make('mentor-ia','fa-robot','Mentor IA','<span class="badge">IA</span>'));
    nav.append(section('Organizar'),make('tarefas','fa-check-square','Tarefas'),make('provas','fa-graduation-cap','Provas e trabalhos'),make('calendario','fa-calendar-alt','Calendário'),make('grade-horaria','fa-calendar-week','Grade horária'));
    nav.append(section('Aprender'),make('materias','fa-book','Matérias'),make('foco','fa-bullseye','Modo Foco'),make('sessoes','fa-clock','Sessões de estudo'),make('biblioteca','fa-layer-group','Biblioteca','<span class="nav-pill">NOVO</span>'),make('mapa-aprendizado','fa-map','Mapa de aprendizado'));
    nav.append(section('Acompanhar'),make('diario','fa-book-open','Diário'),make('estatisticas','fa-chart-line','Estatísticas'),make('grade-curricular','fa-sitemap','Grade curricular'),make('previsao-notas','fa-chart-bar','Notas e previsão'));
    nav.append(section('Conta'),make('telegram','fa-telegram-plane','Telegram','<span class="nav-pill">BOT</span>'),make('configuracoes','fa-cog','Configurações'),make('ajuda','fa-question-circle','Ajuda'));
  }

  const MOBILE_MORE_GROUPS = [
    { label:'Organizar', items:[
      ['tarefas','fa-check-square','Tarefas'],['provas','fa-graduation-cap','Provas e trabalhos'],['calendario','fa-calendar-alt','Calendário'],['grade-horaria','fa-calendar-week','Grade Horária']
    ]},
    { label:'Aprender', items:[
      ['materias','fa-book','Matérias'],['sessoes','fa-clock','Sessões de estudo'],['biblioteca','fa-layer-group','Biblioteca'],['mapa-aprendizado','fa-map','Mapa de aprendizado'],['foco','fa-bullseye','Modo Foco']
    ]},
    { label:'Acompanhar', items:[
      ['diario','fa-book-open','Diário'],['estatisticas','fa-chart-line','Estatísticas'],['grade-curricular','fa-sitemap','Grade curricular'],['previsao-notas','fa-chart-line','Notas e previsão'],['situacao-academica','fa-heartbeat','Situação acadêmica']
    ]},
    { label:'Conta', items:[
      ['telegram','fa-telegram-plane','Telegram'],['perfil','fa-user','Perfil'],['configuracoes','fa-cog','Configurações'],['ajuda','fa-question-circle','Ajuda']
    ]}
  ];

  function closeMobileMore(){
    const panel=document.getElementById('slc-mobile-more');
    panel?.classList.remove('open');
    if(panel){ panel.hidden=true; panel.setAttribute('aria-hidden','true'); }
    document.getElementById('slc-product-bottom-nav')?.classList.remove('slc-more-hidden');
    document.body.classList.remove('slc-mobile-more-open');
  }

  function openMobileMore(){
    const panel=ensureMobileMore();
    if(!panel) return;
    const bottom=document.getElementById('slc-product-bottom-nav');
    if(bottom) bottom.classList.add('slc-more-hidden');
    panel.hidden=false;
    panel.setAttribute('aria-hidden','false');
    // Force a separate frame so Safari does not leave the drawer in its closed state.
    requestAnimationFrame(()=>panel.classList.add('open'));
    document.body.classList.add('slc-mobile-more-open');
  }

  function ensureMobileMore(){
    let panel=document.getElementById('slc-mobile-more');
    if(panel) return panel;
    panel=document.createElement('aside');
    panel.id='slc-mobile-more';
    panel.hidden=true;
    panel.setAttribute('aria-hidden','true');
    panel.setAttribute('aria-label','Todas as funções do SLCampus');
    panel.innerHTML=`<div class="slc-mobile-more-backdrop" data-mobile-more-close></div><div class="slc-mobile-more-sheet" role="dialog" aria-modal="true"><div class="slc-mobile-more-head"><div><span>SL CAMPUS</span><h3>Mais funções</h3></div><button type="button" class="btn-icon" data-mobile-more-close aria-label="Fechar"><i class="fas fa-times"></i></button></div><div class="slc-mobile-more-content">${MOBILE_MORE_GROUPS.map(g=>`<section><h4>${g.label}</h4><div class="slc-mobile-more-grid">${g.items.map(([v,i,l])=>`<button type="button" data-mobile-more-view="${v}"><i class="fas ${i}"></i><span>${l}</span></button>`).join('')}</div></section>`).join('')}</div></div>`;
    document.body.appendChild(panel);
    panel.querySelectorAll('[data-mobile-more-close]').forEach(el=>el.addEventListener('click',(e)=>{e.preventDefault();e.stopPropagation();closeMobileMore();}));
    panel.querySelectorAll('[data-mobile-more-view]').forEach(el=>el.addEventListener('click',(e)=>{e.preventDefault();e.stopPropagation();const view=el.dataset.mobileMoreView;closeMobileMore();navigate(view);}));
    return panel;
  }

  function mobileNav(){
    const shouldShow = () => window.innerWidth <= 768 && !!window.app?.initialized && !!document.getElementById('view-container') && !document.getElementById('login-screen')?.offsetParent && !document.getElementById('setup-screen')?.offsetParent && document.getElementById('loading-screen')?.style.display === 'none';
    // O shell V19 é a única barra inferior. Remove qualquer barra legada que
    // possa ter sido injetada por versões anteriores.
    document.getElementById('slc-bottom-nav')?.remove();
    let b=document.getElementById('slc-product-bottom-nav');
    if(!shouldShow()){ b?.remove(); document.getElementById('slc-mobile-more')?.classList.remove('open'); return; }
    ensureMobileMore();
    if(!b){
      b=document.createElement('nav');
      b.id='slc-product-bottom-nav';
      b.setAttribute('aria-label','Navegação principal');
      b.innerHTML=`<button type="button" data-v="dashboard" aria-label="Início"><i class="fas fa-house"></i><span>Início</span></button><button type="button" data-v="estudar" aria-label="Estudar"><i class="fas fa-compass"></i><span>Estudar</span></button><button type="button" class="primary" data-v="foco" aria-label="Modo Foco"><i class="fas fa-play"></i><span>Foco</span></button><button type="button" data-v="mentor-ia" aria-label="Mentor IA"><i class="fas fa-robot"></i><span>Mentor</span></button><button type="button" data-v="__more" aria-label="Mais funções"><i class="fas fa-th-large"></i><span>Mais</span></button>`;
      document.body.appendChild(b);
      b.querySelectorAll('button[data-v]').forEach(x=>{
        const go=(e)=>{
          if(e){ e.preventDefault(); e.stopPropagation(); }
          if(x.dataset.v==='__more'){ openMobileMore(); } else { navigate(x.dataset.v); }
        };
        x.onclick=(e)=>go(e);
        x.addEventListener('pointerdown',e=>{
          if(e.pointerType==='touch'){ e.preventDefault(); e.stopPropagation(); }
        }, {passive:false});
        x.addEventListener('pointerup',e=>{
          if(e.pointerType==='touch') go(e);
        }, {passive:false});
        x.addEventListener('touchend',e=>go(e), {passive:false});
      });
    }
    b.style.display='grid';
    b.querySelectorAll('button[data-v]').forEach(x=>x.classList.toggle('active', x.dataset.v===window.app?.currentView));
  }

  function polishLogin(){
    const s=document.getElementById('login-screen');if(!s||s.dataset.v14)return;s.dataset.v14='1';
    const h=s.querySelector('.login-header h1');if(h)h.textContent='Seu espaço para estudar melhor.';
    const p=s.querySelector('.login-header p');if(p)p.textContent='Planeje, estude e acompanhe sua evolução em um só lugar.';
    const hint=s.querySelector('.login-cta-hint');if(hint)hint.textContent='Entre com sua conta Google. Você não precisa preencher formulários.';
  }

  function polishSetup(){
    const s=document.getElementById('setup-screen');if(!s)return;s.classList.add('slc-onboarding-shell');
  }

  function requestServiceWorkerUpdate(){
    try{
      if(navigator.serviceWorker?.getRegistration){
        navigator.serviceWorker.getRegistration().then(reg=>reg?.update?.()).catch(()=>{});
      }
    }catch(e){}
  }

  function boot(){
    requestServiceWorkerUpdate();
    addStudyView(); addProfileView(); polishLogin(); polishSetup(); restructureNav(); mobileNav(); patchLoadView(); bindStudyActions();
    document.addEventListener('app-ready',()=>{restructureNav();patchLoadView();updateTitle(titleFor(window.app?.currentView||'dashboard'));setTimeout(mobileNav,50);});
    document.addEventListener('click',e=>{const b=e.target.closest('[data-slcnavigate]');if(b&&!b.dataset.bound){e.preventDefault();navigate(b.dataset.slcnavigate);}});
    // Fallback robusto para Safari/iOS: o botão Mais é tratado por delegação no documento.
    if(!document.body.dataset.slcMoreDelegation){
      document.body.dataset.slcMoreDelegation='1';
      const handleMore=(e)=>{
        const target=e.target && e.target.closest ? e.target.closest('#slc-product-bottom-nav button[data-v="__more"]') : null;
        if(!target) return;
        e.preventDefault(); e.stopPropagation();
        openMobileMore();
      };
      document.addEventListener('click',handleMore,true);
      document.addEventListener('pointerup',e=>{ if(e.pointerType==='touch') handleMore(e); },{capture:true,passive:false});
      document.addEventListener('touchend',handleMore,{capture:true,passive:false});
    }
    window.addEventListener('resize',()=>mobileNav());
    document.addEventListener('visibilitychange',()=>mobileNav());
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
