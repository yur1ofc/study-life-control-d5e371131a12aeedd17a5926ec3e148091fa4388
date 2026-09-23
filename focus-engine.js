/* SLCampus Focus Engine v17
 * Timer based on real elapsed time, not setInterval ticks.
 * Survives tab switching/reload via localStorage and keeps break manual.
 */
(function () {
  'use strict';

  const VERSION = 3;
  const STORAGE_PREFIX = 'slc-focus-v3:';
  const EVIDENCE_PREFIX = 'slc-learning-evidence-v1:';
  const TICK_MS = 250;

  const safe = (fn, fallback = null) => { try { return fn(); } catch (_) { return fallback; } };
  const uid = () => window.auth?.currentUser?.uid || window.app?.data?.user?.email || 'local';
  const key = () => `${STORAGE_PREFIX}${uid()}`;
  const evidenceKey = () => `${EVIDENCE_PREFIX}${uid()}`;
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
      lastActivityAt: null,
      finalizing: false
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

  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  function savePendingEvidence(sessionId) {
    if (!sessionId) return;
    safe(() => localStorage.setItem(evidenceKey(), JSON.stringify({ sessionId, createdAt: new Date().toISOString() })));
  }

  function getPendingEvidenceId() {
    const raw = safe(() => localStorage.getItem(evidenceKey()), null);
    const parsed = raw ? safe(() => JSON.parse(raw), null) : null;
    return parsed?.sessionId || null;
  }

  function clearPendingEvidence() {
    safe(() => localStorage.removeItem(evidenceKey()));
  }

  function inferTopic(app, state) {
    const explicit = String(state?.topic || '').trim();
    if (explicit && !/^bloco de foco$/i.test(explicit)) return explicit;
    const subject = norm(state?.subject);
    const diaries = (app?.data?.classDiaries || [])
      .filter(d => subject && norm(d?.materia) === subject)
      .sort((a,b) => new Date(b?.data || 0) - new Date(a?.data || 0));
    const diary = diaries[0];
    if (diary?.conteudoExplicado) return String(diary.conteudoExplicado).split(/[.;]/)[0].trim();
    const topics = (app?.data?.learningMap || []).filter(t => subject && norm(t?.materia) === subject);
    const weak = topics.filter(t => Number(t?.confianca ?? 3) <= 2 || ['revisar','estudando'].includes(norm(t?.status)));
    return String((weak[0] || topics[0])?.nome || '').trim();
  }

  function evidenceMeta(level) {
    return ({
      explain: { label: 'Consigo explicar sem olhar', confidence: 5, priority: 0, reviewDays: [3,7,15,30,60], status: 'dominado' },
      exercise: { label: 'Consigo resolver exercícios', confidence: 4, priority: 0, reviewDays: [2,5,10,20,40], status: 'revisando' },
      doubt: { label: 'Ainda tenho dúvidas', confidence: 2, priority: 18, reviewDays: [1,3,7,14,30], status: 'estudando' },
      review: { label: 'Preciso revisar', confidence: 2, priority: 14, reviewDays: [1,2,5,10,20], status: 'estudando' }
    })[level] || null;
  }

  function materialCount(app, subject) {
    return (app?.data?.materials || []).filter(m => !subject || norm(m?.materia) === norm(subject)).length;
  }

  async function applyLearningEvidence(session, level, recallText = '') {
    const app = window.app;
    const meta = evidenceMeta(level);
    if (!app || !session || !meta) return false;
    const topic = inferTopic(app, { subject: session.materia, topic: session.topico });
    const evidence = {
      level,
      label: meta.label,
      confidence: meta.confidence,
      recall: String(recallText || '').trim().slice(0, 1500),
      errorNote: (level === 'doubt' || level === 'review') ? String(recallText || '').trim().slice(0, 1500) : '',
      topic: topic || '',
      answeredAt: new Date().toISOString(),
      source: 'focus-session-v17',
      materialsAvailable: materialCount(app, session.materia),
      activeRecall: true
    };

    const existingSession = (app.data.sessions || []).find(s => s.id === session.id);
    if (!existingSession) return false;
    const history = Array.isArray(existingSession.learningEvidenceHistory) ? existingSession.learningEvidenceHistory.slice(-9) : [];
    const updatedSession = {
      ...existingSession,
      learningEvidence: evidence,
      learningEvidenceHistory: [...history, evidence],
      learningStatus: level === 'explain' ? 'forte' : level === 'exercise' ? 'bom' : 'precisa-revisao',
      learningPriority: meta.priority,
      learningTopic: topic || existingSession.topico || ''
    };
    const success = await dbService.updateItem('sessions', session.id, {
      learningEvidence: updatedSession.learningEvidence,
      learningEvidenceHistory: updatedSession.learningEvidenceHistory,
      learningStatus: updatedSession.learningStatus,
      learningPriority: updatedSession.learningPriority,
      learningTopic: updatedSession.learningTopic
    });
    if (!success) return false;
    Object.assign(existingSession, updatedSession);

    // Atualiza o Mapa de Aprendizado pela evidência real da sessão.
    if (topic) {
      const topicItem = (app.data.learningMap || []).find(t => norm(t?.materia) === norm(session.materia) && norm(t?.nome) === norm(topic));
      const previousHistory = Array.isArray(topicItem?.evidencias) ? topicItem.evidencias.slice(-9) : [];
      if (topicItem) {
        const previousConfidence = Number(topicItem.confianca) || 3;
        const nextConfidence = level === 'explain' ? Math.max(previousConfidence, 5) : level === 'exercise' ? Math.max(previousConfidence, 4) : Math.min(previousConfidence, 2);
        const nextDifficulty = level === 'explain' ? Math.max(1, (Number(topicItem.dificuldade) || 3) - 1) : level === 'exercise' ? Number(topicItem.dificuldade) || 3 : Math.min(5, (Number(topicItem.dificuldade) || 3) + 1);
        await dbService.updateItem('learningMap', topicItem.id, {
          confianca: nextConfidence,
          dificuldade: nextDifficulty,
          status: meta.status,
          ultimaRevisao: new Date().toISOString(),
          ultimaEvidencia: evidence,
          evidencias: [...previousHistory, evidence]
        });
        Object.assign(topicItem, { confianca: nextConfidence, dificuldade: nextDifficulty, status: meta.status, ultimaRevisao: evidence.answeredAt, ultimaEvidencia: evidence, evidencias: [...previousHistory, evidence] });
      } else if (!/^bloco de foco$/i.test(topic)) {
        const item = {
          id: typeof generateId === 'function' ? generateId() : `topic-${Date.now()}`,
          materia: session.materia,
          nome: topic,
          dificuldade: level === 'explain' ? 2 : level === 'exercise' ? 3 : 4,
          status: meta.status,
          confianca: meta.confidence,
          ultimaRevisao: new Date().toISOString(),
          ultimaEvidencia: evidence,
          evidencias: [evidence],
          origem: 'focus-evidence-v17'
        };
        await dbService.addItem('learningMap', item);
      }
    }

    // Reprograma as revisões já geradas para este bloco conforme a evidência.
    const reviews = (app.data.reviews || []).filter(r => r?.aulaId === session.id || r?.sessaoId === session.id);
    for (let i = 0; i < Math.min(reviews.length, meta.reviewDays.length); i += 1) {
      const d = new Date();
      d.setDate(d.getDate() + meta.reviewDays[i]);
      const priority = meta.priority > 0 ? 'alta' : 'normal';
      await dbService.updateItem('reviews', reviews[i].id, {
        data: d.toISOString().split('T')[0],
        prioridadeAprendizagem: priority,
        origemEvidencia: level,
        evidenceConfidence: meta.confidence
      });
      Object.assign(reviews[i], { data: d.toISOString().split('T')[0], prioridadeAprendizagem: priority, origemEvidencia: level, evidenceConfidence: meta.confidence });
    }

    window.SubjectDifficulty?.recalcAll?.();
    document.dispatchEvent(new CustomEvent('slc-learning-evidence-saved', { detail: { session: existingSession, evidence } }));
    return true;
  }

  function openMentorForRecall(session) {
    const app = window.app;
    const subject = session?.materia || 'a matéria';
    const topic = session?.learningTopic || session?.topico || 'o conteúdo estudado';
    const prompt = `Acabei de estudar ${subject}${topic && topic !== 'Bloco de foco' ? ` sobre ${topic}` : ''}. Faça 3 questões de recuperação ativa, sem me dar a resposta de imediato. Use meus dados do SLCampus para priorizar tópicos fracos, provas próximas, notas, erros e revisões. Depois avalie minhas respostas.`;
    try {
      if (app?.navigate) app.navigate('mentor-ia'); else app?.loadView?.('mentor-ia');
      setTimeout(() => {
        const input = document.getElementById('chat-input');
        if (input) { input.value = prompt; input.focus(); }
      }, 220);
    } catch (_) {}
  }

  function openMaterialsForSubject(subject) {
    try {
      const app = window.app;
      if (app?.navigate) app.navigate('biblioteca'); else app?.loadView?.('biblioteca');
      setTimeout(() => {
        const input = document.getElementById('resource-search');
        if (input && subject) { input.value = subject; input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); }
      }, 300);
    } catch (_) {}
  }

  function showLearningEvidenceModal(sessionId) {
    if (document.getElementById('slc-learning-evidence-modal')) return;
    const app = window.app;
    const session = (app?.data?.sessions || []).find(s => s.id === sessionId);
    if (!session || session.learningEvidence) { clearPendingEvidence(); return; }
    document.getElementById('slc-learning-evidence-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'slc-learning-evidence-modal';
    modal.className = 'modal slc-learning-evidence-modal';
    const topic = inferTopic(app, { subject: session.materia, topic: session.topico });
    const materials = materialCount(app, session.materia);
    modal.innerHTML = `
      <div class="modal-content learning-evidence-card">
        <div class="modal-header">
          <div><h2><i class="fas fa-brain"></i> O que você realmente aprendeu?</h2><p>${session.materia || 'Sessão de estudo'}${topic ? ` • ${topic}` : ''}</p></div>
          <button type="button" class="modal-close" id="learning-evidence-close" aria-label="Fechar">&times;</button>
        </div>
        <div class="modal-body">
          <p class="learning-evidence-intro">Não avalie pelo tempo. Avalie pelo que você consegue recuperar agora, sem olhar o material.</p>
          <div class="learning-evidence-options" id="learning-evidence-options">
            <button type="button" data-evidence="explain"><strong>1. Consigo explicar sem olhar</strong><span>Você consegue reconstruir a ideia com suas palavras.</span></button>
            <button type="button" data-evidence="exercise"><strong>2. Consigo resolver exercícios</strong><span>Você consegue aplicar o conteúdo, não só reconhecê-lo.</span></button>
            <button type="button" data-evidence="doubt"><strong>3. Ainda tenho dúvidas</strong><span>A prioridade sobe e o sistema encurta a revisão.</span></button>
            <button type="button" data-evidence="review"><strong>4. Preciso revisar</strong><span>O conteúdo ainda não está recuperável com segurança.</span></button>
          </div>
          <div class="learning-evidence-recall">
            <label for="learning-evidence-text">Evidência de aprendizagem (opcional)</label>
            <textarea id="learning-evidence-text" rows="4" maxlength="1500" placeholder="Sem olhar: escreva em poucas linhas o que você lembra, onde travou ou qual erro percebeu."></textarea>
            <small>Isso alimenta o Mapa de Aprendizado e o Mentor IA.</small>
          </div>
          <div class="learning-evidence-tools">
            <button type="button" class="btn-secondary" id="learning-evidence-mentor"><i class="fas fa-robot"></i> Gerar 3 questões no Mentor IA</button>
            ${materials ? `<button type="button" class="btn-secondary" id="learning-evidence-materials"><i class="fas fa-file-pdf"></i> Abrir ${materials} material(is)</button>` : ''}
          </div>
          <div class="learning-evidence-actions">
            <button type="button" class="btn-secondary" id="learning-evidence-later">Fazer depois</button>
            <button type="button" class="btn-primary" id="learning-evidence-save" disabled>Registrar evidência</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    let chosen = '';
    const options = modal.querySelectorAll('[data-evidence]');
    const saveBtn = modal.querySelector('#learning-evidence-save');
    options.forEach(btn => btn.addEventListener('click', () => {
      chosen = btn.dataset.evidence || '';
      options.forEach(x => x.classList.toggle('selected', x === btn));
      saveBtn.disabled = !chosen;
      saveBtn.textContent = chosen === 'doubt' || chosen === 'review' ? 'Registrar e priorizar' : 'Registrar evidência';
    }));
    modal.querySelector('#learning-evidence-save').onclick = async () => {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando...';
      const ok = await applyLearningEvidence(session, chosen, modal.querySelector('#learning-evidence-text')?.value || '');
      if (ok) {
        clearPendingEvidence();
        modal.remove();
        showToast?.(chosen === 'doubt' || chosen === 'review' ? 'Evidência salva. Esse conteúdo ganhou prioridade de revisão.' : 'Evidência salva. O sistema vai revisar esse conteúdo depois.', 'success');
        app?.loadView?.(app.currentView || 'foco');
      } else {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Tentar novamente';
      }
    };
    modal.querySelector('#learning-evidence-later').onclick = () => modal.remove();
    modal.querySelector('#learning-evidence-close').onclick = () => modal.remove();
    modal.querySelector('#learning-evidence-mentor').onclick = () => { modal.remove(); openMentorForRecall(session); };
    modal.querySelector('#learning-evidence-materials')?.addEventListener('click', () => { modal.remove(); openMaterialsForSubject(session.materia); });
  }

  async function dedupeSessionsById() {
    const app = window.app;
    const sessions = Array.isArray(app?.data?.sessions) ? app.data.sessions : [];
    const seen = new Set();
    const unique = [];
    let removed = 0;
    sessions.forEach(session => {
      const id = String(session?.id || '');
      if (!id || !seen.has(id)) {
        if (id) seen.add(id);
        unique.push(session);
      } else {
        removed += 1;
      }
    });
    if (!removed) return 0;
    app.data.sessions = unique;
    await dbService.saveData('sessions', unique);
    console.info(`[SLCampus] ${removed} sessão(ões) duplicada(s) removida(s) por ID.`);
    return removed;
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
      const canBreak = ['running-focus','overtime','paused'].includes(state.status) && fElapsed >= 60;
      breakBtn.innerHTML = `<i class="fas fa-mug-hot"></i> Descanso <span id="focus-break-label">${breakMin} min</span>`;
      breakBtn.disabled = !canBreak;
      breakBtn.style.display = ['idle','break'].includes(state.status) ? 'none' : 'inline-flex';
      breakBtn.title = canBreak ? 'Iniciar descanso manualmente' : 'Estude pelo menos 1 minuto para liberar o descanso';
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
    if (state.finalizing) return false;
    state.finalizing = true;
    save(state);
    const elapsed = focusElapsed(state);
    if (elapsed < 60) {
      showToast?.('Estude pelo menos 1 minuto antes de concluir para registrar a sessão.', 'info');
      return false;
    }

    const minutes = Math.max(1, Math.round(elapsed / 60));
    const subject = state.subject || 'Modo Foco';
    const sessionId = state.sessionId;
    const inferredTopic = inferTopic(app, state);
    let success = false;

    if (sessionId && app?.data?.sessions) {
      const scheduled = app.data.sessions.find(s => s.id === sessionId && !s.concluida);
      if (scheduled) {
        success = await dbService.updateItem('sessions', sessionId, {
          concluida: true,
          duracaoReal: minutes,
          dataConclusao: new Date().toISOString(),
          estudoRealizado: minutes,
          motivoConclusao: reason,
          topico: scheduled.topico || inferredTopic || 'Bloco de foco'
        });
        if (success) {
          Object.assign(scheduled, { concluida: true, duracaoReal: minutes, dataConclusao: new Date().toISOString(), estudoRealizado: minutes, topico: scheduled.topico || inferredTopic || 'Bloco de foco' });
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
        topico: inferredTopic || 'Bloco de foco',
        origem: 'focus-engine-v17'
      };
      success = await dbService.addItem('sessions', item);
      if (success && window.reviewSystem?.gerarRevisoesFromSessao) {
        try { await window.reviewSystem.gerarRevisoesFromSessao(item); } catch (_) {}
      }
    }

    if (success) {
      app?.updateStreak?.();
      const evidenceSession = (app?.data?.sessions || []).find(s => s.id === sessionId) ||
        (app?.data?.sessions || []).filter(s => s?.origem === 'focus-engine-v17').at(-1) || null;
      if (evidenceSession) savePendingEvidence(evidenceSession.id);
      showToast?.(`Estudo registrado: ${minutes} min de ${subject}. Agora registre o que você realmente conseguiu recuperar.`, 'success');
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
      setTimeout(() => { if (evidenceSession) showLearningEvidenceModal(evidenceSession.id); }, 180);
    }
    if (!success) {
      state.finalizing = false;
      save(state);
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
    const pendingId = getPendingEvidenceId();
    if (pendingId && !document.getElementById('slc-learning-evidence-pending')) {
      const note = document.createElement('div');
      note.id = 'slc-learning-evidence-pending';
      note.className = 'learning-evidence-pending';
      note.innerHTML = '<i class="fas fa-brain"></i><span><strong>Evidência de aprendizagem pendente</strong><small>Registre o que você realmente conseguiu recuperar nesta sessão.</small></span><button type="button" class="btn-secondary btn-sm">Avaliar agora</button>';
      document.querySelector('.focus-cycle-card')?.appendChild(note);
      note.querySelector('button')?.addEventListener('click', () => showLearningEvidenceModal(pendingId));
    }
    setFocusStatusUI();
    if (pendingId) setTimeout(() => showLearningEvidenceModal(pendingId), 220);
  }

  function boot() {
    if (window.__SLCFocusEngineBooted) return;
    window.__SLCFocusEngineBooted = true;
    const go = () => {
      wire();
      dedupeSessionsById().finally(() => enhanceFocusView());
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
    showLearningEvidenceModal,
    applyLearningEvidence,
    tick,
    fmt
  };

  boot();
})();
