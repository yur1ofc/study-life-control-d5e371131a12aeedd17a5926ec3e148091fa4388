(function () {
  'use strict';

  function el(id) { return document.getElementById(id); }
  function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
  function deviceKind() {
    const w = window.innerWidth;
    if (w <= 768) return 'mobile';
    if (w <= 1100) return 'tablet';
    return 'desktop';
  }

  const HELP_SECTIONS = [
    { icon:'🏠', title:'Início', body:'Seu painel muda de acordo com o seu perfil. Ele reúne o que merece atenção agora, próximas atividades, progresso e atalhos para agir.' },
    { icon:'🧭', title:'Estudar', body:'É a área de execução. Use o Modo Foco, revisões, materiais e o histórico de sessões para transformar planejamento em estudo de verdade.' },
    { icon:'🤖', title:'Mentor IA', body:'Pergunte o que estudar, como está seu desempenho, o que fazer agora, como organizar o dia ou por que uma prioridade apareceu. O Mentor usa os dados do seu perfil e do seu histórico.' },
    { icon:'🧠', title:'Mapa e evidências de aprendizagem', body:'Registre tópicos, confiança e o que conseguiu explicar ou resolver. Isso ajuda o sistema a diferenciar tempo estudado de aprendizagem demonstrada.' },
    { icon:'📅', title:'Agenda e rotina', body:'A grade de horários, sessões e compromissos ajudam o SLCampus a identificar quando você está ocupado e quando existe uma janela real para estudar.' },
    { icon:'📝', title:'Tarefas e avaliações', body:'Cadastre entregas, provas, trabalhos, simulados e outros prazos. Eles alimentam planejamento, alertas e recomendações.' },
    { icon:'📚', title:'Materiais e cursos', body:'Centralize PDFs, links, vídeos e outros recursos. O sistema pode usar os materiais cadastrados como parte do contexto das recomendações.' },
    { icon:'📈', title:'Desempenho e evolução', body:'Acompanhe horas, sessões, revisões, notas quando disponíveis, consistência e mudanças ao longo do tempo.' },
    { icon:'🔔', title:'Notificações inteligentes', body:'O SLCampus não precisa avisar a cada mudança. O scheduler considera sua agenda, janelas livres, prioridades e o seu histórico de horários para tentar falar quando a ação ainda é útil.' },
    { icon:'📱', title:'Telegram', body:'Quando sua conta está vinculada, o Telegram funciona como outra entrada para o mesmo contexto. Você pode consultar agenda, tarefas, provas, estudos e conversar com o Mentor.' },
    { icon:'🎮', title:'Gamificação', body:'Sessões, tarefas e outras atividades podem gerar XP, níveis, sequência e conquistas. A gamificação acompanha a execução, sem substituir o planejamento.' },
    { icon:'👤', title:'Perfil e personalização', body:'Escolha entre Faculdade/Universidade, Concurso Público, Escola ou Curso/Estudo Livre. O sistema muda linguagem, atalhos e prioridades de acordo com o contexto.' }
  ];

  const SUGGESTIONS = [
    'O que eu deveria estudar agora?',
    'Como estou evoluindo?',
    'Tenho alguma pendência importante?',
    'Tenho 40 minutos. O que faço?',
    'Qual assunto devo revisar primeiro?',
    'O que está me atrapalhando?',
    'Como está minha preparação?'
  ];

  // O tutorial é realmente diferente por plataforma.
  // Celular: usa a barra inferior e o drawer Mais.
  // Computador (PC, notebook e iPad/Safari): usa somente a navegação lateral.
  const MOBILE_STEPS = [
    { id:'home', title:'Seu Início', text:'Aqui fica a visão rápida do que merece atenção. O conteúdo se adapta ao seu perfil: faculdade, concurso, escola ou curso/estudo livre.', target:'home' },
    { id:'study', title:'Área Estudar', text:'Na barra inferior você encontra a área Estudar. É onde o planejamento vira sessão de estudo.', target:'study' },
    { id:'mentor', title:'Mentor IA', text:'Use perguntas naturais. O Mentor cruza seus dados atuais, aprendizagem, prazos e histórico para responder dentro do seu contexto.', target:'mentor' },
    { id:'focus', title:'Modo Foco', text:'Quando você realmente vai estudar, comece uma sessão. Ao terminar, registre o resultado para alimentar a aprendizagem do sistema.', target:'focus' },
    { id:'notifications', title:'Notificações', text:'O sino reúne alertas. As notificações inteligentes também respeitam seus horários ocupados e procuram janelas em que você ainda consegue agir.', target:'notifications' },
    { id:'more', title:'Mais funções', text:'A barra inferior concentra os atalhos principais e o botão Mais abre o restante das funções do SLCampus.', target:'more' },
    { id:'learning', title:'Aprendizagem', text:'Mapa, revisões e evidências ajudam o sistema a entender não só quanto você estudou, mas onde ainda precisa recuperar conhecimento.', target:'learning' },
    { id:'organization', title:'Organização', text:'Tarefas, avaliações, agenda e materiais formam a parte operacional. Cadastre os prazos para que as recomendações tenham dados reais.', target:'organization' },
    { id:'profile', title:'Seu perfil', text:'Em Perfil, você pode ajustar seu contexto e rotina. A escolha do perfil muda a experiência para o tipo de estudo que você realmente faz.', target:'profile' },
    { id:'help', title:'Central de Ajuda', text:'Quando precisar, volte aqui. Você pode rever este tutorial e abrir perguntas prontas para o Mentor.', target:'help' }
  ];

  const DESKTOP_STEPS = [
    { id:'home', title:'Seu Início', text:'Aqui fica a visão rápida do que merece atenção. O conteúdo se adapta ao seu perfil: faculdade, concurso, escola ou curso/estudo livre.', target:'home' },
    { id:'study', title:'Área Estudar', text:'No computador você encontra essa área na navegação lateral. É onde o planejamento vira sessão de estudo.', target:'study' },
    { id:'mentor', title:'Mentor IA', text:'Use perguntas naturais. O Mentor cruza seus dados atuais, aprendizagem, prazos e histórico para responder dentro do seu contexto.', target:'mentor' },
    { id:'focus', title:'Modo Foco', text:'Quando você realmente vai estudar, comece uma sessão. Ao terminar, registre o resultado para alimentar a aprendizagem do sistema.', target:'focus' },
    { id:'notifications', title:'Notificações', text:'O sino reúne alertas. As notificações inteligentes também respeitam seus horários ocupados e procuram janelas em que você ainda consegue agir.', target:'notifications' },
    { id:'organization', title:'Organização', text:'Na navegação lateral você encontra tarefas, provas, calendário e outras ferramentas para organizar sua rotina acadêmica.', target:'organization' },
    { id:'learning', title:'Aprendizagem', text:'O Mapa de Aprendizado, revisões e evidências ajudam o sistema a entender não só quanto você estudou, mas onde ainda precisa recuperar conhecimento.', target:'learning' },
    { id:'profile', title:'Seu perfil', text:'Em Configurações, você pode ajustar seu contexto e rotina. A escolha do perfil muda a experiência para o tipo de estudo que você realmente faz.', target:'profile' },
    { id:'telegram', title:'Telegram', text:'O Telegram funciona como outra entrada para o mesmo contexto do SLCampus. Quando vinculado, ele pode consultar sua agenda, tarefas, provas e estudos.', target:'telegram' },
    { id:'help', title:'Central de Ajuda', text:'Na navegação lateral você pode voltar à Central de Ajuda para rever este tutorial e abrir perguntas prontas para o Mentor.', target:'help' }
  ];

  function currentSteps(){ return deviceKind()==='mobile' ? MOBILE_STEPS : DESKTOP_STEPS; }
  function currentStep(){ return currentSteps()[SiteTutorial.index]; }


  // Cada etapa possui uma composição própria do balão. A ideia é não tentar
  // encaixar todos os passos na mesma posição: alvos diferentes exigem áreas,
  // tamanhos e setas diferentes.
  const TUTORIAL_LAYOUTS = {
    mobile: {
      home:         { mode:'bottom-nav', width:'full',    arrow:'bottom' },
      study:        { mode:'bottom-nav', width:'full',    arrow:'bottom' },
      mentor:       { mode:'bottom-nav', width:'full',    arrow:'bottom' },
      focus:        { mode:'bottom-nav', width:'full',    arrow:'bottom' },
      notifications:{ mode:'auto',       width:'compact', arrow:'auto'   },
      more:         { mode:'bottom-nav', width:'full',    arrow:'bottom' },
      learning:     { mode:'drawer',     width:'full',    arrow:'top',   targetTop:110 },
      organization: { mode:'drawer',     width:'full',    arrow:'top',   targetTop:110 },
      profile:      { mode:'drawer',     width:'full',    arrow:'top',   targetTop:110 },
      help:         { mode:'drawer',     width:'full',    arrow:'top',   targetTop:110 }
    },
    desktop: {
      home:         { mode:'sidebar', width:360, arrow:'left',  offset:18 },
      study:        { mode:'sidebar', width:390, arrow:'left',  offset:18 },
      mentor:       { mode:'sidebar', width:400, arrow:'left',  offset:18 },
      focus:        { mode:'sidebar', width:360, arrow:'left',  offset:18 },
      notifications:{ mode:'header',  width:350, arrow:'bottom', offset:16 },
      organization: { mode:'sidebar', width:380, arrow:'left',  offset:18 },
      learning:     { mode:'sidebar', width:400, arrow:'left',  offset:18 },
      profile:      { mode:'sidebar', width:360, arrow:'left',  offset:18 },
      telegram:     { mode:'sidebar', width:390, arrow:'left',  offset:18 },
      help:         { mode:'sidebar', width:360, arrow:'left',  offset:18 }
    }
  };

  function layoutFor(step){
    const device=deviceKind()==='mobile'?'mobile':'desktop';
    return TUTORIAL_LAYOUTS[device]?.[step.target] || (device==='mobile'
      ? {mode:'auto',width:'full',arrow:'auto'}
      : {mode:'sidebar',width:380,arrow:'left',offset:18});
  }

  function findVisibleNavItem(label) {
    const wanted = String(label || '').trim().toLocaleLowerCase('pt-BR');
    const nodes = [...document.querySelectorAll('#sidebar-nav .nav-item, .sidebar .nav-item, [data-view]')];
    return nodes.find(node => {
      const r = node.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      if (node.closest('#slc-mobile-more') && deviceKind() !== 'mobile') return false;
      const text = (node.innerText || node.textContent || '').replace(/\s+/g,' ').trim().toLocaleLowerCase('pt-BR');
      return text === wanted || text.includes(wanted);
    }) || null;
  }

  function targetFor(kind) {
    const mobile = deviceKind() === 'mobile';
    const selectors = {
      home: mobile ? '#slc-product-bottom-nav [data-v="dashboard"]' : '[data-view="dashboard"]',
      study: mobile ? '#slc-product-bottom-nav [data-v="estudar"]' : '[data-view="estudar"]',
      mentor: mobile ? '#slc-product-bottom-nav [data-v="mentor-ia"]' : '[data-view="mentor-ia"]',
      focus: mobile ? '#slc-product-bottom-nav [data-v="foco"]' : '[data-view="foco"]',
      notifications: '[data-tutorial="notification-button"], #notification-badge, #notification-button',
      more: mobile ? '#slc-product-bottom-nav [data-v="__more"]' : null,
      learning: mobile ? '#slc-mobile-more [data-mobile-more-view="mapa-aprendizado"]' : '[data-view="mapa-aprendizado"]',
      organization: mobile ? '#slc-mobile-more [data-mobile-more-view="tarefas"]' : '[data-view="tarefas"]',
      profile: mobile ? '#slc-mobile-more [data-mobile-more-view="perfil"], #slc-mobile-more [data-mobile-more-view="configuracoes"]' : '[data-view="configuracoes"], [data-slcnavigate="configuracoes"]',
      help: mobile ? '#slc-mobile-more [data-mobile-more-view="ajuda"]' : '[data-view="ajuda"]',
      telegram: mobile ? '#slc-mobile-more [data-mobile-more-view="telegram"]' : '[data-view="telegram"]'
    };
    return selectors[kind] || selectors.home;
  }

  function resolveTarget(step) {
    const mobile = deviceKind() === 'mobile';
    const direct = targetFor(step.target);
    if (direct) {
      const node = document.querySelector(direct);
      if (node) {
        const r=node.getBoundingClientRect();
        if(r.width>0 && r.height>0) return node;
      }
    }
    if (mobile) {
      const byText = {
        learning:'Mapa de aprendizado',
        organization:'Tarefas',
        profile:'Perfil',
        help:'Ajuda',
        telegram:'Telegram'
      };
      return findVisibleNavItem(byText[step.target]);
    }
    const byText = {
      home:'Início',
      study:'Estudar',
      mentor:'Mentor IA',
      focus:'Modo Foco',
      organization:'Tarefas',
      learning:'Mapa de aprendizado',
      profile:'Configurações',
      telegram:'Telegram',
      help:'Ajuda'
    };
    return findVisibleNavItem(byText[step.target]) ||
      (step.target === 'notifications' ? document.querySelector('[data-tutorial="notification-button"], #notification-badge, #notification-button') : null);
  }

  function assignTargets() {
    const mapping = [
      ['[data-view="dashboard"]','nav-dashboard'],
      ['[data-view="estudar"]','nav-estudar'],
      ['[data-view="mentor-ia"]','nav-mentor'],
      ['[data-view="foco"]','nav-foco'],
      ['[data-view="ajuda"]','nav-ajuda'],
      ['#notification-badge, #notification-button','notification-button'],
      ['[data-view="mapa-aprendizado"]','nav-mapa'],
      ['[data-view="tarefas"]','nav-tarefas'],
      ['[data-view="configuracoes"], [data-slcnavigate="configuracoes"]','nav-config'],
      ['[data-view="perfil"]','nav-perfil']
    ];
    mapping.forEach(([selector,name]) => document.querySelector(selector)?.setAttribute('data-tutorial', name));
  }

  function ensureOverlay() {
    let overlay = el('tutorial-overlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'tutorial-overlay';
    overlay.className = 'tutorial-overlay';
    overlay.innerHTML = `
      <div class="tutorial-backdrop"><i class="tutorial-backdrop-top"></i><i class="tutorial-backdrop-left"></i><i class="tutorial-backdrop-right"></i><i class="tutorial-backdrop-bottom"></i><i class="tutorial-target-blocker"></i></div>
      <div class="tutorial-spotlight"></div>
      <div class="tutorial-card" id="tutorial-card" role="dialog" aria-modal="true" aria-live="polite">
        <div class="tutorial-progress"><span id="tutorial-progress-text"></span><button class="tutorial-skip" id="tutorial-skip" type="button">Pular</button></div>
        <div class="tutorial-device-note" id="tutorial-device-note"></div>
        <div class="tutorial-card-arrow" id="tutorial-card-arrow"></div>
        <h3 id="tutorial-title"></h3><p id="tutorial-text"></p>
        <div class="tutorial-actions"><button class="btn-secondary" id="tutorial-prev" type="button">Voltar</button><button class="btn-primary" id="tutorial-next" type="button">Próximo</button></div>
      </div>`;
    document.body.appendChild(overlay);
    return overlay;
  }

  function markNavActive(view) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === view));
    document.querySelectorAll('#slc-product-bottom-nav [data-v]').forEach(item => item.classList.toggle('active', item.dataset.v === view));
  }

  function renderHelpPage() {
    const profile = window.SLCProfileExperience?.getProfileMeta?.() || {label:'Seu perfil', description:'A experiência se adapta ao seu objetivo.'};
    const sections = HELP_SECTIONS.map(s => `<article class="help-card-pro"><div class="help-card-icon">${s.icon}</div><div><h3>${s.title}</h3><p>${s.body}</p></div></article>`).join('');
    const suggestions = SUGGESTIONS.map(q => `<button class="help-chip" data-help-question="${q.replace(/"/g,'&quot;')}">${q}</button>`).join('');
    return `
      <div class="view-header"><h2><i class="fas fa-circle-question"></i> Central de Ajuda</h2><div class="help-header-actions"><button class="btn-primary" id="btn-start-tutorial"><i class="fas fa-wand-magic-sparkles"></i> Tutorial guiado</button></div></div>
      <div class="help-hero-card"><div><span class="tag">Experiência personalizada</span><h3>Entenda o SLCampus sem precisar decorar tudo</h3><p>${profile.description}</p></div><div class="help-profile-chip"><span>Perfil atual</span><strong>${profile.label}</strong></div></div>
      <div class="help-grid">${sections}</div>
      <div class="card"><div class="card-header"><h3><i class="fas fa-robot"></i> Pergunte ao Mentor</h3></div><div class="card-body"><p class="text-secondary">Escolha uma pergunta ou escreva do seu jeito. O contexto do seu perfil é levado em conta.</p><div class="help-chip-list">${suggestions}</div></div></div>
      <div class="card help-shortcuts"><div class="card-header"><h3><i class="fas fa-compass"></i> Atalhos</h3></div><div class="card-body"><div class="help-shortcut-grid"><button data-help-view="dashboard"><i class="fas fa-house"></i><span>Início</span></button><button data-help-view="estudar"><i class="fas fa-compass"></i><span>Estudar</span></button><button data-help-view="mentor-ia"><i class="fas fa-robot"></i><span>Mentor IA</span></button><button data-help-view="foco"><i class="fas fa-bullseye"></i><span>Modo Foco</span></button><button data-help-view="notificacoes"><i class="fas fa-bell"></i><span>Notificações</span></button><button data-help-view="configuracoes"><i class="fas fa-sliders"></i><span>Configurações</span></button></div></div></div>
    `;
  }

  const SiteTutorial = {
    index:0,
    running:false,
    pendingAutostart:false,
    _target:null,
    _runToken:0,
    _lastDevice:null,

    hasCompleted(){ return localStorage.getItem('slc_tutorial_completed_v2') === '1'; },
    markCompleted(){ localStorage.setItem('slc_tutorial_completed_v2','1'); localStorage.setItem('slc_tutorial_completed','1'); },
    reset(){ localStorage.removeItem('slc_tutorial_completed_v2'); localStorage.removeItem('slc_tutorial_completed'); },

    maybeStart(){
      const main=document.getElementById('main-dashboard');
      const visible=main && main.style.display!=='none' && !main.classList.contains('hidden');
      if(this.running||this.hasCompleted()||!window.app||!visible||document.getElementById('setup-screen')?.offsetParent)return;
      if(this.pendingAutostart)return;
      this.pendingAutostart=true;
      setTimeout(()=>{
        this.pendingAutostart=false;
        if(!this.hasCompleted()&&!this.running)this.start();
      },700);
    },

    start(startIndex=0){
      assignTargets();
      const steps=currentSteps();
      this.index=Math.max(0,Math.min(startIndex,steps.length-1));
      this.running=true;
      this._runToken++;
      this._lastDevice=deviceKind();
      const overlay=ensureOverlay();
      overlay.classList.add('open');
      document.body.classList.add('slc-tutorial-open');
      this.bindControls();
      this._setInteractionLock(true);
      this.showStep(this._runToken);
      window.addEventListener('resize',this.handleViewportChange,{passive:true});
      window.addEventListener('orientationchange',this.handleViewportChange,{passive:true});
    },

    stop(markDone=false){
      this._runToken++;
      this.running=false;
      this._target=null;
      const overlay=ensureOverlay();
      overlay.classList.remove('open');
      document.body.classList.remove('slc-tutorial-open');
      document.querySelectorAll('.tutorial-target-active').forEach(n=>n.classList.remove('tutorial-target-active'));
      window.removeEventListener('resize',this.handleViewportChange);
      window.removeEventListener('orientationchange',this.handleViewportChange);
      this._setInteractionLock(false);
      window.SLCProductShell?.closeMobileMore?.();
      window.SLCSidebar?.close?.();
      if(markDone)this.markCompleted();
    },

    _setInteractionLock(active){
      const overlay=ensureOverlay();
      overlay.setAttribute('aria-hidden',active?'false':'true');
      if(active){
        document.documentElement.classList.add('slc-tutorial-lock');
      }else{
        document.documentElement.classList.remove('slc-tutorial-lock');
      }
    },

    handleViewportChange(){
      if(!window.SiteTutorial?.running)return;
      const nextDevice=deviceKind();
      if(nextDevice!==window.SiteTutorial._lastDevice){
        window.SiteTutorial._lastDevice=nextDevice;
        window.SiteTutorial.showStep(window.SiteTutorial._runToken);
        return;
      }
      requestAnimationFrame(()=>window.SiteTutorial.positionCurrentStep());
    },

    bindControls(){
      const overlay=ensureOverlay();
      el('tutorial-next').onclick=()=>this.next();
      el('tutorial-prev').onclick=()=>this.prev();
      el('tutorial-skip').onclick=()=>this.stop(true);
      overlay.querySelector('.tutorial-backdrop').onclick=(e)=>{
        if(e.target.closest('.tutorial-card'))return;
        e.preventDefault();
        e.stopPropagation();
      };
      const blocker=overlay.querySelector('.tutorial-target-blocker');
      if(blocker) blocker.onclick=(e)=>{e.preventDefault();e.stopPropagation();};
    },

    next(){
      if(!this.running)return;
      const steps=currentSteps();
      if(this.index>=steps.length-1){this.stop(true);return;}
      this.index++;
      this.showStep(this._runToken);
    },

    prev(){
      if(!this.running||this.index<=0)return;
      this.index--;
      this.showStep(this._runToken);
    },

    async getTarget(step, token=this._runToken){
      for(let i=0;i<30;i++){
        if(!this.running||token!==this._runToken)return null;
        assignTargets();
        const target=resolveTarget(step);
        if(target){
          const r=target.getBoundingClientRect();
          const visible=r.width>0&&r.height>0&&r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth;
          if(visible)return target;
        }
        await wait(80);
      }
      return null;
    },

    async _setDrawer(open){
      const isMobile=deviceKind()==='mobile';
      if(!isMobile)return;
      const drawer=document.getElementById('slc-mobile-more');
      const isOpen=!!drawer?.classList.contains('slc-mobile-more-open') || !!drawer?.querySelector('.slc-mobile-more-open');
      if(open){
        if(!isOpen)window.SLCProductShell?.openMobileMore?.();
      }else if(isOpen){
        window.SLCProductShell?.closeMobileMore?.();
      }
      await wait(120);
    },

    async _navigate(view){
      if(!view||!window.app?.loadView)return;
      try{ window.app.loadView(view); markNavActive(view); }catch(_){ }
      await wait(140);
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    },

    async ensureView(step, token=this._runToken){
      const viewByStep={
        home:'dashboard',study:'estudar',mentor:'mentor-ia',focus:'foco',
        learning:'mapa-aprendizado',organization:'tarefas',profile:'configuracoes',
        telegram:'telegram',help:'ajuda'
      };
      const drawerSteps=['learning','organization','profile','help'];
      const needsDrawer=deviceKind()==='mobile' && drawerSteps.includes(step.target);
      const view=viewByStep[step.target];

      // Estado de navegação é parte do passo. Isso evita resíduos ao usar Voltar.
      if(!needsDrawer) await this._setDrawer(false);
      if(!this.running||token!==this._runToken)return;

      if(view && !['notifications','more'].includes(step.target)){
        await this._navigate(view);
      }else{
        await wait(80);
      }
      if(!this.running||token!==this._runToken)return;

      if(needsDrawer) await this._setDrawer(true);
      if(!this.running||token!==this._runToken)return;

      assignTargets();
      let target=resolveTarget(step);

      // O drawer é uma área rolável. Primeiro tornamos o alvo visível; só então
      // medimos o retângulo definitivo para o spotlight/card.
      if(needsDrawer){
        const sheet=document.querySelector('#slc-mobile-more .slc-mobile-more-sheet');
        if(sheet&&target){
          const desiredTop=step.target==='profile'||step.target==='help'?118:92;
          const sr=sheet.getBoundingClientRect();
          const tr=target.getBoundingClientRect();
          const delta=tr.top-sr.top-desiredTop;
          const max=Math.max(0,sheet.scrollHeight-sheet.clientHeight);
          sheet.scrollTop=Math.max(0,Math.min(max,sheet.scrollTop+delta));
          await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
          target=resolveTarget(step)||target;
        }
      }

      if(!needsDrawer && deviceKind()!=='mobile' && target){
        try{target.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'});}catch(_){ }
        await wait(40);
      }
    },

    updateSpotlight(target){
      const overlay=ensureOverlay(),s=overlay.querySelector('.tutorial-spotlight'),backdrop=overlay.querySelector('.tutorial-backdrop');
      if(!s||!target)return;
      const r=target.getBoundingClientRect();
      const pad=deviceKind()==='mobile'?6:8;
      const left=Math.max(2,r.left-pad), top=Math.max(2,r.top-pad), right=Math.min(innerWidth-2,r.right+pad), bottom=Math.min(innerHeight-2,r.bottom+pad);
      s.style.top=`${top}px`;s.style.left=`${left}px`;
      s.style.width=`${Math.max(40,right-left)}px`;s.style.height=`${Math.max(30,bottom-top)}px`;
      s.style.borderRadius=`${deviceKind()==='mobile'?18:14}px`;

      if(backdrop){
        const panels=[
          ['top',0,0,innerWidth,top],
          ['left',0,top,left,Math.max(0,bottom-top)],
          ['right',right,top,Math.max(0,innerWidth-right),Math.max(0,bottom-top)],
          ['bottom',0,bottom,innerWidth,Math.max(0,innerHeight-bottom)]
        ];
        panels.forEach(([name,x,y,w,h])=>{
          const panel=backdrop.querySelector(`.tutorial-backdrop-${name}`);
          if(!panel)return;
          panel.style.left=`${x}px`;panel.style.top=`${y}px`;
          panel.style.width=`${Math.max(0,w)}px`;panel.style.height=`${Math.max(0,h)}px`;
        });
        const blocker=backdrop.querySelector('.tutorial-target-blocker');
        if(blocker){
          blocker.style.left=`${left}px`;blocker.style.top=`${top}px`;
          blocker.style.width=`${Math.max(0,right-left)}px`;blocker.style.height=`${Math.max(0,bottom-top)}px`;
        }
      }
    },

    positionCard(target){
      const card=el('tutorial-card'),arrow=el('tutorial-card-arrow');
      if(!card||!arrow||!target)return;
      const r=target.getBoundingClientRect(),vw=innerWidth,vh=innerHeight;
      const step=currentStep()||{target:'home',id:'generic'};
      const layout=layoutFor(step);
      const margin=deviceKind()==='mobile'?12:16;
      card.style.left='';card.style.right='';card.style.top='';card.style.bottom='';
      card.style.width='';card.style.maxWidth='';
      arrow.style.left='';arrow.style.right='';arrow.style.top='';arrow.style.bottom='';
      card.classList.remove('mobile','arrow-left','arrow-right','arrow-top','arrow-bottom','tutorial-layout-header','tutorial-layout-sidebar','tutorial-layout-bottom-nav','tutorial-layout-drawer');
      card.classList.add(`tutorial-step-${step.id}`);

      if(deviceKind()==='mobile'){
        card.classList.add('mobile');
        const nav=document.getElementById('slc-product-bottom-nav');
        const navRect=nav?.getBoundingClientRect?.();
        const navVisible=!!nav&&getComputedStyle(nav).display!=='none';
        const navTop=navVisible&&navRect?navRect.top:vh;
        const width=vw-margin*2;
        const h=card.offsetHeight||260;
        const centerX=Math.max(22,Math.min(width-22,r.left+r.width/2-margin));

        if(['home','study','mentor','focus','more'].includes(step.target)){
          const top=Math.max(margin,navTop-h-14);
          card.classList.add('arrow-bottom','tutorial-layout-bottom-nav');
          card.style.left=`${margin}px`;card.style.right=`${margin}px`;card.style.top=`${top}px`;
          arrow.style.bottom='-10px';arrow.style.left=`${centerX}px`;
          return;
        }

        if(step.target==='notifications'){
          const below=navTop-r.bottom-14;
          if(below>=h){
            card.classList.add('arrow-top');
            card.style.left=`${margin}px`;card.style.right=`${margin}px`;card.style.top=`${Math.min(navTop-h-8,r.bottom+14)}px`;
            arrow.style.top='-10px';
          }else{
            card.classList.add('arrow-bottom');
            card.style.left=`${margin}px`;card.style.right=`${margin}px`;card.style.top=`${Math.max(margin,r.top-h-14)}px`;
            arrow.style.bottom='-10px';
          }
          arrow.style.left=`${centerX}px`;
          return;
        }

        if(['learning','organization','profile','help'].includes(step.target)){
          const gap=12;
          let top=r.bottom+gap;
          if(top+h+margin>vh){
            top=Math.max(margin,r.top-h-gap);
            card.classList.add('arrow-bottom');
            arrow.style.bottom='-10px';
          }else{
            card.classList.add('arrow-top');
            arrow.style.top='-10px';
          }
          card.classList.add('tutorial-layout-drawer');
          card.style.left=`${margin}px`;card.style.right=`${margin}px`;card.style.top=`${Math.max(margin,top)}px`;
          arrow.style.left=`${centerX}px`;
          return;
        }

        card.style.left=`${margin}px`;card.style.right=`${margin}px`;card.style.top=`${Math.max(margin,Math.min(navTop-h-margin,r.bottom+12))}px`;
        card.classList.add('arrow-top');
        arrow.style.top='-10px';arrow.style.left=`${centerX}px`;
        return;
      }

      const w=Math.min(Number(layout.width)||380,vw-margin*2);
      const h=card.offsetHeight||230;
      card.style.width=`${w}px`;card.style.maxWidth=`${w}px`;

      if(step.target==='notifications'){
        const x=Math.max(margin,Math.min(vw-w-margin,r.left+r.width/2-w/2));
        const top=Math.min(vh-h-margin,r.bottom+16);
        card.classList.add('arrow-top','tutorial-layout-header');
        card.style.left=`${x}px`;card.style.top=`${top}px`;
        arrow.style.top='-10px';arrow.style.left=`${Math.max(24,Math.min(w-32,r.left+r.width/2-x-10))}px`;
        return;
      }

      const sidebar=target.closest?.('#sidebar-nav, .sidebar-nav, .sidebar')||document.querySelector('#sidebar-nav, .sidebar-nav, .sidebar');
      const sr=sidebar?.getBoundingClientRect?.();
      if(sr&&sr.width){
        const gap=18;
        let left=sr.right+gap, arrowSide='left';
        if(left+w>vw-margin){left=Math.max(margin,sr.left-w-gap);arrowSide='right';}
        const top=Math.max(margin,Math.min(vh-h-margin,r.top+r.height/2-h/2));
        card.style.left=`${left}px`;card.style.top=`${top}px`;
        card.classList.add(arrowSide==='left'?'arrow-left':'arrow-right','tutorial-layout-sidebar');
        arrow.style.top=`${Math.max(24,Math.min(h-34,r.top+r.height/2-top-10))}px`;
        if(arrowSide==='left')arrow.style.left='-10px';else arrow.style.right='-10px';
        return;
      }

      const right=vw-r.right,left=r.left,bottom=vh-r.bottom;
      if(right>=w+28){
        const top=Math.max(margin,Math.min(vh-h-margin,r.top+r.height/2-h/2));
        card.classList.add('arrow-left');card.style.left=`${Math.min(vw-w-margin,r.right+18)}px`;card.style.top=`${top}px`;
        arrow.style.left='-10px';arrow.style.top=`${Math.max(24,Math.min(h-34,r.top+r.height/2-top-10))}px`;
      }else if(left>=w+28){
        const top=Math.max(margin,Math.min(vh-h-margin,r.top+r.height/2-h/2));
        card.classList.add('arrow-right');card.style.left=`${Math.max(margin,r.left-w-18)}px`;card.style.top=`${top}px`;
        arrow.style.right='-10px';arrow.style.top=`${Math.max(24,Math.min(h-34,r.top+r.height/2-top-10))}px`;
      }else{
        const x=Math.max(margin,Math.min(vw-w-margin,r.left+r.width/2-w/2));
        const top=r.bottom+h+16<=vh-margin?r.bottom+16:Math.max(margin,r.top-h-16);
        card.classList.add(top>r.top?'arrow-top':'arrow-bottom');
        card.style.left=`${x}px`;card.style.top=`${top}px`;
        if(top>r.top)arrow.style.top='-10px';else arrow.style.bottom='-10px';
        arrow.style.left=`${Math.max(24,Math.min(w-32,r.left+r.width/2-x-10))}px`;
      }
    },

    positionCurrentStep(){
      const t=this._target;
      if(t&&document.body.contains(t)){
        this.updateSpotlight(t);
        this.positionCard(t);
      }
    },

    async showStep(token=this._runToken){
      const steps=currentSteps();
      const step=steps[this.index];
      if(!step||!this.running||token!==this._runToken)return;

      await this.ensureView(step,token);
      if(!this.running||token!==this._runToken)return;

      document.querySelectorAll('.tutorial-target-active').forEach(n=>n.classList.remove('tutorial-target-active'));
      const target=await this.getTarget(step,token);
      if(!target)return;

      // O alvo é somente uma referência visual. Ele nunca recebe z-index para
      // furar o overlay; o recorte do tutorial é que cria a janela.
      target.classList.add('tutorial-target-active');
      this._target=target;
      this._lastDevice=deviceKind();

      const device=deviceKind();
      el('tutorial-title').textContent=step.title;
      el('tutorial-text').textContent=step.text;
      el('tutorial-progress-text').textContent=`Passo ${this.index+1} de ${steps.length}`;
      el('tutorial-device-note').textContent=device==='mobile'?'Celular':'Computador';
      el('tutorial-next').textContent=this.index===steps.length-1?'Finalizar':'Próximo';
      el('tutorial-prev').disabled=this.index===0;

      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      if(!this.running||token!==this._runToken)return;
      this.updateSpotlight(target);
      this.positionCard(target);
      await wait(60);
      if(!this.running||token!==this._runToken)return;
      this.updateSpotlight(target);
      this.positionCard(target);
    }
  };

  function bindHelpActions(root=document){
    root.querySelectorAll('#btn-start-tutorial,#btn-open-tutorial-inline').forEach(btn=>{if(btn.dataset.bound)return;btn.dataset.bound='1';btn.onclick=()=>SiteTutorial.start(0);});
    root.querySelectorAll('[data-help-question]').forEach(btn=>{if(btn.dataset.bound)return;btn.dataset.bound='1';btn.onclick=()=>{const q=btn.getAttribute('data-help-question')||'';window.app?.loadView?.('mentor-ia');markNavActive('mentor-ia');setTimeout(()=>{const input=document.querySelector('#chat-input,#mentor-ia-input,#ai-chat-input,.mentor-chat-input textarea,.mentor-chat-input input');if(input){input.value=q;input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();}},150);};});
    root.querySelectorAll('[data-help-view]').forEach(btn=>{if(btn.dataset.bound)return;btn.dataset.bound='1';btn.onclick=()=>window.app?.loadView?.(btn.dataset.helpView);});
  }

  window.SiteTutorial=SiteTutorial;
  window.renderHelpPage=renderHelpPage;
  window.bindHelpActions=bindHelpActions;
  document.addEventListener('DOMContentLoaded',()=>{assignTargets();setTimeout(()=>SiteTutorial.maybeStart(),1200);});
  document.addEventListener('app-ready',()=>setTimeout(()=>SiteTutorial.maybeStart(),500));
})();
