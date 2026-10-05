// smart-habits.js — usa o que o site aprendeu sobre a pessoa:
//  1) Modo foco já abre com a duração que ela costuma aguentar (25/50/90 min).
//  2) Card no Início "Seus melhores horários" (só aparece com dados suficientes).
(function () {
  'use strict';
  var A = function () { return window.SLCAvailability; };
  var D = function () { return window.app && window.app.data; };
  var NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  var ABBR = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  function esc(s) { return window.escapeHtml ? window.escapeHtml(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // ── 1) Duração padrão do foco ────────────────────────────────────────────
  function applyFocusDefault() {
    var sel = document.getElementById('timer-duracao'), d = D();
    if (!sel || !d || sel.dataset.slcLearned === '1') return;
    var m = Number(d.user && d.user.adaptiveLearning && d.user.adaptiveLearning.preferredSessionMinutes) || 0;
    if (!m) return;
    var target = m >= 70 ? '90' : m >= 38 ? '50' : '25';
    if (sel.value !== '25' && sel.value !== target) { sel.dataset.slcLearned = '1'; return; }   // pessoa já escolheu outra
    sel.dataset.slcLearned = '1';
    if (sel.value !== target) {
      sel.value = target;
      sel.dispatchEvent(new Event('change', { bubbles: true }));    // o motor de foco recalcula a meta
    }
  }

  // ── 2) Card "Seus melhores horários" ─────────────────────────────────────
  function bestWindows() {
    var a = A(), d = D(); if (!a || !d) return [];
    var rows = a.bestSlots(d, Date.now(), 40).filter(function (r) { return r.samples >= 2.5 && r.score >= 0.6; });
    // agrupa horas vizinhas do mesmo dia (ex.: 19h e 20h → 19h–21h)
    var byDay = {}; rows.forEach(function (r) { (byDay[r.dow] = byDay[r.dow] || []).push(r); });
    var out = [];
    Object.keys(byDay).forEach(function (k) {
      var hs = byDay[k].sort(function (x, y) { return x.hour - y.hour; }), cur = null;
      hs.forEach(function (r) {
        if (cur && r.hour === cur.end) { cur.end = r.hour + 1; cur.score = Math.max(cur.score, r.score); }
        else { if (cur) out.push(cur); cur = { dow: Number(k), start: r.hour, end: r.hour + 1, score: r.score }; }
      });
      if (cur) out.push(cur);
    });
    return out.sort(function (x, y) { return y.score - x.score; }).slice(0, 3);
  }
  function mountCard() {
    var content = document.getElementById('content-area');
    if (!content || document.getElementById('slc-best-hours') || !content.querySelector('.dashboard-header')) return;
    var w = bestWindows(); if (!w.length) return;
    var now = A().localParts(Date.now()), today = w.filter(function (x) { return x.dow === now.weekday && x.end > now.hour; })[0];
    var lines = w.map(function (x) { return '<li><b>' + ABBR[x.dow] + '</b> · ' + String(x.start).padStart(2, '0') + 'h–' + String(x.end).padStart(2, '0') + 'h</li>'; }).join('');
    var card = document.createElement('div'); card.id = 'slc-best-hours'; card.className = 'card';
    card.style.cssText = 'padding:14px 16px;margin-bottom:16px;border-left:4px solid var(--accent,#4f6bff);';
    card.innerHTML = '<div style="font-weight:700;margin-bottom:6px">🎯 Seus melhores horários para estudar</div>' +
      '<ul style="margin:0 0 6px 18px;padding:0;font-size:.92rem">' + lines + '</ul>' +
      '<p style="margin:0;font-size:.82rem;opacity:.75">' + (today ? 'Hoje o seu horário forte é a partir das ' + String(today.start).padStart(2, '0') + 'h. Reserve esse bloco.' : 'Aprendi isso com as suas respostas e sessões. Quanto mais você responde, mais preciso fica.') + '</p>';
    var anchor = document.getElementById('slc-priority-card') || content.querySelector('.dashboard-header');
    anchor.insertAdjacentElement('afterend', card);
  }

  function run() { try { applyFocusDefault(); mountCard(); } catch (e) { /* nunca quebra a tela */ } }
  new MutationObserver(function () { clearTimeout(run._t); run._t = setTimeout(run, 250); }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('app-ready', function () { setTimeout(run, 600); });
})();
