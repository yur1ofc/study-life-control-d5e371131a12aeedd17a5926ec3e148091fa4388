// grade-ia-import.js
// Importação e ATUALIZAÇÃO da grade curricular por IA usando Google Gemini.
// Gratuito (chave pessoal grátis em aistudio.google.com/apikey, sem cartão).
// O PDF/imagem é enviado direto para a IA — não precisa mais copiar prompt em outro site.
//
// Como ativar:
// 1. Acesse https://aistudio.google.com/apikey e crie uma chave gratuita (só precisa de conta Google)
// 2. No Vercel: Settings → Environment Variables → adicione GEMINI_API_KEY
// 3. Garanta que o arquivo api/gemini.js está na pasta /api do projeto (é o que publica a função)
//
// Adicione no index.html ANTES do </body>, depois do app.js:
//   <script src="grade-ia-import.js"></script>

(function () {
  'use strict';

  const GRADE_PROMPT = `Leia o conteúdo fornecido (PDF, imagem de fluxograma ou texto com disciplinas de uma grade curricular) e retorne SOMENTE um JSON válido, sem texto antes ou depois, sem markdown, sem blocos de código.

Formato obrigatório:
{
  "faculdade": "Nome da faculdade ou string vazia",
  "curso": "Nome do curso ou string vazia",
  "disciplinas": [
    {
      "nome": "Nome da disciplina",
      "codigo": "Código ou string vazia",
      "semestre": 1,
      "cargaHoraria": 60,
      "creditos": 4,
      "prerequisitos": ["Nome de disciplina anterior"],
      "tipo": "obrigatoria"
    }
  ]
}

Regras:
- Retorne APENAS JSON puro. Absolutamente nada mais.
- "semestre" deve ser número inteiro. Se não encontrar, use 0.
- "cargaHoraria" e "creditos" devem ser números. Se não encontrar, use 0.
- "prerequisitos" é lista de nomes. Se não houver, use [].
- "tipo" deve ser "obrigatoria" para componentes obrigatórios/núcleo comum, e "optativa" para optativas/eletivas/complementares/extensão.
- Liste TODAS as disciplinas que aparecerem no conteúdo, de todos os semestres, mesmo repetidas em versões diferentes da grade.
- Não invente disciplinas que não estiverem no conteúdo enviado.`;

  // ─── Conversão de arquivo ──────────────────────────────────────────────────

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = () => reject(new Error('Falha ao ler o arquivo'));
      reader.readAsDataURL(file);
    });
  }

  function getMimeType(file) {
    if (file.type) return file.type;
    const ext = (file.name || '').split('.').pop().toLowerCase();
    const map = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
    return map[ext] || 'application/octet-stream';
  }

  // ─── Chamada ao Gemini ─────────────────────────────────────────────────────

  function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  async function callGeminiOnce(parts) {
    const user = window.auth?.currentUser;
    if (!user) throw new Error('Você precisa estar logado para usar a importação com IA.');
    const idToken = await user.getIdToken();

    // Chama o proxy seguro em /api/gemini — a chave fica só no servidor (Vercel), nunca no navegador
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ contents: [{ parts }] })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = (typeof err?.error === 'string' ? err.error : err?.error?.message) || `Erro HTTP ${response.status}`;
      const e = new Error(msg);
      e.status = response.status;
      throw e;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text.replace(/```json|```/gi, '').trim();

    try {
      return JSON.parse(clean);
    } catch {
      const e = new Error('A IA retornou um formato inesperado. Tente novamente — geralmente funciona na segunda tentativa.');
      e.status = 'bad-json';
      throw e;
    }
  }

  function isOverloadMsg(msg) {
    const m = String(msg || '').toLowerCase();
    return m.includes('overload') || m.includes('sobrecarr') || m.includes('high demand') || m.includes('demanda');
  }

  // O proxy (api/gemini.js) já tenta modelos alternativos sozinho, mas em
  // picos de tráfego às vezes até isso falha na primeira tentativa. Aqui a
  // gente dá mais 2 tentativas do lado do cliente, com pequena espera entre
  // elas, antes de mostrar o erro pro usuário — evita que a pessoa precise
  // clicar "Tentar novamente" manualmente para algo que se resolve sozinho.
  async function callGemini(parts, onRetryStatus) {
    let lastErr = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await callGeminiOnce(parts);
      } catch (err) {
        lastErr = err;
        const overloaded = [408, 429, 500, 502, 503, 504].includes(Number(err.status)) || isOverloadMsg(err.message);
        if (!overloaded || attempt === 1) throw err;
        if (typeof onRetryStatus === 'function') onRetryStatus(attempt + 1);
        await wait(2000 * (attempt + 1));
      }
    }
    throw lastErr;
  }

  // ─── Normalização ───────────────────────────────────────────────────────────

  function makeId() {
    return typeof generateId === 'function' ? generateId() : Math.random().toString(36).slice(2, 10);
  }

  function slugKey(nome) {
    return String(nome || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeItem(app, d) {
    const item = {
      id: makeId(),
      nome: d.nome || '',
      codigo: d.codigo || '',
      semestre: d.semestre || 0,
      cargaHoraria: Number(d.cargaHoraria) || 0,
      creditos: Number(d.creditos) || 0,
      tipo: d.tipo || 'obrigatoria',
      prerequisitosLista: Array.isArray(d.prerequisitos) ? d.prerequisitos : [],
      prerequisitos: Array.isArray(d.prerequisitos) ? d.prerequisitos.join(' | ') : '',
      status: 'nao-cursada',
      observacoes: ''
    };
    return app.normalizeCurriculumItem ? app.normalizeCurriculumItem(item) : item;
  }

  // ─── Aplicar resultado: modo SETUP (primeiro cadastro) ─────────────────────

  function applySetupResult(app, parsed) {
    const disciplinas = parsed?.disciplinas || [];
    if (!disciplinas.length) return { count: 0, error: 'Nenhuma disciplina encontrada no arquivo.' };

    const curriculum = disciplinas.map(d => normalizeItem(app, d));
    app.pendingSetupImportedCurriculum = curriculum;

    const semester = document.getElementById('semestre')?.value || '';
    const semesterSubjects = curriculum
      .filter(item => String(item.semestre || '') === String(semester))
      .map(item => ({ id: item.id, nome: item.nome, dificuldade: 3, peso: item.tipo === 'obrigatoria' ? 4 : 3, notaDesejada: 7 }));

    if (semesterSubjects.length && app.populateSetupSubjects) {
      app.populateSetupSubjects(semesterSubjects);
    }

    return { count: curriculum.length, semesterCount: semesterSubjects.length };
  }

  // ─── Aplicar resultado: modo ATUALIZAÇÃO da grade existente ────────────────
  // Mantém tudo que já existe (status/progresso/notas) nos semestres certos,
  // atualiza dados estruturais (semestre, carga horária, créditos, obrigatória/optativa,
  // pré-requisitos, código) a partir do novo arquivo, adiciona o que for novo e
  // sinaliza (sem apagar sozinho) o que sumiu da grade nova.

  function computeUpdateDiff(app, disciplinas) {
    if (!Array.isArray(app.data.curriculum)) app.data.curriculum = [];
    const existing = app.data.curriculum;
    const matchedIds = new Set();

    const added = [];
    const updated = [];

    disciplinas.forEach(d => {
      const key = slugKey(d.nome);
      if (!key) return;

      // 1) tenta casar por código (mais confiável quando existe)
      let target = null;
      const codigoNovo = String(d.codigo || '').trim().toUpperCase();
      if (codigoNovo) {
        target = existing.find(item => !matchedIds.has(item.id) && String(item.codigo || '').trim().toUpperCase() === codigoNovo);
      }
      // 2) senão, casa por nome normalizado
      if (!target) {
        target = existing.find(item => !matchedIds.has(item.id) && slugKey(item.nome) === key);
      }

      if (target) {
        matchedIds.add(target.id);
        const changes = {};
        const novoSemestre = d.semestre ? String(d.semestre) : target.semestre;
        const novoTipo = d.tipo || target.tipo;
        const novaCarga = Number(d.cargaHoraria) || target.cargaHoraria;
        const novosCreditos = Number(d.creditos) || target.creditos;
        const novoCodigo = d.codigo ? String(d.codigo).toUpperCase() : target.codigo;
        const novosPrereqs = Array.isArray(d.prerequisitos) && d.prerequisitos.length ? d.prerequisitos : target.prerequisitosLista;

        if (String(target.semestre) !== String(novoSemestre)) changes.semestre = { de: target.semestre, para: novoSemestre };
        if (target.tipo !== novoTipo) changes.tipo = { de: target.tipo, para: novoTipo };
        if (Number(target.cargaHoraria) !== Number(novaCarga)) changes.cargaHoraria = { de: target.cargaHoraria, para: novaCarga };
        if (Number(target.creditos) !== Number(novosCreditos)) changes.creditos = { de: target.creditos, para: novosCreditos };

        if (Object.keys(changes).length) {
          updated.push({ item: target, novo: d, changes, novoSemestre, novoTipo, novaCarga, novosCreditos, novoCodigo, novosPrereqs });
        }
      } else {
        added.push(d);
      }
    });

    // Matérias que existiam e não vieram na nova grade — candidatas a remoção,
    // mas só quem já foi cursada/em curso conta (evita sinalizar coisas que o
    // usuário cadastrou manualmente fora do fluxograma oficial sem necessidade).
    const removedCandidates = existing.filter(item => !matchedIds.has(item.id));

    return { added, updated, removedCandidates };
  }

  function applyUpdate(app, diff, { removeIds = [] } = {}) {
    if (!Array.isArray(app.data.curriculum)) app.data.curriculum = [];

    diff.updated.forEach(({ item, novoSemestre, novoTipo, novaCarga, novosCreditos, novoCodigo, novosPrereqs }) => {
      item.semestre = novoSemestre;
      item.tipo = novoTipo;
      item.cargaHoraria = Number(novaCarga) || 0;
      item.creditos = Number(novosCreditos) || 0;
      if (novoCodigo) item.codigo = novoCodigo;
      if (Array.isArray(novosPrereqs)) {
        item.prerequisitosLista = novosPrereqs;
        item.prerequisitos = novosPrereqs.join(' | ');
      }
      // status, observações, nota e demais dados de progresso NÃO são tocados
    });

    diff.added.forEach(d => {
      app.data.curriculum.push(normalizeItem(app, d));
    });

    if (removeIds.length) {
      const removeSet = new Set(removeIds);
      app.data.curriculum = app.data.curriculum.filter(item => !removeSet.has(item.id));
    }

    if (typeof dbService !== 'undefined') dbService.saveData('curriculum', app.data.curriculum);
    if (app.loadView) app.loadView('grade-curricular');
  }

  // ─── Modal de resumo (o que mudou) antes de confirmar ──────────────────────

  function showDiffModal(app, diff, disciplinas) {
    return new Promise(resolve => {
      const wrap = document.createElement('div');
      wrap.id = 'slc-gim-diff-modal';
      wrap.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:1rem;';

      const updatedRows = diff.updated.map(u => {
        const bits = Object.entries(u.changes).map(([campo, v]) => {
          const label = { semestre: 'semestre', tipo: 'tipo', cargaHoraria: 'carga horária', creditos: 'créditos' }[campo] || campo;
          return `${label}: <s style="opacity:.55">${v.de || '—'}</s> → <strong>${v.para}</strong>`;
        }).join(' · ');
        return `<li style="padding:.4rem 0;border-bottom:1px solid #eef2f7;font-size:.82rem;"><strong>${u.item.nome}</strong><br><span style="color:#64748b">${bits}</span></li>`;
      }).join('');

      const addedRows = diff.added.map(d => `<li style="padding:.3rem 0;font-size:.82rem;">${d.nome} <span style="color:#94a3b8">· ${d.semestre ? d.semestre + 'º sem.' : 'sem semestre'} · ${d.tipo === 'optativa' ? 'optativa' : 'obrigatória'}</span></li>`).join('');

      const removedRows = diff.removedCandidates.map(item => `
        <li style="padding:.35rem 0;font-size:.82rem;display:flex;align-items:center;gap:.5rem;">
          <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;flex:1;">
            <input type="checkbox" class="slc-gim-remove-check" value="${item.id}">
            <span>${item.nome} <span style="color:#94a3b8">· status: ${item.status || 'não cursada'}</span></span>
          </label>
        </li>`).join('');

      wrap.innerHTML = `
        <div style="background:#fff;color:#1e293b;border-radius:16px;width:100%;max-width:560px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 8px 40px rgba(0,0,0,.22);overflow:hidden;">
          <div style="padding:1.1rem 1.4rem;background:linear-gradient(135deg,#1a73e8,#4f46e5);color:#fff;">
            <h3 style="margin:0;font-size:1rem;">Confira o que vai mudar</h3>
            <p style="margin:.2rem 0 0;font-size:.78rem;opacity:.85;">Nada é aplicado até você confirmar. Progresso e notas já lançados não são alterados.</p>
          </div>
          <div style="padding:1.2rem 1.4rem;overflow-y:auto;flex:1;">
            ${diff.added.length ? `<h4 style="font-size:.85rem;margin:.2rem 0 .4rem;color:#16a34a;">+ ${diff.added.length} nova(s) disciplina(s)</h4><ul style="list-style:none;padding:0;margin:0 0 1rem;">${addedRows}</ul>` : ''}
            ${diff.updated.length ? `<h4 style="font-size:.85rem;margin:.2rem 0 .4rem;color:#1a73e8;">${diff.updated.length} disciplina(s) com dado atualizado</h4><ul style="list-style:none;padding:0;margin:0 0 1rem;">${updatedRows}</ul>` : ''}
            ${diff.removedCandidates.length ? `
              <h4 style="font-size:.85rem;margin:.2rem 0 .4rem;color:#dc2626;">${diff.removedCandidates.length} não apareceram no arquivo novo</h4>
              <p style="font-size:.76rem;color:#64748b;margin:0 0 .4rem;">Marque só as que você quer remover da sua grade. As desmarcadas continuam como estão.</p>
              <ul style="list-style:none;padding:0;margin:0 0 1rem;">${removedRows}</ul>` : ''}
            ${(!diff.added.length && !diff.updated.length && !diff.removedCandidates.length) ? '<p style="font-size:.85rem;color:#64748b;">Nenhuma diferença encontrada — sua grade já está igual ao arquivo enviado.</p>' : ''}
          </div>
          <div style="padding:1rem 1.4rem;border-top:1px solid #eef2f7;display:flex;gap:.6rem;justify-content:flex-end;">
            <button id="slc-gim-diff-cancel" style="padding:.55rem 1rem;border-radius:8px;border:1px solid #e2e8f0;background:#fff;cursor:pointer;font-size:.83rem;">Cancelar</button>
            <button id="slc-gim-diff-confirm" style="padding:.55rem 1.1rem;border-radius:8px;border:none;background:#1a73e8;color:#fff;cursor:pointer;font-size:.83rem;font-weight:600;">Aplicar atualização</button>
          </div>
        </div>`;

      document.body.appendChild(wrap);

      wrap.querySelector('#slc-gim-diff-cancel').addEventListener('click', () => { wrap.remove(); resolve(null); });
      wrap.addEventListener('click', e => { if (e.target === wrap) { wrap.remove(); resolve(null); } });
      wrap.querySelector('#slc-gim-diff-confirm').addEventListener('click', () => {
        const removeIds = Array.from(wrap.querySelectorAll('.slc-gim-remove-check:checked')).map(el => el.value);
        wrap.remove();
        resolve({ removeIds });
      });
    });
  }

  // ─── Modal principal de importação/atualização ──────────────────────────────

  function createImportModal(targetContext) {
    document.getElementById('slc-grade-ia-modal')?.remove();
    const isUpdate = targetContext === 'grade';

    const modal = document.createElement('div');
    modal.id = 'slc-grade-ia-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.52);display:flex;align-items:center;justify-content:center;padding:1rem;';

    modal.innerHTML = `
      <div style="background:#fff;color:#1e293b;border-radius:16px;width:100%;max-width:540px;box-shadow:0 8px 40px rgba(0,0,0,.22);overflow:hidden;">
        <div style="background:linear-gradient(135deg,#1a73e8,#4f46e5);padding:1.25rem 1.5rem;display:flex;align-items:center;gap:.75rem;">
          <i class="fas fa-wand-magic-sparkles" style="color:#fff;font-size:1.25rem;"></i>
          <div style="flex:1">
            <h3 style="margin:0;color:#fff;font-size:1rem;font-weight:600;">${isUpdate ? 'Atualizar grade com IA' : 'Importar grade com IA'}</h3>
            <p style="margin:0;color:rgba(255,255,255,.8);font-size:.78rem;">Google Gemini • Grátis • ~1.500 leituras/dia (mais que suficiente pro dia a dia)</p>
          </div>
          <button id="slc-gim-close" style="background:rgba(255,255,255,.2);border:none;border-radius:8px;padding:5px 10px;color:#fff;cursor:pointer;">✕</button>
        </div>

        <div style="padding:1.5rem;">
          ${isUpdate ? `<p style="font-size:.82rem;color:#475569;margin:0 0 1rem;background:#f8fafc;border:1px solid #eef2f7;border-radius:8px;padding:.6rem .8rem;">Envie a grade nova (PDF do fluxograma atualizado). O que você já cursou ou está cursando continua como está — só a estrutura (matérias, semestre, obrigatória/optativa) é atualizada, e você confirma tudo antes de salvar.</p>` : ''}
          <div style="display:flex;gap:.5rem;margin-bottom:1.25rem;">
            <button class="slc-gim-tab slc-gim-tab-on" data-tab="arquivo" style="flex:1;padding:.5rem;border-radius:8px;border:1.5px solid #1a73e8;background:#e8f0fe;color:#1a73e8;cursor:pointer;font-size:.83rem;font-weight:500;">
              <i class="fas fa-file-upload"></i> PDF ou imagem
            </button>
            <button class="slc-gim-tab" data-tab="texto" style="flex:1;padding:.5rem;border-radius:8px;border:1px solid #e2e8f0;background:#fff;color:#64748b;cursor:pointer;font-size:.83rem;">
              <i class="fas fa-align-left"></i> Colar texto
            </button>
          </div>

          <div id="slc-gim-tab-arquivo">
            <div id="slc-gim-dropzone" style="border:2px dashed #cbd5e1;border-radius:12px;padding:2rem;text-align:center;cursor:pointer;background:#f8fafc;transition:all .2s;">
              <i class="fas fa-cloud-upload-alt" style="font-size:2rem;color:#94a3b8;display:block;margin-bottom:.5rem;"></i>
              <p style="margin:0 0 .2rem;font-weight:500;color:#475569;">Arraste o PDF ou foto do fluxograma</p>
              <p style="margin:0;font-size:.78rem;color:#94a3b8;">ou clique para escolher · PDF, PNG, JPG, WEBP</p>
              <input type="file" id="slc-gim-file-input" accept=".pdf,.png,.jpg,.jpeg,.webp" style="display:none;">
            </div>
            <div id="slc-gim-preview" style="display:none;margin-top:.75rem;padding:.65rem 1rem;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;align-items:center;gap:.5rem;">
              <i class="fas fa-file-check" style="color:#16a34a;"></i>
              <span id="slc-gim-fname" style="font-size:.83rem;color:#166534;flex:1;"></span>
              <button id="slc-gim-fremove" style="background:none;border:none;color:#ef4444;cursor:pointer;">✕</button>
            </div>
          </div>

          <div id="slc-gim-tab-texto" style="display:none;">
            <label style="font-size:.83rem;font-weight:500;color:#374151;display:block;margin-bottom:.4rem;">Cole o texto da grade (site da faculdade, PDF copiado, etc.):</label>
            <textarea id="slc-gim-texto" rows="8" placeholder="1º Semestre&#10;Cálculo I - 60h&#10;Geometria Analítica - 90h&#10;&#10;2º Semestre&#10;Cálculo II - 60h&#10;Física I - 60h" style="width:100%;box-sizing:border-box;border:1px solid #e2e8f0;border-radius:8px;padding:.7rem;font-size:.83rem;font-family:inherit;resize:vertical;outline:none;"></textarea>
          </div>

          <div id="slc-gim-status" style="display:none;margin-top:1rem;padding:.7rem 1rem;border-radius:8px;font-size:.83rem;"></div>

          <button id="slc-gim-run" style="width:100%;margin-top:1rem;padding:.75rem;background:#1a73e8;color:#fff;border:none;border-radius:10px;font-size:.93rem;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:.5rem;">
            <i class="fas fa-magic"></i> ${isUpdate ? 'Analisar e comparar' : 'Importar com IA (grátis)'}
          </button>

          <p style="text-align:center;font-size:.73rem;color:#94a3b8;margin:.65rem 0 0;">
            Powered by Google Gemini · chave pessoal grátis · o arquivo não fica salvo, só é lido na hora
          </p>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    let selectedFile = null;
    let activeTab = 'arquivo';

    modal.querySelector('#slc-gim-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    modal.querySelectorAll('.slc-gim-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        modal.querySelectorAll('.slc-gim-tab').forEach(b => {
          const on = b.dataset.tab === activeTab;
          b.style.border = on ? '1.5px solid #1a73e8' : '1px solid #e2e8f0';
          b.style.background = on ? '#e8f0fe' : '#fff';
          b.style.color = on ? '#1a73e8' : '#64748b';
        });
        modal.querySelector('#slc-gim-tab-arquivo').style.display = activeTab === 'arquivo' ? 'block' : 'none';
        modal.querySelector('#slc-gim-tab-texto').style.display = activeTab === 'texto' ? 'block' : 'none';
      });
    });

    const dropzone = modal.querySelector('#slc-gim-dropzone');
    const fileInput = modal.querySelector('#slc-gim-file-input');
    const preview = modal.querySelector('#slc-gim-preview');
    const fname = modal.querySelector('#slc-gim-fname');

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.style.background = '#e8f0fe'; dropzone.style.borderColor = '#1a73e8'; });
    dropzone.addEventListener('dragleave', () => { dropzone.style.background = '#f8fafc'; dropzone.style.borderColor = '#cbd5e1'; });
    dropzone.addEventListener('drop', e => {
      e.preventDefault();
      dropzone.style.background = '#f8fafc'; dropzone.style.borderColor = '#cbd5e1';
      if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) setFile(fileInput.files[0]); });

    function setFile(file) {
      selectedFile = file;
      fname.textContent = file.name;
      preview.style.display = 'flex';
      dropzone.style.display = 'none';
    }

    modal.querySelector('#slc-gim-fremove').addEventListener('click', () => {
      selectedFile = null; fileInput.value = '';
      preview.style.display = 'none'; dropzone.style.display = 'block';
    });

    const btn = modal.querySelector('#slc-gim-run');
    const statusEl = modal.querySelector('#slc-gim-status');

    function setStatus(html, type) {
      const cfg = {
        loading: ['#eff6ff', '#bfdbfe', '#1e40af'],
        success: ['#f0fdf4', '#bbf7d0', '#166534'],
        error: ['#fef2f2', '#fecaca', '#991b1b']
      };
      const [bg, border, color] = cfg[type] || cfg.loading;
      statusEl.style.cssText = `display:block;background:${bg};border:1px solid ${border};color:${color};padding:.7rem 1rem;border-radius:8px;font-size:.83rem;margin-top:1rem;`;
      statusEl.innerHTML = html;
    }

    btn.addEventListener('click', async () => {
      statusEl.style.display = 'none';
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';

      try {
        let parts;

        if (activeTab === 'arquivo') {
          if (!selectedFile) throw new Error('Selecione um PDF ou imagem primeiro.');
          const mime = getMimeType(selectedFile);
          const isPdf = mime === 'application/pdf';
          const isImg = mime.startsWith('image/');
          if (!isPdf && !isImg) throw new Error('Formato não suportado. Use PDF, PNG, JPG ou WEBP.');

          setStatus('<i class="fas fa-spinner fa-spin"></i> Lendo o arquivo com IA...', 'loading');
          const b64 = await fileToBase64(selectedFile);

          parts = [
            { text: GRADE_PROMPT },
            { inline_data: { mime_type: mime, data: b64 } }
          ];
        } else {
          const text = modal.querySelector('#slc-gim-texto').value.trim();
          if (!text) throw new Error('Cole o texto da grade primeiro.');
          setStatus('<i class="fas fa-spinner fa-spin"></i> Interpretando com IA...', 'loading');
          parts = [{ text: GRADE_PROMPT + '\n\nConteúdo da grade:\n\n' + text }];
        }

        const result = await callGemini(parts, (tentativa) => {
          setStatus(`<i class="fas fa-spinner fa-spin"></i> A IA está com alta demanda, tentando de novo automaticamente (${tentativa}/2)...`, 'loading');
        });
        const disciplinas = result?.disciplinas || [];
        if (!disciplinas.length) throw new Error('Nenhuma disciplina encontrada no arquivo.');

        const app = window.app;
        if (!app) throw new Error('App não encontrado.');

        if (targetContext === 'setup') {
          const applied = applySetupResult(app, result);
          const extra = applied.semesterCount > 0
            ? `<br><small style="opacity:.8">${applied.semesterCount} matéria(s) do semestre atual preenchidas.</small>` : '';
          setStatus(`<i class="fas fa-check-circle"></i> <strong>${applied.count} disciplinas importadas!</strong>${extra}`, 'success');
          btn.innerHTML = '<i class="fas fa-check"></i> Concluído!';
          btn.style.background = '#16a34a';
          if (typeof showToast === 'function') showToast(`${applied.count} disciplinas importadas com IA!`, 'success');
          setTimeout(() => modal.remove(), 1600);
          return;
        }

        // modo atualização: mostra diff e só aplica com confirmação
        const diff = computeUpdateDiff(app, disciplinas);
        modal.remove();
        const decision = await showDiffModal(app, diff, disciplinas);
        if (!decision) return; // cancelado

        applyUpdate(app, diff, decision);
        if (typeof showToast === 'function') {
          showToast(`Grade atualizada: +${diff.added.length} novas, ${diff.updated.length} ajustadas${decision.removeIds.length ? `, ${decision.removeIds.length} removidas` : ''}.`, 'success');
        }

      } catch (err) {
        setStatus(`<i class="fas fa-exclamation-circle"></i> ${err.message}`, 'error');
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-magic"></i> Tentar novamente`;
        btn.style.background = '#1a73e8';
      }
    });
  }

  // ─── API pública ────────────────────────────────────────────────────────────

  window.GradeIAImport = {
    openModal(ctx) { createImportModal(ctx || 'grade'); },
    // Reutilizado por módulos internos (ex.: importação do histórico escolar).
    // Mantém a chave Gemini no backend e usa exatamente o mesmo proxy seguro
    // da importação de grade.
    async analyzeFile(file, prompt, onRetryStatus) {
      if (!file) throw new Error('Nenhum arquivo selecionado.');
      const data = await fileToBase64(file);
      const mime = getMimeType(file);
      return callGemini([
        { text: String(prompt || '') },
        { inline_data: { mime_type: mime, data } }
      ], onRetryStatus);
    }
  };

  // ─── Assume o clique do botão "Importar grade pronta" ───────────────────────
  // O projeto tem mais de um script disputando o clique desse mesmo botão
  // (ex.: app.js abre um assistente antigo). Em vez de tentar "ganhar a corrida"
  // no momento de anexar o listener (o que depende da ordem de carregamento dos
  // scripts e é frágil), interceptamos o clique na FASE DE CAPTURA do documento.
  // A fase de captura roda sempre antes dos listeners do próprio botão, então
  // isso funciona não importa quais outros scripts também estejam ouvindo esse
  // botão, nem em que ordem foram carregados.
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('#btn-importar-ufob');
    if (!btn) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    window.GradeIAImport.openModal('grade');
  }, true);

  // ─── Relabela o botão + mostra o chip do semestre atual ─────────────────────
  // Também via MutationObserver (não depende de loadView ser chamado do jeito
  // que a gente espera — só reage quando o botão realmente aparece na tela).

  function relabelImportButton() {
    const btn = document.getElementById('btn-importar-ufob');
    if (btn && !btn.dataset.iaLabel) {
      btn.dataset.iaLabel = '1';
      btn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Atualizar com IA (PDF)';
      btn.title = 'Envie o PDF novo do fluxograma para comparar e atualizar sua grade';
    }
    addCurrentSemesterChip();
  }

  new MutationObserver(relabelImportButton).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('app-ready', () => setTimeout(relabelImportButton, 200));

  // ─── Chip do semestre atual ao lado do título da página ────────────────────

  function addCurrentSemesterChip() {
    const header = document.querySelector('.view-header-grade-upgraded h2, .view-header h2');
    if (!header || header.dataset.semChip) return;
    const semestre = parseInt(window.app?.data?.user?.semestre || 0, 10) || 0;
    if (!semestre) return;
    header.dataset.semChip = '1';
    const chip = document.createElement('span');
    chip.textContent = `${semestre}º semestre atual`;
    chip.style.cssText = 'margin-left:.6rem;font-size:.7rem;font-weight:600;background:#1a73e8;color:#fff;padding:.2rem .55rem;border-radius:999px;vertical-align:middle;';
    header.appendChild(chip);
  }

  // ─── Botão extra no setup ──────────────────────────────────────────────────

  new MutationObserver(() => {
    const section = document.getElementById('setup-smart-import-section');
    if (!section || section.dataset.iaBtnAdded) return;
    section.dataset.iaBtnAdded = '1';

    const helper = section.querySelector('.setup-import-chatgpt-card');
    if (!helper) return;

    const iaBtn = document.createElement('button');
    iaBtn.type = 'button';
    iaBtn.className = 'btn-primary';
    iaBtn.style.cssText = 'background:linear-gradient(135deg,#1a73e8,#4f46e5);border:none;margin-bottom:.5rem;width:100%;';
    iaBtn.innerHTML = '<i class="fas fa-magic"></i> Importar PDF ou imagem com IA (grátis, automático)';
    iaBtn.addEventListener('click', () => window.GradeIAImport.openModal('setup'));
    helper.insertBefore(iaBtn, helper.querySelector('.setup-import-actions'));

    const p = helper.querySelector('p');
    if (p) p.textContent = 'Envie o PDF ou imagem da grade e a IA extrai tudo automaticamente. Ou use o método manual abaixo.';
  }).observe(document.body, { childList: true, subtree: true });

})();
