(function () {
  function el(id) { return document.getElementById(id); }
  function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  const HELP_SECTIONS = [
    { icon: '🚀', title: 'Primeiros passos', body: 'Comece cadastrando suas matérias, depois adicione tarefas, provas e sessões de estudo. O Dashboard vai ficando cada vez mais útil conforme você alimenta o sistema.' },
    { icon: '🧠', title: 'Mentor IA', body: 'O Mentor IA usa seus dados reais do site para responder melhor. Perguntas boas: “o que estudar hoje?”, “como estou em física?”, “o que está atrasado?” e “organiza meu dia agora”.' },
    { icon: '📊', title: 'Dashboard', body: 'Mostra progresso, horas estudadas, matérias em risco, próximas provas e visão geral da semana. É a tela principal para entender sua situação acadêmica.' },
    { icon: '✅', title: 'Tarefas, provas e materiais', body: 'Registre tudo por matéria. Quanto mais completo estiver, melhores ficam os alertas, o plano de estudo e a ajuda da IA.' },
    { icon: '🎮', title: 'Gamificação', body: 'Você ganha XP ao concluir tarefas, revisões e sessões. Também desbloqueia conquistas. A aba de Gamificação mostra seu nível, histórico e conquistas bloqueadas e desbloqueadas.' },
    { icon: '🔔', title: 'Notificações', body: 'Use o sino no topo para ver alertas de tarefas atrasadas, provas chegando, pendências e recomendações importantes.' },
    { icon: '⚙️', title: 'Configuração inteligente', body: 'Cadastre sua grade horária, frequência, notas e metas. Isso permite análises mais avançadas, risco acadêmico mais preciso e respostas melhores do Mentor IA.' }
  ];

  const steps = [
    { id: 'dashboard', view: 'dashboard', title: 'Bem-vindo ao SLCampus', text: 'Esse é o seu painel principal. Aqui você acompanha horas estudadas, risco acadêmico, provas e o que precisa de atenção primeiro.', selector: '[data-tutorial="nav-dashboard"]' },
    { id: 'mentor', view: 'mentor-ia', title: 'Mentor IA', text: 'Aqui fica o seu assistente inteligente. Ele responde com base nos seus dados reais do site e ajuda a decidir o que estudar e onde você está pior.', selector: '[data-tutorial="nav-mentor"]' },
    { id: 'tarefas', view: 'tarefas', title: 'Tarefas e organização', text: 'Cadastre tarefas, trabalhos e pendências aqui. Isso alimenta as notificações, o plano de estudo e a visão de prioridade.', selector: '[data-tutorial="nav-tarefas"]' },
    { id: 'gamificacao', view: 'gamificacao', title: 'Nível, XP e conquistas', text: 'A gamificação transforma seu progresso em algo visível. Concluir tarefas, revisões e sessões gera XP e pode desbloquear conquistas.', selector: '[data-tutorial="nav-gamificacao"]' },
    { id: 'notificacoes', title: 'Central de notificações', text: 'O sino do topo concentra seus alertas importantes. Quando você entrar no site com pendências, ele pode abrir automaticamente para chamar sua atenção.', selector: '[data-tutorial="notification-button"]' },
    { id: 'ajuda', view: 'ajuda', title: 'Central de ajuda', text: 'Essa aba reúne o manual do sistema, perguntas que valem a pena fazer para a IA e um botão para reabrir este tutorial quando quiser.', selector: '[data-tutorial="nav-ajuda"]' }
  ];

  function assignTutorialTargets() {
    const mapping = [
      ['[data-view="dashboard"]', 'nav-dashboard'],
      ['[data-view="mentor-ia"]', 'nav-mentor'],
      ['[data-view="tarefas"]', 'nav-tarefas'],
      ['[data-view="gamificacao"]', 'nav-gamificacao'],
      ['[data-view="ajuda"]', 'nav-ajuda'],
      ['#notification-badge', 'notification-button'],
      ['#user-info', 'user-profile'],
      ['[data-view="foco"]', 'nav-foco'],
      ['[data-view="mapa-aprendizado"]', 'nav-mapa']
    ];
    mapping.forEach(([selector, name]) => {
      const node = document.querySelector(selector);
      if (node) node.setAttribute('data-tutorial', name);
    });
  }

  function ensureOverlay() {
    let overlay = el('tutorial-overlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'tutorial-overlay';
    overlay.className = 'tutorial-overlay';
    overlay.innerHTML = `
      <div class="tutorial-backdrop"></div>
      <div class="tutorial-spotlight"></div>
      <div class="tutorial-card" id="tutorial-card" role="dialog" aria-modal="true" aria-live="polite">
        <div class="tutorial-progress">
          <span id="tutorial-progress-text"></span>
          <button class="tutorial-skip" id="tutorial-skip" type="button">Pular</button>
        </div>
        <div class="tutorial-card-arrow" id="tutorial-card-arrow"></div>
        <h3 id="tutorial-title"></h3>
        <p id="tutorial-text"></p>
        <div class="tutorial-actions">
          <button class="btn-secondary" id="tutorial-prev" type="button">Voltar</button>
          <button class="btn-primary" id="tutorial-next" type="button">Próximo</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    return overlay;
  }

  function markNavActive(view) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === view));
    const pageTitle = el('page-title');
    if (pageTitle) {
      const map = { ajuda: 'Ajuda', 'mentor-ia': 'Mentor IA', dashboard: 'Dashboard', tarefas: 'Tarefas', gamificacao: 'Gamificação' };
      pageTitle.textContent = map[view] || pageTitle.textContent;
    }
  }

  function renderHelpPage() {
    const suggestions = ['o que estudar hoje?', 'quais matérias estão em risco?', 'organiza meu dia agora', 'como estou em física?', 'o que está atrasado?', 'me dá um raio-x completo', 'qual minha rotina?'];
    return `
      <div class="view-header">
        <h2><i class="fas fa-question-circle"></i> Central de Ajuda</h2>
        <div class="help-header-actions">
          <button class="btn-primary" id="btn-start-tutorial"><i class="fas fa-wand-magic-sparkles"></i> Ver tutorial guiado</button>
        </div>
      </div>
      <div class="help-hero-card">
        <div>
          <span class="tag">Tutorial interativo</span>
          <h3>Aprenda tudo que dá para fazer no site</h3>
          <p>Use esta área para entender o fluxo completo do sistema, descobrir recursos escondidos e ver exemplos de perguntas que funcionam muito bem com o Mentor IA.</p>
        </div>
        <div class="help-hero-actions">
          <button class="btn-secondary" id="btn-open-tutorial-inline">Começar agora</button>
        </div>
      </div>
      <div class="help-grid">
        ${HELP_SECTIONS.map(section => `
          <article class="help-card-pro">
            <div class="help-card-icon">${section.icon}</div>
            <div>
              <h3>${section.title}</h3>
              <p>${section.body}</p>
            </div>
          </article>
        `).join('')}
      </div>
      <div class="card">
        <div class="card-header">
          <h3><i class="fas fa-robot"></i> Perguntas que chamam atenção no Mentor IA</h3>
        </div>
        <div class="card-body">
          <div class="help-chip-list">
            ${suggestions.map(text => `<button class="help-chip" data-help-question="${text.replace(/"/g, '&quot;')}">${text}</button>`).join('')}
          </div>
          <p class="text-secondary" style="margin-top:12px;">Ao clicar, a pergunta abre na aba do Mentor IA para você testar direto.</p>
        </div>
      </div>
    `;
  }

  const SiteTutorial = {
    index: 0,
    running: false,
    pendingAutostart: false,

    hasCompleted() { return localStorage.getItem('slc_tutorial_completed') === '1'; },
    markCompleted() { localStorage.setItem('slc_tutorial_completed', '1'); },
    reset() { localStorage.removeItem('slc_tutorial_completed'); },

    maybeStart() {
      // Bug antigo: procurava #app-screen, um id que nunca existiu no HTML
      // (a tela principal é #main-dashboard) — por isso o tutorial nunca
      // disparava sozinho depois do onboarding. Corrigido para checar o id certo.
      const mainScreen = document.getElementById('main-dashboard');
      const visible = mainScreen && mainScreen.style.display !== 'none' && !mainScreen.classList.contains('hidden');
      if (this.running || this.hasCompleted() || !window.app || !visible) return;
      if (this.pendingAutostart) return;
      this.pendingAutostart = true;
      setTimeout(() => {
        this.pendingAutostart = false;
        assignTutorialTargets();
        if (!this.hasCompleted() && !this.running) this.start();
      }, 700);
    },

    start(startIndex = 0) {
      assignTutorialTargets();
      this.index = Math.max(0, Math.min(startIndex, steps.length - 1));
      this.running = true;
      ensureOverlay().classList.add('open');
      this.bindControls();
      this.showStep();
      window.addEventListener('resize', this.handleViewportChange);
      window.addEventListener('scroll', this.handleViewportChange, true);
    },

    stop(markDone = false) {
      this.running = false;
      ensureOverlay().classList.remove('open');
      document.querySelectorAll('.tutorial-target-active').forEach(node => node.classList.remove('tutorial-target-active'));
      window.removeEventListener('resize', this.handleViewportChange);
      window.removeEventListener('scroll', this.handleViewportChange, true);
      if (document.body.classList.contains('sidebar-open')) window.SLCSidebar?.close();
      if (markDone) this.markCompleted();
    },

    handleViewportChange: () => {
      if (window.SiteTutorial && window.SiteTutorial.running) {
        window.SiteTutorial.positionCurrentStep();
      }
    },

    bindControls() {
      const overlay = ensureOverlay();
      const nextBtn = el('tutorial-next');
      const prevBtn = el('tutorial-prev');
      const skipBtn = el('tutorial-skip');
      const backdrop = overlay.querySelector('.tutorial-backdrop');
      if (nextBtn) nextBtn.onclick = () => this.next();
      if (prevBtn) prevBtn.onclick = () => this.prev();
      if (skipBtn) skipBtn.onclick = () => this.stop(true);
      if (backdrop) backdrop.onclick = () => this.stop(true);
    },

    next() {
      if (this.index >= steps.length - 1) {
        this.stop(true);
        if (window.app && window.app.loadView) window.app.loadView('dashboard');
        markNavActive('dashboard');
        return;
      }
      this.index += 1;
      this.showStep();
    },

    prev() {
      if (this.index <= 0) return this.showStep();
      this.index -= 1;
      this.showStep();
    },

    async ensureView(step) {
      if (step.view && window.app && window.app.loadView) {
        window.app.loadView(step.view);
        markNavActive(step.view);
      }
      assignTutorialTargets();
      await wait(200);
      assignTutorialTargets();
      await wait(180);
    },

    async getTarget(step) {
      let target = null;
      for (let i = 0; i < 12; i += 1) {
        assignTutorialTargets();
        target = document.querySelector(step.selector);
        if (target) {
          const rect = target.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) return target;
        }
        await wait(120);
      }
      return target;
    },

    positionCard(target) {
      const overlay = ensureOverlay();
      const card = overlay.querySelector('#tutorial-card');
      const arrow = overlay.querySelector('#tutorial-card-arrow');
      if (!card || !arrow || !target) return;

      const rect = target.getBoundingClientRect();
      const margin = 16;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      card.style.left = '';
      card.style.right = '';
      card.style.top = '';
      card.style.bottom = '';
      arrow.style.left = '';
      arrow.style.right = '';
      arrow.style.top = '';
      arrow.style.bottom = '';
      card.classList.remove('arrow-left', 'arrow-right', 'arrow-top', 'arrow-bottom', 'mobile');

      const isMobile = vw <= 820;
      if (isMobile) {
        card.classList.add('mobile', 'arrow-bottom');
        card.style.left = `${margin}px`;
        card.style.right = `${margin}px`;
        card.style.bottom = `${margin}px`;
        arrow.style.left = `${Math.max(26, Math.min(vw - margin * 2 - 28, rect.left + rect.width / 2 - margin - 10))}px`;
        arrow.style.top = '-10px';
        return;
      }

      const cardWidth = Math.min(420, vw - margin * 2);
      const cardHeight = card.offsetHeight || 240;
      const spaceRight = vw - rect.right;
      const spaceLeft = rect.left;
      const spaceBottom = vh - rect.bottom;

      if (spaceRight >= cardWidth + 32) {
        const top = Math.max(margin, Math.min(vh - cardHeight - margin, rect.top + rect.height / 2 - cardHeight / 2));
        card.classList.add('arrow-left');
        card.style.left = `${Math.min(vw - cardWidth - margin, rect.right + 20)}px`;
        card.style.top = `${top}px`;
        arrow.style.left = '-10px';
        arrow.style.top = `${Math.max(22, Math.min(cardHeight - 30, rect.top + rect.height / 2 - top - 10))}px`;
      } else if (spaceLeft >= cardWidth + 32) {
        const top = Math.max(margin, Math.min(vh - cardHeight - margin, rect.top + rect.height / 2 - cardHeight / 2));
        card.classList.add('arrow-right');
        card.style.left = `${Math.max(margin, rect.left - cardWidth - 20)}px`;
        card.style.top = `${top}px`;
        arrow.style.right = '-10px';
        arrow.style.top = `${Math.max(22, Math.min(cardHeight - 30, rect.top + rect.height / 2 - top - 10))}px`;
      } else if (spaceBottom >= cardHeight + 30) {
        const left = Math.max(margin, Math.min(vw - cardWidth - margin, rect.left + rect.width / 2 - cardWidth / 2));
        const top = Math.min(vh - cardHeight - margin, rect.bottom + 18);
        card.classList.add('arrow-top');
        card.style.left = `${left}px`;
        card.style.top = `${top}px`;
        arrow.style.top = '-10px';
        arrow.style.left = `${Math.max(24, Math.min(cardWidth - 30, rect.left + rect.width / 2 - left - 10))}px`;
      } else {
        const left = Math.max(margin, Math.min(vw - cardWidth - margin, rect.left + rect.width / 2 - cardWidth / 2));
        const top = Math.max(margin, rect.top - cardHeight - 18);
        card.classList.add('arrow-bottom');
        card.style.left = `${left}px`;
        card.style.top = `${top}px`;
        arrow.style.bottom = '-10px';
        arrow.style.left = `${Math.max(24, Math.min(cardWidth - 30, rect.left + rect.width / 2 - left - 10))}px`;
      }
    },

    updateSpotlight(target) {
      const spotlight = ensureOverlay().querySelector('.tutorial-spotlight');
      if (!spotlight || !target) return;
      const rect = target.getBoundingClientRect();
      const padX = window.innerWidth <= 820 ? 8 : 12;
      const padY = window.innerWidth <= 820 ? 8 : 10;
      spotlight.style.top = `${Math.max(8, rect.top - padY)}px`;
      spotlight.style.left = `${Math.max(8, rect.left - padX)}px`;
      spotlight.style.width = `${Math.max(72, rect.width + padX * 2)}px`;
      spotlight.style.height = `${Math.max(36, rect.height + padY * 2)}px`;
    },

    positionCurrentStep() {
      const step = steps[this.index];
      if (!step) return;
      const target = document.querySelector(step.selector);
      if (!target) return;
      this.updateSpotlight(target);
      this.positionCard(target);
    },

    async showStep() {
      const step = steps[this.index];
      if (!step) return;

      await this.ensureView(step);
      document.querySelectorAll('.tutorial-target-active').forEach(node => node.classList.remove('tutorial-target-active'));

      const target = await this.getTarget(step);
      if (!target) {
        if (this.index < steps.length - 1) {
          this.index += 1;
          return this.showStep();
        }
        return;
      }

      // No celular a sidebar é uma gaveta escondida fora da tela (transform)
      // até o usuário abrir com o ☰. Se o alvo do passo está dentro dela e a
      // gaveta está fechada, precisamos abri-la primeiro — chamar
      // scrollIntoView num elemento fora da tela (mesmo que "visível" pro
      // DOM) é o que fazia a página inteira ser arrastada pra baixo sem
      // necessidade, já que o navegador tenta trazer pra viewport um
      // elemento fixed que só está invisível por causa do transform.
      const isMobileDrawer = window.innerWidth <= 980;
      const insideSidebar = !!target.closest('.sidebar');
      if (insideSidebar && isMobileDrawer) {
        if (window.SLCSidebar && !document.body.classList.contains('sidebar-open')) {
          window.SLCSidebar.open();
          await wait(300); // espera a transição de 0.25s da gaveta terminar
        }
      } else if (document.body.classList.contains('sidebar-open')) {
        // Saindo de um passo da sidebar pra um passo fora dela: fecha a
        // gaveta pra não ficar sobrepondo o resto da tela.
        window.SLCSidebar?.close();
        await wait(260);
      }

      target.classList.add('tutorial-target-active');
      if (!insideSidebar) {
        // Itens da sidebar já ficam com posição garantida (fixed / dentro da
        // gaveta que acabamos de abrir) — não precisam de scroll, e tentar
        // rolar até eles é o que causava o bug do "arrasta a tela toda".
        target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
      await wait(280);

      this.updateSpotlight(target);
      this.positionCard(target);

      el('tutorial-title').textContent = step.title;
      el('tutorial-text').textContent = step.text;
      el('tutorial-progress-text').textContent = `Passo ${this.index + 1} de ${steps.length}`;
      const nextBtn = el('tutorial-next');
      if (nextBtn) nextBtn.textContent = this.index === steps.length - 1 ? 'Finalizar' : 'Próximo';
    }
  };

  function bindHelpActions(root = document) {
    root.querySelectorAll('#btn-start-tutorial,#btn-open-tutorial-inline').forEach(btn => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => SiteTutorial.start(0));
    });

    root.querySelectorAll('[data-help-question]').forEach(btn => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => {
        const question = btn.getAttribute('data-help-question') || '';
        if (window.app && window.app.loadView) window.app.loadView('mentor-ia');
        markNavActive('mentor-ia');
        setTimeout(() => {
          const input = document.querySelector('#chat-input, #mentor-ia-input, #ai-chat-input, .mentor-chat-input textarea, .mentor-chat-input input');
          if (input) {
            input.value = question;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.focus();
          }
        }, 120);
      });
    });
  }

  window.SiteTutorial = SiteTutorial;
  window.renderHelpPage = renderHelpPage;
  window.bindHelpActions = bindHelpActions;

  document.addEventListener('DOMContentLoaded', () => {
    assignTutorialTargets();
    setTimeout(() => SiteTutorial.maybeStart(), 1200);
  });

  // Principal gatilho: dispara logo que o app termina de montar a tela
  // principal — seja porque o usuário acabou de concluir o wizard de
  // configuração ("Iniciar Jornada"), seja num login normal de quem ainda
  // não viu o tutorial. app.js dispara 'app-ready' em ambos os casos.
  document.addEventListener('app-ready', () => {
    setTimeout(() => SiteTutorial.maybeStart(), 500);
  });
})();
