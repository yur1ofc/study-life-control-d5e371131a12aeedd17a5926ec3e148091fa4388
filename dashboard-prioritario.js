// dashboard-prioritario.js
// Injeta um card de "o que fazer agora" no topo do dashboard
// e corrige outros problemas de UX encontrados no código.
// Adicione no index.html ANTES do </body>:
//   <script src="dashboard-prioritario.js"></script>

(function () {
  'use strict';

  // ─── Estilos do card prioritário ───────────────────────────────────────────
  const STYLES = `
    #slc-priority-card {
      background: linear-gradient(135deg, #1e40af 0%, #4338ca 100%);
      border-radius: 14px;
      padding: 1.1rem 1.25rem;
      margin-bottom: 1.25rem;
      color: #fff;
      position: relative;
      overflow: hidden;
    }
    #slc-priority-card::before {
      content: '';
      position: absolute;
      top: -40px; right: -40px;
      width: 140px; height: 140px;
      background: rgba(255,255,255,.06);
      border-radius: 50%;
    }
    #slc-priority-card .slc-prio-label {
      font-size: .72rem;
      font-weight: 600;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: rgba(255,255,255,.65);
      margin-bottom: .35rem;
    }
    #slc-priority-card .slc-prio-title {
      font-size: 1.05rem;
      font-weight: 700;
      margin-bottom: .2rem;
      line-height: 1.3;
    }
    #slc-priority-card .slc-prio-sub {
      font-size: .8rem;
      color: rgba(255,255,255,.75);
      margin-bottom: .9rem;
    }
    #slc-priority-card .slc-prio-actions {
      display: flex;
      gap: .5rem;
      flex-wrap: wrap;
    }
    #slc-priority-card .slc-prio-btn {
      padding: .45rem 1rem;
      border-radius: 8px;
      border: none;
      font-size: .82rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity .15s, transform .1s;
    }
    #slc-priority-card .slc-prio-btn:hover { opacity: .9; transform: translateY(-1px); }
    #slc-priority-card .slc-prio-btn.primary { background: #fff; color: #1e40af; }
    #slc-priority-card .slc-prio-btn.secondary {
      background: rgba(255,255,255,.18);
      color: #fff;
      border: 1px solid rgba(255,255,255,.3);
    }
    #slc-priority-card .slc-prio-dismiss {
      position: absolute; top: 10px; right: 12px;
      background: none; border: none;
      color: rgba(255,255,255,.5); cursor: pointer; font-size: .8rem;
    }
    #slc-priority-card .slc-prio-dismiss:hover { color: #fff; }

    /* Card urgente — prova em breve */
    #slc-priority-card.urgente {
      background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%);
    }
    #slc-priority-card.urgente .slc-prio-btn.primary { color: #991b1b; }

    /* Card aviso — tarefas atrasadas */
    #slc-priority-card.aviso {
      background: linear-gradient(135deg, #b45309 0%, #92400e 100%);
    }
    #slc-priority-card.aviso .slc-prio-btn.primary { color: #b45309; }
  `;

  function injectStyles() {
    if (document.getElementById('slc-priority-styles')) return;
    const s = document.createElement('style');
    s.id = 'slc-priority-styles';
    s.textContent = STYLES;
    document.head.appendChild(s);
  }

  // ─── Calcular prioridade do dia ────────────────────────────────────────────

  function getDaysBetween(dateStr) {
    if (!dateStr) return Infinity;
    const d = new Date(dateStr);
    if (isNaN(d)) return Infinity;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    return Math.round((d - now) / (1000 * 60 * 60 * 24));
  }

  function getPriorityAction(data) {
    if (!data) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Prova hoje ou amanhã
    const examsSorted = (data.exams || [])
      .map(e => ({ ...e, _days: getDaysBetween(e.data || e.date) }))
      .filter(e => e._days >= 0 && e._days <= 3)
      .sort((a, b) => a._days - b._days);

    if (examsSorted.length > 0) {
      const exam = examsSorted[0];
      const when = exam._days === 0 ? 'hoje' : exam._days === 1 ? 'amanhã' : `em ${exam._days} dias`;
      return {
        type: 'exam',
        urgency: exam._days <= 1 ? 'urgente' : 'aviso',
        title: `${exam.materia || exam.nome || 'Prova'} — ${when}`,
        sub: exam._days === 0
          ? 'É hoje! Revise os pontos principais antes de ir.'
          : `Você tem ${exam._days === 1 ? 'apenas um dia' : `${exam._days} dias`} para se preparar.`,
        primaryBtn: { label: 'Iniciar sessão de foco', view: 'foco' },
        secondaryBtn: { label: 'Ver detalhes', view: 'provas' }
      };
    }

    // 2. Tarefas atrasadas
    const overdue = (data.tasks || []).filter(t => {
      if (t.concluida || t.done) return false;
      const days = getDaysBetween(t.dataVencimento || t.deadline);
      return days < 0;
    });

    if (overdue.length > 0) {
      return {
        type: 'overdue',
        urgency: 'aviso',
        title: `${overdue.length} tarefa${overdue.length > 1 ? 's' : ''} em atraso`,
        sub: `"${(overdue[0].titulo || overdue[0].nome || 'Tarefa').slice(0, 40)}" está atrasada${overdue.length > 1 ? ` e mais ${overdue.length - 1}` : ''}.`,
        primaryBtn: { label: 'Ver tarefas', view: 'tarefas' },
        secondaryBtn: { label: 'Modo foco', view: 'foco' }
      };
    }

    // 3. Prova na semana
    const weekExams = (data.exams || [])
      .map(e => ({ ...e, _days: getDaysBetween(e.data || e.date) }))
      .filter(e => e._days >= 4 && e._days <= 7)
      .sort((a, b) => a._days - b._days);

    if (weekExams.length > 0) {
      const exam = weekExams[0];
      return {
        type: 'upcoming',
        urgency: 'normal',
        title: `${exam.materia || exam.nome || 'Prova'} em ${exam._days} dias`,
        sub: 'Bom momento para começar a revisar o conteúdo.',
        primaryBtn: { label: 'Estudar agora', view: 'foco' },
        secondaryBtn: { label: 'Ver calendário', view: 'calendario' }
      };
    }

    // 4. Usuário sem matérias
    if (!data.subjects?.length) {
      return {
        type: 'setup',
        urgency: 'normal',
        title: 'Configure suas matérias do semestre',
        sub: 'Adicione suas matérias para ativar todas as funcionalidades do app.',
        primaryBtn: { label: 'Adicionar matérias', view: 'materias' },
        secondaryBtn: null
      };
    }

    // 5. Nenhuma sessão hoje
    const todayStr = today.toISOString().split('T')[0];
    const sessionToday = (data.sessions || []).some(s => {
      const d = s.data || s.date || '';
      return d.startsWith(todayStr);
    });

    if (!sessionToday && data.subjects?.length > 0) {
      const firstSubject = data.subjects[0];
      return {
        type: 'study',
        urgency: 'normal',
        title: 'Ainda não estudou hoje',
        sub: `Que tal uma sessão de ${firstSubject?.nome || 'estudos'} agora? Até 25 minutos já fazem diferença.`,
        primaryBtn: { label: 'Iniciar sessão', view: 'foco' },
        secondaryBtn: { label: 'Ver plano do dia', view: 'mentor-ia' }
      };
    }

    return null; // tudo ok, não mostra o card
  }

  // ─── Renderizar card ────────────────────────────────────────────────────────

  const DISMISSED_KEY = 'slc_prio_dismissed';

  function wasDismissedToday() {
    const val = sessionStorage.getItem(DISMISSED_KEY);
    return val === new Date().toDateString();
  }

  function renderPriorityCard(data) {
    if (wasDismissedToday()) return;

    const action = getPriorityAction(data);
    if (!action) return;

    // Evita duplicação
    const existing = document.getElementById('slc-priority-card');
    if (existing) existing.remove();

    const card = document.createElement('div');
    card.id = 'slc-priority-card';
    if (action.urgency !== 'normal') card.classList.add(action.urgency);

    const icon = {
      exam: 'fas fa-graduation-cap',
      overdue: 'fas fa-exclamation-triangle',
      upcoming: 'fas fa-calendar-check',
      setup: 'fas fa-rocket',
      study: 'fas fa-bullseye'
    }[action.type] || 'fas fa-star';

    const label = {
      exam: '⚡ Ação urgente',
      overdue: '⚠️ Atenção necessária',
      upcoming: '📅 Esta semana',
      setup: '🚀 Começar',
      study: '🎯 Sugestão de agora'
    }[action.type] || '💡 Dica do dia';

    card.innerHTML = `
      <button class="slc-prio-dismiss" title="Dispensar por hoje">✕</button>
      <div class="slc-prio-label"><i class="${icon}"></i> ${label}</div>
      <div class="slc-prio-title">${action.title}</div>
      <div class="slc-prio-sub">${action.sub}</div>
      <div class="slc-prio-actions">
        <button class="slc-prio-btn primary" data-view="${action.primaryBtn.view}">${action.primaryBtn.label}</button>
        ${action.secondaryBtn ? `<button class="slc-prio-btn secondary" data-view="${action.secondaryBtn.view}">${action.secondaryBtn.label}</button>` : ''}
      </div>
    `;

    // Inserir após o header do dashboard
    const content = document.getElementById('content-area');
    const header = content?.querySelector('.dashboard-header');
    if (header) {
      header.insertAdjacentElement('afterend', card);
    } else {
      content?.prepend(card);
    }

    // Botões de ação
    card.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        if (view && window.app?.loadView) window.app.loadView(view);
      });
    });

    // Dismiss
    card.querySelector('.slc-prio-dismiss').addEventListener('click', () => {
      sessionStorage.setItem(DISMISSED_KEY, new Date().toDateString());
      card.style.transition = 'opacity .3s, transform .3s';
      card.style.opacity = '0';
      card.style.transform = 'translateY(-8px)';
      setTimeout(() => card.remove(), 300);
    });
  }

  // ─── Melhorias adicionais de UX ────────────────────────────────────────────

  // 1. Atalho de teclado: Alt+F = foco, Alt+T = tarefas
  document.addEventListener('keydown', e => {
    if (!e.altKey || !window.app?.loadView) return;
    const map = { f: 'foco', t: 'tarefas', p: 'provas', d: 'dashboard', m: 'mentor-ia' };
    const view = map[e.key.toLowerCase()];
    if (view) { e.preventDefault(); window.app.loadView(view); }
  });

  // 2. Botão "voltar ao início" flutuante em views secundárias
  function injectBackButton(view) {
    const secondaryViews = ['grade-curricular', 'cursos-extras', 'situacao-academica',
      'previsao-notas', 'mapa-aprendizado', 'materiais', 'estatisticas',
      'calendario', 'habitos', 'configuracoes', 'ajuda'];

    const fab = document.getElementById('slc-back-fab');
    if (secondaryViews.includes(view)) {
      if (!fab) {
        const btn = document.createElement('button');
        btn.id = 'slc-back-fab';
        btn.innerHTML = '<i class="fas fa-home"></i>';
        btn.title = 'Voltar ao início (Alt+D)';
        btn.style.cssText = `
          position: fixed; bottom: 24px; right: 24px; z-index: 900;
          width: 44px; height: 44px; border-radius: 50%;
          background: #2563eb; color: #fff; border: none;
          box-shadow: 0 4px 12px rgba(37,99,235,.4);
          cursor: pointer; font-size: 1rem;
          display: flex; align-items: center; justify-content: center;
          transition: transform .15s, box-shadow .15s;
        `;
        btn.addEventListener('mouseenter', () => { btn.style.transform = 'scale(1.1)'; });
        btn.addEventListener('mouseleave', () => { btn.style.transform = 'scale(1)'; });
        btn.addEventListener('click', () => {
          if (window.app?.loadView) window.app.loadView('dashboard');
        });
        document.body.appendChild(btn);
      }
    } else {
      fab?.remove();
    }
  }

  // 3. Confirmação antes de sair do setup sem salvar
  function patchSetupUnsavedWarning() {
    const form = document.getElementById('setup-form');
    if (!form || form.dataset.warnPatched) return;
    form.dataset.warnPatched = '1';

    let dirty = false;
    form.addEventListener('input', () => { dirty = true; });
    form.addEventListener('submit', () => { dirty = false; });

    window.addEventListener('beforeunload', e => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = 'Você tem alterações não salvas. Deseja sair?';
      }
    });
  }

  // ─── Hook no loadView ──────────────────────────────────────────────────────

  function patchApp() {
    const app = window.app;
    if (!app || app.__priorityPatched) return;
    app.__priorityPatched = true;

    const _orig = app.loadView?.bind(app);
    if (!_orig) return;

    window.app.loadView = function (view) {
      const result = _orig(view);

      if (view === 'dashboard') {
        setTimeout(() => {
          renderPriorityCard(window.app?.data);
        }, 200);
      }

      injectBackButton(view);

      if (view === 'configuracoes') {
        setTimeout(patchSetupUnsavedWarning, 300);
      }

      return result;
    };
  }

  // ─── Init ──────────────────────────────────────────────────────────────────

  injectStyles();

  document.addEventListener('app-ready', () => {
    setTimeout(patchApp, 500);
  });

  if (window.app?.initialized) {
    setTimeout(patchApp, 100);
  }

})();
