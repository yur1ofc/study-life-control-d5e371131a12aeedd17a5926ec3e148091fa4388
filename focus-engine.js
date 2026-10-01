/* SLCampus Focus Engine v18
 * Timer based on real elapsed time, not setInterval ticks.
 * Survives tab switching/reload via localStorage and keeps break manual.
 */
(function () {
  'use strict';

  const VERSION = 4;
  const STORAGE_PREFIX = 'slc-focus-v3:'; // chave mantida para migrar sessões em andamento
  const EVIDENCE_PREFIX = 'slc-learning-evidence-v1:';
  const FOCUS_PUSH_KEY = 'slc-focus-push-v1';
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
      // idle | running-focus | overtime | paused | break | break-paused | break-ended
      status: 'idle',
      subject: '',
      topic: '',
      sessionId: null,          // sessão programada vinculada (opcional)
      recordId: null,           // registro de foco salvo no banco (checkpoint)
      mode: 'pomodoro',
      focusTargetSec: 25 * 60,
      focusAccumulatedSec: 0,   // tempo do bloco ATUAL
      focusStartedAt: null,
      stretchStartedAt: null,   // início do trecho contínuo atual (métrica de foco)
      blocksDoneSec: 0,         // tempo de blocos anteriores (antes de cada descanso)
      overtimeDoneSec: 0,
      breakDurationSec: 5 * 60,
      breakStartedAt: null,
      totalBreakSec: 0,         // descanso em andamento
      breakDoneSec: 0,          // descansos já concluídos
      breakCount: 0,
      blockCount: 0,
      lastSavedAt: null,
      lastHeartbeatAt: null,
      lastCheckpointAt: 0,
      lastCheckpointSec: 0,
      focusEndNotified: false,
      breakEndNotified: false,
      startedAt: null,
      lastActivityAt: null,
      pausedAt: null,
      pauseCount: 0,
      pauseTotalSec: 0,
      shortPauseCount: 0,
      longestStretchSec: 0,
      pauses: [],
      reviewsGenerated: false,
      finalizing: false
    };
  }

  function load() {
    const raw = safe(() => localStorage.getItem(key()), null);
    if (!raw) return defaultState();
    const parsed = safe(() => JSON.parse(raw), null);
    if (!parsed || ![3, VERSION].includes(parsed.version)) return defaultState();
    const merged = { ...defaultState(), ...parsed, version: VERSION };
    // Migração v3 -> v4: 'paused' vindo de um descanso vira 'break-paused'/'break-ended'.
    if (parsed.version === 3 && merged.status === 'paused' && Number(merged.totalBreakSec) > 0) {
      merged.blocksDoneSec = Number(merged.focusAccumulatedSec) || 0;
      merged.focusAccumulatedSec = 0;
      merged.status = Number(merged.totalBreakSec) >= Number(merged.breakDurationSec) ? 'break-ended' : 'break-paused';
    }
    return merged;
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

  // Tempo total de estudo da sessão (todos os blocos, incluindo tempo extra).
  function totalStudySec(state, at = now()) {
    return Math.max(0, Number(state.blocksDoneSec) || 0) + focusElapsed(state, at);
  }

  const FOCUS_STATUSES = ['running-focus', 'overtime', 'paused'];
  const RUNNING_STATUSES = ['running-focus', 'overtime', 'break'];
  const BREAK_STATUSES = ['break', 'break-paused', 'break-ended'];

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
    // Espelho resumido para o motor adaptativo (não substitui o histórico dentro da sessão).
    app.data.learningEvidence = Array.isArray(app.data.learningEvidence) ? app.data.learningEvidence : [];
    app.data.learningEvidence.push({ ...evidence, materia: session.materia, sessaoId: session.id });
    app.data.learningEvidence = app.data.learningEvidence.slice(-200);
    await dbService.saveData('learningEvidence', app.data.learningEvidence);

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

  function getTodayFocusMinutes(excludeId = null) {
    const app = window.app;
    if (!app?.data) return 0;
    const today = new Date();
    const y = today.getFullYear(), m = today.getMonth(), d = today.getDate();
    return (app.data.sessions || []).reduce((sum, s) => {
      if (!s?.concluida || s.tipo !== 'foco') return sum;
      if (excludeId && s.id === excludeId) return sum; // sessão em andamento é somada ao vivo
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

  const escHtml = v => (window.escapeHtml ? window.escapeHtml(v ?? '') : String(v ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])));
  const resumeStatus = state => (focusElapsed(state) >= (Number(state.focusTargetSec) || 1500) ? 'overtime' : 'running-focus');

  // ---------------------------------------------------------------------------
  // Métricas de foco (alimentam o card de insights, o Mentor IA e os alertas)
  // ---------------------------------------------------------------------------
  function closeStretch(state, at = now()) {
    if (state.stretchStartedAt) {
      const stretch = Math.max(0, (at - state.stretchStartedAt) / 1000);
      state.longestStretchSec = Math.max(Number(state.longestStretchSec) || 0, stretch);
      state.stretchStartedAt = null;
    }
  }

  function buildMetrics(state, at = now()) {
    const totalSec = totalStudySec(state, at);
    const openStretch = state.stretchStartedAt && ['running-focus', 'overtime'].includes(state.status)
      ? Math.max(0, (at - state.stretchStartedAt) / 1000) : 0;
    const longest = Math.max(Number(state.longestStretchSec) || 0, openStretch);
    const pauseCount = Number(state.pauseCount) || 0;
    const shortPauseCount = Number(state.shortPauseCount) || 0;
    const pausesPerHour = pauseCount / Math.max(0.25, totalSec / 3600);
    const currentBlock = FOCUS_STATUSES.includes(state.status) ? focusElapsed(state, at) : 0;
    const overtimeSec = (Number(state.overtimeDoneSec) || 0) + Math.max(0, currentBlock - (Number(state.focusTargetSec) || 1500));

    // Índice de foco: heurística simples (0-100), não é diagnóstico.
    let index = null;
    if (totalSec >= 10 * 60) {
      index = 100;
      index -= Math.min(45, pausesPerHour * 7);
      if (shortPauseCount >= 3) index -= Math.min(20, (shortPauseCount - 2) * 4);
      if (totalSec >= 15 * 60 && longest < 5 * 60) index -= 20;
      else if (totalSec >= 15 * 60 && longest < 10 * 60) index -= 8;
      index = clamp(Math.round(index), 0, 100);
    }
    return {
      totalSec: Math.round(totalSec),
      pausas: pauseCount,
      pausasCurtas: shortPauseCount,
      tempoPausadoSec: Math.round(Number(state.pauseTotalSec) || 0),
      pausasPorHora: Number(pausesPerHour.toFixed(2)),
      maiorTrechoSec: Math.round(longest),
      blocos: Math.max(1, Number(state.blockCount) || 1),
      descansos: Number(state.breakCount) || 0,
      descansoSec: Math.round(Number(state.breakDoneSec) || 0),
      tempoExtraSec: Math.round(overtimeSec),
      indiceFoco: index,
      terminouPausado: state.status === 'paused',
      versao: 18
    };
  }

  // ---------------------------------------------------------------------------
  // Checkpoints: a sessão é gravada no banco assim que chega a 1 min e vai sendo
  // atualizada. Se o celular descarregar, o aplicativo fechar ou o usuário
  // esquecer o cronômetro pausado, o que foi estudado já está contabilizado.
  // ---------------------------------------------------------------------------
  let ckChain = Promise.resolve();
  let ckInFlight = 0;
  let lastCkAttempt = 0;

  function checkpoint(reason = 'auto', opts = {}) {
    ckInFlight += 1;
    ckChain = ckChain
      .then(() => doCheckpoint(reason, opts))
      .catch(err => { console.warn('[SLC Focus] checkpoint falhou:', err?.message || err); return false; })
      .finally(() => { ckInFlight = Math.max(0, ckInFlight - 1); });
    return ckChain;
  }

  function refreshTodayList() {
    try {
      const app = window.app;
      const list = document.getElementById('sessoes-foco-hoje');
      if (list && app?.currentView === 'foco' && app.viewRenderer?.renderSessoesFocoHoje) list.innerHTML = app.viewRenderer.renderSessoesFocoHoje();
    } catch (_) {}
  }

  async function doCheckpoint(reason, { final = false, stateOverride = null } = {}) {
    const app = window.app;
    const state = stateOverride || getState();
    if (!app?.data || !window.dbService || !Array.isArray(app.data.sessions)) return false;
    const total = totalStudySec(state);
    if (total < 60) return false;

    const minutes = Math.max(1, Math.round(total / 60));
    const payload = {
      materia: state.subject || 'Modo Foco',
      tipo: 'foco',
      duracao: minutes,
      duracaoReal: minutes,
      concluida: true,
      emAndamento: !final,
      motivoConclusao: final ? reason : 'em-andamento',
      topico: inferTopic(app, state) || 'Bloco de foco',
      origem: 'focus-engine-v18',
      sessaoVinculadaId: state.sessionId || null,
      focoMetricas: buildMetrics(state),
      atualizadoEm: new Date().toISOString()
    };

    let ok = false;
    if (!state.recordId) {
      const id = typeof generateId === 'function' ? generateId() : `focus-${Date.now()}`;
      state.recordId = id; // reservado antes do await para evitar registro duplicado
      save(state);
      ok = await dbService.addItem('sessions', { id, data: state.startedAt || new Date().toISOString(), ...payload });
      if (!ok) { state.recordId = null; save(state); return false; }
      app.updateStreak?.();
    } else {
      ok = await dbService.updateItem('sessions', state.recordId, payload);
      if (!ok) {
        // Registro pode ter sido removido/perdido: tenta recriar com o mesmo id.
        ok = await dbService.addItem('sessions', { id: state.recordId, data: state.startedAt || new Date().toISOString(), ...payload });
      }
    }
    if (ok) {
      state.lastCheckpointAt = now();
      state.lastCheckpointSec = total;
      save(state);
      refreshTodayList();
    }
    return ok;
  }

  function autoCheckpoint(state, t) {
    if (state.status === 'idle' || state.finalizing || ckInFlight) return;
    const total = totalStudySec(state, t);
    if (total < 60) return;
    const first = !state.recordId;
    const due = first || (FOCUS_STATUSES.includes(state.status) && state.status !== 'paused' && total - (Number(state.lastCheckpointSec) || 0) >= 300);
    if (!due || t - lastCkAttempt < 30000) return;
    lastCkAttempt = t;
    checkpoint(first ? 'primeiro-minuto' : 'auto');
  }

  function flushOnLeave() {
    const state = getState();
    if (state.status === 'idle') return;
    state.lastHeartbeatAt = now();
    save(state);
    const total = totalStudySec(state);
    if (total >= 60 && total - (Number(state.lastCheckpointSec) || 0) >= 30) checkpoint('saindo');
  }

  function resetGlobalState() {
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
  }

  function discardState() {
    cancelServerFocusSchedule(getState());
    clearSaved();
    resetGlobalState();
    setFocusStatusUI();
  }

  // Encerra a sessão salvando o que foi estudado.
  // reason: manual | reset | abandoned | recovered
  async function finalizeStudy(reason = 'manual', opts = {}) {
    const app = window.app;
    const state = opts.stateRef || getState();
    if (state.finalizing) return false;
    const evidence = opts.evidence !== undefined ? opts.evidence : reason === 'manual';
    const t = now();

    if (totalStudySec(state, t) < 60) {
      if (reason === 'manual') {
        showToast?.('Estude pelo menos 1 minuto antes de concluir para registrar a sessão.', 'info');
        return false;
      }
      discardState(); // menos de 1 min: nada a registrar
      return true;
    }

    state.finalizing = true;
    // Congela o relógio antes de salvar.
    if (FOCUS_STATUSES.includes(state.status) && state.status !== 'paused') {
      closeStretch(state, t);
      state.focusAccumulatedSec = focusElapsed(state, t);
      state.focusStartedAt = null;
    }
    if (state.status === 'break') { state.breakDoneSec += breakElapsed(state, t); state.totalBreakSec = 0; state.breakStartedAt = null; }
    save(state);

    const minutes = Math.max(1, Math.round(totalStudySec(state, t) / 60));
    const subject = state.subject || 'Modo Foco';
    const ok = await checkpoint(reason, { final: true, stateOverride: state });

    if (!ok) {
      state.finalizing = false;
      save(state);
      showToast?.('Não consegui salvar agora (sem conexão?). Seu tempo continua guardado neste aparelho e será registrado assim que possível.', 'warning');
      return false;
    }

    const recordId = state.recordId;
    let evidenceId = recordId;
    const metrics = buildMetrics(state, t);
    metrics.motivo = reason;
    const scheduled = state.sessionId ? (app?.data?.sessions || []).find(s => s.id === state.sessionId && !s.concluida) : null;

    if (scheduled) {
      if (reason === 'manual') {
        // Sessão programada concluída pelo usuário: ela passa a carregar o tempo real
        // e o registro temporário de foco é removido para não contar em dobro.
        const updates = {
          concluida: true,
          duracaoPlanejada: scheduled.duracao || null,
          duracao: minutes,
          duracaoReal: minutes,
          estudoRealizado: minutes,
          dataConclusao: new Date().toISOString(),
          motivoConclusao: reason,
          topico: scheduled.topico || inferTopic(app, state) || 'Bloco de foco',
          focoMetricas: metrics
        };
        const done = await dbService.updateItem('sessions', scheduled.id, updates);
        if (done) {
          await dbService.removeItem('sessions', recordId);
          evidenceId = scheduled.id;
        }
      } else {
        // Encerramento parcial: fica registrado o progresso, mas a sessão só é
        // marcada como concluída quando o usuário decide concluir.
        await dbService.updateItem('sessions', scheduled.id, { estudoRealizado: minutes });
      }
    }

    if (minutes >= 5 && !state.reviewsGenerated && window.reviewSystem?.gerarRevisoesFromSessao) {
      const item = (app?.data?.sessions || []).find(s => s.id === evidenceId);
      if (item) { try { await window.reviewSystem.gerarRevisoesFromSessao(item); } catch (_) {} }
    }
    state.reviewsGenerated = true;

    cancelServerFocusSchedule(state);
    clearSaved();
    resetGlobalState();

    if (reason === 'manual') showToast?.(`Estudo registrado: ${minutes} min de ${subject}. Agora registre o que você realmente conseguiu recuperar.`, 'success');
    else if (reason === 'reset') showToast?.(`Sessão salva: ${minutes} min de ${subject}.`, 'success');
    else showToast?.(`Sessão anterior registrada automaticamente: ${minutes} min de ${subject}.`, 'success');

    // XP pelo tempo realmente estudado (a ref evita pontuar a mesma sessão duas vezes).
    if (typeof app?.awardXP === 'function') {
      try { await app.awardXP({ ref: `session:${evidenceId}`, xp: Math.max(5, Math.round(minutes * 0.9)), type: 'focus', label: 'Sessão de foco registrada', meta: `${minutes} min` }); } catch (_) {}
    }
    if (evidence) savePendingEvidence(evidenceId);
    document.dispatchEvent(new CustomEvent('slc-focus-session-saved', { detail: { id: evidenceId, minutes, reason, metrics } }));
    app?.loadView?.(app.currentView || 'foco');
    if (evidence) setTimeout(() => showLearningEvidenceModal(evidenceId), 180);
    return true;
  }

  async function syncServerFocusSchedule(state, action = 'upsert') {
    try {
      const user = window.auth?.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const targetSec = Number(state.focusTargetSec) || 1500;
      const elapsed = focusElapsed(state);
      const remainingSec = Math.max(0, targetSec - elapsed);
      const scheduleId = state.serverScheduleId || `${uid()}-${state.startedAt || now()}`;
      state.serverScheduleId = scheduleId;
      await fetch('/api/focus-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action,
          scheduleId,
          subject: state.subject || '',
          topic: state.topic || '',
          targetAt: new Date(now() + remainingSec * 1000).toISOString(),
          durationSec: targetSec,
          enabled: action === 'upsert'
        })
      });
    } catch (error) {
      console.warn('[SLC Focus Push] não foi possível sincronizar o término no servidor:', error?.message || error);
    }
  }

  function cancelServerFocusSchedule(state) {
    syncServerFocusSchedule(state, 'cancel').catch(() => null);
  }

  // ---------------------------------------------------------------------------
  // Insights agregados (últimos dias) a partir das métricas gravadas nas sessões
  // ---------------------------------------------------------------------------
  function focusInsights(days = 14) {
    const sessions = (window.app?.data?.sessions || []).filter(s => s?.focoMetricas && s.tipo === 'foco');
    const since = Date.now() - days * 86400000;
    const rows = sessions.filter(s => new Date(s.data || 0).getTime() >= since && (Number(s.focoMetricas.totalSec) || 0) >= 600);
    if (!rows.length) return null;
    const sum = (fn) => rows.reduce((n, s) => n + (Number(fn(s.focoMetricas)) || 0), 0);
    const indexes = rows.map(s => s.focoMetricas.indiceFoco).filter(v => Number.isFinite(v));
    const totalH = Math.max(0.25, sum(m => m.totalSec) / 3600);
    const avgIndex = indexes.length ? Math.round(indexes.reduce((a, b) => a + b, 0) / indexes.length) : null;
    const pausesPerHour = Number((sum(m => m.pausas) / totalH).toFixed(1));
    const avgStretchMin = Math.round(sum(m => m.maiorTrechoSec) / rows.length / 60);
    const endedPaused = rows.filter(s => s.focoMetricas.terminouPausado).length;
    const shortPauses = sum(m => m.pausasCurtas);
    const attention = (avgIndex !== null && avgIndex < 60) || pausesPerHour >= 4;
    return { n: rows.length, avgIndex, pausesPerHour, avgStretchMin, endedPaused, shortPauses, attention, days };
  }

  function insightMessage(i) {
    if (!i) return '';
    if (i.attention) {
      return `Você pausa bastante (${i.pausesPerHour}/h) e seu trecho contínuo médio é de ${i.avgStretchMin} min. Tente blocos de 15–25 min sem pausar, com celular longe, e deixe a pausa só para o descanso.`;
    }
    if (i.avgStretchMin >= 20) return `Ótima consistência: seu trecho contínuo médio é de ${i.avgStretchMin} min e você pausa pouco (${i.pausesPerHour}/h).`;
    return `Seu foco está estável. Trecho contínuo médio: ${i.avgStretchMin} min; pausas: ${i.pausesPerHour}/h.`;
  }

  function renderInsightsCard() {
    const i = focusInsights(14);
    const box = document.getElementById('focus-insights-card');
    if (!box) return;
    if (!i) {
      box.innerHTML = '<div class="card-header"><h3>🎯 Seu foco</h3></div><div class="card-body"><p class="text-secondary">Complete algumas sessões de 10+ minutos e o SLCampus vai mostrar aqui como está seu foco (pausas, trechos contínuos e descansos).</p></div>';
      return;
    }
    box.innerHTML = `
      <div class="card-header"><h3>🎯 Seu foco (últimos ${i.days} dias)</h3></div>
      <div class="card-body">
        <div class="focus-engine-meta" style="margin-bottom:10px">
          <div><span>Índice de foco</span><strong>${i.avgIndex ?? '—'}${i.avgIndex !== null ? '/100' : ''}</strong></div>
          <div><span>Pausas por hora</span><strong>${i.pausesPerHour}</strong></div>
          <div><span>Trecho contínuo médio</span><strong>${i.avgStretchMin} min</strong></div>
          <div><span>Sessões analisadas</span><strong>${i.n}</strong></div>
        </div>
        <p class="${i.attention ? 'focus-insight-warn' : 'text-secondary'}" style="margin:0">${i.attention ? '⚠️ ' : ''}${escHtml(insightMessage(i))}${i.endedPaused ? ` ${i.endedPaused} sessão(ões) terminaram pausadas.` : ''}</p>
      </div>`;
  }

  function patchMentorContext() {
    const proto = window.AIAssistant?.prototype;
    if (!proto || proto.__slcFocusContext || typeof proto._buildMentorContextSnapshot !== 'function') return false;
    const original = proto._buildMentorContextSnapshot;
    proto._buildMentorContextSnapshot = function () {
      const base = original.apply(this, arguments);
      try {
        const i = focusInsights(14);
        if (!i) return base;
        const lines = ['', '🎯 Padrão de foco (Modo Foco, últimos 14 dias):',
          `- ${i.n} sessões analisadas; índice de foco médio ${i.avgIndex ?? 'n/d'}/100; ${i.pausesPerHour} pausas por hora; trecho contínuo médio ${i.avgStretchMin} min; ${i.endedPaused} sessão(ões) terminaram pausadas/abandonadas.`,
          i.attention ? '- Sinal de dificuldade de concentração (pausas frequentes). Sugira blocos curtos sem pausa, remover distrações e revisão ativa em vez de leitura passiva — sem diagnosticar nada.' : '- Foco estável; mantenha a rotina.'];
        return `${base}\n${lines.join('\n')}`;
      } catch (_) { return base; }
    };
    proto.__slcFocusContext = true;
    return true;
  }

  // ---------------------------------------------------------------------------
  // Interface
  // ---------------------------------------------------------------------------
  function syncLegacyFields(app, state) {
    if (!app) return;
    app.timerRunning = RUNNING_STATUSES.includes(state.status);
    const fElapsed = focusElapsed(state);
    const bElapsed = breakElapsed(state);
    if (BREAK_STATUSES.includes(state.status)) {
      app.timerDuration = state.breakDurationSec;
      app.timerSeconds = Math.max(0, state.breakDurationSec - bElapsed);
    } else {
      app.timerDuration = state.focusTargetSec;
      app.timerSeconds = Math.max(0, state.focusTargetSec - fElapsed);
    }
    app.timerStartedAt = state.focusStartedAt || state.breakStartedAt || null;
    app.focusMateria = state.subject || app.focusMateria || '';
    app.focusLinkedSessionId = state.sessionId || app.focusLinkedSessionId || null;
  }

  let lastNotifHtml = '';

  function setFocusStatusUI() {
    const app = window.app;
    const state = getState();
    const display = document.getElementById('timer-display');
    if (!display) return;
    syncLegacyFields(app, state);

    const phase = document.getElementById('focus-phase-label');
    const summary = document.getElementById('focus-cycle-summary');
    const next = document.getElementById('focus-next-action');
    const nextBtn = document.getElementById('focus-next-button');
    const breakBtn = document.getElementById('focus-break-start');
    const pauseBtn = document.getElementById('timer-pause');
    const startBtn = document.getElementById('timer-start');
    const resetBtn = document.getElementById('timer-reset');
    const meta = document.getElementById('focus-engine-meta');
    const finishBtn = document.getElementById('focus-finish-session');
    const live = document.getElementById('focus-live-insight');

    const st = state.status;
    const t = now();
    const fElapsed = focusElapsed(state, t);
    const bElapsed = breakElapsed(state, t);
    const total = totalStudySec(state, t);
    const target = Number(state.focusTargetSec) || 1500;
    const inBreak = BREAK_STATUSES.includes(st);
    const breakMin = recommendedBreak(fElapsed >= 60 ? fElapsed : total);

    if (inBreak) {
      display.textContent = st === 'break-ended' ? '00:00' : fmt(Math.max(0, state.breakDurationSec - bElapsed));
    } else if (fElapsed >= target && st !== 'idle') {
      display.textContent = `+${fmt(fElapsed - target)}`;
    } else {
      display.textContent = fmt(Math.max(0, target - fElapsed));
    }

    const labels = {
      idle: '<i class="fas fa-brain"></i> Pronto para focar',
      paused: '<i class="fas fa-pause"></i> Pausado — o tempo estudado já está salvo',
      'running-focus': '<i class="fas fa-brain"></i> Foco',
      overtime: '<i class="fas fa-bolt"></i> Foco extra — continue estudando',
      break: '<i class="fas fa-mug-hot"></i> Descanso',
      'break-paused': '<i class="fas fa-pause"></i> Descanso pausado',
      'break-ended': '<i class="fas fa-flag-checkered"></i> Descanso terminou — inicie um novo bloco'
    };
    if (phase) phase.innerHTML = labels[st] || labels.idle;

    const subject = escHtml(state.subject || 'sem matéria específica');
    if (summary) {
      const blocks = Number(state.blockCount) || (st === 'idle' ? 0 : 1);
      const totalMin = Math.floor(total / 60);
      if (st === 'overtime') summary.innerHTML = `${subject} • você ultrapassou o bloco. O tempo extra continua contando como estudo. Pausa sugerida: ${breakMin} min.`;
      else if (st === 'break') summary.innerHTML = `Descanso de ${Math.round(state.breakDurationSec / 60)} min. ${totalMin} min estudados até aqui estão salvos.`;
      else if (st === 'break-paused') summary.innerHTML = `Descanso pausado. Toque em “Retomar descanso” ou pule para o próximo bloco.`;
      else if (st === 'break-ended') summary.innerHTML = `${subject} • ${totalMin} min estudados em ${blocks} bloco(s). Quando estiver pronto, inicie um novo bloco ou conclua a sessão.`;
      else summary.innerHTML = `${subject} • ${totalMin} min estudados${blocks > 1 ? ` em ${blocks} blocos` : ''} • próxima pausa sugerida: ${breakMin} min.`;
    }

    if (next) next.classList.toggle('is-visible', ['overtime', 'break-ended', 'break-paused'].includes(st));
    if (nextBtn) {
      nextBtn.innerHTML = st === 'break-ended' ? '<i class="fas fa-brain"></i> Iniciar novo bloco de foco'
        : st === 'break-paused' ? '<i class="fas fa-forward"></i> Pular descanso e voltar ao foco'
        : `<i class="fas fa-mug-hot"></i> Iniciar descanso (${breakMin} min)`;
    }

    if (breakBtn) {
      const canBreak = ['running-focus', 'overtime', 'paused'].includes(st) && total >= 60;
      breakBtn.innerHTML = `<i class="fas fa-mug-hot"></i> Descanso <span id="focus-break-label">${breakMin} min</span>`;
      breakBtn.disabled = !canBreak;
      breakBtn.style.display = ['running-focus', 'overtime', 'paused'].includes(st) ? 'inline-flex' : 'none';
      breakBtn.title = canBreak ? 'Iniciar descanso manualmente' : 'Estude pelo menos 1 minuto para liberar o descanso';
    }
    if (pauseBtn) pauseBtn.style.display = RUNNING_STATUSES.includes(st) ? 'inline-block' : 'none';
    if (startBtn) {
      startBtn.style.display = RUNNING_STATUSES.includes(st) ? 'none' : 'inline-block';
      startBtn.innerHTML = st === 'paused' ? '<i class="fas fa-play"></i> Retomar'
        : st === 'break-paused' ? '<i class="fas fa-play"></i> Retomar descanso'
        : st === 'break-ended' ? '<i class="fas fa-play"></i> Novo bloco'
        : '<i class="fas fa-play"></i> Iniciar';
    }
    if (resetBtn) {
      resetBtn.style.display = st === 'idle' ? 'none' : 'inline-block';
      resetBtn.innerHTML = total >= 60 ? '<i class="fas fa-floppy-disk"></i> Encerrar e salvar' : '<i class="fas fa-undo"></i> Reset';
      resetBtn.title = total >= 60 ? 'Encerra e registra o tempo já estudado' : 'Zera o cronômetro (menos de 1 min, nada a registrar)';
    }
    if (finishBtn) finishBtn.style.display = total >= 60 ? 'inline-flex' : 'none';

    if (live) {
      const m = buildMetrics(state, t);
      let msg = '';
      if (st === 'paused' && state.pausedAt) {
        const mins = Math.floor((t - state.pausedAt) / 60000);
        msg = mins >= 1 ? `⏸️ Pausado há ${mins} min. Seu estudo até aqui está salvo; retome ou encerre quando quiser.` : '';
      }
      if (!msg && m.totalSec >= 10 * 60 && (m.pausasCurtas >= 3 || m.pausasPorHora >= 4)) {
        msg = `⚠️ ${m.pausas} pausas nesta sessão. Pausas frequentes quebram a concentração — tente ficar 15 min seguidos sem pausar.`;
      }
      live.textContent = msg;
      live.style.display = msg ? 'block' : 'none';
    }

    if (meta) {
      const todayMin = getTodayFocusMinutes(state.recordId) + total / 60;
      const targetMin = Number(app?.data?.user?.dailyStudyGoalHours || 3) * 60;
      const pct = targetMin ? Math.min(100, Math.round(todayMin / targetMin * 100)) : 0;
      meta.innerHTML = `
        <div><span>Estudo nesta sessão</span><strong>${fmt(total)}</strong></div>
        <div><span>Hoje</span><strong>${(todayMin / 60).toFixed(1)}h / ${(targetMin / 60).toFixed(1)}h</strong></div>
        <div><span>Progresso da meta</span><strong>${pct}%</strong></div>
        <div><span>Pausa sugerida</span><strong>${breakMin} min</strong></div>`;
    }

    const notif = document.getElementById('focus-engine-notification');
    if (notif) {
      const granted = ('Notification' in window && Notification.permission === 'granted');
      const html = granted
        ? '<span class="focus-notif-ok"><i class="fas fa-bell"></i> Notificações de foco ativadas neste dispositivo.</span>'
        : '<button type="button" class="btn-secondary btn-sm" id="focus-enable-notifications"><i class="fas fa-bell"></i> Ativar aviso quando o foco terminar</button>';
      if (html !== lastNotifHtml || !notif.innerHTML) {
        lastNotifHtml = html;
        notif.innerHTML = html;
        document.getElementById('focus-enable-notifications')?.addEventListener('click', async () => {
          try {
            if (!('Notification' in window)) throw new Error('Este navegador não suporta notificações.');
            const result = await Notification.requestPermission();
            if (result !== 'granted') throw new Error('Permissão não concedida.');
            if (window.pushNotifications?.enableFocus && window.pushNotifications?.vapidPublicKey?.()) {
              await window.pushNotifications.enableFocus();
              showToast?.('Avisos de foco ativados. O término também será agendado no servidor.', 'success');
            } else {
              showToast?.('Avisos locais de foco ativados neste dispositivo.', 'success');
            }
            lastNotifHtml = '';
            setFocusStatusUI();
          } catch (e) { showToast?.(e.message || 'Não foi possível ativar as notificações.', 'info'); }
        }, { once: true });
      }
    }
  }

  function selectedSubject() {
    const select = document.getElementById('timer-materia');
    return select?.value || window.app?.focusMateria || '';
  }

  function selectedSession() {
    const select = document.getElementById('timer-sessao-vinculada');
    return select ? (select.value || null) : (window.app?.focusLinkedSessionId || null);
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

  // ---------------------------------------------------------------------------
  // Controles
  // ---------------------------------------------------------------------------
  function foldPause(state, t) {
    if (state.status === 'paused' && state.pausedAt) {
      const dur = Math.max(0, (t - state.pausedAt) / 1000);
      state.pauseTotalSec = (Number(state.pauseTotalSec) || 0) + dur;
      if (!Array.isArray(state.pauses)) state.pauses = [];
      if (state.pauses.length < 30) state.pauses.push({ at: state.pausedAt, dur: Math.round(dur) });
    }
    state.pausedAt = null;
  }

  function startFocus(targetSec) {
    const state = getState();
    const t = now();
    if (state.finalizing || ['running-focus', 'overtime', 'break'].includes(state.status)) return;
    persistFocusContext(state);

    if (state.status === 'paused') {
      // Retomar o MESMO bloco de onde parou.
      foldPause(state, t);
      state.status = Number(state.focusAccumulatedSec) >= Number(state.focusTargetSec) ? 'overtime' : 'running-focus';
      state.focusEndNotified = state.status === 'overtime';
    } else {
      // Sessão nova (idle) ou novo bloco depois do descanso.
      if (state.status === 'break-paused') { state.breakDoneSec += Number(state.totalBreakSec) || 0; state.totalBreakSec = 0; }
      const sec = Number(targetSec) > 0 ? Number(targetSec) : durationFromUI();
      state.focusTargetSec = sec;
      state.focusAccumulatedSec = 0;
      state.blockCount = (Number(state.blockCount) || 0) + 1;
      state.breakStartedAt = null;
      state.status = 'running-focus';
      state.focusEndNotified = false;
    }
    state.focusStartedAt = t;
    state.stretchStartedAt = t;
    state.startedAt = state.startedAt || new Date().toISOString();
    state.lastActivityAt = t;
    state.lastHeartbeatAt = t;
    save(state);
    setFocusStatusUI();
    if (state.status === 'overtime') cancelServerFocusSchedule(state); else syncServerFocusSchedule(state, 'upsert');
  }

  function pause() {
    const state = getState();
    const t = now();
    if (state.finalizing) return;
    if (state.status === 'running-focus' || state.status === 'overtime') {
      const stretch = state.stretchStartedAt ? (t - state.stretchStartedAt) / 1000 : 0;
      closeStretch(state, t);
      state.focusAccumulatedSec = focusElapsed(state, t);
      state.focusStartedAt = null;
      state.status = 'paused';
      state.pausedAt = t;
      state.pauseCount = (Number(state.pauseCount) || 0) + 1;
      if (stretch < 3 * 60) state.shortPauseCount = (Number(state.shortPauseCount) || 0) + 1;
      save(state);
      cancelServerFocusSchedule(state);
      checkpoint('pausa'); // pausou e abandonou? o que foi estudado já fica salvo
      if (state.shortPauseCount === 3 && !state.lowFocusWarned) {
        state.lowFocusWarned = true; save(state);
        showToast?.('Você pausou 3 vezes em poucos minutos. Que tal tentar 15 min seguidos sem pausar?', 'info');
      }
    } else if (state.status === 'break') {
      state.totalBreakSec = breakElapsed(state, t);
      state.breakStartedAt = null;
      state.status = 'break-paused';
      save(state);
    } else return;
    setFocusStatusUI();
  }

  function resumeBreak(state) {
    state.breakStartedAt = now();
    state.status = 'break';
    save(state);
    setFocusStatusUI();
  }

  function startBreak() {
    const state = getState();
    const t = now();
    if (state.finalizing || !['running-focus', 'overtime', 'paused'].includes(state.status)) return;
    if (totalStudySec(state, t) < 60) {
      showToast?.('Complete pelo menos 1 minuto de foco antes de iniciar o descanso.', 'info');
      return;
    }
    foldPause(state, t);
    closeStretch(state, t);
    const block = focusElapsed(state, t);
    const target = Number(state.focusTargetSec) || 1500;
    // O bloco que acabou é somado ao total da sessão: nada se perde ao descansar.
    state.blocksDoneSec = (Number(state.blocksDoneSec) || 0) + block;
    state.overtimeDoneSec = (Number(state.overtimeDoneSec) || 0) + Math.max(0, block - target);
    state.focusAccumulatedSec = 0;
    state.focusStartedAt = null;
    const minutes = recommendedBreak(block >= 60 ? block : state.blocksDoneSec);
    state.breakDurationSec = minutes * 60;
    state.totalBreakSec = 0;
    state.breakStartedAt = t;
    state.breakEndNotified = false;
    state.breakCount = (Number(state.breakCount) || 0) + 1;
    state.status = 'break';
    save(state);
    cancelServerFocusSchedule(state);
    checkpoint('descanso');
    notify('Descanso iniciado', `${minutes} min de descanso. O foco só volta quando você apertar “Iniciar”.`, 'slc-break-start');
    setFocusStatusUI();
  }

  async function reset() {
    const state = getState();
    if (state.status === 'idle' || state.finalizing) return;
    if (totalStudySec(state) >= 60) await finalizeStudy('reset', { evidence: false });
    else discardState();
  }

  function startFromButton() {
    const state = getState();
    if (state.finalizing) return;
    if (state.status === 'break-paused') return resumeBreak(state);
    if (state.status === 'paused') return startFocus();
    startFocus(state.status === 'idle' || state.status === 'break-ended' ? durationFromUI() : undefined);
  }

  function tick() {
    const state = getState();
    if (state.finalizing) return;
    const t = now();
    if (state.status === 'running-focus') {
      const elapsed = focusElapsed(state, t);
      if (elapsed >= state.focusTargetSec && !state.focusEndNotified) {
        cancelServerFocusSchedule(state);
        state.focusEndNotified = true;
        state.status = 'overtime';
        state.focusAccumulatedSec = elapsed;
        state.focusStartedAt = t;
        save(state);
        notify('Foco concluído', `${state.subject || 'Seu estudo'}: o bloco terminou. Você pode continuar estudando ou iniciar o descanso recomendado.`, 'slc-focus-end');
      }
    } else if (state.status === 'break') {
      const elapsed = breakElapsed(state, t);
      if (elapsed >= state.breakDurationSec && !state.breakEndNotified) {
        state.breakEndNotified = true;
        state.breakDoneSec = (Number(state.breakDoneSec) || 0) + state.breakDurationSec;
        state.totalBreakSec = 0;
        state.breakStartedAt = null;
        state.status = 'break-ended';
        save(state);
        notify('Descanso terminou', 'Seu descanso acabou. Aperte “Novo bloco” quando estiver pronto para continuar.', 'slc-break-end');
      }
    }
    if (state.status !== 'idle' && t - Number(state.lastSavedAt || 0) > 5000) {
      state.lastHeartbeatAt = t;
      save(state);
    }
    autoCheckpoint(state, t);
    setFocusStatusUI();
  }

  // Sessão que ficou para trás (celular descarregou, aba fechada, cronômetro esquecido).
  async function recoverStale() {
    const state = getState();
    if (state.status === 'idle' || state.finalizing) return;
    const t = now();
    const hb = Number(state.lastHeartbeatAt || state.lastSavedAt || t);
    const gapMin = (t - hb) / 60000;
    if (['running-focus', 'overtime'].includes(state.status) && gapMin > 20) {
      // O aparelho provavelmente apagou/descarregou: conta só até o último sinal de vida.
      closeStretch(state, hb);
      state.focusAccumulatedSec = focusElapsed(state, hb);
      state.focusStartedAt = null;
      state.status = 'paused';
      state.pausedAt = hb;
      save(state);
      if (totalStudySec(state) >= 60) await finalizeStudy('recovered', { evidence: false });
      else discardState();
    } else if (['paused', 'break-paused', 'break-ended'].includes(state.status) && gapMin > 180) {
      if (totalStudySec(state) >= 60) await finalizeStudy('abandoned', { evidence: false });
      else discardState();
    }
  }

  function wire() {
    const app = window.app;
    if (!app || app.__slcFocusEngineWired) return;
    app.__slcFocusEngineWired = true;
    window.__SLCFocusState = load();

    app.startTimer = startFromButton;
    app.pauseTimer = pause;
    app.resetTimer = () => { reset(); };
    app.timerComplete = () => startBreak();

    const origLoadView = app.loadView?.bind(app);
    if (origLoadView) {
      app.loadView = function (view, ...args) {
        const r = origLoadView(view, ...args);
        if ((view || app.currentView) === 'foco') setTimeout(enhanceFocusView, 60);
        return r;
      };
    }

    document.addEventListener('click', e => {
      const target = e.target.closest?.('#focus-next-button,#focus-break-start,#focus-long-start,#focus-heavy-start');
      if (target) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const st = getState().status;
        if (target.id === 'focus-long-start') startFocus(50 * 60);
        else if (target.id === 'focus-heavy-start') startFocus(90 * 60);
        else if (target.id === 'focus-next-button' && BREAK_STATUSES.includes(st)) startFocus(durationFromUI());
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

    // Delegado: os selects são recriados a cada renderização da tela.
    document.addEventListener('change', e => {
      const id = e.target?.id;
      const s = getState();
      if (id === 'timer-materia') { s.subject = e.target.value || ''; save(s); }
      else if (id === 'timer-duracao' && s.status === 'idle') { s.focusTargetSec = durationFromUI(); save(s); setFocusStatusUI(); }
    });
    document.addEventListener('input', e => {
      if (e.target?.id === 'timer-topico') { const s = getState(); s.topic = e.target.value || ''; save(s); }
    });

    window.setInterval(tick, TICK_MS);
    document.addEventListener('visibilitychange', () => { if (document.hidden) flushOnLeave(); else tick(); });
    window.addEventListener('pagehide', flushOnLeave);
    window.addEventListener('focus', tick);
    window.addEventListener('beforeunload', () => save(getState()));
    window.addEventListener('online', () => { const s = getState(); if (s.status !== 'idle' && totalStudySec(s) >= 60) checkpoint('online'); });
    document.addEventListener('slc-focus-session-saved', () => setTimeout(enhanceFocusView, 120));

    patchMentorContext();
    setTimeout(patchMentorContext, 1500);
    setTimeout(patchMentorContext, 4000);

    setTimeout(async () => {
      await recoverStale();
      const state = getState();
      if (state.status !== 'idle') {
        syncLegacyFields(app, state);
        tick();
      }
    }, 150);
  }

  function enhanceFocusView() {
    if (!window.app || window.app.currentView !== 'foco') return;
    const state = getState();
    const select = document.getElementById('timer-materia');
    const pending = window.app.pendingFocusMateria || state.subject || '';
    const pendingTopic = window.app.pendingFocusTopic || state.topic || '';
    if (select && pending) {
      const exists = [...select.options].some(o => o.value === pending);
      if (exists) { select.value = pending; state.subject = pending; save(state); }
      window.app.pendingFocusMateria = '';
    }
    const topicInput = document.getElementById('timer-topico');
    if (topicInput && pendingTopic) { topicInput.value = pendingTopic; state.topic = pendingTopic; save(state); window.app.pendingFocusTopic = ''; }
    const linked = document.getElementById('timer-sessao-vinculada');
    if (linked && state.sessionId && [...linked.options].some(o => o.value === state.sessionId)) linked.value = state.sessionId;
    const dur = document.getElementById('timer-duracao');
    if (dur && state.status !== 'idle') {
      const m = String(Math.round(state.focusTargetSec / 60));
      if ([...dur.options].some(o => o.value === m)) dur.value = m;
    }

    const controls = document.querySelector('.focus-cycle-card .timer-controls') || document.querySelector('.timer-card .timer-controls');
    if (controls && !document.getElementById('focus-break-start')) {
      const resetBtn = controls.querySelector('#timer-reset');
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'timer-btn'; btn.id = 'focus-break-start';
      btn.innerHTML = '<i class="fas fa-mug-hot"></i> Descanso 5 min';
      resetBtn ? controls.insertBefore(btn, resetBtn) : controls.appendChild(btn);
    }
    const card = document.querySelector('.focus-cycle-card') || document.querySelector('.timer-card .card-body');
    if (card && !document.getElementById('focus-engine-meta')) {
      card.insertAdjacentHTML('beforeend', `
        <div class="focus-engine-meta" id="focus-engine-meta"></div>
        <p class="focus-insight-warn" id="focus-live-insight" style="display:none;margin:8px 0"></p>
        <div class="focus-engine-actions">
          <button type="button" class="btn-primary" id="focus-finish-session" style="display:none"><i class="fas fa-check"></i> Concluir estudo e registrar</button>
        </div>
        <p class="focus-engine-note"><i class="fas fa-shield-halved"></i> O relógio usa tempo real e a sessão é salva automaticamente a partir de 1 minuto: se o celular descarregar ou você esquecer o cronômetro pausado, o que você estudou não se perde. O descanso nunca começa sozinho.</p>
        <div class="focus-engine-notification" id="focus-engine-notification"></div>
      `);
      lastNotifHtml = '';
    }
    if (!document.getElementById('focus-insights-card')) {
      const anchor = document.querySelector('.timer-card');
      if (anchor) anchor.insertAdjacentHTML('afterend', '<div class="card" id="focus-insights-card"></div>');
    }
    renderInsightsCard();

    const pendingId = getPendingEvidenceId();
    if (pendingId && !document.getElementById('slc-learning-evidence-pending')) {
      const note = document.createElement('div');
      note.id = 'slc-learning-evidence-pending';
      note.className = 'learning-evidence-pending';
      note.innerHTML = '<i class="fas fa-brain"></i><span><strong>Evidência de aprendizagem pendente</strong><small>Registre o que você realmente conseguiu recuperar nesta sessão.</small></span><button type="button" class="btn-secondary btn-sm">Avaliar agora</button>';
      (document.querySelector('.focus-cycle-card') || document.querySelector('.timer-card .card-body'))?.appendChild(note);
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
    focusInsights,
    showLearningEvidenceModal,
    applyLearningEvidence,
    tick,
    fmt
  };

  boot();
})();
