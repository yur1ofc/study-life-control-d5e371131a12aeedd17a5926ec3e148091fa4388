// improvements.js — Tema, sidebar colapsável, Ctrl+K, Charts, Export
(function () {
  'use strict';

  // ── 1. TEMA — gerenciado por theme-engine.js ────────────────────────────

  // ── 2. SIDEBAR: grupos colapsáveis ───────────────────────────────────────
  function initSidebarGroups() {
    const headers = document.querySelectorAll('.nav-group-header');
    if (!headers.length) return;

    // Restaura estado salvo
    headers.forEach(btn => {
      const group = btn.dataset.group;
      const items = document.getElementById(`group-${group}`);
      if (!items) return;

      const collapsed = localStorage.getItem(`slc-nav-${group}`) === 'collapsed';
      if (collapsed) {
        items.style.display = 'none';
        btn.classList.add('collapsed');
      }

      btn.addEventListener('click', () => {
        const isCollapsed = items.style.display === 'none';
        items.style.display = isCollapsed ? '' : 'none';
        btn.classList.toggle('collapsed', !isCollapsed);
        localStorage.setItem(`slc-nav-${group}`, isCollapsed ? 'open' : 'collapsed');
      });
    });
  }

  // ── 3. BUSCA RÁPIDA Ctrl+K ────────────────────────────────────────────────
  const NAV_ITEMS = [
    { label: 'Dashboard',          view: 'dashboard',         icon: 'fa-chart-pie' },
    { label: 'Mentor IA',          view: 'mentor-ia',         icon: 'fa-robot' },
    { label: 'Matérias',           view: 'materias',          icon: 'fa-book' },
    { label: 'Grade Horária',      view: 'grade-horaria',     icon: 'fa-calendar-week' },
    { label: 'Grade Curricular',   view: 'grade-curricular',  icon: 'fa-sitemap' },
    { label: 'Cursos Extras',      view: 'cursos-extras',     icon: 'fa-language' },
    { label: 'Situação Acadêmica', view: 'situacao-academica',icon: 'fa-heartbeat' },
    { label: 'Previsão de Notas',  view: 'previsao-notas',    icon: 'fa-chart-line' },
    { label: 'Tarefas',            view: 'tarefas',           icon: 'fa-tasks' },
    { label: 'Provas e Trabalhos', view: 'provas',            icon: 'fa-graduation-cap' },
    { label: 'Sessões de Estudo',  view: 'sessoes',           icon: 'fa-clock' },
    { label: 'Calendário',         view: 'calendario',        icon: 'fa-calendar-alt' },
    { label: 'Hábitos',            view: 'habitos',           icon: 'fa-heart' },
    { label: 'Modo Foco',          view: 'foco',              icon: 'fa-bullseye' },
    { label: 'Mapa de Aprendizado',view: 'mapa-aprendizado',  icon: 'fa-map' },
    { label: 'Materiais',          view: 'materiais',         icon: 'fa-folder' },
    { label: 'Estatísticas',       view: 'estatisticas',      icon: 'fa-chart-bar' },
    { label: 'Configurações',      view: 'configuracoes',     icon: 'fa-cog' },
    { label: 'Ajuda',              view: 'ajuda',             icon: 'fa-question-circle' },
  ];

  function initNavSearch() {
    const modal   = document.getElementById('nav-search-modal');
    const input   = document.getElementById('nav-search-input');
    const results = document.getElementById('nav-search-results');
    const overlay = document.getElementById('nav-search-overlay');
    if (!modal || !input || !results) return;

    function open() {
      modal.hidden = false;
      input.value = '';
      renderResults('');
      setTimeout(() => input.focus(), 50);
    }

    function close() {
      modal.hidden = true;
    }

    function renderResults(query) {
      const q = query.toLowerCase().trim();
      const filtered = q
        ? NAV_ITEMS.filter(item => item.label.toLowerCase().includes(q))
        : NAV_ITEMS;

      results.innerHTML = filtered.map((item, i) => `
        <button class="nav-search-result${i === 0 ? ' active' : ''}" data-view="${item.view}">
          <i class="fas ${item.icon}"></i>
          <span>${item.label}</span>
        </button>
      `).join('');

      results.querySelectorAll('.nav-search-result').forEach(btn => {
        btn.addEventListener('click', () => {
          close();
          if (window.app?.loadView) window.app.loadView(btn.dataset.view);
        });
      });
    }

    input.addEventListener('input', e => renderResults(e.target.value));

    input.addEventListener('keydown', e => {
      const active = results.querySelector('.nav-search-result.active');
      const all    = [...results.querySelectorAll('.nav-search-result')];
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const idx = all.indexOf(active);
        const next = all[idx + 1] || all[0];
        active?.classList.remove('active');
        next?.classList.add('active');
        next?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const idx = all.indexOf(active);
        const prev = all[idx - 1] || all[all.length - 1];
        active?.classList.remove('active');
        prev?.classList.add('active');
        prev?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const target = active || all[0];
        if (target) { close(); if (window.app?.loadView) window.app.loadView(target.dataset.view); }
      } else if (e.key === 'Escape') {
        close();
      }
    });

    overlay?.addEventListener('click', close);

    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        modal.hidden ? open() : close();
      }
      if (e.key === 'Escape' && !modal.hidden) close();
    });
  }

  // ── 4. CHARTS NO DASHBOARD ───────────────────────────────────────────────
  // Injetado via patch no renderDashboard do ViewRenderer
  function initDashboardCharts() {
    if (!window.ViewRenderer) return;
    const proto = ViewRenderer.prototype;
    const originalDash = proto.renderDashboard;
    if (!originalDash || proto.__chartPatched) return;

    proto.renderDashboard = function () {
      const html = originalDash.call(this);
      // Injeta container de charts após o retorno
      setTimeout(() => renderCharts(this.app?.data), 100);
      return html;
    };
    proto.__chartPatched = true;
  }

  function renderCharts(data) {
    const container = document.getElementById('view-container');
    if (!container || !data) return;

    // Evita duplicar
    if (container.querySelector('#slc-charts-section')) return;

    const sessions = data.sessions || [];
    const grades   = data.grades   || [];

    // Horas estudadas por dia (últimos 14 dias)
    const today = new Date();
    const labels = [], hoursData = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      labels.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
      const mins = sessions
        .filter(s => (s.data || s.dataHora || '').slice(0, 10) === ds && s.concluida)
        .reduce((acc, s) => acc + (Number(s.duracao) || 0), 0);
      hoursData.push(+(mins / 60).toFixed(1));
    }

    // Média de notas por matéria
    const subjectGrades = {};
    grades.forEach(g => {
      if (!g.materia || !g.valor) return;
      if (!subjectGrades[g.materia]) subjectGrades[g.materia] = [];
      subjectGrades[g.materia].push(Number(g.valor));
    });
    const gradeLabels = Object.keys(subjectGrades).slice(0, 8);
    const gradeData   = gradeLabels.map(m => {
      const arr = subjectGrades[m];
      return +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1);
    });

    // Heatmap de atividade (últimos 84 dias = 12 semanas)
    const activityMap = {};
    sessions.filter(s => s.concluida).forEach(s => {
      const d = (s.data || s.dataHora || '').slice(0, 10);
      if (d) activityMap[d] = (activityMap[d] || 0) + 1;
    });

    const section = document.createElement('div');
    section.id = 'slc-charts-section';
    section.style.cssText = 'padding:20px 0 32px;';
    section.innerHTML = `
      <div class="card" style="margin-bottom:20px;padding:20px 24px;">
        <h3 style="margin-bottom:14px;font-size:14px;font-weight:600;color:var(--text-secondary);"><i class="fas fa-clock" style="color:var(--accent-primary);margin-right:8px;"></i>Horas estudadas — últimos 14 dias</h3>
        <div style="position:relative;height:120px;"><canvas id="chart-hours"></canvas></div>
      </div>
      ${gradeLabels.length ? `
      <div class="card" style="margin-bottom:20px;padding:20px 24px;">
        <h3 style="margin-bottom:16px;font-size:14px;font-weight:600;color:var(--text-secondary);"><i class="fas fa-star" style="color:var(--accent-warning);margin-right:8px;"></i>Médias por matéria</h3>
        <div id="slc-grades-list" class="slc-grade-rows"></div>
      </div>` : ''}
      <div class="card" style="padding:20px 24px;">
        <h3 style="margin-bottom:16px;font-size:14px;font-weight:600;color:var(--text-secondary);"><i class="fas fa-fire" style="color:var(--accent-danger);margin-right:8px;"></i>Atividade — últimas 12 semanas</h3>
        <div id="heatmap-container" style="overflow-x:auto;"></div>
      </div>
    `;

    container.appendChild(section);
    loadChartJS(labels, hoursData, gradeLabels, gradeData, activityMap);
  }

  function loadChartJS(labels, hoursData, gradeLabels, gradeData, activityMap) {
    if (window.Chart) {
      drawCharts(labels, hoursData, gradeLabels, gradeData, activityMap);
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
    s.onload = () => drawCharts(labels, hoursData, gradeLabels, gradeData, activityMap);
    document.head.appendChild(s);
  }

  function drawCharts(labels, hoursData, gradeLabels, gradeData, activityMap) {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

    const baseOpts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { backgroundColor: isDark ? '#1e293b' : '#fff', titleColor: textColor, bodyColor: textColor, borderColor: gridColor, borderWidth: 1, padding: 8, displayColors: false } },
      scales: {
        x: { ticks: { color: textColor, font: { size: 10 } }, grid: { display: false }, border: { display: false } },
        y: { ticks: { color: textColor, font: { size: 10 }, maxTicksLimit: 4 }, grid: { color: gridColor }, border: { display: false }, beginAtZero: true }
      }
    };

    // Horas chart — barra fina, cor suave, sem grade vertical (visual mais limpo)
    const hoursCtx = document.getElementById('chart-hours');
    if (hoursCtx) {
      new Chart(hoursCtx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{ data: hoursData, backgroundColor: 'rgba(96,165,250,0.55)', hoverBackgroundColor: 'rgba(96,165,250,0.85)', borderRadius: 4, borderSkipped: false, maxBarThickness: 18 }]
        },
        options: { ...baseOpts }
      });
    }

    // Médias por matéria — virou lista de barrinhas horizontais em vez de
    // gráfico de barras verticais: mais legível com nomes longos de matéria
    // e visualmente mais leve (sem eixo, sem canvas, sem legenda).
    const gradesList = document.getElementById('slc-grades-list');
    if (gradesList && gradeLabels.length) {
      gradesList.innerHTML = gradeLabels.map((label, i) => {
        const value = gradeData[i];
        const pct = Math.max(4, Math.min(100, (value / 10) * 100));
        const color = value >= 7 ? '#10b981' : value >= 5 ? '#f59e0b' : '#ef4444';
        return `
          <div class="slc-grade-row">
            <span class="slc-grade-label" title="${label}">${label}</span>
            <div class="slc-grade-track"><div class="slc-grade-fill" style="width:${pct}%;background:${color};"></div></div>
            <span class="slc-grade-value" style="color:${color};">${value.toFixed(1)}</span>
          </div>`;
      }).join('');
    }

    // Heatmap
    const heatDiv = document.getElementById('heatmap-container');
    if (heatDiv) {
      const today = new Date();
      let html = '<div style="display:flex;gap:3px;align-items:flex-start;">';
      for (let w = 11; w >= 0; w--) {
        html += '<div style="display:flex;flex-direction:column;gap:3px;">';
        for (let d = 6; d >= 0; d--) {
          const date = new Date(today);
          date.setDate(today.getDate() - (w * 7 + d));
          const ds = date.toISOString().slice(0, 10);
          const count = activityMap[ds] || 0;
          const opacity = count === 0 ? 0.08 : count === 1 ? 0.3 : count <= 3 ? 0.6 : 1;
          html += `<div title="${ds}: ${count} sessão(ões)" style="width:12px;height:12px;border-radius:2px;background:rgba(59,130,246,${opacity});"></div>`;
        }
        html += '</div>';
      }
      html += '</div>';
      heatDiv.innerHTML = html;
    }
  }

  // ── 5. EXPORT CSV ────────────────────────────────────────────────────────
  function initExport() {
    // Adiciona botão de export na view de configurações
    document.addEventListener('click', e => {
      if (e.target.closest('#btn-export-csv') || e.target.id === 'btn-export-csv') {
        exportCSV();
      }
      if (e.target.closest('#btn-export-pdf') || e.target.id === 'btn-export-pdf') {
        exportPDF();
      }
    });
  }

  function exportCSV() {
    const data = window.app?.data;
    if (!data) return;

    const sheets = {
      'sessoes': ['data', 'materia', 'tipo', 'duracao', 'completada'],
      'tarefas': ['titulo', 'materia', 'dataLimite', 'prioridade', 'concluida'],
      'provas':  ['titulo', 'materia', 'data', 'tipo', 'nota'],
      'grades':  ['materia', 'avaliacao', 'nota', 'peso'],
    };

    let csv = '';
    Object.entries(sheets).forEach(([key, fields]) => {
      const rows = data[key] || [];
      if (!rows.length) return;
      csv += `\n### ${key.toUpperCase()} ###\n`;
      csv += fields.join(',') + '\n';
      rows.forEach(row => {
        csv += fields.map(f => `"${String(row[f] ?? '').replace(/"/g, '""')}"`).join(',') + '\n';
      });
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: 'study-life-control-dados.csv' });
    a.click();
    URL.revokeObjectURL(url);
    if (window.showToast) window.showToast('CSV exportado com sucesso!', 'success');
  }

  function exportPDF() {
    const data = window.app?.data;
    if (!data) return;

    // PDF simples via print — sem dependência externa
    const user    = data.user || {};
    const tasks   = (data.tarefas || data.tasks || []).filter(t => !t.concluida).slice(0, 20);
    const exams   = (data.provas  || data.exams  || []).slice(0, 20);
    const grades  = data.grades || [];

    const html = `
      <html><head><title>SLCampus — Relatório</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 32px; color: #1e293b; }
        h1 { font-size: 22px; margin-bottom: 4px; }
        h2 { font-size: 16px; margin: 24px 0 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { background: #f1f5f9; text-align: left; padding: 6px 8px; }
        td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; }
        .badge { display:inline-block;padding:2px 8px;border-radius:99px;font-size:11px; }
        .alta { background:#fee2e2;color:#dc2626; }
        .media { background:#fef3c7;color:#d97706; }
        .baixa { background:#dcfce7;color:#16a34a; }
      </style></head><body>
      <h1>📚 SLCampus</h1>
      <p style="color:#64748b;font-size:13px;">Relatório gerado em ${new Date().toLocaleDateString('pt-BR')} • ${user.nome || 'Usuário'}</p>
      <h2>Tarefas Pendentes</h2>
      <table><tr><th>Tarefa</th><th>Matéria</th><th>Prazo</th><th>Prioridade</th></tr>
      ${tasks.map(t => `<tr><td>${t.titulo||''}</td><td>${t.materia||''}</td><td>${t.dataLimite||''}</td><td><span class="badge ${t.prioridade||''}">${t.prioridade||''}</span></td></tr>`).join('')}
      </table>
      <h2>Provas e Trabalhos</h2>
      <table><tr><th>Título</th><th>Matéria</th><th>Data</th><th>Tipo</th></tr>
      ${exams.map(e => `<tr><td>${e.titulo||''}</td><td>${e.materia||''}</td><td>${e.data||''}</td><td>${e.tipo||''}</td></tr>`).join('')}
      </table>
      <h2>Notas Registradas</h2>
      <table><tr><th>Matéria</th><th>Avaliação</th><th>Nota</th><th>Peso</th></tr>
      ${grades.map(g => `<tr><td>${g.materia||''}</td><td>${g.avaliacao||''}</td><td>${g.nota||''}</td><td>${g.peso||''}%</td></tr>`).join('')}
      </table>
      </body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.print();
  }

  // ── 6. Botões de export na tela de configurações ─────────────────────────
  function injectExportButtons() {
    if (!window.ViewRenderer) return;
    const proto = ViewRenderer.prototype;
    if (proto.__exportPatched) return;

    const originalConfig = proto.renderConfiguracoes;
    if (!originalConfig) return;

    proto.renderConfiguracoes = function (aba) {
      const html = originalConfig.call(this, aba);
      // Só mostra o bloco extra de exportação dentro da própria aba "Dados" —
      // no menu de categorias e nas outras abas ele não deve aparecer.
      if (aba !== 'dados') return html;
      const exportSection = `
        <div class="card" style="margin-top:20px;padding:20px 24px;">
          <h3 style="margin-bottom:16px;font-size:15px;font-weight:600;"><i class="fas fa-download" style="color:var(--accent-primary);margin-right:8px;"></i>Exportar Dados</h3>
          <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px;">Baixe seus dados acadêmicos para backup ou análise externa.</p>
          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            <button id="btn-export-csv" class="btn-secondary"><i class="fas fa-file-csv"></i> Exportar CSV</button>
            <button id="btn-export-pdf" class="btn-secondary"><i class="fas fa-file-pdf"></i> Exportar PDF</button>
          </div>
        </div>`;
      return html + exportSection;
    };
    proto.__exportPatched = true;
  }

  // ── INIT ──────────────────────────────────────────────────────────────────
  function init() {
    initSidebarGroups();
    initNavSearch();
    initExport();

    // Patches de ViewRenderer (aguarda estar disponível)
    let attempts = 0;
    const interval = setInterval(() => {
      if (window.ViewRenderer) {
        initDashboardCharts();
        injectExportButtons();
        clearInterval(interval);
      }
      if (++attempts > 20) clearInterval(interval);
    }, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// ── BÔNUS: Painel de atalhos de teclado (tecla ?) ──────────────────────────
(function () {
  const SHORTCUTS = [
    { key: 'Ctrl K',   desc: 'Busca rápida' },
    { key: '?',        desc: 'Mostrar atalhos' },
    { key: 'Ctrl S',   desc: 'Salvar dados' },
    { key: 'Esc',      desc: 'Fechar painéis' },
    { key: 'Alt 1-9',  desc: 'Navegar entre views (na ordem do menu)' },
    { key: 'Alt D',    desc: 'Ir para o Dashboard' },
    { key: 'Alt F',    desc: 'Ir para o Modo Foco' },
    { key: 'Alt T',    desc: 'Ir para Tarefas' },
    { key: 'Alt P',    desc: 'Ir para Provas' },
    { key: 'Alt M',    desc: 'Ir para o Mentor IA' },
  ];

  function showShortcutsModal() {
    let modal = document.getElementById('shortcuts-modal');
    if (modal) { modal.hidden = false; return; }

    modal = document.createElement('div');
    modal.id = 'shortcuts-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
      <div style="position:absolute;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);" id="shortcuts-overlay"></div>
      <div style="
        position:relative;background:var(--bg-secondary);border:1px solid var(--border);
        border-radius:var(--radius-lg);padding:28px;min-width:320px;max-width:420px;width:90%;
        box-shadow:0 25px 50px rgba(0,0,0,0.4);animation:slideUp 0.18s ease;
      ">
        <h3 style="margin:0 0 20px;font-size:16px;display:flex;align-items:center;gap:8px;">
          <i class="fas fa-keyboard" style="color:var(--accent-primary);"></i> Atalhos de teclado
        </h3>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${SHORTCUTS.map(s => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg-tertiary);border-radius:var(--radius-sm);">
              <span style="font-size:13px;color:var(--text-secondary);">${s.desc}</span>
              <kbd style="background:var(--bg-primary);border:1px solid var(--border);border-radius:6px;padding:3px 10px;font-size:12px;font-family:monospace;color:var(--text-primary);">${s.key}</kbd>
            </div>
          `).join('')}
        </div>
        <p style="margin-top:16px;font-size:12px;color:var(--text-tertiary);text-align:center;">Pressione Esc ou clique fora para fechar</p>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('shortcuts-overlay').addEventListener('click', () => modal.hidden = true);
  }

  document.addEventListener('keydown', e => {
    if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
      const active = document.activeElement;
      if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') return;
      e.preventDefault();
      showShortcutsModal();
    }
    if (e.key === 'Escape') {
      const m = document.getElementById('shortcuts-modal');
      if (m) m.hidden = true;
    }
    // Alt+1-9 navegação rápida
    if (e.altKey && e.key >= '1' && e.key <= '9') {
      const views = ['dashboard','mentor-ia','materias','tarefas','provas','sessoes','estatisticas','configuracoes','ajuda'];
      const view = views[parseInt(e.key) - 1];
      if (view && window.app?.loadView) { e.preventDefault(); window.app.loadView(view); }
    }
    // Ctrl+S salva dados
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      const active = document.activeElement;
      if (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA') {
        e.preventDefault();
        window.dbService?.saveAllData?.();
        if (window.showToast) window.showToast('Dados salvos!', 'success');
      }
    }
  });
})();
