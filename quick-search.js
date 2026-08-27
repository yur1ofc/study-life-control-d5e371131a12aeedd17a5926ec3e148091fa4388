// quick-search.js
// Busca rápida universal: pesquisa matérias, provas/trabalhos, sessões,
// tópicos do mapa de aprendizado e materiais de estudo, tudo num lugar só.
// Abre com o botão de lupa no topo ou com Ctrl/Cmd+K.
// Resultado de matéria vem com ações rápidas (estudar, editar, +prova, +trabalho)
// pra não precisar navegar até a tela certa antes de agir.

(function () {
  'use strict';

  function esc(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function norm(str) {
    return String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function buildOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'quick-search-overlay';
    overlay.className = 'quick-search-overlay';
    overlay.innerHTML = `
      <div class="quick-search-box">
        <div class="quick-search-input-row">
          <i class="fas fa-search"></i>
          <input type="text" id="quick-search-input" placeholder="Buscar matéria, prova, trabalho, sessão, tópico, material..." autocomplete="off">
          <button type="button" class="btn-icon" id="quick-search-close" title="Fechar (Esc)"><i class="fas fa-times"></i></button>
        </div>
        <div class="quick-search-results" id="quick-search-results">
          <p class="quick-search-hint text-secondary">Digite pra buscar em tudo que você já cadastrou no app.</p>
        </div>
      </div>`;
    return overlay;
  }

  function coletarResultados(app, termoBruto) {
    const termo = norm(termoBruto);
    if (!termo) return { materias: [], provas: [], tarefas: [], sessoes: [], topicos: [], materiais: [] };
    const data = app.data || {};

    const materias = (data.subjects || []).filter(s => norm(s.nome).includes(termo)).slice(0, 5);
    const provas = (data.exams || []).filter(e => norm(e.titulo).includes(termo) || norm(e.materia).includes(termo)).slice(0, 5);
    const tarefas = (data.tasks || []).filter(t => norm(t.titulo).includes(termo) || norm(t.materia).includes(termo)).slice(0, 5);
    const sessoes = (data.sessions || []).filter(s => norm(s.materia).includes(termo) || norm(s.topico).includes(termo)).slice(0, 5);
    const topicos = (data.learningMap || []).filter(t => norm(t.nome).includes(termo) || norm(t.materia).includes(termo)).slice(0, 5);
    const materiais = (data.materials || []).filter(m => norm(m.titulo).includes(termo) || norm(m.materia).includes(termo)).slice(0, 5);

    return { materias, provas, tarefas, sessoes, topicos, materiais };
  }

  function renderGrupo(titulo, itens, renderItem) {
    if (!itens.length) return '';
    return `<div class="quick-search-group">
        <div class="quick-search-group-title">${titulo}</div>
        ${itens.map(renderItem).join('')}
      </div>`;
  }

  function renderResultados(app, resultados) {
    const { materias, provas, tarefas, sessoes, topicos, materiais } = resultados;
    const total = materias.length + provas.length + tarefas.length + sessoes.length + topicos.length + materiais.length;

    if (!total) {
      return '<p class="quick-search-hint text-secondary">Nada encontrado. Tente outro termo.</p>';
    }

    let html = '';

    html += renderGrupo('📚 Matérias', materias, m => `
      <div class="quick-search-item quick-search-item-materia">
        <span class="quick-search-item-label"><i class="fas fa-book"></i> ${esc(m.nome)}</span>
        <div class="quick-search-item-actions">
          <button type="button" class="qs-action" data-qs-action="estudar" data-qs-materia="${esc(m.nome)}" title="Iniciar sessão de estudo"><i class="fas fa-clock"></i> Estudar</button>
          <button type="button" class="qs-action" data-qs-action="editar-materia" data-qs-id="${esc(m.id)}" title="Editar matéria"><i class="fas fa-edit"></i></button>
          <button type="button" class="qs-action" data-qs-action="add-prova" data-qs-materia="${esc(m.nome)}" title="Adicionar prova/trabalho"><i class="fas fa-graduation-cap"></i></button>
          <button type="button" class="qs-action" data-qs-action="add-tarefa" data-qs-materia="${esc(m.nome)}" title="Adicionar tarefa"><i class="fas fa-tasks"></i></button>
        </div>
      </div>`);

    html += renderGrupo('🎓 Provas e trabalhos', provas, e => `
      <div class="quick-search-item" data-qs-action="editar-prova" data-qs-id="${esc(e.id)}">
        <span class="quick-search-item-label"><i class="fas fa-graduation-cap"></i> ${esc(e.titulo)} <small class="text-secondary">${esc(e.materia)}</small></span>
      </div>`);

    html += renderGrupo('📋 Tarefas', tarefas, t => `
      <div class="quick-search-item" data-qs-action="editar-tarefa" data-qs-id="${esc(t.id)}">
        <span class="quick-search-item-label"><i class="fas fa-tasks"></i> ${esc(t.titulo)} <small class="text-secondary">${esc(t.materia)}</small></span>
      </div>`);

    html += renderGrupo('⏰ Sessões de estudo', sessoes, s => `
      <div class="quick-search-item" data-qs-action="editar-sessao" data-qs-id="${esc(s.id)}">
        <span class="quick-search-item-label"><i class="fas fa-clock"></i> ${esc(s.materia)} <small class="text-secondary">${esc(s.topico || s.tipo || '')}</small></span>
      </div>`);

    html += renderGrupo('🗺️ Mapa de aprendizado', topicos, t => `
      <div class="quick-search-item" data-qs-action="editar-topico" data-qs-id="${esc(t.id)}">
        <span class="quick-search-item-label"><i class="fas fa-map"></i> ${esc(t.nome)} <small class="text-secondary">${esc(t.materia)}</small></span>
      </div>`);

    html += renderGrupo('📁 Materiais', materiais, m => `
      <div class="quick-search-item" data-qs-action="editar-material" data-qs-id="${esc(m.id)}">
        <span class="quick-search-item-label"><i class="fas fa-folder"></i> ${esc(m.titulo)} <small class="text-secondary">${esc(m.materia)}</small></span>
      </div>`);

    return html;
  }

  function executarAcao(app, action, dataset) {
    switch (action) {
      case 'estudar':
        app.openModal('sessao', { materia: dataset.qsMateria });
        break;
      case 'editar-materia':
        app.editarMateria(dataset.qsId);
        break;
      case 'add-prova':
        app.openModal('prova', { materia: dataset.qsMateria });
        break;
      case 'add-tarefa':
        app.openModal('tarefa', { materia: dataset.qsMateria });
        break;
      case 'editar-prova':
        app.editarProva(dataset.qsId);
        break;
      case 'editar-tarefa':
        app.editarTarefa(dataset.qsId);
        break;
      case 'editar-sessao':
        app.editarSessao(dataset.qsId);
        break;
      case 'editar-topico':
        app.editarTopico(dataset.qsId);
        break;
      case 'editar-material':
        app.editarMaterial(dataset.qsId);
        break;
      default:
        return;
    }
  }

  let overlayEl = null;

  function close() {
    if (!overlayEl) return;
    overlayEl.classList.remove('is-visible');
    setTimeout(() => { overlayEl?.remove(); overlayEl = null; }, 150);
  }

  function open() {
    if (overlayEl) { document.getElementById('quick-search-input')?.focus(); return; }
    if (!window.app?.data) return;

    overlayEl = buildOverlay();
    document.body.appendChild(overlayEl);
    requestAnimationFrame(() => overlayEl.classList.add('is-visible'));

    const input = document.getElementById('quick-search-input');
    const results = document.getElementById('quick-search-results');
    input.focus();

    input.addEventListener('input', () => {
      const resultados = coletarResultados(window.app, input.value);
      results.innerHTML = renderResultados(window.app, resultados);
    });

    results.addEventListener('click', e => {
      const target = e.target.closest('[data-qs-action]');
      if (!target) return;
      executarAcao(window.app, target.dataset.qsAction, target.dataset);
      close();
    });

    document.getElementById('quick-search-close')?.addEventListener('click', close);
    overlayEl.addEventListener('click', e => { if (e.target === overlayEl) close(); });
  }

  function ensureButton() {
    const actions = document.querySelector('.header-actions');
    if (!actions || document.getElementById('quick-search-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'btn-icon';
    btn.id = 'quick-search-btn';
    btn.type = 'button';
    btn.title = 'Busca rápida (Ctrl+K)';
    btn.innerHTML = '<i class="fas fa-search"></i>';
    btn.addEventListener('click', open);
    actions.insertBefore(btn, actions.firstChild);
  }

  document.addEventListener('app-ready', ensureButton);

  document.addEventListener('keydown', e => {
    const isSearchShortcut = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';
    if (isSearchShortcut) { e.preventDefault(); open(); return; }
    if (e.key === 'Escape' && overlayEl) close();
  });
})();
