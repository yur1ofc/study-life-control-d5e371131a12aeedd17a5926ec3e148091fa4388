// exam-study-popup.js
// Na primeira vez que o site abre no dia, se tiver prova/trabalho perto
// (próximos DIAS_LIMITE dias) sem sessão de estudo já programada pra ele,
// pergunta se a pessoa quer programar uma sessão de estudo — já perguntando
// o dia e os conteúdos — e abre o modal de "Nova Sessão" preenchido.

(function () {
  'use strict';

  const DIAS_LIMITE = 5;
  const SHOWN_KEY_PREFIX = 'slc-exam-popup-shown-';

  function todayKey() {
    const d = new Date();
    return `${SHOWN_KEY_PREFIX}${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  function alreadyShownToday() {
    try { return sessionStorage.getItem(todayKey()) === '1'; } catch (_) { return false; }
  }

  function markShownToday() {
    try { sessionStorage.setItem(todayKey(), '1'); } catch (_) { /* ignore */ }
  }

  function diasAte(dataStr) {
    const alvo = new Date(dataStr);
    alvo.setHours(0, 0, 0, 0);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return Math.round((alvo - hoje) / 86400000);
  }

  function jaTemSessaoParaEvento(app, materia, alvoData) {
    const sessions = Array.isArray(app.data.sessions) ? app.data.sessions : [];
    return sessions.some(s => {
      if (s.materia !== materia) return false;
      const dias = Math.abs(diasAte(s.data));
      return dias <= 1 || new Date(s.data) <= new Date(alvoData);
    });
  }

  function encontrarProximoEvento(app) {
    const exams = Array.isArray(app.data.exams) ? app.data.exams : [];
    const tasks = Array.isArray(app.data.tasks) ? app.data.tasks : [];

    const candidatosProva = exams
        .filter(e => !e.concluida)
        .map(e => ({ tipoEvento: 'prova', titulo: e.titulo, materia: e.materia, data: e.data, dias: diasAte(e.data) }));

    const candidatosTarefa = tasks
        .filter(t => !t.concluida)
        .map(t => ({ tipoEvento: 'trabalho', titulo: t.titulo, materia: t.materia, data: t.dataLimite, dias: diasAte(t.dataLimite) }));

    const todos = [...candidatosProva, ...candidatosTarefa]
        .filter(c => c.dias >= 0 && c.dias <= DIAS_LIMITE)
        .filter(c => !jaTemSessaoParaEvento(app, c.materia, c.data))
        .sort((a, b) => a.dias - b.dias);

    return todos[0] || null;
  }

  function fmtRelativo(dias) {
    if (dias === 0) return 'hoje';
    if (dias === 1) return 'amanhã';
    return `em ${dias} dias`;
  }

  function sugerirDataSessao(dataEvento) {
    const alvo = new Date(dataEvento);
    alvo.setDate(alvo.getDate() - 1);
    if (alvo < new Date()) alvo.setTime(Date.now());
    alvo.setHours(19, 0, 0, 0);
    alvo.setMinutes(alvo.getMinutes() - alvo.getTimezoneOffset());
    return alvo.toISOString().slice(0, 16);
  }

  function buildModal(evento) {
    const overlay = document.createElement('div');
    overlay.id = 'exam-popup-overlay';
    overlay.className = 'exam-popup-overlay';
    const label = evento.tipoEvento === 'prova' ? 'Prova' : 'Trabalho';
    overlay.innerHTML = `
      <div class="exam-popup-card">
        <div class="exam-popup-icon"><i class="fas fa-graduation-cap"></i></div>
        <h3>${label} de ${escapeHtml(evento.materia)} ${fmtRelativo(evento.dias)}</h3>
        <p class="text-secondary">"${escapeHtml(evento.titulo)}" — quer programar uma sessão de estudo pra se preparar?</p>
        <div class="wiz-field" style="text-align:left">
          <label>Quando estudar</label>
          <input type="datetime-local" id="exam-popup-data" value="${sugerirDataSessao(evento.data)}">
        </div>
        <div class="wiz-field" style="text-align:left">
          <label>O que estudar (opcional)</label>
          <input type="text" id="exam-popup-conteudo" placeholder="Ex: capítulos 3 e 4, exercícios da lista 2">
        </div>
        <div class="exam-popup-actions">
          <button type="button" class="btn-secondary" id="exam-popup-skip">Agora não</button>
          <button type="button" class="btn-primary" id="exam-popup-confirm">Programar sessão</button>
        </div>
      </div>`;
    return overlay;
  }

  // Delega para window.escapeHtml (utils.js) quando disponível; fallback
  // idêntico mantido só por segurança de ordem de carregamento.
  function escapeHtml(str) {
    if (window.escapeHtml) return window.escapeHtml(str);
    return String(str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function showPopup(evento) {
    if (document.getElementById('exam-popup-overlay')) return;
    const overlay = buildModal(evento);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-visible'));

    const close = () => { overlay.classList.remove('is-visible'); setTimeout(() => overlay.remove(), 200); };

    document.getElementById('exam-popup-skip')?.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    document.getElementById('exam-popup-confirm')?.addEventListener('click', () => {
      const dataEscolhida = document.getElementById('exam-popup-data')?.value;
      const conteudo = document.getElementById('exam-popup-conteudo')?.value || '';
      close();
      window.app?.openModal?.('sessao', {
        materia: evento.materia,
        tipo: 'foco',
        data: dataEscolhida,
        topico: conteudo || `Preparação para ${evento.tipoEvento === 'prova' ? 'prova' : 'trabalho'}: ${evento.titulo}`
      });
    });
  }

  function maybeShow() {
    if (alreadyShownToday()) return;
    const app = window.app;
    if (!app?.data) return;
    const evento = encontrarProximoEvento(app);
    if (!evento) return;
    markShownToday();
    setTimeout(() => showPopup(evento), 1800);
  }

  document.addEventListener('app-ready', maybeShow);
})();
