// academic-intelligence.js
// SLCampus — cérebro acadêmico determinístico.
// Não chama LLM. Consolida semestre atual + histórico + notas + frequência +
// sessões + tarefas + provas + diário + mapa de aprendizagem + currículo.
(function () {
  'use strict';
  if (window.AcademicIntelligence) return;

  const num = (v, fallback = null) => {
    if (v === '' || v === null || v === undefined) return fallback;
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : fallback;
  };
  const clone = v => { try { return JSON.parse(JSON.stringify(v)); } catch (_) { return v; } };
  const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const days = ms => Math.max(0, Math.floor(ms / 86400000));
  const validDate = v => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? d : null; };
  const now = () => new Date();
  const isCompleted = s => !!(s?.concluida || s?.status === 'concluida');
  const gradeValue = g => num(g?.valor ?? g?.nota ?? g?.notaObtida ?? g?.notaFinal ?? g?.media, null);
  const gradeWeight = g => num(g?.peso ?? g?.weight, null);
  const statusNorm = s => norm(s).replace(/\s+/g, ' ');
  const passedStatus = s => ['concluida','aprovado','aprovada','apr','aprn','disp','cumpriu','cump','trans','incorp'].includes(statusNorm(s));
  const failedStatus = s => ['reprovada','reprovado','rep','repf','repmf','repn','repnf'].includes(statusNorm(s));
  const currentStatus = s => ['cursando','matriculado','matr','em andamento','andamento'].includes(statusNorm(s));

  function subjectKey(s) { return norm(s?.codigo || s?.code) || norm(s?.nome || s?.materia || s?.name); }
  function subjectName(s) { return String(s?.nome || s?.materia || s?.name || '').trim(); }
  function archivePeriod(a) {
    return String(a?.periodo || a?.anoPeriodo || a?.numero || a?.semestre || '').trim();
  }
  function periodSortValue(p) {
    const m = String(p || '').match(/(\d{4})\D?(\d+)/);
    if (m) return Number(m[1]) * 10 + Number(m[2]);
    const n = num(p, -1); return n;
  }

  class AcademicIntelligence {
    constructor(app) { this.app = app || window.app || null; }

    getData() { return this.app?.data || {}; }

    getArchives() {
      const d = this.getData();
      return Array.isArray(d.archivedSemesters) ? d.archivedSemesters : [];
    }

    getCurrentSubjects() {
      const d = this.getData();
      return Array.isArray(d.subjects) ? d.subjects : [];
    }

    getHistoryRecords() {
      const records = [];
      const seen = new Set();
      const archives = this.getArchives();
      archives.forEach((archive, ai) => {
        const period = archivePeriod(archive);
        const source = Array.isArray(archive.subjects) && archive.subjects.length
          ? archive.subjects
          : (Array.isArray(archive.curriculum) ? archive.curriculum : []);
        source.forEach((s, si) => {
          const name = subjectName(s); if (!name) return;
          const key = subjectKey(s) || norm(name);
          const base = {
            key, name, code: String(s?.codigo || '').trim(), period,
            grade: num(s?.notaFinal ?? s?.nota ?? s?.media, null),
            status: s?.status || s?.resultado || null,
            attendance: num(s?.frequencia ?? s?.attendance ?? s?.freq, null),
            studyHours: 0,
            sessions: 0,
            source: 'archive', archiveIndex: ai, sourceIndex: si
          };
          const attempts = Array.isArray(s?.tentativas) ? s.tentativas : [];
          if (attempts.length) {
            attempts.forEach((a, ti) => {
              const ap = String(a?.periodo || a?.period || a?.semestre || period || '').trim();
              const ag = num(a?.nota ?? a?.notaFinal ?? a?.valor ?? a?.media, base.grade);
              const as = a?.resultado ?? a?.status ?? base.status;
              records.push({ ...base, period: ap, grade: ag, status: as, attemptIndex: ti });
            });
          } else records.push(base);

          const hs = Array.isArray(archive.sessions) ? archive.sessions : [];
          hs.filter(x => norm(x?.materia) === norm(name) && isCompleted(x)).forEach(x => {
            const last = records.filter(r => r.archiveIndex === ai && r.key === key).at(-1);
            if (last) { last.studyHours += (num(x?.duracao, 0) || 0) / 60; last.sessions += 1; }
          });
        });
      });

      // Currículo antigo pode conter tentativas que não viraram snapshots.
      const curriculum = Array.isArray(this.getData().curriculum) ? this.getData().curriculum : [];
      curriculum.forEach(s => {
        const name = subjectName(s); if (!name) return;
        (Array.isArray(s?.tentativas) ? s.tentativas : []).forEach(a => {
          const period = String(a?.periodo || a?.period || a?.semestre || '').trim();
          const key = subjectKey(s) || norm(name);
          const signature = `${key}|${period}|${num(a?.nota ?? a?.notaFinal ?? a?.valor, null)}|${norm(a?.resultado ?? a?.status)}`;
          if (!period || seen.has(signature)) return;
          seen.add(signature);
          records.push({ key, name, code: String(s?.codigo || '').trim(), period,
            grade: num(a?.nota ?? a?.notaFinal ?? a?.valor ?? a?.media, null),
            status: a?.resultado ?? a?.status ?? null, attendance: num(a?.frequencia ?? a?.attendance, null),
            studyHours: 0, sessions: 0, source: 'curriculum-attempt' });
        });
      });
      return records.sort((a,b) => periodSortValue(a.period) - periodSortValue(b.period));
    }

    getSubjectHistory(subject) {
      const key = subjectKey(subject); const name = norm(subjectName(subject));
      const rows = this.getHistoryRecords().filter(r => (key && r.key === key) || norm(r.name) === name);
      const unique = [];
      const signatures = new Set();
      rows.forEach(r => {
        const sig = `${r.period}|${r.key}|${r.grade}|${norm(r.status)}`;
        if (!signatures.has(sig)) { signatures.add(sig); unique.push(r); }
      });
      return unique.sort((a,b) => periodSortValue(a.period) - periodSortValue(b.period));
    }

    getCurrentGrades(name) {
      return (this.getData().grades || []).filter(g => norm(g?.materia) === norm(name));
    }

    gradeAnalysis(name, subject) {
      const grades = this.getCurrentGrades(name);
      const valid = grades.map(g => ({ value: gradeValue(g), weight: gradeWeight(g) })).filter(x => x.value !== null);
      const weighted = valid.filter(x => x.weight !== null && x.weight > 0);
      const weightDone = Math.min(100, weighted.reduce((a,x) => a + x.weight, 0));
      const weightedSum = weighted.reduce((a,x) => a + x.value * x.weight, 0);
      const currentAverage = weightDone > 0 ? weightedSum / weightDone : (valid.length ? valid.reduce((a,x)=>a+x.value,0)/valid.length : null);
      const target = Math.max(0, Math.min(10, num(subject?.notaDesejada, 7) ?? 7));
      const remaining = Math.max(0, 100 - weightDone);
      const required = remaining > 0 ? ((target * 100) - weightedSum) / remaining : null;
      const maxPossible = remaining > 0 ? (weightedSum + remaining * 10) / 100 : currentAverage;
      return { count: valid.length, weightDone, remaining, weightedSum, currentAverage, target,
        required, maxPossible, hasGrades: valid.length > 0, achievable: required === null ? null : required <= 10 };
    }

    studyAnalysis(name) {
      const sessions = (this.getData().sessions || []).filter(s => norm(s?.materia) === norm(name) && isCompleted(s));
      const totalMin = sessions.reduce((a,s) => a + (num(s?.duracao,0)||0), 0);
      const cutoff7 = Date.now() - 7*86400000, cutoff30 = Date.now() - 30*86400000;
      const recent7 = sessions.filter(s => { const d=validDate(s?.data || s?.timestamp); return d && d.getTime() >= cutoff7; }).reduce((a,s)=>a+(num(s?.duracao,0)||0),0);
      const recent30 = sessions.filter(s => { const d=validDate(s?.data || s?.timestamp); return d && d.getTime() >= cutoff30; }).reduce((a,s)=>a+(num(s?.duracao,0)||0),0);
      const last = sessions.map(s=>validDate(s?.data || s?.timestamp)).filter(Boolean).sort((a,b)=>b-a)[0] || null;
      const prev7 = sessions.filter(s => { const d=validDate(s?.data || s?.timestamp); return d && d.getTime() >= cutoff30 && d.getTime() < cutoff7; }).reduce((a,s)=>a+(num(s?.duracao,0)||0),0);
      const trend = prev7 === 0 ? (recent7 > 0 ? 'novo' : 'sem-dados') : recent7 >= prev7*1.2 ? 'subindo' : recent7 <= prev7*0.8 ? 'caindo' : 'estavel';
      return { sessions: sessions.length, totalHours: totalMin/60, recent7Hours: recent7/60, recent30Hours: recent30/60,
        previous7Hours: prev7/60, trend, lastStudy: last?.toISOString() || null,
        daysSinceStudy: last ? days(last === null ? 0 : Date.now() - last.getTime()) : null };
    }

    attendanceAnalysis(name) {
      const d = this.getData();
      const diaries = (d.classDiaries || []).filter(x => norm(x?.materia) === norm(name));
      const explicit = diaries.length ? diaries : [];
      const present = explicit.filter(x => ['present','presente','p'].includes(norm(x?.presenca || x?.status))).length;
      const absent = explicit.filter(x => ['absent','ausente','a','falta','faltou'].includes(norm(x?.presenca || x?.status))).length;
      const known = present + absent;
      const percentage = known ? Math.round((present / known) * 100) : null;
      return { known, present, absent, percentage, source: known ? 'diario' : 'sem-dados' };
    }

    learningAnalysis(name) {
      const d = this.getData();
      const topics = (d.learningMap || []).filter(x => norm(x?.materia) === norm(name));
      const weak = topics.filter(x => {
        const c = num(x?.confianca ?? x?.confidence, null);
        const status = norm(x?.status);
        return (c !== null && c <= 2) || ['fraco','nao sei','não sei','pendente','revisar','revisao'].includes(status);
      });
      const pendingReviews = (d.reviews || []).filter(x => norm(x?.materia) === norm(name) && !x?.concluida);
      const diary = (d.classDiaries || []).filter(x => norm(x?.materia) === norm(name));
      const doubts = diary.filter(x => x?.naoEntendi || x?.duvidaPendente || x?.precisoRevisar);
      return { topics: topics.length, weakTopics: weak.length, pendingReviews: pendingReviews.length, unresolvedDoubts: doubts.length };
    }

    workload(name) {
      const d = this.getData();
      const pendingTasks = (d.tasks || []).filter(x => norm(x?.materia) === norm(name) && !x?.concluida);
      const overdueTasks = pendingTasks.filter(x => { const dt=validDate(x?.dataLimite || x?.data); return dt && dt < now(); }).length;
      const exams = (d.exams || []).filter(x => norm(x?.materia) === norm(name) && !x?.concluida).map(x=>({ ...x, _d: validDate(x?.data) })).filter(x=>x._d && x._d >= now()).sort((a,b)=>a._d-b._d);
      const nextExam = exams[0] || null;
      return { pendingTasks: pendingTasks.length, overdueTasks, upcomingExams: exams.length, nextExam: nextExam ? { title: nextExam.titulo, date: nextExam.data, days: days(nextExam._d-now()) } : null };
    }

    prerequisites(name) {
      const d = this.getData();
      const c = (d.curriculum || []).find(x => norm(x?.nome) === norm(name));
      const list = Array.isArray(c?.prerequisitosLista) ? c.prerequisitosLista : String(c?.prerequisitos || '').split(/[,;|]/).map(x=>x.trim()).filter(Boolean);
      return list.map(x => String(x));
    }

    subject(subject) {
      const name = subjectName(subject); const history = this.getSubjectHistory(subject);
      const grades = this.gradeAnalysis(name, subject); const study = this.studyAnalysis(name);
      const attendance = this.attendanceAnalysis(name); const learning = this.learningAnalysis(name);
      const workload = this.workload(name); const prereq = this.prerequisites(name);
      const failed = history.filter(r => failedStatus(r.status) || (r.grade !== null && r.grade < 5));
      const passed = history.filter(r => passedStatus(r.status) || (r.grade !== null && r.grade >= 5));
      const previous = history.length ? history[history.length-1] : null;
      const best = history.map(x=>x.grade).filter(x=>x!==null).sort((a,b)=>b-a)[0] ?? null;
      const worst = history.map(x=>x.grade).filter(x=>x!==null).sort((a,b)=>a-b)[0] ?? null;
      const historicalGrades = history.map(x=>x.grade).filter(x=>x!==null);
      const histAvg = historicalGrades.length ? historicalGrades.reduce((a,b)=>a+b,0)/historicalGrades.length : null;
      const isRepeated = failed.length > 0 || history.length > 0 && history.some(r => norm(r.name) === norm(name));
      const reasons = [];
      if (failed.length) reasons.push(`${failed.length} tentativa(s) anterior(es) com reprovação`);
      if (grades.hasGrades && grades.required !== null && grades.required > 8) reasons.push(`precisa de ${grades.required.toFixed(1)} nas avaliações restantes`);
      if (grades.hasGrades && grades.required !== null && grades.required > 10) reasons.push('meta configurada não é mais atingível apenas com o peso restante');
      if (attendance.percentage !== null && attendance.percentage < 75) reasons.push(`frequência registrada de ${attendance.percentage}%`);
      if (workload.overdueTasks) reasons.push(`${workload.overdueTasks} tarefa(s) atrasada(s)`);
      if (workload.nextExam && workload.nextExam.days <= 7) reasons.push(`avaliação em ${workload.nextExam.days} dia(s)`);
      if (learning.weakTopics) reasons.push(`${learning.weakTopics} tópico(s) com baixa confiança`);
      if (study.daysSinceStudy !== null && study.daysSinceStudy >= 7) reasons.push(`${study.daysSinceStudy} dias sem estudar`);
      if (study.trend === 'caindo') reasons.push('ritmo de estudo caiu em relação aos 7 dias anteriores');
      if (prereq.length) {
        const weakPrereq = prereq.filter(p => {
          const hist = this.getHistoryRecords().filter(r => norm(r.name) === norm(p) || norm(r.code) === norm(p));
          return hist.some(r => failedStatus(r.status) || (r.grade !== null && r.grade < 5));
        });
        if (weakPrereq.length) reasons.push(`pré-requisito(s) com histórico de dificuldade: ${weakPrereq.join(', ')}`);
      }
      let priority = 0;
      if (failed.length) priority += 30 + Math.min(20, failed.length*10);
      if (isRepeated) priority += 10;
      if (grades.hasGrades && grades.required !== null) priority += Math.max(0, Math.min(25, (grades.required - 5) * 5));
      if (workload.nextExam?.days <= 7) priority += 18;
      else if (workload.nextExam?.days <= 14) priority += 8;
      priority += Math.min(12, learning.weakTopics*4);
      priority += Math.min(10, workload.overdueTasks*3);
      if (attendance.percentage !== null && attendance.percentage < 75) priority += 10;
      if (study.trend === 'caindo') priority += 6;
      if (study.daysSinceStudy !== null && study.daysSinceStudy >= 7) priority += 6;
      priority = Math.min(100, Math.round(priority));
      const risk = grades.hasGrades && grades.required !== null && grades.required > 10 ? 'alto' : priority >= 65 ? 'alto' : priority >= 35 ? 'medio' : 'baixo';
      const recommendation = failed.length
        ? `Você já teve ${failed.length} reprovação(ões) nesta matéria. Compare os pontos de dificuldade das tentativas anteriores e aumente o estudo ativo antes das próximas avaliações.`
        : workload.nextExam?.days <= 7
          ? `Avaliação próxima: priorize revisão dos tópicos fracos e exercícios até ${workload.nextExam.days} dia(s).`
          : learning.weakTopics
            ? `Ataque primeiro os ${learning.weakTopics} tópico(s) de baixa confiança e registre dúvidas no diário.`
            : study.trend === 'caindo'
              ? 'Seu ritmo de estudo caiu. Retome sessões curtas e regulares antes de acumular conteúdo.'
              : 'Mantenha constância e registre notas, frequência e tópicos para aumentar a precisão da análise.';
      return { name, code: String(subject?.codigo || '').trim(), history, attempts: history.length,
        failedAttempts: failed.length, passedAttempts: passed.length, isRepeated,
        previousAttempt: previous, bestGrade: best, worstGrade: worst, historicalAverage: histAvg,
        grade: grades, study, attendance, learning, workload, prerequisites: prereq,
        priorityScore: priority, riskLevel: risk, riskReasons: reasons.slice(0,6), recommendation };
    }

    analyze() {
      const subjects = this.getCurrentSubjects();
      const subjectReports = subjects.map(s => this.subject(s));
      const allHistory = this.getHistoryRecords();
      const currentGrades = subjectReports.map(r=>r.grade.currentAverage).filter(x=>x!==null);
      const passedHistory = allHistory.filter(r=>passedStatus(r.status) || (r.grade !== null && r.grade >= 5)).length;
      const failedHistory = allHistory.filter(r=>failedStatus(r.status) || (r.grade !== null && r.grade < 5)).length;
      const studyMinutes = subjectReports.reduce((a,r)=>a+r.study.totalHours*60,0);
      const priorities = [...subjectReports].sort((a,b)=>b.priorityScore-a.priorityScore);
      const dataQuality = {
        currentSubjects: subjects.length > 0,
        history: this.getArchives().length > 0 || allHistory.length > 0,
        grades: currentGrades.length > 0,
        attendance: subjectReports.some(r=>r.attendance.known > 0),
        sessions: subjectReports.some(r=>r.study.sessions > 0),
        learningMap: subjectReports.some(r=>r.learning.topics > 0),
        diary: subjectReports.some(r=>r.learning.unresolvedDoubts > 0 || (this.getData().classDiaries||[]).length > 0)
      };
      return {
        generatedAt: new Date().toISOString(),
        currentSemester: this.getData()?.user?.semestre ?? null,
        subjectCount: subjects.length,
        subjects: subjectReports,
        priorities: priorities.slice(0,8),
        historicalRecords: allHistory,
        overall: { currentAverage: currentGrades.length ? currentGrades.reduce((a,b)=>a+b,0)/currentGrades.length : null,
          passedHistory, failedHistory, studyHours: studyMinutes/60, repeatedSubjects: subjectReports.filter(r=>r.isRepeated).length },
        dataQuality
      };
    }

    snapshotForMentor() {
      const a = this.analyze();
      const lines = [];
      lines.push(`INTELIGÊNCIA ACADÊMICA: ${a.subjectCount} matéria(s) atual(is), ${a.overall.repeatedSubjects} com histórico de tentativa/reprovação.`);
      if (a.overall.currentAverage !== null) lines.push(`Média simples das matérias com notas atuais: ${a.overall.currentAverage.toFixed(1)}.`);
      if (a.overall.studyHours > 0) lines.push(`Estudo registrado no semestre atual: ${a.overall.studyHours.toFixed(1)}h.`);
      a.subjects.forEach(r => {
        const hist = r.history.length ? r.history.map(h => `${h.period || '?'}=${h.grade !== null ? h.grade.toFixed(1) : 'sem nota'}${h.status ? `/${h.status}` : ''}`).join(', ') : 'sem histórico importado';
        const current = r.grade.hasGrades ? `média atual ${r.grade.currentAverage.toFixed(1)}, precisa ${r.grade.required !== null ? (r.grade.required > 10 ? '>10' : r.grade.required.toFixed(1)) : '—'} nas avaliações restantes` : 'sem avaliação atual lançada';
        const freq = r.attendance.percentage !== null ? `${r.attendance.percentage}% (${r.attendance.present}P/${r.attendance.absent}F)` : 'sem dados de frequência';
        const priority = r.priorityScore > 0 ? `prioridade ${r.priorityScore}/100` : 'sem alerta forte';
        lines.push(`- ${r.name}: ${current}; histórico [${hist}]; frequência ${freq}; estudo ${r.study.totalHours.toFixed(1)}h (${r.study.trend}); ${priority}; motivos: ${r.riskReasons.join('; ') || 'nenhum'}.`);
      });
      if (a.priorities.length) lines.push(`Prioridades calculadas: ${a.priorities.slice(0,5).map(r=>`${r.name} (${r.priorityScore})`).join(', ')}.`);
      return lines.join('\n');
    }
  }

  window.AcademicIntelligence = AcademicIntelligence;
  window.academicIntelligence = new AcademicIntelligence(window.app);

  function engine() {
    const app = window.app;
    if (!app) return setTimeout(engine, 250);
    window.academicIntelligence = new AcademicIntelligence(app);

    // Uma fonte central para todos os módulos.
    app.getAcademicIntelligence = function () {
      window.academicIntelligence.app = this;
      return window.academicIntelligence.analyze();
    };
    app.getAcademicSubjectIntelligence = function (name) {
      const subject = (this.data.subjects || []).find(s => norm(s?.nome) === norm(name));
      return subject ? window.academicIntelligence.subject(subject) : null;
    };

    // Mantém compatibilidade com o site antigo, mas substitui o risco simplista
    // por sinais históricos + atuais.
    const originalRisk = app.analyzeAcademicRisk?.bind(app);
    app.analyzeAcademicRisk = function () {
      const reports = this.getAcademicIntelligence().subjects || [];
      return reports.filter(r => r.riskLevel !== 'baixo' || r.priorityScore >= 35).map(r => ({
        materia: r.name,
        nivel: r.riskLevel,
        motivo: r.riskReasons.slice(0,2).join('; ') || r.recommendation,
        score: r.priorityScore,
        intelligence: r
      }));
    };

    // Enriquece o objeto usado pelo dashboard/situação acadêmica sem quebrar
    // nenhum consumidor existente.
    const originalPerf = app.getSubjectPerformance?.bind(app);
    if (originalPerf) {
      app.getSubjectPerformance = function (name) {
        const base = originalPerf(name);
        const intelligence = this.getAcademicSubjectIntelligence(name);
        if (!base || !intelligence) return base;
        return { ...base,
          riskLevel: intelligence.riskLevel,
          riskReason: intelligence.riskReasons.slice(0,2).join('; ') || intelligence.recommendation,
          historicalAttempts: intelligence.attempts,
          historicalFailures: intelligence.failedAttempts,
          historicalBestGrade: intelligence.bestGrade,
          historicalWorstGrade: intelligence.worstGrade,
          historicalAverage: intelligence.historicalAverage,
          currentGradeAnalysis: intelligence.grade,
          studyTrend: intelligence.study.trend,
          studyHours7d: intelligence.study.recent7Hours,
          weakTopics: intelligence.learning.weakTopics,
          intelligencePriority: intelligence.priorityScore,
          intelligenceRisk: intelligence.riskLevel,
          intelligenceReasons: intelligence.riskReasons,
          intelligenceRecommendation: intelligence.recommendation,
          previousAttempt: intelligence.previousAttempt
        };
      };
    }

    // Faz o Mentor receber o cérebro acadêmico junto com o restante do contexto.
    const AIP = window.AIAssistant?.prototype;
    if (AIP && !AIP.__academicIntelligencePatched) {
      const originalUpdate = AIP.updateContext;
      AIP.updateContext = function (data) {
        const result = originalUpdate ? originalUpdate.call(this, data) : undefined;
        try {
          window.academicIntelligence.app = window.app || app;
          this.context.academicIntelligence = window.academicIntelligence.analyze();
        } catch (e) { console.warn('[AcademicIntelligence] contexto do Mentor:', e); }
        return result;
      };
      const originalSnapshot = AIP._buildMentorContextSnapshot;
      if (originalSnapshot) {
        AIP._buildMentorContextSnapshot = function () {
          const base = originalSnapshot.call(this);
          try {
            window.academicIntelligence.app = window.app || app;
            return `${base}\n\n${window.academicIntelligence.snapshotForMentor()}`;
          } catch (_) { return base; }
        };
      }
      AIP.__academicIntelligencePatched = true;
    }

    // Recalcula quando o app já tiver sido carregado e após alterações futuras.
    try { window.aiAssistant?.updateContext?.(app.data); } catch (_) {}
    console.info('[AcademicIntelligence] motor central ativado.');
  }

  // ── Camada adaptativa + respostas determinísticas do Mentor ─────────────
  // Tudo aqui usa os dados do app. Gemini fica reservado para perguntas abertas.
  function installSmartMentor(app) {
    const P = window.AIAssistant?.prototype;
    if (!P || P.__smartMentorV11) return;
    const ai = window.academicIntelligence;
    const n = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
    const dayDiff = d => { const x=new Date(d); if(Number.isNaN(x.getTime())) return 999; const a=new Date(); a.setHours(0,0,0,0); x.setHours(0,0,0,0); return Math.round((x-a)/86400000); };
    const subjectByName = name => (app.data.subjects||[]).find(s=>n(s.nome)===n(name));

    function adaptiveDifficulty(name) {
      const s=subjectByName(name); const r=ai.getSubjectHistory ? ai.subject(s) : null;
      if (!s || !r) return null;
      const grades=(app.data.grades||[]).filter(g=>n(g.materia)===n(name));
      const vals=grades.map(g=>Number(g.valor ?? g.nota ?? g.notaObtida ?? g.notaFinal ?? g.media)).filter(x=>Number.isFinite(x));
      if(!vals.length) return {label:['','fácil','média-baixa','média','média-alta','difícil'][Number(s.dificuldade)||3], value:Number(s.dificuldade)||3, confidence:0, reason:'Ainda sem notas atuais.'};
      const avg=r.grade.currentAverage;
      const recent=vals.slice(-2).reduce((a,b)=>a+b,0)/Math.min(2,vals.length);
      const label=s.dificuldadeRotulo || ['','fácil','média-baixa','média','média-alta','difícil'][Number(s.dificuldade)||3];
      return {label,value:Number(s.dificuldade)||3,confidence:Number(s.dificuldadeConfianca)||35,reason:s.dificuldadeMotivo||`média atual ${avg?.toFixed?.(1)}`,avg,recent};
    }

    function overdue() {
      const tasks=(app.data.tasks||[]).filter(t=>!t?.concluida && (t.dataLimite||t.data) && dayDiff(t.dataLimite||t.data)<0)
        .map(t=>({type:'Tarefa',title:t.titulo||t.nome||'Sem título',materia:t.materia||'Sem matéria',date:t.dataLimite||t.data,days:Math.abs(dayDiff(t.dataLimite||t.data))}));
      const reviews=(app.data.learningMap||[]).filter(t=>['estudando','revisando'].includes(n(t.status)) && t.ultimaRevisao && dayDiff(t.ultimaRevisao)>7)
        .map(t=>({type:'Revisão',title:t.topico||t.nome||'Tópico',materia:t.materia||'Sem matéria',days:dayDiff(t.ultimaRevisao)}));
      return {tasks,reviews};
    }

    function riskAnswer() {
      const a=ai.analyze(); const active=a.subjects.filter(r=>r.riskLevel!=='baixo'||r.priorityScore>=20).sort((x,y)=>y.priorityScore-x.priorityScore);
      if(!active.length) return 'Nenhum alerta acadêmico forte foi identificado nos dados atuais. Continue registrando notas, estudo, presença e avaliações para manter a análise atualizada.';
      const lines=['Raio de risco acadêmico atual:'];
      active.slice(0,6).forEach(r=>{
        const diff=r.difficulty?.label || app.data.subjects.find(s=>n(s.nome)===n(r.name))?.dificuldadeRotulo || 'não definida';
        lines.push(`- ${r.name} — atenção ${r.riskLevel.toUpperCase()} | dificuldade atual: ${diff}. ${r.riskReasons.slice(0,3).join('; ') || r.recommendation}`);
      });
      return lines.join('\n');
    }

    function rayAnswer() {
      const a=ai.analyze();
      const ordered=a.subjects.slice().sort((x,y)=>y.priorityScore-x.priorityScore);
      const lines=['Raio-x acadêmico completo:'];
      if(a.overall.currentAverage!==null) lines.push(`- Média atual das matérias com notas: ${a.overall.currentAverage.toFixed(1)}.`);
      lines.push(`- Histórico: ${a.overall.passedHistory} aprovação(ões) e ${a.overall.failedHistory} reprovação(ões) registrada(s).`);
      lines.push(`- Matérias com tentativa anterior: ${a.overall.repeatedSubjects}.`);
      ordered.forEach(r=>{ const d=r.difficulty?.label||'média'; const grade=r.grade.hasGrades?`média ${r.grade.currentAverage.toFixed(1)}`:'sem notas'; const exam=r.workload.nextExam?`, avaliação em ${r.workload.nextExam.days} dia(s)`:''; lines.push(`\n**${r.name}** — atenção ${r.riskLevel.toUpperCase()} | dificuldade ${d} | ${grade}${exam}.`); if(r.history.length) lines.push(`  Histórico: ${r.history.map(h=>`${h.period||'?'} ${h.grade==null?'—':h.grade.toFixed(1)}`).join(' → ')}.`); if(r.riskReasons.length) lines.push(`  Fatores: ${r.riskReasons.slice(0,3).join('; ')}.`); });
      if(a.priorities.length) lines.push(`\nPrioridades de ação: ${a.priorities.slice(0,3).map(r=>r.name).join(' → ')}.`);
      return lines.join('\n');
    }

    function delayedAnswer() {
      const o=overdue(); const lines=['O que está mais atrasado:'];
      if(o.tasks.length) o.tasks.slice(0,8).forEach(x=>lines.push(`- Tarefa: ${x.title} — ${x.materia} — ${x.days} dia(s) atrasada.`));
      if(o.reviews.length) o.reviews.slice(0,6).forEach(x=>lines.push(`- Revisão: ${x.title} — ${x.materia} — ${x.days} dia(s) sem revisão.`));
      if(!o.tasks.length&&!o.reviews.length) return 'Não encontrei tarefas vencidas nem tópicos de revisão atrasados nos dados cadastrados.';
      return lines.join('\n');
    }

    function studyNow() {
      const a=ai.analyze(); const list=a.subjects.slice().sort((x,y)=>y.priorityScore-x.priorityScore);
      if(!list.length) return 'Cadastre suas matérias para eu calcular por onde começar.';
      const r=list[0], diff=r.difficulty?.label || 'média';
      const plan=r.workload?.nextExam ? `20 min de revisão + 30 min de exercícios + 10 min corrigindo erros` : r.learning?.weakTopics ? `25 min nos tópicos fracos + 20 min de exercícios` : `25 min de teoria ativa + 25 min de exercícios`;
      return [`Comece por **${r.name}**.`, `Motivo: ${r.riskReasons.slice(0,3).join('; ') || 'maior prioridade calculada no momento'}.`, `Dificuldade atual para você: **${diff}**.`, `Agora: ${plan}.`, r.workload?.nextExam ? `Avaliação: ${r.workload.nextExam.title} em ${r.workload.nextExam.days} dia(s).` : 'Depois, reavalie a prioridade com base no que você conseguir concluir.'].join(' ');
    }

    function weekPlan() {
      const a=ai.analyze(); const subjects=a.subjects.slice().sort((x,y)=>y.priorityScore-x.priorityScore).slice(0,5);
      if(!subjects.length) return 'Cadastre matérias para montar o plano semanal.';
      const user=app.data.user||{}; const daily=Math.max(60,Math.min(480,(Number(user.horasMaximas)||4)*60));
      const names=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']; const out=['Plano semanal adaptativo:'];
      for(let i=0;i<7;i++){
        const d=new Date(); d.setDate(d.getDate()+i); const ranked=subjects.slice().sort((x,y)=>{
          const ex=x.workload.nextExam?.days??99, ey=y.workload.nextExam?.days??99;
          return (y.priorityScore + (ex<=i?25:0))-(x.priorityScore + (ey<=i?25:0));
        });
        const take=ranked.slice(0, i<3?2:3); let remain=daily; const blocks=[];
        take.forEach((r,j)=>{ const m=Math.min(remain,j===0?60:45); if(m>=25){blocks.push(`${r.name} (${m} min)`); remain-=m;} });
        out.push(`\n${names[d.getDay()]} (${d.toLocaleDateString('pt-BR')}): ${blocks.join(' + ') || 'revisão leve/pendências'}.`);
      }
      return out.join('');
    }

    function subjectStatus(name) {
      const r=ai.getSubjectHistory ? ai.subject(subjectByName(name)) : null; if(!r) return null;
      const d=r.difficulty||{}; const hist=r.history.length ? r.history.map(h=>`${h.period||'?'}: ${h.grade==null?'sem nota':h.grade.toFixed(1)}${h.status?' ('+h.status+')':''}`).join(' | ') : 'sem histórico importado';
      const current=r.grade.hasGrades ? `média ${r.grade.currentAverage.toFixed(1)}, peso lançado ${r.grade.weightDone.toFixed(0)}%, precisa ${r.grade.required==null?'—':r.grade.required>10?'>10':r.grade.required.toFixed(1)} nas avaliações restantes` : 'sem notas atuais';
      return [`**${name}**`, `- Dificuldade adaptativa: **${d.label||'média'}** (${d.confidence||0}% de confiança) — ${d.reason||'sem evidência suficiente'}.`, `- Atual: ${current}.`, `- Estudo: ${r.study.totalHours.toFixed(1)}h total; ${r.study.recent7Hours.toFixed(1)}h nos últimos 7 dias.`, `- Histórico: ${hist}.`, `- Presença: ${r.attendance.percentage==null?'sem dados':r.attendance.percentage+'%'}${r.riskReasons.length?'\n- Alertas: '+r.riskReasons.slice(0,4).join('; '):''}`, `- Recomendação: ${r.recommendation}`].join('\n');
    }

    // Expõe a nova dificuldade também no motor acadêmico.
    const oldSubject=ai.subject.bind(ai);
    ai.subject=function(subject){
      const r=oldSubject(subject); const grades=(app.data.grades||[]).filter(g=>n(g.materia)===n(r.name));
      const vals=grades.map(g=>Number(g.valor ?? g.nota ?? g.notaObtida ?? g.notaFinal ?? g.media)).filter(Number.isFinite);
      const avg=r.grade.currentAverage; let value=Number(subject.dificuldade)||3;
      if(vals.length){ if(avg>=8.5)value=1; else if(avg>=7.5)value=2; else if(avg>=6.5)value=3; else if(avg>=5.5)value=4; else value=5; if(r.failedAttempts>0&&avg<8.5)value=Math.max(3,value); if(r.grade.required>8.5)value=Math.max(4,value); }
      const labels={1:'fácil',2:'média-baixa',3:'média',4:'média-alta',5:'difícil'};
      r.difficulty={value,label:labels[value],confidence:vals.length?Math.min(95,35+vals.length*15):0,reason:subject.dificuldadeMotivo|| (vals.length?`média atual ${avg.toFixed(1)}`:'sem notas atuais')};
      return r;
    };

    const oldRisk=app.analyzeAcademicRisk;
    app.analyzeAcademicRisk=function(){ return ai.analyze().subjects.filter(r=>r.priorityScore>=20).map(r=>({materia:r.name,nivel:r.riskLevel,motivo:r.riskReasons.slice(0,4).join('; ')||r.recommendation,score:r.priorityScore,intelligence:r})); };

    const oldAsk=P.ask;
    P.ask=async function(q){
      const p=n(q), words=p.split(/\s+/).filter(Boolean).length;
      if(/risco academico|riscos academicos|meu risco/.test(p)) return riskAnswer();
      if(/raio x|raiox|diagnostico completo|visao geral academica/.test(p)) return rayAnswer();
      if(/o que esta mais atrasado|o que esta atrasado|o que ta atrasado|estou atrasado/.test(p)) return delayedAnswer();
      if(/o que estudar agora|oque estudar agora|por onde eu comeco|por onde comeco|comecar agora/.test(p)) return studyNow();
      if((/plano.*semana|plano semanal/.test(p)) || (p.includes('plano')&&p.includes('semana')&&words<=8)) return weekPlan();
      const m=P._findSubjectInQuestion ? P._findSubjectInQuestion.call(this,q) : null;
      if(m && /como estou|situacao|status|nota|media|dificuldade/.test(p)) return subjectStatus(m.nome);
      return oldAsk.call(this,q);
    };

    if(P.askRich && !P.__askRichV11){
      const oldRich=P.askRich;
      P.askRich=async function(q){
        const p=n(q), m=P._findSubjectInQuestion ? P._findSubjectInQuestion.call(this,q) : null;
        const direct = /risco academico|riscos academicos|meu risco|o que esta mais atrasado|o que esta atrasado|o que ta atrasado|o que estudar agora|oque estudar agora|por onde eu comeco|por onde comeco|comecar agora|plano.*semana|plano semanal|raio x|raiox|diagnostico completo/.test(p) || (m && /como estou|situacao|status|nota|media|dificuldade/.test(p));
        if(direct){ const text=await this.ask(q); this._rememberTurn?.(q,text,{subject:m?.nome||null,intent:'deterministic'}); return {text,actions:[],memory:this.sessionMemory?.slice(-6)||[]}; }
        return oldRich.call(this,q);
      };
      P.__askRichV11=true;
    }
    P.__smartMentorV11=true;
  }

  // Instala depois que o app + AIAssistant existirem.
  const installTimer = setInterval(() => {
    if (window.app && window.academicIntelligence && window.AIAssistant) { clearInterval(installTimer); installSmartMentor(window.app); }
  }, 300);

  engine();
})();
