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
              ${soon ? `<div class="slc-study-focus-item"><div class="slc-study-focus-icon"><i class="fas fa-graduation-cap"></i></div><div class="slc-study-focus-copy"><span>Próxima avaliação</span><strong>${esc(soon.titulo||soon.nome||soon.materia||'Avaliação')}</strong><small>${esc(soon.materia||soon.subject||'')} ${soon.data||soon.date?`• ${new Date(soon.data||soon.date||soon.dataProva).toLocaleDateString('pt-BR')}`:''}</small></div><button class="btn-primary btn-sm" data-slcnavigate="foco">Estudar</button></div>` : `<div class="slc-empty-study"><i class="fas fa-sparkles"></i><div><strong>Você ainda não tem uma próxima avaliação cadastrada.</strong><span>Use o Mentor para definir uma prioridade ou cadastre uma prova.</span></div><div class="slc-inline-actions"><button class="btn-primary btn-sm" data-slcnavigate="mentor-ia">O que estudar?</button><button class="btn-secondary btn-sm" data-slcnavigate="provas">Adicionar prova</button></div></div>`}
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

  function navigate(view){
    const app = window.app;
    let handled = false;
    if (app && typeof app.loadView === 'function') {
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
      return `<section class="slc-profile-page"><div class="slc-profile-hero"><div class="slc-avatar-xl">${esc(initials)}</div><div><span class="slc-eyebrow">MINHA CONTA</span><h2>${esc(u.nome||a?.displayName||'Usuário')}</h2><p>${esc(a?.email||'')} · ${esc(perfil)}</p></div><button class="btn-secondary" data-slcnavigate="configuracoes"><i class="fas fa-cog"></i> Configurações</button></div><div class="slc-profile-grid"><div class="card"><div class="card-header"><h3><i class="fas fa-user"></i> Perfil de estudos</h3></div><div class="card-body"><div class="slc-profile-row"><span>Perfil</span><strong>${esc(perfil)}</strong></div><div class="slc-profile-row"><span>Objetivo</span><strong>${esc(u.objetivo||u.curso||u.concurso||'Não definido')}</strong></div><div class="slc-profile-row"><span>Matérias</span><strong>${this.app?.data?.subjects?.length||0}</strong></div></div></div><div class="card"><div class="card-header"><h3><i class="fas fa-sliders-h"></i> Ações rápidas</h3></div><div class="card-body slc-profile-actions"><button data-slcnavigate="configuracoes"><i class="fas fa-user-edit"></i> Editar perfil</button><button data-slcnavigate="biblioteca"><i class="fas fa-layer-group"></i> Minha biblioteca</button><button data-slcnavigate="estatisticas"><i class="fas fa-chart-line"></i> Ver desempenho</button></div></div></div></section>`;
    };
  }

  function patchLoadView(){
    const proto = window.StudyLifeControl?.prototype;
    if (!proto || typeof proto.loadView !== 'function' || proto.__slcProductShellLoadView) return;
    const original = proto.loadView;
    proto.loadView = function(view, ...rest){
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
    const shouldShow = () => window.innerWidth <= 768 && !!document.getElementById('view-container') && !document.getElementById('login-screen')?.offsetParent && !document.getElementById('setup-screen')?.offsetParent;
    let b=document.getElementById('slc-product-bottom-nav');
    if(!shouldShow()){ b?.remove(); return; }
    if(!b){
      b=document.createElement('nav');
      b.id='slc-product-bottom-nav';
      b.setAttribute('aria-label','Navegação principal');
      b.innerHTML=`<button type="button" data-v="dashboard" aria-label="Início"><i class="fas fa-house"></i><span>Início</span></button><button type="button" data-v="estudar" aria-label="Estudar"><i class="fas fa-compass"></i><span>Estudar</span></button><button type="button" class="primary" data-v="foco" aria-label="Modo Foco"><i class="fas fa-play"></i><span>Foco</span></button><button type="button" data-v="mentor-ia" aria-label="Mentor IA"><i class="fas fa-robot"></i><span>Mentor</span></button><button type="button" data-v="perfil" aria-label="Perfil"><i class="fas fa-user"></i><span>Perfil</span></button>`;
      document.body.appendChild(b);
      b.querySelectorAll('button[data-v]').forEach(x=>x.addEventListener('click',()=>navigate(x.dataset.v)));
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

  function boot(){
    addStudyView(); addProfileView(); polishLogin(); polishSetup(); restructureNav(); mobileNav(); patchLoadView(); bindStudyActions();
    document.addEventListener('app-ready',()=>{restructureNav();patchLoadView();updateTitle(titleFor(window.app?.currentView||'dashboard'));setTimeout(mobileNav,50);});
    document.addEventListener('click',e=>{const b=e.target.closest('[data-slcnavigate]');if(b&&!b.dataset.bound){e.preventDefault();navigate(b.dataset.slcnavigate);}});
    window.addEventListener('resize',()=>mobileNav());
    document.addEventListener('visibilitychange',()=>mobileNav());
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
