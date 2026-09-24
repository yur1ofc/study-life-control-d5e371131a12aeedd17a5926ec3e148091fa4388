'use strict';

// SLCampus — Academic Intelligence Server v2
// Deterministic layer shared by server-side Mentor/Telegram.
// It does not call an LLM. It separates urgency, attention, evidence of current risk,
// historical signals and data gaps so the conversational model explains rather than invents.

const Core = require('../../shared/academic-context.js');

const norm = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const num = (v, fallback = null) => {
  if (v === '' || v === null || v === undefined) return fallback;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
};
const dateOnly = v => {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};
const todayBR = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const daysUntil = d => {
  const x = dateOnly(d); if (!x) return null;
  const a = new Date(`${todayBR()}T00:00:00Z`), b = new Date(`${x}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
};
const gradeValue = g => num(g?.valor ?? g?.nota ?? g?.notaObtida ?? g?.notaFinal ?? g?.media, null);
const weightValue = g => num(g?.peso ?? g?.weight, null);
const isDone = x => !!(x?.concluida || ['concluida','concluido','completed','done'].includes(norm(x?.status)));
const failedStatus = s => ['reprovada','reprovado','rep','repf','repmf','repn','repnf','failed'].includes(norm(s));
const passedStatus = s => ['concluida','aprovado','aprovada','apr','aprn','disp','cumpriu','cump','trans','incorp','passed'].includes(norm(s));
const subjectName = s => String(s?.nome || s?.materia || s?.name || '').trim();

function historyRecords(data) {
  const out = [];
  const archives = Array.isArray(data?.archivedSemesters) ? data.archivedSemesters : [];
  archives.forEach((archive, ai) => {
    const period = String(archive?.periodo || archive?.anoPeriodo || archive?.numero || archive?.semestre || '').trim();
    const source = Array.isArray(archive?.subjects) && archive.subjects.length ? archive.subjects : (Array.isArray(archive?.curriculum) ? archive.curriculum : []);
    source.forEach((s, si) => {
      const name = subjectName(s); if (!name) return;
      const base = { name, code: String(s?.codigo || '').trim(), period, grade: num(s?.notaFinal ?? s?.nota ?? s?.media, null), status: s?.status || s?.resultado || null, archiveIndex: ai, sourceIndex: si };
      const attempts = Array.isArray(s?.tentativas) ? s.tentativas : [];
      if (attempts.length) attempts.forEach((a, ti) => out.push({ ...base, period: String(a?.periodo || a?.period || a?.semestre || period).trim(), grade: num(a?.nota ?? a?.notaFinal ?? a?.valor ?? a?.media, base.grade), status: a?.resultado ?? a?.status ?? base.status, attemptIndex: ti }));
      else out.push(base);
    });
  });
  return out;
}

function studyStats(data, name) {
  const sessions = Core.items(data, 'sessions').filter(x => norm(x?.materia) === norm(name));
  const now = Date.now();
  let last = null, recent7 = 0, previous7 = 0, total = 0;
  for (const s of sessions) {
    const min = num(s?.duracaoReal ?? s?.duracaoMin ?? s?.duracao, 0) || 0;
    total += min;
    const dt = new Date(s?.data || s?.inicio || s?.createdAt || 0);
    if (!Number.isNaN(dt.getTime())) {
      if (!last || dt > last) last = dt;
      const age = (now - dt.getTime()) / 86400000;
      if (age >= 0 && age < 7) recent7 += min;
      else if (age >= 7 && age < 14) previous7 += min;
    }
  }
  let trend = 'sem-dados';
  if (recent7 > previous7 * 1.15) trend = 'subindo';
  else if (previous7 > 0 && recent7 < previous7 * 0.85) trend = 'caindo';
  else if (recent7 || previous7) trend = 'estavel';
  const daysSinceStudy = last ? Math.floor((now - last.getTime()) / 86400000) : null;
  return { sessions: sessions.length, totalMinutes: total, recent7Minutes: recent7, previous7Minutes: previous7, trend, daysSinceStudy };
}

function learningStats(data, name) {
  const map = (Array.isArray(data?.learningMap) ? data.learningMap : []).filter(x => norm(x?.materia) === norm(name));
  const evidence = (Array.isArray(data?.learningEvidence) ? data.learningEvidence : []).filter(x => norm(x?.materia) === norm(name));
  const reviews = (Array.isArray(data?.reviews) ? data.reviews : []).filter(x => norm(x?.materia) === norm(name) && !isDone(x));
  const weakTopics = map.filter(x => {
    const c = num(x?.confianca ?? x?.confidence, null);
    const st = norm(x?.status);
    return (c !== null && c <= 2) || ['fraco','nao sei','pendente','revisar','revisao','estudando'].includes(st);
  });
  const weakEvidence = evidence.filter(x => {
    const r = norm(x?.resultado ?? x?.status ?? x?.feedback);
    const c = num(x?.confianca ?? x?.confidence, null);
    return c !== null && c <= 2 || ['duvida','duvida pendente','revisar','preciso revisar','erro','partial','parcial'].includes(r);
  });
  return { mapTopics: map.length, weakTopics: weakTopics.length, weakTopicNames: weakTopics.map(x => x?.topico || x?.nome).filter(Boolean).slice(0, 6), evidence: evidence.length, weakEvidence: weakEvidence.length, pendingReviews: reviews.length };
}

function workloadStats(data, name) {
  const tasks = Core.items(data, 'tasks').filter(x => norm(x?.materia) === norm(name) && !isDone(x));
  const overdueTasks = tasks.filter(x => { const d = daysUntil(x?.dataLimite || x?.data); return d !== null && d < 0; });
  const exams = Core.items(data, 'exams').filter(x => norm(x?.materia) === norm(name) && !isDone(x)).map(x => ({ ...x, days: daysUntil(x?.data) })).filter(x => x.days !== null && x.days >= 0).sort((a,b) => a.days - b.days);
  return { pendingTasks: tasks.length, overdueTasks: overdueTasks.length, overdueTitles: overdueTasks.map(x => x?.titulo || x?.nome).filter(Boolean).slice(0,4), upcomingExams: exams.length, nextExam: exams[0] ? { title: exams[0].titulo || 'Avaliação', date: dateOnly(exams[0].data), days: exams[0].days, weight: num(exams[0].peso, null), content: String(exams[0].conteudo || '').slice(0,300) } : null };
}

function gradeStats(data, name, subject) {
  const grades = Core.items(data, 'grades').filter(x => norm(x?.materia) === norm(name)).map(g => ({ ...g, value: gradeValue(g), weight: weightValue(g) })).filter(g => g.value !== null);
  const weighted = grades.filter(g => g.weight !== null && g.weight > 0);
  const weightTotal = weighted.reduce((a,g) => a + g.weight, 0);
  const weightedSum = weighted.reduce((a,g) => a + g.value * g.weight, 0);
  const simpleAvg = grades.length ? grades.reduce((a,g) => a + g.value, 0) / grades.length : null;
  const currentAverage = weighted.length && weightTotal > 0 ? weightedSum / weightTotal : simpleAvg;
  const target = num(subject?.notaDesejada ?? subject?.metaNota ?? subject?.objetivo, null);
  let required = null, remainingWeight = null, calculable = false, maxPossible = null;
  if (target !== null && weighted.length && weightTotal < 100 && weightTotal > 0) {
    remainingWeight = 100 - weightTotal;
    required = (target * 100 - weightedSum) / remainingWeight;
    maxPossible = (weightedSum + remainingWeight * 10) / 100;
    calculable = true;
  }
  return { count: grades.length, grades: grades.slice(-8).map(g => ({ name: g.nome, value: g.value, weight: g.weight, date: dateOnly(g.data) })), simpleAvg, currentAverage, target, weightRecorded: weightTotal, remainingWeight, required, maxPossible, calculable };
}

function attendanceStats(data, name) {
  const raw = data?.attendance;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const entry = raw[name] || raw[norm(name)] || null;
    if (entry) {
      const p = num(entry.presentes ?? entry.present ?? entry.presencas, null), a = num(entry.faltas ?? entry.absent ?? entry.absences, null);
      if (p !== null || a !== null) { const known = (p || 0) + (a || 0); return { known, present: p || 0, absent: a || 0, percentage: known ? Math.round((p || 0) / known * 100) : null, source: 'attendance' }; }
    }
  }
  const diaries = (Array.isArray(data?.classDiaries) ? data.classDiaries : []).filter(x => norm(x?.materia) === norm(name));
  const p = diaries.filter(x => ['presente','present','p'].includes(norm(x?.presenca || x?.status))).length;
  const a = diaries.filter(x => ['ausente','absente','a','falta','faltou'].includes(norm(x?.presenca || x?.status))).length;
  const known = p + a;
  return { known, present: p, absent: a, percentage: known ? Math.round(p / known * 100) : null, source: known ? 'diario' : 'sem-dados' };
}

function subjectReport(data, subject, history) {
  const name = subjectName(subject);
  const grades = gradeStats(data, name, subject);
  const study = studyStats(data, name);
  const learning = learningStats(data, name);
  const workload = workloadStats(data, name);
  const attendance = attendanceStats(data, name);
  const hist = history.filter(x => norm(x.name) === norm(name));
  const failed = hist.filter(x => failedStatus(x.status) || (x.grade !== null && x.grade < 5));
  const passed = hist.filter(x => passedStatus(x.status) || (x.grade !== null && x.grade >= 5));

  // Priority is a decision-support score, not a probability of failure.
  const urgency = workload.nextExam ? (workload.nextExam.days <= 2 ? 30 : workload.nextExam.days <= 5 ? 25 : workload.nextExam.days <= 7 ? 20 : workload.nextExam.days <= 14 ? 12 : workload.nextExam.days <= 30 ? 5 : 0) : 0;
  const gradePressure = grades.required === null ? (grades.currentAverage !== null && grades.target !== null && grades.currentAverage < grades.target ? Math.min(12, (grades.target - grades.currentAverage) * 3) : 0) : Math.max(0, Math.min(25, (grades.required - 5) * 5));
  const learningPressure = Math.min(20, learning.weakTopics * 5 + learning.weakEvidence * 4 + learning.pendingReviews * 2);
  const workloadPressure = Math.min(12, workload.overdueTasks * 5 + workload.pendingTasks * 1.5);
  const behaviorPressure = Math.min(10, study.trend === 'caindo' ? 5 : 0) + (study.daysSinceStudy !== null && study.daysSinceStudy >= 7 ? 5 : 0);
  const historySignal = Math.min(12, failed.length * 6);
  const attendancePressure = attendance.percentage !== null && attendance.percentage < 75 ? 10 : attendance.percentage !== null && attendance.percentage < 85 ? 4 : 0;
  const priorityScore = Math.max(0, Math.min(100, Math.round(urgency + gradePressure + learningPressure + workloadPressure + behaviorPressure + historySignal + attendancePressure)));

  // Current academic risk requires current evidence. Historical failure and upcoming exams
  // raise attention, but are not treated as proof of present failure.
  const currentEvidence = grades.count > 0 || attendance.known > 0 || learning.evidence > 0 || learning.mapTopics > 0 || workload.overdueTasks > 0;
  let riskLevel = 'indeterminado';
  const riskReasons = [];
  if (grades.required !== null && grades.required > 10) { riskLevel = 'alto'; riskReasons.push('a média necessária nas avaliações restantes ultrapassa 10'); }
  else if (grades.currentAverage !== null && grades.target !== null && grades.currentAverage < Math.max(5, grades.target - 1.5)) { riskLevel = 'atencao'; riskReasons.push(`média atual ${grades.currentAverage.toFixed(1)} abaixo da meta ${grades.target.toFixed(1)}`); }
  else if (attendance.percentage !== null && attendance.percentage < 75) { riskLevel = 'alto'; riskReasons.push(`frequência registrada de ${attendance.percentage}%`); }
  else if (workload.overdueTasks > 0 || learning.weakTopics > 0 || learning.weakEvidence > 0) { riskLevel = 'atencao'; if (workload.overdueTasks) riskReasons.push(`${workload.overdueTasks} tarefa(s) atrasada(s)`); if (learning.weakTopics) riskReasons.push(`${learning.weakTopics} tópico(s) com baixa confiança`); if (learning.weakEvidence) riskReasons.push(`${learning.weakEvidence} evidência(s) recente(s) de dúvida/erro/revisão`); }
  else if (currentEvidence && priorityScore >= 65) { riskLevel = 'atencao'; riskReasons.push('há vários sinais atuais de atenção, mas não há evidência suficiente para afirmar reprovação'); }
  else if (!currentEvidence) riskReasons.push('faltam dados atuais suficientes para avaliar risco acadêmico');

  const historicalSignal = failed.length ? `histórico com ${failed.length} tentativa(s) reprovada(s)` : hist.length ? `há ${hist.length} registro(s) histórico(s), sem reprovação identificada` : 'sem histórico importado desta matéria';
  const dataGaps = [];
  if (!grades.count) dataGaps.push('notas atuais');
  if (!workload.pendingTasks && !workload.overdueTasks) dataGaps.push('tarefas registradas');
  if (!study.sessions) dataGaps.push('sessões de estudo');
  if (!attendance.known) dataGaps.push('frequência');
  if (!learning.mapTopics && !learning.evidence) dataGaps.push('evidências de aprendizagem');

  return {
    name, code: String(subject?.codigo || subject?.code || ''), difficulty: num(subject?.dificuldade, null), target: grades.target,
    priorityScore, priorityComponents: { urgency, gradePressure: Math.round(gradePressure), learningPressure, workloadPressure, behaviorPressure, historySignal, attendancePressure },
    riskLevel, riskReasons, currentEvidence, historicalSignal,
    history: hist.slice(-8).map(x => ({ period:x.period, grade:x.grade, status:x.status })),
    failedAttempts: failed.length, passedAttempts: passed.length,
    grades, study, learning, workload, attendance, dataGaps,
    interpretation: priorityScore >= 65 ? 'atenção alta' : priorityScore >= 35 ? 'atenção moderada' : 'atenção baixa'
  };
}

function analyze(data) {
  const current = Core.current(data);
  const subjects = current.subjects || [];
  const perfil = String(data?.user?.perfil || 'faculdade');
  const history = ['faculdade','ensino_medio'].includes(perfil) ? historyRecords(data) : [];
  const reports = subjects.map(s => subjectReport(data, s, history));
  const priorities = reports.slice().sort((a,b) => b.priorityScore - a.priorityScore);
  const currentGrades = reports.map(r => r.grades.currentAverage).filter(Number.isFinite);
  const totalStudy = reports.reduce((a,r) => a + r.study.totalMinutes, 0);
  const dataQuality = Core.dataQuality(data);
  const gaps = [];
  if (!current.exams.length) gaps.push('avaliações');
  if (!current.grades.length) gaps.push('notas');
  if (!current.tasks.length) gaps.push('tarefas');
  if (!current.sessions.length) gaps.push('sessões de estudo');
  if (!current.classDiaries.length) gaps.push('diário');
  if (!current.reviews.length) gaps.push('revisões');
  return {
    generatedAt: new Date().toISOString(), today: todayBR(), profile: perfil, subjectCount: subjects.length,
    priorities: priorities.slice(0, 8), subjects: reports,
    overall: { currentAverage: currentGrades.length ? currentGrades.reduce((a,b)=>a+b,0)/currentGrades.length : null, studyMinutes: totalStudy, historicalFailures: history.filter(x=>failedStatus(x.status)||(x.grade!==null&&x.grade<5)).length, repeatedSubjects: reports.filter(r=>r.history.length>0).length },
    dataQuality, dataGaps: gaps,
    decisionRules: { priorityScoreIsNotRiskProbability: true, historicalDoesNotEqualCurrentRisk: true }
  };
}

function snapshotForMentor(data) {
  const a = analyze(data);
  const lines = [];
  lines.push(`INTELIGÊNCIA ACADÊMICA DETERMINÍSTICA — ${a.today}`);
  lines.push(`Regra: score de prioridade NÃO é probabilidade de reprovação; histórico NÃO é evidência de risco atual.`);
  lines.push(`Qualidade geral dos dados: ${a.dataQuality.score}% (${a.dataQuality.level}).`);
  if (a.dataGaps.length) lines.push(`Lacunas globais: ${a.dataGaps.join(', ')}.`);
  if (a.overall.currentAverage !== null) lines.push(`Média simples das matérias com notas atuais: ${a.overall.currentAverage.toFixed(1)}.`);
  if (a.overall.studyMinutes) lines.push(`Estudo registrado no conjunto atual: ${(a.overall.studyMinutes/60).toFixed(1)}h.`);
  if (a.priorities.length) {
    lines.push(`Prioridades calculadas (para decidir onde concentrar atenção, não para prever resultado): ${a.priorities.slice(0,5).map(r=>`${r.name}=${r.priorityScore}/100`).join(' | ')}.`);
  }
  for (const r of a.priorities.slice(0,8)) {
    const ex = r.workload.nextExam ? `${r.workload.nextExam.title} em ${r.workload.nextExam.days}d (${r.workload.nextExam.date})` : 'sem próxima avaliação identificada';
    const grade = r.grades.count ? `média ${r.grades.currentAverage?.toFixed?.(1) ?? '—'}; necessária ${r.grades.required === null ? 'não calculável' : r.grades.required > 10 ? '>10' : r.grades.required.toFixed(1)}` : 'sem nota atual';
    const risk = r.riskLevel === 'indeterminado' ? 'risco atual indeterminado' : `risco atual ${r.riskLevel}`;
    lines.push(`- ${r.name}: prioridade ${r.priorityScore}; ${risk}; prova ${ex}; ${grade}; dificuldade ${r.difficulty ?? 'não informada'}; histórico ${r.failedAttempts} reprovação(ões); estudo 7d ${r.study.recent7Minutes}min (${r.study.trend}); tarefas pendentes ${r.workload.pendingTasks}, atrasadas ${r.workload.overdueTasks}; tópicos fracos ${r.learning.weakTopics}; revisões pendentes ${r.learning.pendingReviews}; frequência ${r.attendance.percentage === null ? 'sem dado' : r.attendance.percentage+'%'}; lacunas ${r.dataGaps.join(', ') || 'nenhuma'}.`);
  }
  return { analysis: a, text: lines.join('\n') };
}

module.exports = { analyze, snapshotForMentor, todayBR };
