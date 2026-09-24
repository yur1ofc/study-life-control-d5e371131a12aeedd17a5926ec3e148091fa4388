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

  const STEPS = [
    { id:'home', title:'Seu Início', text:'Aqui fica a visão rápida do que merece atenção. O conteúdo se adapta ao seu perfil: faculdade, concurso, escola ou curso/estudo livre.', target:'home' },
    { id:'study', title:'Área Estudar', text:'No computador você encontra essa área na navegação lateral. No celular ela fica na barra inferior. É onde o planejamento vira sessão de estudo.', target:'study' },
    { id:'mentor', title:'Mentor IA', text:'Use perguntas naturais. O Mentor cruza seus dados atuais, aprendizagem, prazos e histórico para responder dentro do seu contexto.', target:'mentor' },
    { id:'focus', title:'Modo Foco', text:'Quando você realmente vai estudar, comece uma sessão. Ao terminar, registre o resultado para alimentar a aprendizagem do sistema.', target:'focus' },
    { id:'notifications', title:'Notificações', text:'O sino reúne alertas. As notificações inteligentes também respeitam seus horários ocupados e procuram janelas em que você ainda consegue agir.', target:'notifications' },
    { id:'more', title:'Mais funções', text:'No celular e em telas menores, a barra inferior concentra os atalhos principais e o botão Mais abre o restante das funções.', target:'more' },
    { id:'learning', title:'Aprendizagem', text:'Mapa, revisões e evidências ajudam o sistema a entender não só quanto você estudou, mas onde ainda precisa recuperar conhecimento.', target:'learning' },
    { id:'organization', title:'Organização', text:'Tarefas, avaliações, agenda e materiais formam a parte operacional. Cadastre os prazos para que as recomendações tenham dados reais.', target:'organization' },
    { id:'profile', title:'Seu perfil', text:'Em Configurações, você pode ajustar seu contexto e rotina. A escolha do perfil muda a experiência para o tipo de estudo que você realmente faz.', target:'profile' },
    { id:'help', title:'Central de Ajuda', text:'Quando precisar, volte aqui. Você pode rever este tutorial e abrir perguntas prontas para o Mentor.', target:'help' }
  ];

  function targetFor(kind) {
    const mobile = deviceKind() === 'mobile';
    const tablet = deviceKind() === 'tablet';
    const selectors = {
      home: mobile ? '#slc-product-bottom-nav [data-v="dashboard"]' : '[data-view="dashboard"]',
      study: mobile ? '#slc-product-bottom-nav [data-v="estudar"]' : '[data-view="estudar"]',
      mentor: mobile ? '#slc-product-bottom-nav [data-v="mentor-ia"]' : '[data-view="mentor-ia"]',
      focus: mobile ? '#slc-product-bottom-nav [data-v="foco"]' : '[data-view="foco"]',
      notifications: '[data-tutorial="notification-button"], #notification-badge',
      more: mobile ? '#slc-product-bottom-nav [data-v="__more"]' : (tablet ? '#mobile-nav-toggle, .mobile-nav-toggle' : '[data-view="ajuda"]'),
      learning: mobile ? '#slc-mobile-more [data-mobile-more-view="mapa-aprendizado"]' : '[data-view="mapa-aprendizado"]',
      organization: mobile ? '#slc-mobile-more [data-mobile-more-view="tarefas"]' : '[data-view="tarefas"]',
      profile: mobile ? '#slc-mobile-more [data-mobile-more-view="configuracoes"], #slc-mobile-more [data-mobile-more-view="perfil"]' : '[data-view="configuracoes"], [data-slcnavigate="configuracoes"]',
      help: mobile ? '#slc-mobile-more [data-mobile-more-view="ajuda"]' : '[data-view="ajuda"]'
    };
    return selectors[kind] || selectors.home;
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
    index:0, running:false, pendingAutostart:false,
    hasCompleted(){ return localStorage.getItem('slc_tutorial_completed_v2') === '1'; },
    markCompleted(){ localStorage.setItem('slc_tutorial_completed_v2','1'); localStorage.setItem('slc_tutorial_completed','1'); },
    reset(){ localStorage.removeItem('slc_tutorial_completed_v2'); localStorage.removeItem('slc_tutorial_completed'); },
    maybeStart(){
      const main=document.getElementById('main-dashboard');
      const visible=main && main.style.display!=='none' && !main.classList.contains('hidden');
      if(this.running||this.hasCompleted()||!window.app||!visible||document.getElementById('setup-screen')?.offsetParent)return;
      if(this.pendingAutostart)return;
      this.pendingAutostart=true;
      setTimeout(()=>{this.pendingAutostart=false;if(!this.hasCompleted()&&!this.running)this.start();},700);
    },
    start(startIndex=0){
      assignTargets();
      this.index=Math.max(0,Math.min(startIndex,STEPS.length-1));
      this.running=true;
      ensureOverlay().classList.add('open');
      document.body.classList.add('slc-tutorial-open');
      this.bindControls();
      this.showStep();
      window.addEventListener('resize',this.handleViewportChange);
    },
    stop(markDone=false){
      this.running=false;
      ensureOverlay().classList.remove('open');
      document.body.classList.remove('slc-tutorial-open');
      document.querySelectorAll('.tutorial-target-active').forEach(n=>n.classList.remove('tutorial-target-active'));
      window.removeEventListener('resize',this.handleViewportChange);
      window.SLCSidebar?.close?.();
      if(markDone)this.markCompleted();
    },
    handleViewportChange(){ if(window.SiteTutorial?.running)window.SiteTutorial.positionCurrentStep(); },
    bindControls(){
      const overlay=ensureOverlay();
      el('tutorial-next').onclick=()=>this.next(); el('tutorial-prev').onclick=()=>this.prev(); el('tutorial-skip').onclick=()=>this.stop(true);
      overlay.querySelector('.tutorial-backdrop').onclick=()=>this.stop(true);
      const blocker=overlay.querySelector('.tutorial-target-blocker');
      if(blocker) blocker.onclick=(e)=>{e.preventDefault();e.stopPropagation();};
    },
    next(){ if(this.index>=STEPS.length-1){this.stop(true);return;} this.index++; this.showStep(); },
    prev(){ if(this.index>0){this.index--;this.showStep();} },
    async getTarget(step){
      const selector=targetFor(step.target);
      for(let i=0;i<16;i++){
        assignTargets();
        const target=document.querySelector(selector);
        if(target && target.getBoundingClientRect().width>0 && target.getBoundingClientRect().height>0)return target;
        await wait(100);
      }
      return null;
    },
    async ensureView(step){
      const viewByStep={home:'dashboard',study:'estudar',mentor:'mentor-ia',focus:'foco',learning:'mapa-aprendizado',organization:'tarefas',profile:'configuracoes',help:'ajuda'};
      const view=viewByStep[step.target];
      if(view && window.app?.loadView && !['home','notifications','more'].includes(step.target)){
        try{window.app.loadView(view);markNavActive(view);}catch(_){ }
      }
      // No celular, os itens secundários vivem dentro do menu Mais.
      // Abra o menu somente para os passos que realmente apontam para um item dele.
      if(deviceKind()==='mobile' && ['learning','organization','profile','help'].includes(step.target)){
        window.SLCProductShell?.openMobileMore?.();
      }
      await wait(220); assignTargets();
    },
    updateSpotlight(target){
      const overlay=ensureOverlay(),s=overlay.querySelector('.tutorial-spotlight'),backdrop=overlay.querySelector('.tutorial-backdrop');
      if(!s||!target)return;
      const r=target.getBoundingClientRect(); const pad=deviceKind()==='mobile'?6:10;
      const left=Math.max(4,r.left-pad), top=Math.max(4,r.top-pad), right=Math.min(innerWidth-4,r.right+pad), bottom=Math.min(innerHeight-4,r.bottom+pad);
      s.style.top=`${top}px`;s.style.left=`${left}px`;s.style.width=`${Math.max(56,right-left)}px`;s.style.height=`${Math.max(32,bottom-top)}px`;
      // Quatro painéis escurecem tudo ao redor e deixam o alvo totalmente limpo.
      if(backdrop){
        const panels=[
          ['top',0,0,innerWidth,top],
          ['left',0,top,left,Math.max(0,bottom-top)],
          ['right',right,top,Math.max(0,innerWidth-right),Math.max(0,bottom-top)],
          ['bottom',0,bottom,innerWidth,Math.max(0,innerHeight-bottom)]
        ];
        panels.forEach(([name,x,y,w,h])=>{
          const el=backdrop.querySelector(`.tutorial-backdrop-${name}`);
          if(!el)return;
          el.style.left=`${x}px`;el.style.top=`${y}px`;el.style.width=`${w}px`;el.style.height=`${h}px`;
        });
        const blocker=backdrop.querySelector('.tutorial-target-blocker');
        if(blocker){
          blocker.style.left=`${left}px`;blocker.style.top=`${top}px`;blocker.style.width=`${Math.max(0,right-left)}px`;blocker.style.height=`${Math.max(0,bottom-top)}px`;
        }
      }
    },
    positionCard(target){
      const card=el('tutorial-card'),arrow=el('tutorial-card-arrow');if(!card||!arrow||!target)return;
      const r=target.getBoundingClientRect(),vw=innerWidth,vh=innerHeight,margin=deviceKind()==='mobile'?12:16;
      card.style.left='';card.style.right='';card.style.top='';card.style.bottom='';arrow.style.left='';arrow.style.right='';arrow.style.top='';arrow.style.bottom='';card.classList.remove('mobile','arrow-left','arrow-right','arrow-top','arrow-bottom');
      if(deviceKind()==='mobile'){
        const bottomNav=document.getElementById('slc-product-bottom-nav');
        const navRect=bottomNav?.getBoundingClientRect?.();
        const navTop=navRect?.top || vh;
        const cardLeft=margin, cardWidth=vw-margin*2;
        const cardHeight=card.offsetHeight||280;
        const targetNearBottom=r.bottom >= navTop-18 || r.top > vh*.68;
        card.classList.add('mobile');
        card.style.left=`${margin}px`;card.style.right=`${margin}px`;

        if(!targetNearBottom && r.bottom + cardHeight + 18 <= navTop){
          // Alvo no topo/meio: card fica abaixo dele e a seta aponta para cima.
          card.classList.add('arrow-top');
          card.style.top=`${Math.max(margin,r.bottom+16)}px`;
          arrow.style.top='-10px';arrow.style.bottom='';
        }else{
          // Alvo na barra inferior (ou sem espaço abaixo): card fica acima e a seta aponta para baixo.
          card.classList.add('arrow-bottom');
          const cardBottom=Math.max(margin+8, vh-navTop+10);
          card.style.bottom=`${cardBottom}px`;card.style.top='';
          arrow.style.bottom='-10px';arrow.style.top='';
        }
        const targetCenter=r.left+r.width/2;
        arrow.style.left=`${Math.max(24,Math.min(cardWidth-30,targetCenter-cardLeft-10))}px`;
        return;
      }
      const w=Math.min(420,vw-margin*2),h=card.offsetHeight||230;
      const right=vw-r.right,left=r.left,bottom=vh-r.bottom;
      if(right>=w+28){const top=Math.max(margin,Math.min(vh-h-margin,r.top+r.height/2-h/2));card.classList.add('arrow-left');card.style.left=`${Math.min(vw-w-margin,r.right+18)}px`;card.style.top=`${top}px`;arrow.style.left='-10px';arrow.style.top=`${Math.max(22,Math.min(h-30,r.top+r.height/2-top-10))}px`;}
      else if(left>=w+28){const top=Math.max(margin,Math.min(vh-h-margin,r.top+r.height/2-h/2));card.classList.add('arrow-right');card.style.left=`${Math.max(margin,r.left-w-18)}px`;card.style.top=`${top}px`;arrow.style.right='-10px';arrow.style.top=`${Math.max(22,Math.min(h-30,r.top+r.height/2-top-10))}px`;}
      else if(bottom>=h+24){const x=Math.max(margin,Math.min(vw-w-margin,r.left+r.width/2-w/2));card.classList.add('arrow-top');card.style.left=`${x}px`;card.style.top=`${Math.min(vh-h-margin,r.bottom+16)}px`;arrow.style.top='-10px';arrow.style.left=`${Math.max(24,Math.min(w-30,r.left+r.width/2-x-10))}px`;}
      else{const x=Math.max(margin,Math.min(vw-w-margin,r.left+r.width/2-w/2));card.classList.add('arrow-bottom');card.style.left=`${x}px`;card.style.top=`${Math.max(margin,r.top-h-16)}px`;arrow.style.bottom='-10px';arrow.style.left=`${Math.max(24,Math.min(w-30,r.left+r.width/2-x-10))}px`;}
    },
    positionCurrentStep(){const t=this._target;if(t&&document.body.contains(t)){this.updateSpotlight(t);this.positionCard(t);}},
    async showStep(){
      const step=STEPS[this.index];if(!step)return;
      // Nunca rola a página automaticamente. O tutorial usa alvos fixos da navegação.
      window.scrollTo(0,0);
      await this.ensureView(step);
      document.querySelectorAll('.tutorial-target-active').forEach(n=>n.classList.remove('tutorial-target-active'));
      const target=await this.getTarget(step);
      if(!target){if(this.index<STEPS.length-1){this.index++;return this.showStep();}return;}
      if(step.target==='more' && deviceKind()==='mobile'){
        // O botão Mais deve continuar fechado enquanto o destaque é mostrado.
        window.SLCProductShell?.closeMobileMore?.();
      }
      target.classList.add('tutorial-target-active');
      this._target=target;
      const device=deviceKind();
      el('tutorial-title').textContent=step.title;
      el('tutorial-text').textContent=step.text;
      el('tutorial-progress-text').textContent=`Passo ${this.index+1} de ${STEPS.length}`;
      el('tutorial-device-note').textContent=device==='desktop'?'Desktop':device==='tablet'?'Tablet':'Celular';
      el('tutorial-next').textContent=this.index===STEPS.length-1?'Finalizar':'Próximo';
      await wait(80);this.updateSpotlight(target);this.positionCard(target);
      await wait(120);this.updateSpotlight(target);this.positionCard(target);
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
