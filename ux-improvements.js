// ux-improvements.js — 7 melhorias de UX: Meu Dia, histórico IA, quick-add,
// offline, confirmação de delete, briefing diário, bottom nav mobile
(function () {
  'use strict';

  // ─── Visibilidade real do dashboard (não basta "window.app existir") ─────
  function isDashboardVisible() {
    const dash = document.getElementById('main-dashboard');
    const login = document.getElementById('login-screen');
    const setup = document.getElementById('setup-screen');
    const dashVisible = !!dash && getComputedStyle(dash).display !== 'none';
    const loginVisible = !!login && getComputedStyle(login).display !== 'none';
    const setupVisible = !!setup && getComputedStyle(setup).display !== 'none';
    return dashVisible && !loginVisible && !setupVisible;
  }

  function syncQuickAddVisibility() {
    const btn = document.getElementById('slc-quick-add-btn');
    const menu = document.getElementById('slc-quick-menu');
    if (!btn) {
      // Ainda não foi criado — tenta criar agora que o dashboard pode estar visível
      if (isDashboardVisible()) injectQuickAdd();
      return;
    }
    const shouldShow = isDashboardVisible();
    btn.style.display = shouldShow ? 'flex' : 'none';
    if (!shouldShow && menu) menu.hidden = true;
  }

  // ═══════════════════════════════════════════════════════════════
  // 1. CONFIRMAÇÃO DE DELETE BONITA (substitui window.confirm feio)
  // ═══════════════════════════════════════════════════════════════
  function showDeleteConfirm(msg, onConfirm) {
    const existing = document.getElementById('slc-confirm-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'slc-confirm-modal';
    modal.style.cssText = `
      position:fixed;inset:0;z-index:9999;
      display:flex;align-items:center;justify-content:center;
      background:rgba(2,6,23,0.65);backdrop-filter:blur(4px);
      animation:fadeIn .15s ease;
    `;
    modal.innerHTML = `
      <div style="
        background:var(--bg-secondary);border:1px solid var(--border);
        border-radius:var(--radius-lg);padding:28px 32px;max-width:380px;width:90%;
        box-shadow:0 25px 50px rgba(0,0,0,0.4);animation:slideUp .18s ease;
        text-align:center;
      ">
        <div style="width:48px;height:48px;border-radius:50%;background:rgba(239,68,68,.12);
          display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
          <i class="fas fa-trash" style="color:#ef4444;font-size:20px;"></i>
        </div>
        <h3 style="font-size:16px;font-weight:600;margin-bottom:8px;color:var(--text-primary);">Confirmar exclusão</h3>
        <p style="font-size:13px;color:var(--text-secondary);line-height:1.5;margin-bottom:24px;">${msg}</p>
        <div style="display:flex;gap:10px;justify-content:center;">
          <button id="slc-confirm-cancel" style="
            padding:9px 22px;border-radius:var(--radius-sm);border:1px solid var(--border);
            background:transparent;color:var(--text-primary);cursor:pointer;font-size:13px;
            font-family:inherit;transition:background .15s;
          ">Cancelar</button>
          <button id="slc-confirm-ok" style="
            padding:9px 22px;border-radius:var(--radius-sm);border:none;
            background:#ef4444;color:#fff;cursor:pointer;font-size:13px;font-weight:500;
            font-family:inherit;transition:opacity .15s;
          ">Excluir</button>
        </div>
      </div>`;

    document.body.appendChild(modal);
    document.getElementById('slc-confirm-cancel').onclick = () => modal.remove();
    document.getElementById('slc-confirm-ok').onclick = () => { modal.remove(); onConfirm(); };
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  }

  // Substitui window.confirm por modal bonito para todas as exclusões
  function patchDeleteConfirms() {
    if (!window.StudyLifeControl) return;
    if (window.StudyLifeControl.prototype.__deletePatched) return;
    const proto = window.StudyLifeControl.prototype;

    const DELETES = [
      { fn: 'excluirSessao',     msg: 'Excluir esta sessão de estudo?',     collection: 'sessions' },
      { fn: 'excluirTarefa',     msg: 'Excluir esta tarefa?',               collection: 'tasks' },
      { fn: 'excluirProva',      msg: 'Excluir esta prova/trabalho?',       collection: 'exams' },
      { fn: 'excluirMaterial',   msg: 'Excluir este material?',             collection: 'materials' },
      { fn: 'excluirNota',       msg: 'Excluir esta nota?',                 collection: 'grades' },
      { fn: 'excluirTopico',     msg: 'Excluir este tópico do mapa?',       collection: 'learningMap' },
    ];

    DELETES.forEach(({ fn, msg }) => {
      const orig = proto[fn];
      if (!orig) return;
      proto[fn] = function (id) {
        // Remove o window.confirm nativo chamando a função em modo "bypass"
        const self = this;
        showDeleteConfirm(msg, () => orig.call(self, id, true));
      };
    });

    // Patch especial para excluirMateria (tem confirm com texto longo)
    const origMateria = proto.excluirMateria;
    if (origMateria) {
      proto.excluirMateria = function (id) {
        const self = this;
        const mat = this.data?.subjects?.find(s => s.id === id);
        const nome = mat?.nome || 'esta matéria';
        showDeleteConfirm(
          `Excluir <strong>${nome}</strong>? Isso também remove todas as sessões, tarefas, provas, notas e materiais relacionados.`,
          () => origMateria.call(self, id, true)
        );
      };
    }

    proto.__deletePatched = true;
  }

  // Patch no window.confirm para interceptar os que ainda usam confirm() nativo
  const _origConfirm = window.confirm.bind(window);
  window.confirm = function (msg) {
    // Só intercepta confirmações de exclusão (contêm palavras-chave)
    if (msg && (msg.includes('excluir') || msg.includes('Excluir') || msg.includes('deletar') || msg.includes('remover'))) {
      // Retorna true para que o código continue — o modal bonito já foi mostrado
      // pelo patch acima. Para os que ainda usam confirm() direto, deixa passar.
      return _origConfirm(msg);
    }
    return _origConfirm(msg);
  };

  // ═══════════════════════════════════════════════════════════════
  // 2. HISTÓRICO PERSISTENTE DO MENTOR IA
  // ═══════════════════════════════════════════════════════════════
  const IA_HISTORY_KEY = 'slc-ia-history';
  const MAX_HISTORY = 30;

  function loadIAHistory() {
    try { return JSON.parse(localStorage.getItem(IA_HISTORY_KEY) || '[]'); } catch { return []; }
  }

  function saveIAHistory(history) {
    localStorage.setItem(IA_HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
  }

  function addToIAHistory(role, content) {
    const history = loadIAHistory();
    history.push({ role, content, ts: Date.now() });
    saveIAHistory(history);
  }

  function patchIAChat() {
    if (!window.StudyLifeControl) return;
    if (window.StudyLifeControl.prototype.__iaChatPatched) return;
    const proto = window.StudyLifeControl.prototype;
    const origSetupIA = proto.setupIAEvents;
    if (!origSetupIA) return;

    proto.setupIAEvents = function () {
      origSetupIA.call(this);

      const messages = document.getElementById('chat-messages');
      const input    = document.getElementById('chat-input');
      if (!messages || !input) return;

      // Injeta histórico salvo ao abrir o chat
      const history = loadIAHistory();
      if (history.length && !messages.dataset.historyLoaded) {
        messages.dataset.historyLoaded = '1';

        // Separador
        const sep = document.createElement('div');
        sep.style.cssText = 'text-align:center;color:var(--text-tertiary);font-size:11px;margin:8px 0;padding:4px;border-top:1px solid var(--border);';
        sep.textContent = `— ${history.length} mensagens anteriores —`;
        messages.insertBefore(sep, messages.firstChild);

        // Injeta mensagens antigas (últimas 10 para não sobrecarregar)
        const recent = history.slice(-10);
        recent.forEach(item => {
          const wrapper = document.createElement('div');
          wrapper.className = `message ${item.role}`;
          wrapper.style.opacity = '0.65';
          const contentEl = document.createElement('div');
          contentEl.className = 'message-content';
          const ts = new Date(item.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          contentEl.innerHTML = `<small style="display:block;font-size:10px;color:var(--text-tertiary);margin-bottom:3px;">${ts}</small>${item.role === 'assistant' ? item.content : item.content}`;
          wrapper.appendChild(contentEl);
          messages.insertBefore(wrapper, sep.nextSibling);
        });
      }

      // Intercepta envio para salvar no histórico
      const origSend = input.onkeypress;
      const chatSendBtn = document.getElementById('chat-send');

      const patchSend = () => {
        const text = input.value.trim();
        if (text) addToIAHistory('user', text);
      };

      chatSendBtn?.addEventListener('click', patchSend, { capture: true });
      input.addEventListener('keypress', e => { if (e.key === 'Enter') patchSend(); }, { capture: true });

      // Observa novas respostas da IA para salvar
      const observer = new MutationObserver(muts => {
        muts.forEach(m => {
          m.addedNodes.forEach(node => {
            if (node.classList?.contains('message') && node.classList?.contains('assistant') && !node.classList?.contains('loading')) {
              const content = node.querySelector('.message-content')?.textContent?.trim();
              if (content && content !== 'Pensando...') addToIAHistory('assistant', content);
            }
          });
        });
      });
      observer.observe(messages, { childList: true });
    };

    proto.__iaChatPatched = true;
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. VIEW "MEU DIA" — Cronograma unificado de hoje
  // ═══════════════════════════════════════════════════════════════
  function buildMeuDiaView() {
    const app = window.app;
    if (!app) return '<p style="color:var(--text-secondary)">Carregando...</p>';

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const diaSemana = today.getDay();
    const diasNomes = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

    // Coleta aulas de hoje
    const aulas = (window.scheduleManager?.getAulasPorDia?.(diaSemana) || []).map(a => ({
      tipo: 'aula', hora: a.inicio || '00:00', horaFim: a.fim || '',
      titulo: a.materia || 'Aula', sub: a.sala ? `Sala ${a.sala}` : a.professor || '',
      cor: a.cor || 'var(--accent-primary)', icone: 'fa-chalkboard-teacher'
    }));

    // Coleta sessões de hoje
    const sessoes = (app.data?.sessions || [])
      .filter(s => !s.completada && (s.data || todayStr).slice(0, 10) === todayStr)
      .map(s => ({
        tipo: 'sessao', hora: s.horario || s.hora || '08:00', horaFim: '',
        titulo: `Estudar ${s.materia || ''}`, sub: `${s.duracao || 25} min · ${s.tipo || 'revisão'}`,
        cor: 'var(--accent-secondary)', icone: 'fa-clock', id: s.id
      }));

    // Coleta tarefas com prazo hoje ou atrasadas
    const tarefas = (app.data?.tasks || [])
      .filter(t => !t.concluida && t.dataLimite && t.dataLimite.slice(0, 10) <= todayStr)
      .map(t => ({
        tipo: 'tarefa', hora: t.horario || '23:59', horaFim: '',
        titulo: t.titulo || 'Tarefa', sub: `${t.materia || ''} · ${t.dataLimite === todayStr ? 'vence hoje' : 'atrasada'}`,
        cor: t.dataLimite < todayStr ? 'var(--accent-danger)' : 'var(--accent-warning)', icone: 'fa-tasks', id: t.id
      }));

    // Coleta provas de hoje
    const provas = (app.data?.exams || [])
      .filter(e => !e.concluida && e.data && e.data.slice(0, 10) === todayStr)
      .map(e => ({
        tipo: 'prova', hora: e.horario || '08:00', horaFim: '',
        titulo: e.titulo || 'Prova', sub: e.materia || '',
        cor: '#ef4444', icone: 'fa-graduation-cap', id: e.id
      }));

    const itens = [...aulas, ...sessoes, ...tarefas, ...provas]
      .sort((a, b) => a.hora.localeCompare(b.hora));

    const formatHora = h => h && h.length >= 5 ? h.slice(0, 5) : h;

    const tipoLabel = { aula: 'Aula', sessao: 'Sessão', tarefa: 'Tarefa', prova: 'Prova' };
    const tipoBg = {
      aula: 'rgba(59,130,246,.1)', sessao: 'rgba(139,92,246,.1)',
      tarefa: 'rgba(245,158,11,.1)', prova: 'rgba(239,68,68,.1)'
    };

    if (!itens.length) {
      return `
        <h2 style="margin-bottom:4px"><i class="fas fa-calendar-day"></i> Meu Dia</h2>
        <p style="color:var(--text-secondary);margin-bottom:24px;">${diasNomes[diaSemana]}, ${today.toLocaleDateString('pt-BR',{day:'2-digit',month:'long'})}</p>
        <div class="card" style="text-align:center;padding:48px 24px;">
          <i class="fas fa-check-circle" style="font-size:48px;color:var(--accent-success);margin-bottom:16px;display:block;"></i>
          <h3 style="margin-bottom:8px;">Dia livre!</h3>
          <p style="color:var(--text-secondary);">Nenhuma aula, tarefa ou prova para hoje.</p>
        </div>`;
    }

    return `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
        <h2><i class="fas fa-calendar-day"></i> Meu Dia</h2>
        <span style="font-size:13px;color:var(--text-secondary);">${itens.length} item${itens.length > 1 ? 's' : ''}</span>
      </div>
      <p style="color:var(--text-secondary);margin-bottom:24px;">${diasNomes[diaSemana]}, ${today.toLocaleDateString('pt-BR',{day:'2-digit',month:'long'})}</p>

      <div style="display:flex;flex-direction:column;gap:10px;">
        ${itens.map(item => `
          <div class="card" style="display:flex;align-items:center;gap:16px;padding:14px 18px;
            border-left:3px solid ${item.cor};cursor:default;
            transition:transform .15s,box-shadow .15s;"
            onmouseover="this.style.transform='translateX(3px)'"
            onmouseout="this.style.transform=''"
          >
            <div style="width:40px;height:40px;border-radius:10px;background:${tipoBg[item.tipo]};
              display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <i class="fas ${item.icone}" style="color:${item.cor};font-size:16px;"></i>
            </div>
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;">
                <strong style="font-size:14px;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.titulo}</strong>
                <span style="font-size:11px;padding:2px 8px;border-radius:999px;background:${tipoBg[item.tipo]};color:${item.cor};white-space:nowrap;flex-shrink:0;">${tipoLabel[item.tipo]}</span>
              </div>
              <span style="font-size:12px;color:var(--text-secondary);">${item.sub}</span>
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <div style="font-size:14px;font-weight:600;color:var(--text-primary);">${formatHora(item.hora)}</div>
              ${item.horaFim ? `<div style="font-size:11px;color:var(--text-tertiary);">até ${formatHora(item.horaFim)}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>`;
  }

  function injectMeuDiaView() {
    if (!window.ViewRenderer) return;
    if (window.ViewRenderer.prototype.renderMeuDia) return;
    window.ViewRenderer.prototype.renderMeuDia = buildMeuDiaView;
  }

  // Adiciona item de Meu Dia na sidebar
  function injectMeuDiaNav() {
    const nav = document.getElementById('sidebar-nav');
    if (!nav || nav.querySelector('[data-view="meu-dia"]')) return;
    const item = document.createElement('a');
    item.href = '#';
    item.className = 'nav-item';
    item.dataset.view = 'meu-dia';
    item.innerHTML = '<i class="fas fa-calendar-day"></i><span>Meu Dia</span>';
    item.style.cssText = 'background:linear-gradient(90deg,rgba(59,130,246,.08),transparent);border-left:2px solid var(--accent-primary);';
    item.addEventListener('click', e => {
      e.preventDefault();
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      if (window.app?.loadView) window.app.loadView('meu-dia');
    });
    // Insere logo após Dashboard
    const dash = nav.querySelector('[data-view="dashboard"]');
    if (dash?.nextSibling) nav.insertBefore(item, dash.nextSibling);
    else nav.insertBefore(item, nav.firstChild);
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. BRIEFING DIÁRIO DA IA NO DASHBOARD
  // ═══════════════════════════════════════════════════════════════
  const BRIEFING_KEY = 'slc-briefing';

  function shouldRegenerateBriefing() {
    try {
      const saved = JSON.parse(localStorage.getItem(BRIEFING_KEY) || '{}');
      const today = new Date().toISOString().slice(0, 10);
      return saved.date !== today;
    } catch { return true; }
  }

  function saveBriefing(text) {
    localStorage.setItem(BRIEFING_KEY, JSON.stringify({ date: new Date().toISOString().slice(0, 10), text }));
  }

  function loadBriefing() {
    try { return JSON.parse(localStorage.getItem(BRIEFING_KEY) || '{}').text || ''; } catch { return ''; }
  }

  function injectBriefingCard() {
    const container = document.getElementById('view-container');
    if (!container || document.getElementById('slc-briefing-card')) return;
    if (window.app?.currentView !== 'dashboard') return;

    const saved = loadBriefing();
    const card = document.createElement('div');
    card.id = 'slc-briefing-card';
    card.className = 'card';
    card.style.cssText = 'margin-bottom:20px;border-left:3px solid var(--accent-primary);';
    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <h3 style="font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px;">
          <i class="fas fa-robot" style="color:var(--accent-primary);"></i> Briefing do dia
        </h3>
        <button id="slc-refresh-briefing" style="
          background:none;border:1px solid var(--border);border-radius:8px;
          padding:3px 10px;font-size:11px;color:var(--text-secondary);cursor:pointer;font-family:inherit;
        ">Atualizar</button>
      </div>
      <div id="slc-briefing-text" style="font-size:13px;color:var(--text-secondary);line-height:1.6;">
        ${saved ? saved : '<span style="opacity:.6">Gerando briefing...</span>'}
      </div>`;

    container.insertBefore(card, container.firstChild);

    if (!saved || shouldRegenerateBriefing()) generateBriefing();

    document.getElementById('slc-refresh-briefing')?.addEventListener('click', () => generateBriefing(true));
  }

  async function generateBriefing(force = false) {
    if (!force && !shouldRegenerateBriefing()) return;
    const app = window.app;
    if (!app || !window.aiAssistant) return;

    const textEl = document.getElementById('slc-briefing-text');
    if (textEl) textEl.innerHTML = '<span style="opacity:.6"><i class="fas fa-spinner fa-spin"></i> Gerando briefing...</span>';

    try {
      window.aiAssistant.updateContext?.(app.data);
      const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
      const resp = await window.aiAssistant.ask(
        `Em 3 linhas curtas e diretas, me dá um briefing rápido do meu dia de hoje (${today}): ` +
        `menciona as provas/aulas mais importantes, tarefas com prazo hoje e uma dica de foco. ` +
        `Sem introdução, vai direto ao ponto.`
      );
      if (resp) {
        saveBriefing(resp);
        if (textEl) textEl.innerHTML = resp.replace(/\n/g, '<br>');
      }
    } catch (e) {
      if (textEl) textEl.innerHTML = '<span style="opacity:.6">Não foi possível gerar o briefing agora.</span>';
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. QUICK ADD — Botão + global para adicionar rápido
  // ═══════════════════════════════════════════════════════════════
  function injectQuickAdd() {
    if (document.getElementById('slc-quick-add-btn')) return;
    // Só mostra quando o dashboard está mesmo na tela — window.app existe
    // desde o carregamento da página, então checar só isso fazia o botão
    // aparecer até na tela de login.
    if (!isDashboardVisible()) return;

    const btn = document.createElement('button');
    btn.id = 'slc-quick-add-btn';
    btn.innerHTML = '<i class="fas fa-plus"></i>';
    btn.setAttribute('title', 'Adicionar rápido (Q)');
    btn.style.cssText = `
      position:fixed;bottom:28px;right:88px;z-index:997;
      width:48px;height:48px;border-radius:50%;
      background:var(--accent-primary);color:#fff;border:none;
      font-size:18px;cursor:pointer;
      box-shadow:0 8px 24px rgba(59,130,246,.4);
      display:flex;align-items:center;justify-content:center;
      transition:transform .2s,box-shadow .2s;
    `;
    btn.onmouseover = () => { btn.style.transform = 'scale(1.1)'; };
    btn.onmouseout  = () => { btn.style.transform = 'scale(1)'; };
    btn.onclick = () => toggleQuickMenu();
    document.body.appendChild(btn);

    // Menu radial
    const menu = document.createElement('div');
    menu.id = 'slc-quick-menu';
    menu.hidden = true;
    menu.style.cssText = `
      position:fixed;bottom:88px;right:88px;z-index:996;
      display:flex;flex-direction:column;align-items:flex-end;gap:10px;
    `;

    const items = [
      { icon: 'fa-clock',        label: 'Sessão',  action: () => goTo('sessoes'),  color: 'var(--accent-secondary)' },
      { icon: 'fa-tasks',        label: 'Tarefa',  action: () => goTo('tarefas'),  color: 'var(--accent-warning)' },
      { icon: 'fa-graduation-cap', label: 'Prova', action: () => goTo('provas'),   color: '#ef4444' },
      { icon: 'fa-calendar-week', label: 'Aula',   action: () => goTo('grade-horaria'), color: 'var(--accent-primary)' },
      { icon: 'fa-comment-dots', label: 'Feedback', action: () => window.openFeedbackModal?.(), color: '#4f46e5' },
    ];

    items.forEach(item => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:10px;';
      row.innerHTML = `
        <span style="
          background:var(--bg-secondary);border:1px solid var(--border);
          border-radius:8px;padding:4px 12px;font-size:12px;color:var(--text-primary);
          white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.2);
        ">${item.label}</span>
        <button style="
          width:40px;height:40px;border-radius:50%;background:${item.color};
          color:#fff;border:none;cursor:pointer;font-size:15px;
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 4px 12px rgba(0,0,0,.25);transition:transform .15s;
        " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform=''">
          <i class="fas ${item.icon}"></i>
        </button>`;
      row.querySelector('button').onclick = () => { toggleQuickMenu(false); item.action(); };
      row.querySelector('span').onclick   = () => { toggleQuickMenu(false); item.action(); };
      menu.appendChild(row);
    });

    document.body.appendChild(menu);

    // Fecha ao clicar fora
    document.addEventListener('click', e => {
      if (!btn.contains(e.target) && !menu.contains(e.target)) toggleQuickMenu(false);
    });

    // Atalho Q
    document.addEventListener('keydown', e => {
      if (e.key === 'q' || e.key === 'Q') {
        const active = document.activeElement;
        if (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA') toggleQuickMenu();
      }
    });
  }

  let _quickMenuOpen = false;
  function toggleQuickMenu(force) {
    const menu = document.getElementById('slc-quick-menu');
    const btn  = document.getElementById('slc-quick-add-btn');
    if (!menu) return;
    _quickMenuOpen = force !== undefined ? force : !_quickMenuOpen;
    menu.hidden = !_quickMenuOpen;
    if (btn) btn.style.transform = _quickMenuOpen ? 'rotate(45deg) scale(1.1)' : 'scale(1)';
  }

  function goTo(view) {
    if (window.app?.loadView) {
      window.app.loadView(view);
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.querySelector(`[data-view="${view}"]`)?.classList.add('active');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. OFFLINE — Firebase IndexedDB persistence + banner
  // ═══════════════════════════════════════════════════════════════
  function enableOfflinePersistence() {
    if (window.__slcOfflineEnabled) return;
    window.__slcOfflineEnabled = true;

    try {
      if (window.db && window.db.enablePersistence) {
        window.db.enablePersistence({ synchronizeTabs: true }).catch(err => {
          if (err.code === 'failed-precondition') {
            console.warn('[SLC Offline] Múltiplas abas abertas — persistence só ativa numa aba por vez.');
          } else if (err.code === 'unimplemented') {
            console.warn('[SLC Offline] Navegador não suporta offline persistence.');
          }
        });
      }
    } catch (e) { console.warn('[SLC Offline] Erro ao ativar persistence:', e); }

    // Banner de status de conexão
    let offlineBanner = null;

    function showOfflineBanner() {
      if (offlineBanner) return;
      offlineBanner = document.createElement('div');
      offlineBanner.style.cssText = `
        position:fixed;top:0;left:0;right:0;z-index:9990;
        background:#f59e0b;color:#0f172a;
        padding:8px 16px;text-align:center;font-size:13px;font-weight:500;
        display:flex;align-items:center;justify-content:center;gap:8px;
      `;
      offlineBanner.innerHTML = '<i class="fas fa-wifi" style="opacity:.6"></i> Você está offline — os dados estão salvos localmente';
      document.body.appendChild(offlineBanner);
    }

    function hideOfflineBanner() {
      if (offlineBanner) { offlineBanner.remove(); offlineBanner = null; }
    }

    window.addEventListener('offline', showOfflineBanner);
    window.addEventListener('online', () => {
      hideOfflineBanner();
      if (window.showToast) window.showToast('Conexão restaurada! Sincronizando...', 'success');
    });

    if (!navigator.onLine) showOfflineBanner();
  }

  // ═══════════════════════════════════════════════════════════════
  // 7. BOTTOM NAV MOBILE
  // ═══════════════════════════════════════════════════════════════
  function injectBottomNav() {
    if (document.getElementById('slc-bottom-nav')) return;
    if (window.innerWidth > 768) return;

    const nav = document.createElement('nav');
    nav.id = 'slc-bottom-nav';
    nav.style.cssText = `
      position:fixed;bottom:0;left:0;right:0;z-index:200;
      background:var(--bg-secondary);border-top:1px solid var(--border);
      display:flex;align-items:center;justify-content:space-around;
      padding:8px 0 calc(8px + env(safe-area-inset-bottom));
      backdrop-filter:blur(10px);
    `;

    const tabs = [
      { view: 'dashboard',  icon: 'fa-chart-pie',      label: 'Início' },
      { view: 'meu-dia',    icon: 'fa-calendar-day',   label: 'Hoje' },
      { view: 'tarefas',    icon: 'fa-tasks',           label: 'Tarefas' },
      { view: 'mentor-ia',  icon: 'fa-robot',           label: 'IA' },
      { view: 'sessoes',    icon: 'fa-clock',           label: 'Sessões' },
    ];

    tabs.forEach(tab => {
      const btn = document.createElement('button');
      btn.dataset.bottomView = tab.view;
      btn.style.cssText = `
        display:flex;flex-direction:column;align-items:center;gap:3px;
        background:none;border:none;cursor:pointer;padding:4px 12px;
        color:var(--text-tertiary);font-family:inherit;transition:color .15s;min-width:0;
      `;
      btn.innerHTML = `
        <i class="fas ${tab.icon}" style="font-size:18px;"></i>
        <span style="font-size:10px;font-weight:500;">${tab.label}</span>`;
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-bottom-view]').forEach(b => b.style.color = 'var(--text-tertiary)');
        btn.style.color = 'var(--accent-primary)';
        goTo(tab.view);
        // Fecha sidebar se aberta
        window.SLCSidebar?.close();
      });
      nav.appendChild(btn);
    });

    document.body.appendChild(nav);

    // Adiciona padding no conteúdo principal para não ficar atrás do nav
    const style = document.createElement('style');
    style.textContent = `
      @media (max-width: 768px) {
        .main-content { padding-bottom: 72px !important; }
        #slc-quick-add-btn { bottom: 90px !important; }
        #slc-quick-menu { bottom: 154px !important; }
      }
    `;
    document.head.appendChild(style);

    // Atualiza aba ativa quando loadView é chamado
    const origLoadView = window.app?.loadView?.bind(window.app);
    if (origLoadView && window.app) {
      window.app.loadView = function (view) {
        origLoadView(view);
        setTimeout(() => {
          document.querySelectorAll('[data-bottom-view]').forEach(b => {
            b.style.color = b.dataset.bottomView === view ? 'var(--accent-primary)' : 'var(--text-tertiary)';
          });
        }, 50);
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // INIT — aplica tudo após carregamento dos módulos
  // ═══════════════════════════════════════════════════════════════
  function tryInit() {
    const app = window.app;
    const ViewRenderer = window.ViewRenderer;
    const StudyLifeControl = window.StudyLifeControl;

    if (StudyLifeControl) {
      patchDeleteConfirms();
      patchIAChat();
    }

    if (ViewRenderer) {
      injectMeuDiaView();
    }

    if (app) {
      injectMeuDiaNav();
      injectQuickAdd();
      enableOfflinePersistence();

      // Briefing: injeta no dashboard quando carregado
      const origLoadView = app._origLoadViewForBriefing || app.loadView;
      if (origLoadView && !app._origLoadViewForBriefing) {
        app._origLoadViewForBriefing = origLoadView.bind(app);
        const patchedLoad = function (view) {
          app._origLoadViewForBriefing(view);
          if (view === 'dashboard') {
            setTimeout(injectBriefingCard, 200);
          }
        };
        // Only patch if loadView wasn't already patched by bottom nav
        if (!app.__loadViewBriefingPatched) {
          app.loadView = patchedLoad;
          app.__loadViewBriefingPatched = true;
        }
      }

      // Mobile bottom nav
      if (window.innerWidth <= 768) {
        setTimeout(injectBottomNav, 300);
      }
    }

    if (window.db) {
      enableOfflinePersistence();
    }
  }

  // Inicia na view atual se já for dashboard
  function onDashboardReady() {
    if (window.app?.currentView === 'dashboard') {
      setTimeout(injectBriefingCard, 400);
    }
    setTimeout(injectMeuDiaNav, 100);
  }

  document.addEventListener('DOMContentLoaded', () => {
    let attempts = 0;
    const interval = setInterval(() => {
      tryInit();
      onDashboardReady();
      syncQuickAddVisibility();
      if ((window.app && window.ViewRenderer && window.StudyLifeControl) || ++attempts > 20) {
        clearInterval(interval);
      }
    }, 400);

    // Observa as 3 telas e liga/desliga o botão + junto com elas
    ['login-screen', 'setup-screen', 'main-dashboard'].forEach(id => {
      const node = document.getElementById(id);
      if (node) new MutationObserver(syncQuickAddVisibility).observe(node, { attributes: true, attributeFilter: ['style', 'class'] });
    });
  });

  // Reexecuta quando app emite eventos
  document.addEventListener('app-ready', () => { tryInit(); onDashboardReady(); syncQuickAddVisibility(); });
  document.addEventListener('view-loaded', () => {
    if (window.app?.currentView === 'dashboard') setTimeout(injectBriefingCard, 200);
    if (window.innerWidth <= 768 && !document.getElementById('slc-bottom-nav')) injectBottomNav();
  });

  // Resize: injeta/remove bottom nav conforme largura
  window.addEventListener('resize', () => {
    if (window.innerWidth <= 768) {
      if (!document.getElementById('slc-bottom-nav')) injectBottomNav();
    } else {
      document.getElementById('slc-bottom-nav')?.remove();
    }
  });

})();
