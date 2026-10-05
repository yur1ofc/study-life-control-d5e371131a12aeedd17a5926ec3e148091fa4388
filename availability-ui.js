// availability-ui.js — tela "Disponibilidade para estudar" + pergunta "Posso te chamar?".
// Usa o mesmo cérebro do servidor (study-availability.js → window.SLCAvailability).
(function () {
  'use strict';
  var A = function () { return window.SLCAvailability; };
  var DN = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  function esc(s) { return window.escapeHtml ? window.escapeHtml(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(m, t) { if (window.showToast) window.showToast(m, t); }
  function data() { return window.app && window.app.data; }
  function state() { return A().getState(data()); }
  function persist() { return window.dbService ? window.dbService.saveData('studyAvailability', state()) : Promise.resolve(false); }
  var draftDays = [1, 2, 3, 4, 5];

  // ── Card em Configurações ───────────────────────────────────────────────
  function cardHtml() {
    var s = state(), sum = A().summary(data(), Date.now());
    var blocks = s.blocks.length ? s.blocks.map(function (b) {
      return '<div class="config-item" style="justify-content:space-between;gap:8px"><span>' + esc(A().describeBlock(b)) + '</span><button type="button" class="btn-secondary" data-av-del="' + esc(b.id) + '" aria-label="Remover">✕</button></div>';
    }).join('') : '<p style="font-size:.85rem;color:var(--text-tertiary)">Nenhum compromisso ainda. Adicione trabalho, academia, curso… o que ocupa seu tempo.</p>';
    var best = sum.best.length ? '<p style="font-size:.85rem;margin-top:8px">🎯 Seus melhores horários (aprendidos): <b>' + esc(sum.best.join(', ')) + '</b></p>' : '<p style="font-size:.85rem;color:var(--text-tertiary);margin-top:8px">Ainda aprendendo. Quanto mais você responde “posso / não posso”, mais certeiros ficam os avisos.</p>';
    var chips = DN.map(function (n, i) { return '<button type="button" class="wiz-day-btn ' + (draftDays.indexOf(i) >= 0 ? 'active' : '') + '" data-av-day="' + i + '">' + n + '</button>'; }).join('');
    return '<div id="av-card"><div class="config-section-title" style="margin-top:28px;">🗓️ Disponibilidade para estudar</div>' +
      '<p style="font-size:.82rem;color:var(--text-tertiary);margin:-6px 0 12px;">Eu só te chamo para estudar quando você está livre. Conte o que ocupa seu tempo (qualquer coisa) e eu aprendo sua rotina.</p>' +
      '<div class="config-item" style="flex-direction:column;align-items:stretch;gap:10px;">' + blocks +
      '<div class="wiz-field"><label>Novo compromisso</label><input type="text" id="av-label" maxlength="50" placeholder="Ex: Trabalho, academia, curso de inglês"></div>' +
      '<div class="wiz-days" id="av-days">' + chips + '</div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap"><div class="wiz-field" style="flex:1;min-width:120px"><label>Início</label><input type="time" id="av-start" value="08:00"></div><div class="wiz-field" style="flex:1;min-width:120px"><label>Fim</label><input type="time" id="av-end" value="17:00"></div></div>' +
      '<label style="font-size:.85rem"><input type="checkbox" id="av-once"> Só hoje (não repetir)</label>' +
      '<button type="button" class="btn-primary" id="av-add"><i class="fas fa-plus"></i> Adicionar</button>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap"><div class="wiz-field" style="flex:1;min-width:120px"><label>Acordo às</label><input type="time" id="av-wake" value="' + esc(s.quiet.wake) + '"></div><div class="wiz-field" style="flex:1;min-width:120px"><label>Durmo às</label><input type="time" id="av-sleep" value="' + esc(s.quiet.sleep) + '"></div></div>' +
      '<p style="font-size:.78rem;color:var(--text-tertiary)">Fora desse horário eu não mando aviso.</p>' + best + '</div></div>';
  }
  function injectCard() {
    if (!data() || !A() || document.getElementById('av-card')) return;
    var titles = document.querySelectorAll('.config-section-title');
    for (var i = 0; i < titles.length; i++) {
      if (/Sua rotina/.test(titles[i].textContent)) { var w = document.createElement('div'); w.innerHTML = cardHtml(); titles[i].parentNode.insertBefore(w.firstChild, titles[i]); return; }
    }
  }
  function rerender() { var c = document.getElementById('av-card'); if (!c) return; var w = document.createElement('div'); w.innerHTML = cardHtml(); c.replaceWith(w.firstChild); }

  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-av-day],[data-av-del],#av-add'); if (!t || !A() || !data()) return;
    if (t.hasAttribute('data-av-day')) { var d = Number(t.getAttribute('data-av-day')), k = draftDays.indexOf(d); if (k >= 0) draftDays.splice(k, 1); else draftDays.push(d); t.classList.toggle('active'); return; }
    if (t.hasAttribute('data-av-del')) { A().removeBlock(data(), t.getAttribute('data-av-del')); persist().then(function () { toast('Compromisso removido'); rerender(); }); return; }
    if (t.id === 'av-add') {
      var label = (document.getElementById('av-label').value || '').trim(), st = document.getElementById('av-start').value, en = document.getElementById('av-end').value, once = document.getElementById('av-once').checked;
      if (!label) return toast('Diga o que é o compromisso', 'error');
      if (!st || !en || A().timeMin(en) <= A().timeMin(st)) return toast('Confira o horário de início e fim', 'error');
      if (!once && !draftDays.length) return toast('Escolha os dias da semana', 'error');
      A().addBlock(data(), { label: label, start: st, end: en, days: once ? [] : draftDays.slice(), date: A().localParts(Date.now()).date, source: 'app' });
      persist().then(function () { toast('Compromisso salvo'); rerender(); });
    }
  });
  document.addEventListener('change', function (e) {
    if (!A() || !data() || (e.target.id !== 'av-wake' && e.target.id !== 'av-sleep')) return;
    var w = document.getElementById('av-wake').value, s = document.getElementById('av-sleep').value;
    if (A().timeMin(w) == null || A().timeMin(s) == null || A().timeMin(s) <= A().timeMin(w)) return toast('Horário de acordar/dormir inválido', 'error');
    state().quiet = { wake: w, sleep: s }; persist().then(function () { toast('Horário de silêncio salvo'); });
  });

  // ── Pergunta "Posso te chamar?" (abre ao tocar na notificação) ───────────
  function overlay(inner) {
    var o = document.getElementById('av-overlay'); if (o) o.remove();
    o = document.createElement('div'); o.id = 'av-overlay'; o.className = 'exam-popup-overlay';
    o.innerHTML = '<div class="exam-popup-card" role="dialog" aria-modal="true">' + inner + '</div>';
    document.body.appendChild(o); requestAnimationFrame(function () { o.classList.add('is-visible'); });
    o.addEventListener('click', function (e) { if (e.target === o) close(); }); return o;
  }
  function close() { var o = document.getElementById('av-overlay'); if (o) { o.classList.remove('is-visible'); setTimeout(function () { o.remove(); }, 200); } }
  function showAsk() {
    var s = state(), p = s.pending; if (!p || p.kind !== 'ask' || Date.parse(p.expiresAt) < Date.now()) return;
    var o = overlay('<div class="exam-popup-icon"><i class="fas fa-brain"></i></div><h3>Dá pra estudar agora?</h3><p class="text-secondary">' + (p.subject ? esc(p.subject) + ' · ' : '') + esc(p.minutes) + ' min. Seu horário parece livre.</p>' +
      '<div class="exam-popup-actions" style="flex-direction:column;gap:8px"><button class="btn-primary" id="av-yes">✅ Posso estudar agora</button><button class="btn-secondary" id="av-later">⏰ Daqui a 30 min</button><button class="btn-secondary" id="av-no">❌ Não posso</button></div>');
    o.querySelector('#av-yes').onclick = function () { A().recordAnswer(data(), p.slot, 'yes'); s.pending = null; s.ask.ignored = 0; persist(); close(); if (window.app && window.app.openModal) window.app.openModal('sessao', { materia: p.subject || '', tipo: 'foco', topico: '' }); };
    o.querySelector('#av-later').onclick = function () { A().recordAnswer(data(), p.slot, 'later'); s.pending = null; s.ask.ignored = 0; s.snoozeUntil = new Date(Date.now() + 30 * 60000).toISOString(); persist(); close(); toast('Volto em 30 min ⏰'); };
    o.querySelector('#av-no').onclick = function () { showReason(p); };
  }
  function showReason(p) {
    var o = overlay('<h3>O que você vai fazer?</h3><p class="text-secondary">Pode ser qualquer coisa. Ex.: “trabalho até 18h”, “academia por 1 hora”, “toda segunda trabalho das 8 às 17”.</p><div class="wiz-field" style="text-align:left"><input type="text" id="av-why" maxlength="120" placeholder="O que e até quando?"></div><div class="exam-popup-actions"><button class="btn-secondary" id="av-cancel">Cancelar</button><button class="btn-primary" id="av-save">Salvar</button></div>');
    o.querySelector('#av-cancel').onclick = close;
    o.querySelector('#av-save').onclick = function () {
      var txt = o.querySelector('#av-why').value.trim(); if (!txt) return;
      var lp = A().localParts(Date.now()), q = A().quietBounds(data());
      var r = A().parseBusyReply(txt, { date: lp.date, nowMin: lp.min, askedStart: p.startMin, sleepMin: q.sleep });
      if (r.needWhen) { toast('Faltou o horário: diga “até 18h” ou “2 horas”', 'error'); return; }
      var blk = A().addBlock(data(), { label: r.label, start: A().fmt(r.start), end: A().fmt(r.end), days: r.days, date: r.date, source: 'app' });
      A().recordAnswer(data(), p.slot, 'no', { label: r.label }); A().autoRecurring(data(), blk, lp.weekday);
      var s = state(); s.pending = null; s.ask.ignored = 0; persist(); close(); toast('Anotado: ' + A().describeBlock(blk));
    };
  }

  function boot() {
    if (!data() || !A()) return;
    try { A().expirePending(data(), Date.now()); } catch (_) { }
    var p = state().pending;
    var wanted = new URLSearchParams(location.search).get('av');
    if (p && p.kind === 'ask' && (!wanted || wanted === p.id)) setTimeout(showAsk, 1500);
    if (wanted) { try { history.replaceState(null, '', location.pathname); } catch (_) { } }
  }
  document.addEventListener('app-ready', boot);
  new MutationObserver(function () { injectCard(); }).observe(document.documentElement, { childList: true, subtree: true });
  window.SLCAvailabilityUI = { showAsk: showAsk, injectCard: injectCard };
})();
