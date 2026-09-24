// onboarding-simplificado.js
// Modo simplificado para novos usuários + checklist de primeiros passos
// Adicione no index.html ANTES do </body>:
//   <script src="onboarding-simplificado.js"></script>

(function () {
  'use strict';

  const STORAGE_KEY = 'slc_onboarding_v1';

  // Passos do checklist — ordem importa
  const STEPS = [
    {
      id: 'add_subject',
      icon: 'fas fa-book',
      title: 'Adicionar suas matérias',
      desc: 'Cadastre pelo menos uma matéria do semestre atual.',
      view: 'materias',
      check: (data) => (data?.subjects?.length || 0) >= 1
    },
    {
      id: 'add_task',
      icon: 'fas fa-tasks',
      title: 'Criar sua primeira tarefa',
      desc: 'Adicione uma atividade, trabalho ou leitura pendente.',
      view: 'tarefas',
      check: (data) => (data?.tasks?.length || 0) >= 1
    },
    {
      id: 'add_exam',
      icon: 'fas fa-graduation-cap',
      title: 'Registrar uma prova ou trabalho',
      desc: 'Nunca mais esqueça uma data de entrega.',
      view: 'provas',
      check: (data) => (data?.exams?.length || 0) >= 1
    },
    {
      id: 'focus_session',
      icon: 'fas fa-bullseye',
      title: 'Fazer uma sessão de foco',
      desc: 'Use o Modo Foco para estudar com o timer Pomodoro.',
      view: 'foco',
      check: (data) => (data?.sessions?.length || 0) >= 1
    },
    {
      id: 'ask_ia',
      icon: 'fas fa-robot',
      title: 'Perguntar algo ao Mentor IA',
      desc: 'O Mentor IA analisa seus dados e te orienta.',
      view: 'mentor-ia',
      check: () => !!localStorage.getItem('slc_ia_first_asked')
    }
  ];

  // ─── Estado do onboarding ──────────────────────────────────────────────────

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  // O antigo modo iniciante escondia partes do produto para novos usuários.
  // Ele foi removido: todos os recursos ficam disponíveis desde o primeiro acesso.
  function isSimpleModeEnabled() { return false; }
  function setSimpleMode() {
    localStorage.removeItem('slc_simple_mode');
    document.body.classList.remove('slc-simple-mode');
    document.getElementById('slc-mode-badge')?.remove();
  }


  // ─── Checklist de onboarding no dashboard ─────────────────────────────────

  function getProgress(data) {
    const state = loadState();
    return STEPS.map(step => ({
      ...step,
      done: state[step.id] || step.check(data)
    }));
  }

  function saveStepDone(stepId) {
    const state = loadState();
    state[stepId] = true;
    saveState(state);
  }

  function allDone(data) {
    return getProgress(data).every(s => s.done);
  }

  function renderChecklistCard(data) {
    const progress = getProgress(data);
    const done = progress.filter(s => s.done).length;
    const total = progress.length;
    if (done === total) return ''; // tudo feito: some o card

    const pct = Math.round((done / total) * 100);

    const items = progress.map(step => `
      <div class="slc-checklist-item ${step.done ? 'slc-checklist-done' : ''}"
           data-step="${step.id}" data-view="${step.view}"
           style="display:flex;align-items:center;gap:.75rem;padding:.6rem .75rem;border-radius:8px;cursor:${step.done ? 'default' : 'pointer'};transition:background .15s;${step.done ? 'opacity:.55;' : ''}">
        <div style="width:24px;height:24px;border-radius:50%;background:${step.done ? '#dcfce7' : '#f1f5f9'};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <i class="${step.done ? 'fas fa-check' : step.icon}" style="font-size:.65rem;color:${step.done ? '#16a34a' : '#94a3b8'};"></i>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:.85rem;font-weight:500;color:${step.done ? '#64748b' : '#1e293b'};${step.done ? 'text-decoration:line-through;' : ''}">${step.title}</div>
          <div style="font-size:.75rem;color:#94a3b8;">${step.desc}</div>
        </div>
        ${!step.done ? '<i class="fas fa-arrow-right" style="color:#cbd5e1;font-size:.75rem;"></i>' : ''}
      </div>
    `).join('');

    return `
      <div id="slc-onboarding-card" style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:1.25rem;margin-bottom:1.25rem;box-shadow:0 1px 4px rgba(0,0,0,.06);">
        <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1rem;">
          <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#2563eb,#4f46e5);display:flex;align-items:center;justify-content:center;">
            <i class="fas fa-rocket" style="color:#fff;font-size:.9rem;"></i>
          </div>
          <div style="flex:1;">
            <div style="font-size:.95rem;font-weight:600;color:#1e293b;">Primeiros passos</div>
            <div style="font-size:.78rem;color:#64748b;">${done} de ${total} concluídos</div>
          </div>
          <button id="slc-checklist-dismiss" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:.8rem;padding:4px;" title="Fechar">✕</button>
        </div>

        <div style="background:#f1f5f9;border-radius:8px;height:6px;margin-bottom:1rem;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#2563eb,#4f46e5);border-radius:8px;transition:width .4s;"></div>
        </div>

        <div style="display:flex;flex-direction:column;gap:2px;">
          ${items}
        </div>
      </div>
    `;
  }

  // ─── Injeção no dashboard ──────────────────────────────────────────────────

  function injectChecklistIntoDashboard() {
    const content = document.getElementById('content-area');
    if (!content) return;

    const header = content.querySelector('.dashboard-header');
    if (!header) return;

    const app = window.app;
    const data = app?.data;

    if (!data || allDone(data)) return;

    // Evita duplicação
    if (document.getElementById('slc-onboarding-card')) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'slc-onboarding-wrapper';
    wrapper.innerHTML = renderChecklistCard(data);
    header.insertAdjacentElement('afterend', wrapper);

    // Clique nos itens: navega para a view
    wrapper.querySelectorAll('.slc-checklist-item:not(.slc-checklist-done)').forEach(item => {
      item.addEventListener('mouseenter', () => { item.style.background = '#f8fafc'; });
      item.addEventListener('mouseleave', () => { item.style.background = ''; });
      item.addEventListener('click', () => {
        const view = item.dataset.view;
        const stepId = item.dataset.step;
        if (view && app?.loadView) {
          saveStepDone(stepId);
          app.loadView(view);
        }
      });
    });

    // Dismiss
    const dismissBtn = wrapper.querySelector('#slc-checklist-dismiss');
    dismissBtn?.addEventListener('click', () => {
      // Marca como descartado por 7 dias
      const state = loadState();
      state.__dismissed_until = Date.now() + 7 * 24 * 60 * 60 * 1000;
      saveState(state);
      wrapper.remove();
    });
  }

  // ─── Detectar usuário novo ─────────────────────────────────────────────────

  function isNewUser(data) {
    const subjects = data?.subjects?.length || 0;
    const tasks = data?.tasks?.length || 0;
    const sessions = data?.sessions?.length || 0;
    return subjects + tasks + sessions < 3;
  }

  function wasDismissedRecently() {
    const state = loadState();
    return state.__dismissed_until && Date.now() < state.__dismissed_until;
  }

  // ─── Hook no loadView do app ───────────────────────────────────────────────

  function patchApp() {
    const app = window.app;
    if (!app || app.__onboardingPatched) return;
    app.__onboardingPatched = true;

    const _origLoadView = app.loadView?.bind(app);
    if (!_origLoadView) return;

    window.app.loadView = function (view) {
      const result = _origLoadView(view);

      if (view === 'dashboard') {
        setTimeout(() => {
          const data = window.app?.data;
          if (!data || wasDismissedRecently()) return;
          injectChecklistIntoDashboard();

        }, 150);
      }

      // Marcar passo quando muda de view (ex: abriu tarefas após criar)
      setTimeout(() => {
        const data = window.app?.data;
        if (!data) return;
        STEPS.forEach(step => {
          if (step.check(data)) saveStepDone(step.id);
        });
        // Atualizar checklist se estiver visível
        const wrapper = document.getElementById('slc-onboarding-wrapper');
        if (wrapper && document.getElementById('slc-onboarding-card')) {
          if (allDone(data)) {
            wrapper.remove();
            if (typeof showToast === 'function') showToast('🎉 Você completou todos os primeiros passos! Bem-vindo ao SLCampus.', 'success');
          } else {
            wrapper.innerHTML = renderChecklistCard(data);
            // Re-bind events
            wrapper.querySelectorAll('.slc-checklist-item:not(.slc-checklist-done)').forEach(item => {
              item.addEventListener('mouseenter', () => { item.style.background = '#f8fafc'; });
              item.addEventListener('mouseleave', () => { item.style.background = ''; });
              item.addEventListener('click', () => {
                const v = item.dataset.view;
                const s = item.dataset.step;
                if (v && window.app?.loadView) {
                  saveStepDone(s);
                  window.app.loadView(v);
                }
              });
            });
            const dismissBtn = wrapper.querySelector('#slc-checklist-dismiss');
            dismissBtn?.addEventListener('click', () => {
              const state = loadState();
              state.__dismissed_until = Date.now() + 7 * 24 * 60 * 60 * 1000;
              saveState(state);
              wrapper.remove();
            });
          }
        }
      }, 600);

      return result;
    };

    // O modo iniciante foi removido; garante que sessões antigas não deixem
    // o usuário preso em uma interface reduzida.
    setSimpleMode();
  }

  // ─── Marcar quando o usuário pergunta ao Mentor IA ─────────────────────────
  // Detecta qualquer submit no chat do mentor para marcar passo

  document.addEventListener('click', e => {
    const btn = e.target.closest('#btn-perguntar, .btn-ask-ia, [id*="perguntar-ia"], [id*="mentor-send"]');
    if (btn) {
      localStorage.setItem('slc_ia_first_asked', '1');
      saveStepDone('ask_ia');
    }
  });

  // ─── Init ──────────────────────────────────────────────────────────────────

  document.addEventListener('app-ready', () => {
    setTimeout(patchApp, 400);
  });

  // Fallback se o evento já passou
  if (window.app?.initialized) {
    setTimeout(patchApp, 100);
  }

  // ─── API pública ────────────────────────────────────────────────────────────
  window.SLCOnboarding = {
    reset() {
      localStorage.removeItem(STORAGE_KEY);
      if (typeof showToast === 'function') showToast('Onboarding resetado.', 'info');
    },
    setSimpleMode,
    isSimpleModeEnabled
  };

})();
