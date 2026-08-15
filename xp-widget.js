// xp-widget.js
// Mostra um selo de nível/XP na barra lateral (perto do "streak"), pra
// gamificação ficar visível o tempo todo em vez de escondida numa aba.
// Usa app.getGamificationSnapshot(), que já existe em script.js.

(function () {
  'use strict';

  function ensureWidget() {
    const streak = document.getElementById('sidebar-streak')?.closest('.streak-info');
    if (!streak || document.getElementById('sidebar-xp-widget')) return null;

    const el = document.createElement('div');
    el.id = 'sidebar-xp-widget';
    el.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:6px;font-size:.78rem;color:var(--text-secondary,#94a3b8);';
    el.innerHTML = `
      <span style="display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-weight:700;font-size:.72rem;" id="sidebar-xp-level">Nv.1</span>
      <div style="flex:1;height:6px;border-radius:999px;background:rgba(148,163,184,.25);overflow:hidden;">
        <div id="sidebar-xp-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#4f46e5,#7c3aed);transition:width .3s;"></div>
      </div>
    `;
    streak.insertAdjacentElement('afterend', el);
    return el;
  }

  function update() {
    const app = window.app;
    if (!app || typeof app.getGamificationSnapshot !== 'function') return;

    const widget = document.getElementById('sidebar-xp-widget') || ensureWidget();
    if (!widget) return;

    try {
      const snap = app.getGamificationSnapshot();
      const levelEl = document.getElementById('sidebar-xp-level');
      const barEl = document.getElementById('sidebar-xp-bar');
      if (levelEl) {
        levelEl.textContent = `Nv.${snap.level}`;
        levelEl.title = `${snap.xp} XP · faltam ${snap.nextLevelIn} XP para o próximo nível`;
      }
      if (barEl) barEl.style.width = `${snap.progress}%`;
    } catch (error) {
      console.error('[xp-widget] Erro ao atualizar:', error);
    }
  }

  document.addEventListener('app-ready', () => {
    ensureWidget();
    update();
  });

  // Atualiza sempre que o app salva algo (tarefa concluída, sessão registrada etc.)
  document.addEventListener('slc-data-saved', update);

  // Fallback: atualiza periodicamente enquanto a aba está aberta
  setInterval(() => { if (window.app?.initialized) update(); }, 15000);

  document.addEventListener('DOMContentLoaded', () => {
    if (window.app?.initialized) { ensureWidget(); update(); }
  });
})();
