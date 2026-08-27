// subject-difficulty.js
// Dificuldade automática das matérias.
//
// Antes, "dificuldade" era um número de 1 a 5 escolhido manualmente pelo
// usuário lá no cadastro inicial e nunca mais mudava sozinho. Isso fazia o
// dado ficar desatualizado rápido (a matéria pode começar fácil e ficar
// puxada, ou o contrário) e obrigava a pessoa a "adivinhar" um número antes
// mesmo de cursar a matéria.
//
// Este módulo recalcula `subject.dificuldade` automaticamente com base em
// sinais reais do próprio site: média nas notas vs. meta, tarefas
// pendentes/atrasadas, presença/faltas e alerta de risco acadêmico
// (reaproveita app.getSubjectPerformance / analyzeAcademicRisk, que já
// existem em app.js). Isso é usado em vários lugares (risco acadêmico, peso
// no plano de estudo, Mentor IA) então mantê-lo atualizado sozinho melhora
// tudo que depende dele, sem trabalho extra pro usuário.
//
// Quando roda:
//  - pouco depois do app ficar pronto (login ou fim do onboarding)
//  - sempre que tasks, grades, exams, sessions, classDiaries ou attendance
//    forem salvos (evento 'slc-data-saved' disparado pelo database.js)
// Sempre com um pequeno "debounce" pra não recalcular em rajada.

(function () {
  'use strict';

  const RELEVANT_FIELDS = ['tasks', 'grades', 'exams', 'sessions', 'classDiaries', 'attendance', 'subjects'];
  const MIN_INTERVAL_MS = 60 * 1000; // não recalcula mais de 1x por minuto
  let lastRun = 0;
  let debounceTimer = null;

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  // Calcula a dificuldade (1 a 5) de UMA matéria a partir dos dados reais.
  // Começa neutro (3) e sobe/desce conforme sinais de dificuldade real.
  function computeDifficulty(subjectName, app) {
    let score = 3;

    const perf = typeof app.getSubjectPerformance === 'function'
      ? app.getSubjectPerformance(subjectName)
      : null;

    if (!perf) return score;

    // 1) Notas vs. meta da matéria — o sinal mais forte.
    if (perf.average > 0) {
      const target = Number(perf.subject?.notaDesejada) || 7;
      const gap = target - perf.average;
      if (gap >= 2.5) score += 2;
      else if (gap >= 1.5) score += 1.5;
      else if (gap >= 0.5) score += 0.5;
      else if (gap <= -1.5) score -= 1; // já está acima da meta: matéria "sob controle"
    }

    // 2) Tarefas pendentes específicas dessa matéria — acúmulo indica dificuldade/atraso.
    if (perf.tasksPending >= 4) score += 1;
    else if (perf.tasksPending >= 2) score += 0.5;

    // 3) Presença/frequência.
    if (typeof perf.attendance === 'number') {
      if (perf.attendance < 70) score += 1;
      else if (perf.attendance < 85) score += 0.5;
    }

    // 4) Nível de risco acadêmico já calculado em app.analyzeAcademicRisk().
    if (perf.riskLevel === 'alto') score += 1;
    else if (perf.riskLevel === 'medio') score += 0.5;

    // 5) Tempo parado sem estudar essa matéria enquanto há pendências.
    if (perf.daysWithoutStudy !== null && perf.daysWithoutStudy >= 10 && (perf.tasksPending || perf.upcomingExam)) {
      score += 0.5;
    }

    return clamp(Math.round(score), 1, 5);
  }

  function recalcAll(app, { force = false } = {}) {
    if (!app || !Array.isArray(app.data?.subjects) || !app.data.subjects.length) return;

    const now = Date.now();
    if (!force && now - lastRun < MIN_INTERVAL_MS) return;
    lastRun = now;

    let changedCount = 0;
    app.data.subjects.forEach(subject => {
      if (!subject?.nome) return;
      const novo = computeDifficulty(subject.nome, app);
      if (novo !== subject.dificuldade) {
        subject.dificuldade = novo;
        changedCount += 1;
      }
    });

    if (changedCount > 0 && typeof dbService !== 'undefined') {
      dbService.saveData('subjects', app.data.subjects);
      // Se a view atual mostra dificuldade (dashboard, matérias, mentor), refaz o render.
      const currentView = app.currentView || app.activeView;
      if (currentView && app.loadView && ['dashboard', 'materias', 'mentor-ia'].includes(currentView)) {
        app.loadView(currentView);
      }
    }
  }

  function scheduleRecalc(app, opts) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => recalcAll(app, opts), 1500);
  }

  document.addEventListener('app-ready', () => {
    if (window.app) scheduleRecalc(window.app, { force: true });
  });

  document.addEventListener('slc-data-saved', (e) => {
    const fields = e?.detail?.fields || [];
    const touchesRelevant = !fields.length || fields.some(f => RELEVANT_FIELDS.includes(f));
    if (touchesRelevant && window.app) scheduleRecalc(window.app);
  });

  // API pública — útil pra outras telas (ex: mostrar "por que essa dificuldade?")
  // e pra depuração manual no console.
  window.SubjectDifficulty = {
    computeDifficulty,
    recalcAll: (opts) => recalcAll(window.app, opts)
  };
})();
