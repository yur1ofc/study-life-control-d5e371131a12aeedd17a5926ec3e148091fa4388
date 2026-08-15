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
  const TOTAL_STEPS = 4;
  const STEP_LABELS = [
    'Quem é você',
    'Grade Curricular',
    'Sua Rotina',
    'Matérias & Perfil'
  ];

  /* ─── Estado do wizard ───────────────────────────────────── */
  let wizardState = {
    step: 1,
    importedCurriculum: [],  // disciplinas importadas da grade
    subjects: [],            // matérias do semestre atual
    semestre: ''
  };

  /* ─── Utilitários ─────────────────────────────────────────── */
  function esc(v) {
    return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function q(sel) { return document.querySelector(sel); }

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
.wiz-logo { font-size: 1.1rem; font-weight: 800; color: var(--accent-primary); white-space: nowrap; }
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

/* ── Footer sticky ── */
.wiz-footer {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border);
  padding: 14px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 100;
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

  function renderStep1() {
    return `
<div class="wiz-card" id="wiz-step-1">
  <div class="wiz-card-title">👋 Olá! Vamos começar</div>
  <div class="wiz-card-sub">Informações básicas para personalizar tudo para você</div>

  <div class="wiz-field">
    <label>Seu nome</label>
    <input type="text" id="wiz-nome" placeholder="Como quer ser chamado?" autocomplete="given-name">
  </div>

  <div class="wiz-row">
    <div class="wiz-field">
      <label>Universidade</label>
      <input type="text" id="wiz-universidade" placeholder="Ex: UFOB, USP, UFMG...">
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

  function renderStep2() {
    const faculdade = q('#wiz-universidade')?.value?.trim() || '';
    const curso = q('#wiz-curso')?.value?.trim() || '';
    const prompt = buildAIPrompt(faculdade, curso);
    const hasCurriculum = wizardState.importedCurriculum.length > 0;

    return `
<div class="wiz-card" id="wiz-step-2">
  <div class="wiz-card-title">📚 Grade Curricular</div>
  <button id="wiz-buscar-grade-pronta" style="
    width:100%;display:flex;align-items:center;justify-content:center;gap:10px;
    padding:12px 16px;border-radius:var(--radius-md);border:1.5px dashed var(--accent-primary);
    background:rgba(59,130,246,.06);color:var(--accent-primary);cursor:pointer;
    font-size:13px;font-weight:500;font-family:inherit;margin-bottom:16px;
    transition:background .15s;
  " onmouseover="this.style.background='rgba(59,130,246,.12)'" onmouseout="this.style.background='rgba(59,130,246,.06)'">
    <i class="fas fa-search"></i> Buscar grade pronta da comunidade
  </button>
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
    <div style="flex:1;height:1px;background:var(--border);"></div>
    <span style="font-size:11px;color:var(--text-tertiary);">ou importe manualmente abaixo</span>
    <div style="flex:1;height:1px;background:var(--border);"></div>
  </div>
  <div class="wiz-card-sub">Importe todas as disciplinas do seu curso de uma vez. Você pode pular e fazer depois.</div>

  <div class="wiz-import-tabs">
    <button class="wiz-tab active" data-tab="ia">📷 Via IA (PDF/Foto)</button>
    <button class="wiz-tab" data-tab="texto">📋 Colar Texto</button>
    <button class="wiz-tab" data-tab="manual">✏️ Manual</button>
  </div>

  <!-- Tab: IA (PDF/Foto) -->
  <div class="wiz-tab-panel active" id="wiz-tab-ia">
    <div class="wiz-ai-box">
      <h4>🤖 Use ChatGPT ou Claude para ler o PDF/foto</h4>
      <p>O sistema não tem como acessar o site da sua faculdade diretamente, mas você pode usar uma IA gratuita em 3 passos simples:</p>
      <div class="wiz-ai-steps">
        <div class="wiz-ai-step">
          <div class="wiz-ai-step-num">1</div>
          <div class="wiz-ai-step-text">
            <strong>Copie o prompt abaixo</strong> — ele instrui a IA a gerar o JSON no formato certo
          </div>
        </div>
        <div class="wiz-ai-step">
          <div class="wiz-ai-step-num">2</div>
          <div class="wiz-ai-step-text">
            <strong>Abra o ChatGPT ou Claude</strong>, cole o prompt e <strong>anexe o PDF ou a foto</strong> da grade curricular da sua faculdade
          </div>
        </div>
        <div class="wiz-ai-step">
          <div class="wiz-ai-step-num">3</div>
          <div class="wiz-ai-step-text">
            <strong>Copie o JSON</strong> que a IA gerou e cole no campo abaixo
          </div>
        </div>
      </div>

      <button class="wiz-copy-prompt-btn" id="wiz-copy-prompt-btn">
        <i class="fas fa-copy"></i> Copiar Prompt
      </button>

      <span class="wiz-prompt-toggle" id="wiz-prompt-toggle">▼ Ver prompt completo</span>
      <pre class="wiz-prompt-preview" id="wiz-prompt-preview">${esc(prompt)}</pre>

      <div class="wiz-open-ai-btns">
        <a class="wiz-open-ai-btn" href="https://chat.openai.com" target="_blank" rel="noopener">
          <i class="fas fa-external-link-alt"></i> Abrir ChatGPT
        </a>
        <a class="wiz-open-ai-btn" href="https://claude.ai" target="_blank" rel="noopener">
          <i class="fas fa-external-link-alt"></i> Abrir Claude
        </a>
      </div>
    </div>

    <label style="display:block;font-size:.88rem;font-weight:600;color:var(--text-secondary);margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em;">
      Cole o JSON aqui
    </label>
    <textarea class="wiz-json-area" id="wiz-json-input" placeholder='{"faculdade":"...","disciplinas":[...]}'></textarea>
    <div style="display:flex;gap:8px;align-items:center;">
      <button class="wiz-import-json-btn" id="wiz-import-json-btn">
        <i class="fas fa-file-import"></i> Importar Grade
      </button>
      <span class="wiz-feedback" id="wiz-json-feedback"></span>
    </div>
  </div>

  <!-- Tab: Texto -->
  <div class="wiz-tab-panel" id="wiz-tab-texto">
    <div class="wiz-ai-box">
      <h4>📋 Cole o texto do site da faculdade</h4>
      <p>Abra o site da sua faculdade, copie o texto da página de grade curricular (Ctrl+A → Ctrl+C) e cole aqui. A IA irá extrair as disciplinas.</p>
      <div class="wiz-ai-steps">
        <div class="wiz-ai-step">
          <div class="wiz-ai-step-num">1</div>
          <div class="wiz-ai-step-text"><strong>Acesse a página da grade</strong> no site da sua faculdade</div>
        </div>
        <div class="wiz-ai-step">
          <div class="wiz-ai-step-num">2</div>
          <div class="wiz-ai-step-text"><strong>Selecione tudo (Ctrl+A)</strong> e copie (Ctrl+C)</div>
        </div>
        <div class="wiz-ai-step">
          <div class="wiz-ai-step-num">3</div>
          <div class="wiz-ai-step-text"><strong>Cole abaixo</strong> — o sistema vai tentar identificar as disciplinas automaticamente</div>
        </div>
      </div>
    </div>
    <label style="display:block;font-size:.88rem;font-weight:600;color:var(--text-secondary);margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em;">
      Texto copiado do site
    </label>
    <textarea class="wiz-json-area" id="wiz-text-input" placeholder="Cole aqui o texto do site da faculdade..." style="min-height:160px;font-family:inherit;font-size:.88rem;"></textarea>
    <div style="display:flex;gap:8px;align-items:center;margin-top:8px;">
      <button class="wiz-import-json-btn" id="wiz-import-text-btn" style="background:var(--accent-secondary);">
        <i class="fas fa-magic"></i> Extrair Disciplinas do Texto
      </button>
    </div>
    <span class="wiz-feedback" id="wiz-text-feedback" style="display:none;margin-top:8px;"></span>
  </div>

  <!-- Tab: Manual -->
  <div class="wiz-tab-panel" id="wiz-tab-manual">
    <p style="font-size:.9rem;color:var(--text-secondary);margin-bottom:16px;">
      Adicione as disciplinas uma a uma. Você pode completar ou editar a lista depois em <strong>Grade Curricular</strong>.
    </p>
    <div id="wiz-manual-items"></div>
    <button class="wiz-add-subject-btn" id="wiz-add-manual-btn">
      <i class="fas fa-plus"></i> Adicionar Disciplina
    </button>
  </div>

  <!-- Preview do que foi importado -->
  ${hasCurriculum ? renderCurriculumPreview() : '<div id="wiz-curr-preview-slot"></div>'}
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
      <input type="text" id="wiz-sono" placeholder="Ex: 00:00 - 07:00">
    </div>
  </div>
</div>`;
  }

  function renderStep4() {
    const semestre = wizardState.semestre || q('#wiz-semestre')?.value || '';
    const autoSubjects = wizardState.importedCurriculum
      .filter(d => String(d.semestre) === String(semestre))
      .slice(0, 10);

    // Pre-populate se tiver dados da grade importada
    if (autoSubjects.length && !wizardState.subjects.length) {
      wizardState.subjects = autoSubjects.map(d => ({
        nome: d.nome,
        dificuldade: 3,
        peso: 3,
        notaDesejada: 7
      }));
    }

    const subjects = wizardState.subjects.length ? wizardState.subjects : [{ nome:'', dificuldade:3, peso:3, notaDesejada:7 }];

    return `
<div class="wiz-card" id="wiz-step-4">
  <div class="wiz-card-title">🎯 Perfil & Matérias</div>
  <div class="wiz-card-sub">
    Matérias do <strong>${semestre ? semestre+'º' : 'seu'} semestre</strong>
    ${autoSubjects.length ? `— <span style="color:var(--accent-success)">${autoSubjects.length} pré-preenchidas da grade importada ✓</span>` : '— adicione as que você está cursando agora'}
  </div>

  <div id="wiz-subjects-list">
    ${subjects.map((s, i) => renderSubjectRow(s, i)).join('')}
  </div>
  <button class="wiz-add-subject-btn" id="wiz-add-subject-btn" type="button">
    <i class="fas fa-plus"></i> Adicionar Matéria
  </button>

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
      <label>Maior dificuldade agora</label>
      <div class="wiz-radio-group" id="wiz-dificuldade-group">
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
  <select class="wiz-subject-diff" title="Dificuldade (1=fácil, 5=muito difícil)">
    ${[1,2,3,4,5].map(n => `<option value="${n}" ${n===(subject.dificuldade||3)?'selected':''}>Dif ${n}</option>`).join('')}
  </select>
  <select class="wiz-subject-peso" title="Peso na grade">
    ${[1,2,3,4,5].map(n => `<option value="${n}" ${n===(subject.peso||3)?'selected':''}>Peso ${n}</option>`).join('')}
  </select>
  <button class="btn-remove" type="button" title="Remover"><i class="fas fa-times"></i></button>
</div>`;
  }

  /* ─── Render do wizard completo ───────────────────────────── */
  function renderWizard() {
    const step = wizardState.step;
    let bodyContent = '';
    if (step === 1) bodyContent = renderStep1();
    else if (step === 2) bodyContent = renderStep2();
    else if (step === 3) bodyContent = renderStep3();
    else if (step === 4) bodyContent = renderStep4();

    const html = `
<div id="slc-wizard">
  <div class="wiz-topbar">
    <div class="wiz-logo"><i class="fas fa-brain"></i> SLC</div>
    <div class="wiz-steps">
      ${[1,2,3,4].map(n => {
        let cls = '';
        if (n < step) cls = 'done';
        else if (n === step) cls = 'active';
        return `<div class="wiz-step-dot ${cls}"></div>`;
      }).join('')}
    </div>
    <div class="wiz-step-label">Passo ${step} de ${TOTAL_STEPS} — ${STEP_LABELS[step-1]}</div>
  </div>
  <div class="wiz-body">${bodyContent}</div>
  <div class="wiz-footer">
    <div class="wiz-footer-info">
      ${step > 1 ? `<button class="wiz-btn-back" id="wiz-btn-back">← Voltar</button>` : ''}
      ${step === 2 ? `<span class="wiz-skip" id="wiz-skip-step">Pular esta etapa</span>` : ''}
    </div>
    <div class="wiz-footer-btns">
      ${step < TOTAL_STEPS
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
    if (step === 1) {
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
    if (step === 3) {
      if (wizardState.turno) {
        q('#wiz-turno').value = wizardState.turno;
        document.querySelectorAll('#wiz-turno-group .wiz-radio-card').forEach(c => {
          c.classList.toggle('active', c.dataset.val === wizardState.turno);
        });
      }
      if (wizardState.horas)       { const el = q('#wiz-horas'); if(el) el.value = wizardState.horas; }
      if (wizardState.rotina)      { const el = q('#wiz-rotina'); if(el) el.value = wizardState.rotina; }
      if (wizardState.deslocamento) { const el = q('#wiz-deslocamento'); if(el) el.value = wizardState.deslocamento; }
      if (wizardState.sono)        { const el = q('#wiz-sono'); if(el) el.value = wizardState.sono; }
      if (wizardState.dias) {
        document.querySelectorAll('#wiz-days-group .wiz-day-btn').forEach(b => {
          b.classList.toggle('active', wizardState.dias.includes(b.dataset.val));
        });
      }
    }
    if (step === 4) {
      if (wizardState.disciplina) {
        q('#wiz-disciplina').value = wizardState.disciplina;
        document.querySelectorAll('#wiz-disciplina-group .wiz-radio-card').forEach(c => {
          c.classList.toggle('active', c.dataset.val === wizardState.disciplina);
        });
      }
      if (wizardState.dificuldade) {
        q('#wiz-dificuldade').value = wizardState.dificuldade;
        document.querySelectorAll('#wiz-dificuldade-group .wiz-radio-card').forEach(c => {
          c.classList.toggle('active', c.dataset.val === wizardState.dificuldade);
        });
      }
    }
  }

  /* ─── Eventos de cada etapa ──────────────────────────────── */
  function attachEvents(step) {
    // Radio cards genérico
    document.querySelectorAll('.wiz-radio-group').forEach(group => {
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
        });
      });
    });

    // Dias da semana toggle
    document.querySelectorAll('#wiz-days-group .wiz-day-btn').forEach(btn => {
      btn.addEventListener('click', () => btn.classList.toggle('active'));
    });

    // Navegação
    q('#wiz-btn-next')?.addEventListener('click', () => goNext());
    q('#wiz-btn-finish')?.addEventListener('click', () => finishSetup());
    q('#wiz-btn-back')?.addEventListener('click', () => goBack());
    q('#wiz-skip-step')?.addEventListener('click', () => { wizardState.step++; renderWizard(); });

    // Etapa 2: tabs
    if (step === 2) {
      document.querySelectorAll('.wiz-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          document.querySelectorAll('.wiz-tab').forEach(t => t.classList.remove('active'));
          document.querySelectorAll('.wiz-tab-panel').forEach(p => p.classList.remove('active'));
          tab.classList.add('active');
          const panel = document.getElementById(`wiz-tab-${tab.dataset.tab}`);
          if (panel) panel.classList.add('active');
        });
      });

      // Copiar prompt
      q('#wiz-copy-prompt-btn')?.addEventListener('click', () => {
        const faculdade = wizardState.universidade || '';
        const curso = wizardState.curso || '';
        const prompt = buildAIPrompt(faculdade, curso);
        navigator.clipboard.writeText(prompt).then(() => {
          const btn = q('#wiz-copy-prompt-btn');
          if (btn) { btn.innerHTML = '<i class="fas fa-check"></i> Copiado!'; setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy"></i> Copiar Prompt'; }, 2500); }
        });
      });

      // Toggle prompt preview
      q('#wiz-prompt-toggle')?.addEventListener('click', () => {
        const preview = q('#wiz-prompt-preview');
        if (!preview) return;
        const visible = preview.style.display !== 'none' && preview.style.display !== '';
        preview.style.display = visible ? 'none' : 'block';
        q('#wiz-prompt-toggle').textContent = visible ? '▼ Ver prompt completo' : '▲ Ocultar prompt';
      });

      // Importar JSON
      q('#wiz-import-json-btn')?.addEventListener('click', () => {
        const raw = q('#wiz-json-input')?.value?.trim();
        const feedback = q('#wiz-json-feedback');
        if (!raw) { showFeedback(feedback, 'error', 'Cole o JSON no campo acima primeiro.'); return; }
        try {
          const parsed = parseGradeJSON(raw);
          if (!parsed.length) throw new Error('Nenhuma disciplina encontrada no JSON.');
          wizardState.importedCurriculum = parsed;
          showFeedback(feedback, 'success', `✓ ${parsed.length} disciplinas importadas com sucesso!`);
          updateCurriculumPreview();
        } catch (e) {
          showFeedback(feedback, 'error', 'JSON inválido ou formato inesperado. Verifique se a IA retornou corretamente.');
        }
      });

      // Importar Texto
      q('#wiz-import-text-btn')?.addEventListener('click', () => {
        const text = q('#wiz-text-input')?.value?.trim();
        const feedback = q('#wiz-text-feedback');
        if (!text) { showFeedback(feedback, 'error', 'Cole o texto acima primeiro.'); return; }
        const parsed = parseGradeText(text);
        if (!parsed.length) {
          showFeedback(feedback, 'error', 'Não consegui identificar disciplinas. Tente o método via IA (PDF/foto) que funciona melhor.');
          return;
        }
        wizardState.importedCurriculum = [...wizardState.importedCurriculum, ...parsed];
        showFeedback(feedback, 'success', `✓ ${parsed.length} disciplinas identificadas! Para melhor resultado, use o método via IA com o PDF.`);
        updateCurriculumPreview();
      });

      // Manual add
      q('#wiz-add-manual-btn')?.addEventListener('click', () => addManualItem());
      attachManualEvents();
    }

    // Etapa 4: subjects
    if (step === 4) {
      q('#wiz-add-subject-btn')?.addEventListener('click', () => {
        wizardState.subjects.push({ nome: '', dificuldade: 3, peso: 3, notaDesejada: 7 });
        refreshSubjectsList();
      });
      attachSubjectEvents();
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

  /* ─── Navegação ──────────────────────────────────────────── */
  function goNext() {
    if (wizardState.step === 1 && !validateStep1()) return;
    saveCurrentStep();
    wizardState.step++;
    renderWizard();
    window.scrollTo(0, 0);
  }

  function goBack() {
    if (wizardState.step <= 1) return;
    saveCurrentStep();
    wizardState.step--;
    renderWizard();
    window.scrollTo(0, 0);
  }

  function validateStep1() {
    const nome = q('#wiz-nome')?.value?.trim();
    const curso = q('#wiz-curso')?.value?.trim();
    const semestre = q('#wiz-semestre')?.value;
    if (!nome) { alert('Por favor, informe seu nome.'); q('#wiz-nome')?.focus(); return false; }
    if (!curso) { alert('Por favor, informe seu curso.'); q('#wiz-curso')?.focus(); return false; }
    if (!semestre) { alert('Selecione o semestre atual.'); return false; }
    return true;
  }

  function saveCurrentStep() {
    const step = wizardState.step;
    if (step === 1) {
      wizardState.nome         = q('#wiz-nome')?.value?.trim() || '';
      wizardState.universidade = q('#wiz-universidade')?.value?.trim() || '';
      wizardState.curso        = q('#wiz-curso')?.value?.trim() || '';
      wizardState.semestre     = q('#wiz-semestre')?.value || '';
    }
    if (step === 2) {
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
    if (step === 3) {
      wizardState.turno        = q('#wiz-turno')?.value || 'tarde';
      wizardState.horas        = parseInt(q('#wiz-horas')?.value || '4');
      wizardState.rotina       = q('#wiz-rotina')?.value || 'so-estuda';
      wizardState.deslocamento = parseInt(q('#wiz-deslocamento')?.value || '20');
      wizardState.sono         = q('#wiz-sono')?.value?.trim() || '';
      wizardState.dias         = Array.from(document.querySelectorAll('#wiz-days-group .wiz-day-btn.active'))
                                      .map(b => b.dataset.val);
    }
    if (step === 4) {
      wizardState.disciplina  = q('#wiz-disciplina')?.value || 'medio';
      wizardState.dificuldade = q('#wiz-dificuldade')?.value || 'tempo';
      // Coletar matérias
      wizardState.subjects = [];
      document.querySelectorAll('#wiz-subjects-list .wiz-subject-item').forEach(row => {
        const nome = row.querySelector('.wiz-subject-nome')?.value?.trim();
        if (!nome) return;
        wizardState.subjects.push({
          nome,
          dificuldade: parseInt(row.querySelector('.wiz-subject-diff')?.value || '3'),
          peso:        parseInt(row.querySelector('.wiz-subject-peso')?.value || '3'),
          notaDesejada: 7
        });
      });
    }
  }

  /* ─── Finalizar setup ─────────────────────────────────────── */
  async function finishSetup() {
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

      const userData = {
        nome:             wizardState.nome || '',
        curso:            wizardState.curso || '',
        universidade:     wizardState.universidade || '',
        semestre:         wizardState.semestre || '',
        turnoPrincipal:   wizardState.turno || 'tarde',
        diasPreferidos:   wizardState.dias || ['seg','ter','qua','qui','sex'],
        horasMaximas:     wizardState.horas || 4,
        horarioSono:      wizardState.sono || '',
        tempoDeslocamento:wizardState.deslocamento || 20,
        tipoRotina:       wizardState.rotina || 'so-estuda',
        nivelDisciplina:  wizardState.disciplina || 'medio',
        dificuldadeAtual: wizardState.dificuldade || 'tempo',
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
    set('dificuldade-atual', userData.dificuldadeAtual);
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
    renderWizard();
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
