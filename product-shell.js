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
      const soon=exams.filter(x=>{const dt=new Date(x.data||x.date||x.dataProva);return !isNaN(dt)&&dt>=new Date(today.getFullYear(),today.getMonth(),today.getDate())}).sort((a,b)=>new Date(a.data||a.date||a.dataProva)-new Date(b.data||b.date||b.dataProva))[0];
      const user=d.user||{};
      return `<section class="slc-study-home">
        <div class="slc-hero slc-study-hero">
          <div><span class="slc-eyebrow">CENTRAL DE ESTUDO</span><h2>Estude com um plano, não no improviso.</h2><p>O SLCampus reúne foco, revisão, materiais e suas prioridades em um único lugar.</p></div>
          <div class="slc-hero-actions"><button class="btn-primary" data-slcnavigate="foco"><i class="fas fa-play"></i> Começar estudo</button><button class="btn-secondary" data-slcnavigate="biblioteca"><i class="fas fa-book-open"></i> Abrir biblioteca</button></div>
        </div>
        <div class="slc-action-grid">
          <button class="slc-action-card" data-slcnavigate="foco"><span class="slc-action-icon blue"><i class="fas fa-bullseye"></i></span><strong>Modo Foco</strong><small>Inicie uma sessão agora</small></button>
          <button class="slc-action-card" data-slcnavigate="mentor-ia"><span class="slc-action-icon violet"><i class="fas fa-robot"></i></span><strong>O que estudar?</strong><small>Receba uma prioridade</small></button>
          <button class="slc-action-card" data-slcnavigate="biblioteca"><span class="slc-action-icon green"><i class="fas fa-layer-group"></i></span><strong>Biblioteca</strong><small>PDFs, vídeos e links</small></button>
          <button class="slc-action-card" data-slcnavigate="mapa-aprendizado"><span class="slc-action-icon amber"><i class="fas fa-map"></i></span><strong>Revisar</strong><small>${reviews.length ? reviews.length+' revisão(ões) pendente(s)' : 'Nenhuma revisão pendente'}</small></button>
        </div>
        <div class="slc-study-columns">
          <div class="card"><div class="card-header"><h3><i class="fas fa-route"></i> Próximo passo</h3></div><div class="card-body">
            ${soon?`<div class="slc-next-study"><div><span class="slc-muted">Próxima avaliação</span><strong>${esc(soon.titulo||soon.nome||soon.materia||'Avaliação')}</strong><span>${esc(soon.materia||soon.subject||'')} ${soon.data||soon.date?`• ${new Date(soon.data||soon.date||soon.dataProva).toLocaleDateString('pt-BR')}`:''}</span></div><button class="btn-primary btn-sm" data-slcnavigate="provas">Ver provas</button></div>`:`<div class="slc-empty-inline"><i class="fas fa-check-circle"></i><div><strong>Nenhuma avaliação próxima cadastrada.</strong><span>Cadastre uma prova para o planejamento ficar mais preciso.</span></div><button class="btn-secondary btn-sm" data-slcnavigate="provas">Adicionar prova</button></div>`}
          </div></div>
          <div class="card"><div class="card-header"><h3><i class="fas fa-layer-group"></i> Seu ambiente</h3></div><div class="card-body slc-study-stats">
            <div><strong>${subjects.length}</strong><span>matérias</span></div><div><strong>${tasks.length}</strong><span>tarefas abertas</span></div><div><strong>${sessions.length}</strong><span>sessões registradas</span></div>
          </div></div>
        </div>
        <div class="card slc-study-path"><div class="card-header"><h3><i class="fas fa-compass"></i> Caminho rápido</h3><span class="tag">${esc(user.perfil==='faculdade'?'Acadêmico':'Estudos')}</span></div><div class="card-body"><div class="slc-path-row"><button data-slcnavigate="materias"><i class="fas fa-book"></i><span>Matérias</span></button><i class="fas fa-chevron-right"></i><button data-slcnavigate="tarefas"><i class="fas fa-tasks"></i><span>Tarefas</span></button><i class="fas fa-chevron-right"></i><button data-slcnavigate="foco"><i class="fas fa-bullseye"></i><span>Foco</span></button><i class="fas fa-chevron-right"></i><button data-slcnavigate="estatisticas"><i class="fas fa-chart-line"></i><span>Resultado</span></button></div></div></div>
      </section>`;
    };
  }

  function navigate(view){
    if(window.app?.loadView){ window.app.loadView(view); document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===view)); }
    document.body.classList.remove('sidebar-open');
  }

  function addProfileView(){
    if(!window.ViewRenderer || ViewRenderer.prototype.renderPerfil) return;
    ViewRenderer.prototype.renderPerfil=function(){
      const u=this.app?.data?.user||{}; const a=window.auth?.currentUser;
      const initials=(u.nome||a?.displayName||'U').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();
      const perfil=u.perfil==='faculdade'?'Faculdade':u.perfil==='concurso'?'Concurso':u.perfil==='ensino_medio'?'Escola':'Estudos';
      return `<section class="slc-profile-page"><div class="slc-profile-hero"><div class="slc-avatar-xl">${esc(initials)}</div><div><span class="slc-eyebrow">MINHA CONTA</span><h2>${esc(u.nome||a?.displayName||'Usuário')}</h2><p>${esc(a?.email||'')} · ${esc(perfil)}</p></div><button class="btn-secondary" data-slcnavigate="configuracoes"><i class="fas fa-cog"></i> Configurações</button></div><div class="slc-profile-grid"><div class="card"><div class="card-header"><h3><i class="fas fa-user"></i> Perfil de estudos</h3></div><div class="card-body"><div class="slc-profile-row"><span>Perfil</span><strong>${esc(perfil)}</strong></div><div class="slc-profile-row"><span>Objetivo</span><strong>${esc(u.objetivo||u.curso||u.concurso||'Não definido')}</strong></div><div class="slc-profile-row"><span>Matérias</span><strong>${this.app?.data?.subjects?.length||0}</strong></div></div></div><div class="card"><div class="card-header"><h3><i class="fas fa-sliders-h"></i> Ações rápidas</h3></div><div class="card-body slc-profile-actions"><button data-slcnavigate="configuracoes"><i class="fas fa-user-edit"></i> Editar perfil</button><button data-slcnavigate="biblioteca"><i class="fas fa-layer-group"></i> Minha biblioteca</button><button data-slcnavigate="estatisticas"><i class="fas fa-chart-line"></i> Ver desempenho</button></div></div></div></section>`;
    };
  }

  function patchLoadView(){
    if(!window.app || window.app.__slcProductShell) return;
    const original=window.app.loadView.bind(window.app);
    window.app.loadView=function(view){
      if(view==='perfil'){
        this.currentView='perfil'; document.body.dataset.view='perfil';
        const c=document.getElementById('view-container');
        if(c && this.viewRenderer?.renderPerfil) c.innerHTML=this.viewRenderer.renderPerfil();
        this.setupViewEvents?.(view); window.aiAssistant?.updateContext(this.data); updateTitle('Perfil'); bindStudyActions(); updateActive('perfil'); return;
      }
      if(view==='estudar'){
        this.currentView='estudar'; document.body.dataset.view='estudar';
        const c=document.getElementById('view-container');
        if(c && this.viewRenderer?.renderEstudar){ c.innerHTML=this.viewRenderer.renderEstudar(); }
        this.setupViewEvents?.(view); window.aiAssistant?.updateContext(this.data); updateTitle('Estudar'); bindStudyActions(); updateActive('estudar'); return;
      }
      const r=original(view); updateTitle(titleFor(view)); updateActive(view); return r;
    };
    window.app.__slcProductShell=true;
  }
  function titleFor(v){return ({dashboard:'Início',perfil:'Perfil','estudar':'Estudar','mentor-ia':'Mentor IA',tarefas:'Tarefas',provas:'Provas e trabalhos',biblioteca:'Biblioteca',configuracoes:'Configurações',materias:'Matérias',calendario:'Calendário',foco:'Modo Foco',sessoes:'Sessões de estudo',estatisticas:'Estatísticas','grade-horaria':'Grade horária','grade-curricular':'Grade curricular','mapa-aprendizado':'Mapa de aprendizado'}[v]||'SLCampus');}
  function updateTitle(t){const e=document.getElementById('page-title');if(e)e.textContent=t;}
  function updateActive(v){document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===v));}
  function bindStudyActions(){document.querySelectorAll('[data-slcnavigate]').forEach(b=>{if(b.dataset.bound)return;b.dataset.bound='1';b.addEventListener('click',()=>navigate(b.dataset.slcnavigate));});}

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
    nav.append(section('Acompanhar'),make('estatisticas','fa-chart-line','Estatísticas'),make('grade-curricular','fa-sitemap','Grade curricular'),make('previsao-notas','fa-chart-bar','Notas e previsão'));
    nav.append(section('Conta'),make('configuracoes','fa-cog','Configurações'),make('ajuda','fa-question-circle','Ajuda'));
  }

  function mobileNav(){
    let b=document.getElementById('slc-product-bottom-nav'); if(b)return;
    b=document.createElement('nav');b.id='slc-product-bottom-nav';b.innerHTML=`<button data-v="dashboard"><i class="fas fa-house"></i><span>Início</span></button><button data-v="estudar"><i class="fas fa-compass"></i><span>Estudar</span></button><button class="primary" data-v="foco"><i class="fas fa-play"></i><span>Foco</span></button><button data-v="mentor-ia"><i class="fas fa-robot"></i><span>Mentor</span></button><button data-v="perfil"><i class="fas fa-user"></i><span>Perfil</span></button>`;
    document.body.appendChild(b); b.querySelectorAll('button').forEach(x=>x.addEventListener('click',()=>navigate(x.dataset.v)));
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

  function boot(){
    addStudyView(); addProfileView(); polishLogin(); polishSetup(); restructureNav(); mobileNav(); patchLoadView(); bindStudyActions();
    document.addEventListener('app-ready',()=>{restructureNav();mobileNav();patchLoadView();updateTitle(titleFor(window.app?.currentView||'dashboard'));});
    document.addEventListener('click',e=>{const b=e.target.closest('[data-slcnavigate]');if(b&&!b.dataset.bound){e.preventDefault();navigate(b.dataset.slcnavigate);}});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
