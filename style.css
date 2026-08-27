(function () {
  'use strict';

  function injectStyles() {
    if (document.getElementById('setup-onboarding-enhancer-styles')) return;
    const style = document.createElement('style');
    style.id = 'setup-onboarding-enhancer-styles';
    style.textContent = `
      #setup-screen{
        min-height:100vh;
        padding:32px 20px 40px;
        background:radial-gradient(circle at top,#13284e 0%,#071427 62%,#06101f 100%);
        align-items:flex-start !important;
        justify-content:center;
      }
      #setup-screen .setup-card{
        width:min(1120px,100%);
        margin:0 auto;
        background:linear-gradient(180deg,rgba(9,21,41,.96),rgba(8,18,33,.96));
        border:1px solid rgba(148,163,184,.16);
        border-radius:28px;
        padding:28px;
        box-shadow:0 30px 90px rgba(0,0,0,.34);
      }
      #setup-screen .setup-header{
        padding:26px 26px 22px;
        border-radius:24px;
        background:linear-gradient(135deg,#0f172a,#1d4ed8);
        color:#fff;
        margin-bottom:18px;
      }
      #setup-screen .setup-header h1{font-size:2rem;margin:10px 0 6px;color:#fff}
      #setup-screen .setup-header p{margin:0;color:rgba(255,255,255,.86);font-size:1rem}
      #setup-screen .setup-header i{font-size:1.25rem}
      #setup-screen .setup-form{display:grid;gap:18px}
      #setup-screen .setup-smart-topbar{
        display:grid;
        grid-template-columns:1.4fr 1fr;
        gap:14px;
        margin-bottom:18px;
      }
      #setup-screen .setup-smart-hero,
      #setup-screen .setup-progress-card{
        background:rgba(255,255,255,.04);
        border:1px solid rgba(148,163,184,.14);
        border-radius:22px;
        padding:18px 20px;
        color:#e2e8f0;
      }
      #setup-screen .setup-smart-hero h3,
      #setup-screen .setup-progress-card h4{margin:0 0 8px;color:#fff}
      #setup-screen .setup-smart-hero p,
      #setup-screen .setup-progress-card p{margin:0;color:#cbd5e1;line-height:1.5}
      #setup-screen .setup-progress-track{margin-top:14px;height:10px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}
      #setup-screen .setup-progress-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#60a5fa,#8b5cf6);width:0%;transition:width .25s ease}
      #setup-screen .setup-progress-meta{margin-top:10px;font-size:.92rem;color:#cbd5e1}
      #setup-screen .form-section{
        background:#f8fafc;
        border:1px solid #dbe4f0;
        border-radius:24px;
        padding:22px;
      }
      #setup-screen .form-section h2{
        margin:0 0 8px;
        color:#0f172a;
        display:flex;
        align-items:center;
        gap:10px;
        font-size:1.4rem;
      }
      #setup-screen .setup-section-kicker{
        display:block;
        margin-bottom:10px;
        font-size:.78rem;
        font-weight:800;
        letter-spacing:.08em;
        text-transform:uppercase;
        color:#2563eb;
      }
      #setup-screen .setup-section-help{margin:0 0 18px;color:#475569;line-height:1.5}
      #setup-screen .form-row{
        display:grid !important;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:16px;
        margin-bottom:16px;
      }
      #setup-screen .form-row:last-child{margin-bottom:0}
      #setup-screen .form-group{min-width:0}
      #setup-screen .form-group label{
        display:block;
        margin-bottom:8px;
        font-weight:700;
        color:#0f172a;
        line-height:1.35;
      }
      #setup-screen input,
      #setup-screen select,
      #setup-screen textarea{
        width:100% !important;
        min-width:0 !important;
        height:auto !important;
        padding:13px 14px;
        border-radius:14px;
        border:1px solid #cbd5e1;
        background:#fff;
        color:#0f172a;
        font:inherit;
        box-sizing:border-box;
      }
      #setup-screen select{appearance:auto}
      #setup-screen input::placeholder,
      #setup-screen textarea::placeholder{color:#94a3b8}
      #setup-screen .checkbox-group{
        display:flex;
        flex-wrap:wrap;
        gap:10px;
      }
      #setup-screen .checkbox-group label{
        margin:0;
        display:flex;
        align-items:center;
        gap:8px;
        padding:10px 12px;
        border-radius:999px;
        background:#eff6ff;
        border:1px solid #bfdbfe;
        color:#1e3a8a;
        font-weight:600;
        cursor:pointer;
      }
      #setup-screen .checkbox-group input{width:auto !important;margin:0}
      #setup-screen #materias-container,
      #setup-screen #aulas-container{display:grid;gap:14px}
      #setup-screen .materia-item,
      #setup-screen .aula-item{
        background:#fff;
        border:1px solid #dbe4f0;
        border-radius:18px;
        padding:16px;
        box-shadow:0 8px 22px rgba(15,23,42,.05);
      }
      #setup-screen .setup-dynamic-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:12px;
        align-items:end;
      }
      #setup-screen .setup-dynamic-grid--aula{grid-template-columns:repeat(4,minmax(0,1fr))}
      #setup-screen .setup-dynamic-field{min-width:0}
      #setup-screen .setup-dynamic-field label{
        display:block;
        margin-bottom:6px;
        font-size:.92rem;
        font-weight:700;
        color:#0f172a;
      }
      #setup-screen .setup-dynamic-actions{
        display:flex;
        justify-content:flex-end;
        margin-top:12px;
      }
      #setup-screen .btn-remove{
        border:none;
        border-radius:12px;
        padding:10px 12px;
        background:#fee2e2;
        color:#991b1b;
        cursor:pointer;
        font-weight:700;
      }
      #setup-screen #add-materia,
      #setup-screen #add-aula,
      #setup-screen .form-actions .btn-primary{
        border:none;
        border-radius:14px;
        padding:13px 16px;
        font-weight:800;
        cursor:pointer;
      }
      #setup-screen #add-materia,
      #setup-screen #add-aula{
        background:#e0e7ff;
        color:#3730a3;
        margin-top:12px;
      }
      #setup-screen .form-actions{
        display:flex;
        justify-content:flex-end;
        margin-top:4px;
      }
      #setup-screen .form-actions .btn-primary{
        min-width:220px;
        background:linear-gradient(90deg,#6366f1,#8b5cf6);
        color:#fff;
        box-shadow:0 12px 28px rgba(99,102,241,.28);
      }
      @media (max-width: 980px){
        #setup-screen .setup-smart-topbar{grid-template-columns:1fr}
        #setup-screen .form-row{grid-template-columns:1fr}
        #setup-screen .setup-dynamic-grid,
        #setup-screen .setup-dynamic-grid--aula{grid-template-columns:1fr 1fr}
      }
      @media (max-width: 640px){
        #setup-screen{padding:18px 12px 26px}
        #setup-screen .setup-card{padding:16px}
        #setup-screen .setup-header{padding:18px}
        #setup-screen .setup-header h1{font-size:1.55rem}
        #setup-screen .form-section{padding:16px}
        #setup-screen .setup-dynamic-grid,
        #setup-screen .setup-dynamic-grid--aula{grid-template-columns:1fr}
        #setup-screen .form-actions .btn-primary{width:100%}
      }
    `;
    document.head.appendChild(style);
  }

  function sectionMeta(title) {
    const normalized = (title || '').toLowerCase();
    if (normalized.includes('informações')) return ['Base da conta', 'Esses dados definem teu contexto acadêmico principal e são usados pela IA, grade e calendário.'];
    if (normalized.includes('rotina')) return ['Rotina real', 'Aqui o sistema entende teu tempo disponível para montar planos úteis de verdade.'];
    if (normalized.includes('perfil')) return ['Seu estilo', 'Quanto mais realista tu for nesse passo, melhores ficam os alertas, metas e recomendações.'];
    if (normalized.includes('matérias')) return ['Semestre atual', 'Cadastre as matérias que você está cursando agora. Isso acelera a dashboard e o mentor IA.'];
    if (normalized.includes('grade')) return ['Aulas fixas', 'Informe sua rotina presencial para o site entender horários livres, deslocamento e conflitos.'];
    return ['Configuração', 'Preencha os dados para personalizar o sistema.'];
  }

  function decorateSections(form) {
    const sections = Array.from(form.querySelectorAll('.form-section'));
    sections.forEach((section, index) => {
      if (section.dataset.enhanced === 'true') return;
      section.dataset.enhanced = 'true';
      const heading = section.querySelector('h2');
      const title = heading ? heading.textContent.trim() : `Seção ${index + 1}`;
      const [kicker, help] = sectionMeta(title);
      const kickerEl = document.createElement('span');
      kickerEl.className = 'setup-section-kicker';
      kickerEl.textContent = kicker;
      section.prepend(kickerEl);
      const helpEl = document.createElement('p');
      helpEl.className = 'setup-section-help';
      helpEl.textContent = help;
      heading?.insertAdjacentElement('afterend', helpEl);
    });
  }

  function ensureTopbar(form) {
    if (form.querySelector('.setup-smart-topbar')) return;
    const topbar = document.createElement('div');
    topbar.className = 'setup-smart-topbar';
    topbar.innerHTML = `
      <div class="setup-smart-hero">
        <h3>Montar tudo agora evita retrabalho depois</h3>
        <p>Preencha só o essencial com calma. O resto do sistema vai usar isso para organizar tua rotina, plano do dia, grade e recomendações da IA.</p>
      </div>
      <div class="setup-progress-card">
        <h4>Progresso da configuração</h4>
        <p>Quanto mais completo, melhor fica tua experiência inicial.</p>
        <div class="setup-progress-track"><div class="setup-progress-fill" id="setup-progress-fill"></div></div>
        <div class="setup-progress-meta" id="setup-progress-meta">0% preenchido</div>
      </div>
    `;
    form.prepend(topbar);
  }

  function updateProgress() {
    const ids = [
      'nome','curso','universidade','semestre','turno-principal','horas-maximas',
      'horario-sono','tempo-deslocamento','tipo-rotina','nivel-disciplina','dificuldade-atual'
    ];
    let filled = 0;
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (String(el.value || '').trim()) filled += 1;
    });
    const materias = Array.from(document.querySelectorAll('.materia-item .materia-nome')).filter(input => input.value.trim()).length;
    const aulas = Array.from(document.querySelectorAll('.aula-item .aula-materia')).filter(select => select.value).length;
    if (materias > 0) filled += 1;
    if (aulas > 0) filled += 1;
    const total = ids.length + 2;
    const percent = Math.round((filled / total) * 100);
    const fill = document.getElementById('setup-progress-fill');
    const meta = document.getElementById('setup-progress-meta');
    if (fill) fill.style.width = percent + '%';
    if (meta) meta.textContent = percent + '% preenchido';
  }

  function createFieldWrap(labelText, input) {
    const wrap = document.createElement('div');
    wrap.className = 'setup-dynamic-field';
    const label = document.createElement('label');
    label.textContent = labelText;
    wrap.appendChild(label);
    wrap.appendChild(input);
    return wrap;
  }

  function styleMateriaItems() {
    document.querySelectorAll('#materias-container .materia-item').forEach((item, index) => {
      if (item.dataset.enhanced === 'true') return;
      item.dataset.enhanced = 'true';

      const inputs = Array.from(item.querySelectorAll('input, select'));
      if (inputs.length < 4) return;
      const [nome, dificuldade, peso, nota] = inputs;
      nome.classList.add('materia-nome');
      dificuldade.classList.add('materia-dificuldade');
      peso.classList.add('materia-peso');
      nota.classList.add('materia-nota-desejada');
      nome.placeholder = nome.placeholder || 'Ex: Cálculo Diferencial I';
      nota.placeholder = nota.placeholder || '7';

      const removeBtn = item.querySelector('.btn-remove') || document.createElement('button');
      if (!removeBtn.classList.contains('btn-remove')) {
        removeBtn.type = 'button';
        removeBtn.className = 'btn-remove';
        removeBtn.textContent = 'Remover';
        removeBtn.addEventListener('click', () => { item.remove(); updateProgress(); });
      }

      item.innerHTML = '';
      const grid = document.createElement('div');
      grid.className = 'setup-dynamic-grid';
      grid.appendChild(createFieldWrap('Nome da matéria', nome));
      grid.appendChild(createFieldWrap('Dificuldade', dificuldade));
      grid.appendChild(createFieldWrap('Peso', peso));
      grid.appendChild(createFieldWrap('Nota desejada', nota));
      const title = document.createElement('div');
      title.style.marginBottom = '12px';
      title.style.fontWeight = '800';
      title.style.color = '#1e3a8a';
      title.textContent = 'Matéria ' + (index + 1);
      const actions = document.createElement('div');
      actions.className = 'setup-dynamic-actions';
      actions.appendChild(removeBtn);
      item.appendChild(title);
      item.appendChild(grid);
      item.appendChild(actions);
    });
  }

  function styleAulaItems() {
    document.querySelectorAll('#aulas-container .aula-item').forEach((item, index) => {
      if (item.dataset.enhanced === 'true') return;
      item.dataset.enhanced = 'true';

      const selects = Array.from(item.querySelectorAll('select'));
      const inputs = Array.from(item.querySelectorAll('input'));
      if (selects.length < 2 || inputs.length < 4) return;

      const materia = selects[0];
      const dia = selects[1];
      const [inicio, fim, sala, professor] = inputs;
      materia.classList.add('aula-materia');
      dia.classList.add('aula-dia');
      inicio.classList.add('aula-inicio');
      fim.classList.add('aula-fim');
      sala.classList.add('aula-sala');
      professor.classList.add('aula-professor');

      const removeBtn = item.querySelector('.btn-remove') || document.createElement('button');
      if (!removeBtn.classList.contains('btn-remove')) {
        removeBtn.type = 'button';
        removeBtn.className = 'btn-remove';
        removeBtn.textContent = 'Remover';
        removeBtn.addEventListener('click', () => { item.remove(); updateProgress(); });
      }

      item.innerHTML = '';
      const title = document.createElement('div');
      title.style.marginBottom = '12px';
      title.style.fontWeight = '800';
      title.style.color = '#1e3a8a';
      title.textContent = 'Aula ' + (index + 1);
      const grid = document.createElement('div');
      grid.className = 'setup-dynamic-grid setup-dynamic-grid--aula';
      grid.appendChild(createFieldWrap('Matéria', materia));
      grid.appendChild(createFieldWrap('Dia', dia));
      grid.appendChild(createFieldWrap('Início', inicio));
      grid.appendChild(createFieldWrap('Fim', fim));
      grid.appendChild(createFieldWrap('Sala', sala));
      grid.appendChild(createFieldWrap('Professor', professor));
      const actions = document.createElement('div');
      actions.className = 'setup-dynamic-actions';
      actions.appendChild(removeBtn);
      item.appendChild(title);
      item.appendChild(grid);
      item.appendChild(actions);
    });
  }

  function bindProgressListeners(form) {
    if (form.dataset.progressBound === 'true') return;
    form.dataset.progressBound = 'true';
    form.addEventListener('input', updateProgress);
    form.addEventListener('change', updateProgress);
  }

  function enhanceSetupForm() {
    const form = document.getElementById('setup-form');
    if (!form) return;
    injectStyles();
    ensureTopbar(form);
    decorateSections(form);
    bindProgressListeners(form);
    styleMateriaItems();
    styleAulaItems();
    updateProgress();
  }

  function watchDynamicLists() {
    const materias = document.getElementById('materias-container');
    const aulas = document.getElementById('aulas-container');
    [materias, aulas].forEach(target => {
      if (!target || target.__setupObserverBound) return;
      const observer = new MutationObserver(() => {
        styleMateriaItems();
        styleAulaItems();
        updateProgress();
      });
      observer.observe(target, { childList: true, subtree: true });
      target.__setupObserverBound = true;
    });
  }

  function init() {
    enhanceSetupForm();
    watchDynamicLists();
  }

  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('app-ready', init);
})();
