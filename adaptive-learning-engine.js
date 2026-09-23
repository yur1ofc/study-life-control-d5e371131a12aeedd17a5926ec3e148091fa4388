// SLCampus — Motor de Aprendizado Adaptativo V1
// Aprende a capacidade real do usuário em vez de tratar o valor informado no
// cadastro como uma obrigação. O cadastro é um ponto de partida; sessões,
// consistência, excesso de estudo, evidências de aprendizagem e dificuldade
// observada ajustam o sistema progressivamente.
(function () {
  'use strict';

  const VERSION = 2;
  const DAY = 86400000;
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const num = (v, fallback = 0) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : fallback; };
  const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const dateKey = value => {
    const d = value instanceof Date ? new Date(value) : new Date(value || Date.now());
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const today = () => dateKey(new Date());
  const completed = s => !!s && (s.concluida === true || s.status === 'concluida');
  const sessionMinutes = s => Math.max(0, Math.round(num(s?.duracaoReal ?? s?.duracaoMin ?? s?.duracao, 0)));

  function maxAvailableMinutes(app) {
    const user = app?.data?.user || {};
    const hours = clamp(num(user.horasMaximas, 4), 0.5, 12);
    const commute = clamp(num(user.tempoDeslocamento, 0), 0, hours * 60 - 15);
    return Math.max(45, Math.round(hours * 60 - commute));
  }

  function dayTotals(app, daysBack = 28) {
    const out = {};
    const now = Date.now();
    (app?.data?.sessions || []).filter(completed).forEach(s => {
      const d = new Date(s.data || s.dataConclusao || s.inicio || 0);
      if (Number.isNaN(d.getTime())) return;
      if (now - d.getTime() > daysBack * DAY || d.getTime() > now + DAY) return;
      const key = dateKey(d);
      out[key] = (out[key] || 0) + sessionMinutes(s);
    });
    return out;
  }

  function activeDailyValues(totals, daysBack = 14) {
    const values = [];
    const base = new Date();
    for (let i = 0; i < daysBack; i += 1) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      const v = num(totals[dateKey(d)], 0);
      if (v > 0) values.push(v);
    }
    return values;
  }

  function median(values) {
    const a = values.slice().sort((x, y) => x - y);
    if (!a.length) return 0;
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  function percentile(values, p) {
    const a = values.slice().sort((x, y) => x - y);
    if (!a.length) return 0;
    const idx = (a.length - 1) * p;
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return lo === hi ? a[lo] : a[lo] + (a[hi] - a[lo]) * (idx - lo);
  }

  function ensure(app) {
    if (!app?.data) return null;
    app.data.user = app.data.user || {};
    const user = app.data.user;
    const existing = user.adaptiveLearning && typeof user.adaptiveLearning === 'object' ? user.adaptiveLearning : {};
    if (Number(existing.version) !== VERSION) {
      user.adaptiveLearning = {
        version: VERSION,
        initializedAt: existing.initializedAt || new Date().toISOString(),
        dailyTargetMinutes: num(existing.dailyTargetMinutes, 0),
        dailyHistory: existing.dailyHistory && typeof existing.dailyHistory === 'object' ? existing.dailyHistory : {},
        adjustments: Array.isArray(existing.adjustments) ? existing.adjustments.slice(-30) : [],
        consecutiveHitDays: num(existing.consecutiveHitDays, 0),
        consecutiveOverDays: num(existing.consecutiveOverDays, 0),
        consecutiveUnderDays: num(existing.consecutiveUnderDays, 0),
        lastAdjustmentDate: existing.lastAdjustmentDate || '',
        lastReason: existing.lastReason || 'inicial',
        preferredSessionMinutes: clamp(num(existing.preferredSessionMinutes, 45), 25, 90),
        preferredStudyWindows: existing.preferredStudyWindows && typeof existing.preferredStudyWindows === 'object' ? existing.preferredStudyWindows : { manha: 0, tarde: 0, noite: 0, madrugada: 0 },
        preferredStudyHours: Array.isArray(existing.preferredStudyHours) ? existing.preferredStudyHours.slice(-12) : [],
        learningConfidence: existing.learningConfidence || 'inicial'
      };
    }
    const a = user.adaptiveLearning;
    if (!a.dailyHistory || typeof a.dailyHistory !== 'object') a.dailyHistory = {};
    if (!Array.isArray(a.adjustments)) a.adjustments = [];
    if (!Number.isFinite(Number(a.preferredSessionMinutes))) a.preferredSessionMinutes = 45;
    if (!a.preferredStudyWindows || typeof a.preferredStudyWindows !== 'object') a.preferredStudyWindows = { manha: 0, tarde: 0, noite: 0, madrugada: 0 };
    for (const k of ['manha','tarde','noite','madrugada']) a.preferredStudyWindows[k] = Math.max(0, num(a.preferredStudyWindows[k], 0));
    if (!Array.isArray(a.preferredStudyHours)) a.preferredStudyHours = [];
    return a;
  }

  function initialTarget(app) {
    const max = maxAvailableMinutes(app);
    const totals = dayTotals(app, 60);
    const values = activeDailyValues(totals, 21);
    if (values.length >= 3) {
      // Começa perto do que a pessoa já demonstrou conseguir, sem transformar
      // um pico isolado em obrigação. O percentil 60 dá espaço para progresso.
      return Math.round(clamp(percentile(values, 0.60), 45, max * 0.85) / 5) * 5;
    }
    // Sem histórico: parte conservadoramente de ~45% da disponibilidade máxima declarada.
    return Math.round(clamp(max * 0.45, 45, 180) / 5) * 5;
  }

  function refreshDay(app) {
    const a = ensure(app);
    if (!a) return null;
    const max = maxAvailableMinutes(app);
    if (!Number.isFinite(Number(a.dailyTargetMinutes)) || Number(a.dailyTargetMinutes) <= 0) {
      a.dailyTargetMinutes = initialTarget(app);
      a.lastReason = 'ponto de partida';
    }
    a.dailyTargetMinutes = clamp(Math.round(num(a.dailyTargetMinutes, 60) / 5) * 5, 30, Math.max(30, max));

    const key = today();
    const totals = dayTotals(app, 60);
    const actual = num(totals[key], 0);
    if (!a.dailyHistory[key]) {
      a.dailyHistory[key] = { target: a.dailyTargetMinutes, actual: 0, updatedAt: new Date().toISOString() };
    }
    a.dailyHistory[key].target = num(a.dailyHistory[key].target, a.dailyTargetMinutes);
    a.dailyHistory[key].actual = actual;
    a.dailyHistory[key].updatedAt = new Date().toISOString();

    // Mantém histórico enxuto.
    const keys = Object.keys(a.dailyHistory).sort();
    keys.slice(0, Math.max(0, keys.length - 45)).forEach(k => delete a.dailyHistory[k]);
    return a;
  }

  function completedDayRows(app, lookback = 14) {
    const a = refreshDay(app);
    if (!a) return [];
    const rows = [];
    const base = new Date();
    for (let i = 0; i < lookback; i += 1) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      const key = dateKey(d);
      const row = a.dailyHistory[key];
      if (!row) continue;
      const target = num(row.target, 0), actual = num(row.actual, 0);
      if (target <= 0 && actual <= 0) continue;
      rows.push({ key, target, actual, ratio: target ? actual / target : 0 });
    }
    return rows;
  }

  function adapt(app, force = false) {
    const a = refreshDay(app);
    if (!a) return null;
    const max = maxAvailableMinutes(app);
    const rows = completedDayRows(app, 14).filter(r => r.key !== today());
    if (!rows.length) {
      a.learningConfidence = 'inicial';
      return snapshot(app);
    }

    const recent = rows.slice(0, 7);
    const last3 = recent.slice(0, 3);
    const hits = recent.filter(r => r.ratio >= 0.90).length;
    const overs = recent.filter(r => r.ratio >= 1.20).length;
    const unders = recent.filter(r => r.ratio < 0.65).length;
    const avgRatio = recent.reduce((s, r) => s + r.ratio, 0) / Math.max(1, recent.length);
    const consecutiveOver = last3.length === 3 && last3.every(r => r.ratio >= 1.15);
    const consecutiveHit = last3.length === 3 && last3.every(r => r.ratio >= 0.90);
    const consecutiveUnder = last3.length === 3 && last3.every(r => r.ratio < 0.65);

    a.consecutiveHitDays = consecutiveHit ? a.consecutiveHitDays + 1 : 0;
    a.consecutiveOverDays = consecutiveOver ? a.consecutiveOverDays + 1 : 0;
    a.consecutiveUnderDays = consecutiveUnder ? a.consecutiveUnderDays + 1 : 0;

    const todayKey = today();
    const lastAdjustment = a.lastAdjustmentDate;
    const daysSinceAdjustment = lastAdjustment ? Math.floor((new Date(`${todayKey}T00:00:00`) - new Date(`${lastAdjustment}T00:00:00`)) / DAY) : 99;
    if (!force && daysSinceAdjustment < 2) return snapshot(app);

    let factor = 1;
    let reason = 'ritmo mantido';
    // O sistema acelera quando o usuário demonstra excesso de capacidade.
    if (consecutiveOver || overs >= 4) {
      factor = 1.15;
      reason = 'capacidade demonstrada acima da meta';
    } else if (consecutiveHit || hits >= 5) {
      factor = 1.08;
      reason = 'constância acima do necessário';
    } else if (consecutiveUnder || unders >= 3) {
      factor = 0.82;
      reason = 'meta acima do ritmo sustentável';
    } else if (avgRatio < 0.78) {
      factor = 0.92;
      reason = 'aderência abaixo do ideal';
    } else if (avgRatio > 1.05) {
      factor = 1.05;
      reason = 'ritmo real acima da meta';
    }

    const oldTarget = num(a.dailyTargetMinutes, 60);
    // Nunca sobe mais de 15% nem desce mais de 20% em um ajuste.
    const next = clamp(Math.round((oldTarget * factor) / 5) * 5, oldTarget * 0.80, oldTarget * 1.15);
    const finalTarget = clamp(Math.round(next / 5) * 5, 30, max);
    if (Math.abs(finalTarget - oldTarget) >= 5) {
      a.dailyTargetMinutes = finalTarget;
      a.lastAdjustmentDate = todayKey;
      a.lastReason = reason;
      a.adjustments.push({ date: todayKey, from: oldTarget, to: finalTarget, reason });
      a.adjustments = a.adjustments.slice(-30);
    }
    a.learningConfidence = rows.length >= 10 ? 'alta' : rows.length >= 5 ? 'média' : 'baixa';
    return snapshot(app);
  }

  function updatePreferredSession(app) {
    const a = ensure(app);
    if (!a) return null;
    const values = (app.data.sessions || []).filter(completed).slice(-20).map(sessionMinutes).filter(v => v >= 5 && v <= 180);
    if (values.length >= 3) {
      // Preferência do usuário: mediana das sessões reais, com limites saudáveis.
      a.preferredSessionMinutes = clamp(Math.round(median(values) / 5) * 5, 25, 90);
    }
    return a.preferredSessionMinutes;
  }

  function updatePreferredStudyWindows(app) {
    const a = ensure(app);
    if (!a) return null;
    const rows = (app.data.sessions || []).filter(completed).slice(-40);
    const buckets = { manha: 0, tarde: 0, noite: 0, madrugada: 0 };
    const hours = [];
    rows.forEach(s => {
      const raw = s?.data || s?.dataConclusao || s?.inicio;
      const d = new Date(raw || '');
      if (Number.isNaN(d.getTime())) return;
      const h = d.getHours();
      hours.push(h);
      if (h >= 5 && h < 12) buckets.manha += 1;
      else if (h >= 12 && h < 18) buckets.tarde += 1;
      else if (h >= 18 && h < 24) buckets.noite += 1;
      else buckets.madrugada += 1;
    });
    if (rows.length >= 3) {
      a.preferredStudyWindows = buckets;
      a.preferredStudyHours = hours.slice(-12);
    }
    return a.preferredStudyWindows;
  }

  function preferredStudyWindow(app) {
    const a = ensure(app);
    if (!a) return null;
    updatePreferredStudyWindows(app);
    const entries = Object.entries(a.preferredStudyWindows || {});
    if (!entries.length || entries.every(([,v]) => !v)) return app?.data?.user?.turnoPrincipal || null;
    entries.sort((x,y) => y[1]-x[1]);
    return entries[0]?.[0] || app?.data?.user?.turnoPrincipal || null;
  }

  function subjectAdaptation(app, subject) {
    const name = String(subject || '').trim();
    const sessions = (app?.data?.sessions || []).filter(s => completed(s) && norm(s?.materia) === norm(name));
    const evidence = sessions.map(s => s?.learningEvidence?.level).filter(Boolean).slice(-8);
    const errors = (app?.data?.questionAttempts || []).filter(q => norm(q?.materia) === norm(name)).slice(-10);
    const weak = evidence.filter(x => ['doubt', 'review'].includes(x)).length;
    const strong = evidence.filter(x => ['explain', 'exercise'].includes(x)).length;
    const errorCount = errors.filter(x => ['erro', 'partial'].includes(norm(x?.result))).length;
    const confidence = clamp(3 + strong * 0.2 - weak * 0.4 - errorCount * 0.25, 1, 5);
    let minutesFactor = confidence <= 2.3 ? 1.20 : confidence >= 4.2 ? 0.85 : 1;
    if (sessions.length < 2) minutesFactor = 1;
    return { confidence: Number(confidence.toFixed(2)), minutesFactor, weak, strong, errorCount };
  }

  function snapshot(app) {
    const a = refreshDay(app);
    if (!a) return null;
    const target = num(a.dailyTargetMinutes, 60);
    const actual = num(a.dailyHistory?.[today()]?.actual, 0);
    const max = maxAvailableMinutes(app);
    const rows = completedDayRows(app, 14).filter(r => r.key !== today());
    const avg = rows.length ? rows.reduce((s, r) => s + r.actual, 0) / rows.length : 0;
    const adherence = rows.length ? rows.reduce((s, r) => s + Math.min(1.25, r.ratio), 0) / rows.length : null;
    updatePreferredSession(app);
    updatePreferredStudyWindows(app);
    return {
      dailyTargetMinutes: target,
      dailyTargetHours: +(target / 60).toFixed(2),
      actualTodayMinutes: actual,
      remainingMinutes: Math.max(0, target - actual),
      progressPercent: Math.min(100, Math.round((actual / Math.max(1, target)) * 100)),
      maxAvailableMinutes: max,
      averageRecentDailyMinutes: Math.round(avg),
      adherence: adherence === null ? null : Number(adherence.toFixed(2)),
      preferredSessionMinutes: clamp(num(a.preferredSessionMinutes, 45), 25, 90),
      preferredStudyWindow: preferredStudyWindow(app),
      preferredStudyWindows: { ...(a.preferredStudyWindows || {}) },
      confidence: a.learningConfidence || 'inicial',
      reason: a.lastReason || 'ponto de partida',
      lastAdjustmentDate: a.lastAdjustmentDate || null,
      nextTargetHint: target >= max ? 'No limite de disponibilidade informado.' : 'A meta pode subir conforme você demonstrar constância.'
    };
  }

  async function persist(app) {
    const a = refreshDay(app);
    if (!a || !window.dbService?.saveData) return false;
    await window.dbService.saveData('user', app.data.user);
    return true;
  }

  async function learn(app, options = {}) {
    if (!app?.data) return null;
    adapt(app, !!options.force);
    updatePreferredSession(app);
    const s = snapshot(app);
    await persist(app);
    return s;
  }

  function recommendedSessionMinutes(app, subject) {
    const s = snapshot(app);
    if (!s) return 45;
    const subjectAdj = subjectAdaptation(app, subject);
    const raw = s.preferredSessionMinutes * subjectAdj.minutesFactor;
    return clamp(Math.round(raw / 5) * 5, 25, Math.min(90, s.remainingMinutes || 90));
  }

  function subjectMinutes(app, subject, baseMinutes) {
    const adj = subjectAdaptation(app, subject);
    return clamp(Math.round(num(baseMinutes, 45) * adj.minutesFactor / 5) * 5, 20, 120);
  }

  function reviewIntervals(app, subject, level) {
    if (level === 'doubt' || level === 'review') return [1, 2, 4, 7, 14];
    if (level === 'explain') return [2, 5, 10, 21, 45];
    if (level === 'exercise') return [1, 4, 9, 21, 45];
    const adj = subjectAdaptation(app, subject);
    return adj.confidence >= 4 ? [2, 5, 10, 21, 45] : [1, 3, 7, 15, 30];
  }

  function getWeeklyTarget(app) {
    const s = snapshot(app);
    const days = Array.isArray(app?.data?.user?.diasPreferidos) && app.data.user.diasPreferidos.length ? app.data.user.diasPreferidos.length : 5;
    return Math.round((s?.dailyTargetMinutes || 60) * days);
  }

  async function applyEvidence(app, session, level) {
    if (!app || !session) return null;
    const a = ensure(app);
    const current = subjectAdaptation(app, session.materia);
    const evidenceBoost = level === 'explain' ? 1.08 : level === 'exercise' ? 1.02 : 0.94;
    a.preferredSessionMinutes = clamp(Math.round((num(a.preferredSessionMinutes, 45) * evidenceBoost) / 5) * 5, 25, 90);
    const snap = await learn(app, { force: false });
    document.dispatchEvent(new CustomEvent('slc-adaptive-updated', { detail: { snapshot: snap, subject: session.materia, level, current } }));
    return snap;
  }

  function install() {
    const app = window.app;
    if (!app) return;
    ensure(app);
    refreshDay(app);
  }

  window.SLCAdaptive = {
    VERSION,
    ensure,
    snapshot,
    learn,
    adapt: app => adapt(app || window.app, true),
    recommendedSessionMinutes,
    subjectMinutes,
    reviewIntervals,
    applyEvidence,
    getWeeklyTarget,
    maxAvailableMinutes,
    preferredStudyWindow,
    updatePreferredStudyWindows
  };

  document.addEventListener('app-ready', () => setTimeout(() => {
    try { install(); } catch (e) { console.warn('[SLCAdaptive] init', e); }
  }, 400));

  let timer = null;
  document.addEventListener('slc-data-saved', e => {
    const fields = e?.detail?.fields || [];
    if (!fields.some(f => ['sessions', 'grades', 'tasks', 'exams', 'learningEvidence', 'questionAttempts', 'classDiaries'].includes(f))) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      try { window.SLCAdaptive?.learn(window.app); } catch (err) { console.warn('[SLCAdaptive] learn', err); }
    }, 900);
  });
})();

// UI/planejamento patch: usa o motor adaptativo como fonte da meta real.
(function () {
  'use strict';
  const esc = v => window.escapeHtml ? window.escapeHtml(v ?? '') : String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const style = () => {
    if (document.getElementById('slc-adaptive-styles')) return;
    const s = document.createElement('style'); s.id = 'slc-adaptive-styles';
    s.textContent = `
      .slc-adaptive-card{margin:0 0 18px;padding:18px;border-radius:22px;border:1px solid rgba(99,102,241,.20);background:linear-gradient(135deg,rgba(99,102,241,.10),rgba(16,185,129,.07));box-shadow:0 8px 24px rgba(2,6,23,.14)}
      .slc-adaptive-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.slc-adaptive-head h3{margin:0 0 5px}.slc-adaptive-head p{margin:0;opacity:.78;font-size:.86rem}.slc-adaptive-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:rgba(15,23,42,.18);font-size:.78rem;font-weight:700}
      .slc-adaptive-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-top:14px}.slc-adaptive-kpi{padding:11px 12px;border-radius:15px;background:rgba(15,23,42,.14)}.slc-adaptive-kpi span{display:block;font-size:.75rem;opacity:.72}.slc-adaptive-kpi strong{display:block;margin-top:4px;font-size:1.02rem}.slc-adaptive-copy{margin:13px 0 0;font-size:.84rem;opacity:.86;line-height:1.45}
    `;
    document.head.appendChild(s);
  };
  function card(app){
    const s = window.SLCAdaptive?.snapshot?.(app); if (!s) return '';
    const h = Math.floor(s.dailyTargetMinutes / 60), m = s.dailyTargetMinutes % 60;
    const target = h ? `${h}h${m ? ` ${m}min` : ''}` : `${m}min`;
    const actual = s.actualTodayMinutes >= 60 ? `${Math.floor(s.actualTodayMinutes/60)}h ${s.actualTodayMinutes%60 ? `${s.actualTodayMinutes%60}min` : ''}`.trim() : `${s.actualTodayMinutes}min`;
    const remaining = s.remainingMinutes >= 60 ? `${Math.floor(s.remainingMinutes/60)}h ${s.remainingMinutes%60 ? `${s.remainingMinutes%60}min` : ''}`.trim() : `${s.remainingMinutes}min`;
    return `<div class="slc-adaptive-card" id="slc-adaptive-card"><div class="slc-adaptive-head"><div><h3><i class="fas fa-brain"></i> Meta que aprende com você</h3><p>O SLCampus começa conservador e ajusta o ritmo conforme seu estudo real.</p></div><span class="slc-adaptive-pill">${esc(s.confidence)}</span></div><div class="slc-adaptive-grid"><div class="slc-adaptive-kpi"><span>Meta de hoje</span><strong>${target}</strong></div><div class="slc-adaptive-kpi"><span>Feito hoje</span><strong>${actual}</strong></div><div class="slc-adaptive-kpi"><span>Restante</span><strong>${remaining}</strong></div><div class="slc-adaptive-kpi"><span>Bloco sugerido</span><strong>${s.preferredSessionMinutes} min</strong></div><div class="slc-adaptive-kpi"><span>Horário que mais funciona</span><strong>${({manha:'manhã',tarde:'tarde',noite:'noite',madrugada:'madrugada'}[s.preferredStudyWindow]||'aprendendo')}</strong></div></div><p class="slc-adaptive-copy">${esc(s.reason)}. ${esc(s.nextTargetHint)}</p></div>`;
  }
  function patch(app){
    if (!app || app.__slcAdaptiveUIPatched) return;
    app.__slcAdaptiveUIPatched = true;
    const originalGoal = app.getDailyGoalSnapshot;
    app.getDailyGoalSnapshot = function(){
      const s = window.SLCAdaptive?.snapshot?.(this);
      if (!s) return originalGoal ? originalGoal.call(this) : {target:3,concluded:0,remaining:3,percent:0,streak:0};
      return {target: +(s.dailyTargetMinutes/60).toFixed(2), concluded: s.actualTodayMinutes/60, remaining: s.remainingMinutes/60, percent:s.progressPercent, streak:Number(this.data.user?.streak||0), adaptive:true};
    };
    const originalSave = app.saveDailyGoal;
    app.saveDailyGoal = async function(hours){
      const value = Math.max(.5, Math.min(12, Number(hours)||1));
      const a = window.SLCAdaptive?.ensure?.(this);
      if (a) { a.dailyTargetMinutes = Math.round(value*60/5)*5; a.lastReason = 'ajuste manual'; a.lastAdjustmentDate = ''; }
      this.data.user.dailyStudyGoalHours = value;
      if (window.dbService?.saveData) await window.dbService.saveData('user', this.data.user);
      return value;
    };

    const originalTodayData = app.getHojeInteligenteData;
    if (typeof originalTodayData === 'function' && !app.__slcAdaptiveTodayPatched) {
      app.__slcAdaptiveTodayPatched = true;
      app.getHojeInteligenteData = function(){
        const base = originalTodayData.call(this);
        const s = window.SLCAdaptive?.snapshot?.(this);
        if (!s || !base) return base;
        base.dailyTargetHours = s.dailyTargetHours;
        base.todayProgress = {
          planejado: (s.dailyTargetMinutes / 60).toFixed(1),
          concluido: (s.actualTodayMinutes / 60).toFixed(1),
          percentual: s.progressPercent
        };
        base.pomodoroMinutes = window.SLCAdaptive?.recommendedSessionMinutes?.(this, base.topSuggestion?.materia || '') || base.pomodoroMinutes;
        return base;
      };
    }

    const originalDashboard = app.renderDashboard;
    if (typeof originalDashboard === 'function') {
      app.renderDashboard = function(){
        let html = originalDashboard.call(this);
        if (typeof html === 'string' && !html.includes('id="slc-adaptive-card"')) {
          html = html.replace('<div class="dashboard-grid">', `${card(this)}<div class="dashboard-grid">`);
        }
        return html;
      };
    }

    if (window.aiAssistant && !window.aiAssistant.__slcAdaptivePlanPatched) {
      const ai = window.aiAssistant;
      ai.__slcAdaptivePlanPatched = true;
      const originalGenerate = ai.generateDailyPlan?.bind(ai);
      const originalToday = ai.gerarPlanoHoje?.bind(ai);
      ai.generateDailyPlan = function(){
        const base = originalGenerate ? originalGenerate() : [];
        const s = window.SLCAdaptive?.snapshot?.(window.app);
        if (!s || !Array.isArray(base) || !base.length) return base;
        let remaining = s.dailyTargetMinutes;
        return base.slice(0, 4).map((item, i) => {
          if (remaining <= 0) return null;
          const wanted = i === 0 ? Math.round(remaining * .40) : i === 1 ? Math.round(remaining * .30) : i === 2 ? Math.round(remaining * .20) : Math.round(remaining * .10);
          const duracao = Math.max(20, Math.min(90, window.SLCAdaptive.subjectMinutes(window.app, item.materia, wanted)));
          remaining -= duracao;
          return {...item, duracao, adaptive:true};
        }).filter(Boolean);
      };
      ai.gerarPlanoHoje = function(){
        const base = originalToday ? originalToday() : '';
        const s = window.SLCAdaptive?.snapshot?.(window.app);
        if (!s || !base) return base;
        const adaptive = ai.generateDailyPlan();
        if (!adaptive.length) return base;
        return [
          `Meta adaptativa de hoje: ${Math.round(s.dailyTargetMinutes/60*10)/10}h (${s.dailyTargetMinutes} min).`,
          ...adaptive.map((x,i)=>`- ${x.materia} — ${x.duracao} min. Motivo: ${x.motivo || 'prioridade acadêmica'}.`),
          '',
          `O SLCampus usa seu ritmo real para ajustar a próxima meta. ${s.reason}.`
        ].join('\n');
      };
    }
    style();
  }
  document.addEventListener('app-ready', () => setTimeout(() => patch(window.app), 800));
  document.addEventListener('slc-adaptive-updated', () => { try { style(); } catch (_) {} });
})();

(function () {
  'use strict';
  function bindFocusDefaults(app) {
    if (!app || app.__slcAdaptiveFocusPatched) return;
    app.__slcAdaptiveFocusPatched = true;
    const originalLoadView = app.loadView;
    if (typeof originalLoadView === 'function') {
      app.loadView = function(view, ...args){
        const result = originalLoadView.call(this, view, ...args);
        if (view === 'foco') setTimeout(() => {
          try {
            const subject = document.getElementById('timer-materia')?.value || this.focusMateria || '';
            const minutes = window.SLCAdaptive?.recommendedSessionMinutes?.(this, subject) || 45;
            const select = document.getElementById('timer-duracao');
            if (select && !select.dataset.adaptiveApplied) {
              const option = [...select.options].sort((a,b)=>Math.abs(Number(a.value)-minutes)-Math.abs(Number(b.value)-minutes))[0];
              if (option) select.value = option.value;
              select.dataset.adaptiveApplied = '1';
            }
          } catch (_) {}
        }, 80);
        return result;
      };
    }
  }
  document.addEventListener('app-ready', () => setTimeout(() => bindFocusDefaults(window.app), 900));
  document.addEventListener('slc-learning-evidence-saved', e => {
    const app = window.app, session = e?.detail?.session, level = e?.detail?.evidence?.level;
    if (!app || !session || !level || !window.SLCAdaptive?.applyEvidence) return;
    setTimeout(() => window.SLCAdaptive.applyEvidence(app, session, level).catch?.(() => {}), 100);
  });
})();
