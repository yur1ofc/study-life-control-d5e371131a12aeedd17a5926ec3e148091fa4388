(function () {
  'use strict';

  const COMMUNITY_BOOTSTRAP = {
    'ufob__engenharia-civil': {
      key: 'ufob__engenharia-civil',
      faculdade: 'UFOB',
      curso: 'Engenharia Civil',
      source: 'bootstrap',
      version: '2026.1',
      confidence: 0.92,
      subjects: [
        { nome: 'Cálculo Diferencial I', codigo: 'MAT001', semestre: '1', cargaHoraria: 60, creditos: 4, tipo: 'obrigatoria', prerequisitosLista: [] },
        { nome: 'Física I', codigo: 'FIS001', semestre: '1', cargaHoraria: 60, creditos: 4, tipo: 'obrigatoria', prerequisitosLista: [] },
        { nome: 'Geometria Analítica', codigo: 'MAT002', semestre: '1', cargaHoraria: 60, creditos: 4, tipo: 'obrigatoria', prerequisitosLista: [] },
        { nome: 'Introdução ao Desenho Técnico', codigo: 'DTE001', semestre: '1', cargaHoraria: 60, creditos: 4, tipo: 'obrigatoria', prerequisitosLista: [] }
      ]
    },
    'ufob__bacharelado-interdisciplinar-em-ciencia-e-tecnologia': {
      key: 'ufob__bacharelado-interdisciplinar-em-ciencia-e-tecnologia',
      faculdade: 'UFOB',
      curso: 'Bacharelado Interdisciplinar em Ciência e Tecnologia',
      source: 'bootstrap',
      version: '2023.1',
      confidence: 0.95,
      subjects: [
        // Semestre 1
        { nome: 'Ciências do Ambiente', codigo: 'CET0034', semestre: '1', cargaHoraria: 30, creditos: 2, tipo: 'obrigatoria', prerequisitosLista: [] },
        { nome: 'Oficina de Leitura e Produção Textual', codigo: 'CHU0001', semestre: '1', cargaHoraria: 60, creditos: 4, tipo: 'obrigatoria', prerequisitosLista: [] },
        { nome: 'Elaboração de Documentos em Propriedade Intelectual e Inovação', codigo: 'CET5180', semestre: '1', cargaHoraria: 60, creditos: 4, tipo: 'obrigatoria', prerequisitosLista: [] },
        { nome: 'Introdução ao Desenho Técnico', codigo: 'CET0176', semestre: '1', cargaHoraria: 60, creditos: 4, tipo: 'obrigatoria', prerequisitosLista: [] },
        { nome: 'Fundamentos de Física', codigo: 'CET5029', semestre: '1', cargaHoraria: 60, creditos: 4, tipo: 'obrigatoria', prerequisitosLista: [] },
        { nome: 'Geometria Analítica', codigo: 'CET5115', semestre: '1', cargaHoraria: 90, creditos: 6, tipo: 'obrigatoria', prerequisitosLista: [] },
        // Semestre 2
        { nome: 'Lógica e Conjuntos', codigo: 'CET5052', semestre: '2', cargaHoraria: 60, creditos: 4, tipo: 'obrigatoria', prerequisitosLista: [] },
        { nome: 'Tecnologia de Informação e Comunicação', codigo: 'CET0289', semestre: '2', cargaHoraria: 90, creditos: 6, tipo: 'obrigatoria', prerequisitosLista: [] },
        { nome: 'Pesquisa e Desenvolvimento I', codigo: 'CET0031', semestre: '2', cargaHoraria: 150, creditos: 10, tipo: 'obrigatoria', prerequisitosLista: [] },
        { nome: 'Cálculo Diferencial I', codigo: 'CET5139', semestre: '2', cargaHoraria: 60, creditos: 4, tipo: 'obrigatoria', prerequisitosLista: [] },
        { nome: 'Ciência, Tecnologia e Sociedade', codigo: '', semestre: '2', cargaHoraria: 60, creditos: 4, tipo: 'obrigatoria', prerequisitosLista: [] },
        // Semestre 3
        { nome: 'Fundamentos de Química Geral e Inorgânica', codigo: 'CET0124', semestre: '3', cargaHoraria: 60, creditos: 4, tipo: 'obrigatoria', prerequisitosLista: [] },
        { nome: 'Fundamentos de Química Geral Experimental', codigo: 'CET0125', semestre: '3', cargaHoraria: 30, creditos: 2, tipo: 'obrigatoria', prerequisitosLista: [] },
        { nome: 'Álgebra Linear I', codigo: 'CET5119', semestre: '3', cargaHoraria: 60, creditos: 4, tipo: 'obrigatoria', prerequisitosLista: [] },
        { nome: 'Física I', codigo: 'CET5030', semestre: '3', cargaHoraria: 60, creditos: 4, tipo: 'obrigatoria', prerequisitosLista: [] },
        { nome: 'Programação de Computadores I', codigo: 'CET5116', semestre: '3', cargaHoraria: 60, creditos: 4, tipo: 'obrigatoria', prerequisitosLista: [] },
        // Semestre 4
        { nome: 'Física II', codigo: 'CET5031', semestre: '4', cargaHoraria: 60, creditos: 4, tipo: 'obrigatoria', prerequisitosLista: ['Física I'] },
        { nome: 'Física Experimental I', codigo: '', semestre: '4', cargaHoraria: 30, creditos: 2, tipo: 'obrigatoria', prerequisitosLista: [] },
        { nome: 'Programação de Computadores II', codigo: 'CET5085', semestre: '4', cargaHoraria: 60, creditos: 4, tipo: 'obrigatoria', prerequisitosLista: ['Programação de Computadores I'] },
        { nome: 'Oficina de Leitura e Produção de Textos Acadêmicos', codigo: 'CHU0003', semestre: '4', cargaHoraria: 60, creditos: 4, tipo: 'obrigatoria', prerequisitosLista: [] },
        { nome: 'Filosofia e História das Ciências', codigo: 'CHU0002', semestre: '4', cargaHoraria: 60, creditos: 4, tipo: 'obrigatoria', prerequisitosLista: [] },
        // Semestre 5
        { nome: 'Física Experimental II', codigo: '', semestre: '5', cargaHoraria: 30, creditos: 2, tipo: 'obrigatoria', prerequisitosLista: [] },
        { nome: 'Métodos Estatísticos', codigo: '', semestre: '5', cargaHoraria: 60, creditos: 4, tipo: 'obrigatoria', prerequisitosLista: [] },
        { nome: 'Introdução à Administração', codigo: 'CHU2005', semestre: '5', cargaHoraria: 60, creditos: 4, tipo: 'obrigatoria', prerequisitosLista: [] },
        { nome: 'Propriedade Intelectual', codigo: 'CET0251', semestre: '5', cargaHoraria: 60, creditos: 4, tipo: 'obrigatoria', prerequisitosLista: [] },
        { nome: 'Indicadores e Legislação em Ciência e Tecnologia', codigo: 'CET5181', semestre: '5', cargaHoraria: 60, creditos: 4, tipo: 'obrigatoria', prerequisitosLista: [] },
        // Semestre 6
        { nome: 'Pesquisa e Desenvolvimento II', codigo: '', semestre: '6', cargaHoraria: 150, creditos: 10, tipo: 'obrigatoria', prerequisitosLista: ['Pesquisa e Desenvolvimento I'] },
        // Optativa
        { nome: 'Optativa Livre', codigo: '', semestre: '0', cargaHoraria: 60, creditos: 4, tipo: 'optativa', prerequisitosLista: [] }
      ]
    },
    // Aliases para variações de digitação do BICT
    'ufob__bict': {
      key: 'ufob__bacharelado-interdisciplinar-em-ciencia-e-tecnologia',
      _alias: true
    },
    'ufob__bacharelado-interdisciplinar-em-ciencias-e-tecnologia': {
      key: 'ufob__bacharelado-interdisciplinar-em-ciencia-e-tecnologia',
      _alias: true
    }
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function injectStyles() {
    if (document.getElementById('community-catalog-styles')) return;
    const style = document.createElement('style');
    style.id = 'community-catalog-styles';
    style.textContent = `
      .catalog-hero{display:grid;grid-template-columns:2fr 1fr;gap:16px;margin:18px 0;padding:18px;border-radius:18px;background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff}
      .catalog-hero h3{margin:0 0 8px;font-size:1.15rem}
      .catalog-hero p{margin:0;opacity:.9;line-height:1.45}
      .catalog-hero .catalog-actions{display:flex;flex-wrap:wrap;gap:10px;align-content:flex-start;justify-content:flex-end}
      .catalog-btn{border:none;border-radius:12px;padding:10px 14px;font-weight:700;cursor:pointer}
      .catalog-btn.primary{background:#22c55e;color:#06230f}
      .catalog-btn.secondary{background:#fff;color:#0f172a}
      .catalog-btn.ghost{background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.18)}
      .catalog-badges{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
      .catalog-badge{padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.1);font-size:.85rem}
      .catalog-hero-slim{display:block;padding:0;border-radius:14px;overflow:hidden}
      .catalog-hero-toggle{width:100%;display:flex;align-items:center;gap:10px;padding:12px 16px;background:transparent;border:none;color:#fff;cursor:pointer;text-align:left;font:inherit}
      .catalog-hero-toggle span{flex:1;font-size:.86rem;line-height:1.35;opacity:.92}
      .catalog-hero-toggle span strong{opacity:1}
      .catalog-hero-chevron{transition:transform .2s ease;font-size:.8rem;opacity:.75}
      .catalog-hero-chevron.rotated{transform:rotate(180deg)}
      .catalog-hero-body{padding:0 16px 16px}
      .catalog-hero-body p{margin:0 0 10px;font-size:.85rem}
      .catalog-hero-body .catalog-actions{justify-content:flex-start}
      .catalog-modal-overlay{position:fixed;inset:0;background:rgba(2,6,23,.72);display:none;align-items:center;justify-content:center;z-index:9999;padding:16px}
      .catalog-modal{width:min(980px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:22px;box-shadow:0 25px 80px rgba(0,0,0,.28)}
      .catalog-modal header{padding:22px 22px 12px;border-bottom:1px solid #e5e7eb;display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
      .catalog-modal header h2{margin:0;font-size:1.25rem;color:#0f172a}
      .catalog-modal header p{margin:6px 0 0;color:#475569}
      .catalog-modal .body{padding:20px 22px 22px}
      .catalog-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      .catalog-field label{display:block;font-weight:700;margin-bottom:6px;color:#0f172a}
      .catalog-field input,.catalog-field select,.catalog-field textarea{width:100%;border:1px solid #cbd5e1;border-radius:12px;padding:11px 12px;font:inherit;background:#fff;color:#0f172a}
      .catalog-field textarea{min-height:180px;resize:vertical}
      .catalog-preview{margin-top:16px;border:1px solid #e2e8f0;border-radius:16px;padding:14px;background:#f8fafc}
      .catalog-preview h4{margin:0 0 10px;color:#0f172a}
      .catalog-preview-list{max-height:260px;overflow:auto;display:grid;gap:8px}
      .catalog-preview-item{padding:10px 12px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;color:#0f172a}
      .catalog-footer{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:18px}
      .catalog-small{font-size:.9rem;color:#475569}
      .catalog-close{background:#e2e8f0;color:#0f172a}
      .catalog-success{background:#ecfdf5;border:1px solid #86efac;color:#166534;padding:10px 12px;border-radius:12px;margin-top:12px}
      .catalog-warning{background:#fff7ed;border:1px solid #fdba74;color:#9a3412;padding:10px 12px;border-radius:12px;margin-top:12px}
      @media (max-width: 820px){
        .catalog-hero{grid-template-columns:1fr}
        .catalog-hero .catalog-actions{justify-content:flex-start}
        .catalog-grid{grid-template-columns:1fr}
      }
    `;
    document.head.appendChild(style);
  }

  function slugify(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/&/g, ' e ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function normalizeName(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\b(i|ii|iii|iv|v|vi|vii|viii|ix|x)\b/g, function (m) {
        return ({ i:'1',ii:'2',iii:'3',iv:'4',v:'5',vi:'6',vii:'7',viii:'8',ix:'9',x:'10' }[m] || m);
      })
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function catalogKey(faculdade, curso) {
    return slugify(faculdade) + '__' + slugify(curso);
  }

  function ensureArray(v) { return Array.isArray(v) ? v : []; }
  function ensureObject(v) { return v && typeof v === 'object' ? v : {}; }
  function uid() { return window.generateId ? window.generateId() : 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9); }
  function neutralStatus() { return 'nao-cursada'; }

  function normalizeCurriculumItem(item) {
    item = ensureObject(item);
    const prereqText = ensureArray(item.prerequisitosLista).length
      ? item.prerequisitosLista
      : String(item.prerequisitos || '').split(/[;,]/).map(s => s.trim()).filter(Boolean);

    return {
      id: item.id || uid(),
      nome: String(item.nome || item.title || '').trim(),
      codigo: String(item.codigo || '').trim().toUpperCase(),
      semestre: String(item.semestre || item.periodo || '').trim(),
      cargaHoraria: Number(item.cargaHoraria || item.ch || 0) || 0,
      creditos: Number(item.creditos || 0) || 0,
      tipo: item.tipo || 'obrigatoria',
      status: item.status || neutralStatus(),
      prerequisitosLista: Array.from(new Set(prereqText.map(s => s.trim()).filter(Boolean))),
      origemTemplate: item.origemTemplate || null,
      editadoPeloUsuario: !!item.editadoPeloUsuario,
      observacoes: item.observacoes || ''
    };
  }

  function neutralizeForCatalog(item) {
    const n = normalizeCurriculumItem(item);
    return { ...n, status: neutralStatus(), editadoPeloUsuario: false };
  }

  function preferStatus(a, b) {
    const rank = { concluida: 3, cursando: 2, 'nao-cursada': 1, 'nao cursada': 1, pendente: 1 };
    const sa = String(a || neutralStatus()).toLowerCase();
    const sb = String(b || neutralStatus()).toLowerCase();
    return (rank[sb] || 0) > (rank[sa] || 0) ? b : a;
  }

  function mergeCurriculumItem(base, extra) {
    const a = normalizeCurriculumItem(base);
    const b = normalizeCurriculumItem(extra);
    const prereqs = Array.from(new Set([].concat(a.prerequisitosLista || [], b.prerequisitosLista || []).filter(Boolean)));
    return {
      ...a,
      ...b,
      nome: a.nome || b.nome,
      codigo: a.codigo || b.codigo,
      semestre: a.semestre || b.semestre,
      cargaHoraria: Number(a.cargaHoraria) || Number(b.cargaHoraria) || 0,
      creditos: Number(a.creditos) || Number(b.creditos) || 0,
      tipo: a.tipo || b.tipo || 'obrigatoria',
      status: preferStatus(a.status, b.status),
      prerequisitosLista: prereqs
    };
  }

  function dedupeCurriculum(items) {
    const seen = new Map();
    const result = [];
    ensureArray(items).forEach(item => {
      if (!item || !item.nome) return;
      const normalized = normalizeCurriculumItem(item);
      const key = normalizeName(normalized.nome) + '__' + String(normalized.codigo || '').trim().toUpperCase();
      if (seen.has(key)) {
        result[seen.get(key)] = mergeCurriculumItem(result[seen.get(key)], normalized);
      } else {
        seen.set(key, result.length);
        result.push(normalized);
      }
    });
    return result;
  }

  function ensureUserDataCompatibility(app) {
    if (!app) return;
    app.data = ensureObject(app.data);
    app.data.user = ensureObject(app.data.user);
    const arrays = ['curriculum','subjects','tasks','exams','sessions','grades','reviews','classDiaries','dailyLogs','materials'];
    arrays.forEach(key => { if (!Array.isArray(app.data[key])) app.data[key] = []; });
    ['universidade','curso','semestre','matrizVersion'].forEach(key => { if (app.data.user[key] == null) app.data.user[key] = ''; });
    app.data.curriculum = dedupeCurriculum(app.data.curriculum);
  }

  function mergeIntoUserCurriculum(app, incoming, sourceLabel) {
    ensureUserDataCompatibility(app);
    const normalizedIncoming = dedupeCurriculum(ensureArray(incoming).map(item => ({
      ...neutralizeForCatalog(item),
      origemTemplate: sourceLabel || item.origemTemplate || null,
      status: neutralStatus()
    })));

    const current = dedupeCurriculum(app.data.curriculum || []);
    const map = new Map();
    current.forEach(item => {
      const key = normalizeName(item.nome) + '__' + String(item.codigo || '').trim().toUpperCase();
      map.set(key, normalizeCurriculumItem(item));
    });
    normalizedIncoming.forEach(item => {
      const key = normalizeName(item.nome) + '__' + String(item.codigo || '').trim().toUpperCase();
      if (map.has(key)) {
        const merged = mergeCurriculumItem(map.get(key), item);
        merged.status = map.get(key).status || neutralStatus();
        map.set(key, merged);
      } else {
        map.set(key, normalizeCurriculumItem(item));
      }
    });
    app.data.curriculum = Array.from(map.values());
    if (typeof app.normalizeCurriculumInMemory === 'function') app.normalizeCurriculumInMemory();
    return app.data.curriculum;
  }

  function toSubject(curriculumItem) {
    return { id: uid(), nome: curriculumItem.nome, dificuldade: 3, peso: 3, notaDesejada: 7 };
  }

  function maybePopulateSubjectsFromSemester(app) {
    ensureUserDataCompatibility(app);
    const semester = String(app.data.user.semestre || '').trim();
    if (!semester) return;
    const current = ensureArray(app.data.subjects);
    const existingNames = new Set(current.map(s => normalizeName(s.nome)));
    const additions = ensureArray(app.data.curriculum)
      .filter(c => String(c.semestre || '').trim() === semester)
      .filter(c => !existingNames.has(normalizeName(c.nome)))
      .map(toSubject);
    if (additions.length) app.data.subjects = current.concat(additions);
  }

  function parseTextToCurriculum(text, defaultSemester) {
    const lines = String(text || '').split(/\n+/).map(line => line.trim()).filter(Boolean);
    const items = [];
    let currentSemester = String(defaultSemester || '').trim();
    lines.forEach(line => {
      const semMatch = line.match(/(?:^|\b)(\d{1,2})\s*[ºo]?\s*(?:semestre|periodo|per[ií]odo)\b/i);
      if (semMatch) { currentSemester = semMatch[1]; return; }
      if (/^(matriz|grade|curso|faculdade|universidade|disciplina[s]?|componentes?)\b/i.test(line)) return;
      const cargaMatch = line.match(/(\d{2,3})\s*h\b/i);
      const creditMatch = line.match(/(\d{1,2})\s*cr[eé]dit/i);
      const codeMatch = line.match(/\b([A-Z]{2,}\d{2,}|\d{5,}|[A-Z]{3,}-\d{2,})\b/);
      const prereqMatch = line.match(/pr[eé]-?requisit(?:o|os)\s*[:\-]\s*(.+)$/i);
      const cleaned = line
        .replace(/\b\d{1,2}\s*[ºo]?\s*(?:semestre|periodo|per[ií]odo)\b/ig, '')
        .replace(/\b\d{2,3}\s*h\b/ig, '')
        .replace(/\b\d{1,2}\s*cr[eé]dit(?:o|os)?\b/ig, '')
        .replace(/\bpr[eé]-?requisit(?:o|os)\s*[:\-].+$/ig, '')
        .replace(/\b([A-Z]{2,}\d{2,}|\d{5,}|[A-Z]{3,}-\d{2,})\b/g, '')
        .replace(/^[\-\–\—\•\*]+/, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      if (!cleaned || cleaned.length < 3) return;
      items.push(neutralizeForCatalog({
        nome: cleaned,
        codigo: codeMatch ? codeMatch[1] : '',
        semestre: currentSemester || '',
        cargaHoraria: cargaMatch ? Number(cargaMatch[1]) : 0,
        creditos: creditMatch ? Number(creditMatch[1]) : 0,
        tipo: /optativa/i.test(line) ? 'optativa' : 'obrigatoria',
        prerequisitosLista: prereqMatch ? prereqMatch[1].split(/[;,]/).map(s => s.trim()).filter(Boolean) : []
      }));
    });
    return dedupeCurriculum(items);
  }

  function buildPreviewHtml(items) {
    if (!items.length) {
      return '<div class="catalog-warning">Nada útil foi encontrado no texto. Tente colar linha por linha, de preferência com nome da disciplina e carga horária.</div>';
    }
    return `
      <h4>Prévia da importação (${items.length} componentes)</h4>
      <div class="catalog-preview-list">
        ${items.slice(0, 80).map(item => `
          <div class="catalog-preview-item">
            <strong>${escapeHtml(item.nome)}</strong><br>
            <span>${item.semestre ? `${escapeHtml(item.semestre)}º semestre` : 'Sem semestre'}${item.cargaHoraria ? ` • ${item.cargaHoraria}h` : ''}${item.codigo ? ` • ${escapeHtml(item.codigo)}` : ''}</span>
            ${item.prerequisitosLista?.length ? `<div style="margin-top:6px;font-size:.9rem;color:#475569">Pré: ${escapeHtml(item.prerequisitosLista.join(', '))}</div>` : ''}
          </div>
        `).join('')}
      </div>
      ${items.length > 80 ? '<div class="catalog-small" style="margin-top:10px">Mostrando só os 80 primeiros da prévia.</div>' : ''}
    `;
  }

  function ensureModal() {
    if (document.getElementById('catalog-community-modal')) return;
    const overlay = document.createElement('div');
    overlay.id = 'catalog-community-modal';
    overlay.className = 'catalog-modal-overlay';
    overlay.innerHTML = `
      <div class="catalog-modal">
        <header>
          <div>
            <h2>Catálogo inteligente de grade curricular</h2>
            <p>Importe o curso pronto, aproveite grades já cadastradas por outros alunos ou cole um fluxograma em texto.</p>
          </div>
          <button type="button" class="catalog-btn catalog-close" id="catalog-modal-close">Fechar</button>
        </header>
        <div class="body">
          <div class="catalog-grid">
            <div class="catalog-field">
              <label for="catalog-faculdade">Faculdade</label>
              <input id="catalog-faculdade" type="text" placeholder="Ex: UFOB">
            </div>
            <div class="catalog-field">
              <label for="catalog-curso">Curso</label>
              <input id="catalog-curso" type="text" placeholder="Ex: Engenharia Civil">
            </div>
          </div>
          <div class="catalog-grid" style="margin-top:14px">
            <div class="catalog-field">
              <label for="catalog-semestre-base">Semestre atual do aluno</label>
              <select id="catalog-semestre-base">
                <option value="">Sem definir</option>
                ${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}º semestre</option>`).join('')}
              </select>
            </div>
            <div class="catalog-field">
              <label for="catalog-action-mode">Modo</label>
              <select id="catalog-action-mode">
                <option value="load">Buscar grade da comunidade</option>
                <option value="paste">Importar de texto/fluxograma</option>
                <option value="share">Compartilhar minha grade atual</option>
              </select>
            </div>
          </div>
          <div id="catalog-paste-area" class="catalog-field" style="margin-top:14px;display:none">
            <label for="catalog-paste-text">Cole aqui o texto do PDF/site/fluxograma</label>
            <textarea id="catalog-paste-text" placeholder="Exemplo:\n1º semestre\nCálculo I - 60h\nFísica I - 60h\nGeometria Analítica - 60h"></textarea>
          </div>
          <div class="catalog-preview" id="catalog-preview"><div class="catalog-small">Selecione uma ação e gere a prévia.</div></div>
          <div class="catalog-footer">
            <div class="catalog-small" id="catalog-feedback">O sistema une sua grade pessoal com o catálogo comunitário sem apagar o que você já organizou.</div>
            <div style="display:flex;gap:10px;flex-wrap:wrap">
              <button type="button" class="catalog-btn secondary" id="catalog-generate-preview">Gerar prévia</button>
              <button type="button" class="catalog-btn primary" id="catalog-apply-action">Aplicar</button>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) hideModal(); });
    document.getElementById('catalog-modal-close')?.addEventListener('click', hideModal);
    document.getElementById('catalog-action-mode')?.addEventListener('change', updateModeUI);
  }

  function showModal(prefill) {
    ensureModal();
    const overlay = document.getElementById('catalog-community-modal');
    const app = window.app;
    document.getElementById('catalog-faculdade').value = prefill?.faculdade || app?.data?.user?.universidade || '';
    document.getElementById('catalog-curso').value = prefill?.curso || app?.data?.user?.curso || '';
    document.getElementById('catalog-semestre-base').value = prefill?.semestre || app?.data?.user?.semestre || '';
    document.getElementById('catalog-action-mode').value = prefill?.mode || 'load';
    document.getElementById('catalog-paste-text').value = '';
    updateModeUI();
    document.getElementById('catalog-preview').innerHTML = '<div class="catalog-small">Clique em "Gerar prévia" para ver o que será importado ou compartilhado.</div>';
    overlay.style.display = 'flex';
  }

  function hideModal() {
    const overlay = document.getElementById('catalog-community-modal');
    if (overlay) overlay.style.display = 'none';
  }

  function updateModeUI() {
    const mode = document.getElementById('catalog-action-mode')?.value;
    const paste = document.getElementById('catalog-paste-area');
    if (paste) paste.style.display = mode === 'paste' ? 'block' : 'none';
  }

  function currentCatalogTemplate(faculdade, curso) {
    const key = catalogKey(faculdade, curso);
    const entry = COMMUNITY_BOOTSTRAP[key];
    if (!entry) return null;
    // Resolve aliases
    if (entry._alias) return COMMUNITY_BOOTSTRAP[entry.key] || null;
    return entry;
  }

  function getDbInstance() { return window.db || (typeof db !== 'undefined' ? db : null); }
  function getAuthInstance() { return window.auth || (typeof auth !== 'undefined' ? auth : null); }

  function attachDbExtensions() {
    if (!window.dbService || window.dbService.__communityCatalogPatched) return;
    const dbService = window.dbService;

    dbService.getCommunityCatalog = async function (faculdade, curso) {
      const key = catalogKey(faculdade, curso);
      const bootstrap = currentCatalogTemplate(faculdade, curso);
      const dbRef = getDbInstance();
      try {
        if (!dbRef) return bootstrap;
        const snap = await dbRef.collection('community_catalogs').doc(key).get();
        if (!snap.exists) return bootstrap;
        const data = snap.data() || {};
        const subjects = ensureArray(data.subjects).map(neutralizeForCatalog);
        // FIX: Não concatena com bootstrap — Firestore tem prioridade total
        // Bootstrap só é usado se Firestore estiver vazio
        const finalSubjects = subjects.length > 0
          ? dedupeCurriculum(subjects).map(neutralizeForCatalog)
          : (bootstrap ? dedupeCurriculum(bootstrap.subjects).map(neutralizeForCatalog) : []);
        return {
          key,
          faculdade: data.faculdade || faculdade,
          curso: data.curso || curso,
          confidence: Number(data.confidence || 0),
          version: data.version || '',
          source: 'firestore',
          subjects: finalSubjects,
          stats: data.stats || {}
        };
      } catch (error) {
        console.error('Erro ao buscar catálogo comunitário:', error);
        return bootstrap;
      }
    };

    dbService.saveCommunityCatalog = async function (faculdade, curso, subjects, meta) {
      const key = catalogKey(faculdade, curso);
      const normalizedSubjects = dedupeCurriculum(subjects).map(neutralizeForCatalog);
      const authRef = getAuthInstance();
      const user = authRef ? authRef.currentUser : null;

      // Sem usuário logado não podemos salvar — Firestore exige auth
      if (!user || !user.uid) {
        console.warn('[catalog] saveCommunityCatalog: usuário não autenticado, ignorando.');
        return null;
      }

      const now = new Date().toISOString();
      const dbRef = getDbInstance();
      if (!dbRef) return null;

      try {
        const ref = dbRef.collection('community_catalogs').doc(key);
        const existing = await ref.get().catch(() => null);
        const existingData = existing && existing.exists ? (existing.data() || {}) : null;

        const payload = {
          key, faculdade, curso,
          subjects: normalizedSubjects,
          updatedAt: now,
          updatedBy: user.uid,
          version: meta?.version || (existingData && existingData.version) || '',
          confidence: Number(meta?.confidence || (existingData && existingData.confidence) || 0.55),
          stats: {
            usersCount: Number((existingData && existingData.stats && existingData.stats.usersCount) || 0) + 1,
            componentsCount: normalizedSubjects.length
          }
        };

        if (existingData) {
          // Atualização — preservar campos imutáveis do documento original
          payload.createdAt = existingData.createdAt || now;
          await ref.set(payload, { merge: true });
        } else {
          // Criação — definir campos imutáveis
          payload.createdAt = now;
          payload.createdBy = user.uid;
          await ref.set(payload);
        }
        return payload;
      } catch (error) {
        console.error('[catalog] Erro ao salvar catálogo comunitário:', error);
        window.showToast && window.showToast('Erro ao compartilhar grade. Verifique sua conexão.', 'error');
        return null;
      }
    };

    dbService.submitCommunityContribution = async function (faculdade, curso, subjects, extra) {
      const authRef = getAuthInstance();
      const user = authRef ? authRef.currentUser : null;
      const payload = {
        faculdade, curso, key: catalogKey(faculdade, curso),
        subjects: dedupeCurriculum(subjects).map(neutralizeForCatalog),
        submittedAt: new Date().toISOString(),
        sourceUserId: user?.uid || null,
        sourceUserEmail: user?.email || null,
        version: extra?.version || '',
        semester: extra?.semester || '',
        mode: extra?.mode || 'manual',
        count: ensureArray(subjects).length
      };
      const dbRef = getDbInstance();
      if (!dbRef) return payload;
      try { await dbRef.collection('community_catalog_submissions').add(payload); }
      catch (error) { console.error('Erro ao enviar contribuição:', error); }
      return payload;
    };

    dbService.__communityCatalogPatched = true;
  }

  async function handleGeneratePreview() {
    const faculdade = document.getElementById('catalog-faculdade')?.value.trim();
    const curso = document.getElementById('catalog-curso')?.value.trim();
    const mode = document.getElementById('catalog-action-mode')?.value;
    const semester = document.getElementById('catalog-semestre-base')?.value;
    const preview = document.getElementById('catalog-preview');
    const feedback = document.getElementById('catalog-feedback');
    const app = window.app;
    if (!faculdade || !curso) {
      if (preview) preview.innerHTML = '<div class="catalog-warning">Preencha faculdade e curso primeiro.</div>';
      return null;
    }
    let items = [];
    if (mode === 'load') {
      const catalog = await window.dbService.getCommunityCatalog(faculdade, curso);
      items = dedupeCurriculum(catalog?.subjects || []).map(neutralizeForCatalog);
      if (!items.length) {
        preview.innerHTML = '<div class="catalog-warning">Ainda não existe uma grade comunitária forte para esse curso. Você pode colar um texto da matriz ou compartilhar sua grade atual para começar a base.</div>';
        feedback.textContent = 'Sem catálogo encontrado. Você ainda pode criar a primeira versão comunitária.';
        return { mode, items: [] };
      }
      preview.innerHTML = buildPreviewHtml(items) + `<div class="catalog-success">Catálogo encontrado para ${escapeHtml(curso)} em ${escapeHtml(faculdade)}.</div>`;
      feedback.textContent = `${items.length} componentes prontos para entrar na sua grade pessoal.`;
      return { mode, items, faculdade, curso, semester };
    }
    if (mode === 'paste') {
      const text = document.getElementById('catalog-paste-text')?.value || '';
      items = parseTextToCurriculum(text, semester);
      preview.innerHTML = buildPreviewHtml(items);
      feedback.textContent = items.length ? `Encontrados ${items.length} componentes a partir do texto colado.` : 'Nenhum componente identificado ainda.';
      return { mode, items, faculdade, curso, semester };
    }
    if (mode === 'share') {
      items = dedupeCurriculum(app?.data?.curriculum || []).map(neutralizeForCatalog);
      preview.innerHTML = buildPreviewHtml(items) + `<div class="catalog-success">Sua grade atual será enviada como contribuição para ${escapeHtml(curso)} em ${escapeHtml(faculdade)}.</div>`;
      feedback.textContent = items.length ? `${items.length} componentes da sua grade serão compartilhados como base comunitária.` : 'Sua grade atual ainda está vazia.';
      return { mode, items, faculdade, curso, semester };
    }
    return null;
  }

  async function saveAppData(app) {
    if (!window.dbService || !app) return;
    try {
      if (typeof window.dbService.saveAllData === 'function') return await window.dbService.saveAllData(app.data);
      if (typeof window.dbService.saveData === 'function') {
        for (const key of Object.keys(app.data || {})) await window.dbService.saveData(key, app.data[key]);
      }
    } catch (error) {
      console.error('Erro ao salvar dados do app:', error);
    }
  }

  async function handleApplyAction() {
    const data = await handleGeneratePreview();
    const app = window.app;
    if (!data || !app) return;
    const { mode, items, faculdade, curso, semester } = data;
    ensureUserDataCompatibility(app);
    if (mode === 'load' || mode === 'paste') {
      if (!items.length) {
        window.showToast?.('Nada para importar ainda.', 'warning');
        return;
      }
      mergeIntoUserCurriculum(app, items, catalogKey(faculdade, curso));
      maybePopulateSubjectsFromSemester(app);
      app.data.user.universidade = faculdade;
      app.data.user.curso = curso;
      if (semester && !app.data.user.semestre) app.data.user.semestre = semester;
      const setupForm = document.getElementById('setup-form');
      if (setupForm && typeof app.applyImportedSetupCurriculum === 'function') {
        app.applyImportedSetupCurriculum({
          items,
          meta: { faculdade, curso, semestre: semester }
        }, mode === 'load' ? 'community-load' : 'paste-import');
      }
      await saveAppData(app);
      if (!setupForm) app.loadView?.('grade-curricular');
      hideModal();
      window.showToast?.(`Grade importada com ${items.length} componentes.`, 'success');
      if (mode === 'paste') await syncCurrentCurriculumToCommunity({ faculdade, curso, mode: 'paste' });
      return;
    }
    if (mode === 'share') {
      if (!items.length) {
        window.showToast?.('Sua grade ainda está vazia.', 'warning');
        return;
      }
      await syncCurrentCurriculumToCommunity({ faculdade, curso, mode: 'share' });
      hideModal();
    }
  }

  async function syncCurrentCurriculumToCommunity(params) {
    const faculdade = params?.faculdade || '';
    const curso = params?.curso || '';
    const mode = params?.mode || 'manual';
    const app = window.app;
    if (!app || !faculdade || !curso || !window.dbService) return;
    ensureUserDataCompatibility(app);
    const userCurriculum = dedupeCurriculum(app.data.curriculum || []).map(neutralizeForCatalog);
    if (!userCurriculum.length) return;
    await window.dbService.submitCommunityContribution(faculdade, curso, userCurriculum, {
      version: app.data.user?.matrizVersion || '',
      semester: app.data.user?.semestre || '',
      mode
    });
    const existing = await window.dbService.getCommunityCatalog(faculdade, curso);
    const merged = dedupeCurriculum([...(existing?.subjects || []), ...userCurriculum]).map(neutralizeForCatalog);
    await window.dbService.saveCommunityCatalog(faculdade, curso, merged, {
      version: app.data.user?.matrizVersion || '',
      confidence: existing?.subjects?.length ? 0.72 : 0.6,
      usersCount: (existing?.stats?.usersCount || 0) + 1
    });
    window.showToast?.('Sua grade foi compartilhada para fortalecer o catálogo comunitário.', 'success');
  }

  function injectSetupShortcuts() {
    const form = document.getElementById('setup-form');
    if (!form || document.getElementById('setup-import-shortcuts')) return;
    const basicSection = form.querySelector('.form-section');
    if (!basicSection || !basicSection.parentNode) return;
    const box = document.createElement('div');
    box.id = 'setup-import-shortcuts';
    box.className = 'catalog-hero';
    box.style.marginTop = '0';
    box.innerHTML = `
      <div>
        <h3>Comece já com sua grade pronta</h3>
        <p>Em vez de cadastrar tudo manualmente, você pode puxar um catálogo já salvo por outros alunos ou colar o texto do seu fluxograma.</p>
        <div class="catalog-badges">
          <span class="catalog-badge">Faculdade + curso</span>
          <span class="catalog-badge">Pré-requisitos</span>
          <span class="catalog-badge">Carga horária</span>
          <span class="catalog-badge">Importação por texto</span>
        </div>
      </div>
      <div class="catalog-actions">
        <button type="button" class="catalog-btn secondary" id="setup-open-catalog-load">Buscar grade pronta</button>
        <button type="button" class="catalog-btn ghost" id="setup-open-catalog-paste">Usar ChatGPT / colar JSON</button>
      </div>`;
    basicSection.parentNode.insertBefore(box, basicSection.nextSibling);
    document.getElementById('setup-open-catalog-load')?.addEventListener('click', () => showModal({
      faculdade: document.getElementById('universidade')?.value || '',
      curso: document.getElementById('curso')?.value || '',
      semestre: document.getElementById('semestre')?.value || '',
      mode: 'load'
    }));
    document.getElementById('setup-open-catalog-paste')?.addEventListener('click', () => {
      if (window.app?.showChatGPTImportHelper) {
        window.app.showChatGPTImportHelper();
        return;
      }
      showModal({
        faculdade: document.getElementById('universidade')?.value || '',
        curso: document.getElementById('curso')?.value || '',
        semestre: document.getElementById('semestre')?.value || '',
        mode: 'paste'
      });
    });
  }

  function patchViewRenderer() {
    if (!window.ViewRenderer || window.ViewRenderer.prototype.__communityCatalogPatched) return;
    const proto = window.ViewRenderer.prototype;
    const originalRenderGradeCurricular = proto.renderGradeCurricular;
    const originalRenderConfiguracoes = proto.renderConfiguracoes;
    if (typeof originalRenderGradeCurricular === 'function') {
      proto.renderGradeCurricular = function () {
        const original = originalRenderGradeCurricular.call(this);
        const faculdade = this.app?.data?.user?.universidade || 'sua faculdade';
        const curso = this.app?.data?.user?.curso || 'seu curso';
        // Versão compacta: uma faixa fina, colapsável, em vez do card grande de antes.
        // "Atualizar com IA (PDF)" já mora no botão principal do topo (grade-ia-import.js),
        // então aqui ficam só as ações do catálogo comunitário (buscar/compartilhar).
        const hero = `
          <section class="catalog-hero catalog-hero-slim">
            <button type="button" class="catalog-hero-toggle" id="catalog-hero-toggle" aria-expanded="false">
              <i class="fas fa-users"></i>
              <span>Catálogo comunitário: aproveite grades de <strong>${escapeHtml(curso)}</strong> em <strong>${escapeHtml(faculdade)}</strong> já cadastradas por outros alunos</span>
              <i class="fas fa-chevron-down catalog-hero-chevron"></i>
            </button>
            <div class="catalog-hero-body" id="catalog-hero-body" hidden>
              <p>O site aprende com as grades cadastradas pelos usuários — quem informar o mesmo curso e faculdade já encontra boa parte da estrutura pronta.</p>
              <div class="catalog-actions">
                <button class="catalog-btn secondary" id="btn-community-load">Buscar grade pronta</button>
                <button class="catalog-btn primary" id="btn-community-share">Compartilhar minha grade</button>
              </div>
            </div>
          </section>`;
        return hero + original;
      };
    }
    if (typeof originalRenderConfiguracoes === 'function') {
      proto.renderConfiguracoes = function (aba) {
        const original = originalRenderConfiguracoes.call(this, aba);
        if (aba !== 'sobre') return original;
        const extra = `
          <div class="catalog-preview" style="margin-top:18px">
            <h4>Catálogo comunitário</h4>
            <p class="catalog-small">Ajude o sistema a aprender grades curriculares por faculdade e curso. Sua grade pessoal continua sendo sua, mas pode servir como base para os próximos usuários.</p>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
              <button class="catalog-btn secondary" id="btn-config-community-load">Buscar catálogo</button>
              <button class="catalog-btn primary" id="btn-config-community-share">Compartilhar grade atual</button>
            </div>
          </div>`;
        return original + extra;
      };
    }
    proto.__communityCatalogPatched = true;
  }

  function patchApp() {
    if (!window.StudyLifeControl || window.StudyLifeControl.prototype.__communityCatalogPatched) return;
    const proto = window.StudyLifeControl.prototype;
    if (typeof proto.init === 'function') {
      const originalInit = proto.init;
      proto.init = async function () {
        const result = await originalInit.apply(this, arguments);
        try { ensureUserDataCompatibility(this); } catch (error) { console.error('Erro ao garantir compatibilidade dos dados:', error); }
        return result;
      };
    }
    if (typeof proto.handleSetupSubmit === 'function') {
      const originalHandleSetupSubmit = proto.handleSetupSubmit;
      proto.handleSetupSubmit = async function (e) {
        await originalHandleSetupSubmit.call(this, e);
        try {
          ensureUserDataCompatibility(this);
          const faculdade = this.data?.user?.universidade;
          const curso = this.data?.user?.curso;
          if (!faculdade || !curso) return;
          if (ensureArray(this.data.curriculum).length) return;
          const catalog = await window.dbService.getCommunityCatalog(faculdade, curso);
          if (!catalog?.subjects?.length) return;
          mergeIntoUserCurriculum(this, catalog.subjects, catalog.key);
          maybePopulateSubjectsFromSemester(this);
          await saveAppData(this);
          if (this.currentView === 'grade-curricular' || this.currentView === 'dashboard') this.loadView(this.currentView);
          window.showToast?.(`Grade pronta importada automaticamente para ${curso}.`, 'success');
        } catch (error) {
          console.error('Erro ao importar catálogo no setup:', error);
        }
      };
    }
    if (typeof proto.handleCurriculumSubmit === 'function') {
      const originalHandleCurriculumSubmit = proto.handleCurriculumSubmit;
      proto.handleCurriculumSubmit = async function (e) {
        await originalHandleCurriculumSubmit.call(this, e);
        try {
          ensureUserDataCompatibility(this);
          this.data.curriculum = dedupeCurriculum(this.data.curriculum || []);
          if (typeof window.dbService.saveData === 'function') await window.dbService.saveData('curriculum', this.data.curriculum);
          const faculdade = this.data?.user?.universidade;
          const curso = this.data?.user?.curso;
          if (faculdade && curso && this.data.curriculum?.length) {
            await window.dbService.submitCommunityContribution(faculdade, curso, this.data.curriculum.map(neutralizeForCatalog), {
              mode: 'curriculum_submit',
              semester: this.data.user?.semestre || ''
            });
          }
        } catch (error) {
          console.error('Erro ao sincronizar contribuição de currículo:', error);
        }
      };
    }
    if (typeof proto.setupViewEvents === 'function') {
      const originalSetupViewEvents = proto.setupViewEvents;
      proto.setupViewEvents = function (view) {
        originalSetupViewEvents.call(this, view);
        if (view === 'grade-curricular') {
          document.getElementById('btn-community-load')?.addEventListener('click', () => showModal({ mode: 'load' }));
          document.getElementById('btn-community-share')?.addEventListener('click', () => showModal({ mode: 'share' }));
          const toggle = document.getElementById('catalog-hero-toggle');
          const body = document.getElementById('catalog-hero-body');
          if (toggle && body && !toggle.dataset.bound) {
            toggle.dataset.bound = '1';
            toggle.addEventListener('click', () => {
              const open = toggle.getAttribute('aria-expanded') === 'true';
              toggle.setAttribute('aria-expanded', String(!open));
              body.hidden = open;
              toggle.querySelector('.catalog-hero-chevron')?.classList.toggle('rotated', !open);
            });
          }
        }
        if (view === 'configuracoes') {
          document.getElementById('btn-config-community-load')?.addEventListener('click', () => showModal({ mode: 'load' }));
          document.getElementById('btn-config-community-share')?.addEventListener('click', () => showModal({ mode: 'share' }));
        }
      };
    }
    proto.__communityCatalogPatched = true;
  }

  function bindModalActions() {
    ensureModal();
    const previewBtn = document.getElementById('catalog-generate-preview');
    const applyBtn = document.getElementById('catalog-apply-action');
    if (previewBtn && !previewBtn.__catalogBound) {
      previewBtn.addEventListener('click', handleGeneratePreview);
      previewBtn.__catalogBound = true;
    }
    if (applyBtn && !applyBtn.__catalogBound) {
      applyBtn.addEventListener('click', handleApplyAction);
      applyBtn.__catalogBound = true;
    }
  }

  function init() {
    injectStyles();
    attachDbExtensions();
    patchViewRenderer();
    patchApp();
    bindModalActions();
    injectSetupShortcuts();
    if (window.app) ensureUserDataCompatibility(window.app);
  }

  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('app-ready', init);

  window.communityCatalogTools = {
    slugify,
    normalizeName,
    parseTextToCurriculum,
    dedupeCurriculum,
    showModal,
    syncCurrentCurriculumToCommunity,
    ensureUserDataCompatibility
  };
})();
