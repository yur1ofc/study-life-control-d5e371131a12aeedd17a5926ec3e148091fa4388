/* SLCampus v12 — auditoria final e integrações de produto.
 * Este arquivo fica por último para centralizar correções sem reescrever
 * módulos antigos que ainda têm consumidores legados.
 */
(function () {
  'use strict';

  const norm = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const num = v => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
  const daysUntil = value => {
    if (!value) return null;
    const d = new Date(String(value).length === 10 ? `${value}T23:59:59` : value);
    if (Number.isNaN(d.getTime())) return null;
    return Math.ceil((d.getTime() - Date.now()) / 86400000);
  };
  const esc = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  function app() { return window.app; }
  function intelligence() { return app()?.getAcademicIntelligence?.() || null; }

  // ── 1. Respostas determinísticas do Mentor passam a usar o mesmo cérebro ──
  function riskAnswer() {
    const a = intelligence();
    if (!a?.subjects?.length) return 'Ainda não há matérias suficientes cadastradas para calcular os riscos acadêmicos. Cadastre suas matérias, avaliações ou sessões de estudo e eu recalculo automaticamente.';
    const flagged = a.subjects.filter(s => s.priorityScore >= 35 || s.riskLevel !== 'baixo').sort((x,y) => y.priorityScore - x.priorityScore);
    const lines = ['📊 **Riscos acadêmicos atuais**'];
    if (!flagged.length) {
      lines.push('Nenhuma matéria apresenta sinal forte de risco com os dados registrados agora.');
    } else {
      flagged.slice(0, 8).forEach((s, i) => {
        const reasons = s.riskReasons?.slice(0, 3).join('; ') || 'atenção preventiva';
        const diff = s.difficulty?.label || 'sem classificação';
        lines.push(`${i + 1}. **${s.name}** — risco ${String(s.riskLevel).toUpperCase()}, dificuldade percebida ${diff}. ${reasons}.`);
      });
    }
    lines.push('');
    lines.push('O nível é recalculado a partir de notas, avaliações próximas, estudo, frequência, tarefas, revisões e histórico quando esses dados existem.');
    return lines.join('\n');
  }

  function overdueAnswer() {
    const d = app()?.data || {};
    const now = Date.now();
    const overdueTasks = (d.tasks || []).filter(t => !t?.concluida && t?.dataLimite && new Date(`${t.dataLimite}T23:59:59`).getTime() < now)
      .sort((a,b) => new Date(`${a.dataLimite}T23:59:59`) - new Date(`${b.dataLimite}T23:59:59`));
    const overdueReviews = (d.reviews || []).filter(r => !r?.concluida && r?.data && new Date(`${r.data}T23:59:59`).getTime() < now)
      .sort((a,b) => new Date(`${a.data}T23:59:59`) - new Date(`${b.data}T23:59:59`));
    if (!overdueTasks.length && !overdueReviews.length) return '✅ Não encontrei tarefas ou revisões vencidas nos dados registrados. Há pendências futuras? Posso organizar por prazo.';
    const lines = ['⏰ **O que está mais atrasado**'];
    overdueTasks.slice(0, 8).forEach(t => {
      const days = Math.max(1, Math.ceil((now - new Date(`${t.dataLimite}T23:59:59`).getTime()) / 86400000));
      lines.push(`- **${String(t.titulo || 'Tarefa')}**${t.materia ? ` — ${String(t.materia)}` : ''}: ${days} dia(s) atrasada.`);
    });
    overdueReviews.slice(0, 5).forEach(r => {
      const days = Math.max(1, Math.ceil((now - new Date(`${r.data}T23:59:59`).getTime()) / 86400000));
      lines.push(`- **Revisão:** ${String(r.materia || '')}${r.topico ? ` — ${String(r.topico)}` : ''}: ${days} dia(s) atrasada.`);
    });
    lines.push('');
    lines.push('Prioridade prática: feche primeiro o que está mais antigo e depois o que tem prazo mais próximo.');
    return lines.join('\n');
  }

  function studyNowAnswer() {
    const a = intelligence();
    if (!a?.subjects?.length) return 'Cadastre pelo menos uma matéria para eu definir o que estudar agora.';
    const ranked = [...a.subjects].sort((x,y) => {
      const examX = x.workload?.nextExam?.days ?? 999;
      const examY = y.workload?.nextExam?.days ?? 999;
      const scoreX = x.priorityScore + (examX <= 2 ? 18 : examX <= 7 ? 10 : 0);
      const scoreY = y.priorityScore + (examY <= 2 ? 18 : examY <= 7 ? 10 : 0);
      return scoreY - scoreX;
    });
    const s = ranked[0];
    const diff = s.difficulty?.label || 'média';
    const exam = s.workload?.nextExam;
    const lines = [
      '🎯 **O que estudar agora**',
      `Comece por **${s.name}**.`,
      `Dificuldade percebida: **${diff}**${s.difficulty?.confidence ? ` (${s.difficulty.confidence}% de confiança)` : ''}.`
    ];
    if (exam) lines.push(`Próxima avaliação: **${exam.title || 'avaliação'}** em ${Math.max(0, exam.days)} dia(s).`);
    if (s.grade?.hasGrades) {
      lines.push(`Média atual: **${s.grade.currentAverage.toFixed(1)}**${s.grade.required !== null ? `; média necessária nas avaliações restantes: **${s.grade.required > 10 ? '>10' : s.grade.required.toFixed(1)}**.` : '.'}`);
    } else {
      lines.push('Ainda não há notas lançadas nessa matéria; a prioridade vem principalmente de prazo, estudo e outros sinais disponíveis.');
    }
    if (s.riskReasons?.length) lines.push(`Motivo principal: ${s.riskReasons.slice(0,2).join('; ')}.`);
    const action = s.learning?.weakTopics ? `revise os ${s.learning.weakTopics} tópico(s) de baixa confiança e depois resolva exercícios` : exam && exam.days <= 7 ? 'faça revisão ativa + exercícios da avaliação' : 'faça uma sessão de 45–60 min com teoria curta, exercícios e correção dos erros';
    lines.push(`**Agora:** ${action}.`);
    return lines.join('\n');
  }

  function rayXAnswer() {
    const a = intelligence();
    if (!a?.subjects?.length) return 'Seu raio-x ainda está incompleto porque não há matérias cadastradas.';
    const o = a.overall || {};
    const lines = ['📊 **Raio-x acadêmico**', ''];
    lines.push(`Matérias atuais: **${a.subjectCount}**.`);
    lines.push(`Média das matérias com notas: **${o.currentAverage == null ? 'sem notas suficientes' : o.currentAverage.toFixed(1)}**.`);
    lines.push(`Estudo registrado: **${o.studyHours.toFixed(1)}h**.`);
    lines.push(`Histórico: **${o.failedHistory} reprovação(ões)** e **${o.passedHistory} aprovação(ões)** registradas.`);
    lines.push(`Matérias com tentativa anterior: **${o.repeatedSubjects}**.`);
    lines.push('');
    a.subjects.slice().sort((x,y) => y.priorityScore - x.priorityScore).forEach(s => {
      const d = s.difficulty?.label || 'média';
      const hist = s.attempts ? `${s.attempts} tentativa(s), ${s.failedAttempts} reprovação(ões)` : 'sem histórico anterior';
      const grade = s.grade?.hasGrades ? `média ${s.grade.currentAverage.toFixed(1)}` : 'sem notas';
      lines.push(`- **${s.name}** — ${grade}; dificuldade ${d}; ${hist}; prioridade ${s.priorityScore}/100.`);
    });
    lines.push('');
    const top = a.priorities?.slice(0,3) || [];
    if (top.length) lines.push(`Prioridades calculadas agora: ${top.map(s => `**${s.name}**`).join(', ')}.`);
    lines.push('A prioridade é dinâmica e muda conforme entram notas, provas, tarefas, estudo, frequência, revisões e histórico.');
    return lines.join('\n');
  }

  function subjectAnswer(raw) {
    const d = app()?.data || {};
    const names = (d.subjects || []).map(s => s.nome).filter(Boolean);
    const p = norm(raw);
    const found = names.find(n => p.includes(norm(n))) || null;
    if (!found) return null;
    const s = app()?.getAcademicSubjectIntelligence?.(found);
    if (!s) return null;
    const lines = [`📚 **${found}**`];
    lines.push(`Dificuldade percebida: **${s.difficulty?.label || 'média'}**${s.difficulty?.confidence ? ` (${s.difficulty.confidence}% de confiança)` : ''}. ${s.difficulty?.reason || ''}`);
    lines.push(`Média atual: **${s.grade?.hasGrades ? s.grade.currentAverage.toFixed(1) : 'sem notas'}**.`);
    if (s.grade?.required !== null && s.grade?.required !== undefined) lines.push(`Média necessária nas avaliações restantes: **${s.grade.required > 10 ? '>10' : s.grade.required.toFixed(1)}**.`);
    lines.push(`Estudo: **${s.study.totalHours.toFixed(1)}h** no semestre atual; tendência ${s.study.trend}.`);
    lines.push(`Histórico: **${s.attempts} tentativa(s)**, sendo **${s.failedAttempts} reprovação(ões)**${s.previousAttempt ? `; última nota registrada ${s.previousAttempt.grade == null ? 'sem nota' : s.previousAttempt.grade.toFixed(1)}` : ''}.`);
    lines.push(`Frequência: **${s.attendance.percentage == null ? 'sem dados' : `${s.attendance.percentage}%`}**.`);
    lines.push(`Risco atual: **${s.riskLevel}**. ${s.riskReasons?.slice(0,3).join('; ') || 'sem alerta forte'}.`);
    lines.push(`Recomendação: ${s.recommendation}`);
    return lines.join('\n');
  }

  function patchMentor() {
    const A = window.AIAssistant;
    if (!A || !A.prototype || A.prototype.__slcV12MentorPatch) return;
    const proto = A.prototype;
    const original = proto.ask;
    if (typeof original !== 'function') return;
    proto.ask = async function (question) {
      const p = norm(question);
      if (/^(quais? os riscos|quais? meus riscos|risco academico|riscos academicos|como estao os riscos)/.test(p)) {
        const answer = riskAnswer(); this._rememberTurn?.(question, answer, { intent:'risk' }); return answer;
      }
      if (/^(o que esta mais atrasado|o que esta atrasado|o que tenho atrasado|quais? tarefas estao atrasadas|tem algo atrasado)/.test(p)) {
        const answer = overdueAnswer(); this._rememberTurn?.(question, answer, { intent:'overdue' }); return answer;
      }
      if (/^(o que estudar agora|por onde eu comeco|por onde comeco|o que eu estudo agora|o que estudar|o que devo estudar agora)/.test(p)) {
        const answer = studyNowAnswer(); this._rememberTurn?.(question, answer, { intent:'plan' }); return answer;
      }
      if (/raio x|raiox|raio-x|diagnostico completo|resumo geral|visao geral/.test(p)) {
        const answer = rayXAnswer(); this._rememberTurn?.(question, answer, { intent:'diagnostic' }); return answer;
      }
      const subject = subjectAnswer(question);
      if (subject && (/como esta|como estou|situacao|situacao de|dificuldade|nota|desempenho|risco/.test(p))) {
        this._rememberTurn?.(question, subject, { intent:'subject-status' }); return subject;
      }
      return original.call(this, question);
    };
    proto.__slcV12MentorPatch = true;
  }

  // ── 2. Dificuldade adaptativa mais estável e explicável ──────────────────
  function patchDifficulty() {
    const SD = window.SubjectDifficulty;
    if (!SD || SD.__slcV12) return;
    const original = SD.computeDifficulty;
    if (typeof original !== 'function') return;
    SD.computeDifficulty = function(subject, appRef) {
      const a = appRef?.getAcademicSubjectIntelligence?.(subject?.nome) || null;
      const grades = (appRef?.data?.grades || []).filter(g => norm(g?.materia) === norm(subject?.nome));
      const vals = grades.map(g => num(g?.valor ?? g?.nota ?? g?.notaObtida ?? g?.media)).filter(v => v != null && v >= 0 && v <= 10);
      if (!vals.length) return original(subject, appRef);
      const avg = vals.reduce((x,y)=>x+y,0)/vals.length;
      const recent = vals.slice(-2).reduce((x,y)=>x+y,0)/Math.min(2, vals.length);
      const previous = vals.length > 2 ? vals.slice(0,-2).reduce((x,y)=>x+y,0)/(vals.length-2) : null;
      const trend = previous == null ? 0 : recent - previous;
      const fail = Number(a?.failedAttempts || 0);
      const attendance = a?.attendance?.percentage;
      const required = a?.grade?.required;
      const examSoon = a?.workload?.nextExam?.days != null && a.workload.nextExam.days <= 7;
      // Score maior = mais esforço percebido. O histórico entra como contexto,
      // mas notas atuais têm o maior peso para não "condenar" uma matéria para sempre.
      let score = (10 - avg) * 10;
      if (trend <= -1) score += 8;
      if (trend >= 1) score -= 5;
      if (fail) score += Math.min(15, fail * 6);
      if (attendance != null && attendance < 75) score += 8;
      if (required != null && required > 8.5) score += 8;
      if (examSoon && avg < 7) score += 4;
      score = Math.max(0, Math.min(100, score));
      let value = score < 20 ? 1 : score < 35 ? 2 : score < 52 ? 3 : score < 68 ? 4 : 5;
      // Uma nota isolada muito baixa é sinal de atenção, mas não deve transformar
      // a matéria definitivamente em "difícil" sem contexto.
      if (vals.length === 1 && avg <= 4) value = Math.max(value, 4);
      const labels = {1:'fácil',2:'média-baixa',3:'média',4:'média-alta',5:'difícil'};
      const confidence = Math.max(35, Math.min(95, Math.round(35 + vals.length*12 + (fail ? 8 : 0) + (attendance != null ? 5 : 0))));
      let reason = `média atual ${avg.toFixed(1)}`;
      if (trend >= 0.8) reason += `, desempenho em melhora (+${trend.toFixed(1)})`;
      else if (trend <= -0.8) reason += `, desempenho em queda (${trend.toFixed(1)})`;
      if (fail) reason += `, ${fail} reprovação(ões) no histórico`;
      if (attendance != null && attendance < 75) reason += `, frequência registrada de ${attendance}%`;
      return { value, label: labels[value], confidence, source:'automática', reason };
    };
    SD.__slcV12 = true;
    // Recalcula imediatamente quando a aplicação estiver pronta e após alterações.
    document.addEventListener('app-ready', () => setTimeout(() => SD.recalcAll?.(), 350));
  }

  // ── 3. Perfil: a interface deixa de parecer exclusivamente universitária ──
  function patchProfileUI() {
    const appRef = app();
    const perfil = appRef?.data?.user?.perfil || 'faculdade';
    const facultyOnly = perfil === 'faculdade';
    const labels = {
      faculdade: { subjects:'Matérias', schedule:'Grade Horária', curriculum:'Grade Curricular', status:'Situação Acadêmica', prediction:'Previsão de Notas' },
      concurso: { subjects:'Matérias', schedule:'Cronograma', curriculum:'Edital / Conteúdo', status:'Desempenho', prediction:'Metas de Nota' },
      vestibular: { subjects:'Áreas', schedule:'Cronograma', curriculum:'Conteúdos', status:'Desempenho', prediction:'Metas de Nota' },
      ensino_medio: { subjects:'Matérias', schedule:'Grade Horária', curriculum:'Conteúdos', status:'Desempenho', prediction:'Previsão de Notas' },
      geral: { subjects:'Áreas de estudo', schedule:'Agenda', curriculum:'Plano de estudo', status:'Desempenho', prediction:'Metas' }
    }[perfil] || null;
    if (!labels) return;
    const setNav = (view, text) => {
      const el = document.querySelector(`.nav-item[data-view="${view}"] span:not(.badge)`);
      if (el) el.textContent = text;
    };
    setNav('materias', labels.subjects);
    setNav('grade-horaria', labels.schedule);
    setNav('grade-curricular', labels.curriculum);
    setNav('situacao-academica', labels.status);
    setNav('previsao-notas', labels.prediction);
    document.querySelectorAll('#semester-context-switcher, .btn-finalizar-semestre-cta, #btn-finalizar-semestre, #btn-semestres-anteriores').forEach(el => {
      el.style.display = facultyOnly ? '' : 'none';
    });
    document.querySelectorAll('.nav-item[data-view="grade-curricular"], .nav-item[data-view="situacao-academica"]').forEach(el => {
      el.classList.toggle('slc-hide-faculdade-only', !facultyOnly);
    });
    document.querySelectorAll('.nav-item[data-view="previsao-notas"]').forEach(el => {
      el.classList.toggle('slc-hide-faculdade-only', !(facultyOnly || perfil === 'ensino_medio'));
    });
    const setupTitle = document.querySelector('.login-headline');
    if (setupTitle && !facultyOnly) {
      const title = perfil === 'concurso' ? 'Organize sua preparação' : perfil === 'vestibular' ? 'Organize seu vestibular' : perfil === 'ensino_medio' ? 'Organize seus estudos' : 'Organize seus objetivos';
      setupTitle.innerHTML = `${esc(title)}<br><span>de verdade.</span>`;
    }
  }

  function patchConfigSave() { /* O app.js já trata todos os perfis em um único handler. */ }

  function boot() {
    patchMentor();
    patchDifficulty();
    patchConfigSave();
    patchProfileUI();
    document.addEventListener('app-ready', () => setTimeout(() => { patchMentor(); patchDifficulty(); patchConfigSave(); patchProfileUI(); }, 250));
    // Views são re-renderizadas pelo app; app-ready cobre o carregamento inicial
    // e patchProfileUI é barato o suficiente para ser chamado após cada loadView
    // pelo próprio perfil-adaptativo. Não usamos MutationObserver global para
    // evitar ciclos de re-renderização causados pelo próprio patch.
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
