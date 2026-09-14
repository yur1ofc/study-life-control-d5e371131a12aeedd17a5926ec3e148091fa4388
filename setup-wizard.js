/**
 * setup-wizard.js — Wizard de configuração em etapas
 * Substitui a tela de setup padrão por um fluxo de 4 passos.
 *
 * Etapas:
 *  1. Quem é você? (nome, curso, universidade, semestre)
 *  2. Sua grade curricular (import PDF/foto via ChatGPT/Claude + manual)
 *  3. Sua rotina (turno, dias, horas, horário sono)
 *  4. Perfil acadêmico + matérias do semestre atual
 */

(function () {
  'use strict';

  /* ─── Constantes ─────────────────────────────────────────── */
  const DRAFT_KEY = 'slc_wizard_draft_v1';

  // Cada perfil tem um fluxo de passos diferente. 'quem' é a etapa que
  // muda mais (universidade/curso, ou escola/série, ou concurso, ou
  // objetivo pessoal); 'grade' (importar grade curricular via PDF/IA) só
  // faz sentido pra quem está na faculdade; 'rotina' e 'materias' são
  // genéricas e servem pra todo mundo.
  const FLOWS = {
    faculdade: {
      steps: ['quem', 'grade', 'rotina', 'materias'],
      labels: ['Quem é você', 'Grade Curricular', 'Sua Rotina', 'Matérias & Perfil']
    },
    concurso: {
      steps: ['quem', 'rotina', 'materias'],
      labels: ['Seu Concurso', 'Sua Rotina', 'Matérias & Perfil']
    },
    ensino_medio: {
      steps: ['quem', 'rotina', 'materias'],
      labels: ['Sua Escola', 'Sua Rotina', 'Matérias & Perfil']
    },
    geral: {
      steps: ['quem', 'rotina', 'materias'],
      labels: ['Seus Objetivos', 'Sua Rotina', 'Áreas & Perfil']
    }
  };

  function getFlow() {
    return FLOWS[wizardState.perfil] || FLOWS.faculdade;
  }
  function getTotalSteps() { return getFlow().steps.length; }
  function getStepLabels() { return getFlow().labels; }
  function kindOfStep(n) { return getFlow().steps[n - 1]; }

  /* ─── Estado do wizard ───────────────────────────────────── */
  let wizardState = {
    step: 0,                 // 0 = seleção de perfil (antes de tudo)
    perfil: null,             // 'faculdade' | 'concurso' | 'ensino_medio' | 'geral'
    importedCurriculum: [],  // disciplinas importadas da grade (só faculdade)
    subjects: [],            // matérias/áreas do momento atual
    semestre: ''
  };

  /* ─── Utilitários ─────────────────────────────────────────── */
  function esc(v) {
    return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function q(sel) { return document.querySelector(sel); }

  // Converte "23:30 - 07:00" (formato salvo) em { inicio, fim } pros dois
  // campos type="time" do formulário, e o caminho inverso pra salvar.
  function parseTimeRange(str) {
    const m = String(str || '').match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    return m ? { inicio: m[1], fim: m[2] } : { inicio: '', fim: '' };
  }
  function formatTimeRange(inicio, fim) {
    if (!inicio && !fim) return '';
    if (inicio && fim) return `${inicio} - ${fim}`;
    return inicio || fim; // só um dos dois preenchido — salva o que tiver
  }

  function injectStyles() {
    if (document.getElementById('wizard-styles')) return;
    const s = document.createElement('style');
    s.id = 'wizard-styles';
    s.textContent = `
/* ── Reset do setup original ── */
.setup-container { padding: 0 !important; background: var(--bg-primary) !important; }
.setup-card { background: transparent !important; box-shadow: none !important; border: none !important; max-width: 100% !important; }

/* ── Wizard shell ── */
#slc-wizard {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--bg-primary);
  font-family: inherit;
}

/* ── Progress bar no topo ── */
.wiz-topbar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  padding: 16px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
}
.wiz-logo { font-size: 1.1rem; font-weight: 800; color: var(--accent-primary); white-space: nowrap; display: flex; align-items: center; gap: 8px; }
.wiz-logo .brand-logo-img { height: 24px; }
.wiz-steps {
  display: flex;
  gap: 4px;
  flex: 1;
}
.wiz-step-dot {
  flex: 1;
  height: 4px;
  border-radius: 99px;
  background: var(--border);
  transition: background .3s;
}
.wiz-step-dot.done  { background: var(--accent-success); }
.wiz-step-dot.active { background: var(--accent-primary); }
.wiz-step-label {
  font-size: .82rem;
  color: var(--text-secondary);
  white-space: nowrap;
}

/* ── Body da etapa ── */
.wiz-body {
  flex: 1;
  display: flex;
  justify-content: center;
  padding: 32px 16px 120px;
}
.wiz-card {
  width: 100%;
  max-width: 640px;
}
.wiz-card-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 4px;
}
.wiz-card-sub {
  font-size: .95rem;
  color: var(--text-secondary);
  margin-bottom: 28px;
}

/* ── Campos ── */
.wiz-field { margin-bottom: 20px; }
.wiz-field label {
  display: block;
  font-size: .88rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: .04em;
}
.wiz-field input,
.wiz-field select,
.wiz-field textarea {
  width: 100%;
  background: var(--bg-tertiary);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 1rem;
  padding: 12px 14px;
  transition: border-color .2s;
  outline: none;
  font-family: inherit;
}
.wiz-field input:focus,
.wiz-field select:focus,
.wiz-field textarea:focus {
  border-color: var(--accent-primary);
}
.wiz-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 520px) { .wiz-row { grid-template-columns: 1fr; } }

/* ── Chip days ── */
.wiz-days { display: flex; flex-wrap: wrap; gap: 8px; }
.wiz-day-btn {
  padding: 8px 14px;
  border-radius: 99px;
  border: 1.5px solid var(--border);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: .88rem;
  font-weight: 600;
  cursor: pointer;
  transition: all .2s;
  user-select: none;
}
.wiz-day-btn.active {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: #fff;
}

/* ── Import section ── */
.wiz-import-tabs {
  display: flex;
  gap: 4px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  padding: 4px;
  margin-bottom: 20px;
}
.wiz-tab {
  flex: 1;
  padding: 9px;
  text-align: center;
  border-radius: 10px;
  font-size: .88rem;
  font-weight: 700;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all .2s;
  border: none;
  background: none;
}
.wiz-tab.active {
  background: var(--bg-secondary);
  color: var(--text-primary);
  box-shadow: 0 2px 8px rgba(0,0,0,.3);
}

.wiz-tab-panel { display: none; }
.wiz-tab-panel.active { display: block; }

/* Import box via IA */
.wiz-ai-box {
  background: var(--bg-tertiary);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  padding: 20px;
  margin-bottom: 16px;
}
.wiz-ai-box h4 {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 6px;
}
.wiz-ai-box p { font-size: .9rem; color: var(--text-secondary); margin-bottom: 14px; line-height: 1.5; }
.wiz-ai-steps { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
.wiz-ai-step {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.wiz-ai-step-num {
  width: 26px; height: 26px;
  border-radius: 50%;
  background: var(--accent-primary);
  color: #fff;
  font-size: .82rem;
  font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.wiz-ai-step-text { font-size: .9rem; color: var(--text-secondary); line-height: 1.5; padding-top: 3px; }
.wiz-ai-step-text strong { color: var(--text-primary); }

.wiz-copy-prompt-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--accent-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 700;
  font-size: .9rem;
  cursor: pointer;
  transition: opacity .2s;
  width: 100%;
  justify-content: center;
  margin-bottom: 16px;
}
.wiz-copy-prompt-btn:hover { opacity: .85; }
.wiz-open-ai-btns {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.wiz-open-ai-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 12px;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: .88rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  transition: border-color .2s;
}
.wiz-open-ai-btn:hover { border-color: var(--accent-primary); }

.wiz-json-area {
  width: 100%;
  min-height: 120px;
  max-height: 200px;
  background: var(--bg-secondary);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: .88rem;
  font-family: 'Courier New', monospace;
  padding: 12px;
  resize: vertical;
  margin-bottom: 10px;
}
.wiz-json-area:focus { border-color: var(--accent-primary); outline: none; }
.wiz-import-json-btn {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 18px;
  background: var(--accent-success);
  color: #fff;
  border: none; border-radius: var(--radius-sm);
  font-weight: 700; font-size: .9rem;
  cursor: pointer; transition: opacity .2s;
}
.wiz-import-json-btn:hover { opacity: .85; }

/* curriculum preview chips */
.wiz-curr-preview {
  margin-top: 14px;
  background: var(--bg-secondary);
  border: 1.5px solid var(--accent-success);
  border-radius: var(--radius-sm);
  padding: 14px;
}
.wiz-curr-preview-title {
  font-size: .85rem;
  font-weight: 700;
  color: var(--accent-success);
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.wiz-curr-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 150px;
  overflow-y: auto;
}
.wiz-curr-chip {
  padding: 4px 10px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 99px;
  font-size: .8rem;
  color: var(--text-secondary);
}
.wiz-curr-chip.sem1 { border-color: #3b82f6; color: #3b82f6; }
.wiz-curr-chip.sem2 { border-color: #8b5cf6; color: #8b5cf6; }
.wiz-curr-chip.sem3 { border-color: #10b981; color: #10b981; }

/* ── Manual subject row ── */
.wiz-subject-item {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  gap: 8px;
  align-items: center;
  background: var(--bg-tertiary);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  margin-bottom: 8px;
}
.wiz-subject-item input {
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--border);
  color: var(--text-primary);
  font-size: .95rem;
  padding: 4px 0;
  outline: none;
}
.wiz-subject-item input:focus { border-bottom-color: var(--accent-primary); }
.wiz-subject-item select {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: .82rem;
  padding: 4px 6px;
}
.wiz-subject-item .btn-remove {
  background: none;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  font-size: 1rem;
  padding: 4px;
  transition: color .2s;
}
.wiz-subject-item .btn-remove:hover { color: var(--accent-danger); }
.wiz-add-subject-btn {
  display: flex; align-items: center; gap: 6px;
  background: none;
  border: 1.5px dashed var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: .9rem;
  font-weight: 600;
  padding: 10px 14px;
  cursor: pointer;
  width: 100%;
  transition: border-color .2s, color .2s;
}
.wiz-add-subject-btn:hover { border-color: var(--accent-primary); color: var(--accent-primary); }

/* ── Radio cards ── */
.wiz-radio-group { display: flex; flex-wrap: wrap; gap: 8px; }
.wiz-radio-card {
  flex: 1;
  min-width: 110px;
  padding: 12px 10px;
  text-align: center;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: .88rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  transition: all .2s;
  user-select: none;
}
.wiz-radio-card.active {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
  background: rgba(59,130,246,.08);
}

/* ── Cards de perfil (passo 0) ── */
.wiz-profile-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  margin-top: 8px;
}
@media (max-width: 560px) {
  .wiz-profile-grid { grid-template-columns: 1fr; }
}
.wiz-profile-card {
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  padding: 20px 16px;
  cursor: pointer;
  text-align: center;
  background: var(--bg-tertiary);
  transition: all .2s;
  user-select: none;
}
.wiz-profile-card:hover {
  border-color: var(--accent-primary);
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(0,0,0,.08);
}
.wiz-profile-card .wiz-profile-icon { font-size: 1.8rem; margin-bottom: 8px; }
.wiz-profile-card .wiz-profile-title { font-size: .95rem; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
.wiz-profile-card .wiz-profile-desc { font-size: .78rem; color: var(--text-tertiary); line-height: 1.4; }

/* ── Footer sticky ── */
.wiz-footer {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border);
  padding: 14px 24px;
  padding-bottom: calc(14px + env(safe-area-inset-bottom));
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 300;
}
.wiz-footer-info { font-size: .88rem; color: var(--text-secondary); }
.wiz-footer-btns { display: flex; gap: 10px; }
.wiz-btn-back {
  padding: 10px 20px;
  background: var(--bg-tertiary);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-weight: 700;
  font-size: .9rem;
  cursor: pointer;
  transition: all .2s;
}
.wiz-btn-back:hover { color: var(--text-primary); border-color: var(--text-secondary); }
.wiz-btn-next {
  padding: 10px 28px;
  background: var(--accent-primary);
  border: none;
  border-radius: var(--radius-sm);
  color: #fff;
  font-weight: 700;
  font-size: .9rem;
  cursor: pointer;
  transition: opacity .2s;
  display: flex; align-items: center; gap: 8px;
}
.wiz-btn-next:hover { opacity: .85; }
.wiz-btn-next:disabled { opacity: .4; cursor: not-allowed; }
.wiz-btn-finish {
  background: var(--accent-success);
}

/* ── Feedback messages ── */
.wiz-feedback {
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  font-size: .88rem;
  margin-top: 10px;
  display: none;
}
.wiz-feedback.success { background: rgba(16,185,129,.12); border: 1px solid var(--accent-success); color: var(--accent-success); display: block; }
.wiz-feedback.error   { background: rgba(239,68,68,.12); border: 1px solid var(--accent-danger); color: var(--accent-danger); display: block; }
.wiz-feedback.info    { background: rgba(59,130,246,.10); border: 1px solid var(--accent-primary); color: var(--accent-primary); display: block; }

/* ── Skip link ── */
.wiz-skip { font-size: .82rem; color: var(--text-tertiary); cursor: pointer; text-decoration: underline; }
.wiz-skip:hover { color: var(--text-secondary); }

/* ── Prompt preview collapsible ── */
.wiz-prompt-preview {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px;
  font-size: .8rem;
  font-family: monospace;
  color: var(--text-secondary);
  white-space: pre-wrap;
  max-height: 140px;
  overflow: auto;
  margin-bottom: 12px;
  display: none;
}
.wiz-prompt-toggle {
  font-size: .82rem;
  color: var(--text-tertiary);
  cursor: pointer;
  margin-bottom: 10px;
  display: inline-block;
}
.wiz-prompt-toggle:hover { color: var(--text-secondary); }
`;
    document.head.appendChild(s);
  }

  /* ─── Prompt para IA ──────────────────────────────────────── */
  function buildAIPrompt(faculdade, curso) {
    const ctx = [faculdade, curso].filter(Boolean).join(' — ');
    return `Analise o arquivo da grade curricular/fluxograma que vou enviar (pode ser PDF, imagem ou texto) e retorne SOMENTE um JSON válido, sem texto antes ou depois, sem blocos de código markdown.

Contexto: ${ctx || 'grade curricular universitária'}

Formato obrigatório:
{
  "faculdade": "Nome da faculdade",
  "curso": "Nome do curso",
  "versao": "Ano/versão do currículo (se disponível)",
  "disciplinas": [
    {
      "nome": "Nome exato da disciplina",
      "codigo": "Código (ex: MAT001, deixe vazio se não tiver)",
      "semestre": 1,
      "cargaHoraria": 60,
      "creditos": 4,
      "prerequisitos": ["Nome da disciplina pré-requisito"],
      "tipo": "obrigatoria"
    }
  ]
}

Regras:
- "semestre" deve ser um número inteiro (1, 2, 3...). Se não souber, use 0.
- "tipo" deve ser "obrigatoria" ou "optativa"
- "prerequisitos" deve ser lista de nomes, não códigos
- Inclua TODAS as disciplinas visíveis, inclusive optativas
- Retorne APENAS o JSON, nada mais`;
  }

  /* ─── Render de cada etapa ────────────────────────────────── */

  /* ─── Passo 0: seleção de perfil ──────────────────────────── */
  const PROFILES = [
    { valor: 'faculdade',    icon: '🎓', title: 'Faculdade / Universidade', desc: 'Curso superior, com grade curricular e semestres.' },
    { valor: 'concurso',     icon: '📋', title: 'Concurso Público',         desc: 'Estudando pra um edital específico.' },
    { valor: 'ensino_medio', icon: '🏫', title: 'Ensino Médio / Escola',    desc: '1º, 2º ou 3º ano, técnico ou EJA.' },
    { valor: 'geral',        icon: '📚', title: 'Estudo Geral / Pessoal',   desc: 'Idiomas, certificações, empreendedorismo ou o que quiser.' }
  ];

  function renderProfileStep() {
    const html = `
<div id="slc-wizard">
  <div class="wiz-topbar">
    <div class="wiz-logo"><img src="logo.png" alt="SLCampus" class="brand-logo-img"> SLC</div>
    <div class="wiz-step-label">Bem-vindo(a)!</div>
  </div>
  <div class="wiz-body">
    <div class="wiz-card" id="wiz-step-0">
      <div class="wiz-card-title">👋 Pra que você quer usar o site?</div>
      <div class="wiz-card-sub">Isso ajusta as perguntas seguintes e o app inteiro pro seu tipo de estudo</div>
      <div class="wiz-profile-grid">
        ${PROFILES.map(p => `
          <div class="wiz-profile-card" data-perfil="${p.valor}">
            <div class="wiz-profile-icon">${p.icon}</div>
            <div class="wiz-profile-title">${esc(p.title)}</div>
            <div class="wiz-profile-desc">${esc(p.desc)}</div>
          </div>
        `).join('')}
      </div>
    </div>
  </div>
</div>`;

    const setupCard = document.querySelector('.setup-card') || document.querySelector('.setup-container');
    if (setupCard) {
      setupCard.innerHTML = html;
    } else {
      const screen = document.getElementById('setup-screen');
      if (screen) screen.innerHTML = `<div class="setup-card">${html}</div>`;
    }

    document.querySelectorAll('.wiz-profile-card').forEach(card => {
      card.addEventListener('click', () => {
        wizardState.perfil = card.dataset.perfil;
        wizardState.step = 1;
        saveDraft();
        renderWizard();
        window.scrollTo(0, 0);
      });
    });
  }

  /* ─── Passo "quem" (varia por perfil) ─────────────────────── */
  function renderStepQuem() {
    switch (wizardState.perfil) {
      case 'concurso':     return renderStep1Concurso();
      case 'ensino_medio':  return renderStep1EnsinoMedio();
      case 'geral':         return renderStep1Geral();
      case 'faculdade':
      default:               return renderStep1Faculdade();
    }
  }

  function renderStep1Faculdade() {
    return `
<div class="wiz-card" id="wiz-step-1">
  <div class="wiz-card-title">👋 Olá! Vamos começar</div>
  <div class="wiz-card-sub">Informações básicas para personalizar tudo para você</div>

  <div class="wiz-field">
    <label>Seu nome</label>
    <input type="text" id="wiz-nome" placeholder="Como quer ser chamado?" autocomplete="given-name">
  </div>

  <div class="wiz-row">
    <div class="wiz-field wiz-autocomplete-wrap">
      <label>Universidade</label>
      <input type="text" id="wiz-universidade" placeholder="Digite para buscar: UFOB, USP, UFMG..." autocomplete="off">
      <div class="wiz-autocomplete-list" id="wiz-universidade-list" role="listbox"></div>
    </div>
    <div class="wiz-field">
      <label>Curso</label>
      <input type="text" id="wiz-curso" placeholder="Ex: Engenharia Civil">
    </div>
  </div>

  <div class="wiz-field">
    <label>Semestre atual</label>
    <div class="wiz-radio-group" id="wiz-semestre-group">
      ${[1,2,3,4,5,6,7,8,9,10].map(n => `<div class="wiz-radio-card" data-val="${n}">${n}º</div>`).join('')}
    </div>
    <input type="hidden" id="wiz-semestre" value="">
  </div>
</div>`;
  }

  function renderStep1Concurso() {
    return `
<div class="wiz-card" id="wiz-step-1">
  <div class="wiz-card-title">📋 Seu Concurso</div>
  <div class="wiz-card-sub">Escolha um concurso da lista ou digite o seu, se não estiver lá</div>

  <div class="wiz-field">
    <label>Seu nome</label>
    <input type="text" id="wiz-nome" placeholder="Como quer ser chamado?" autocomplete="given-name">
  </div>

  <div class="wiz-field wiz-autocomplete-wrap">
    <label>Qual concurso você está estudando?</label>
    <input type="text" id="wiz-concurso" placeholder="Digite para buscar: PRF, TJ, Banco do Brasil, ENEM..." autocomplete="off">
    <div class="wiz-autocomplete-list" id="wiz-concurso-list" role="listbox"></div>
  </div>
  <p style="font-size:11.5px;color:var(--text-tertiary);margin:-8px 0 0;">
    Não achou o seu na lista? Sem problema — pode digitar o nome dele mesmo assim e você monta as matérias na próxima etapa.
  </p>
  <input type="hidden" id="wiz-concurso-materias" value="">
</div>`;
  }

  function renderStep1EnsinoMedio() {
    const tipos = (window.SLC_EnsinoMedio && window.SLC_EnsinoMedio.TIPOS_ESCOLA) || [
      { valor: 'regular', label: 'Ensino Médio Regular' },
      { valor: 'tecnico', label: 'Ensino Médio Técnico/Integrado' },
      { valor: 'eja', label: 'EJA (Educação de Jovens e Adultos)' }
    ];
    return `
<div class="wiz-card" id="wiz-step-1">
  <div class="wiz-card-title">🏫 Sua Escola</div>
  <div class="wiz-card-sub">Vamos pré-preencher suas matérias com base na sua série</div>

  <div class="wiz-field">
    <label>Seu nome</label>
    <input type="text" id="wiz-nome" placeholder="Como quer ser chamado?" autocomplete="given-name">
  </div>

  <div class="wiz-field">
    <label>Que série você está cursando?</label>
    <div class="wiz-radio-group" id="wiz-serie-group">
      <div class="wiz-radio-card" data-val="1">1º ano</div>
      <div class="wiz-radio-card" data-val="2">2º ano</div>
      <div class="wiz-radio-card" data-val="3">3º ano</div>
    </div>
    <input type="hidden" id="wiz-serie" value="">
  </div>

  <div class="wiz-field">
    <label>Tipo de escola</label>
    <div class="wiz-radio-group" id="wiz-tipo-escola-group">
      ${tipos.map((t, i) => `<div class="wiz-radio-card ${i===0?'active':''}" data-val="${t.valor}">${esc(t.label)}</div>`).join('')}
    </div>
    <input type="hidden" id="wiz-tipo-escola" value="${tipos[0]?.valor || 'regular'}">
  </div>
</div>`;
  }

  function renderStep1Geral() {
    return `
<div class="wiz-card" id="wiz-step-1">
  <div class="wiz-card-title">📚 Seus Objetivos</div>
  <div class="wiz-card-sub">Conte rapidamente o que você quer estudar ou organizar</div>

  <div class="wiz-field">
    <label>Seu nome</label>
    <input type="text" id="wiz-nome" placeholder="Como quer ser chamado?" autocomplete="given-name">
  </div>

  <div class="wiz-field">
    <label>Qual é o seu objetivo principal?</label>
    <input type="text" id="wiz-objetivo" placeholder="Ex: idiomas, empreender, certificações, organizar a rotina...">
  </div>
</div>`;
  }

  function renderStep2() {
    const hasCurriculum = wizardState.importedCurriculum.length > 0;

    return `
<div class="wiz-card" id="wiz-step-2">
  <div class="wiz-card-title">📚 Grade Curricular</div>
  <div class="wiz-card-sub">Importe todas as disciplinas do seu curso de uma vez, direto do PDF ou de uma foto do fluxograma.</div>

  <button id="wiz-auto-ia-import" type="button" style="
    width:100%;display:flex;align-items:center;justify-content:center;gap:10px;
    padding:16px;border-radius:var(--radius-md);border:none;
    background:linear-gradient(135deg,#1a73e8,#4f46e5);color:#fff;cursor:pointer;
    font-size:14.5px;font-weight:600;font-family:inherit;margin:16px 0 8px;
    box-shadow:0 4px 14px rgba(79,70,229,.28);
  ">
    <i class="fas fa-wand-magic-sparkles"></i> Importar PDF ou foto com IA (automático, grátis)
  </button>
  <p style="text-align:center;font-size:11.5px;color:var(--text-tertiary);margin:0 0 20px;">A IA lê o arquivo e preenche a grade sozinha, em segundos — não precisa digitar nada</p>

  <!-- Preview do que foi importado -->
  ${hasCurriculum ? renderCurriculumPreview() : '<div id="wiz-curr-preview-slot"></div>'}

  <p style="text-align:center;font-size:11.5px;color:var(--text-tertiary);margin:18px 0 0;">
    Não tem o PDF em mãos agora? Sem problema — clique em <strong>Pular esta etapa</strong> abaixo e importe depois em <strong>Grade Curricular</strong>.
  </p>
</div>`;
  }

  function renderCurriculumPreview() {
    const items = wizardState.importedCurriculum;
    if (!items.length) return '<div id="wiz-curr-preview-slot"></div>';
    const semColors = { '1':'sem1','2':'sem2','3':'sem3','4':'sem1','5':'sem2','6':'sem3' };
    return `
<div class="wiz-curr-preview" id="wiz-curr-preview-slot">
  <div class="wiz-curr-preview-title">
    <i class="fas fa-check-circle"></i>
    ${items.length} disciplinas importadas
  </div>
  <div class="wiz-curr-chips">
    ${items.slice(0,40).map(d => `<span class="wiz-curr-chip ${semColors[String(d.semestre)] || ''}">${esc(d.nome)}</span>`).join('')}
    ${items.length > 40 ? `<span class="wiz-curr-chip">+${items.length-40} mais</span>` : ''}
  </div>
</div>`;
  }

  // ─── Importação automática (PDF/foto via IA) dentro do wizard ────────────
  // window.GradeIAImport (grade-ia-import.js) foi originalmente feito para a
  // tela de setup antiga (procura #semestre no DOM e chama
  // app.populateSetupSubjects). Aqui a gente cria um shim: espelha o semestre
  // escolhido num input oculto e "escuta" o resultado via
  // app.pendingSetupImportedCurriculum, que o módulo já preenche sozinho.
  let _autoImportPoll = null;

  function openAutoGradeImport(forCurrentSubjects) {
    if (!window.GradeIAImport || typeof window.GradeIAImport.openModal !== 'function') {
      if (window.showToast) window.showToast('Importação automática indisponível agora. Use uma das opções manuais abaixo.', 'error');
      return;
    }
    if (!window.app) {
      if (window.showToast) window.showToast('Aguarde a página carregar por completo e tente novamente.', 'error');
      return;
    }

    // Shim: espelha o semestre da etapa 1 no campo que o grade-ia-import.js espera encontrar
    let hiddenSemestre = document.getElementById('semestre');
    if (!hiddenSemestre) {
      hiddenSemestre = document.createElement('input');
      hiddenSemestre.type = 'hidden';
      hiddenSemestre.id = 'semestre';
      document.body.appendChild(hiddenSemestre);
    }
    hiddenSemestre.value = wizardState.semestre || q('#wiz-semestre')?.value || '';

    window.app.pendingSetupImportedCurriculum = null;
    window.GradeIAImport.openModal('setup');

    if (_autoImportPoll) clearInterval(_autoImportPoll);
    let attempts = 0;
    _autoImportPoll = setInterval(() => {
      attempts++;
      const pending = window.app?.pendingSetupImportedCurriculum;

      if (Array.isArray(pending) && pending.length) {
        clearInterval(_autoImportPoll);
        _autoImportPoll = null;
        window.app.pendingSetupImportedCurriculum = null;

        const existingNames = new Set(wizardState.importedCurriculum.map(d => (d.nome || '').toLowerCase().trim()));
        const novos = pending.filter(d => !existingNames.has((d.nome || '').toLowerCase().trim()));
        wizardState.importedCurriculum = [...wizardState.importedCurriculum, ...novos];
        wizardState.touched = wizardState.touched || {};
        wizardState.touched[2] = true;

        if (forCurrentSubjects) {
          // Chamado da etapa 4 ("cadastrar matérias por print/PDF"): filtra pelo
          // semestre atual e injeta direto na lista de matérias do semestre,
          // sem esperar a pessoa voltar pra etapa 2.
          const semestre = wizardState.semestre || q('#wiz-semestre')?.value || '';
          const existingSubjNames = new Set((wizardState.subjects || []).map(s => (s.nome || '').toLowerCase().trim()));
          const toAdd = wizardState.importedCurriculum.filter(d => String(d.semestre) === String(semestre))
            .filter(d => !existingSubjNames.has((d.nome || '').toLowerCase().trim()))
            .map(d => ({ nome: d.nome, dificuldade: 3, peso: d.tipo === 'optativa' ? 3 : 4, notaDesejada: 7 }));
          if (toAdd.length) {
            wizardState.subjects = [...(wizardState.subjects || []).filter(s => s.nome), ...toAdd];
            wizardState.touched[4] = true;
          }
          saveDraft();
          if (wizardState.step === 4) renderWizard();
        } else {
          saveDraft();
          if (wizardState.step === 2) renderWizard();
        }
        if (window.showToast) window.showToast(`${novos.length} disciplina(s) importada(s) com IA!`, 'success');
      } else if (attempts > 300) {
        // ~2 minutos sem resultado (modal cancelado ou fechado) — para de esperar
        clearInterval(_autoImportPoll);
        _autoImportPoll = null;
      }
    }, 400);
  }

  function renderStep3() {
    return `
<div class="wiz-card" id="wiz-step-3">
  <div class="wiz-card-title">⏰ Sua Rotina</div>
  <div class="wiz-card-sub">Isso ajuda o sistema a sugerir horários que fazem sentido pra você</div>

  <div class="wiz-field">
    <label>Quando você estuda melhor?</label>
    <div class="wiz-radio-group" id="wiz-turno-group">
      <div class="wiz-radio-card" data-val="manha">☀️ Manhã</div>
      <div class="wiz-radio-card active" data-val="tarde">🌤 Tarde</div>
      <div class="wiz-radio-card" data-val="noite">🌙 Noite</div>
      <div class="wiz-radio-card" data-val="madrugada">🌑 Madrugada</div>
    </div>
    <input type="hidden" id="wiz-turno" value="tarde">
  </div>

  <div class="wiz-field">
    <label>Dias que você costuma estudar</label>
    <div class="wiz-days" id="wiz-days-group">
      ${['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map((d,i) => {
        const vals = ['seg','ter','qua','qui','sex','sab','dom'];
        const active = i < 5 ? 'active' : '';
        return `<button class="wiz-day-btn ${active}" data-val="${vals[i]}" type="button">${d}</button>`;
      }).join('')}
    </div>
  </div>

  <div class="wiz-row">
    <div class="wiz-field">
      <label>Horas máximas por dia</label>
      <select id="wiz-horas">
        ${[1,2,3,4,5,6,7,8,9,10,12].map(h => `<option value="${h}" ${h===4?'selected':''}>${h}h</option>`).join('')}
      </select>
    </div>
    <div class="wiz-field">
      <label>Tipo de rotina</label>
      <select id="wiz-rotina">
        <option value="so-estuda">Só estudo</option>
        <option value="estuda-trabalha">Estudo + Trabalho</option>
        <option value="estuda-estagio">Estudo + Estágio</option>
        <option value="rotina-pesada">Rotina muito pesada</option>
      </select>
    </div>
  </div>

  <div class="wiz-row">
    <div class="wiz-field">
      <label>Tempo de deslocamento (min)</label>
      <input type="number" id="wiz-deslocamento" min="0" max="240" value="20" placeholder="Ex: 20">
    </div>
    <div class="wiz-field">
      <label>Horário de sono (opcional)</label>
      <div class="wiz-time-range">
        <input type="time" id="wiz-sono-inicio" aria-label="Início do sono">
        <span class="wiz-time-sep">até</span>
        <input type="time" id="wiz-sono-fim" aria-label="Fim do sono">
      </div>
    </div>
  </div>
</div>`;
  }

  function renderStepMaterias() {
    const perfil = wizardState.perfil || 'faculdade';
    const semestre = wizardState.semestre || q('#wiz-semestre')?.value || '';
    let autoCount = 0;

    if (perfil === 'faculdade') {
      const autoSubjects = wizardState.importedCurriculum
        .filter(d => String(d.semestre) === String(semestre))
        .slice(0, 10);
      // Pre-populate se tiver dados da grade importada
      if (autoSubjects.length && !wizardState.subjects.length) {
        wizardState.subjects = autoSubjects.map(d => ({ nome: d.nome, dificuldade: 3, peso: 3, notaDesejada: 7 }));
      }
      autoCount = autoSubjects.length;
    } else if (perfil === 'concurso' && !wizardState.subjects.length && wizardState.concursoMaterias?.length) {
      wizardState.subjects = wizardState.concursoMaterias.map(nome => ({ nome, dificuldade: 3, peso: 3, notaDesejada: 7 }));
      autoCount = wizardState.subjects.length;
    } else if (perfil === 'ensino_medio' && !wizardState.subjects.length) {
      const materias = window.SLC_EnsinoMedio ? window.SLC_EnsinoMedio.getMateriasPorSerie(wizardState.serie) : [];
      if (materias.length) {
        wizardState.subjects = materias.map(nome => ({ nome, dificuldade: 3, peso: 3, notaDesejada: 7 }));
        autoCount = materias.length;
      }
    }

    const subjects = wizardState.subjects.length ? wizardState.subjects : [{ nome:'', dificuldade:3, peso:3, notaDesejada:7 }];

    const titulo = perfil === 'geral' ? '🎯 Perfil & Áreas de Estudo' : '🎯 Perfil & Matérias';
    let subtitulo;
    if (perfil === 'faculdade') {
      subtitulo = `Matérias do <strong>${semestre ? semestre+'º' : 'seu'} semestre</strong>` +
        (autoCount ? ` — <span style="color:var(--accent-success)">${autoCount} pré-preenchidas da grade importada ✓</span>` : ' — adicione as que você está cursando agora');
    } else if (perfil === 'concurso') {
      subtitulo = autoCount
        ? `<span style="color:var(--accent-success)">${autoCount} matérias pré-preenchidas do edital básico ✓</span> — ajuste como quiser`
        : 'Adicione as matérias do seu edital';
    } else if (perfil === 'ensino_medio') {
      subtitulo = autoCount
        ? `<span style="color:var(--accent-success)">${autoCount} matérias pré-preenchidas da sua série ✓</span> — ajuste como quiser`
        : 'Adicione as matérias que você está cursando';
    } else {
      subtitulo = 'Adicione as áreas ou assuntos que você quer estudar';
    }

    return `
<div class="wiz-card" id="wiz-step-4">
  <div class="wiz-card-title">${titulo}</div>
  <div class="wiz-card-sub">${subtitulo}</div>

  <button id="wiz-step4-ia-import" type="button" style="
    width:100%;display:flex;align-items:center;justify-content:center;gap:8px;
    padding:10px 14px;border-radius:var(--radius-md);border:1px dashed var(--accent-primary);
    background:transparent;color:var(--accent-primary);cursor:pointer;
    font-size:12.5px;font-weight:600;font-family:inherit;margin-bottom:14px;
  ">
    <i class="fas fa-wand-magic-sparkles"></i> Cadastrar matérias por print ou PDF com IA
  </button>

  <div id="wiz-subjects-list">
    ${subjects.map((s, i) => renderSubjectRow(s, i)).join('')}
  </div>
  <button class="wiz-add-subject-btn" id="wiz-add-subject-btn" type="button">
    <i class="fas fa-plus"></i> Adicionar Matéria
  </button>
  <p style="font-size:11px;color:var(--text-tertiary);margin:10px 0 0;">
    <i class="fas fa-circle-info"></i> Você não precisa definir a dificuldade de cada matéria — o site calcula isso sozinho com base nas tarefas, notas e frequência que você for registrando, e ajusta automaticamente ao longo do semestre.
  </p>

  <div style="margin-top: 28px;">
    <div class="wiz-field">
      <label>Seu nível de disciplina hoje</label>
      <div class="wiz-radio-group" id="wiz-disciplina-group">
        <div class="wiz-radio-card" data-val="baixo">📉 Preciso melhorar</div>
        <div class="wiz-radio-card active" data-val="medio">📊 Consigo manter</div>
        <div class="wiz-radio-card" data-val="alto">📈 Muito disciplinado</div>
      </div>
      <input type="hidden" id="wiz-disciplina" value="medio">
    </div>

    <div class="wiz-field">
      <label>Maior dificuldade agora <span style="font-weight:400;color:var(--text-tertiary);">(pode escolher mais de uma)</span></label>
      <div class="wiz-radio-group wiz-radio-group-multi" id="wiz-dificuldade-group">
        <div class="wiz-radio-card" data-val="procrastinacao">😴 Procrastinação</div>
        <div class="wiz-radio-card" data-val="organizacao">📂 Organização</div>
        <div class="wiz-radio-card active" data-val="tempo">⏳ Pouco tempo</div>
        <div class="wiz-radio-card" data-val="materias">📚 Matérias difíceis</div>
        <div class="wiz-radio-card" data-val="constancia">🔄 Constância</div>
      </div>
      <input type="hidden" id="wiz-dificuldade" value="tempo">
    </div>
  </div>
</div>`;
  }

  function renderSubjectRow(subject, index) {
    return `
<div class="wiz-subject-item" data-idx="${index}">
  <input type="text" class="wiz-subject-nome" placeholder="Nome da matéria" value="${esc(subject.nome || '')}">
  <select class="wiz-subject-peso" title="Peso/importância dessa matéria pra você">
    ${[1,2,3,4,5].map(n => `<option value="${n}" ${n===(subject.peso||3)?'selected':''}>Peso ${n}</option>`).join('')}
  </select>
  <button class="btn-remove" type="button" title="Remover"><i class="fas fa-times"></i></button>
</div>`;
  }

  /* ─── Render do wizard completo ───────────────────────────── */
  function renderWizard() {
    const step = wizardState.step;

    if (step === 0 || !wizardState.perfil) {
      renderProfileStep();
      return;
    }

    const totalSteps = getTotalSteps();
    const labels = getStepLabels();
    const kind = kindOfStep(step);

    let bodyContent = '';
    if (kind === 'quem') bodyContent = renderStepQuem();
    else if (kind === 'grade') bodyContent = renderStep2();
    else if (kind === 'rotina') bodyContent = renderStep3();
    else if (kind === 'materias') bodyContent = renderStepMaterias();

    const html = `
<div id="slc-wizard">
  <div class="wiz-topbar">
    <div class="wiz-logo"><img src="logo.png" alt="SLCampus" class="brand-logo-img"> SLC</div>
    <div class="wiz-steps">
      ${Array.from({ length: totalSteps }, (_, i) => i + 1).map(n => {
        let cls = '';
        if (n < step) cls = 'done';
        else if (n === step) cls = 'active';
        return `<div class="wiz-step-dot ${cls}"></div>`;
      }).join('')}
    </div>
    <div class="wiz-step-label">Passo ${step} de ${totalSteps} — ${labels[step-1]}</div>
  </div>
  <div class="wiz-body">${bodyContent}</div>
  <div class="wiz-footer">
    <div class="wiz-footer-info">
      <button class="wiz-btn-back" id="wiz-btn-back">← Voltar</button>
      ${kind === 'grade' ? `<span class="wiz-skip" id="wiz-skip-step">Pular esta etapa</span>` : ''}
    </div>
    <div class="wiz-footer-btns">
      ${step < totalSteps
        ? `<button class="wiz-btn-next" id="wiz-btn-next">Continuar <i class="fas fa-arrow-right"></i></button>`
        : `<button class="wiz-btn-next wiz-btn-finish" id="wiz-btn-finish"><i class="fas fa-rocket"></i> Iniciar Jornada</button>`
      }
    </div>
  </div>
</div>`;

    const setupCard = document.querySelector('.setup-card') || document.querySelector('.setup-container');
    if (setupCard) {
      setupCard.innerHTML = html;
    } else {
      const screen = document.getElementById('setup-screen');
      if (screen) screen.innerHTML = `<div class="setup-card">${html}</div>`;
    }

    attachEvents(step);
    restoreValues(step);
  }

  /* ─── Restaurar valores ao voltar ────────────────────────── */
  function restoreValues(step) {
    const kind = kindOfStep(step);
    if (kind === 'quem' && wizardState.perfil === 'faculdade') {
      if (wizardState.nome)         { const el = q('#wiz-nome'); if(el) el.value = wizardState.nome; }
      if (wizardState.universidade) { const el = q('#wiz-universidade'); if(el) el.value = wizardState.universidade; }
      if (wizardState.curso)        { const el = q('#wiz-curso'); if(el) el.value = wizardState.curso; }
      if (wizardState.semestre) {
        q('#wiz-semestre').value = wizardState.semestre;
        document.querySelectorAll('#wiz-semestre-group .wiz-radio-card').forEach(c => {
          c.classList.toggle('active', c.dataset.val === String(wizardState.semestre));
        });
      }
    }
    if (kind === 'quem' && wizardState.perfil === 'concurso') {
      if (wizardState.nome)     { const el = q('#wiz-nome'); if(el) el.value = wizardState.nome; }
      if (wizardState.concurso) { const el = q('#wiz-concurso'); if(el) el.value = wizardState.concurso; }
    }
    if (kind === 'quem' && wizardState.perfil === 'ensino_medio') {
      if (wizardState.nome) { const el = q('#wiz-nome'); if(el) el.value = wizardState.nome; }
      if (wizardState.serie) {
        document.querySelectorAll('#wiz-serie-group .wiz-radio-card').forEach(c => {
          c.classList.toggle('active', c.dataset.val === String(wizardState.serie));
        });
        const el = q('#wiz-serie'); if (el) el.value = wizardState.serie;
      }
      if (wizardState.tipoEscola) {
        document.querySelectorAll('#wiz-tipo-escola-group .wiz-radio-card').forEach(c => {
          c.classList.toggle('active', c.dataset.val === wizardState.tipoEscola);
        });
        const el = q('#wiz-tipo-escola'); if (el) el.value = wizardState.tipoEscola;
      }
    }
    if (kind === 'quem' && wizardState.perfil === 'geral') {
      if (wizardState.nome)     { const el = q('#wiz-nome'); if(el) el.value = wizardState.nome; }
      if (wizardState.objetivo) { const el = q('#wiz-objetivo'); if(el) el.value = wizardState.objetivo; }
    }
    if (kind === 'rotina') {
      if (wizardState.turno) {
        q('#wiz-turno').value = wizardState.turno;
        document.querySelectorAll('#wiz-turno-group .wiz-radio-card').forEach(c => {
          c.classList.toggle('active', c.dataset.val === wizardState.turno);
        });
      }
      if (wizardState.horas)       { const el = q('#wiz-horas'); if(el) el.value = wizardState.horas; }
      if (wizardState.rotina)      { const el = q('#wiz-rotina'); if(el) el.value = wizardState.rotina; }
      if (wizardState.deslocamento) { const el = q('#wiz-deslocamento'); if(el) el.value = wizardState.deslocamento; }
      if (wizardState.sono) {
        const { inicio, fim } = parseTimeRange(wizardState.sono);
        const elInicio = q('#wiz-sono-inicio'); if (elInicio) elInicio.value = inicio;
        const elFim = q('#wiz-sono-fim'); if (elFim) elFim.value = fim;
      }
      if (wizardState.dias) {
        document.querySelectorAll('#wiz-days-group .wiz-day-btn').forEach(b => {
          b.classList.toggle('active', wizardState.dias.includes(b.dataset.val));
        });
      }
    }
    if (kind === 'materias') {
      if (wizardState.disciplina) {
        q('#wiz-disciplina').value = wizardState.disciplina;
        document.querySelectorAll('#wiz-disciplina-group .wiz-radio-card').forEach(c => {
          c.classList.toggle('active', c.dataset.val === wizardState.disciplina);
        });
      }
      if (wizardState.dificuldade) {
        // Aceita tanto o formato novo (array, múltipla escolha) quanto o
        // antigo (string única) — rascunhos salvos antes dessa mudança
        // continuam funcionando.
        const selecionados = Array.isArray(wizardState.dificuldade)
          ? wizardState.dificuldade
          : [wizardState.dificuldade];
        q('#wiz-dificuldade').value = selecionados.join(',');
        document.querySelectorAll('#wiz-dificuldade-group .wiz-radio-card').forEach(c => {
          c.classList.toggle('active', selecionados.includes(c.dataset.val));
        });
      }
    }
  }

  /* ─── Eventos de cada etapa ──────────────────────────────── */
  /* ─── Autocomplete de universidade ───────────────────────── */
  function setupUniversidadeAutocomplete() {
    const input = q('#wiz-universidade');
    const list  = q('#wiz-universidade-list');
    if (!input || !list || !window.SLC_Universidades) return;

    let items = [];
    let activeIndex = -1;

    function fechar() {
      list.innerHTML = '';
      list.classList.remove('open');
      items = [];
      activeIndex = -1;
    }

    function render(termo) {
      items = window.SLC_Universidades.buscarInstituicoes(termo, 8);
      if (!items.length) { fechar(); return; }

      list.innerHTML = items.map((it, i) => `
        <div class="wiz-ac-item" data-idx="${i}" role="option">
          <span class="wiz-ac-nome">${escapeHtml(it.nome)}</span>
          <span class="wiz-ac-meta">${escapeHtml(it.sigla || '')}${it.sigla ? ' · ' : ''}${escapeHtml(it.uf || '')}</span>
        </div>
      `).join('');
      list.classList.add('open');
      activeIndex = -1;

      list.querySelectorAll('.wiz-ac-item').forEach(el => {
        el.addEventListener('mousedown', (e) => {
          e.preventDefault();
          escolher(parseInt(el.dataset.idx, 10));
        });
      });
    }

    function escolher(idx) {
      const item = items[idx];
      if (!item) return;
      input.value = item.nome;
      wizardState.universidade = item.nome;
      fechar();
    }

    // Delega para window.escapeHtml (utils.js) quando disponível; fallback
    // idêntico mantido só por segurança de ordem de carregamento.
    function escapeHtml(s) {
      if (window.escapeHtml) return window.escapeHtml(s);
      return (s || '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[c]));
    }

    let debounceT;
    input.addEventListener('input', () => {
      clearTimeout(debounceT);
      const val = input.value;
      debounceT = setTimeout(() => render(val), 120);
    });

    input.addEventListener('keydown', (e) => {
      if (!items.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, items.length - 1);
        updateActive();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        updateActive();
      } else if (e.key === 'Enter') {
        if (activeIndex >= 0) { e.preventDefault(); escolher(activeIndex); }
      } else if (e.key === 'Escape') {
        fechar();
      }
    });

    function updateActive() {
      list.querySelectorAll('.wiz-ac-item').forEach((el, i) => {
        el.classList.toggle('active', i === activeIndex);
      });
      const activeEl = list.querySelector('.wiz-ac-item.active');
      if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
    }

    input.addEventListener('blur', () => setTimeout(fechar, 100));
    input.addEventListener('focus', () => { if (input.value.trim().length >= 2) render(input.value); });
  }

  /* ─── Autocomplete de concurso ────────────────────────────── */
  function setupConcursoAutocomplete() {
    const input = q('#wiz-concurso');
    const list  = q('#wiz-concurso-list');
    if (!input || !list || !window.SLC_Concursos) return;

    let items = [];
    let activeIndex = -1;

    function escapeHtml(s) {
      if (window.escapeHtml) return window.escapeHtml(s);
      return (s || '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[c]));
    }

    function fechar() {
      list.innerHTML = '';
      list.classList.remove('open');
      items = [];
      activeIndex = -1;
    }

    function render(termo) {
      items = window.SLC_Concursos.buscarConcursos(termo, 8);
      if (!items.length) { fechar(); return; }

      list.innerHTML = items.map((it, i) => `
        <div class="wiz-ac-item" data-idx="${i}" role="option">
          <span class="wiz-ac-nome">${escapeHtml(it.nome)}</span>
          <span class="wiz-ac-meta">${escapeHtml(it.categoria || '')}</span>
        </div>
      `).join('');
      list.classList.add('open');
      activeIndex = -1;

      list.querySelectorAll('.wiz-ac-item').forEach(el => {
        el.addEventListener('mousedown', (e) => {
          e.preventDefault();
          escolher(parseInt(el.dataset.idx, 10));
        });
      });
    }

    function escolher(idx) {
      const item = items[idx];
      if (!item) return;
      input.value = item.nome;
      wizardState.concurso = item.nome;
      wizardState.concursoMaterias = item.materias || [];
      fechar();
    }

    let debounceT;
    input.addEventListener('input', () => {
      clearTimeout(debounceT);
      const val = input.value;
      // Se a pessoa editar o texto depois de já ter escolhido um item da
      // lista, considera que passou a ser um concurso digitado à mão —
      // não usa mais as matérias pré-definidas daquele item.
      if (wizardState.concurso && val !== wizardState.concurso) {
        wizardState.concurso = val;
        wizardState.concursoMaterias = [];
      }
      debounceT = setTimeout(() => render(val), 120);
    });

    input.addEventListener('keydown', (e) => {
      if (!items.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, items.length - 1);
        updateActive();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        updateActive();
      } else if (e.key === 'Enter') {
        if (activeIndex >= 0) { e.preventDefault(); escolher(activeIndex); }
      } else if (e.key === 'Escape') {
        fechar();
      }
    });

    function updateActive() {
      list.querySelectorAll('.wiz-ac-item').forEach((el, i) => {
        el.classList.toggle('active', i === activeIndex);
      });
      const activeEl = list.querySelector('.wiz-ac-item.active');
      if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
    }

    input.addEventListener('blur', () => setTimeout(fechar, 100));
    input.addEventListener('focus', () => { if (input.value.trim().length >= 2) render(input.value); });
  }

  function attachEvents(step) {
    // Radio cards genérico (seleção única)
    document.querySelectorAll('.wiz-radio-group:not(.wiz-radio-group-multi)').forEach(group => {
      group.querySelectorAll('.wiz-radio-card').forEach(card => {
        card.addEventListener('click', () => {
          group.querySelectorAll('.wiz-radio-card').forEach(c => c.classList.remove('active'));
          card.classList.add('active');
          const hiddenId = group.id.replace('-group', '');
          const hidden = document.getElementById(`wiz-${hiddenId.split('-').pop()}`);
          if (hidden) hidden.value = card.dataset.val;
          // Para o semestre
          if (group.id === 'wiz-semestre-group') {
            wizardState.semestre = card.dataset.val;
            q('#wiz-semestre').value = card.dataset.val;
          }
          // Para série e tipo de escola (nomes compostos — o cálculo
          // genérico de id acima não cobre bem hífen duplo)
          if (group.id === 'wiz-serie-group') {
            wizardState.serie = card.dataset.val;
            q('#wiz-serie').value = card.dataset.val;
          }
          if (group.id === 'wiz-tipo-escola-group') {
            wizardState.tipoEscola = card.dataset.val;
            q('#wiz-tipo-escola').value = card.dataset.val;
          }
        });
      });
    });

    // Cards de múltipla escolha (ex.: "maior dificuldade agora") — cada
    // clique só alterna (toggle) o próprio card, sem desmarcar os outros,
    // e sempre mantém pelo menos um selecionado.
    document.querySelectorAll('.wiz-radio-group-multi').forEach(group => {
      group.querySelectorAll('.wiz-radio-card').forEach(card => {
        card.addEventListener('click', () => {
          const isOnly = card.classList.contains('active') &&
            group.querySelectorAll('.wiz-radio-card.active').length === 1;
          if (isOnly) return; // não deixa desmarcar o último selecionado
          card.classList.toggle('active');

          const selecionados = Array.from(group.querySelectorAll('.wiz-radio-card.active')).map(c => c.dataset.val);
          const hiddenId = group.id.replace('-group', '');
          const hidden = document.getElementById(`wiz-${hiddenId.split('-').pop()}`);
          if (hidden) hidden.value = selecionados.join(',');
        });
      });
    });

    // Dias da semana toggle
    document.querySelectorAll('#wiz-days-group .wiz-day-btn').forEach(btn => {
      btn.addEventListener('click', () => btn.classList.toggle('active'));
    });

    // Autocomplete do passo "quem" (varia por perfil)
    const kindNow = kindOfStep(step);
    if (kindNow === 'quem') {
      if (wizardState.perfil === 'faculdade') setupUniversidadeAutocomplete();
      else if (wizardState.perfil === 'concurso') setupConcursoAutocomplete();
    }

    // Navegação
    q('#wiz-btn-next')?.addEventListener('click', () => goNext());
    q('#wiz-btn-finish')?.addEventListener('click', () => finishSetup());
    q('#wiz-btn-back')?.addEventListener('click', () => goBack());
    q('#wiz-skip-step')?.addEventListener('click', async () => {
      const { title, body } = confirmationContentFor(wizardState.step);
      const proceed = await confirmProceed(title, body, 'Pular mesmo assim');
      if (!proceed) return;
      wizardState.step++;
      saveDraft();
      renderWizard();
    });

    // Etapa "grade": importação automática por IA (só faculdade)
    if (kindNow === 'grade') {
      q('#wiz-auto-ia-import')?.addEventListener('click', () => openAutoGradeImport());
    }

    // Etapa "materias": subjects/áreas
    if (kindNow === 'materias') {
      q('#wiz-add-subject-btn')?.addEventListener('click', () => {
        wizardState.subjects.push({ nome: '', dificuldade: 3, peso: 3, notaDesejada: 7 });
        refreshSubjectsList();
      });
      q('#wiz-step4-ia-import')?.addEventListener('click', () => openAutoGradeImport(true));
      attachSubjectEvents();
    }

    // Marca a etapa como "mexida" em qualquer interação real dentro do corpo
    // do wizard (exceto os próprios botões de navegação) — usado para saber
    // se dá pra avançar direto ou se vale mostrar o aviso de "tem certeza?".
    const body = document.querySelector('.wiz-body');
    if (body && !body.dataset.touchListenerBound) {
      body.dataset.touchListenerBound = '1';
      let _draftSaveTimer = null;
      ['input', 'change', 'click'].forEach(evt => {
        body.addEventListener(evt, () => {
          wizardState.touched = wizardState.touched || {};
          wizardState.touched[wizardState.step] = true;
          // Mantém o rascunho no localStorage próximo do estado real em
          // memória (debounced pra não gravar a cada tecla), pra reduzir
          // a chance de qualquer reinicialização perder progresso não
          // salvo — mesmo com a trava em loadDraft(), é uma segunda rede
          // de segurança barata.
          clearTimeout(_draftSaveTimer);
          _draftSaveTimer = setTimeout(() => {
            saveCurrentStep();
            saveDraft();
          }, 600);
        }, true);
      });
    }
  }

  function attachSubjectEvents() {
    document.querySelectorAll('#wiz-subjects-list .wiz-subject-item').forEach((row, i) => {
      row.querySelector('.btn-remove')?.addEventListener('click', () => {
        wizardState.subjects.splice(i, 1);
        refreshSubjectsList();
      });
      row.querySelector('.wiz-subject-nome')?.addEventListener('input', e => {
        if (!wizardState.subjects[i]) wizardState.subjects[i] = {};
        wizardState.subjects[i].nome = e.target.value;
      });
    });
  }

  function refreshSubjectsList() {
    const list = q('#wiz-subjects-list');
    if (!list) return;
    list.innerHTML = wizardState.subjects.map((s, i) => renderSubjectRow(s, i)).join('');
    attachSubjectEvents();
  }

  function addManualItem() {
    const container = q('#wiz-manual-items');
    if (!container) return;
    const idx = container.children.length;
    const div = document.createElement('div');
    div.className = 'wiz-subject-item';
    div.setAttribute('data-idx', idx);
    div.innerHTML = `
      <input type="text" class="wiz-manual-nome" placeholder="Nome da disciplina" style="width:100%;background:transparent;border:none;border-bottom:1px solid var(--border);color:var(--text-primary);font-size:.95rem;padding:4px 0;outline:none;">
      <select class="wiz-manual-sem" style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:.82rem;padding:4px 6px;">
        ${[1,2,3,4,5,6,7,8,9,10].map(n=>`<option value="${n}">${n}º sem</option>`).join('')}
      </select>
      <select class="wiz-manual-tipo" style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:.82rem;padding:4px 6px;">
        <option value="obrigatoria">Obrigatória</option>
        <option value="optativa">Optativa</option>
      </select>
      <button class="btn-remove" type="button"><i class="fas fa-times"></i></button>
    `;
    div.querySelector('.btn-remove').addEventListener('click', () => div.remove());
    container.appendChild(div);
  }

  function attachManualEvents() {
    document.querySelectorAll('#wiz-manual-items .btn-remove').forEach(btn => {
      btn.addEventListener('click', () => btn.closest('.wiz-subject-item').remove());
    });
  }

  function updateCurriculumPreview() {
    const slot = q('#wiz-curr-preview-slot');
    if (slot) slot.outerHTML = renderCurriculumPreview();
  }

  /* ─── Parsers ────────────────────────────────────────────── */
  function parseGradeJSON(raw) {
    const data = JSON.parse(raw);
    const sourceItems =
      Array.isArray(data.disciplinas) ? data.disciplinas :
      Array.isArray(data.curriculum)  ? data.curriculum  :
      Array.isArray(data.items)       ? data.items        : [];
    return sourceItems
      .filter(d => d && (d.nome || d.name))
      .map((d, i) => ({
        id: window.generateId ? window.generateId() : 'id_' + Date.now() + '_' + i,
        nome: String(d.nome || d.name || `Disciplina ${i+1}`).trim(),
        codigo: String(d.codigo || d.code || '').trim().toUpperCase(),
        semestre: Number(d.semestre || d.semester || d.periodo || 0),
        cargaHoraria: Number(d.cargaHoraria || d.carga_horaria || d.ch || 0),
        creditos: Number(d.creditos || d.credits || 0),
        prerequisitos: Array.isArray(d.prerequisitos) ? d.prerequisitos : [],
        tipo: String(d.tipo || d.type || 'obrigatoria'),
        status: 'nao-cursada'
      }));
  }

  function parseGradeText(text) {
    // Tenta extrair disciplinas de texto livre (padrão: "Nome da Disciplina - XXh" ou similar)
    const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
    const results = [];
    let currentSemester = 0;

    const semRe = /(\d+)[ºo°]\s*(semestre|sem\b|período|per\b)/i;
    const chRe  = /(\d{2,3})\s*h(?:oras?)?/i;
    const skipRe = /^(grade|fluxo|curso|faculdade|universidade|disciplina|componente|carga|crédito|semestre|período|código|ementa|pré)/i;

    for (const line of lines) {
      const semMatch = line.match(semRe);
      if (semMatch) { currentSemester = parseInt(semMatch[1]); continue; }
      if (skipRe.test(line) || line.length < 8) continue;

      // Remove códigos tipo "MAT001 —"
      let nome = line.replace(/^[A-Z]{2,5}\d{3,6}\s*[-–—:]\s*/i, '').replace(chRe, '').replace(/\s*[-–—|]\s*$/, '').trim();
      if (nome.length < 5) continue;
      const chMatch = line.match(chRe);
      results.push({
        id: window.generateId ? window.generateId() : 'id_' + Date.now() + '_' + results.length,
        nome,
        codigo: '',
        semestre: currentSemester,
        cargaHoraria: chMatch ? parseInt(chMatch[1]) : 60,
        creditos: 0,
        prerequisitos: [],
        tipo: 'obrigatoria',
        status: 'nao-cursada'
      });
    }
    return results;
  }

  /* ─── Rascunho (localStorage) ────────────────────────────── */
  // Se a pessoa fechar a aba no meio do cadastro, retoma de onde parou.
  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(wizardState));
    } catch (_) { /* localStorage indisponível — ignora silenciosamente */ }
  }

  // Só é seguro recarregar o rascunho do localStorage ANTES do wizard
  // existir na memória desta aba. Se o wizard já foi inicializado (o
  // usuário já está preenchendo alguma etapa), o `wizardState` em memória
  // é sempre mais atual que o rascunho salvo — o rascunho só é persistido
  // ao trocar de etapa (goNext/goBack/finishSetup), então digitação em
  // andamento (ex.: nome de matéria) ainda não está no localStorage.
  // Sem essa trava, uma reinicialização acidental do wizard (ver
  // comentário em waitForSetup/renderSetupForm mais abaixo) sobrescreveria
  // o progresso real com uma versão desatualizada.
  let _wizardBootedInSession = false;

  function loadDraft() {
    if (_wizardBootedInSession) return wizardState.step > 0;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw);
      if (saved && typeof saved === 'object') {
        Object.assign(wizardState, saved);
        return wizardState.step > 0;
      }
    } catch (_) { /* rascunho corrompido — ignora e começa do zero */ }
    return false;
  }

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
  }

  /* ─── Aviso de "tem certeza que quer pular?" ─────────────────
     Em vez de simplesmente bloquear o avanço (o que irrita quem realmente
     quer pular e completar depois), mostramos uma caixa explicando o que
     fica pior/faltando no site se essa etapa não for preenchida agora —
     e deixa a pessoa decidir: voltar e preencher, ou seguir mesmo assim. */
  function confirmProceed(title, bodyHtml, confirmLabel) {
    return new Promise(resolve => {
      document.getElementById('wiz-confirm-modal')?.remove();
      const wrap = document.createElement('div');
      wrap.id = 'wiz-confirm-modal';
      wrap.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:1rem;';
      wrap.innerHTML = `
        <div style="background:var(--bg-secondary,#fff);color:var(--text-primary,#1e293b);border-radius:16px;width:100%;max-width:440px;box-shadow:0 8px 40px rgba(0,0,0,.3);overflow:hidden;">
          <div style="padding:1.1rem 1.3rem;background:linear-gradient(135deg,#f59e0b,#ea580c);color:#fff;display:flex;align-items:center;gap:.6rem;">
            <i class="fas fa-triangle-exclamation" style="font-size:1.1rem;"></i>
            <h3 style="margin:0;font-size:.98rem;">${esc(title)}</h3>
          </div>
          <div style="padding:1.2rem 1.3rem;font-size:.85rem;line-height:1.55;color:var(--text-secondary,#475569);">${bodyHtml}</div>
          <div style="padding:0 1.3rem 1.2rem;display:flex;gap:.6rem;justify-content:flex-end;">
            <button id="wiz-confirm-back" style="padding:.55rem 1rem;border-radius:8px;border:1px solid var(--border,#e2e8f0);background:transparent;color:inherit;cursor:pointer;font-size:.83rem;">Voltar e preencher</button>
            <button id="wiz-confirm-go" style="padding:.55rem 1.1rem;border-radius:8px;border:none;background:#ea580c;color:#fff;cursor:pointer;font-size:.83rem;font-weight:600;">${esc(confirmLabel || 'Continuar mesmo assim')}</button>
          </div>
        </div>`;
      document.body.appendChild(wrap);
      wrap.querySelector('#wiz-confirm-back').addEventListener('click', () => { wrap.remove(); resolve(false); });
      wrap.querySelector('#wiz-confirm-go').addEventListener('click', () => { wrap.remove(); resolve(true); });
    });
  }

  function stepNeedsConfirmation(step) {
    const kind = kindOfStep(step);
    if (kind === 'grade') {
      return !wizardState.importedCurriculum.length;
    }
    if (kind === 'rotina') {
      return !(wizardState.touched && wizardState.touched[step]);
    }
    if (kind === 'materias') {
      const hasSubjects = document.querySelectorAll('#wiz-subjects-list .wiz-subject-item .wiz-subject-nome')
        && Array.from(document.querySelectorAll('#wiz-subjects-list .wiz-subject-nome')).some(i => i.value.trim());
      return !hasSubjects;
    }
    return false;
  }

  function confirmationContentFor(step) {
    const kind = kindOfStep(step);
    if (kind === 'grade') {
      return {
        title: 'Seguir sem importar a grade?',
        body: `<p>Sem a grade curricular, o site não sabe quais matérias você ainda vai cursar nem os pré-requisitos delas.</p>
               <p>Isso deixa mais fraco: o planejamento de semestres futuros, o mapa de progresso do curso e os alertas de pré-requisito. Você pode importar a qualquer momento depois em <strong>Grade Curricular</strong>.</p>`
      };
    }
    if (kind === 'rotina') {
      return {
        title: 'Seguir com a rotina padrão?',
        body: `<p>Você não ajustou nada nesta etapa — o site vai usar valores padrão (turno tarde, dias de seg a sex, 4h por dia) em vez da sua rotina real.</p>
               <p>Isso afeta diretamente o <strong>Mentor IA</strong> e o plano de estudos: os horários sugeridos podem não bater com quando você realmente pode estudar. Vale a pena ajustar agora — leva menos de 1 minuto.</p>`
      };
    }
    if (kind === 'materias') {
      return {
        title: 'Iniciar sem cadastrar nenhuma matéria?',
        body: `<p>Sem matérias cadastradas, o Dashboard, o Mentor IA e o plano de estudos ficam praticamente vazios — não há o que planejar ainda.</p>
               <p>Você pode adicionar manualmente, uma a uma, ou importar por print/PDF com IA agora mesmo.</p>`
      };
    }
    return { title: '', body: '' };
  }

  /* ─── Navegação ──────────────────────────────────────────── */
  async function goNext() {
    if (kindOfStep(wizardState.step) === 'quem' && !validateStepQuem()) return;
    saveCurrentStep();

    if (stepNeedsConfirmation(wizardState.step)) {
      const { title, body } = confirmationContentFor(wizardState.step);
      const proceed = await confirmProceed(title, body);
      if (!proceed) return;
    }

    wizardState.step++;
    saveDraft();
    renderWizard();
    window.scrollTo(0, 0);
  }

  function goBack() {
    if (wizardState.step <= 0) return;
    saveCurrentStep();
    wizardState.step--;
    saveDraft();
    renderWizard();
    window.scrollTo(0, 0);
  }

  function validateStepQuem() {
    const nome = q('#wiz-nome')?.value?.trim();
    if (!nome) { alert('Por favor, informe seu nome.'); q('#wiz-nome')?.focus(); return false; }

    if (wizardState.perfil === 'faculdade') {
      const curso = q('#wiz-curso')?.value?.trim();
      const semestre = q('#wiz-semestre')?.value;
      if (!curso) { alert('Por favor, informe seu curso.'); q('#wiz-curso')?.focus(); return false; }
      if (!semestre) { alert('Selecione o semestre atual.'); return false; }
    } else if (wizardState.perfil === 'concurso') {
      const concurso = q('#wiz-concurso')?.value?.trim();
      if (!concurso) { alert('Por favor, informe qual concurso você está estudando.'); q('#wiz-concurso')?.focus(); return false; }
    } else if (wizardState.perfil === 'ensino_medio') {
      const serie = q('#wiz-serie')?.value;
      if (!serie) { alert('Selecione sua série.'); return false; }
    }
    // perfil 'geral': só o nome é obrigatório
    return true;
  }

  function saveCurrentStep() {
    const step = wizardState.step;
    const kind = kindOfStep(step);

    if (kind === 'quem') {
      wizardState.nome = q('#wiz-nome')?.value?.trim() || '';
      if (wizardState.perfil === 'faculdade') {
        wizardState.universidade = q('#wiz-universidade')?.value?.trim() || '';
        wizardState.curso        = q('#wiz-curso')?.value?.trim() || '';
        wizardState.semestre     = q('#wiz-semestre')?.value || '';
      } else if (wizardState.perfil === 'concurso') {
        wizardState.concurso = q('#wiz-concurso')?.value?.trim() || '';
      } else if (wizardState.perfil === 'ensino_medio') {
        wizardState.serie      = q('#wiz-serie')?.value || '';
        wizardState.tipoEscola = q('#wiz-tipo-escola')?.value || 'regular';
      } else if (wizardState.perfil === 'geral') {
        wizardState.objetivo = q('#wiz-objetivo')?.value?.trim() || '';
      }
    }

    if (kind === 'grade') {
      // Coletar manual items
      const manualItems = [];
      document.querySelectorAll('#wiz-manual-items .wiz-subject-item').forEach(row => {
        const nome = row.querySelector('.wiz-manual-nome')?.value?.trim();
        if (!nome) return;
        manualItems.push({
          id: window.generateId ? window.generateId() : 'id_m_' + Date.now(),
          nome,
          semestre: parseInt(row.querySelector('.wiz-manual-sem')?.value || '0'),
          tipo: row.querySelector('.wiz-manual-tipo')?.value || 'obrigatoria',
          cargaHoraria: 60, creditos: 0, prerequisitos: [], status: 'nao-cursada'
        });
      });
      if (manualItems.length) {
        wizardState.importedCurriculum = [...wizardState.importedCurriculum, ...manualItems];
      }
    }

    if (kind === 'rotina') {
      wizardState.turno        = q('#wiz-turno')?.value || 'tarde';
      wizardState.horas        = parseInt(q('#wiz-horas')?.value || '4');
      wizardState.rotina       = q('#wiz-rotina')?.value || 'so-estuda';
      wizardState.deslocamento = parseInt(q('#wiz-deslocamento')?.value || '20');
      wizardState.sono         = formatTimeRange(q('#wiz-sono-inicio')?.value || '', q('#wiz-sono-fim')?.value || '');
      wizardState.dias         = Array.from(document.querySelectorAll('#wiz-days-group .wiz-day-btn.active'))
                                      .map(b => b.dataset.val);
    }

    if (kind === 'materias') {
      wizardState.disciplina  = q('#wiz-disciplina')?.value || 'medio';
      const dificuldadeRaw = q('#wiz-dificuldade')?.value || 'tempo';
      wizardState.dificuldade = dificuldadeRaw.split(',').map(v => v.trim()).filter(Boolean);
      // Coletar matérias
      wizardState.subjects = [];
      document.querySelectorAll('#wiz-subjects-list .wiz-subject-item').forEach(row => {
        const nome = row.querySelector('.wiz-subject-nome')?.value?.trim();
        if (!nome) return;
        wizardState.subjects.push({
          nome,
          // Dificuldade não é mais escolhida manualmente aqui — começa em um valor
          // neutro e o subject-difficulty.js recalcula automaticamente depois,
          // com base em tarefas, notas e frequência reais da matéria.
          dificuldade: 3,
          peso:        parseInt(row.querySelector('.wiz-subject-peso')?.value || '3'),
          notaDesejada: 7
        });
      });
    }
  }

  /* ─── Finalizar setup ─────────────────────────────────────── */
  async function finishSetup() {
    const lastStep = getTotalSteps();
    if (stepNeedsConfirmation(lastStep)) {
      const { title, body } = confirmationContentFor(lastStep);
      const proceed = await confirmProceed(title, body, 'Iniciar mesmo assim');
      if (!proceed) return;
    }

    saveCurrentStep();

    const btn = q('#wiz-btn-finish');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; }

    try {
      // Montar subjects (matérias do semestre)
      const subjects = wizardState.subjects
        .filter(s => s.nome)
        .map(s => ({
          id: window.generateId ? window.generateId() : 'id_' + Date.now() + Math.random(),
          nome: s.nome,
          dificuldade: s.dificuldade || 3,
          peso: s.peso || 3,
          notaDesejada: s.notaDesejada || 7
        }));

      // Montar curriculum normalizado
      const curriculum = wizardState.importedCurriculum.map(d => ({
        id: d.id || (window.generateId ? window.generateId() : 'id_c_' + Date.now()),
        nome: d.nome,
        codigo: d.codigo || '',
        semestre: String(d.semestre || '0'),
        cargaHoraria: d.cargaHoraria || 0,
        creditos: d.creditos || 0,
        prerequisitosLista: d.prerequisitos || [],
        tipo: d.tipo || 'obrigatoria',
        status: d.status || 'nao-cursada',
        observacoes: ''
      }));

      // Preenche curso/universidade com um equivalente por perfil, pra que
      // as telas existentes (que hoje mostram "curso"/"universidade") ainda
      // façam sentido pra quem não é da faculdade, sem precisar reescrever
      // cada tela agora.
      let cursoEquivalente = wizardState.curso || '';
      let instituicaoEquivalente = wizardState.universidade || '';
      if (wizardState.perfil === 'concurso') {
        cursoEquivalente = wizardState.concurso || 'Concurso Público';
        instituicaoEquivalente = 'Concurso';
      } else if (wizardState.perfil === 'ensino_medio') {
        const tipoLabel = (window.SLC_EnsinoMedio?.TIPOS_ESCOLA || []).find(t => t.valor === wizardState.tipoEscola)?.label || 'Ensino Médio';
        cursoEquivalente = `${wizardState.serie || ''}º ano — ${tipoLabel}`.replace(/^º ano — /, tipoLabel);
        instituicaoEquivalente = tipoLabel;
      } else if (wizardState.perfil === 'geral') {
        cursoEquivalente = wizardState.objetivo || 'Estudo Geral';
        instituicaoEquivalente = 'Estudo Pessoal';
      }

      const userData = {
        nome:             wizardState.nome || '',
        perfil:           wizardState.perfil || 'faculdade',
        curso:            cursoEquivalente,
        universidade:     instituicaoEquivalente,
        semestre:         wizardState.semestre || '',
        concurso:         wizardState.concurso || '',
        serie:            wizardState.serie || '',
        tipoEscola:       wizardState.tipoEscola || '',
        objetivo:         wizardState.objetivo || '',
        turnoPrincipal:   wizardState.turno || 'tarde',
        diasPreferidos:   wizardState.dias || ['seg','ter','qua','qui','sex'],
        horasMaximas:     wizardState.horas || 4,
        horarioSono:      wizardState.sono || '',
        tempoDeslocamento:wizardState.deslocamento || 20,
        tipoRotina:       wizardState.rotina || 'so-estuda',
        nivelDisciplina:  wizardState.disciplina || 'medio',
        // Array para suportar múltiplas dificuldades selecionadas.
        dificuldadeAtual: (Array.isArray(wizardState.dificuldade) && wizardState.dificuldade.length)
          ? wizardState.dificuldade
          : ['tempo'],
        createdAt:        new Date().toISOString(),
        streak:           0,
        lastStudyDate:    null
      };

      // Injetar no app
      if (window.app) {
        window.app.data = window.app.data || {};
        window.app.data.user     = userData;
        window.app.data.subjects = subjects;
        window.app.data.curriculum = curriculum;
        window.app.data.classSchedule = window.app.data.classSchedule || [];
      }

      // Usar o handleSetupSubmit original via evento sintético se disponível
      if (window.app && typeof window.app.handleSetupSubmit === 'function') {
        // Preencher campos hidden do form original para compatibilidade
        _fillOriginalFormFields(userData, subjects);
      }

      // Salvar via dbService
      if (window.dbService && typeof window.dbService.saveAllData === 'function') {
        await window.dbService.saveAllData({ user: userData, subjects, curriculum, classSchedule: [] });
      }

      if (window.app && typeof window.app.ensurePostSetupReady === 'function') {
        await window.app.ensurePostSetupReady();
      }

      if (window.showToast) window.showToast('Configuração concluída! Bem-vindo(a)! 🚀');
      clearDraft();

    } catch (err) {
      console.error('[setup-wizard] Erro ao finalizar:', err);
      if (window.showToast) window.showToast('Erro ao salvar. Tente novamente.', 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-rocket"></i> Iniciar Jornada'; }
    }
  }

  function _fillOriginalFormFields(userData, subjects) {
    // Compatibilidade: preencher campos do form original que o app.js usa
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    set('nome', userData.nome);
    set('curso', userData.curso);
    set('universidade', userData.universidade);
    set('semestre', userData.semestre);
    set('turno-principal', userData.turnoPrincipal);
    set('horas-maximas', userData.horasMaximas);
    set('horario-sono', userData.horarioSono);
    set('tempo-deslocamento', userData.tempoDeslocamento);
    set('tipo-rotina', userData.tipoRotina);
    set('nivel-disciplina', userData.nivelDisciplina);
    // Campo legado é um <select> de opção única — usamos a primeira
    // dificuldade escolhida só para manter esse campo de compatibilidade
    // preenchido; o valor completo (array) vai em userData.dificuldadeAtual.
    set('dificuldade-atual', Array.isArray(userData.dificuldadeAtual) ? userData.dificuldadeAtual[0] : userData.dificuldadeAtual);
  }

  /* ─── Utilitário de feedback ─────────────────────────────── */
  function showFeedback(el, type, msg) {
    if (!el) return;
    el.className = `wiz-feedback ${type}`;
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { if (type !== 'error') el.style.display = 'none'; }, 5000);
  }

  /* ─── Inicialização ──────────────────────────────────────── */
  function init() {
    injectStyles();
    const restored = loadDraft();
    renderWizard();
    _wizardBootedInSession = true;
    if (restored && window.showToast) {
      window.showToast('Continuando de onde você parou 👍', 'success');
    }
  }

  /* Aguardar o setup-screen aparecer */
  function waitForSetup() {
    const screen = document.getElementById('setup-screen');
    if (!screen) {
      setTimeout(waitForSetup, 100);
      return;
    }

    // Observar quando o setup-screen ficar visível
    const observer = new MutationObserver(() => {
      const visible = screen.style.display !== 'none' && !screen.classList.contains('hidden');
      if (visible && !document.getElementById('slc-wizard')) {
        init();
      }
    });
    observer.observe(screen, { attributes: true, attributeFilter: ['style', 'class'] });

    // Se já estiver visível
    if (screen.style.display !== 'none') init();
  }

  // Também fazer patch do renderSetupForm para garantir que o wizard substitua
  const _origRenderSetup = window.StudyLifeControl?.prototype?.renderSetupForm;
  if (window.StudyLifeControl) {
    window.StudyLifeControl.prototype.renderSetupForm = function(...args) {
      // Chamar original para manter compatibilidade de estado interno
      if (_origRenderSetup) _origRenderSetup.apply(this, args);
      // Iniciar wizard
      setTimeout(() => { if (!document.getElementById('slc-wizard')) init(); }, 50);
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForSetup);
  } else {
    waitForSetup();
  }

})();
