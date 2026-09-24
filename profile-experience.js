(function () {
  'use strict';

  const META = {
    faculdade: {
      label: 'Faculdade / Universidade',
      short: 'Faculdade',
      description: 'O SLCampus organiza semestre, disciplinas, provas, frequência, currículo, aprendizagem e rotina de estudo.',
      group: 'Acadêmico',
      labels: {
        materias: 'Matérias', grade_horaria: 'Grade Horária', grade_curricular: 'Grade Curricular', cursos_extras: 'Cursos Extras', situacao_academica: 'Situação Acadêmica', previsao_notas: 'Previsão de Notas', provas: 'Provas e Trabalhos', tarefas: 'Tarefas', mapa_aprendizado: 'Mapa de Aprendizado', estatisticas: 'Estatísticas', foco: 'Modo Foco'
      },
      hidden: []
    },
    concurso: {
      label: 'Concurso Público', short: 'Concurso',
      description: 'O sistema passa a tratar seu objetivo como uma preparação: edital, disciplinas, questões, simulados, revisão, ciclo de estudo e evolução.',
      group: 'Concurso',
      labels: {
        materias: 'Disciplinas do Edital', grade_horaria: 'Rotina de Estudo', grade_curricular: 'Edital e Conteúdos', cursos_extras: 'Complementos', situacao_academica: 'Situação da Preparação', previsao_notas: 'Metas e Desempenho', provas: 'Provas e Simulados', tarefas: 'Questões e Pendências', mapa_aprendizado: 'Conteúdos do Edital', estatisticas: 'Desempenho', foco: 'Ciclo de Estudos'
      },
      hidden: ['grade-curricular']
    },
    ensino_medio: {
      label: 'Escola', short: 'Escola',
      description: 'O sistema prioriza disciplinas, aulas, atividades, avaliações, frequência, notas e evolução escolar, sem exigir conceitos de semestre universitário.',
      group: 'Escola',
      labels: {
        materias: 'Disciplinas', grade_horaria: 'Horário de Aulas', grade_curricular: 'Currículo Escolar', cursos_extras: 'Atividades Extras', situacao_academica: 'Boletim e Frequência', previsao_notas: 'Projeção de Notas', provas: 'Avaliações', tarefas: 'Atividades e Tarefas', mapa_aprendizado: 'Conteúdos', estatisticas: 'Desempenho Escolar', foco: 'Sessão de Estudo'
      },
      hidden: ['grade-curricular']
    },
    geral: {
      label: 'Curso / Estudo Livre', short: 'Curso / Estudos',
      description: 'O sistema se organiza por objetivos, módulos, atividades, materiais, revisões e progresso, sem forçar uma estrutura de universidade ou escola.',
      group: 'Estudos',
      labels: {
        materias: 'Módulos e Disciplinas', grade_horaria: 'Rotina', grade_curricular: 'Estrutura do Curso', cursos_extras: 'Cursos e Recursos', situacao_academica: 'Progresso', previsao_notas: 'Metas', provas: 'Avaliações e Prazos', tarefas: 'Atividades', mapa_aprendizado: 'Mapa de Conteúdos', estatisticas: 'Progresso', foco: 'Sessão de Estudo'
      },
      hidden: ['grade-curricular','situacao-academica','previsao-notas']
    }
  };

  function profile() {
    const raw = window.app?.data?.user?.perfil || 'faculdade';
    return META[raw] ? raw : 'faculdade';
  }
  function getProfileMeta() { return META[profile()]; }
  function nav(view) { return document.querySelector(`.nav-item[data-view="${view}"]`); }
  function setNavLabel(view, label) {
    const item=nav(view); if(!item)return;
    const span=item.querySelector('span:not(.badge)'); if(span)span.textContent=label;
    item.setAttribute('aria-label',label);
    item.dataset.slcProfileLabel=label;
  }
  function injectStyle(){
    if(document.getElementById('slc-profile-experience-style'))return;
    const s=document.createElement('style');s.id='slc-profile-experience-style';s.textContent=`
      .slc-profile-context{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin:0 0 18px;padding:16px 18px;border:1px solid var(--border);border-radius:20px;background:linear-gradient(135deg,color-mix(in srgb,var(--accent-primary) 9%,var(--bg-secondary)),var(--bg-secondary));}
      .slc-profile-context .kicker{font-size:.7rem;font-weight:800;letter-spacing:.08em;color:var(--accent-primary);text-transform:uppercase}.slc-profile-context h3{margin:4px 0 4px;font-size:1rem}.slc-profile-context p{margin:0;color:var(--text-secondary);font-size:.84rem;line-height:1.5}.slc-profile-context-actions{display:flex;gap:8px;flex-wrap:wrap}.slc-profile-context-actions button{white-space:nowrap}
      body[data-slc-profile="concurso"] .slc-profile-context{border-color:color-mix(in srgb,var(--accent-secondary) 28%,var(--border))}
      body[data-slc-profile="ensino_medio"] .slc-profile-context{border-color:color-mix(in srgb,var(--accent-success) 24%,var(--border))}
      @media(max-width:640px){.slc-profile-context{flex-direction:column}.slc-profile-context-actions{width:100%}.slc-profile-context-actions button{flex:1}}
    `;document.head.appendChild(s);
  }
  function applyNav(){
    const meta=getProfileMeta();
    document.body.dataset.slcProfile=profile();
    const group=document.querySelector('.nav-group-header[data-group="academico"] span');
    if(group)group.innerHTML=`<i class="fas fa-${profile()==='concurso'?'clipboard-list':profile()==='ensino_medio'?'school':profile()==='geral'?'book-open':'graduation-cap'}"></i> ${meta.group}`;
    Object.entries(meta.labels).forEach(([view,label])=>setNavLabel(view.replace('_','-'),label));
    ['grade-curricular','situacao-academica','previsao-notas','cursos-extras'].forEach(v=>nav(v)?.classList.toggle('slc-profile-hidden',meta.hidden.includes(v)));
    const bottomStudy=document.querySelector('#slc-product-bottom-nav [data-v="estudar"] span');
    const bottomFocus=document.querySelector('#slc-product-bottom-nav [data-v="foco"] span');
    if(bottomStudy) bottomStudy.textContent=profile()==='concurso'?'Ciclo':profile()==='geral'?'Curso':'Estudar';
    if(bottomFocus) bottomFocus.textContent='Foco';
    document.querySelectorAll('.btn-finalizar-semestre-cta,#btn-finalizar-semestre').forEach(x=>x.classList.toggle('slc-profile-hidden',profile()!=='faculdade'));
    const curriculumButtons=document.querySelectorAll('#btn-novo-curriculum,#btn-importar-ufob');
    curriculumButtons.forEach(x=>x.classList.toggle('slc-profile-hidden',profile()!=='faculdade'));
  }
  function contextHtml(){
    const meta=getProfileMeta(), d=window.app?.data||{}, u=d.user||{};
    const tasks=(d.tasks||[]).filter(x=>!x.concluida&&!x.completed).length;
    const exams=(d.exams||[]).filter(x=>!x.concluida).length;
    const subjects=(d.subjects||[]).length;
    const sessions=(d.sessions||[]).filter(x=>x.concluida||x.status==='concluida').length;
    let actions=[];
    if(profile()==='faculdade') actions=[['situacao-academica','Situação acadêmica','Notas e frequência'],['grade-curricular','Currículo','Pré-requisitos e progresso'],['foco','Estudar agora','Começar uma sessão']];
    if(profile()==='concurso') actions=[['materias','Disciplinas do edital','Conteúdos e prioridades'],['provas','Simulados','Avaliações e prazos'],['foco','Ciclo de estudo','Executar o próximo bloco']];
    if(profile()==='ensino_medio') actions=[['tarefas','Atividades','Entregas e pendências'],['provas','Avaliações','Provas e trabalhos'],['situacao-academica','Boletim','Notas e frequência']];
    if(profile()==='geral') actions=[['materias','Módulos','Organizar o conteúdo'],['mapa-aprendizado','Revisões','Consolidar aprendizagem'],['biblioteca','Materiais','Abrir recursos']];
    actions=actions.filter(([view])=>document.querySelector(`.nav-item[data-view="${view}"]`) || ['foco','biblioteca'].includes(view));
    const summary=profile()==='faculdade'?`${subjects} matérias · ${tasks} pendências · ${exams} avaliações`:profile()==='concurso'?`${subjects} disciplinas · ${tasks} questões/pendências · ${exams} avaliações`:profile()==='ensino_medio'?`${subjects} disciplinas · ${tasks} atividades · ${exams} avaliações`: `${subjects} módulos/áreas · ${tasks} atividades · ${sessions} sessões registradas`;
    return `<div class="slc-profile-context" data-profile-context><div><div class="kicker">${meta.short}</div><h3>${escapeHtml(u.objetivo||u.curso||u.concurso||meta.label)}</h3><p>${meta.description}</p><p style="margin-top:6px;font-size:.75rem;">${summary}</p></div><div class="slc-profile-context-actions">${actions.map(([view,label,small])=>`<button class="btn-secondary btn-sm" data-slcnavigate="${view}" title="${small}">${label}</button>`).join('')}</div></div>`;
  }
  function enhanceDashboard(){
    const root=document.querySelector('#view-container'); if(!root||window.app?.currentView!=='dashboard')return;
    if(root.querySelector('[data-profile-context]'))return;
    const header=root.querySelector('.dashboard-header'); if(header)header.insertAdjacentHTML('afterend',contextHtml());
  }
  function patchLoad(){
    const app=window.app;if(!app||app.__slcProfileExperience)return;app.__slcProfileExperience=true;
    const original=app.loadView?.bind(app);if(!original)return;
    app.loadView=function(view,...args){const result=original(view,...args);setTimeout(()=>{applyNav();if(view==='dashboard')enhanceDashboard();},100);return result;};
  }
  function init(){
    injectStyle();applyNav();patchLoad();setTimeout(()=>{applyNav();enhanceDashboard();},350);
  }
  window.SLCProfileExperience={getProfile:profile,getProfileMeta,apply:applyNav,enhanceDashboard};
  document.addEventListener('app-ready',()=>{init();setTimeout(()=>enhanceDashboard(),180);});
  if(window.app?.initialized)setTimeout(init,120);
})();
