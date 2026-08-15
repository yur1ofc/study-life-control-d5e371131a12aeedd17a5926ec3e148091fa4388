/**
 * launch-ready.js
 * Resolve tudo que faltava antes do lançamento:
 *  1. Tela de Ajuda (view 'ajuda')
 *  2. Tela de Situação Acadêmica (view 'situacao-academica')
 *  3. Modal de boas-vindas pós-setup
 *  4. Empty states do dashboard para usuário novo
 */
(function () {
  'use strict';
  const esc = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  /* ── Estilos ────────────────────────────────────────────────── */
  function injectStyles() {
    if (document.getElementById('lr-styles')) return;
    const s = document.createElement('style');
    s.id = 'lr-styles';
    s.textContent = `
#lr-welcome-modal{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)}
.lr-welcome-card{background:var(--bg-secondary);border:1.5px solid var(--border);border-radius:var(--radius-lg);padding:40px 32px;max-width:480px;width:100%;text-align:center;box-shadow:var(--card-shadow);animation:lr-pop .3s cubic-bezier(.34,1.56,.64,1)}
@keyframes lr-pop{from{transform:scale(.85);opacity:0}to{transform:scale(1);opacity:1}}
.lr-welcome-emoji{font-size:3rem;margin-bottom:16px;display:block}
.lr-welcome-card h2{font-size:1.4rem;font-weight:800;color:var(--text-primary);margin-bottom:8px}
.lr-welcome-card p{color:var(--text-secondary);font-size:.92rem;line-height:1.6;margin-bottom:22px}
.lr-welcome-steps{display:flex;flex-direction:column;gap:10px;text-align:left;margin-bottom:24px}
.lr-welcome-step{display:flex;align-items:center;gap:12px;background:var(--bg-tertiary);border-radius:var(--radius-sm);padding:12px 14px;cursor:pointer;border:1.5px solid transparent;transition:border-color .2s}
.lr-welcome-step:hover{border-color:var(--accent-primary)}
.lr-welcome-step-icon{font-size:1.3rem;width:36px;height:36px;background:var(--bg-secondary);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.lr-welcome-step-text strong{display:block;color:var(--text-primary);font-size:.88rem}
.lr-welcome-step-text span{color:var(--text-secondary);font-size:.8rem}
.lr-welcome-close{width:100%;padding:13px;background:var(--accent-primary);border:none;border-radius:var(--radius-sm);color:#fff;font-weight:800;font-size:1rem;cursor:pointer;transition:opacity .2s}
.lr-welcome-close:hover{opacity:.85}
.lr-help-hero{background:linear-gradient(135deg,var(--bg-secondary) 0%,#1a2540 100%);border:1px solid var(--border);border-radius:var(--radius-lg);padding:28px;margin-bottom:24px;display:flex;align-items:center;gap:20px}
.lr-help-hero-icon{font-size:2.8rem}
.lr-help-hero h2{font-size:1.3rem;font-weight:800;color:var(--text-primary);margin-bottom:4px}
.lr-help-hero p{color:var(--text-secondary);font-size:.9rem}
.lr-section-title{font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--accent-primary);margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border)}
.lr-shortcut-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-bottom:28px}
.lr-shortcut-card{background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px;cursor:pointer;transition:border-color .2s}
.lr-shortcut-card:hover{border-color:var(--accent-primary)}
.lr-shortcut-card .icon{font-size:1.3rem;margin-bottom:6px;display:block}
.lr-shortcut-card strong{display:block;color:var(--text-primary);font-size:.88rem;margin-bottom:2px}
.lr-shortcut-card span{color:var(--text-secondary);font-size:.78rem}
.lr-ia-prompts{display:flex;flex-direction:column;gap:8px;margin-bottom:28px}
.lr-ia-prompt{background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 14px;cursor:pointer;font-size:.9rem;color:var(--text-secondary);transition:all .2s;display:flex;align-items:center;gap:10px}
.lr-ia-prompt:hover{border-color:var(--accent-secondary);color:var(--text-primary)}
.lr-ia-prompt::before{content:'💬';flex-shrink:0}
.lr-faq-item{background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:8px;overflow:hidden}
.lr-faq-q{padding:14px 16px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;font-size:.92rem;font-weight:600;color:var(--text-primary);user-select:none;transition:background .2s}
.lr-faq-q:hover{background:var(--bg-tertiary)}
.lr-faq-arrow{color:var(--text-tertiary);transition:transform .2s;font-size:.82rem}
.lr-faq-item.open .lr-faq-arrow{transform:rotate(180deg)}
.lr-faq-a{display:none;padding:0 16px 14px;color:var(--text-secondary);font-size:.88rem;line-height:1.7;border-top:1px solid var(--border)}
.lr-faq-item.open .lr-faq-a{display:block}
.lr-restart-btn{display:inline-flex;align-items:center;gap:8px;padding:10px 18px;background:var(--bg-tertiary);border:1.5px solid var(--border);border-radius:var(--radius-sm);color:var(--text-secondary);font-size:.88rem;font-weight:600;cursor:pointer;transition:all .2s;text-decoration:none}
.lr-restart-btn:hover{border-color:var(--accent-primary);color:var(--text-primary)}
.lr-sa-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px;margin-bottom:24px}
.lr-sa-card{background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-md);padding:18px}
.lr-sa-card-header{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.lr-sa-card-icon{font-size:1.2rem}
.lr-sa-card-title{font-weight:700;color:var(--text-primary);font-size:.92rem}
.lr-sa-stat{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border)}
.lr-sa-stat:last-child{border-bottom:none}
.lr-sa-stat-label{color:var(--text-secondary);font-size:.85rem}
.lr-sa-stat-val{font-weight:700;color:var(--text-primary);font-size:.9rem}
.lr-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:99px;font-size:.76rem;font-weight:700}
.lr-badge.good{background:rgba(16,185,129,.15);color:var(--accent-success)}
.lr-badge.warn{background:rgba(245,158,11,.15);color:var(--accent-warning)}
.lr-badge.bad{background:rgba(239,68,68,.15);color:var(--accent-danger)}
.lr-risk-bar{height:6px;background:var(--border);border-radius:99px;margin:8px 0}
.lr-risk-fill{height:100%;border-radius:99px;transition:width .5s}
.lr-risk-low .lr-risk-fill{background:var(--accent-success)}
.lr-risk-med .lr-risk-fill{background:var(--accent-warning)}
.lr-risk-high .lr-risk-fill{background:var(--accent-danger)}
.lr-empty-hero{text-align:center;padding:48px 24px;background:var(--bg-secondary);border:1.5px dashed var(--border);border-radius:var(--radius-lg);margin-bottom:20px}
.lr-empty-hero .lr-ei{font-size:3rem;margin-bottom:14px;display:block}
.lr-empty-hero h3{font-size:1.2rem;font-weight:800;color:var(--text-primary);margin-bottom:8px}
.lr-empty-hero p{color:var(--text-secondary);font-size:.9rem;margin-bottom:22px;max-width:340px;margin-left:auto;margin-right:auto}
.lr-empty-actions{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.lr-action{display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border-radius:var(--radius-sm);font-size:.88rem;font-weight:700;cursor:pointer;transition:opacity .2s;border:none;text-decoration:none}
.lr-action.primary{background:var(--accent-primary);color:#fff}
.lr-action.secondary{background:var(--bg-tertiary);border:1.5px solid var(--border);color:var(--text-primary)}
.lr-action:hover{opacity:.85}
`;
    document.head.appendChild(s);
  }

  /* ── Navegação ───────────────────────────────────────────────── */
  function navigateTo(view) {
    if (window.app?.loadView) {
      window.app.loadView(view);
      document.querySelectorAll('.nav-item').forEach(n =>
        n.classList.toggle('active', n.dataset.view === view));
    }
  }
  function attachGoto(container) {
    container.querySelectorAll('[data-goto]').forEach(el =>
      el.addEventListener('click', () => navigateTo(el.dataset.goto)));
  }

  /* ── Tela de Ajuda ──────────────────────────────────────────── */
  function renderHelp() {
    const faqs = [
      { q: 'Como adiciono minhas matérias?', a: 'Vá em <strong>Matérias</strong> no menu lateral → clique em "+ Adicionar Matéria" → preencha nome, dificuldade, peso e nota desejada. Cada matéria aparece nas sessões, tarefas e no Mentor IA.' },
      { q: 'Como importo minha grade curricular?', a: 'Vá em <strong>Grade Curricular</strong> → clique em "Importar Grade". Use o modo IA: copie o prompt, abra o ChatGPT ou Claude, envie com o PDF ou foto da grade da faculdade, cole o JSON gerado de volta no site.' },
      { q: 'Como registro uma sessão de estudo?', a: 'Vá em <strong>Sessões de Estudo</strong> → "+ Nova Sessão" → selecione matéria, data e duração. As sessões alimentam o Dashboard, o streak e o Mentor IA.' },
      { q: 'O que é o Modo Foco?', a: 'Um timer Pomodoro integrado. Vá em <strong>Modo Foco</strong>, selecione a matéria, defina o tempo e comece. Ao concluir, a sessão é registrada automaticamente.' },
      { q: 'O que é o Mapa de Aprendizado?', a: 'Mostra todos os tópicos das suas matérias com status de domínio (não iniciado, estudando, dominado). Atualize conforme revisa os conteúdos — isso melhora as sugestões do Mentor IA.' },
      { q: 'O Mentor IA usa alguma API paga?', a: 'Não! O Mentor IA é 100% local — ele usa seus dados cadastrados (matérias, sessões, provas, tarefas) para gerar respostas inteligentes sem custo nenhum para você.' },
      { q: 'Posso usar no celular?', a: 'Sim! É um PWA. No celular, acesse pelo navegador → toque em "Adicionar à tela inicial" para ter um ícone como app instalado, inclusive offline.' },
      { q: 'Meus dados ficam salvos onde?', a: 'No Firebase, vinculados à sua conta Google. Sincroniza automaticamente entre dispositivos com o mesmo login. Você pode exportar um backup em Configurações.' },
      { q: 'O site armazena minha senha?', a: 'Nunca. O login é via Google (OAuth) — o site não vê sua senha em nenhum momento.' },
      { q: 'Encontrei um bug. Como reporto?', a: 'O projeto é open-source no GitHub. Abra uma Issue descrevendo o problema — contribuições são bem-vindas!' },
    ];
    const shortcuts = [
      { icon:'📚', label:'Matérias', desc:'Adicione as disciplinas do semestre', view:'materias' },
      { icon:'⏱️', label:'Sessões', desc:'Registre horas de estudo', view:'sessoes' },
      { icon:'✅', label:'Tarefas', desc:'Organize pendências', view:'tarefas' },
      { icon:'📝', label:'Provas', desc:'Nunca esqueça uma prova', view:'provas' },
      { icon:'🎯', label:'Modo Foco', desc:'Timer Pomodoro integrado', view:'foco' },
      { icon:'🧠', label:'Mentor IA', desc:'Pergunte o que estudar', view:'mentor-ia' },
    ];
    const prompts = [
      'O que eu deveria estudar hoje?',
      'Como estou na matéria mais difícil?',
      'Tenho alguma prova ou tarefa atrasada?',
      'Monte um plano de estudo para essa semana',
      'Quais matérias estão com risco de reprovação?',
      'Resumo da minha semana acadêmica',
    ];
    return `
<div class="view-header"><h2><i class="fas fa-question-circle"></i> Central de Ajuda</h2></div>
<div class="lr-help-hero">
  <div class="lr-help-hero-icon">🎓</div>
  <div><h2>Como podemos ajudar?</h2><p>Tudo que você precisa para aproveitar ao máximo o Study Life Control.</p></div>
</div>
<div class="lr-section-title">⚡ Atalhos rápidos</div>
<div class="lr-shortcut-grid">
  ${shortcuts.map(s=>`<div class="lr-shortcut-card" data-goto="${esc(s.view)}"><span class="icon">${s.icon}</span><strong>${esc(s.label)}</strong><span>${esc(s.desc)}</span></div>`).join('')}
</div>
<div class="lr-section-title">🧠 Perguntas sugeridas para o Mentor IA</div>
<div class="lr-ia-prompts">
  ${prompts.map(p=>`<div class="lr-ia-prompt" data-ia-prompt="${esc(p)}">${esc(p)}</div>`).join('')}
</div>
<div class="lr-section-title">❓ Perguntas frequentes</div>
<div id="lr-faq-list">
  ${faqs.map((f,i)=>`
  <div class="lr-faq-item" id="lr-faq-${i}">
    <div class="lr-faq-q" data-faq="${i}">${esc(f.q)}<i class="fas fa-chevron-down lr-faq-arrow"></i></div>
    <div class="lr-faq-a">${f.a}</div>
  </div>`).join('')}
</div>
<div style="margin-top:24px;display:flex;gap:10px;flex-wrap:wrap;">
  <button class="lr-restart-btn" id="lr-restart-tutorial"><i class="fas fa-play-circle"></i> Reiniciar tutorial</button>
  <a class="lr-restart-btn" href="https://github.com/yur1ofc/study-life-control" target="_blank" rel="noopener"><i class="fab fa-github"></i> GitHub</a>
</div>`;
  }

  function attachHelpEvents(c) {
    c.querySelectorAll('.lr-faq-q').forEach(btn =>
      btn.addEventListener('click', () => document.getElementById(`lr-faq-${btn.dataset.faq}`)?.classList.toggle('open')));
    c.querySelectorAll('.lr-ia-prompt').forEach(el =>
      el.addEventListener('click', () => {
        navigateTo('mentor-ia');
        setTimeout(() => {
          const inp = document.querySelector('#mentor-input,textarea[placeholder*="pergunt"],.mentor-input');
          if (inp) { inp.value = el.dataset.iaPrompt || el.textContent.trim(); inp.focus(); }
        }, 400);
      }));
    c.querySelector('#lr-restart-tutorial')?.addEventListener('click', () =>
      window.startTutorial?.() || window.tutorial?.start?.());
    attachGoto(c);
  }

  /* ── Situação Acadêmica ──────────────────────────────────────── */
  function renderSituacaoAcademica() {
    const app = window.app;
    if (!app) return '<p>Carregando...</p>';
    const subjects = app.data?.subjects || [];
    const sessions = app.data?.sessions || [];
    const tasks    = app.data?.tasks    || [];
    const exams    = app.data?.exams    || [];
    const now = new Date();

    if (!subjects.length) return `
<div class="view-header"><h2><i class="fas fa-heartbeat"></i> Situação Acadêmica</h2></div>
<div class="lr-empty-hero"><span class="lr-ei">📊</span><h3>Nenhuma matéria cadastrada ainda</h3>
<p>Adicione suas matérias do semestre para ver sua situação acadêmica completa.</p>
<div class="lr-empty-actions"><button class="lr-action primary" data-goto="materias"><i class="fas fa-plus"></i> Adicionar Matérias</button></div></div>`;

    const horasPorMateria = {};
    subjects.forEach(s => { horasPorMateria[s.nome] = 0; });
    sessions.filter(s => s.concluida).forEach(s => {
      if (s.materia in horasPorMateria) horasPorMateria[s.materia] += (parseInt(s.duracao)||0)/60;
    });
    const atrPorMateria = {};
    tasks.filter(t => !t.concluida && t.dataLimite && new Date(t.dataLimite+'T23:59') < now).forEach(t => {
      atrPorMateria[t.materia] = (atrPorMateria[t.materia]||0)+1;
    });
    const provasPorMateria = {};
    exams.filter(e => !e.concluida && new Date(e.data) >= now).forEach(e => {
      provasPorMateria[e.materia] = (provasPorMateria[e.materia]||0)+1;
    });

    function risk(s) {
      const h = horasPorMateria[s.nome]||0, a = atrPorMateria[s.nome]||0;
      return a >= 2 || h < 1 ? 'bad' : a >= 1 || h < 5 ? 'warn' : 'good';
    }
    const rLabel = r => r==='bad'?'⚠️ Risco':r==='warn'?'👀 Atenção':'✅ OK';
    const totalH = Object.values(horasPorMateria).reduce((a,b)=>a+b,0);
    const atrasadas = tasks.filter(t=>!t.concluida && t.dataLimite && new Date(t.dataLimite+'T23:59')<now).length;
    const proxProvas = exams.filter(e=>!e.concluida && new Date(e.data)>=now).slice(0,3);

    return `
<div class="view-header"><h2><i class="fas fa-heartbeat"></i> Situação Acadêmica</h2></div>
<div class="lr-sa-grid">
  <div class="lr-sa-card">
    <div class="lr-sa-card-header"><span class="lr-sa-card-icon">📚</span><span class="lr-sa-card-title">Matérias</span></div>
    <div class="lr-sa-stat"><span class="lr-sa-stat-label">Cursando</span><span class="lr-sa-stat-val">${subjects.length}</span></div>
    <div class="lr-sa-stat"><span class="lr-sa-stat-label">Em risco</span><span class="lr-sa-stat-val" style="color:var(--accent-danger)">${subjects.filter(s=>risk(s)==='bad').length}</span></div>
    <div class="lr-sa-stat"><span class="lr-sa-stat-label">Em atenção</span><span class="lr-sa-stat-val" style="color:var(--accent-warning)">${subjects.filter(s=>risk(s)==='warn').length}</span></div>
    <div class="lr-sa-stat"><span class="lr-sa-stat-label">Em dia</span><span class="lr-sa-stat-val" style="color:var(--accent-success)">${subjects.filter(s=>risk(s)==='good').length}</span></div>
  </div>
  <div class="lr-sa-card">
    <div class="lr-sa-card-header"><span class="lr-sa-card-icon">⏱️</span><span class="lr-sa-card-title">Estudo</span></div>
    <div class="lr-sa-stat"><span class="lr-sa-stat-label">Total de horas</span><span class="lr-sa-stat-val">${totalH.toFixed(1)}h</span></div>
    <div class="lr-sa-stat"><span class="lr-sa-stat-label">Sessões concluídas</span><span class="lr-sa-stat-val">${sessions.filter(s=>s.concluida).length}</span></div>
    <div class="lr-sa-stat"><span class="lr-sa-stat-label">Média por matéria</span><span class="lr-sa-stat-val">${(totalH/subjects.length).toFixed(1)}h</span></div>
    <div class="lr-sa-stat"><span class="lr-sa-stat-label">Streak</span><span class="lr-sa-stat-val">${app.data?.user?.streak||0} dias 🔥</span></div>
  </div>
  <div class="lr-sa-card">
    <div class="lr-sa-card-header"><span class="lr-sa-card-icon">✅</span><span class="lr-sa-card-title">Tarefas & Provas</span></div>
    <div class="lr-sa-stat"><span class="lr-sa-stat-label">Tarefas pendentes</span><span class="lr-sa-stat-val">${tasks.filter(t=>!t.concluida).length}</span></div>
    <div class="lr-sa-stat"><span class="lr-sa-stat-label">Atrasadas</span><span class="lr-sa-stat-val" style="color:var(--accent-danger)">${atrasadas}</span></div>
    <div class="lr-sa-stat"><span class="lr-sa-stat-label">Tarefas concluídas</span><span class="lr-sa-stat-val" style="color:var(--accent-success)">${tasks.filter(t=>t.concluida).length}</span></div>
    <div class="lr-sa-stat"><span class="lr-sa-stat-label">Próximas provas</span><span class="lr-sa-stat-val">${exams.filter(e=>!e.concluida&&new Date(e.data)>=now).length}</span></div>
  </div>
</div>

<div class="lr-section-title">📋 Por matéria</div>
<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:24px;">
${subjects.map(s=>{
  const h=horasPorMateria[s.nome]||0, a=atrPorMateria[s.nome]||0, p=provasPorMateria[s.nome]||0;
  const r=risk(s), pct=Math.min(100,(h/Math.max(1,s.horasMeta||20))*100);
  return `<div class="lr-sa-card" style="padding:14px 16px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <strong style="color:var(--text-primary)">${esc(s.nome)}</strong>
      <span class="lr-badge ${r}">${rLabel(r)}</span>
    </div>
    <div class="lr-risk-bar lr-risk-${r==='bad'?'high':r==='warn'?'med':'low'}"><div class="lr-risk-fill" style="width:${pct.toFixed(0)}%"></div></div>
    <div style="display:flex;gap:14px;margin-top:6px;font-size:.8rem;color:var(--text-secondary);">
      <span>⏱️ ${h.toFixed(1)}h</span>
      ${a?`<span style="color:var(--accent-danger)">⚠️ ${a} atrasada${a>1?'s':''}</span>`:''}
      ${p?`<span style="color:var(--accent-warning)">📝 ${p} prova${p>1?'s':''}</span>`:''}
    </div>
  </div>`;
}).join('')}
</div>

${proxProvas.length?`
<div class="lr-section-title">📅 Próximas provas</div>
<div style="display:flex;flex-direction:column;gap:8px;">
${proxProvas.map(e=>{
  const dias=Math.ceil((new Date(e.data)-now)/86400000);
  return `<div class="lr-sa-card" style="padding:12px 16px;display:flex;align-items:center;justify-content:space-between;">
    <div><strong style="color:var(--text-primary);font-size:.9rem">${esc(e.materia)}</strong>${e.titulo?`<span style="color:var(--text-secondary);font-size:.8rem;display:block">${esc(e.titulo)}</span>`:''}</div>
    <span class="lr-badge ${dias<=3?'bad':dias<=7?'warn':'good'}">${dias===0?'Hoje':dias===1?'Amanhã':dias+' dias'}</span>
  </div>`;
}).join('')}
</div>`:''}`;
  }

  /* ── Empty state do Dashboard ───────────────────────────────── */
  function buildEmptyDashboard(nome) {
    return `
<div class="dashboard-header">
  <h2>Olá, ${esc(nome||'Estudante')}! 👋</h2>
  <p>${new Date().toLocaleDateString('pt-BR',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
</div>
<div class="lr-empty-hero">
  <span class="lr-ei">🚀</span>
  <h3>Tudo pronto! Agora é só começar</h3>
  <p>Seu painel vai ganhar vida conforme você adiciona matérias, sessões e tarefas.</p>
  <div class="lr-empty-actions">
    <button class="lr-action primary" data-goto="materias"><i class="fas fa-book"></i> Adicionar Matérias</button>
    <button class="lr-action secondary" data-goto="sessoes"><i class="fas fa-clock"></i> Registrar Sessão</button>
    <button class="lr-action secondary" data-goto="grade-curricular"><i class="fas fa-sitemap"></i> Importar Grade</button>
  </div>
</div>
<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px;">
${[
  {icon:'📚',title:'Matérias',desc:'Cadastre as disciplinas do semestre. O resto do sistema depende disso.',view:'materias',cta:'Adicionar'},
  {icon:'⏱️',title:'Sessões de Estudo',desc:'Registre cada hora que estudar. O Dashboard mostra seu progresso automaticamente.',view:'sessoes',cta:'Registrar'},
  {icon:'✅',title:'Tarefas',desc:'Organize trabalhos, listas e pendências por matéria e data limite.',view:'tarefas',cta:'Criar tarefa'},
  {icon:'📝',title:'Provas',desc:'Cadastre provas com antecedência e receba alertas automáticos.',view:'provas',cta:'Cadastrar'},
  {icon:'🧠',title:'Mentor IA',desc:'Pergunte o que estudar hoje, como você está em cada matéria ou peça um plano.',view:'mentor-ia',cta:'Perguntar'},
  {icon:'🎯',title:'Modo Foco',desc:'Timer Pomodoro integrado — registra a sessão automaticamente ao concluir.',view:'foco',cta:'Iniciar foco'},
].map(c=>`
<div class="card" style="cursor:pointer" data-goto="${esc(c.view)}">
  <div class="card-header"><h3>${c.icon} ${esc(c.title)}</h3></div>
  <div class="card-body">
    <p style="font-size:.86rem;color:var(--text-secondary);margin-bottom:12px">${esc(c.desc)}</p>
    <button class="lr-action primary" data-goto="${esc(c.view)}" style="font-size:.82rem;padding:8px 14px">${esc(c.cta)} →</button>
  </div>
</div>`).join('')}
</div>`;
  }

  /* ── Welcome Modal ──────────────────────────────────────────── */
  function showWelcomeModal(nome) {
    if (document.getElementById('lr-welcome-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'lr-welcome-modal';
    modal.innerHTML = `<div class="lr-welcome-card">
  <span class="lr-welcome-emoji">🎉</span>
  <h2>Bem-vindo(a), ${esc(nome||'Estudante')}!</h2>
  <p>Configuração concluída! Quanto mais você preencher, mais inteligente o sistema fica.</p>
  <div class="lr-welcome-steps">
    <div class="lr-welcome-step" data-goto="materias"><div class="lr-welcome-step-icon">📚</div><div class="lr-welcome-step-text"><strong>Adicionar matérias do semestre</strong><span>Base de tudo — Mentor IA e Dashboard dependem disso</span></div></div>
    <div class="lr-welcome-step" data-goto="grade-curricular"><div class="lr-welcome-step-icon">🗂️</div><div class="lr-welcome-step-text"><strong>Importar grade curricular</strong><span>Use PDF ou foto da faculdade + ChatGPT para importar tudo de uma vez</span></div></div>
    <div class="lr-welcome-step" data-goto="mentor-ia"><div class="lr-welcome-step-icon">🧠</div><div class="lr-welcome-step-text"><strong>Falar com o Mentor IA</strong><span>Pergunte "o que estudar hoje?" e veja como ele responde</span></div></div>
  </div>
  <button class="lr-welcome-close" id="lr-welcome-close-btn">Explorar o sistema →</button>
</div>`;
    document.body.appendChild(modal);
    document.getElementById('lr-welcome-close-btn')?.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    modal.querySelectorAll('[data-goto]').forEach(el =>
      el.addEventListener('click', () => { modal.remove(); navigateTo(el.dataset.goto); }));
  }

  /* ── Patch do App ───────────────────────────────────────────── */
  function patchApp(app) {
    if (app.__lrPatched) return;
    if (!app || typeof app.loadView !== 'function') return; // guard: app ainda não pronto
    app.__lrPatched = true;

    const _orig = app.loadView.bind(app);
    app.loadView = function (view, ...rest) {
      const container = document.getElementById('view-container');

      if (view === 'ajuda') {
        this.currentView = 'ajuda';
        if (container) { container.innerHTML = renderHelp(); attachHelpEvents(container); }
        document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === 'ajuda'));
        return;
      }
      if (view === 'situacao-academica') {
        this.currentView = 'situacao-academica';
        if (container) { container.innerHTML = renderSituacaoAcademica(); attachGoto(container); }
        document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === 'situacao-academica'));
        return;
      }

      _orig(view, ...rest);

      // Empty state para dashboard de usuário novo
      if (view === 'dashboard') {
        setTimeout(() => {
          const s = this.data?.subjects||[], se = this.data?.sessions||[];
          if (!s.length && !se.length && container) {
            container.innerHTML = buildEmptyDashboard(this.data?.user?.nome);
            attachGoto(container);
          }
        }, 60);
      }
    };

    // Patch pós-setup: mostrar welcome
    const _origPost = app.ensurePostSetupReady.bind(app);
    app.ensurePostSetupReady = async function (...args) {
      const isNew = !(this.data?.subjects?.length);
      await _origPost(...args);
      if (isNew) {
        setTimeout(() => showWelcomeModal(this.data?.user?.nome), 900);
        localStorage.setItem('slc_welcomed', '1');
      }
    };
  }

  /* ── Init ───────────────────────────────────────────────────── */
  function init() {
    injectStyles();
    if (window.app) {
      patchApp(window.app);
    } else {
      document.addEventListener('app-ready', () => { if (window.app) patchApp(window.app); });
      let t = 0;
      const p = setInterval(() => { if (window.app) { clearInterval(p); patchApp(window.app); } if (++t > 50) clearInterval(p); }, 200);
    }

    // Welcome para usuário que é novo mas já tem conta (recarregou)
    document.addEventListener('app-ready', () => {
      const app = window.app; if (!app) return;
      const isNew = !app.data?.subjects?.length && !app.data?.sessions?.length;
      if (isNew && !localStorage.getItem('slc_welcomed') && app.data?.user?.nome) {
        setTimeout(() => showWelcomeModal(app.data.user.nome), 1200);
        localStorage.setItem('slc_welcomed', '1');
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
