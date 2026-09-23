// SLCampus — dificuldade adaptativa por evidência e comportamento.
// A escolha inicial é apenas um ponto de partida. O motor observa notas,
// recuperação ativa, evidências de aprendizagem, revisões atrasadas e uso real
// do Modo Foco para recalibrar a dificuldade e explicar a mudança.
(function () {
  'use strict';
  const clamp = (n,a,b) => Math.max(a, Math.min(b,n));
  const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const num = v => { const n = Number(String(v ?? '').replace(',','.')); return Number.isFinite(n) ? n : null; };
  const dateOnly = v => String(v || '').slice(0,10);
  const daysSince = v => {
    if (!v) return 999;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return 999;
    return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
  };

  function gradeOf(g){ return num(g?.valor ?? g?.nota ?? g?.notaObtida ?? g?.notaFinal ?? g?.media); }
  function weightOf(g){ const w=num(g?.peso ?? g?.weight); return w && w>0 ? w : 1; }

  function computeDifficulty(subject, app) {
    const name = subject?.nome || '';
    const grades = (app?.data?.grades || []).filter(g => norm(g?.materia) === norm(name));
    const values = grades.map(gradeOf).filter(v => v !== null && v >= 0 && v <= 10);
    const history = app?.getAcademicSubjectIntelligence ? app.getAcademicSubjectIntelligence(name) : null;

    const sessions = (app?.data?.sessions || [])
      .filter(x => (x?.concluida === true || x?.status === 'concluida') && norm(x?.materia) === norm(name))
      .sort((a,b) => new Date(b?.data || b?.dataConclusao || 0) - new Date(a?.data || a?.dataConclusao || 0));
    const recentSessions = sessions.slice(0, 8);
    const lastStudyDate = recentSessions[0]?.data || recentSessions[0]?.dataConclusao || '';
    const daysWithoutStudy = daysSince(lastStudyDate);

    const evidenceScores = { explain: 5, exercise: 4, solve: 4, doubt: 2, review: 2 };
    const evidence = recentSessions.map(x => x?.learningEvidence?.level).filter(Boolean);
    const evidenceValues = evidence.map(x => evidenceScores[x]).filter(Number.isFinite);
    const evidenceAvg = evidenceValues.length ? evidenceValues.reduce((a,b)=>a+b,0)/evidenceValues.length : null;

    const questionRows = (app?.data?.questionAttempts || []).filter(x => norm(x?.materia) === norm(name)).slice(-12);
    const questionValues = questionRows.map(x => x.result === 'acerto' ? 5 : x.result === 'partial' ? 3 : 1);
    const questionAvg = questionValues.length ? questionValues.reduce((a,b)=>a+b,0)/questionValues.length : null;

    const reviews = (app?.data?.reviews || []).filter(r => norm(r?.materia) === norm(name));
    const today = new Date(); today.setHours(0,0,0,0);
    const overdueReviews = reviews.filter(r => !r?.concluida && r?.data && new Date(`${dateOnly(r.data)}T00:00:00`) < today);
    const pendingReviews = reviews.filter(r => !r?.concluida && r?.data);
    const overdueCount = overdueReviews.length;

    // Sem evidência atual, preserva a escolha inicial. Não aumentamos a
    // dificuldade de uma matéria que ainda não recebeu dados suficientes.
    if (!values.length) {
      const initial = clamp(Math.round(num(subject?.dificuldade) ?? 3), 1, 5);
      return {
        value: initial,
        label: ['','fácil','média-baixa','média','média-alta','difícil'][initial],
        confidence: 0,
        source: 'inicial',
        reason: 'Ainda não há notas atuais suficientes.',
        action: 'Registre avaliações, sessões ou evidências para a dificuldade aprender com você.'
      };
    }

    const totalW = grades.reduce((a,g)=>a+weightOf(g),0);
    const avg = grades.reduce((a,g)=>a+(gradeOf(g)||0)*weightOf(g),0) / Math.max(1,totalW);
    const recent = values.slice(-2);
    const recentAvg = recent.reduce((a,b)=>a+b,0)/recent.length;
    const previous = values.length > 2 ? values.slice(0,-2).reduce((a,b)=>a+b,0)/(values.length-2) : null;
    const trend = previous === null ? 0 : recentAvg - previous;
    const failedHistory = Number(history?.failedAttempts || 0);
    const required = history?.grade?.required;

    let value;
    if (avg >= 8.5) value = 1;
    else if (avg >= 7.5) value = 2;
    else if (avg >= 6.5) value = 3;
    else if (avg >= 5.5) value = 4;
    else value = 5;

    if (failedHistory > 0 && avg < 8.5) value = Math.max(value, 3);
    if (required !== null && required !== undefined && required > 8.5) value = Math.max(value, 4);

    if (evidenceValues.length >= 2 && evidenceAvg <= 2.5) value = Math.min(5, value + 1);
    if (evidenceValues.length >= 3 && evidenceAvg >= 4.5 && trend >= -0.5) value = Math.max(1, value - 1);
    if (questionValues.length >= 3 && questionAvg <= 2.2) value = Math.min(5, value + 1);
    if (questionValues.length >= 4 && questionAvg >= 4.3 && trend >= -0.5) value = Math.max(1, value - 1);

    if (trend >= 1.2 && recentAvg >= 7.5 && failedHistory === 0) value = Math.max(1, value - 1);
    if (trend <= -1.2) value = Math.min(5, value + 1);

    // Ausência de prática também é evidência, mas só quando existe algo
    // concreto para recuperar. Isso evita punir uma matéria simplesmente por
    // estar sem uso. A dificuldade sobe no máximo um nível por este motivo.
    const hasRecoveryEvidence = overdueCount >= 2 || pendingReviews.length >= 3;
    const noPracticeWindow = daysWithoutStudy >= 7;
    let inactivityReason = '';
    if (hasRecoveryEvidence && noPracticeWindow) {
      value = Math.min(5, value + 1);
      inactivityReason = `${overdueCount} revisão(ões) pendente(s) e ${daysWithoutStudy} dias sem sessão de estudo`;
    }

    // Recuperação consistente pode reduzir uma dificuldade alta. Só reduzimos
    // depois de evidência suficiente para não oscilar a cada sessão.
    const recentStrong = evidence.filter(x => ['explain','exercise','solve'].includes(x)).length;
    const recentCompletedReviews = reviews.filter(r => r?.concluida && daysSince(r?.updatedAt || r?.data) <= 21).length;
    if (value >= 4 && recentStrong >= 2 && recentCompletedReviews >= 1 && (recentAvg >= 7 || !values.length)) {
      value = Math.max(1, value - 1);
    }

    value = clamp(value,1,5);
    const labels = {1:'fácil',2:'média-baixa',3:'média',4:'média-alta',5:'difícil'};
    const confidence = clamp(Math.round(35 + values.length * 15 + (failedHistory ? 10 : 0)), 35, 95);

    const reasons = [`média atual ${avg.toFixed(1)}`];
    if (values.length >= 2 && Math.abs(trend) >= 0.5) reasons.push(trend > 0 ? `desempenho em melhora (+${trend.toFixed(1)})` : `desempenho em queda (${trend.toFixed(1)})`);
    if (failedHistory) reasons.push(`${failedHistory} reprovação(ões) no histórico`);
    if (evidenceAvg !== null) reasons.push(`evidência de aprendizagem ${evidenceAvg.toFixed(1)}/5`);
    if (questionAvg !== null) reasons.push(`recuperação ativa ${questionAvg.toFixed(1)}/5`);
    if (inactivityReason) reasons.push(inactivityReason);

    const current = clamp(Math.round(num(subject?.dificuldade) ?? 3), 1, 5);
    const changed = current !== value;
    let action = 'Continue registrando sessões, revisões e evidências; o SLCampus recalibra automaticamente.';
    if (value > current) {
      action = `A dificuldade subiu porque há sinais de que ${inactivityReason || 'o desempenho/recuperação ainda exige mais reforço'}. Para reduzi-la, faça uma sessão de recuperação ativa e conclua as revisões pendentes.`;
    } else if (value < current) {
      action = 'A dificuldade pode ser reduzida porque o desempenho e a prática recente mostram recuperação consistente. Mantenha revisões e exercícios para confirmar a melhora.';
    } else if (current >= 4) {
      action = 'Para reduzir a dificuldade, priorize revisões pendentes, recuperação ativa e sessões de exercícios nesta matéria.';
    }

    return {
      value,
      label: labels[value],
      confidence,
      source: 'automática',
      reason: reasons.join(', '),
      action,
      evidenceCount: evidenceValues.length,
      evidenceAverage: evidenceAvg,
      questionCount: questionValues.length,
      questionAverage: questionAvg,
      overdueReviews: overdueCount,
      daysWithoutStudy,
      changed
    };
  }

  function recalc(app, force=false) {
    if (!app?.data?.subjects?.length) return;
    let changed = false;
    app.data.subjects.forEach(s => {
      if (!s?.nome) return;
      const d = computeDifficulty(s, app);
      const before = Number(s.dificuldade) || 3;
      if (before !== d.value || s.dificuldadeAutomatica !== (d.source === 'automática') || s.dificuldadeMotivo !== d.reason || s.dificuldadeAcao !== d.action) {
        s.dificuldade = d.value;
        s.dificuldadeAutomatica = d.source === 'automática';
        s.dificuldadeRotulo = d.label;
        s.dificuldadeConfianca = d.confidence;
        s.dificuldadeMotivo = d.reason;
        s.dificuldadeAcao = d.action;
        s.dificuldadeAtualizadaEm = new Date().toISOString();
        if (before !== d.value) s.dificuldadeUltimaMudanca = { de: before, para: d.value, motivo: d.reason, acao: d.action, data: new Date().toISOString() };
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
    if (!fields.length || fields.some(f=>['grades','subjects','exams','sessions','classDiaries','reviews','attendance','questionAttempts'].includes(f))) {
      setTimeout(() => recalc(window.app), 300);
    }
  });
})();
