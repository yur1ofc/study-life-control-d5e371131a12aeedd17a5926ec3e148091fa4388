/* SLCampus Focus Engine v16
 * Timer based on real elapsed time, not setInterval ticks.
 * Survives tab switching/reload via localStorage and keeps break manual.
 */
(function () {
  'use strict';

  const VERSION = 2;
  const STORAGE_PREFIX = 'slc-focus-v2:';
  const TICK_MS = 250;

  const safe = (fn, fallback = null) => { try { return fn(); } catch (_) { return fallback; } };
  const uid = () => window.auth?.currentUser?.uid || window.app?.data?.user?.email || 'local';
  const key = () => `${STORAGE_PREFIX}${uid()}`;
  const now = () => Date.now();
  const clamp = (n, min, max) => Math.max(min, Math.min(max, Number(n) || 0));

  function defaultState() {
    return {
      version: VERSION,
      status: 'idle', // idle | running-focus | overtime | break | paused
      subject: '',
      topic: '',
      sessionId: null,
      mode: 'pomodoro',
      focusTargetSec: 25 * 60,
      focusAccumulatedSec: 0,
      focusStartedAt: null,
      breakDurationSec: 5 * 60,
      breakStartedAt: null,
      totalBreakSec: 0,
      lastSavedAt: null,
      focusEndNotified: false,
      breakEndNotified: false,
      startedAt: null,
      lastActivityAt: null
    };
  }

  function load() {
    const raw = safe(() => localStorage.getItem(key()), null);
    if (!raw) return defaultState();
    const parsed = safe(() => JSON.parse(raw), null);
    if (!parsed || parsed.version !== VERSION) return defaultState();
    return { ...defaultState(), ...parsed };
  }

  function save(state) {
    state.lastSavedAt = now();
    safe(() => localStorage.setItem(key(), JSON.stringify(state)));
  }

  function clearSaved() { safe(() => localStorage.removeItem(key())); }

  function focusElapsed(state, at = now()) {
    const base = Math.max(0, Number(state.focusAccumulatedSec) || 0);
    if ((state.status === 'running-focus' || state.status === 'overtime') && state.focusStartedAt) {
      return base + Math.max(0, (at - state.focusStartedAt) / 1000);
    }
    return base;
  }

  function breakElapsed(state, at = now()) {
    const base = Math.max(0, Number(state.totalBreakSec) || 0);
    if (state.status === 'break' && state.breakStartedAt) {
      return base + Math.max(0, (at - state.breakStartedAt) / 1000);
    }
    return base;
  }

  // Heurística operacional, não uma regra médica: aproximadamente 5 min de
  // pausa para cada 25 min de foco, com limites para evitar pausas absurdas.
  function recommendedBreak(focusSeconds) {
    const minutes = Math.max(0, focusSeconds / 60);
    if (minutes <= 0) return 5;
    return clamp(Math.ceil(minutes / 25) * 5, 5, 20);
  }

  function getTodayFocusMinutes() {
    const app = window.app;
    if (!app?.data) return 0;
    const today = new Date();
    const y = today.getFullYear(), m = today.getMonth(), d = today.getDate();
    return (app.data.sessions || []).reduce((sum, s) => {
      if (!s?.concluida || s.tipo !== 'foco') return sum;
      const dt = new Date(s.data || 0);
      if (dt.getFullYear() !== y || dt.getMonth() !== m || dt.getDate() !== d) return sum;
      return sum + Number(s.duracaoReal ?? s.duracao ?? 0);
    }, 0);
  }

  function notify(title, body, tag) {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        if (navigator.serviceWorker?.ready) {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(title, {
              body,
              tag: tag || `slc-focus-${Date.now()}`,
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              requireInteraction: true,
              data: { view: 'foco' }
            }).catch(() => new Notification(title, { body, tag }));
          }).catch(() => new Notification(title, { body, tag }));
        } else {
          new Notification(title, { body, tag });
        }
      }
    } catch (_) { /* browser may block notifications in this context */ }

    try {
      window.app && window.app.currentView !== 'foco' && showToast?.(body, 'info');
    } catch (_) {}
  }

  function fmt(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h > 0
      ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function getState() {
    if (!window.__SLCFocusState) window.__SLCFocusState = load();
    return window.__SLCFocusState;
  }

  function syncLegacyFields(app, state) {
    if (!app) return;
    app.timerRunning = ['running-focus', 'overtime', 'break'].includes(state.status);
    const fElapsed = focusElapsed(state);
    const bElapsed = breakElapsed(state);
    if (state.status === 'break') {
      app.timerDuration = state.breakDurationSec;
      app.timerSeconds = Math.max(0, state.breakDurationSec - bElapsed);
    } else if (state.status === 'overtime') {
      app.timerDuration = state.focusTargetSec;
      app.timerSeconds = 0;
    } else {
      app.timerDuration = state.focusTargetSec;
      app.timerSeconds = Math.max(0, state.focusTargetSec - fElapsed);
    }
    app.timerStartedAt = state.focusStartedAt || state.breakStartedAt || null;
    app.focusMateria = state.subject || app.focusMateria || '';
    app.focusLinkedSessionId = state.sessionId || app.focusLinkedSessionId || null;
  }

  function setFocusStatusUI() {
    const app = window.app;
    const state = getState();
    const display = document.getElementById('timer-display');
    const phase = document.getElementById('focus-phase-label');
    const summary = document.getElementById('focus-cycle-summary');
    const next = document.getElementById('focus-next-action');
    const nextBtn = document.getElementById('focus-next-button');
    const breakBtn = document.getElementById('focus-break-start');
    const pause = document.getElementById('timer-pause');
    const start = document.getElementById('timer-start');
    const reset = document.getElementById('timer-reset');
    const meta = document.getElementById('focus-engine-meta');
    const action = document.getElementById('focus-finish-session');

    if (!display) return;
    syncLegacyFields(app, state);

    const fElapsed = focusElapsed(state);
    const bElapsed = breakElapsed(state);
    const target = Number(state.focusTargetSec) || 1500;

    if (state.status === 'overtime') display.textContent = `+${fmt(fElapsed - target)}`;
    else if (state.status === 'break') display.textContent = fmt(Math.max(0, state.breakDurationSec - bElapsed));
    else display.textContent = fmt(Math.max(0, target - fElapsed));

    if (phase) {
      const labels = {
        idle: '<i class="fas fa-brain"></i> Pronto para focar',
        paused: '<i class="fas fa-pause"></i> Pausado',
        'running-focus': '<i class="fas fa-brain"></i> Foco',
        overtime: '<i class="fas fa-bolt"></i> Foco extra — continue estudando',
        break: '<i class="fas fa-mug-hot"></i> Descanso'
      };
      phase.innerHTML = labels[state.status] || labels.idle;
    }

    const subject = state.subject || 'sem matéria específica';
    const breakMin = recommendedBreak(fElapsed);
    if (summary) {
      if (state.status === 'overtime') {
        summary.textContent = `${subject} • você ultrapassou o bloco. O tempo extra continua contando como estudo. Pausa sugerida: ${breakMin} min.`;
      } else if (state.status === 'break') {
        summary.textContent = `Descanso manual de ${Math.round(state.breakDurationSec / 60)} min. Ele só começou porque você apertou o botão.`;
      } else {
        summary.textContent = `${subject} • ${Math.floor(fElapsed / 60)} min estudados • próxima pausa sugerida: ${breakMin} min.`;
      }
    }

    if (next) next.classList.toggle('is-visible', state.status === 'overtime');
    if (nextBtn) nextBtn.innerHTML = `<i class="fas fa-mug-hot"></i> Iniciar descanso (${breakMin} min)`;
    if (breakBtn) {
      breakBtn.innerHTML = `<i class="fas fa-mug-hot"></i> ${state.status === 'break' ? 'Descanso em andamento' : `Descanso ${breakMin} min`}`;
      breakBtn.disabled = state.status !== 'overtime' && state.status !== 'paused';
      breakBtn.title = breakBtn.disabled ? 'Conclua o bloco de foco para liberar o descanso' : 'Iniciar descanso manualmente';
    }
    if (pause) pause.style.display = ['running-focus','overtime','break'].includes(state.status) ? 'inline-block' : 'none';
    if (start) start.style.display = ['running-focus','overtime','break'].includes(state.status) ? 'none' : 'inline-block';
    if (reset) reset.style.display = state.status === 'idle' ? 'none' : 'inline-block';
    if (action) action.style.display = fElapsed >= 60 ? 'inline-flex' : 'none';

    if (meta) {
      const today = getTodayFocusMinutes() + (state.status !== 'break' ? fElapsed / 60 : 0);
      const targetMin = Number(app?.data?.user?.dailyStudyGoalHours || 3) * 60;
      const pct = targetMin ? Math.min(100, Math.round(today / targetMin * 100)) : 0;
      meta.innerHTML = `
        <div><span>Estudo nesta sessão</span><strong>${fmt(fElapsed)}</strong></div>
        <div><span>Hoje</span><strong>${(today/60).toFixed(1)}h / ${(targetMin/60).toFixed(1)}h</strong></div>
        <div><span>Progresso da meta</span><strong>${pct}%</strong></div>
        <div><span>Pausa sugerida</span><strong>${breakMin} min</strong></div>`;
    }
    const notif = document.getElementById('focus-engine-notification');
    if (notif) {
      const granted = ('Notification' in window && Notification.permission === 'granted');
      notif.innerHTML = granted
        ? '<span class="focus-notif-ok"><i class="fas fa-bell"></i> Notificações de foco ativadas neste dispositivo.</span>'
        : '<button type="button" class="btn-secondary btn-sm" id="focus-enable-notifications"><i class="fas fa-bell"></i> Ativar aviso quando o foco terminar</button>';
      document.getElementById('focus-enable-notifications')?.addEventListener('click', async () => {
        try {
          if (!('Notification' in window)) throw new Error('Este navegador não suporta notificações.');
          const result = await Notification.requestPermission();
          if (result !== 'granted') throw new Error('Permissão não concedida.');
          showToast?.('Avisos de foco ativados neste dispositivo.', 'success');
          setFocusStatusUI();
        } catch (e) { showToast?.(e.message || 'Não foi possível ativar as notificações.', 'info'); }
      }, { once: true });
    }
  }

  function selectedSubject() {
    const select = document.getElementById('timer-materia');
    return select?.value || window.app?.focusMateria || '';
  }

  function selectedSession() {
    const select = document.getElementById('timer-sessao-vinculada');
    return select?.value || window.app?.focusLinkedSessionId || null;
  }

  function durationFromUI() {
    const select = document.getElementById('timer-duracao');
    return clamp(Number(select?.value || 25), 5, 240) * 60;
  }

  function persistFocusContext(state) {
    const app = window.app;
    const subject = selectedSubject() || app?.pendingFocusMateria || state.subject || '';
    const sessionId = selectedSession() || state.sessionId || null;
    state.subject = subject;
    state.sessionId = sessionId;
    state.topic = document.getElementById('timer-topico')?.value || state.topic || '';
    save(state);
  }

  async function finalizeStudy(reason = 'manual') {
    const app = window.app;
    const state = getState();
    const elapsed = focusElapsed(state);
    if (elapsed < 60) {
      showToast?.('Estude pelo menos 1 minuto antes de concluir para registrar a sessão.', 'info');
      return false;
    }

    const minutes = Math.max(1, Math.round(elapsed / 60));
    const subject = state.subject || 'Modo Foco';
    const sessionId = state.sessionId;
    let success = false;

    if (sessionId && app?.data?.sessions) {
      const scheduled = app.data.sessions.find(s => s.id === sessionId && !s.concluida);
      if (scheduled) {
        success = await dbService.updateItem('sessions', sessionId, {
          concluida: true,
          duracaoReal: minutes,
          dataConclusao: new Date().toISOString(),
          estudoRealizado: minutes,
          motivoConclusao: reason
        });
        if (success) {
          Object.assign(scheduled, { concluida: true, duracaoReal: minutes, dataConclusao: new Date().toISOString(), estudoRealizado: minutes });
        }
      }
    }

    if (!success) {
      const item = {
        id: typeof generateId === 'function' ? generateId() : `focus-${Date.now()}`,
        materia: subject,
        tipo: 'foco',
        duracao: minutes,
        duracaoReal: minutes,
        data: new Date().toISOString(),
        concluida: true,
        topico: state.topic || 'Bloco de foco',
        origem: 'focus-engine-v16'
      };
      success = await dbService.addItem('sessions', item);
      if (success && window.app?.data?.sessions) window.app.data.sessions.push(item);
      if (success && window.reviewSystem?.gerarRevisoesFromSessao) {
        try { await window.reviewSystem.gerarRevisoesFromSessao(item); } catch (_) {}
      }
    }

    if (success) {
      app?.updateStreak?.();
      showToast?.(`Estudo registrado: ${minutes} min de ${subject}.`, 'success');
      clearSaved();
      window.__SLCFocusState = defaultState();
      if (app) {
        app.timerRunning = false;
        app.timerSeconds = 0;
        app.timerDuration = 0;
        app.focusLinkedSessionId = null;
        app.focusMateria = '';
      }
      app?.loadView?.(app.currentView || 'foco');
    }
    return success;
  }

  function startFocus(targetSec) {
    const state = getState();
    if (state.status === 'running-focus' || state.status === 'overtime') return;
    if (state.status === 'break') return;

    persistFocusContext(state);
    const sec = Number(targetSec) > 0 ? Number(targetSec) : durationFromUI();
    const wasPaused = state.status === 'paused';
    const hadFinishedBreak = Number(state.totalBreakSec || 0) > 0 && !state.breakStartedAt;
    state.focusTargetSec = sec;
    // Pausa manual conserva o bloco atual. Depois de um descanso concluído,
    // começa um bloco novo para que cada bloco tenha seu próprio alvo.
    state.focusAccumulatedSec = (wasPaused && !hadFinishedBreak) ? state.focusAccumulatedSec : 0;
    state.focusStartedAt = now();
    state.breakStartedAt = null;
    state.status = 'running-focus';
    state.focusEndNotified = false;
    state.startedAt = state.startedAt || new Date().toISOString();
    state.lastActivityAt = now();
    save(state);
    setFocusStatusUI();
  }

  function pause() {
    const state = getState();
    if (state.status === 'running-focus' || state.status === 'overtime') {
      state.focusAccumulatedSec = focusElapsed(state);
      state.focusStartedAt = null;
      state.status = 'paused';
    } else if (state.status === 'break') {
      state.totalBreakSec = breakElapsed(state);
      state.breakStartedAt = null;
      state.status = 'paused';
    } else return;
    save(state);
    setFocusStatusUI();
  }

  function startBreak() {
    const state = getState();
    const elapsed = focusElapsed(state);
    if (elapsed < 60) {
      showToast?.('Complete pelo menos 1 minuto de foco antes de iniciar o descanso.', 'info');
      return;
    }
    state.focusAccumulatedSec = elapsed;
    state.focusStartedAt = null;
    const minutes = recommendedBreak(elapsed);
    state.breakDurationSec = minutes * 60;
    state.totalBreakSec = 0;
    state.breakStartedAt = now();
    state.breakEndNotified = false;
    state.status = 'break';
    save(state);
    notify('Descanso iniciado', `${minutes} min de descanso. O foco só volta quando você apertar “Iniciar foco”.`, 'slc-break-start');
    setFocusStatusUI();
  }

  function resumeAfterBreak() {
    const state = getState();
    if (state.status !== 'paused') return;
    const hasFocus = focusElapsed(state) >= 60;
    if (hasFocus) {
      state.focusStartedAt = now();
      state.status = state.focusAccumulatedSec >= state.focusTargetSec ? 'overtime' : 'running-focus';
      state.focusEndNotified = state.status === 'overtime';
      save(state);
      setFocusStatusUI();
    } else {
      startFocus(durationFromUI());
    }
  }

  function reset() {
    clearSaved();
    window.__SLCFocusState = defaultState();
    const app = window.app;
    if (app) {
      clearInterval(app.timerInterval);
      app.timerRunning = false;
      app.timerSeconds = 0;
      app.timerDuration = 0;
      app.timerStartedAt = null;
      app.focusLinkedSessionId = null;
      app.focusMateria = '';
    }
    setFocusStatusUI();
  }

  function tick() {
    const state = getState();
    const t = now();
    if (state.status === 'running-focus') {
      const elapsed = focusElapsed(state, t);
      if (elapsed >= state.focusTargetSec && !state.focusEndNotified) {
        state.focusEndNotified = true;
        state.status = 'overtime';
        state.focusAccumulatedSec = elapsed;
        state.focusStartedAt = t;
        save(state);
        notify('Foco concluído', `${state.subject || 'Seu estudo'}: o bloco terminou. Você pode continuar estudando ou iniciar o descanso recomendado.`, 'slc-focus-end');
      }
    } else if (state.status === 'overtime') {
      // Continua contando: tempo extra também é estudo.
    } else if (state.status === 'break') {
      const elapsed = breakElapsed(state, t);
      if (elapsed >= state.breakDurationSec && !state.breakEndNotified) {
        state.breakEndNotified = true;
        state.totalBreakSec = elapsed;
        state.breakStartedAt = null;
        state.status = 'paused';
        save(state);
        notify('Descanso terminou', 'Seu descanso acabou. Aperte “Iniciar foco” quando estiver pronto para continuar.', 'slc-break-end');
      }
    }
    if (state.status === 'running-focus' || state.status === 'overtime' || state.status === 'break') {
      if (t - Number(state.lastSavedAt || 0) > 5000) save(state);
    }
    setFocusStatusUI();
  }

  function wire() {
    const app = window.app;
    if (!app || app.__slcFocusEngineWired) return;
    app.__slcFocusEngineWired = true;
    window.__SLCFocusState = load();

    // Override the legacy timer with real-time accounting.
    app.startTimer = function () {
      const state = getState();
      if (state.status === 'break') return;
      const select = document.getElementById('timer-duracao');
      const chosen = Number(select?.value || 25) * 60;
      if (state.status === 'paused' && state.focusAccumulatedSec > 0) {
        state.focusStartedAt = now();
        state.status = state.focusAccumulatedSec >= state.focusTargetSec ? 'overtime' : 'running-focus';
        save(state);
        setFocusStatusUI();
        return;
      }
      startFocus(chosen);
    };
    app.pauseTimer = pause;
    app.resetTimer = reset;
    app.timerComplete = () => startBreak();

    // Start/stop is controlled here; legacy listeners can call these methods safely.
    document.addEventListener('click', e => {
      const target = e.target.closest?.('#focus-next-button,#focus-break-start,#focus-long-start,#focus-heavy-start');
      if (target) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (target.id === 'focus-long-start') startFocus(50 * 60);
        else if (target.id === 'focus-heavy-start') startFocus(90 * 60);
        else startBreak();
        return;
      }
      const finish = e.target.closest?.('#focus-finish-session');
      if (finish) {
        e.preventDefault();
        e.stopImmediatePropagation();
        finalizeStudy('manual');
      }
    }, true);

    const subject = document.getElementById('timer-materia');
    subject?.addEventListener('change', () => { const s=getState(); s.subject=subject.value||''; save(s); });

    window.setInterval(tick, TICK_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
    window.addEventListener('focus', tick);
    window.addEventListener('beforeunload', () => save(getState()));

    // Restore a session that was running before a refresh/tab switch.
    setTimeout(() => {
      const state = getState();
      if (state.status !== 'idle') {
        syncLegacyFields(app, state);
        if (state.status === 'running-focus' || state.status === 'overtime' || state.status === 'break') tick();
      }
    }, 100);
  }

  function enhanceFocusView() {
    if (!window.app || window.app.currentView !== 'foco') return;
    const state = getState();
    const select = document.getElementById('timer-materia');
    const pending = window.app.pendingFocusMateria || state.subject || '';
    if (select && pending) {
      const exists = [...select.options].some(o => o.value === pending);
      if (exists) { select.value = pending; state.subject = pending; save(state); }
      window.app.pendingFocusMateria = '';
    }

    const card = document.querySelector('.focus-cycle-card');
    if (card && !document.getElementById('focus-engine-meta')) {
      card.insertAdjacentHTML('beforeend', `
        <div class="focus-engine-meta" id="focus-engine-meta"></div>
        <div class="focus-engine-actions">
          <button type="button" class="btn-primary" id="focus-finish-session" style="display:none"><i class="fas fa-check"></i> Concluir estudo e registrar</button>
        </div>
        <p class="focus-engine-note"><i class="fas fa-shield-halved"></i> O relógio usa tempo real: trocar de aba, bloquear a tela ou recarregar a página não faz o tempo “sumir”. O descanso nunca começa sozinho.</p>
        <div class="focus-engine-notification" id="focus-engine-notification"></div>
      `);
    }
    setFocusStatusUI();
  }

  function boot() {
    if (window.__SLCFocusEngineBooted) return;
    window.__SLCFocusEngineBooted = true;
    const go = () => {
      wire();
      enhanceFocusView();
    };
    document.addEventListener('app-ready', () => setTimeout(go, 80));
    document.addEventListener('click', e => {
      if (e.target.closest?.('[data-view="foco"],#slc-product-bottom-nav [data-v="foco"],[data-slcnavigate="foco"]')) {
        setTimeout(enhanceFocusView, 80);
      }
    }, true);
    if (document.readyState !== 'loading') setTimeout(go, 100);
    else document.addEventListener('DOMContentLoaded', () => setTimeout(go, 100));
  }

  window.SLCFocusEngine = {
    getState,
    recommendedBreak,
    startFocus,
    startBreak,
    pause,
    reset,
    finalizeStudy,
    tick,
    fmt
  };

  boot();
})();
