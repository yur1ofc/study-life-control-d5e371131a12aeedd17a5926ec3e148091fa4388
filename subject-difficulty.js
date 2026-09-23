// SLCampus — dificuldade adaptativa por evidência.
// A escolha feita no cadastro inicial é apenas o ponto de partida.
// Assim que existem notas suficientes, a dificuldade passa a refletir o desempenho real.
(function () {
  'use strict';
  const clamp = (n,a,b) => Math.max(a, Math.min(b,n));
  const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const num = v => { const n = Number(String(v ?? '').replace(',','.')); return Number.isFinite(n) ? n : null; };

  function gradeOf(g){ return num(g?.valor ?? g?.nota ?? g?.notaObtida ?? g?.notaFinal ?? g?.media); }
  function weightOf(g){ const w=num(g?.peso ?? g?.weight); return w && w>0 ? w : 1; }

  function computeDifficulty(subject, app) {
    const name = subject?.nome || '';
    const grades = (app?.data?.grades || []).filter(g => norm(g?.materia) === norm(name));
    const values = grades.map(gradeOf).filter(v => v !== null && v >= 0 && v <= 10);
    const history = app?.getAcademicSubjectIntelligence ? app.getAcademicSubjectIntelligence(name) : null;

    // Sem evidência atual, preserva a escolha inicial. A IA não deve inventar dificuldade.
    if (!values.length) {
      const initial = clamp(Math.round(num(subject?.dificuldade) ?? 3), 1, 5);
      return { value: initial, label: ['','fácil','média-baixa','média','média-alta','difícil'][initial], confidence: 0, source: 'inicial', reason: 'Ainda não há notas atuais suficientes.' };
    }

    const totalW = grades.reduce((a,g)=>a+weightOf(g),0);
    const avg = grades.reduce((a,g)=>a+(gradeOf(g)||0)*weightOf(g),0) / Math.max(1,totalW);
    const recent = values.slice(-2);
    const recentAvg = recent.reduce((a,b)=>a+b,0)/recent.length;
    const previous = values.length > 2 ? values.slice(0,-2).reduce((a,b)=>a+b,0)/(values.length-2) : null;
    const trend = previous === null ? 0 : recentAvg - previous;
    const failedHistory = Number(history?.failedAttempts || 0);
    const required = history?.grade?.required;
    const evidenceScores = { explain: 5, exercise: 4, doubt: 2, review: 2 };
    const questionRows = (app?.data?.questionAttempts || []).filter(x => norm(x?.materia) === norm(name)).slice(-12);
    const questionValues = questionRows.map(x => x.result === 'acerto' ? 5 : x.result === 'partial' ? 3 : 1);
    const questionAvg = questionValues.length ? questionValues.reduce((a,b)=>a+b,0)/questionValues.length : null;
    const evidence = (app?.data?.sessions || [])
      .filter(x => norm(x?.materia) === norm(name) && x?.learningEvidence?.level)
      .slice(-8);
    const evidenceValues = evidence.map(x => evidenceScores[x.learningEvidence.level]).filter(Number.isFinite);
    const evidenceAvg = evidenceValues.length ? evidenceValues.reduce((a,b)=>a+b,0)/evidenceValues.length : null;

    let value;
    // Faixas centradas no desempenho real do aluno, não na dificuldade cadastrada.
    if (avg >= 8.5) value = 1;
    else if (avg >= 7.5) value = 2;
    else if (avg >= 6.5) value = 3;
    else if (avg >= 5.5) value = 4;
    else value = 5;

    // Evidência de repetição/reprovação impede classificar uma matéria como "fácil"
    // enquanto o desempenho atual não mostrar recuperação consistente.
    if (failedHistory > 0 && avg < 8.5) value = Math.max(value, 3);
    if (required !== null && required !== undefined && required > 8.5) value = Math.max(value, 4);

    // A nota continua sendo a evidência principal, mas a dificuldade também
    // reage ao que o aluno demonstrou conseguir recuperar nas sessões.
    if (evidenceValues.length >= 2 && evidenceAvg <= 2.5) value = Math.min(5, value + 1);
    if (evidenceValues.length >= 3 && evidenceAvg >= 4.5 && trend >= -0.5) value = Math.max(1, value - 1);
    if (questionValues.length >= 3 && questionAvg <= 2.2) value = Math.min(5, value + 1);
    if (questionValues.length >= 4 && questionAvg >= 4.3 && trend >= -0.5) value = Math.max(1, value - 1);

    // Uma melhora consistente pode reduzir a dificuldade mesmo após um histórico ruim.
    if (trend >= 1.2 && recentAvg >= 7.5 && failedHistory === 0) value = Math.max(1, value - 1);
    if (trend <= -1.2) value = Math.min(5, value + 1);

    value = clamp(value,1,5);
    const labels = {1:'fácil',2:'média-baixa',3:'média',4:'média-alta',5:'difícil'};
    const confidence = clamp(Math.round(35 + values.length * 15 + (failedHistory ? 10 : 0)), 35, 95);
    let reason = `média atual ${avg.toFixed(1)}`;
    if (values.length >= 2 && Math.abs(trend) >= 0.5) reason += trend > 0 ? `, desempenho em melhora (+${trend.toFixed(1)})` : `, desempenho em queda (${trend.toFixed(1)})`;
    if (failedHistory) reason += `, ${failedHistory} reprovação(ões) no histórico`;
    if (evidenceAvg !== null) reason += `, evidência de aprendizagem média ${evidenceAvg.toFixed(1)}/5`;
    if (questionAvg !== null) reason += `, recuperação ativa ${questionAvg.toFixed(1)}/5`;
    return { value, label: labels[value], confidence, source: 'automática', reason, evidenceCount: evidenceValues.length, evidenceAverage: evidenceAvg, questionCount: questionValues.length, questionAverage: questionAvg };
  }

  function recalc(app, force=false) {
    if (!app?.data?.subjects?.length) return;
    let changed = false;
    app.data.subjects.forEach(s => {
      if (!s?.nome) return;
      const d = computeDifficulty(s, app);
      if (s.dificuldade !== d.value || s.dificuldadeAutomatica !== (d.source === 'automática')) {
        s.dificuldade = d.value;
        s.dificuldadeAutomatica = d.source === 'automática';
        s.dificuldadeRotulo = d.label;
        s.dificuldadeConfianca = d.confidence;
        s.dificuldadeMotivo = d.reason;
        changed = true;
      }
    });
    if (changed && typeof dbService !== 'undefined' && dbService.saveData) {
      dbService.saveData('subjects', app.data.subjects);
    }
  }

  window.SubjectDifficulty = { computeDifficulty, recalcAll: () => recalc(window.app, true) };
  document.addEventListener('app-ready', () => setTimeout(() => recalc(window.app), 500));
  document.addEventListener('slc-data-saved', e => {
    const fields=e?.detail?.fields||[];
    if (!fields.length || fields.some(f=>['grades','subjects','exams','sessions','classDiaries','attendance'].includes(f))) {
      setTimeout(() => recalc(window.app), 300);
    }
  });
})();
