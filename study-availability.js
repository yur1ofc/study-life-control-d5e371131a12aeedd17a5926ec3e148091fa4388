// study-availability.js — cérebro de disponibilidade do SLCampus.
// Funciona no navegador (window.SLCAvailability) e no servidor (require).
// Aprende QUANDO a pessoa pode estudar a partir de: blocos de "ocupado"
// (trabalho, academia… texto livre, ilimitado), respostas "posso / não posso"
// e sessões realmente concluídas. Nunca avisa de madrugada nem em bloco ocupado.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SLCAvailability = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var TZ = 'America/Sao_Paulo';
  var DEFAULT_QUIET = { wake: '07:00', sleep: '22:30' };
  var PENDING_TTL_MS = 90 * 60000;
  var MAX_BLOCKS = 60, MAX_HISTORY = 60;

  function norm(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function timeMin(v) { var m = String(v || '').match(/^(\d{1,2}):(\d{2})$/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; }
  function fmt(min) { min = Math.max(0, Math.min(1439, Math.round(min))); return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0'); }
  function uid(p) { return (p || 'av') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function localParts(now) {
    var p = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(now));
    var g = function (t) { var x = p.find(function (y) { return y.type === t; }); return x ? x.value : ''; };
    var wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    var h = Number(g('hour') || 0); if (h === 24) h = 0;
    return { date: g('year') + '-' + g('month') + '-' + g('day'), weekday: wd[g('weekday')] || 0, hour: h, minute: Number(g('minute') || 0), min: h * 60 + Number(g('minute') || 0) };
  }
  function dateOffset(date, delta) { var a = date.split('-').map(Number); var d = new Date(Date.UTC(a[0], a[1] - 1, a[2])); d.setUTCDate(d.getUTCDate() + delta); return d.toISOString().slice(0, 10); }
  function dowOf(date) { return new Date(date + 'T00:00:00Z').getUTCDay(); }

  function getState(data) {
    var s = data && data.studyAvailability && typeof data.studyAvailability === 'object' ? data.studyAvailability : {};
    s.version = 1;
    s.quiet = s.quiet && timeMin(s.quiet.wake) != null && timeMin(s.quiet.sleep) != null ? s.quiet : { wake: DEFAULT_QUIET.wake, sleep: DEFAULT_QUIET.sleep };
    s.blocks = Array.isArray(s.blocks) ? s.blocks : [];
    s.stats = s.stats && typeof s.stats === 'object' ? s.stats : {};
    s.history = Array.isArray(s.history) ? s.history : [];
    s.ask = s.ask && typeof s.ask === 'object' ? s.ask : {};
    if (data) data.studyAvailability = s;
    return s;
  }
  function quietBounds(data) { var q = getState(data).quiet; return { wake: timeMin(q.wake), sleep: timeMin(q.sleep) }; }

  // ── Blocos ocupados ──────────────────────────────────────────────────────
  function busyIntervals(data, date) {
    var s = getState(data), dow = dowOf(date), out = [];
    s.blocks.forEach(function (b) {
      var st = timeMin(b.start), en = timeMin(b.end);
      if (st == null || en == null || en <= st) return;
      var hit = (Array.isArray(b.days) && b.days.length) ? b.days.indexOf(dow) >= 0 && !(b.skip || []).includes(date) : b.date === date;
      if (hit) out.push({ start: st, end: en, label: b.label || 'Compromisso' });
    });
    return out;
  }
  function addBlock(data, b) {
    var s = getState(data);
    var blk = { id: uid('blk'), label: String(b.label || 'Compromisso').slice(0, 60), start: b.start, end: b.end, days: b.days && b.days.length ? b.days.slice().sort() : [], date: b.days && b.days.length ? null : b.date, source: b.source || 'user', createdAt: new Date().toISOString() };
    var dup = s.blocks.find(function (x) { return x.label === blk.label && x.start === blk.start && x.end === blk.end && x.date === blk.date && JSON.stringify(x.days || []) === JSON.stringify(blk.days); });
    if (dup) return dup;
    s.blocks.push(blk);
    var today = localParts(Date.now()).date, cutoff = dateOffset(today, -2);
    s.blocks = s.blocks.filter(function (x) { return (x.days && x.days.length) || !x.date || x.date >= cutoff; }).slice(-MAX_BLOCKS);
    return blk;
  }
  function removeBlock(data, id) { var s = getState(data); s.blocks = s.blocks.filter(function (b) { return b.id !== id; }); }

  // ── Aprendizado ──────────────────────────────────────────────────────────
  function key(dow, hour) { return 'd' + dow + 'h' + hour; }
  function slotProbability(data, dow, hour) {
    var s = getState(data), st = s.stats;
    function get(k) { var x = st[k] || { y: 0, n: 0 }; return x; }
    var sp = get(key(dow, hour)), sam = sp.y + sp.n;
    // Mesmo horário em outros dias (padrão geral da pessoa)
    var gy = 0, gn = 0; for (var d = 0; d < 7; d++) { var o = get(key(d, hour)); gy += o.y; gn += o.n; }
    var generic = (gy + 1) / (gy + gn + 2);
    var specific = (sp.y + generic * 2) / (sam + 2);       // suavizado em direção ao padrão geral
    var w = Math.min(1, sam / 4);
    return { p: w * specific + (1 - w) * generic, samples: sam + gy + gn };
  }
  function recordAnswer(data, slot, answer, extra) {
    var s = getState(data), k = key(slot.dow, slot.hour), c = s.stats[k] || { y: 0, n: 0 };
    c.y *= 0.97; c.n *= 0.97;                               // memória que esquece devagar (rotina muda)
    if (answer === 'yes') c.y += 1; else if (answer === 'no') c.n += 1; else c.n += 0.3;
    c.last = new Date().toISOString(); s.stats[k] = c;
    s.history.push(Object.assign({ at: c.last, dow: slot.dow, hour: slot.hour, answer: answer }, extra || {}));
    s.history = s.history.slice(-MAX_HISTORY);
  }
  function learnFromSessions(data, now) {
    // Cada sessão concluída é um "sim" implícito (peso menor que uma resposta direta).
    var out = {}, cutoff = now - 60 * 86400000;
    (data.sessions || []).forEach(function (x) {
      if (!x || !x.concluida) return;
      var raw = x.data || x.inicio || x.dataConclusao; if (!raw) return;
      var t = Date.parse(String(raw).length === 16 ? raw + ':00-03:00' : raw); if (!t || t < cutoff) return;
      var lp = localParts(t), k = key(lp.weekday, lp.hour); out[k] = (out[k] || 0) + 0.5;
    });
    return out;
  }
  function bestSlots(data, now, limit) {
    var s = getState(data), extra = learnFromSessions(data, now), rows = [];
    for (var d = 0; d < 7; d++) for (var h = 6; h <= 22; h++) {
      var k = key(d, h), base = s.stats[k] || { y: 0, n: 0 }, y = base.y + (extra[k] || 0), n = base.n;
      if (y + n < 1.5) continue;
      rows.push({ dow: d, hour: h, score: (y + 1) / (y + n + 2), samples: y + n });
    }
    rows.sort(function (a, b) { return b.score - a.score || b.samples - a.samples; });
    return rows.slice(0, limit || 5);
  }

  // ── Decisão: perguntar agora? ───────────────────────────────────────────
  // ctx: { free:{remaining,endsAt}, studyToday, targetMin, nextExamDays, studiedYesterday }
  function expirePending(data, now) {
    var s = getState(data), p = s.pending; if (!p) return false;
    if (Date.parse(p.expiresAt || 0) > now) return false;
    if (p.kind === 'ask') s.ask.ignored = (s.ask.ignored || 0) + 1;   // não respondeu
    s.pending = null; return true;
  }
  function pressureLevel(ctx) {
    var pr = 0;
    if (ctx.targetMin > 0 && ctx.targetMin - ctx.studyToday > 10) pr++;
    if (ctx.nextExamDays != null && ctx.nextExamDays <= 3) pr++;
    if (ctx.studiedYesterday === false && ctx.studyToday < 15) pr++;
    return Math.min(3, pr);
  }
  function decideAsk(data, now, ctx) {
    var s = getState(data), lp = localParts(now), q = quietBounds(data);
    expirePending(data, now);
    if (s.pending) return null;                                    // já tem pergunta aberta
    if (lp.min < q.wake + 15 || lp.min > q.sleep - 60) return null; // silêncio: nada de aviso cedo/tarde demais
    if (!ctx.free || ctx.free.remaining < 20) return null;
    var pr = pressureLevel(ctx);
    var urgent = ctx.nextExamDays != null && ctx.nextExamDays <= 2;
    if (ctx.targetMin > 0 && ctx.targetMin - ctx.studyToday <= 10 && !urgent) return null; // meta feita: não enche
    var ask = s.ask, today = lp.date;
    var sentToday = ask.date === today ? (ask.today || 0) : 0;
    var maxDay = urgent ? 4 : 3, ign = ask.ignored || 0;
    if (ign >= 4) maxDay = 1; else if (ign >= 2) maxDay = 2;       // ignorou várias: recua, sem desistir
    if (sentToday >= maxDay) return null;
    var snooze = Date.parse(s.snoozeUntil || 0) || 0;
    if (snooze && now < snooze) return null;
    var gapMin = pr >= 2 ? 60 : 100; if (ign >= 2) gapMin = Math.max(gapMin, 180);
    var last = Date.parse(ask.lastAt || 0) || 0;
    if (!snooze && last && now - last < gapMin * 60000) return null;
    var pb = slotProbability(data, lp.weekday, lp.hour);
    var threshold = pr >= 2 ? 0.2 : pr === 1 ? 0.3 : 0.4;
    if (pb.samples >= 3 && pb.p < threshold) return null;         // costuma não poder nesse horário
    return { pressure: pr, urgent: urgent, probability: pb.p, samples: pb.samples, slot: { dow: lp.weekday, hour: lp.hour } };
  }
  function markAsked(data, now, decision, info) {
    var s = getState(data), lp = localParts(now);
    s.ask.date = lp.date; s.ask.today = (s.ask.date === lp.date && s.ask.lastDate === lp.date ? (s.ask.today || 0) : 0) + 1;
    s.ask.lastDate = lp.date; s.ask.lastAt = new Date(now).toISOString(); s.snoozeUntil = null;
    s.pending = { id: info.id || uid('q'), kind: 'ask', sentAt: s.ask.lastAt, expiresAt: new Date(now + PENDING_TTL_MS).toISOString(), date: lp.date, startMin: lp.min, endMin: lp.min + Math.floor(info.remaining || 30), slot: decision.slot, subject: info.subject || '', minutes: info.minutes || 30 };
    return s.pending;
  }

  // ── Textos (motivação sem ser chato) ────────────────────────────────────
  var NUDGE = {
    0: ['Pouco tempo já conta: constância vence maratona.', 'Começar é a parte mais difícil — depois flui.', 'Um bloco curto agora e o resto do dia fica leve.'],
    1: ['Hoje a meta ainda está aberta. Esse intervalo resolve boa parte.', 'Quem estuda um pouco todo dia chega bem na prova.', 'Dá pra adiantar bastante agora.'],
    2: ['Você está atrás da meta de hoje e a prova está chegando. Esse é o melhor momento.', 'Se não for agora, vai apertar depois. Bora?'],
    3: ['Hoje ainda não rolou nada e o prazo está perto. Vamos recuperar agora, só uns minutos já mudam o dia.']
  };
  function pick(arr, seed) { return arr[Math.abs(seed) % arr.length]; }
  function buildAskMessage(o) {
    var until = o.endsAt != null ? ' (livre até ' + fmt(o.endsAt) + ')' : '';
    var what = o.subject ? ' ' + o.subject : '';
    var head = '🧠 Você parece livre agora' + until + '. Dá pra estudar' + what + ' por ' + o.minutes + ' min?';
    var nudge = pick(NUDGE[o.pressure] || NUDGE[0], o.seed || 0);
    return { title: '🧠 Posso te chamar pra estudar?', body: head + (o.examText ? '\n' + o.examText : '') + (o.action ? '\nSugestão: ' + o.action + '.' : '') + '\n' + nudge };
  }

  // ── Interpretação de texto livre: "trabalho até 18h", "toda seg e qua das 8 às 17" ──
  var NUMW = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6 };
  var DAYS = { domingo: 0, dom: 0, segunda: 1, seg: 1, terca: 2, ter: 2, quarta: 3, qua: 3, quinta: 4, qui: 4, sexta: 5, sex: 5, sabado: 6, sab: 6 };
  function parseBusyReply(text, ctx) {
    ctx = ctx || {}; var raw = String(text || '').trim(), n = norm(raw).replace(/\b(um|uma|dois|duas|tres|quatro|cinco|seis)\b(?=\s*(horas?|h\b|min))/g, function (m) { return NUMW[m]; });
    n = n.replace(/meia hora/g, '30 min').replace(/(\d)\s*h\s*(\d{2})\b/g, '$1:$2');
    var nowMin = ctx.nowMin != null ? ctx.nowMin : 0, sleep = ctx.sleepMin != null ? ctx.sleepMin : 22 * 60 + 30;
    var res = { label: '', days: [], date: ctx.date, start: null, end: null, wholeDay: false, needWhen: false };
    var rm = [];
    function hm(h, m) { h = Number(h); m = Number(m || 0); return h >= 0 && h <= 24 && m < 60 ? h * 60 + m : null; }
    // dias
    var rec = /\b(toda|todas|todo|todos|sempre|cada)\b/.test(n);
    if (/\b(todos os dias|todo dia|diariamente)\b/.test(n)) { res.days = [0, 1, 2, 3, 4, 5, 6]; rm.push(/\b(todos os dias|todo dia|diariamente)\b/g); }
    else if (/\b(dias uteis|segunda a sexta|seg a sex|de segunda a sexta)\b/.test(n)) { res.days = [1, 2, 3, 4, 5]; rm.push(/\b(de )?(dias uteis|segunda a sexta|seg a sex)\b/g); }
    else if (rec) {
      var re = /\b(domingo|segunda|terca|quarta|quinta|sexta|sabado|dom|seg|ter|qua|qui|sex|sab)\w*\b/g, m;
      while ((m = re.exec(n))) { var d = DAYS[m[1]]; if (res.days.indexOf(d) < 0) res.days.push(d); }
      rm.push(/\b(toda|todas|todo|todos|sempre|cada)s?\b/g, /\b(domingo|segunda|terca|quarta|quinta|sexta|sabado|dom|seg|ter|qua|qui|sex|sab)\w*(-feira)?\b/g);
    }
    if (/\bamanha\b/.test(n) && !res.days.length) { res.date = dateOffset(ctx.date, 1); nowMin = 0; rm.push(/\bamanha\b/g); }
    if (/\b(hoje nao|dia todo|dia inteiro|nao vou poder hoje|nao da hoje|o dia todo)\b/.test(n)) { res.wholeDay = true; res.start = nowMin; res.end = sleep; rm.push(/\b(hoje nao|o dia todo|dia todo|dia inteiro|nao vou poder hoje|nao da hoje)\b/g); }
    // horário
    var r = n.match(/\b(?:das?|de)\s*(\d{1,2})(?::(\d{2}))?\s*h?\s*(?:as|a|ate|-)\s*(\d{1,2})(?::(\d{2}))?\s*h?\b/) || n.match(/\b(\d{1,2})(?::(\d{2}))?\s*h?\s*-\s*(\d{1,2})(?::(\d{2}))?\s*h?\b/);
    if (r && !res.wholeDay) { res.start = hm(r[1], r[2]); res.end = hm(r[3], r[4]); rm.push(r[0]); }
    else if (!res.wholeDay) {
      var u = n.match(/\bate\s*(?:as\s*)?(\d{1,2})(?::(\d{2}))?\s*h?\b/);
      if (u) { res.end = hm(u[1], u[2]); rm.push(u[0]); }
      else {
        var du = n.match(/\b(?:por|durante|uns|umas|cerca de|mais)\s*(\d+(?:[.,]\d+)?)\s*(horas?|hrs?|h|minutos?|min)\b/) || n.match(/\b(\d+(?:[.,]\d+)?)\s*(horas?|minutos?|min)\b/);
        if (du) { var v = Number(du[1].replace(',', '.')); var mins = /^h/.test(du[2]) ? v * 60 : v; res.start = nowMin; res.end = nowMin + Math.round(mins); rm.push(du[0]); }
      }
    }
    if (res.start == null) res.start = (res.days.length && ctx.askedStart != null) ? ctx.askedStart : nowMin;
    if (res.end != null && res.end <= res.start && res.end + 720 > res.start && res.end < 720) res.end += 720;   // "até 6" às 14h => 18h
    if (res.end != null && res.end > 1439) res.end = 1439;
    res.needWhen = res.end == null || res.end <= res.start;
    // rótulo: mantém as palavras originais (com acento) e tira só o que é horário/dia/enchimento
    var STOP = /^(vou|to|estou|esta|tenho|ter|que|eu|preciso|ficar|fazer|porque|pq|nao|n|posso|poder|agora|hoje|amanha|das?|de|do|dos|ate|as|a|em|na|no|e|por|durante|uns|umas|cerca|mais|hora|horas|hrs|hr|h|min|minutos?|meia|toda|todas|todo|todos|sempre|cada|dias|dia|uteis|inteiro|todo|estudar|mas|so|sim|ok)$/;
    var words = raw.split(/\s+/).filter(function (w) {
      var k = norm(w).replace(/[,.;!?]/g, '');
      if (!k || STOP.test(k)) return false;
      if (/^\d{1,2}([:h]\d{0,2})?h?$/.test(k) || /^\d+([.,]\d+)?(h|min)?$/.test(k)) return false;
      if (/^(domingo|segunda|terca|quarta|quinta|sexta|sabado|dom|seg|ter|qua|qui|sex|sab)(-feira)?s?$/.test(k)) return false;
      return true;
    });
    var ln = words.join(' ').replace(/[,.;!?]+$/g, '').trim();
    res.label = ln ? (ln.charAt(0).toUpperCase() + ln.slice(1)).slice(0, 50) : 'Compromisso';
    return res;
  }
  function describeBlock(b) {
    var names = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
    var when = b.days && b.days.length ? (b.days.length === 7 ? 'todos os dias' : b.days.map(function (d) { return names[d]; }).join(', ')) : 'só hoje/data única';
    return b.label + ' · ' + when + ' · ' + b.start + '–' + b.end;
  }
  // Se a pessoa disse "não posso" pelo mesmo motivo no mesmo dia da semana 2+ vezes, vira rotina fixa.
  function autoRecurring(data, blk, dow) {
    var s = getState(data); if (!blk || (blk.days && blk.days.length)) return null;
    var same = s.history.filter(function (h) { return h.answer === 'no' && h.dow === dow && h.label && norm(h.label) === norm(blk.label); });
    if (same.length < 3) return null;                         // inclui a resposta atual
    var rec = addBlock(data, { label: blk.label, start: blk.start, end: blk.end, days: [dow], source: 'auto' });
    return rec;
  }
  function summary(data, now) {
    var s = getState(data), names = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
    var best = bestSlots(data, now, 3).map(function (b) { return names[b.dow] + ' ' + fmt(b.hour * 60); });
    return { blocks: s.blocks.map(describeBlock), best: best, answers: s.history.length };
  }
  return { getState: getState, quietBounds: quietBounds, busyIntervals: busyIntervals, addBlock: addBlock, removeBlock: removeBlock, slotProbability: slotProbability, recordAnswer: recordAnswer, bestSlots: bestSlots, decideAsk: decideAsk, markAsked: markAsked, expirePending: expirePending, buildAskMessage: buildAskMessage, parseBusyReply: parseBusyReply, describeBlock: describeBlock, autoRecurring: autoRecurring, summary: summary, localParts: localParts, dateOffset: dateOffset, timeMin: timeMin, fmt: fmt, norm: norm, PENDING_TTL_MS: PENDING_TTL_MS };
});
