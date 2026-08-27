// theme-engine.js — Motor de personalização de tema completo
(function () {
  'use strict';

  const STORAGE_KEY = 'slc-theme-config';

  // ── Presets de tema ────────────────────────────────────────────────────────
  const PRESETS = {
    dark: {
      label: 'Escuro (padrão)', icon: '🌑',
      vars: {
        '--bg-primary':    '#0a0f1f',
        '--bg-secondary':  '#151f2f',
        '--bg-tertiary':   '#1e2b3a',
        '--accent-primary':'#3b82f6',
        '--accent-secondary':'#8b5cf6',
        '--accent-success':'#10b981',
        '--accent-warning':'#f59e0b',
        '--accent-danger': '#ef4444',
        '--text-primary':  '#f8fafc',
        '--text-secondary':'#94a3b8',
        '--text-tertiary': '#64748b',
        '--border':        '#2d3a4f',
        '--font-size-base':'15px',
        '--radius-lg':     '24px',
        '--radius-md':     '16px',
        '--radius-sm':     '12px',
      }
    },
    light: {
      label: 'Claro', icon: '☀️',
      vars: {
        '--bg-primary':    '#f0f4f8',
        '--bg-secondary':  '#ffffff',
        '--bg-tertiary':   '#e8edf3',
        '--accent-primary':'#2563eb',
        '--accent-secondary':'#7c3aed',
        '--accent-success':'#059669',
        '--accent-warning':'#d97706',
        '--accent-danger': '#dc2626',
        '--text-primary':  '#0f172a',
        '--text-secondary':'#475569',
        '--text-tertiary': '#94a3b8',
        '--border':        '#cbd5e1',
        '--font-size-base':'15px',
        '--radius-lg':     '24px',
        '--radius-md':     '16px',
        '--radius-sm':     '12px',
      }
    },
    midnight: {
      label: 'Midnight Blue', icon: '🌊',
      vars: {
        '--bg-primary':    '#060d1a',
        '--bg-secondary':  '#0d1b2e',
        '--bg-tertiary':   '#142338',
        '--accent-primary':'#38bdf8',
        '--accent-secondary':'#818cf8',
        '--accent-success':'#34d399',
        '--accent-warning':'#fbbf24',
        '--accent-danger': '#f87171',
        '--text-primary':  '#e0f2fe',
        '--text-secondary':'#7dd3fc',
        '--text-tertiary': '#38bdf8',
        '--border':        '#1e3a5f',
        '--font-size-base':'15px',
        '--radius-lg':     '24px',
        '--radius-md':     '16px',
        '--radius-sm':     '12px',
      }
    },
    forest: {
      label: 'Floresta', icon: '🌿',
      vars: {
        '--bg-primary':    '#0a1a0f',
        '--bg-secondary':  '#112318',
        '--bg-tertiary':   '#1a3324',
        '--accent-primary':'#4ade80',
        '--accent-secondary':'#a3e635',
        '--accent-success':'#86efac',
        '--accent-warning':'#fde68a',
        '--accent-danger': '#fca5a5',
        '--text-primary':  '#f0fdf4',
        '--text-secondary':'#86efac',
        '--text-tertiary': '#4ade80',
        '--border':        '#1f4428',
        '--font-size-base':'15px',
        '--radius-lg':     '24px',
        '--radius-md':     '16px',
        '--radius-sm':     '12px',
      }
    },
    rose: {
      label: 'Rose Gold', icon: '🌸',
      vars: {
        '--bg-primary':    '#1a0f14',
        '--bg-secondary':  '#2a1520',
        '--bg-tertiary':   '#3d1f2e',
        '--accent-primary':'#fb7185',
        '--accent-secondary':'#f472b6',
        '--accent-success':'#34d399',
        '--accent-warning':'#fbbf24',
        '--accent-danger': '#f87171',
        '--text-primary':  '#fff1f2',
        '--text-secondary':'#fda4af',
        '--text-tertiary': '#fb7185',
        '--border':        '#4d2235',
        '--font-size-base':'15px',
        '--radius-lg':     '24px',
        '--radius-md':     '16px',
        '--radius-sm':     '12px',
      }
    },
    slate: {
      label: 'Slate Pro', icon: '🪨',
      vars: {
        '--bg-primary':    '#f8fafc',
        '--bg-secondary':  '#ffffff',
        '--bg-tertiary':   '#f1f5f9',
        '--accent-primary':'#0f172a',
        '--accent-secondary':'#334155',
        '--accent-success':'#059669',
        '--accent-warning':'#d97706',
        '--accent-danger': '#dc2626',
        '--text-primary':  '#0f172a',
        '--text-secondary':'#475569',
        '--text-tertiary': '#94a3b8',
        '--border':        '#e2e8f0',
        '--font-size-base':'15px',
        '--radius-lg':     '8px',
        '--radius-md':     '6px',
        '--radius-sm':     '4px',
      }
    },
    allblack: {
      label: 'All Black', icon: '⚫',
      vars: {
        '--bg-primary':    '#000000',
        '--bg-secondary':  '#0a0a0a',
        '--bg-tertiary':   '#141414',
        '--accent-primary':'#ffffff',
        '--accent-secondary':'#a3a3a3',
        '--accent-success':'#22c55e',
        '--accent-warning':'#eab308',
        '--accent-danger': '#ef4444',
        '--text-primary':  '#f5f5f5',
        '--text-secondary':'#a3a3a3',
        '--text-tertiary': '#525252',
        '--border':        '#262626',
        '--font-size-base':'15px',
        '--radius-lg':     '18px',
        '--radius-md':     '12px',
        '--radius-sm':     '8px',
      }
    },
    madeira: {
      label: 'Madeira', icon: '🪵',
      vars: {
        '--bg-primary':    '#1c140d',
        '--bg-secondary':  '#2a1e14',
        '--bg-tertiary':   '#3a2a1a',
        '--accent-primary':'#c17a45',
        '--accent-secondary':'#d9a066',
        '--accent-success':'#84a865',
        '--accent-warning':'#e0a336',
        '--accent-danger': '#c2593f',
        '--text-primary':  '#f3e6d8',
        '--text-secondary':'#c9ab8c',
        '--text-tertiary': '#8a6f56',
        '--border':        '#4a3624',
        '--font-size-base':'15px',
        '--radius-lg':     '16px',
        '--radius-md':     '10px',
        '--radius-sm':     '6px',
      }
    },
    nord: {
      label: 'Nord Minimalista', icon: '🧊',
      vars: {
        '--bg-primary':    '#e5e9f0',
        '--bg-secondary':  '#f8f9fb',
        '--bg-tertiary':   '#eceff4',
        '--accent-primary':'#5e81ac',
        '--accent-secondary':'#81a1c1',
        '--accent-success':'#8fbcbb',
        '--accent-warning':'#d08770',
        '--accent-danger': '#bf616a',
        '--text-primary':  '#2e3440',
        '--text-secondary':'#4c566a',
        '--text-tertiary': '#8a94a6',
        '--border':        '#d8dee9',
        '--font-size-base':'15px',
        '--radius-lg':     '10px',
        '--radius-md':     '8px',
        '--radius-sm':     '6px',
      }
    },
    lavanda: {
      label: 'Lavanda Suave', icon: '💜',
      vars: {
        '--bg-primary':    '#1c1826',
        '--bg-secondary':  '#272037',
        '--bg-tertiary':   '#342b4a',
        '--accent-primary':'#c4b5fd',
        '--accent-secondary':'#a78bfa',
        '--accent-success':'#86efac',
        '--accent-warning':'#fde68a',
        '--accent-danger': '#fca5a5',
        '--text-primary':  '#f3f0fb',
        '--text-secondary':'#c9bfe6',
        '--text-tertiary': '#9083b8',
        '--border':        '#453a63',
        '--font-size-base':'15px',
        '--radius-lg':     '26px',
        '--radius-md':     '18px',
        '--radius-sm':     '14px',
      }
    },
    neon: {
      label: 'Cyberpunk Neon', icon: '🌆',
      vars: {
        '--bg-primary':    '#08060f',
        '--bg-secondary':  '#12081f',
        '--bg-tertiary':   '#1c0f2e',
        '--accent-primary':'#ff2fd6',
        '--accent-secondary':'#00e5ff',
        '--accent-success':'#39ff9c',
        '--accent-warning':'#ffe14d',
        '--accent-danger': '#ff4d6d',
        '--text-primary':  '#f2e9ff',
        '--text-secondary':'#c084fc',
        '--text-tertiary': '#7c3aed',
        '--border':        '#3a1f5c',
        '--font-size-base':'15px',
        '--radius-lg':     '14px',
        '--radius-md':     '10px',
        '--radius-sm':     '6px',
      }
    },
    terracota: {
      label: 'Café & Terracota', icon: '☕',
      vars: {
        '--bg-primary':    '#fbf3ec',
        '--bg-secondary':  '#ffffff',
        '--bg-tertiary':   '#f3e4d7',
        '--accent-primary':'#b5563c',
        '--accent-secondary':'#d98454',
        '--accent-success':'#7a9161',
        '--accent-warning':'#c98a2c',
        '--accent-danger': '#b3402e',
        '--text-primary':  '#3a2a20',
        '--text-secondary':'#7a6350',
        '--text-tertiary': '#a8917e',
        '--border':        '#e6d3c1',
        '--font-size-base':'15px',
        '--radius-lg':     '20px',
        '--radius-md':     '14px',
        '--radius-sm':     '10px',
      }
    },
  };

  // ── Carrega / salva config ─────────────────────────────────────────────────
  // Prioriza o tema salvo na CONTA (Firestore, carregado pelo app após o
  // login) sobre o que está só no localStorage deste aparelho — assim o
  // tema muda por conta, não por aparelho. O localStorage continua sendo
  // usado como cache rápido pra pintar o tema certo antes do login carregar
  // (evita flash de tema errado) e como fallback offline.
  function loadConfig() {
    const accountTheme = window.app?.data?.settings?.theme;
    if (accountTheme && accountTheme.preset) return accountTheme;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { preset: 'dark', custom: {} };
    } catch { return { preset: 'dark', custom: {} }; }
  }

  function saveConfig(cfg) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    // Sincroniza com a conta, pra valer em qualquer dispositivo logado.
    if (window.app?.data?.settings && window.dbService && window.auth?.currentUser) {
      window.app.data.settings.theme = cfg;
      window.dbService.saveData('settings', window.app.data.settings);
    }
  }

  // Chamado pelo database.js assim que os dados da conta terminam de
  // carregar (login ou troca de conta) — reaplica o tema salvo na conta,
  // substituindo o que estava só no cache local deste aparelho.
  function syncFromAccount(accountTheme) {
    if (!accountTheme || !accountTheme.preset) return;
    const cfgAtual = loadConfigLocalOnly();
    if (JSON.stringify(cfgAtual) === JSON.stringify(accountTheme)) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accountTheme));
    applyPreset(accountTheme.preset, accountTheme.custom || {});
  }

  function loadConfigLocalOnly() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { preset: 'dark', custom: {} };
    } catch { return { preset: 'dark', custom: {} }; }
  }

  // ── Aplica vars no :root ───────────────────────────────────────────────────
  function applyVars(vars) {
    const root = document.documentElement;
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    // Garante legibilidade: ajusta card-shadow baseado no bg
    const bg = vars['--bg-primary'] || '';
    const isDark = isColorDark(bg);
    root.style.setProperty('--card-shadow',
      isDark
        ? '0 20px 25px -5px rgba(0,0,0,0.5), 0 10px 10px -5px rgba(0,0,0,0.3)'
        : '0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -1px rgba(0,0,0,0.05)'
    );
    // Garante legibilidade de botões sobre accent-primary
    root.style.setProperty('--btn-text', getContrastColor(vars['--accent-primary'] || '#3b82f6'));
    // Tamanho da fonte: a maioria dos componentes usa px fixo (não rem),
    // então só mudar --font-size-base não tinha efeito nenhum na prática.
    // Aplica como um fator de escala (zoom) no app inteiro, que reescala
    // tudo de verdade — texto, ícones, espaçamentos.
    applyFontScale(vars['--font-size-base']);
  }

  function applyFontScale(fontSizeBase) {
    const px = parseInt(fontSizeBase) || 15;
    const scale = px / 15; // 15px é o tamanho "Normal" (padrão)
    const app = document.getElementById('app') || document.body;
    if (app) app.style.zoom = scale;
  }

  function isColorDark(hex) {
    hex = hex.replace('#', '');
    if (hex.length < 6) return true;
    const r = parseInt(hex.slice(0,2),16);
    const g = parseInt(hex.slice(2,4),16);
    const b = parseInt(hex.slice(4,6),16);
    return (r*299 + g*587 + b*114) / 1000 < 128;
  }

  function getContrastColor(hex) {
    return isColorDark(hex) ? '#ffffff' : '#0f172a';
  }

  function applyPreset(presetKey, customOverrides = {}) {
    const preset = PRESETS[presetKey] || PRESETS.dark;
    const vars = { ...preset.vars, ...customOverrides };
    applyVars(vars);
    // Atualiza data-theme para compatibilidade com CSS existente
    const isDark = isColorDark(vars['--bg-primary']);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }

  // ── Init: aplica tema salvo imediatamente ─────────────────────────────────
  function init() {
    const cfg = loadConfig();
    applyPreset(cfg.preset, cfg.custom);
    window.__themeEngine = { PRESETS, applyPreset, loadConfig, saveConfig, syncFromAccount, getContrastColor, isColorDark };
  }

  // Aplica ANTES do render para evitar flash
  init();

  // ── Renderiza painel de customização ──────────────────────────────────────
  function renderThemePanel() {
    const cfg = loadConfig();
    const current = PRESETS[cfg.preset] || PRESETS.dark;
    const mergedVars = { ...current.vars, ...cfg.custom };

    return `
    <div class="card" id="theme-panel-card" style="margin-top:20px;">
      <div class="card-header" style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:20px;">🎨</span>
        <h3 style="margin:0;">Personalizar Tema</h3>
      </div>
      <div class="card-body">

        <!-- Presets -->
        <div style="margin-bottom:24px;">
          <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">Tema base</p>
          <div style="display:flex;flex-wrap:wrap;gap:8px;" id="theme-presets">
            ${Object.entries(PRESETS).map(([key, p]) => `
              <button class="theme-preset-btn ${cfg.preset === key ? 'active' : ''}"
                data-preset="${key}"
                style="
                  padding:8px 14px;border-radius:10px;border:2px solid ${cfg.preset === key ? 'var(--accent-primary)' : 'var(--border)'};
                  background:${p.vars['--bg-secondary']};color:${p.vars['--text-primary']};
                  font-size:13px;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:6px;font-family:inherit;
                ">
                ${p.icon} ${p.label}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Ajustes finos -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;margin-bottom:24px;">
          ${[
            { var: '--accent-primary',   label: '🎯 Cor principal',    type: 'color' },
            { var: '--accent-secondary', label: '✨ Cor secundária',   type: 'color' },
            { var: '--accent-success',   label: '✅ Cor de sucesso',   type: 'color' },
            { var: '--accent-warning',   label: '⚠️ Cor de aviso',     type: 'color' },
            { var: '--accent-danger',    label: '🚨 Cor de perigo',    type: 'color' },
            { var: '--bg-primary',       label: '🌑 Fundo principal',  type: 'color' },
            { var: '--bg-secondary',     label: '📦 Fundo cards',      type: 'color' },
            { var: '--text-primary',     label: '📝 Texto principal',  type: 'color' },
            { var: '--text-secondary',   label: '💬 Texto secundário', type: 'color' },
            { var: '--border',           label: '📐 Cor de borda',     type: 'color' },
          ].map(item => `
            <div style="display:flex;flex-direction:column;gap:6px;">
              <label style="font-size:12px;color:var(--text-secondary);">${item.label}</label>
              <div style="display:flex;align-items:center;gap:8px;">
                <input type="color" class="theme-color-input" data-var="${item.var}"
                  value="${mergedVars[item.var] || '#000000'}"
                  style="width:36px;height:36px;border:none;border-radius:8px;cursor:pointer;background:none;padding:0;">
                <span class="theme-color-value" style="font-size:11px;color:var(--text-tertiary);font-family:monospace;">
                  ${mergedVars[item.var] || '#000000'}
                </span>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Tamanho da fonte -->
        <div style="margin-bottom:24px;">
          <label style="font-size:13px;color:var(--text-secondary);display:block;margin-bottom:8px;">
            🔤 Tamanho da fonte: <strong id="font-size-label">${mergedVars['--font-size-base'] || '15px'}</strong>
          </label>
          <input type="range" id="theme-font-size" min="12" max="20" step="1"
            value="${parseInt(mergedVars['--font-size-base']) || 15}"
            style="width:100%;accent-color:var(--accent-primary);">
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-tertiary);margin-top:4px;">
            <span>Pequeno (12px)</span><span>Normal (15px)</span><span>Grande (20px)</span>
          </div>
        </div>

        <!-- Arredondamento -->
        <div style="margin-bottom:24px;">
          <label style="font-size:13px;color:var(--text-secondary);display:block;margin-bottom:8px;">
            🔘 Arredondamento dos cards: <strong id="radius-label">${parseInt(mergedVars['--radius-lg']) || 24}px</strong>
          </label>
          <input type="range" id="theme-radius" min="0" max="32" step="4"
            value="${parseInt(mergedVars['--radius-lg']) || 24}"
            style="width:100%;accent-color:var(--accent-primary);">
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-tertiary);margin-top:4px;">
            <span>Quadrado</span><span>Médio</span><span>Bem arredondado</span>
          </div>
        </div>

        <!-- Preview -->
        <div id="theme-preview" style="
          padding:16px;border-radius:var(--radius-md);
          background:var(--bg-secondary);border:1px solid var(--border);
          margin-bottom:20px;
        ">
          <p style="font-size:13px;color:var(--text-secondary);margin-bottom:10px;">Preview</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button style="padding:8px 16px;border-radius:var(--radius-sm);background:var(--accent-primary);color:${getContrastColor(mergedVars['--accent-primary']||'#3b82f6')};border:none;font-size:13px;cursor:pointer;">Primário</button>
            <button style="padding:8px 16px;border-radius:var(--radius-sm);background:var(--accent-secondary);color:${getContrastColor(mergedVars['--accent-secondary']||'#8b5cf6')};border:none;font-size:13px;cursor:pointer;">Secundário</button>
            <button style="padding:8px 16px;border-radius:var(--radius-sm);background:var(--accent-success);color:${getContrastColor(mergedVars['--accent-success']||'#10b981')};border:none;font-size:13px;cursor:pointer;">Sucesso</button>
            <button style="padding:8px 16px;border-radius:var(--radius-sm);background:var(--accent-warning);color:${getContrastColor(mergedVars['--accent-warning']||'#f59e0b')};border:none;font-size:13px;cursor:pointer;">Aviso</button>
            <button style="padding:8px 16px;border-radius:var(--radius-sm);background:var(--accent-danger);color:${getContrastColor(mergedVars['--accent-danger']||'#ef4444')};border:none;font-size:13px;cursor:pointer;">Perigo</button>
          </div>
        </div>

        <!-- Ações -->
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn-primary" id="btn-save-theme">
            <i class="fas fa-save"></i> Salvar tema
          </button>
          <button class="btn-secondary" id="btn-reset-theme">
            <i class="fas fa-undo"></i> Restaurar padrão
          </button>
        </div>

      </div>
    </div>`;
  }

  function getContrastColor(hex) {
    return isColorDark(hex) ? '#ffffff' : '#0f172a';
  }

  // ── Bind eventos do painel ────────────────────────────────────────────────
  function bindThemePanel() {
    const card = document.getElementById('theme-panel-card');
    if (!card || card.dataset.bound) return;
    card.dataset.bound = '1';

    const cfg = loadConfig();

    // Preset buttons
    card.querySelectorAll('.theme-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        cfg.preset = btn.dataset.preset;
        cfg.custom = {};
        saveConfig(cfg);
        applyPreset(cfg.preset, {});
        // Re-renderiza só a aba de Tema (sem voltar pro menu de categorias
        // das configurações — window.app.loadView('configuracoes') sempre
        // volta pro menu porque não sabe em qual aba a gente tava).
        rerenderTemaTab();
      });
    });

    // Color inputs — live preview
    card.querySelectorAll('.theme-color-input').forEach(input => {
      input.addEventListener('input', () => {
        const varName = input.dataset.var;
        const val = input.value;
        document.documentElement.style.setProperty(varName, val);
        const span = input.parentElement.querySelector('.theme-color-value');
        if (span) span.textContent = val;
        if (!cfg.custom) cfg.custom = {};
        cfg.custom[varName] = val;
        // Update preview button contrast
        updatePreviewContrast();
      });
    });

    // Font size slider
    const fontSlider = document.getElementById('theme-font-size');
    const fontLabel  = document.getElementById('font-size-label');
    if (fontSlider) {
      fontSlider.addEventListener('input', () => {
        const val = fontSlider.value + 'px';
        document.documentElement.style.setProperty('--font-size-base', val);
        applyFontScale(val);
        if (fontLabel) fontLabel.textContent = val;
        if (!cfg.custom) cfg.custom = {};
        cfg.custom['--font-size-base'] = val;
      });
    }

    // Radius slider
    const radiusSlider = document.getElementById('theme-radius');
    const radiusLabel  = document.getElementById('radius-label');
    if (radiusSlider) {
      radiusSlider.addEventListener('input', () => {
        const v = parseInt(radiusSlider.value);
        document.documentElement.style.setProperty('--radius-lg', v + 'px');
        document.documentElement.style.setProperty('--radius-md', Math.max(0, v - 8) + 'px');
        document.documentElement.style.setProperty('--radius-sm', Math.max(0, v - 12) + 'px');
        if (radiusLabel) radiusLabel.textContent = v + 'px';
        if (!cfg.custom) cfg.custom = {};
        cfg.custom['--radius-lg'] = v + 'px';
        cfg.custom['--radius-md'] = Math.max(0, v - 8) + 'px';
        cfg.custom['--radius-sm'] = Math.max(0, v - 12) + 'px';
      });
    }

    // Save
    document.getElementById('btn-save-theme')?.addEventListener('click', () => {
      saveConfig(cfg);
      if (window.showToast) window.showToast('Tema salvo com sucesso! ✨', 'success');
    });

    // Reset
    document.getElementById('btn-reset-theme')?.addEventListener('click', () => {
      cfg.preset = 'dark';
      cfg.custom = {};
      saveConfig(cfg);
      applyPreset('dark', {});
      rerenderTemaTab();
      if (window.showToast) window.showToast('Tema restaurado para o padrão', 'success');
    });
  }

  // Re-renderiza a view de configurações direto na aba "tema", sem passar
  // pelo menu de categorias (loadView('configuracoes') sempre volta pro
  // menu porque não recebe qual aba estava aberta).
  function rerenderTemaTab() {
    const container = document.getElementById('view-container');
    const app = window.app;
    if (!container || !app?.viewRenderer) return;
    container.innerHTML = app.viewRenderer.renderConfiguracoes('tema');
    app.setupViewEvents?.('configuracoes');
  }

  function updatePreviewContrast() {
    const preview = document.getElementById('theme-preview');
    if (!preview) return;
    const btns = preview.querySelectorAll('button');
    const vars = ['--accent-primary','--accent-secondary','--accent-success','--accent-warning','--accent-danger'];
    btns.forEach((btn, i) => {
      if (!vars[i]) return;
      const color = getComputedStyle(document.documentElement).getPropertyValue(vars[i]).trim();
      btn.style.color = getContrastColor(color);
      btn.style.background = color;
    });
  }

  // ── Patch no renderConfiguracoes para injetar painel ─────────────────────
  function patchConfigView() {
    if (!window.ViewRenderer) return;
    if (window.ViewRenderer.prototype.__themePanelPatched) return;

    const orig = window.ViewRenderer.prototype.renderConfiguracoes;
    window.ViewRenderer.prototype.renderConfiguracoes = function (aba) {
      // O painel de personalização só faz sentido dentro da aba "Tema" —
      // antes ele era colado em toda e qualquer aba (inclusive no menu
      // inicial de categorias).
      return orig.call(this, aba) + (aba === 'tema' ? renderThemePanel() : '');
    };
    window.ViewRenderer.prototype.__themePanelPatched = true;
  }

  // ── Observa carregamento do ViewRenderer ─────────────────────────────────
  let _attempts = 0;
  const _interval = setInterval(() => {
    if (window.ViewRenderer) {
      patchConfigView();
      clearInterval(_interval);
    }
    if (++_attempts > 30) clearInterval(_interval);
  }, 200);

  // ── Observa quando a view de configurações é renderizada ─────────────────
  const _observer = new MutationObserver(() => {
    if (document.getElementById('theme-panel-card')) bindThemePanel();
  });

  document.addEventListener('DOMContentLoaded', () => {
    _observer.observe(document.body, { childList: true, subtree: true });
  });

  // Expõe globalmente
  window.themeEngine = { renderThemePanel, bindThemePanel, PRESETS, loadConfig, saveConfig, applyPreset, syncFromAccount, init };

})();
