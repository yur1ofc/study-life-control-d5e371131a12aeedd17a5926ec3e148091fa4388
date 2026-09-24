// script.js - Inicialização principal + melhorias avançadas
(function () {
  const PATCH_FLAG = '__slc_ultra_patch_v5__';

  function el(id) { return document.getElementById(id); }
  function normalizeText(value) { return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase(); }
  function normalizeDateValue(value) {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return normalizeText(value);
    return date.toISOString();
  }
  function stableValue(value) {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return value.map(stableValue).join('|');
    if (typeof value === 'object') {
      return Object.keys(value).sort().map(key => `${key}:${stableValue(value[key])}`).join('|');
    }
    return normalizeText(value);
  }
  function signatureForItem(collection, item) {
    const ignored = new Set(['id','createdAt','updatedAt','timestamp','uid','_tempId','__localId','ultimaAtualizacao','ultimaInteracao','streak','lastStudyDate']);
    const clone = {};
    Object.keys(item || {}).sort().forEach(key => {
      if (ignored.has(key)) return;
      const value = item[key];
      clone[key] = ['data','dataLimite','inicio','fim'].includes(key) ? normalizeDateValue(value) : stableValue(value);
    });
    return `${collection}::${JSON.stringify(clone)}`;
  }
  function dedupeCollection(collection, items) {
    if (!Array.isArray(items)) return items;
    const byId = new Set();
    const bySignature = new Set();
    const result = [];
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const id = item.id ? String(item.id) : '';
      const signature = signatureForItem(collection, item);
      if (id && byId.has(id)) continue;
      if (bySignature.has(signature)) continue;
      if (id) byId.add(id);
      bySignature.add(signature);
      result.push(item);
    }
    return result;
  }

  function injectStyles() {
    if (el('slc-ultra-styles')) return;
    const style = document.createElement('style');
    style.id = 'slc-ultra-styles';
    style.textContent = `
      .dashboard-grid--smart,.goal-grid,.subject-performance-grid,.agenda-grid,.situation-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;}
      .today-hero{display:grid;grid-template-columns:1.5fr 1fr;gap:18px;margin-bottom:20px;}
      .today-panel,.summary-panel,.goal-card,.subject-performance-card,.agenda-card,.situation-card,.report-card{background:rgba(15,23,42,.24);border:1px solid rgba(148,163,184,.14);border-radius:22px;padding:18px;box-shadow:0 8px 24px rgba(2,6,23,.18);}
      .today-checklist{display:grid;gap:10px;margin-top:14px;}
      .today-check{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding:12px 14px;background:rgba(15,23,42,.18);border-radius:16px;}
      .today-check small,.agenda-item small,.subject-performance-card small{display:block;opacity:.78;margin-top:3px;}
      .today-badge,.risk-pill,.phase-pill,.calendar-filter-btn{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:6px 12px;font-size:.8rem;font-weight:700;background:rgba(59,130,246,.14);border:1px solid rgba(59,130,246,.18);}
      .risk-pill.alto,.calendar-filter-btn.active[data-filter="risco"]{background:rgba(239,68,68,.14);border-color:rgba(239,68,68,.2)}
      .risk-pill.medio{background:rgba(245,158,11,.14);border-color:rgba(245,158,11,.2)}
      .risk-pill.baixo{background:rgba(16,185,129,.14);border-color:rgba(16,185,129,.2)}
      .goal-card .progress-bar,.subject-performance-card .progress-bar{margin-top:10px;}
      .goal-stat{display:flex;justify-content:space-between;gap:10px;font-size:.9rem;margin-bottom:8px;}
      .goal-edit-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-top:14px;}
      .goal-edit-grid input{width:100%;padding:10px 12px;border-radius:14px;border:1px solid rgba(148,163,184,.16);background:rgba(15,23,42,.12);color:inherit;}
      .subject-performance-head,.agenda-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:10px;}
      .subject-performance-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0;}
      .subject-metric{padding:10px 12px;border-radius:16px;background:rgba(15,23,42,.12);}
      .subject-metric strong{display:block;font-size:1.05rem;margin-top:4px;}
      .agenda-filters{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0;}
      .agenda-archived-note{display:block;margin-top:8px;}
      .agenda-list{display:grid;gap:10px;}
      .agenda-item{display:flex;justify-content:space-between;gap:12px;padding:12px 14px;border-radius:16px;background:rgba(15,23,42,.12);}
      .focus-cycle-card{margin-top:18px;padding:18px;border-radius:18px;border:1px solid rgba(99,102,241,.18);background:linear-gradient(135deg,rgba(99,102,241,.1),rgba(59,130,246,.08));}
      .focus-cycle-top{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center;margin-bottom:14px;}
      .focus-phase-badge{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;font-size:.86rem;font-weight:700;background:rgba(15,23,42,.14);}
      .focus-next-action{display:none;margin-top:12px;gap:10px;flex-wrap:wrap;}.focus-next-action.is-visible{display:flex;}
      .focus-hints{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:14px;}
      .compact-weekly-schedule .weekly-timeline{border:1px solid rgba(148,163,184,.2);border-radius:18px;overflow:hidden;background:rgba(15,23,42,.15);}
      .compact-weekly-schedule .weekly-timeline-header{position:sticky;top:0;z-index:2;background:rgba(15,23,42,.94);backdrop-filter:blur(10px);}
      .compact-weekly-schedule .weekly-day-header,.compact-weekly-schedule .weekly-time-spacer{min-height:44px;display:flex;align-items:center;justify-content:center;font-size:.82rem;}
      .compact-weekly-schedule .weekly-time-column{width:62px;}
      .compact-weekly-schedule .weekly-time-slot{font-size:.75rem;padding-right:10px;}
      .compact-weekly-schedule .weekly-event-block{border-radius:14px;box-shadow:0 6px 18px rgba(15,23,42,.16);overflow:hidden;}
      .compact-weekly-schedule .event-content{padding:8px 9px;font-size:.78rem;line-height:1.2;}.compact-weekly-schedule .event-content strong{display:block;font-size:.8rem;margin-bottom:4px;}
      .mentor-highlight-box{margin:14px 0 18px;padding:16px 18px;border-radius:18px;background:linear-gradient(135deg,rgba(16,185,129,.10),rgba(59,130,246,.08));border:1px solid rgba(16,185,129,.16);}
      .mentor-highlight-box h3{margin:0 0 8px;font-size:1rem;}.mentor-highlight-box p{margin:0;opacity:.95;}
      .situation-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px;}
      .situation-kpi{padding:14px;border-radius:18px;background:rgba(15,23,42,.12);}
      .situation-list{display:grid;gap:10px;}
      .situation-reminder-banner{margin-bottom:16px;padding:16px 18px;border-radius:20px;background:linear-gradient(135deg,rgba(245,158,11,.12),rgba(239,68,68,.06));border:1px solid rgba(245,158,11,.22);}
      .situation-reminder-head{display:flex;gap:12px;align-items:flex-start;}
      .situation-reminder-head i{font-size:1.2rem;color:#fbbf24;margin-top:2px;}
      .situation-reminder-head h3{margin:0 0 4px;font-size:1rem;}
      .situation-reminder-head p{margin:0;opacity:.85;font-size:.9rem;}
      .reminder-block{margin-top:12px;}
      .reminder-block strong{display:block;font-size:.85rem;opacity:.9;margin-bottom:8px;}
      .reminder-chip-row{display:flex;flex-wrap:wrap;gap:8px;}
      .reminder-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(245,158,11,.28);background:rgba(15,23,42,.5);color:inherit;border-radius:999px;padding:8px 12px;font-size:.82rem;cursor:pointer;transition:transform .15s ease,background .15s ease;}
      .reminder-chip:hover{transform:translateY(-1px);background:rgba(30,41,59,.7);}
      .subject-missing-data-note{margin-top:10px;padding:8px 10px;border-radius:12px;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.18);font-size:.8rem;opacity:.92;}
      .report-stack{display:grid;gap:14px;margin-top:18px;}
      .calendar-grid + .agenda-filters{margin-top:18px;}
      .impact-grid,.notification-grid,.gamification-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin:18px 0;}
      .impact-card,.notification-card,.gamification-card{background:rgba(15,23,42,.24);border:1px solid rgba(148,163,184,.14);border-radius:22px;padding:18px;box-shadow:0 8px 24px rgba(2,6,23,.18);}
      .mini-chart{display:flex;align-items:flex-end;gap:10px;min-height:180px;padding-top:10px;}
      .mini-chart-bar-wrap{flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;min-width:0;}
      .mini-chart-bar{width:100%;max-width:44px;border-radius:14px 14px 6px 6px;background:linear-gradient(180deg,rgba(96,165,250,.95),rgba(37,99,235,.55));min-height:8px;transition:transform .2s ease;}
      .mini-chart-bar:hover{transform:translateY(-3px);}
      .mini-chart-label,.mini-chart-value{font-size:.8rem;opacity:.82;text-align:center;}
      .subject-share-list,.notification-list,.achievement-list{display:grid;gap:10px;margin-top:12px;}
      .subject-share-item,.notification-item,.achievement-item{display:flex;justify-content:space-between;gap:12px;padding:12px 14px;border-radius:16px;background:rgba(15,23,42,.12);align-items:flex-start;}
      .subject-share-meta{flex:1;min-width:0;}
      .subject-share-track{height:10px;background:rgba(148,163,184,.16);border-radius:999px;overflow:hidden;margin-top:8px;}
      .subject-share-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,rgba(16,185,129,.9),rgba(59,130,246,.8));}
      .impact-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-top:12px;}
      .impact-kpi{padding:12px;border-radius:16px;background:rgba(15,23,42,.12);}
      .impact-kpi strong{display:block;font-size:1.15rem;margin-top:4px;}
      .daily-goal-card{margin:18px 0;padding:18px;border-radius:22px;background:linear-gradient(135deg,rgba(14,165,233,.14),rgba(59,130,246,.08));border:1px solid rgba(56,189,248,.18);}
      .daily-goal-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;}
      .daily-goal-meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:14px;}
      .daily-goal-pill{padding:12px;border-radius:16px;background:rgba(15,23,42,.14);}
      .daily-goal-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;}
      .daily-goal-inline{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
      .daily-goal-inline input{width:90px;padding:10px 12px;border-radius:14px;border:1px solid rgba(148,163,184,.16);background:rgba(15,23,42,.12);color:inherit;}
      .risk-meter{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;}
      .risk-meter .risk-segment{flex:1;padding:10px 12px;border-radius:14px;background:rgba(15,23,42,.12);text-align:center;font-size:.9rem;}
      .risk-segment.alto{border:1px solid rgba(239,68,68,.25)} .risk-segment.medio{border:1px solid rgba(245,158,11,.25)} .risk-segment.baixo{border:1px solid rgba(16,185,129,.25)}
      .notification-item small,.achievement-item small{display:block;opacity:.78;margin-top:4px;}
      .notification-badge{display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:24px;padding:0 8px;border-radius:999px;background:rgba(239,68,68,.15);font-size:.8rem;font-weight:700;}
      .xp-progress-head{display:flex;justify-content:space-between;gap:10px;align-items:center;}
      .xp-progress-copy{font-size:.9rem;opacity:.84;margin-top:10px;}
      .floating-ai-launcher{position:fixed;right:18px;bottom:80px;z-index:1100;display:flex;flex-direction:column;align-items:flex-end;gap:10px;}
      .floating-ai-launcher.hidden,.floating-ai-button.hidden{display:none !important;}
      .floating-ai-button{width:62px;height:62px;border:none;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1.35rem;color:#fff;background:linear-gradient(135deg,#2563eb,#14b8a6);box-shadow:0 18px 35px rgba(37,99,235,.38);}
      .floating-ai-panel{position:fixed;right:18px;bottom:154px;z-index:1100;width:min(380px,calc(100vw - 24px));max-height:min(74vh,680px);display:none;flex-direction:column;overflow:hidden;border-radius:24px;background:rgba(2,6,23,.95);backdrop-filter:blur(12px);border:1px solid rgba(148,163,184,.16);box-shadow:0 24px 60px rgba(2,6,23,.42);}
      .floating-ai-panel.open{display:flex;}
      .floating-ai-header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:18px 18px 12px;border-bottom:1px solid rgba(148,163,184,.12);}
      .floating-ai-header p{margin:4px 0 0;font-size:.9rem;opacity:.78;}
      .floating-ai-close{border:none;background:transparent;color:inherit;font-size:1.2rem;cursor:pointer;}
      .floating-ai-messages{padding:16px;display:grid;gap:10px;overflow:auto;max-height:46vh;}
      .floating-ai-message{padding:12px 14px;border-radius:18px;line-height:1.45;font-size:.94rem;background:rgba(30,41,59,.72);}
      .floating-ai-message.user{background:rgba(37,99,235,.22);margin-left:28px;}
      .floating-ai-message.assistant{margin-right:28px;}
      .floating-ai-suggestions{display:flex;gap:8px;flex-wrap:wrap;padding:0 16px 14px;}
      .floating-ai-suggestion{border:1px solid rgba(148,163,184,.14);background:rgba(15,23,42,.6);color:inherit;border-radius:999px;padding:8px 12px;font-size:.82rem;cursor:pointer;}
      .floating-ai-input{display:flex;gap:10px;padding:14px 16px 16px;border-top:1px solid rgba(148,163,184,.12);}
      .floating-ai-input input{flex:1;padding:12px 14px;border-radius:16px;border:1px solid rgba(148,163,184,.14);background:rgba(15,23,42,.72);color:inherit;}
      .floating-ai-input button{border:none;border-radius:16px;padding:0 16px;background:linear-gradient(135deg,#2563eb,#14b8a6);color:#fff;cursor:pointer;}
      .floating-ai-inline-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;}
      .floating-ai-inline-action{border:1px solid rgba(96,165,250,.22);background:rgba(15,23,42,.78);color:#dbeafe;border-radius:999px;padding:8px 11px;font-size:.8rem;cursor:pointer;transition:transform .15s ease, background .15s ease;}
      .floating-ai-inline-action:hover{transform:translateY(-1px);background:rgba(30,41,59,.94);}
      .floating-ai-memory-chip{display:inline-flex;align-items:center;gap:6px;font-size:.74rem;padding:6px 10px;border-radius:999px;background:rgba(59,130,246,.12);color:#bfdbfe;margin-bottom:6px;}
      .floating-ai-backdrop{position:fixed;inset:0;background:rgba(2,6,23,.35);z-index:1190;display:none;}
      .floating-ai-backdrop.open{display:block;}
      /* No mobile a aba "IA" da barra inferior (#slc-bottom-nav) já leva pro
         mentor IA em tela cheia — a bolha flutuante some pra não duplicar
         o mesmo atalho e não brigar de posição com o FAB de "+". */
      @media (max-width: 768px){ .floating-ai-launcher{ display:none !important; } }
      .notification-popover{position:fixed;top:var(--slc-notif-top,76px);right:var(--slc-notif-right,16px);width:min(420px,calc(100vw - 32px));max-width:calc(100vw - 24px);box-sizing:border-box;background:rgba(2,6,23,.97);border:1px solid rgba(148,163,184,.16);border-radius:20px;box-shadow:0 24px 60px rgba(2,6,23,.35);padding:14px;display:none;z-index:10050;overflow:hidden;}
      .notification-popover.open{display:block;}
      .notification-popover-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:10px;}
      .notification-popover-actions{display:flex;gap:8px;flex-shrink:0;}
      .notification-popover-actions .btn-secondary{white-space:nowrap;padding:6px 10px;font-size:.78rem;}
      .notification-popover-list{display:grid;gap:10px;max-height:55vh;overflow:auto;}
      .notification-empty{padding:12px 0;opacity:.8;}
      .level-avatar-wrap{position:relative;width:54px;height:54px;border-radius:50%;display:grid;place-items:center;padding:3px;background:conic-gradient(#22c55e 0deg,#2563eb 0deg,#1e293b 0deg);box-shadow:0 10px 24px rgba(2,6,23,.24);}
      .level-avatar-wrap .user-avatar{width:100%;height:100%;border:none;margin:0;background:rgba(15,23,42,.8);}
      .level-avatar{position:relative;width:100%;height:100%;border-radius:50%;overflow:hidden;background:rgba(15,23,42,.8);display:grid;place-items:center;}
      .level-badge-mini{position:absolute;right:-3px;bottom:-3px;min-width:24px;height:24px;padding:0 6px;border-radius:999px;background:linear-gradient(135deg,#1d4ed8,#0ea5e9);display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:800;color:#fff;border:2px solid rgba(2,6,23,.92);}
      .xp-proof-note{margin-top:12px;font-size:.88rem;opacity:.82;}
      .history-title{margin-top:14px;font-size:.92rem;opacity:.9;}
      .history-list{display:grid;gap:10px;margin-top:10px;}
      .history-item{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:12px 14px;border-radius:16px;background:rgba(15,23,42,.12);}
      .history-item small{display:block;opacity:.72;margin-top:4px;}
      .history-xp{white-space:nowrap;font-weight:800;border-radius:999px;padding:6px 10px;background:rgba(148,163,184,.12);}
      .history-xp.gain{background:rgba(34,197,94,.12);color:#86efac;}
      .history-xp.neutral{background:rgba(59,130,246,.12);color:#93c5fd;}
      .achievement-item.unlocked{border:1px solid rgba(34,197,94,.16);}
      .achievement-status{display:inline-flex;align-items:center;justify-content:center;padding:6px 10px;border-radius:999px;font-size:.78rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em;}
      .achievement-status.unlocked{background:rgba(34,197,94,.14);color:#86efac;}
      .achievement-status.locked{background:rgba(148,163,184,.12);color:#cbd5e1;}
      .gamification-page-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:18px;}
      .achievement-steam-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px;}
      .achievement-steam-card{display:flex;gap:14px;align-items:center;padding:16px;border-radius:18px;background:rgba(15,23,42,.16);border:1px solid rgba(148,163,184,.14);transition:transform .18s ease, border-color .18s ease, opacity .18s ease;}
      .achievement-steam-card.unlocked{box-shadow:0 10px 24px rgba(2,6,23,.16);}
      .achievement-steam-card.locked{opacity:.72;filter:saturate(.7);}
      .achievement-steam-card.bronze.unlocked{border-color:rgba(245,158,11,.28);}
      .achievement-steam-card.silver.unlocked{border-color:rgba(148,163,184,.3);}
      .achievement-steam-card.gold.unlocked{border-color:rgba(250,204,21,.3);}
      .achievement-steam-icon{width:52px;height:52px;border-radius:16px;display:flex;align-items:center;justify-content:center;background:rgba(37,99,235,.14);font-size:1.2rem;flex:0 0 auto;}
      /* Selo hexagonal por tier — bronze/prata/ouro usam a mesma cor da
         borda do card (ver .achievement-steam-card.<tier>.unlocked acima),
         só que aplicada ao selo do ícone. Sem glow difuso: o contraste do
         próprio hexágono contra o card já dá o destaque. */
      .achievement-steam-card.unlocked .achievement-steam-icon{
        clip-path: polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%);
        border-radius: 0;
      }
      .achievement-steam-card.bronze.unlocked .achievement-steam-icon{
        background: linear-gradient(155deg, rgba(245,158,11,.32), rgba(245,158,11,.1));
        color: #fbbf24;
        box-shadow: inset 0 0 0 1px rgba(245,158,11,.35);
      }
      .achievement-steam-card.silver.unlocked .achievement-steam-icon{
        background: linear-gradient(155deg, rgba(148,163,184,.32), rgba(148,163,184,.1));
        color: #e2e8f0;
        box-shadow: inset 0 0 0 1px rgba(148,163,184,.4);
      }
      .achievement-steam-card.gold.unlocked .achievement-steam-icon{
        background: linear-gradient(155deg, rgba(250,204,21,.36), rgba(250,204,21,.1));
        color: #facc15;
        box-shadow: inset 0 0 0 1px rgba(250,204,21,.4);
      }
      .achievement-steam-card.locked .achievement-steam-icon{
        clip-path: polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%);
        border-radius: 0;
        background: rgba(148,163,184,.1);
        color: #64748b;
        box-shadow: inset 0 0 0 1px rgba(148,163,184,.2);
      }
      .achievement-steam-body{display:grid;gap:4px;min-width:0;}
      .achievement-steam-body small{opacity:.82;}
      .xp-burst-fx{position:absolute;transform:translate(-50%,0) scale(.88);opacity:0;pointer-events:none;z-index:120;background:rgba(34,197,94,.16);color:#86efac;border:1px solid rgba(34,197,94,.24);padding:8px 12px;border-radius:999px;font-weight:800;box-shadow:0 12px 24px rgba(2,6,23,.22);transition:transform .8s cubic-bezier(.2,.7,.2,1), opacity .8s ease;}
      .xp-burst-fx.show{opacity:1;transform:translate(-50%,-42px) scale(1);}

      .level-up-fx{position:fixed;inset:0;display:grid;place-items:center;background:rgba(2,6,23,.45);backdrop-filter:blur(4px);z-index:1600;opacity:0;pointer-events:none;transition:opacity .25s ease;}
      .level-up-fx.show{opacity:1;}
      .level-up-card{position:relative;min-width:min(92vw,360px);padding:28px 24px;border-radius:28px;background:radial-gradient(circle at top,rgba(37,99,235,.22),rgba(2,6,23,.96));border:1px solid rgba(96,165,250,.28);box-shadow:0 30px 80px rgba(2,6,23,.5);text-align:center;transform:scale(.86);transition:transform .25s ease;}
      .level-up-fx.show .level-up-card{transform:scale(1);}
      .level-up-burst{position:absolute;inset:-20px;border-radius:40px;background:conic-gradient(from 0deg,rgba(250,204,21,.18),rgba(59,130,246,.18),rgba(16,185,129,.16),rgba(250,204,21,.18));filter:blur(24px);z-index:-1;animation:slcSpin 3s linear infinite;}
      .level-up-label{font-size:.84rem;font-weight:900;letter-spacing:.2em;color:#93c5fd;}
      .level-up-value{font-size:2rem;font-weight:900;margin-top:10px;}
      .level-up-copy{margin-top:8px;opacity:.82;}
      @keyframes slcSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
      @media (max-width: 980px){.today-hero{grid-template-columns:1fr;}}
      @media (max-width: 820px){.compact-weekly-schedule{overflow-x:auto;}.compact-weekly-schedule .weekly-timeline{min-width:860px;}.floating-ai-panel{right:12px;left:12px;width:auto;bottom:88px;}.notification-popover{position:fixed!important;left:12px!important;right:12px!important;top:72px!important;width:auto!important;max-width:none!important;}.gamification-page-grid{grid-template-columns:1fr;}}
    `;
    document.head.appendChild(style);
  }

  function patchDbService() {
    if (!window.dbService || window.dbService.__dedupePatched) return;
    const originalSaveAllData = window.dbService.saveAllData?.bind(window.dbService);
    const originalSaveData = window.dbService.saveData?.bind(window.dbService);
    if (originalSaveAllData) {
      window.dbService.saveAllData = async function (dataOverride = null) {
        const payload = dataOverride || window.app?.data || {};
        Object.keys(payload).forEach(key => { if (Array.isArray(payload[key])) payload[key] = dedupeCollection(key, payload[key]); });
        if (window.app?.data) window.app.data = payload;
        return originalSaveAllData(payload);
      };
    }
    if (originalSaveData) {
      window.dbService.saveData = async function (field, data) {
        const clean = Array.isArray(data) ? dedupeCollection(field, data) : data;
        if (window.app?.data && field) window.app.data[field] = clean;
        return originalSaveData(field, clean);
      };
    }
    window.dbService.__dedupePatched = true;
  }

  function calculateCompactHourHeight(manager) {
    const horarios = (manager?.aulas || window.app?.data?.classSchedule || []).map(item => [item?.inicio, item?.fim]).flat().filter(Boolean)
      .map(value => String(value).split(':').map(Number)).filter(parts => parts.length === 2 && parts.every(Number.isFinite));
    const earliest = horarios.length ? Math.min(...horarios.map(([h]) => h)) : (manager?.HORARIO_INICIO || 7);
    const latest = horarios.length ? Math.max(...horarios.map(([h]) => h)) : (manager?.HORARIO_FIM || 22);
    const total = Math.max(8, (latest - earliest) + 2);
    const available = Math.max(420, window.innerHeight - 290);
    return Math.max(26, Math.min(52, Math.floor(available / total)));
  }

  function ensureFocusState(app) {
    if (!app.focusCycleState) {
      app.focusCycleState = { phase: 'focus', lastFocusMinutes: 25, shortBreakMinutes: 15, heavyMinutes: 90, longFocusMinutes: 50, canAdvance: false, completedFocusBlocks: 0 };
    }
    return app.focusCycleState;
  }

  function updateFocusUI(app) {
    const state = ensureFocusState(app);
    const display = el('timer-display');
    const phase = el('focus-phase-label');
    const summary = el('focus-cycle-summary');
    const nextBox = el('focus-next-action');
    const nextBtn = el('focus-next-button');
    if (display) {
      const seconds = Math.max(0, Number(app.timerSeconds) || 0);
      const min = Math.floor(seconds / 60); const sec = seconds % 60;
      display.textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    }
    if (phase) phase.innerHTML = state.phase === 'break' ? '<i class="fas fa-mug-hot"></i> Descanso' : '<i class="fas fa-brain"></i> Foco';
    if (summary) summary.textContent = state.phase === 'break' ? 'Quando esse descanso acabar, você volta para o foco com um clique.' : `Blocos de foco concluídos hoje: ${state.completedFocusBlocks}.`;
    if (nextBox) nextBox.classList.toggle('is-visible', !!state.canAdvance);
    if (nextBtn) nextBtn.textContent = state.phase === 'break' ? 'Iniciar foco' : 'Iniciar descanso';
  }

  function configureFocusMode(app, mode) {
    const state = ensureFocusState(app);
    if (mode === 'focus') { state.phase = 'focus'; state.lastFocusMinutes = 25; app.timerDuration = 25 * 60; }
    if (mode === 'long-focus') { state.phase = 'focus'; state.lastFocusMinutes = state.longFocusMinutes; app.timerDuration = state.longFocusMinutes * 60; }
    if (mode === 'heavy-focus') { state.phase = 'focus'; state.lastFocusMinutes = state.heavyMinutes; app.timerDuration = state.heavyMinutes * 60; }
    if (mode === 'break') { state.phase = 'break'; app.timerDuration = state.shortBreakMinutes * 60; }
    app.timerSeconds = app.timerDuration; state.canAdvance = false; updateFocusUI(app);
  }

  function bindFocusButtons(app) {
    if (!app || app.currentView !== 'foco') return;
    const start = el('timer-start'); const longBtn = el('focus-long-start'); const heavyBtn = el('focus-heavy-start'); const breakBtn = el('focus-break-start'); const nextBtn = el('focus-next-button');
    if (start) start.onclick = () => { configureFocusMode(app, 'focus'); app.startTimer(); };
    if (longBtn) longBtn.onclick = () => { configureFocusMode(app, 'long-focus'); app.startTimer(); };
    if (heavyBtn) heavyBtn.onclick = () => { configureFocusMode(app, 'heavy-focus'); app.startTimer(); };
    if (breakBtn) breakBtn.onclick = () => { configureFocusMode(app, 'break'); app.startTimer(); };
    if (nextBtn) nextBtn.onclick = () => { const state = ensureFocusState(app); configureFocusMode(app, state.phase === 'break' ? 'focus' : 'break'); app.startTimer(); };

    const sessaoSelect = el('timer-sessao-vinculada');
    const materiaSelect = el('timer-materia');
    const duracaoSelect = el('timer-duracao');
    if (sessaoSelect) {
      sessaoSelect.onchange = () => {
        app.focusLinkedSessionId = sessaoSelect.value || null;
        const opt = sessaoSelect.selectedOptions[0];
        if (app.focusLinkedSessionId && opt) {
          if (materiaSelect) { materiaSelect.value = opt.dataset.materia || ''; materiaSelect.disabled = true; }
          if (duracaoSelect && opt.dataset.duracao) {
            const durNum = Number(opt.dataset.duracao);
            const hasOpt = Array.from(duracaoSelect.options).some(o => Number(o.value) === durNum);
            if (hasOpt) duracaoSelect.value = String(durNum);
          }
        } else if (materiaSelect) {
          materiaSelect.disabled = false;
        }
      };
    }
    if (materiaSelect) materiaSelect.onchange = () => { app.focusMateria = materiaSelect.value || ''; };
    updateFocusUI(app);
  }

  function patchFocusTimer() {
    if (!window.StudyLifeControl || window.StudyLifeControl.prototype.__focusEnhanced) return;
    const proto = window.StudyLifeControl.prototype;
    proto.startTimer = function () {
      const state = ensureFocusState(this);
      if (!this.timerDuration) this.timerDuration = (state.phase === 'break' ? state.shortBreakMinutes : state.lastFocusMinutes) * 60;
      if (!this.timerSeconds) this.timerSeconds = this.timerDuration;
      if (this.timerRunning) return;
      this.timerRunning = true;
      clearInterval(this.timerInterval);
      this.timerInterval = setInterval(async () => {
        this.timerSeconds = Math.max(0, (this.timerSeconds || 0) - 1);
        updateFocusUI(this);
        if (this.timerSeconds <= 0) {
          clearInterval(this.timerInterval);
          this.timerRunning = false;
          state.canAdvance = true;
          if (state.phase === 'focus') {
            state.completedFocusBlocks += 1;
            const duracaoReal = Math.round((this.timerDuration || 0) / 60);
            const linkedId = this.focusLinkedSessionId;
            const sessaoVinculada = linkedId ? this.data.sessions.find(s => s.id === linkedId && !s.concluida) : null;

            if (sessaoVinculada) {
              const ok = await dbService.updateItem('sessions', sessaoVinculada.id, { concluida: true, duracaoReal });
              if (ok) {
                sessaoVinculada.concluida = true;
                sessaoVinculada.duracaoReal = duracaoReal;
                if (this.updateStreak) this.updateStreak();
                if (window.reviewSystem?.gerarRevisoesFromSessao) await window.reviewSystem.gerarRevisoesFromSessao(sessaoVinculada);
              }
              this.focusLinkedSessionId = null;
              showToast(`Sessão "${sessaoVinculada.materia}" concluída via Modo Foco!`, 'success');
            } else {
              const materia = this.focusMateria || 'Modo Foco';
              const item = { id: generateId(), materia, tipo: 'foco', duracao: duracaoReal, data: new Date().toISOString(), concluida: true, topico: 'Bloco de foco concluído' };
              await dbService.addItem('sessions', item);
              if (window.reviewSystem?.gerarRevisoesFromSessao) await window.reviewSystem.gerarRevisoesFromSessao(item);
              showToast('Bloco de foco concluído. Hora do descanso.', 'success');
            }
          } else {
            showToast('Descanso concluído. Bora voltar para o foco.', 'info');
          }
          updateFocusUI(this);
          if (this.currentView === 'foco') {
            const list = el('sessoes-foco-hoje');
            if (list && this.viewRenderer?.renderSessoesFocoHoje) list.innerHTML = this.viewRenderer.renderSessoesFocoHoje();
            if (state.phase === 'focus') {
              this.loadView('foco');
            }
          }
        }
      }, 1000);
      updateFocusUI(this);
    };
    proto.pauseTimer = function () { clearInterval(this.timerInterval); this.timerRunning = false; updateFocusUI(this); };
    proto.resetTimer = function () { const state = ensureFocusState(this); clearInterval(this.timerInterval); this.timerRunning = false; this.timerDuration = (state.phase === 'break' ? state.shortBreakMinutes : state.lastFocusMinutes) * 60; this.timerSeconds = this.timerDuration; state.canAdvance = false; updateFocusUI(this); };
    proto.__focusEnhanced = true;
  }

  function renderTodayHero(view) {
    const snap = view.app.getHojeInteligenteData();
    const progress = snap.todayProgress;
    return `
      <div class="today-hero">
        <div class="today-panel">
          <div class="subject-performance-head">
            <div>
              <h3><i class="fas fa-bolt"></i> Modo Hoje</h3>
              <small>Só o que importa agora para você.</small>
            </div>
            <span class="today-badge"><i class="fas fa-stopwatch"></i> Pomodoro sugerido: ${snap.pomodoroMinutes} min</span>
          </div>
          <div class="today-checklist">
            <div class="today-check"><div><strong>${snap.currentClass ? 'Aula agora' : 'Próxima aula'}</strong><small>${snap.currentClass ? `${view.esc(snap.currentClass.materia)} até ${view.esc(snap.currentClass.fim)}` : snap.nextClass ? `${view.esc(snap.nextClass.materia)} • ${view.esc(snap.nextClass.inicio)}-${view.esc(snap.nextClass.fim)}` : 'Sem aula próxima cadastrada'}</small></div><span class="risk-pill baixo">${snap.currentClass ? 'ao vivo' : 'agenda'}</span></div>
            <div class="today-check"><div><strong>Tarefas vencendo</strong><small>${snap.urgentTasks.length ? snap.urgentTasks.map(t => `${view.esc(t.titulo)} (${Math.max(0, diasAte(t.dataLimite))}d)`).join(' • ') : 'Nenhuma urgente agora'}</small></div><span class="risk-pill ${snap.urgentTasks.length ? 'medio' : 'baixo'}">${snap.urgentTasks.length}</span></div>
            <div class="today-check"><div><strong>Revisões do dia</strong><small>${snap.reviewsToday.length ? snap.reviewsToday.map(r => `${view.esc(r.materia)}: ${view.esc(r.topico || 'revisão geral')}`).join(' • ') : 'Nada pendente hoje'}</small></div><span class="risk-pill ${snap.reviewsToday.length ? 'medio' : 'baixo'}">${snap.reviewsToday.length}</span></div>
            <div class="today-check"><div><strong>Meta de estudo</strong><small>${Number(progress.concluido).toFixed(1)}h concluídas de ${snap.dailyTargetHours}h hoje.</small></div><span class="risk-pill ${Number(progress.percentual) >= 70 ? 'baixo' : 'medio'}">${Math.round(Number(progress.percentual)||0)}%</span></div>
            <div class="today-check"><div><strong>Prioridade real</strong><small>${snap.topSuggestion ? `<strong>${view.esc(snap.topSuggestion.materia)}</strong> — ${view.esc(snap.topSuggestion.tipo)} por ${view.esc(snap.topSuggestion.duracao)} min. ${view.esc(snap.topSuggestion.motivo)}` : 'Cadastre mais dados para a IA sugerir melhor.'}</small></div><span class="risk-pill ${snap.risk.length ? 'alto' : 'baixo'}">${snap.risk.length ? 'atenção' : 'ok'}</span></div>
          </div>
        </div>
        <div class="summary-panel">
          <h3><i class="fas fa-shield-alt"></i> Alerta de risco real</h3>
          ${snap.risk.length ? snap.risk.slice(0, 4).map(item => `<div class="agenda-item"><div><strong>${view.esc(item.materia)}</strong><small>${view.esc(item.motivo)}</small></div><span class="risk-pill ${view.esc(item.nivel)}">${view.esc(item.nivel)}</span></div>`).join('') : '<p class="text-secondary">Nenhum alerta forte agora.</p>'}
          ${snap.antiProcrastination ? `<div class="report-card" style="margin-top:14px;"><strong>Modo recuperação</strong><small>${view.esc(snap.antiProcrastination.reason)}</small>${snap.antiProcrastination.days.map(day => `<div class="agenda-item"><div><strong>${view.esc(day.date)}</strong><small>${view.esc(day.focus)} — ${view.esc(day.action)}<br>${view.esc(day.extra)}</small></div></div>`).join('')}</div>` : ''}
        </div>
      </div>`;
  }

  function renderGoalsPanel(view) {
    const goals = view.app.getStudyGoalsSnapshot();
    const cards = [
      ['Horas na semana', `${goals.weeklyHours.toFixed(1)}h / ${goals.goals.weeklyHours}h`, goals.progress.weeklyHours],
      ['Horas no mês', `${goals.monthlyHours.toFixed(1)}h / ${goals.goals.monthlyHours}h`, goals.progress.monthlyHours],
      ['Pomodoros', `${goals.weeklyPomodoros} / ${goals.goals.weeklyPomodoros}`, goals.progress.weeklyPomodoros],
      ['Tarefas concluídas', `${goals.weeklyTasksDone} / ${goals.goals.weeklyTasks}`, goals.progress.weeklyTasks],
      ['Revisões concluídas', `${goals.weeklyReviewsDone} / ${goals.goals.weeklyReviews}`, goals.progress.weeklyReviews]
    ];
    return `
      <div class="card"><div class="card-header"><h3><i class="fas fa-bullseye"></i> Metas semanais e mensais</h3></div><div class="card-body">
        <div class="goal-grid">${cards.map(([label, value, progress]) => `<div class="goal-card"><div class="goal-stat"><span>${label}</span><strong>${value}</strong></div><div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div><small>${progress}% da meta</small></div>`).join('')}</div>
        <div class="goal-edit-grid">
          <input type="number" id="goal-weekly-hours" value="${goals.goals.weeklyHours}" min="1" placeholder="Horas semanais">
          <input type="number" id="goal-monthly-hours" value="${goals.goals.monthlyHours}" min="1" placeholder="Horas mensais">
          <input type="number" id="goal-weekly-pomodoros" value="${goals.goals.weeklyPomodoros}" min="1" placeholder="Pomodoros">
          <input type="number" id="goal-weekly-tasks" value="${goals.goals.weeklyTasks}" min="1" placeholder="Tarefas">
          <input type="number" id="goal-weekly-reviews" value="${goals.goals.weeklyReviews}" min="1" placeholder="Revisões">
        </div>
        <div style="margin-top:12px;display:flex;justify-content:flex-end;"><button class="btn-secondary" id="save-goals-btn"><i class="fas fa-save"></i> Salvar metas</button></div>
      </div></div>`;
  }

  function renderSubjectPerformance(view) {
    const subjects = (view.app.data.subjects || []).map(s => view.app.getSubjectPerformance(s.nome)).filter(Boolean);
    return `
      <div class="subject-performance-grid">${subjects.map(item => {
        const attendanceLabel = item.hasDiaries ? `${item.attendance}%` : 'Sem dados';
        const attendanceWidth = item.hasDiaries ? Math.max(8, Math.min(100, item.attendance)) : 0;
        return `
        <div class="subject-performance-card">
          <div class="subject-performance-head"><div><h3>${view.esc(item.subject.nome)}</h3><small>${view.esc(item.recommendation)}</small></div><span class="risk-pill ${view.esc(item.riskLevel)}">${view.esc(item.riskLevel)}</span></div>
          <div class="subject-performance-metrics">
            <div class="subject-metric"><span>Média atual</span><strong>${item.average > 0 ? item.average.toFixed(1) : '—'}</strong></div>
            <div class="subject-metric"><span>Horas estudadas</span><strong>${item.hours.toFixed(1)}h</strong></div>
            <div class="subject-metric"><span>Frequência</span><strong>${attendanceLabel}</strong></div>
            <div class="subject-metric"><span>Tarefas pendentes</span><strong>${item.tasksPending}</strong></div>
            <div class="subject-metric"><span>Provas futuras</span><strong>${item.upcomingExamsCount}</strong></div>
            <div class="subject-metric"><span>Nota ideal na próxima</span><strong>${item.nextRequiredGrade}</strong></div>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${attendanceWidth}%"></div></div>
          ${item.historicalAttempts ? `<div class="subject-history-intel"><i class="fas fa-clock-rotate-left"></i> Histórico: ${item.historicalAttempts} tentativa(s)${item.historicalFailures ? ` · ${item.historicalFailures} reprovação(ões)` : ''}${item.previousAttempt?.grade != null ? ` · última nota ${Number(item.previousAttempt.grade).toFixed(1)}` : ''}${item.historicalBestGrade != null ? ` · melhor ${Number(item.historicalBestGrade).toFixed(1)}` : ''}</div>` : ''}
          <small>Risco atual: ${view.esc(item.riskReason)}</small>
          ${(!item.hasSessions || !item.hasDiaries || !item.hasGrades) ? `<div class="subject-missing-data-note"><i class="fas fa-circle-info"></i> ${[!item.hasSessions ? 'sem sessão de estudo' : null, !item.hasDiaries ? 'sem diário de aula' : null, !item.hasGrades ? 'sem nota lançada' : null].filter(Boolean).join(' · ')} — registre pra essa análise ficar mais precisa.</div>` : ''}
        </div>`;
      }).join('')}</div>`;
  }

  function renderAgendaPanel(view) {
    const eventosBrutos = [
      ...(view.app.data.sessions || []).map(item => ({ ...item, eventType: 'sessao', when: item.data, title: item.topico || item.materia, subtitle: `${item.materia} • ${item.tipo || 'estudo'}` })),
      ...(view.app.data.tasks || []).map(item => ({ ...item, eventType: 'tarefa', when: item.dataLimite, title: item.titulo, subtitle: `${item.materia} • tarefa` })),
      ...(view.app.data.exams || []).map(item => ({ ...item, eventType: 'exame', when: item.data, title: item.titulo, subtitle: `${item.materia} • ${item.tipo || 'avaliação'}` })),
      ...(view.app.data.reviews || []).map(item => ({ ...item, eventType: 'revisao', when: item.data, title: item.topico || 'Revisão', subtitle: `${item.materia} • revisão` })),
      ...(view.app.data.classDiaries || []).map(item => ({ ...item, eventType: 'aula', when: item.data, title: item.conteudoExplicado || 'Registro de aula', subtitle: `${item.materia} • diário de aula` }))
    ].filter(item => item.when).sort((a,b) => new Date(a.when) - new Date(b.when));

    // Mesmo filtro de "semestre atual" usado em Tarefas/Provas/Calendário —
    // matérias arquivadas (fora do semestre em curso) não poluem a agenda.
    const { atuais: events, arquivadas } = typeof view.app.filterSemestreAtual === 'function'
      ? view.app.filterSemestreAtual(eventosBrutos, 'materia')
      : { atuais: eventosBrutos, arquivadas: 0 };

    const filters = ['todos', 'sessao', 'tarefa', 'exame', 'revisao', 'aula'];
    const buttons = filters.map(filter => `<button class="calendar-filter-btn ${filter === 'todos' ? 'active' : ''}" data-filter="${filter}">${filter === 'todos' ? 'Todos' : filter}</button>`).join('');
    const list = events.slice(0, 30).map(item => `
      <div class="agenda-item" data-event-filter="${item.eventType}">
        <div><strong>${view.esc(item.title)}</strong><small>${view.esc(item.subtitle)} • ${formatarData(item.when)}</small></div>
        <span class="risk-pill ${item.eventType === 'exame' ? 'alto' : item.eventType === 'tarefa' ? 'medio' : 'baixo'}">${item.eventType}</span>
      </div>`).join('') || '<p class="text-secondary">Nenhum evento cadastrado.</p>';
    const nota = arquivadas ? `<small class="text-secondary agenda-archived-note"><i class="fas fa-box-archive"></i> ${arquivadas} matéria${arquivadas > 1 ? 's' : ''} arquivada${arquivadas > 1 ? 's' : ''} escondida${arquivadas > 1 ? 's' : ''} da agenda</small>` : '';
    return `<div class="agenda-card"><div class="agenda-head"><div><h3><i class="fas fa-calendar-check"></i> Agenda acadêmica completa</h3><small>Provas, trabalhos, revisões, sessões e diários.</small></div></div>${nota}<div class="agenda-filters">${buttons}</div><div class="agenda-list" id="agenda-list">${list}</div></div>`;
  }

  function ensureLaunchData(app) {
    if (!app?.data) return;
    app.data.user = app.data.user || {};
    app.data.settings = app.data.settings || {};
    if (!Number.isFinite(Number(app.data.user.dailyStudyGoalHours))) {
      app.data.user.dailyStudyGoalHours = Math.max(2, Math.min(8, Number(app.data.user.horasMaximas) || 3));
    }
    if (!Array.isArray(app.data.user.achievements)) app.data.user.achievements = [];
    const game = app.data.user.gamification = app.data.user.gamification || {};
    if (!Number.isFinite(Number(game.xp))) game.xp = 0;
    if (!Number.isFinite(Number(game.level))) game.level = 1;
    if (!Array.isArray(game.history)) game.history = [];
    if (!Array.isArray(game.achievementsUnlocked)) game.achievementsUnlocked = [];
    if (!game.awardedRefs || typeof game.awardedRefs !== 'object') game.awardedRefs = {};
    if (!game.lastLevelAnimation) game.lastLevelAnimation = 1;
  }


  function getAchievementCatalog(app) {
    const sessionsDone = (app?.data?.sessions || []).filter(s => s?.concluida || s?.status === 'concluida');
    const tasksDone = (app?.data?.tasks || []).filter(t => t?.concluida).length;
    const reviewsDone = (app?.data?.reviews || []).filter(r => r?.concluida).length;
    const totalMinutes = sessionsDone.reduce((acc, s) => acc + (Number(s?.duracao) || 0), 0);
    const streak = Number(app?.data?.user?.streak || 0);
    const xp = Number(app?.data?.user?.gamification?.xp || 0);
    const totalActions = sessionsDone.length + tasksDone + reviewsDone;
    return [
      { id: 'welcome', icon: 'fa-seedling', title: 'Primeiros passos', text: 'Ganhe seu primeiro XP no sistema.', unlocked: xp >= 1, tier: 'bronze' },
      { id: 'first_task', icon: 'fa-check-circle', title: 'Primeira entrega', text: 'Concluiu a primeira tarefa no sistema.', unlocked: tasksDone >= 1, tier: 'bronze' },
      { id: 'task_5', icon: 'fa-list-check', title: 'Embalado', text: 'Concluiu 5 tarefas.', unlocked: tasksDone >= 5, tier: 'silver' },
      { id: 'task_20', icon: 'fa-clipboard-check', title: 'Máquina de concluir', text: 'Concluiu 20 tarefas.', unlocked: tasksDone >= 20, tier: 'gold' },
      { id: 'review_1', icon: 'fa-rotate', title: 'Revisou de verdade', text: 'Fez a primeira revisão concluída.', unlocked: reviewsDone >= 1, tier: 'bronze' },
      { id: 'review_10', icon: 'fa-book-bookmark', title: 'Memória afiada', text: 'Fez 10 revisões concluídas.', unlocked: reviewsDone >= 10, tier: 'silver' },
      { id: 'session_5', icon: 'fa-stopwatch', title: 'Entrou no ritmo', text: 'Concluiu 5 sessões de estudo.', unlocked: sessionsDone.length >= 5, tier: 'bronze' },
      { id: 'focus_10h', icon: 'fa-brain', title: 'Mente blindada', text: 'Acumulou 10 horas válidas de estudo.', unlocked: totalMinutes >= 600, tier: 'silver' },
      { id: 'focus_30h', icon: 'fa-fire-flame-curved', title: 'Monstro da disciplina', text: 'Acumulou 30 horas válidas de estudo.', unlocked: totalMinutes >= 1800, tier: 'gold' },
      { id: 'streak_3', icon: 'fa-fire', title: 'Constância', text: 'Manteve streak de 3 dias.', unlocked: streak >= 3, tier: 'bronze' },
      { id: 'streak_7', icon: 'fa-fire', title: 'Semana fechada', text: 'Manteve streak de 7 dias.', unlocked: streak >= 7, tier: 'silver' },
      { id: 'xp_250', icon: 'fa-bolt', title: 'Subiu de patamar', text: 'Chegou aos 250 XP totais.', unlocked: xp >= 250, tier: 'bronze' },
      { id: 'xp_750', icon: 'fa-trophy', title: 'Conta forte', text: 'Chegou aos 750 XP totais.', unlocked: xp >= 750, tier: 'gold' },
      { id: 'all_rounder', icon: 'fa-shield-heart', title: 'Jogador completo', text: 'Concluiu sessão, tarefa e revisão.', unlocked: sessionsDone.length >= 1 && tasksDone >= 1 && reviewsDone >= 1, tier: 'silver' },
      { id: 'action_50', icon: 'fa-gamepad', title: 'No vício certo', text: 'Completou 50 ações válidas.', unlocked: totalActions >= 50, tier: 'gold' }
    ];
  }

  function computeLevelFromXP(xp) {
    const value = Math.max(0, Number(xp) || 0);
    return Math.max(1, Math.floor(value / 250) + 1);
  }

  function ensureLevelUpFX() {
    let fx = el('level-up-fx');
    if (fx) return fx;
    fx = document.createElement('div');
    fx.id = 'level-up-fx';
    fx.className = 'level-up-fx';
    fx.innerHTML = '<div class="level-up-card"><div class="level-up-burst"></div><div class="level-up-label">LEVEL UP</div><div class="level-up-value" id="level-up-value">Nível 2</div><div class="level-up-copy">Você subiu de nível. Bora manter o ritmo.</div></div>';
    document.body.appendChild(fx);
    return fx;
  }

  function playLevelUpAnimation(level) {
    const fx = ensureLevelUpFX();
    const value = el('level-up-value');
    if (value) value.textContent = `Nível ${level}`;
    fx.classList.remove('show');
    requestAnimationFrame(() => fx.classList.add('show'));
    clearTimeout(window.__slcLevelUpTimer);
    window.__slcLevelUpTimer = setTimeout(() => fx.classList.remove('show'), 2600);
  }

  function showXPBurst(xpValue, sourceEl) {
    const amount = Math.max(0, Math.round(Number(xpValue) || 0));
    if (!amount) return;
    const burst = document.createElement('div');
    burst.className = 'xp-burst-fx';
    burst.textContent = `+${amount} XP`;
    const rect = sourceEl?.getBoundingClientRect?.();
    if (rect) {
      burst.style.left = `${rect.left + rect.width / 2}px`;
      burst.style.top = `${rect.top + window.scrollY - 6}px`;
    } else {
      burst.style.left = '50%';
      burst.style.top = `${window.scrollY + 140}px`;
    }
    document.body.appendChild(burst);
    setTimeout(() => burst.classList.add('show'), 10);
    setTimeout(() => burst.remove(), 1500);
  }


  function patchLaunchMethods() {
    if (!window.StudyLifeControl || window.StudyLifeControl.prototype.__launchMethodsPatched) return;
    const proto = window.StudyLifeControl.prototype;

    proto.getDailyGoalSnapshot = function () {
      ensureLaunchData(this);
      const progress = this.calcularProgressoHoje?.() || { concluido: 0, percentual: 0 };
      const target = Math.max(1, Number(this.data.user?.dailyStudyGoalHours) || 3);
      const concluded = Number(progress.concluido) || 0;
      return {
        target,
        concluded,
        remaining: Math.max(0, +(target - concluded).toFixed(1)),
        percent: Math.min(100, Math.round((concluded / target) * 100)),
        streak: Number(this.data.user?.streak || 0)
      };
    };

    proto.saveDailyGoal = async function (hours) {
      ensureLaunchData(this);
      const value = Math.max(1, Math.min(12, Number(hours) || 3));
      this.data.user.dailyStudyGoalHours = value;
      await dbService.saveData('user', this.data.user);
      return value;
    };

    proto.getGamificationSnapshot = function () {
      ensureLaunchData(this);
      const game = this.data.user.gamification || {};
      const sessions = (this.data.sessions || []).filter(s => s?.concluida || s?.status === 'concluida');
      const tasksDone = (this.data.tasks || []).filter(t => t?.concluida).length;
      const reviewsDone = (this.data.reviews || []).filter(r => r?.concluida).length;
      const minutes = sessions.reduce((acc, s) => acc + (Number(s?.duracao) || 0), 0);
      const xp = Math.max(0, Math.round(Number(game.xp) || 0));
      const level = computeLevelFromXP(xp);
      const currentBase = (level - 1) * 250;
      const nextBase = level * 250;
      const progress = Math.min(100, Math.round(((xp - currentBase) / Math.max(1, nextBase - currentBase)) * 100));
      const allAchievements = getAchievementCatalog(this);
      const unlockedIds = new Set(game.achievementsUnlocked || []);
      const achievements = allAchievements.filter(item => unlockedIds.has(item.id));
      const lockedAchievements = allAchievements.filter(item => !unlockedIds.has(item.id));
      const history = (game.history || []).slice().sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0)).slice(0, 20);
      return {
        xp,
        level,
        progress,
        nextLevelIn: Math.max(0, nextBase - xp),
        tasksDone,
        reviewsDone,
        totalHours: +(minutes / 60).toFixed(1),
        streak: Number(this.data.user?.streak || 0),
        achievements,
        lockedAchievements,
        allAchievements,
        history
      };
    };

    proto.syncGamificationAchievements = async function () {
      ensureLaunchData(this);
      const game = this.data.user.gamification;
      const unlocked = new Set(game.achievementsUnlocked || []);
      const newlyUnlocked = getAchievementCatalog(this).filter(item => item.unlocked && !unlocked.has(item.id));
      if (!newlyUnlocked.length) return [];
      newlyUnlocked.forEach(item => unlocked.add(item.id));
      game.achievementsUnlocked = Array.from(unlocked);
      newlyUnlocked.forEach(item => {
        game.history.unshift({ id: generateId(), type: 'achievement', label: `Conquista desbloqueada: ${item.title}`, xp: 0, at: new Date().toISOString(), meta: item.id });
        showToast(`🏆 ${item.title}`, 'success');
      });
      game.history = game.history.slice(0, 40);
      await dbService.saveData('user', this.data.user);
      return newlyUnlocked;
    };

    proto.awardXP = async function (payload = {}) {
      ensureLaunchData(this);
      const game = this.data.user.gamification;
      const ref = payload.ref || payload.refId || '';
      if (ref && game.awardedRefs?.[ref]) return { awarded: false, level: Number(game.level || 1), xp: Number(game.xp || 0) };
      const xpValue = Math.max(0, Math.round(Number(payload.xp) || 0));
      const beforeXP = Number(game.xp || 0);
      const beforeLevel = computeLevelFromXP(beforeXP);
      game.xp = beforeXP + xpValue;
      game.level = computeLevelFromXP(game.xp);
      if (ref) game.awardedRefs[ref] = true;
      game.history.unshift({
        id: generateId(),
        type: payload.type || 'xp',
        label: payload.label || 'XP ganho',
        xp: xpValue,
        at: new Date().toISOString(),
        meta: payload.meta || ''
      });
      game.history = game.history.slice(0, 40);
      await this.syncGamificationAchievements();
      await dbService.saveData('user', this.data.user);
      if (game.level > beforeLevel) {
        playLevelUpAnimation(game.level);
        showToast(`Level up! Você chegou no nível ${game.level}.`, 'success');
      } else if (xpValue > 0) {
        showXPBurst(xpValue, window.__slcLastXpSourceEl);
        showToast(`+${xpValue} XP • ${payload.label || 'progresso registrado'}`, 'success');
      }
      return { awarded: true, level: game.level, xp: game.xp };
    };

    proto.getLaunchNotifications = function () {
      const items = [];
      (this.getUpcomingExams?.(7) || []).slice(0, 4).forEach(exam => items.push({
        type: 'prova',
        priority: diasAte(exam.data) <= 2 ? 'alta' : 'media',
        title: `${exam.titulo || 'Prova'} chegando`,
        text: `${exam.materia} em ${Math.max(0, diasAte(exam.data))} dia(s).`,
        badge: `${Math.max(0, diasAte(exam.data))}d`
      }));
      (this.data.tasks || []).filter(t => !t?.concluida && diasAte(t.dataLimite) < 0).slice(0, 4).forEach(task => items.push({
        type: 'tarefa',
        priority: 'alta',
        title: 'Tarefa atrasada',
        text: `${task.titulo} • ${task.materia || 'sem matéria'}`,
        badge: `${Math.abs(diasAte(task.dataLimite))}d`
      }));
      (this.analyzeAcademicRisk?.() || []).slice(0, 3).forEach(risk => items.push({
        type: 'risco',
        priority: risk.nivel === 'alto' ? 'alta' : 'media',
        title: `Risco ${risk.nivel} em ${risk.materia}`,
        text: risk.motivo,
        badge: risk.nivel
      }));
      (this.getReviewItemsForDays?.(0) || []).slice(0, 3).forEach(review => items.push({
        type: 'revisao',
        priority: 'baixa',
        title: 'Revisão pendente hoje',
        text: `${review.materia || 'Matéria'} • ${review.topico || 'revisar conteúdo'}`,
        badge: 'hoje'
      }));
      const rank = { alta: 0, media: 1, baixa: 2 };
      return items.sort((a, b) => rank[a.priority] - rank[b.priority]).slice(0, 8);
    };

    proto.getWeeklyHoursChartData = function () {
      const source = this.smartDashboard?.getProgressoSemanal?.() || [];
      return source.map(item => ({ ...item, value: Number(item.horas) || 0 }));
    };

    proto.getDashboardSubjectShare = function () {
      const totals = this.calcularHorasPorMateria?.() || [];
      const grand = totals.reduce((acc, item) => acc + (Number(item.horas) || 0), 0) || 1;
      return (this.data.subjects || []).map(subject => {
        const perf = this.getSubjectPerformance?.(subject.nome);
        const hours = Number(totals.find(item => item.materia === subject.nome)?.horas || 0);
        return {
          materia: subject.nome,
          hours,
          share: Math.round((hours / grand) * 100),
          average: perf?.average || 0,
          riskLevel: perf?.riskLevel || 'baixo',
          tasksPending: perf?.tasksPending || 0
        };
      }).sort((a, b) => b.hours - a.hours).slice(0, 6);
    };

    proto.__launchMethodsPatched = true;
  }

  function renderDailyGoalCard(view) {
    const goal = view.app.getDailyGoalSnapshot?.();
    if (!goal) return '';
    return `<div class="daily-goal-card">
      <div class="daily-goal-top">
        <div>
          <h3><i class="fas fa-bullseye"></i> Meta diária de estudo</h3>
          <p>Hoje: <strong>${goal.concluded.toFixed(1)}h</strong> de <strong>${goal.target}h</strong>. Falta ${goal.remaining.toFixed(1)}h para bater tua meta.</p>
        </div>
        <div class="daily-goal-actions">
          <div class="daily-goal-inline">
            <input type="number" id="daily-goal-input" min="1" max="12" step="0.5" value="${goal.target}">
            <button class="btn-secondary" id="save-daily-goal-btn"><i class="fas fa-save"></i> Salvar meta</button>
          </div>
        </div>
      </div>
      <div class="progress-bar" style="margin-top:14px"><div class="progress-fill" style="width:${goal.percent}%"></div></div>
      <div class="daily-goal-meta">
        <div class="daily-goal-pill"><span>Progresso</span><strong>${goal.percent}%</strong></div>
        <div class="daily-goal-pill"><span>Sequência</span><strong>${goal.streak} dias</strong></div>
        <div class="daily-goal-pill"><span>Ritmo sugerido</span><strong>${goal.remaining > 0 ? `${goal.remaining.toFixed(1)}h restantes` : 'Meta batida'}</strong></div>
      </div>
    </div>`;
  }

  function renderImpactSection(view) {
    const chart = view.app.getWeeklyHoursChartData?.() || [];
    const subjects = view.app.getDashboardSubjectShare?.() || [];
    const risk = view.app.analyzeAcademicRisk?.() || [];
    const totalWeek = chart.reduce((acc, item) => acc + (Number(item.value) || 0), 0);
    const topSubject = subjects[0]?.materia || '—';
    const maxBar = Math.max(1, ...chart.map(item => Number(item.value) || 0));
    return `<div class="impact-grid">
      <div class="impact-card">
        <div class="subject-performance-head"><div><h3><i class="fas fa-chart-column"></i> Horas da semana</h3><small>Visual do teu ritmo nos últimos 7 dias.</small></div><div class="today-badge">${totalWeek.toFixed(1)}h</div></div>
        <div class="mini-chart">${chart.map(item => `<div class="mini-chart-bar-wrap"><div class="mini-chart-value">${Number(item.value || 0).toFixed(1)}h</div><div class="mini-chart-bar" style="height:${Math.max(10, Math.round(((Number(item.value)||0) / maxBar) * 120))}px"></div><div class="mini-chart-label">${item.dia}</div></div>`).join('')}</div>
      </div>
      <div class="impact-card">
        <div class="subject-performance-head"><div><h3><i class="fas fa-book-open"></i> % por matéria</h3><small>Onde teu esforço está indo agora.</small></div><div class="today-badge">Top: ${view.esc(topSubject)}</div></div>
        <div class="subject-share-list">${subjects.length ? subjects.map(item => `<div class="subject-share-item"><div class="subject-share-meta"><strong>${view.esc(item.materia)}</strong><small>${item.hours.toFixed(1)}h • média ${Number(item.average || 0).toFixed(1)} • ${item.tasksPending} pendência(s)</small><div class="subject-share-track"><div class="subject-share-fill" style="width:${Math.max(4, item.share)}%"></div></div></div><span class="risk-pill ${view.esc(item.riskLevel)}">${item.share}%</span></div>`).join('') : '<p class="text-secondary">Adicione sessões concluídas para ver distribuição por matéria.</p>'}</div>
      </div>
      <div class="impact-card">
        <div class="subject-performance-head"><div><h3><i class="fas fa-triangle-exclamation"></i> Risco de reprovação</h3><small>Leitura rápida do semestre.</small></div><div class="today-badge">${risk.length} alerta(s)</div></div>
        <div class="risk-meter">
          <div class="risk-segment alto"><span>Alto</span><strong>${risk.filter(item => item.nivel === 'alto').length}</strong></div>
          <div class="risk-segment medio"><span>Médio</span><strong>${risk.filter(item => item.nivel === 'medio').length}</strong></div>
          <div class="risk-segment baixo"><span>Baixo</span><strong>${Math.max(0, (view.app.data.subjects || []).length - risk.length)}</strong></div>
        </div>
        <div class="subject-share-list">${risk.length ? risk.slice(0, 4).map(item => `<div class="subject-share-item"><div class="subject-share-meta"><strong>${view.esc(item.materia)}</strong><small>${view.esc(item.motivo)}</small></div><span class="risk-pill ${view.esc(item.nivel)}">${view.esc(item.nivel)}</span></div>`).join('') : '<p class="text-secondary">Nenhuma matéria em risco forte agora.</p>'}</div>
      </div>
    </div>`;
  }

  function renderNotificationSection(view) {
    const items = view.app.getLaunchNotifications?.() || [];
    return `<div class="notification-grid"><div class="notification-card"><div class="subject-performance-head"><div><h3><i class="fas fa-bell"></i> Notificações simples</h3><small>Provas chegando, tarefas atrasadas e revisões do dia.</small></div><span class="notification-badge">${items.length}</span></div><div class="notification-list">${items.length ? items.map(item => `<div class="notification-item"><div><strong>${view.esc(item.title)}</strong><small>${view.esc(item.text)}</small></div><span class="risk-pill ${item.priority === 'alta' ? 'alto' : item.priority === 'media' ? 'medio' : 'baixo'}">${view.esc(item.badge)}</span></div>`).join('') : '<p class="text-secondary">Nenhum alerta agora. Tá tudo sob controle.</p>'}</div></div></div>`;
  }

  function renderGamificationSection(view) {
    return '';
  }

  function renderGamificationPage(view) {
    const game = view.app.getGamificationSnapshot?.();
    if (!game) return '';
    const badgeFor = (item, locked = false) => `<span class="achievement-status ${locked ? 'locked' : 'unlocked'}">${locked ? 'bloqueada' : 'desbloqueada'}</span>`;
    const cardFor = (item, locked = false) => `
      <div class="achievement-steam-card ${locked ? 'locked' : 'unlocked'} ${item.tier || 'bronze'}">
        <div class="achievement-steam-icon"><i class="fas ${view.esc(locked ? 'fa-lock' : (item.icon || 'fa-trophy'))}"></i></div>
        <div class="achievement-steam-body">
          <strong>${view.esc(item.title)}</strong>
          <small>${view.esc(item.text)}</small>
        </div>
        ${badgeFor(item, locked)}
      </div>`;
    return `
      <div class="view-header"><h2><i class="fas fa-trophy"></i> Gamificação</h2></div>
      <div class="gamification-page-grid">
        <div class="gamification-card">
          <div class="xp-progress-head"><div><h3>Nível ${game.level}</h3><small>XP só cai quando você conclui ações dentro do sistema.</small></div><div class="today-badge">${game.xp} XP</div></div>
          <div class="impact-kpis">
            <div class="impact-kpi"><span>XP total</span><strong>${game.xp}</strong></div>
            <div class="impact-kpi"><span>Streak</span><strong>${game.streak} dias</strong></div>
            <div class="impact-kpi"><span>Tarefas feitas</span><strong>${game.tasksDone}</strong></div>
            <div class="impact-kpi"><span>Horas validadas</span><strong>${game.totalHours}h</strong></div>
          </div>
          <div class="progress-bar" style="margin-top:14px"><div class="progress-fill" style="width:${game.progress}%"></div></div>
          <div class="xp-progress-copy">Faltam ${game.nextLevelIn} XP para o próximo nível.</div>
        </div>
        <div class="gamification-card">
          <div class="history-title"><strong>Histórico de XP</strong></div>
          <div class="history-list">${game.history.length ? game.history.map(item => `<div class="history-item"><div><strong>${view.esc(item.label)}</strong><small>${view.esc(formatarData(item.at || new Date().toISOString()))}</small></div><span class="history-xp ${Number(item.xp) > 0 ? 'gain' : 'neutral'}">${Number(item.xp) > 0 ? '+' : ''}${Number(item.xp) || 0} XP</span></div>`).join('') : '<p class="text-secondary">Ainda não houve ganho de XP nesta conta.</p>'}</div>
        </div>
      </div>
      <div class="gamification-card" style="margin-top:18px">
        <div class="history-title"><strong>Conquistas desbloqueadas</strong></div>
        <div class="achievement-steam-grid unlocked-grid">${game.achievements.length ? game.achievements.map(item => cardFor(item, false)).join('') : '<p class="text-secondary">Ainda não tem conquista desbloqueada.</p>'}</div>
      </div>
      <div class="gamification-card" style="margin-top:18px">
        <div class="history-title"><strong>Conquistas bloqueadas</strong></div>
        <div class="achievement-steam-grid locked-grid">${game.lockedAchievements.length ? game.lockedAchievements.map(item => cardFor(item, true)).join('') : '<p class="text-secondary">Você desbloqueou tudo. Monstro.</p>'}</div>
      </div>`;
  }

  function ensureFloatingAIDom() {
    if (el('floating-ai-launcher')) return;
    const launcher = document.createElement('div');
    launcher.id = 'floating-ai-launcher';
    launcher.className = 'floating-ai-launcher';
    launcher.innerHTML = `<button class="floating-ai-button" id="floating-ai-button" aria-label="Abrir mentor IA"><i class="fas fa-robot"></i></button>`;
    const backdrop = document.createElement('div');
    backdrop.id = 'floating-ai-backdrop';
    backdrop.className = 'floating-ai-backdrop';
    const panel = document.createElement('div');
    panel.id = 'floating-ai-panel';
    panel.className = 'floating-ai-panel';
    panel.innerHTML = `
      <div class="floating-ai-header">
        <div><strong>Mentor IA</strong><p>Abre tipo chat e responde com base no teu semestre.</p></div>
        <button class="floating-ai-close" id="floating-ai-close" aria-label="Fechar"><i class="fas fa-times"></i></button>
      </div>
      <div class="floating-ai-messages" id="floating-ai-messages">
        <div class="floating-ai-message assistant">Fala. Posso montar teu plano de hoje, analisar risco, dizer o que estudar agora e revisar metas.</div>
      </div>
      <div class="floating-ai-suggestions" id="floating-ai-suggestions">
        <button class="floating-ai-suggestion" data-question="Qual meu plano de estudo para hoje?">Plano de hoje</button>
        <button class="floating-ai-suggestion" data-question="Quais os riscos acadêmicos agora?">Riscos</button>
        <button class="floating-ai-suggestion" data-question="O que estudar agora?">O que estudar</button>
      </div>
      <div class="floating-ai-input">
        <input type="text" id="floating-ai-input" placeholder="Pergunte qualquer coisa sobre tua rotina...">
        <button id="floating-ai-send"><i class="fas fa-paper-plane"></i></button>
      </div>`;
    document.body.appendChild(backdrop);
    document.body.appendChild(panel);
    document.body.appendChild(launcher);
  }


  function syncFloatingAIVisibility() {
    const launcher = el('floating-ai-launcher');
    const panel = el('floating-ai-panel');
    const button = el('floating-ai-button');
    const loginScreen = el('login-screen');
    const setupScreen = el('setup-screen');
    const mainDashboard = el('main-dashboard');
    const loginVisible = !!loginScreen && getComputedStyle(loginScreen).display !== 'none';
    const setupVisible = !!setupScreen && getComputedStyle(setupScreen).display !== 'none';
    const dashboardVisible = !!mainDashboard && getComputedStyle(mainDashboard).display !== 'none';
    const shouldShow = dashboardVisible && !loginVisible && !setupVisible;
    if (launcher) launcher.classList.toggle('hidden', !shouldShow);
    if (!shouldShow) {
      panel?.classList.remove('open');
      el('floating-ai-backdrop')?.classList.remove('open');
      button?.classList.remove('hidden');
    }
  }

  function bindFloatingAI(app) {
    ensureFloatingAIDom();
    const button = el('floating-ai-button');
    const panel = el('floating-ai-panel');
    const backdrop = el('floating-ai-backdrop');
    const close = el('floating-ai-close');
    const input = el('floating-ai-input');
    const send = el('floating-ai-send');
    const messages = el('floating-ai-messages');
    if (!button || button.dataset.bound) return;
    const launcher = el('floating-ai-launcher');
    const open = () => { panel?.classList.add('open'); backdrop?.classList.add('open'); button?.classList.add('hidden'); launcher?.classList.add('panel-open'); setTimeout(() => input?.focus(), 50); };
    const hide = () => { panel?.classList.remove('open'); backdrop?.classList.remove('open'); button?.classList.remove('hidden'); launcher?.classList.remove('panel-open'); syncFloatingAIVisibility(); };
    const append = (role, content, options = {}) => {
      const node = document.createElement('div');
      node.className = `floating-ai-message ${role}`;
      if (role === 'assistant') {
        const memoryTag = options?.memoryTag ? `<div class="floating-ai-memory-chip"><i class="fas fa-brain"></i>${options.memoryTag}</div>` : '';
        node.innerHTML = `${memoryTag}${nl2brSafe(content || 'Sem resposta agora.')}`;
        const actions = Array.isArray(options?.actions) ? options.actions.filter(Boolean).slice(0, 4) : [];
        if (actions.length) {
          const wrap = document.createElement('div');
          wrap.className = 'floating-ai-inline-actions';
          actions.forEach(actionText => {
            const btn = document.createElement('button');
            btn.className = 'floating-ai-inline-action';
            btn.textContent = actionText;
            btn.addEventListener('click', () => ask(actionText));
            wrap.appendChild(btn);
          });
          node.appendChild(wrap);
        }
      } else node.textContent = content || '';
      messages?.appendChild(node);
      if (messages) messages.scrollTop = messages.scrollHeight;
      return node;
    };
    const ask = async (question) => {
      const text = String(question || input?.value || '').trim();
      if (!text) return;
      open();
      append('user', text);
      if (input) input.value = '';
      const loading = append('assistant', 'Pensando no melhor próximo passo pra você...');
      try {
        window.aiAssistant?.updateContext(app?.data || {});
        const rich = await (window.aiAssistant?.askRich?.(text) || Promise.resolve(null));
        const answer = rich?.text || await window.aiAssistant?.ask?.(text);
        const memoryCount = Array.isArray(rich?.memory) ? rich.memory.length : 0;
        loading.remove();
        append('assistant', answer || 'Não consegui responder agora.', {
          actions: rich?.actions || [],
          memoryTag: memoryCount > 1 ? `Lembrando ${memoryCount} troca(s) dessa conversa` : 'Modo coach ligado'
        });
      } catch (error) {
        loading.remove();
        append('assistant', 'Deu erro ao responder agora. Tenta de novo.', { actions: ['Qual meu plano de hoje?', 'O que está atrasado?'] });
      }
    };
    button.dataset.bound = '1';
    button.addEventListener('click', open);
    close?.addEventListener('click', hide);
    backdrop?.addEventListener('click', hide);
    send?.addEventListener('click', () => ask());
    input?.addEventListener('keydown', e => { if (e.key === 'Enter') ask(); });
    document.querySelectorAll('.floating-ai-suggestion').forEach(btn => btn.addEventListener('click', () => ask(btn.dataset.question || '')));
  }

  function renderSituationPage(view) {
    const summary = view.app.getAcademicSituationSummary();
    const makeList = (items, empty) => items.length ? items.map(item => `<div class="agenda-item"><div><strong>${view.esc(item.subject.nome)}</strong><small>${view.esc(item.recommendation)}</small></div><span class="risk-pill ${view.esc(item.riskLevel)}">${view.esc(item.riskLevel)}</span></div>`).join('') : `<p class="text-secondary">${empty}</p>`;
    const reminder = renderDataReminderBanner(view, summary);
    return `
      <div class="view-header"><h2><i class="fas fa-heartbeat"></i> Situação Acadêmica</h2></div>
      ${reminder}
      <div class="situation-kpis">
        <div class="situation-kpi"><span>Matérias seguras</span><strong>${summary.safe.length}</strong></div>
        <div class="situation-kpi"><span>Em atenção</span><strong>${summary.attention.length}</strong></div>
        <div class="situation-kpi"><span>Em risco</span><strong>${summary.risk.length}</strong></div>
        <div class="situation-kpi"><span>Frequência média</span><strong>${summary.avgAttendance !== null ? summary.avgAttendance + '%' : '—'}</strong></div>
        <div class="situation-kpi"><span>Média geral</span><strong>${summary.generalAverage}</strong></div>
        <div class="situation-kpi"><span>Horas estudadas</span><strong>${summary.totalHoursStudied.toFixed(1)}h</strong></div>
        <div class="situation-kpi"><span>Pendências da semana</span><strong>${summary.weekPending}</strong></div>
      </div>
      <div class="situation-grid">
        <div class="situation-card"><h3>Seguras</h3><div class="situation-list">${makeList(summary.safe, 'Nenhuma matéria em zona segura ainda.')}</div></div>
        <div class="situation-card"><h3>Em atenção</h3><div class="situation-list">${makeList(summary.attention, 'Nenhuma matéria em atenção agora.')}</div></div>
        <div class="situation-card"><h3>Em risco</h3><div class="situation-list">${makeList(summary.risk, 'Nenhuma matéria crítica agora.')}</div></div>
      </div>`;
  }

  // Banner que avisa quando faltam dados reais (sessões, diário de aula ou
  // notas) pra situação acadêmica não ficar mostrando números otimistas
  // que não refletem o que a pessoa realmente estudou/registrou.
  function renderDataReminderBanner(view, summary) {
    const totalSubjects = summary.performances.length;
    if (!totalSubjects) return '';

    const noData = summary.noDataAtAll || [];
    const missingSessionsOnly = (summary.missingSessions || []).filter(nome => !noData.includes(nome));
    const missingDiaryOnly = (summary.missingDiary || []).filter(nome => !noData.includes(nome));
    const missingGradesOnly = (summary.missingGrades || []).filter(nome => !noData.includes(nome));

    if (!noData.length && !missingSessionsOnly.length && !missingDiaryOnly.length && !missingGradesOnly.length) return '';

    const chip = (nome, action, label) => `<button type="button" class="reminder-chip" data-reminder-action="${action}" data-reminder-materia="${view.esc(nome)}"><i class="fas fa-plus"></i> ${view.esc(nome)} — ${label}</button>`;

    const blocks = [];
    if (noData.length) {
      blocks.push(`<div class="reminder-block"><strong>Sem nenhum registro ainda:</strong><div class="reminder-chip-row">${noData.map(nome => chip(nome, 'sessao', 'registrar estudo')).join('')}</div></div>`);
    }
    if (missingSessionsOnly.length) {
      blocks.push(`<div class="reminder-block"><strong>Sem sessão de estudo registrada:</strong><div class="reminder-chip-row">${missingSessionsOnly.map(nome => chip(nome, 'sessao', 'registrar sessão')).join('')}</div></div>`);
    }
    if (missingDiaryOnly.length) {
      blocks.push(`<div class="reminder-block"><strong>Sem diário de aula registrado:</strong><div class="reminder-chip-row">${missingDiaryOnly.map(nome => chip(nome, 'diario', 'registrar diário')).join('')}</div></div>`);
    }
    if (missingGradesOnly.length) {
      blocks.push(`<div class="reminder-block"><strong>Sem nota lançada ainda:</strong><div class="reminder-chip-row">${missingGradesOnly.map(nome => chip(nome, 'nota', 'lançar nota')).join('')}</div></div>`);
    }

    return `
      <div class="situation-reminder-banner">
        <div class="situation-reminder-head">
          <i class="fas fa-triangle-exclamation"></i>
          <div><h3>Estude e registre aqui</h3><p>Sua situação acadêmica só fica precisa com dados reais. Toque numa matéria abaixo pra registrar o que faltou.</p></div>
        </div>
        ${blocks.join('')}
      </div>`;
  }

  function bindSituationPageActions(app) {
    document.querySelectorAll('[data-reminder-action]').forEach(btn => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => {
        const action = btn.dataset.reminderAction;
        const materia = btn.dataset.reminderMateria || '';
        if (action === 'sessao') app.openModal?.('sessao', { materia });
        else if (action === 'nota') app.openModal?.('nota', { materia });
        else if (action === 'diario') window.diaryView?.openModal?.(null, materia);
      });
    });
  }



  function patchViewRenderer() {
    if (!window.ViewRenderer || window.ViewRenderer.prototype[PATCH_FLAG]) return;
    const proto = window.ViewRenderer.prototype;
    const originalDashboard = proto.renderDashboard;
    const originalMaterias = proto.renderMaterias;
    const originalCalendario = proto.renderCalendario;
    const originalMentor = proto.renderMentorIA;
    const originalFoco = proto.renderModoFoco;
    const originalGradeSemanal = proto.renderGradeSemanalComHoras;
    const originalConfig = proto.renderConfiguracoes;

    proto.renderDashboard = function () {
      let base = originalDashboard.call(this);
      base = base.replace(/<div class="card">\s*<div class="card-header">\s*<h3><i class="fas fa-robot"><\/i> Plano de Hoje \(IA\)<\/h3>[\s\S]*?<\/div>\s*<\/div>/, '');
      const insert = `${renderDailyGoalCard(this)}${renderGoalsPanel(this)}${renderImpactSection(this)}<div class="report-stack"><div class="report-card"><h3><i class="fas fa-file-alt"></i> Relatórios automáticos</h3><p>${this.esc(this.app.getAutoReports().daily)}</p><p>${this.esc(this.app.getAutoReports().weekly)}</p><p>${this.esc(this.app.getAutoReports().monthly)}</p></div>${renderAgendaPanel(this)}</div>`;
      return base.replace('<div class="dashboard-grid">', `${insert}<div class="dashboard-grid">`);
    };

    proto.renderMaterias = function () {
      const base = originalMaterias.call(this);
      return base.replace('<div class="dashboard-grid">', `${renderSubjectPerformance(this)}<div class="dashboard-grid">`);
    };

    proto.renderCalendario = function () {
      return `${originalCalendario.call(this)}${renderAgendaPanel(this)}`;
    };

    proto.renderMentorIA = function () {
      const base = originalMentor.call(this);
      const priority = window.aiAssistant?.generateDailyPlan?.()?.[0];
      const highlight = priority ? `<div class="mentor-highlight-box"><h3>Prioridade do dia</h3><p><strong>${this.esc(priority.materia)}</strong> — ${this.esc(priority.tipo)} por ${this.esc(priority.duracao)} min. Motivo principal: ${this.esc(priority.motivo || 'atenção acadêmica atual')}.</p></div>` : '';
      return base.replace('<div class="mentor-ia-container">', `${highlight}<div class="mentor-ia-container">`);
    };

    proto.renderModoFoco = function () {
      const base = originalFoco.call(this);
      if (base.includes('focus-cycle-card')) return base;
      const card = `
        <div class="focus-cycle-card">
          <div class="focus-cycle-top">
            <div class="focus-phase-badge" id="focus-phase-label"><i class="fas fa-brain"></i> Foco</div>
            <div id="focus-cycle-summary">Blocos de foco concluídos hoje: 0.</div>
          </div>
          <div class="focus-next-action" id="focus-next-action"><button class="btn-primary" id="focus-next-button"><i class="fas fa-forward"></i> Iniciar descanso</button></div>
          <div class="focus-hints">
            <button class="btn-secondary" id="focus-long-start"><i class="fas fa-hourglass-half"></i> Foco 50 min</button>
            <button class="btn-secondary" id="focus-heavy-start"><i class="fas fa-dumbbell"></i> Foco 90 min</button>
          </div>
        </div>`;
      return `${base}${card}`;
    };

    proto.renderGradeSemanalComHoras = function (containerId) {
      if (window.scheduleManager) {
        window.scheduleManager.loadAulas?.();
        window.scheduleManager.ALTURA_POR_HORA = calculateCompactHourHeight(window.scheduleManager);
      }
      const result = originalGradeSemanal.call(this, containerId);
      const container = document.getElementById(containerId);
      const card = container?.closest('.schedule-container');
      if (container) container.classList.add('compact-weekly-schedule');
      if (card) card.classList.add('compact-schedule-card');
      return result;
    };

    proto.renderConfiguracoes = function (aba) {
      const html = originalConfig.call(this, aba);
      // Essa dica só faz sentido dentro da aba "Geral" — no menu de categorias
      // e nas outras abas ela não deve aparecer.
      if (aba !== 'geral') return html;
      return `${html}<div class="card"><div class="card-header"><h3><i class="fas fa-bullseye"></i> Metas rápidas</h3></div><div class="card-body"><p>Você também pode editar suas metas diretamente no Dashboard, na seção de metas semanais e mensais.</p></div></div>`;
    };

    proto[PATCH_FLAG] = true;
  }

  function patchLoadView() {
    if (!window.StudyLifeControl || window.StudyLifeControl.prototype.__loadViewEnhanced) return;
    const proto = window.StudyLifeControl.prototype;
    const originalLoadView = proto.loadView;
    proto.loadView = function (view) {
      if (view === 'ajuda') {
        if (!this.viewRenderer) this.viewRenderer = new ViewRenderer(this);
        this.currentView = view;
        document.body.dataset.view = view;
        const container = el('view-container');
        if (!container) return;
        container.innerHTML = window.renderHelpPage ? window.renderHelpPage() : '<div class="card"><div class="card-body">Ajuda indisponível.</div></div>';
        window.aiAssistant?.updateContext(this.data);
        setTimeout(() => window.bindHelpActions?.(container), 30);
        return;
      }
      if (view === 'gamificacao') {
        if (!this.viewRenderer) this.viewRenderer = new ViewRenderer(this);
        this.currentView = view;
        document.body.dataset.view = view;
        const container = el('view-container');
        if (!container) return;
        container.innerHTML = renderGamificationPage(this.viewRenderer);
        window.aiAssistant?.updateContext(this.data);
        return;
      }
      if (view === 'situacao-academica') {
        if (!this.viewRenderer) this.viewRenderer = new ViewRenderer(this);
        this.currentView = view;
        document.body.dataset.view = view;
        const container = el('view-container');
        if (!container) return;
        container.innerHTML = renderSituationPage(this.viewRenderer);
        window.aiAssistant?.updateContext(this.data);
        setTimeout(() => bindSituationPageActions(this), 30);
        return;
      }
      if (view === 'diario') {
        if (!this.viewRenderer) this.viewRenderer = new ViewRenderer(this);
        this.currentView = view;
        document.body.dataset.view = view;
        const container = el('view-container');
        if (!container) return;
        container.innerHTML = window.diaryView ? window.diaryView.renderPage(this) : '<div class="card"><div class="card-body">Diário indisponível.</div></div>';
        window.aiAssistant?.updateContext(this.data);
        setTimeout(() => window.diaryView?.bindPageEvents(this), 30);
        return;
      }
      const result = originalLoadView.call(this, view);
      setTimeout(() => {
        if (view === 'foco') bindFocusButtons(this);
        if (view === 'grade-horaria' && window.scheduleManager) {
          window.scheduleManager.ALTURA_POR_HORA = calculateCompactHourHeight(window.scheduleManager);
          const select = document.querySelector('[id^="grade-view-mode-"]');
          if (select && select.value !== 'semana') { select.value = 'semana'; select.dispatchEvent(new Event('change')); }
        }
        bindDashboardEvents(this);
        bindCalendarFilters();
        syncFloatingAIVisibility();
        setupNotificationCenter(this);
        window.bindHelpActions?.(document);
        window.SiteTutorial?.maybeStart?.();
      }, 80);
      return result;
    };
    proto.__loadViewEnhanced = true;
  }

  function patchSubmitGuards() {
    if (!window.StudyLifeControl || window.StudyLifeControl.prototype.__submitGuardPatched) return;
    const forms = ['handleSessaoSubmit','handleTarefaSubmit','handleProvaSubmit','handleAulaSubmit','handleTopicoSubmit','handleNotaSubmit','handleMaterialSubmit'];
    const proto = window.StudyLifeControl.prototype;
    forms.forEach(name => {
      const original = proto[name];
      if (typeof original !== 'function') return;
      proto[name] = async function (e) {
        const form = e?.target?.closest?.('form') || e?.target;
        if (form?.dataset?.submitting === '1') return;
        if (form?.dataset) form.dataset.submitting = '1';
        try { return await original.call(this, e); }
        finally { setTimeout(() => { if (form?.dataset) form.dataset.submitting = '0'; }, 400); }
      };
    });
    proto.__submitGuardPatched = true;
  }

  function bindDashboardEvents(app) {
    const saveGoals = el('save-goals-btn');
    if (saveGoals && !saveGoals.dataset.bound) {
      saveGoals.dataset.bound = '1';
      saveGoals.addEventListener('click', async () => {
        await app.saveStudyGoals({
          weeklyHours: Number(el('goal-weekly-hours')?.value || 0),
          monthlyHours: Number(el('goal-monthly-hours')?.value || 0),
          weeklyPomodoros: Number(el('goal-weekly-pomodoros')?.value || 0),
          weeklyTasks: Number(el('goal-weekly-tasks')?.value || 0),
          weeklyReviews: Number(el('goal-weekly-reviews')?.value || 0)
        });
        showToast('Metas salvas com sucesso!', 'success');
        app.loadView(app.currentView);
      });
    }
    const saveDailyGoal = el('save-daily-goal-btn');
    if (saveDailyGoal && !saveDailyGoal.dataset.bound) {
      saveDailyGoal.dataset.bound = '1';
      saveDailyGoal.addEventListener('click', async () => {
        const value = Number(el('daily-goal-input')?.value || 0);
        await app.saveDailyGoal?.(value);
        showToast('Meta diária atualizada!', 'success');
        app.loadView(app.currentView);
      });
    }
  }

  function bindCalendarFilters() {
    document.querySelectorAll('.calendar-filter-btn').forEach(btn => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        document.querySelectorAll('.calendar-filter-btn').forEach(item => item.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('[data-event-filter]').forEach(item => {
          item.style.display = filter === 'todos' || item.dataset.eventFilter === filter ? 'flex' : 'none';
        });
      });
    });
  }


  function updateSidebarLevelRing(app) {
    const info = el('user-info');
    const avatar = el('user-avatar');
    if (!info || !avatar) return;
    let wrap = info.querySelector('.level-avatar-wrap');
    let levelBadge = info.querySelector('.level-badge-mini');
    let levelAvatar = info.querySelector('.level-avatar');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'level-avatar-wrap';
      levelAvatar = document.createElement('div');
      levelAvatar.className = 'level-avatar';
      avatar.parentNode.insertBefore(wrap, avatar);
      levelAvatar.appendChild(avatar);
      wrap.appendChild(levelAvatar);
      levelBadge = document.createElement('div');
      levelBadge.className = 'level-badge-mini';
      wrap.appendChild(levelBadge);
    }
    const game = app?.getGamificationSnapshot?.();
    const progress = Math.max(0, Math.min(100, Number(game?.progress) || 0));
    wrap.style.background = `conic-gradient(#22c55e 0deg, #2563eb ${Math.round(progress * 3.6)}deg, rgba(30,41,59,.95) ${Math.round(progress * 3.6)}deg 360deg)`;
    if (levelBadge) levelBadge.textContent = String(game?.level || 1);
    wrap.title = `Nível ${game?.level || 1} • ${game?.xp || 0} XP`;
  }

  function ensureNotificationPopover() {
    const badge = el('notification-badge');
    if (!badge) return null;
    badge.style.position = 'relative';
    let pop = el('notification-popover');
    if (!pop) {
      pop = document.createElement('div');
      pop.id = 'notification-popover';
      pop.className = 'notification-popover';
      pop.innerHTML = `
        <div class="notification-popover-head">
          <div><strong>Notificações</strong><div class="text-secondary">Alertas rápidos do teu semestre</div></div>
          <div class="notification-popover-actions">
            <button class="btn-secondary" type="button" id="mark-all-notifications-read">Marcar como visto</button>
            <button class="btn-secondary" type="button" id="notification-close-btn">Fechar</button>
          </div>
        </div>
        <div class="notification-popover-list" id="notification-popover-list"></div>`;
      // Portaliza o popover no body. Isso evita que `backdrop-filter`/overflow
      // do cabeçalho móvel crie um containing block que corte o painel.
      document.body.appendChild(pop);
    }
    return pop;
  }

  // O conteúdo da lista (#notification-popover-list) e a contagem do badge
  // são preenchidos por launch-polish.js (buildNotifications/renderNotifications
  // — única fonte de verdade, com marcação de lido). Aqui só montamos a casca
  // do popover (cabeçalho + botão fechar) pra evitar dois painéis competindo.

  function positionNotificationPopover(pop) {
    if (!pop) return;
    const badge = el('notification-badge');
    if (!badge) return;
    const r = badge.getBoundingClientRect();
    pop.style.setProperty('--slc-notif-top', `${Math.round(r.bottom + 10)}px`);
    pop.style.setProperty('--slc-notif-right', `${Math.max(12, Math.round(window.innerWidth - r.right))}px`);
  }

  function openNotificationPopover() {
    const pop = ensureNotificationPopover();
    if (!pop) return;
    positionNotificationPopover(pop);
    pop.classList.add('open');
  }

  function closeNotificationPopover() {
    el('notification-popover')?.classList.remove('open');
  }

  function ensureHelpNavItem() {
    const nav = el('sidebar-nav');
    if (!nav || nav.querySelector('[data-view="ajuda"]')) return;
    const item = document.createElement('a');
    item.href = '#';
    item.className = 'nav-item';
    item.dataset.view = 'ajuda';
    item.innerHTML = '<i class="fas fa-question-circle"></i><span>Ajuda</span>';
    item.addEventListener('click', e => {
      e.preventDefault();
      window.app?.loadView?.('ajuda');
      document.querySelectorAll('.nav-item').forEach(navItem => navItem.classList.remove('active'));
      item.classList.add('active');
      const pageTitle = el('page-title');
      if (pageTitle) pageTitle.textContent = 'Ajuda';
    });
    nav.appendChild(item);
  }

  function ensureGamificationNavItem() {
    const nav = el('sidebar-nav');
    if (!nav || nav.querySelector('[data-view="gamificacao"]')) return;
    const item = document.createElement('a');
    item.href = '#';
    item.className = 'nav-item';
    item.dataset.view = 'gamificacao';
    item.innerHTML = '<i class="fas fa-trophy"></i><span>Gamificação</span>';
    item.addEventListener('click', e => {
      e.preventDefault();
      window.app?.loadView?.('gamificacao');
      document.querySelectorAll('.nav-item').forEach(navItem => navItem.classList.remove('active'));
      item.classList.add('active');
      const pageTitle = el('page-title');
      if (pageTitle) pageTitle.textContent = 'Gamificação';
    });
    // Insere no grupo Acadêmico se existir, senão appenda ao nav
    const academicGroup = el('group-academico');
    if (academicGroup) {
      const situacao = academicGroup.querySelector('[data-view="situacao-academica"]');
      if (situacao) academicGroup.insertBefore(item, situacao);
      else academicGroup.appendChild(item);
    } else {
      nav.appendChild(item);
    }
  }

  function trackXPSourceClicks() {
    if (document.body?.dataset?.xpTrackBound) return;
    if (document.body?.dataset) document.body.dataset.xpTrackBound = '1';
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-concluir-sessao,.btn-concluir-tarefa,[data-action="concluir-revisao"],.btn-complete-review,#focus-next-button');
      if (btn) window.__slcLastXpSourceEl = btn;
    }, true);
  }

  function setupNotificationCenter(app) {
    const badge = el('notification-badge');
    const pop = ensureNotificationPopover();
    if (!badge || !pop || !app) return;
    updateSidebarLevelRing(app);
    if (!badge.dataset.bound) {
      badge.dataset.bound = '1';
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        if (pop.classList.contains('open')) closeNotificationPopover();
        else openNotificationPopover();
      });
      window.addEventListener('resize', () => {
        if (pop.classList.contains('open')) positionNotificationPopover(pop);
      }, { passive: true });
      document.addEventListener('click', (e) => {
        if (!pop.contains(e.target) && !badge.contains(e.target)) closeNotificationPopover();
      });
      el('notification-close-btn')?.addEventListener('click', closeNotificationPopover);
    }
    // Auto-open removido: usuário abre manualmente clicando no sino
  }


  function patchGamificationRuntime() {
    if (window.StudyLifeControl && !window.StudyLifeControl.prototype.__xpRuntimePatched) {
      const proto = window.StudyLifeControl.prototype;
      const originalConcluirSessao = proto.concluirSessao;
      proto.concluirSessao = async function (id) {
        const session = (this.data.sessions || []).find(s => s.id === id);
        const alreadyDone = !!(session?.concluida || session?.status === 'concluida');
        const result = await originalConcluirSessao.call(this, id);
        if (session && !alreadyDone && (session.concluida || session.status === 'concluida')) {
          const xp = Math.max(12, Math.round((Number(session.duracao) || 25) * 0.8));
          await this.awardXP({ ref: `session:${id}`, xp, type: 'session', label: `Sessão concluída: ${session.materia || 'Estudo'}`, meta: session.tipo || '' });
          setTimeout(() => { this.loadView?.(this.currentView); updateSidebarLevelRing(this); }, 80);
        }
        return result;
      };

      const originalConcluirTarefa = proto.concluirTarefa;
      proto.concluirTarefa = async function (id) {
        const task = (this.data.tasks || []).find(t => t.id === id);
        const alreadyDone = !!task?.concluida;
        const result = await originalConcluirTarefa.call(this, id);
        if (task && !alreadyDone && task.concluida) {
          await this.awardXP({ ref: `task:${id}`, xp: 28, type: 'task', label: `Tarefa concluída: ${task.titulo || 'Tarefa'}`, meta: task.materia || '' });
          setTimeout(() => { this.loadView?.(this.currentView); updateSidebarLevelRing(this); }, 80);
        }
        return result;
      };

      const originalTimerComplete = proto.timerComplete;
      proto.timerComplete = async function () {
        const beforeIds = new Set((this.data.sessions || []).map(s => s.id));
        const result = await originalTimerComplete.call(this);
        const session = (this.data.sessions || []).find(s => !beforeIds.has(s.id) && (s.concluida || s.status === 'concluida') && String(s.tipo || '').toLowerCase() === 'foco');
        if (session) {
          const xp = Math.max(18, Math.round((Number(session.duracao) || 25) * 0.9));
          await this.awardXP({ ref: `session:${session.id}`, xp, type: 'focus', label: `Sessão foco concluída`, meta: `${session.duracao || 25} min` });
          setTimeout(() => { this.loadView?.(this.currentView); updateSidebarLevelRing(this); }, 80);
        }
        return result;
      };
      proto.__xpRuntimePatched = true;
    }

    if (window.reviewSystem && !window.reviewSystem.__xpRuntimePatched) {
      const originalConcluirRevisao = window.reviewSystem.concluirRevisao.bind(window.reviewSystem);
      window.reviewSystem.concluirRevisao = async function (revisaoId) {
        const review = (this.revisoes || []).find(r => r.id === revisaoId);
        const alreadyDone = !!review?.concluida;
        const result = await originalConcluirRevisao(revisaoId);
        const app = window.app;
        const latest = (app?.data?.reviews || []).find(r => r.id === revisaoId) || review;
        if (result && app && latest && !alreadyDone && latest.concluida) {
          await app.awardXP({ ref: `review:${revisaoId}`, xp: 18, type: 'review', label: `Revisão concluída: ${latest.topico || latest.materia || 'Revisão'}`, meta: latest.materia || '' });
          setTimeout(() => { app.loadView?.(app.currentView); updateSidebarLevelRing(app); }, 80);
        }
        return result;
      };
      window.reviewSystem.__xpRuntimePatched = true;
    }
  }

  function install() {
    injectStyles();
    patchDbService();
    patchSubmitGuards();
    patchFocusTimer();
    patchLaunchMethods();
    patchGamificationRuntime();
    patchViewRenderer();
    patchLoadView();
    if (window.app) {
      ensureGamificationNavItem();
    ensureHelpNavItem();
      trackXPSourceClicks();
      ensureLaunchData(window.app);
      ensureFocusState(window.app);
      bindDashboardEvents(window.app);
      bindCalendarFilters();
      // bindFloatingAI removido: a bolha "Mentor IA" flutuante era o mesmo
      // recurso que já existe como item fixo na sidebar (desktop) e como aba
      // "IA" na barra inferior (mobile) — dois botões pra abrir a mesma
      // coisa. Ficou só o item de navegação.
      window.app.syncGamificationAchievements?.().catch?.(()=>{});
      window.app.syncGamificationAchievements?.().catch?.(()=>{});
      setupNotificationCenter(window.app);
      updateSidebarLevelRing(window.app);
      if (window.app.currentView === 'foco') bindFocusButtons(window.app);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    window.app = new StudyLifeControl();
    el('whats-now-btn')?.addEventListener('click', () => window.app?.whatsNow?.());
    el('daily-log-btn')?.addEventListener('click', () => window.diaryView?.openModal());
    el('setup-form')?.addEventListener('submit', e => { e.preventDefault(); window.app?.handleSetupSubmit?.(e); });
    el('add-materia')?.addEventListener('click', () => window.app?.addMateriaField?.());
    el('add-aula')?.addEventListener('click', () => window.app?.addAulaField?.());
    install();
    ensureGamificationNavItem();
    ensureHelpNavItem();
    trackXPSourceClicks();
    syncFloatingAIVisibility();
    const observer = new MutationObserver(() => syncFloatingAIVisibility());
    ['login-screen','setup-screen','main-dashboard'].forEach(id => { const node = el(id); if (node) observer.observe(node, { attributes: true, attributeFilter: ['style','class'] }); });
  });

  document.addEventListener('app-ready', () => {
    install();
    if (window.app) {
      ensureGamificationNavItem();
    ensureHelpNavItem();
      trackXPSourceClicks();
      ensureFocusState(window.app);
      setTimeout(() => {
        if (window.app.currentView === 'grade-horaria' && window.scheduleManager) {
          window.scheduleManager.ALTURA_POR_HORA = calculateCompactHourHeight(window.scheduleManager);
        }
      }, 100);
      window.app.syncGamificationAchievements?.().catch?.(()=>{});
      setupNotificationCenter(window.app);
      updateSidebarLevelRing(window.app);
      syncFloatingAIVisibility();
    }
  });

  window.addEventListener('resize', () => {
    if (window.scheduleManager && window.app?.currentView === 'grade-horaria') {
      window.scheduleManager.ALTURA_POR_HORA = calculateCompactHourHeight(window.scheduleManager);
      const current = document.querySelector('[id^="schedule-vertical-container-"]');
      if (current) {
        if (window.scheduleManager.viewMode === 'week') {
          window.scheduleManager.renderGradeSemanalGrid(current.id);
        } else {
          window.scheduleManager.renderGradeDia(window.scheduleManager.selectedDay, current.id);
        }
      }
    }
  });
})();
