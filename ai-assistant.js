// ai-assistant.js - Mentor IA mais útil, contextual e menos genérico

(function () {
  const safeToDate = (value) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const getTodayDateOnly = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  };

  const dateOnly = (value) => {
    if (typeof window.toDateOnly === 'function') {
      try {
        return window.toDateOnly(value);
      } catch (_) {}
    }
    const date = safeToDate(value);
    if (!date) return null;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  };

  const dateString = (value) => {
    if (typeof window.toDateString === 'function') {
      try {
        return window.toDateString(value);
      } catch (_) {}
    }
    const date = safeToDate(value) || new Date();
    return date.toISOString().slice(0, 10);
  };

  const diffDays = (value) => {
    if (typeof window.diasAte === 'function') {
      try {
        return window.diasAte(value);
      } catch (_) {}
    }
    const date = dateOnly(value);
    if (!date) return Infinity;
    return Math.round((date - getTodayDateOnly()) / 86400000);
  };

  const daysSince = (value) => {
    if (!value) return Infinity;
    const date = safeToDate(value);
    if (!date) return Infinity;
    return Math.floor((Date.now() - date.getTime()) / 86400000);
  };

  const weightedAverage = (items = []) => {
    if (typeof window.calcularMediaPonderada === 'function') {
      try {
        return window.calcularMediaPonderada(items);
      } catch (_) {}
    }
    const valid = items
      .map(item => ({
        nota: Number(item?.nota ?? item?.notaObtida ?? item?.valor),
        peso: Number(item?.peso ?? 1)
      }))
      .filter(item => Number.isFinite(item.nota) && Number.isFinite(item.peso) && item.peso > 0);

    if (!valid.length) return 0;
    const totalPeso = valid.reduce((acc, item) => acc + item.peso, 0);
    const total = valid.reduce((acc, item) => acc + (item.nota * item.peso), 0);
    return totalPeso ? total / totalPeso : 0;
  };

  const formatDate = (value) => {
    const date = safeToDate(value);
    if (!date) return 'data indefinida';
    return date.toLocaleDateString('pt-BR');
  };

  const formatWeekdayDate = (value) => {
    const date = safeToDate(value);
    if (!date) return 'data indefinida';
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit'
    });
  };

  const formatHours = (minutes) => `${(Math.round((minutes / 60) * 10) / 10).toFixed(1)}h`;

  class AIAssistant {
    constructor() {
      this.context = {};
      this.lastPlans = [];
      this.lastReasoningSnapshot = '';
      this.defaultFocusMinutes = 45;
    }

    updateContext(data) {
      this.context = {
        user: data?.user || null,
        subjects: Array.isArray(data?.subjects) ? data.subjects : [],
        sessions: Array.isArray(data?.sessions) ? data.sessions : [],
        tasks: Array.isArray(data?.tasks) ? data.tasks : [],
        exams: Array.isArray(data?.exams) ? data.exams : [],
        grades: Array.isArray(data?.grades) ? data.grades : [],
        learningMap: Array.isArray(data?.learningMap) ? data.learningMap : [],
        classSchedule: Array.isArray(data?.classSchedule) ? data.classSchedule : [],
        dailyLogs: Array.isArray(data?.dailyLogs) ? data.dailyLogs : [],
        classDiaries: Array.isArray(data?.classDiaries) ? data.classDiaries : [],
        reviews: Array.isArray(data?.reviews) ? data.reviews : [],
        attendance: data?.attendance || {}
      };
    }

    getProximasProvas(dias = 30) {
      const hoje = getTodayDateOnly();
      return (this.context.exams || [])
        .filter(item => {
          const data = dateOnly(item?.data);
          return data && data >= hoje && diffDays(data) <= dias && !item?.concluida;
        })
        .sort((a, b) => new Date(a.data) - new Date(b.data));
    }

    getRevisoesPendentes() {
      const hoje = dateString();
      return (this.context.reviews || [])
        .filter(item => (item?.data === hoje || dateString(item?.data) === hoje) && !item?.concluida);
    }

    getHorasEstudadasMateria(materiaNome) {
      return ((this.context.sessions || [])
        .filter(s => s?.materia === materiaNome && (s?.concluida || s?.status === 'concluida'))
        .reduce((acc, s) => acc + (Number(s?.duracao) || 0), 0)) / 60;
    }

    getMinutosEstudadosUltimosDias(materiaNome, dias = 7) {
      const now = Date.now();
      return (this.context.sessions || [])
        .filter(s => s?.materia === materiaNome && (s?.concluida || s?.status === 'concluida'))
        .filter(s => {
          const data = safeToDate(s?.data);
          return data && (now - data.getTime()) <= dias * 86400000;
        })
        .reduce((acc, s) => acc + (Number(s?.duracao) || 0), 0);
    }

    getUltimaAulaRegistrada(materiaNome) {
      return (this.context.classDiaries || [])
        .filter(item => item?.materia === materiaNome)
        .sort((a, b) => new Date(b.data) - new Date(a.data))[0] || null;
    }

    getFaltasMateria(materiaNome) {
      let faltas = 0;
      Object.entries(this.context.attendance || {}).forEach(([key, status]) => {
        if (!key.includes('_') || status !== 'absent') return;
        const aulaId = key.split('_')[0];
        const aula = (this.context.classSchedule || []).find(item => item?.id === aulaId);
        if (aula?.materia === materiaNome) faltas += 1;
      });
      return faltas;
    }

    getProximaAulaInfo() {
      if (window.scheduleManager?.getProximaAula) {
        const aula = window.scheduleManager.getProximaAula();
        if (aula) {
          return [
            `Próxima aula: ${aula.materia}.`,
            `Horário: ${aula.inicio} até ${aula.fim}.`,
            aula.sala ? `Sala: ${aula.sala}.` : '',
            aula.professor ? `Professor: ${aula.professor}.` : '',
            'Se tiver tempo antes, vale revisar o último conteúdo ou separar os materiais agora.'
          ].filter(Boolean).join(' ');
        }
      }

      const agora = new Date();
      const diaAtual = agora.getDay();
      const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
      const aulas = (this.context.classSchedule || [])
        .map(item => ({
          ...item,
          dia: Number(item?.dia),
          minutosInicio: this._timeToMinutes(item?.inicio)
        }))
        .filter(item => Number.isFinite(item.minutosInicio))
        .sort((a, b) => (a.dia - b.dia) || (a.minutosInicio - b.minutosInicio));

      if (!aulas.length) return 'Você ainda não cadastrou aulas na grade horária.';

      for (let offset = 0; offset < 7; offset += 1) {
        const dia = (diaAtual + offset) % 7;
        const candidatas = aulas.filter(item => item.dia === dia);
        const aula = candidatas.find(item => offset > 0 || item.minutosInicio >= minutosAgora);
        if (aula) {
          return `Próxima aula: ${aula.materia} em ${this._weekdayName(dia)}, ${aula.inicio}-${aula.fim}${aula.sala ? `, sala ${aula.sala}` : ''}.`;
        }
      }

      return 'Não encontrei a próxima aula na sua grade.';
    }

    getDicaEstudo() {
      const materiaCritica = this._getMatterPriorityList()[0];
      if (!materiaCritica) {
        return 'Cadastre matérias, tarefas, provas ou sessões para eu conseguir te dar uma dica mais precisa.';
      }

      const dicas = [
        `Hoje a melhor jogada é começar por ${materiaCritica.nome}. Ela está no topo porque ${materiaCritica.justificativaCurta.toLowerCase()}.`,
        `Para ${materiaCritica.nome}, faça 20 min de revisão + 25 min de exercício. Isso costuma render mais do que ficar só lendo.`,
        materiaCritica.provaProxima
          ? `Como existe avaliação próxima em ${materiaCritica.nome}, foque em resolver questões do conteúdo que mais cai e revisar erros no final.`
          : `Como ${materiaCritica.nome} está pedindo atenção, tente fechar 1 tópico específico hoje em vez de estudar tudo de forma solta.`
      ];

      return dicas.join(' ');
    }

    listarProvas() {
      const provas = this.getProximasProvas(30);
      if (!provas.length) return 'Você não tem provas ou trabalhos próximos cadastrados nos próximos 30 dias.';
      return [
        'Próximas provas e trabalhos:',
        ...provas.slice(0, 6).map(item => `- ${item.titulo} (${item.materia}) em ${formatDate(item.data)}${item.tipo ? ` • ${item.tipo}` : ''} • faltam ${diffDays(item.data)} dia(s)`)
      ].join('\n');
    }

    listarRevisoes() {
      const revisoes = this.getRevisoesPendentes();
      if (!revisoes.length) return 'Nenhuma revisão pendente para hoje.';
      return [
        'Revisões para hoje:',
        ...revisoes.map(item => `- ${item.materia}: ${item.topico || 'revisão geral'}`)
      ].join('\n');
    }

    sugerirMateriasDificeis() {
      const prioridades = this._getMatterPriorityList();
      if (!prioridades.length) return 'Ainda não tenho dados suficientes para apontar matérias mais críticas.';
      return [
        'Matérias que mais merecem atenção agora:',
        ...prioridades.slice(0, 4).map((item, index) => `${index + 1}. ${item.nome} — ${item.justificativaCurta}.`)
      ].join('\n');
    }

    preverDificuldadeMateria(materiaNome) {
      const subject = (this.context.subjects || []).find(item => item?.nome === materiaNome);
      if (!subject) return `Não encontrei a matéria ${materiaNome}.`;

      const horas = this.getHorasEstudadasMateria(materiaNome);
      const notas = (this.context.grades || []).filter(item => item?.materia === materiaNome);
      const media = weightedAverage(notas);
      const ultimaAula = this.getUltimaAulaRegistrada(materiaNome);
      const faltas = this.getFaltasMateria(materiaNome);

      let nivel = 'média';
      if ((Number(subject?.dificuldade) || 3) >= 4 || media < 6 || horas < 3 || faltas >= 2) nivel = 'alta';
      if ((Number(subject?.dificuldade) || 3) <= 2 && media >= 7 && horas >= 5 && faltas === 0) nivel = 'baixa';

      return [
        `Previsão para ${materiaNome}: dificuldade ${nivel}.`,
        `Você tem ${horas.toFixed(1)}h estudadas no total${notas.length ? ` e média ${media.toFixed(1)}` : ''}.`,
        faltas ? `Há ${faltas} falta(s) registradas.` : 'Sem faltas registradas.',
        ultimaAula?.conteudo ? `Último conteúdo anotado: ${ultimaAula.conteudo}.` : ''
      ].filter(Boolean).join(' ');
    }

    analisarRiscoAcademico() {
      const prioridades = this._getMatterPriorityList();
      const riscos = [];
      const urgencias = [];

      this.getProximasProvas(14).forEach(prova => {
        const horas = this.getHorasEstudadasMateria(prova.materia);
        if (horas < 3) {
          urgencias.push(`${prova.materia}: prova/trabalho em ${diffDays(prova.data)} dia(s) e só ${horas.toFixed(1)}h estudadas.`);
        } else if (horas < 6) {
          urgencias.push(`${prova.materia}: avaliação próxima e preparação ainda média.`);
        }
      });

      (this.context.subjects || []).forEach(subject => {
        const notas = (this.context.grades || []).filter(item => item?.materia === subject.nome);
        if (!notas.length) return;
        const media = weightedAverage(notas);
        if (media < 6) riscos.push(`${subject.nome}: média ${media.toFixed(1)}.`);
        else if (media < 7) riscos.push(`${subject.nome}: média ${media.toFixed(1)} ainda pede margem de segurança.`);
      });

      (this.context.learningMap || []).forEach(topico => {
        if ((topico?.status === 'estudando' || topico?.status === 'revisando') && daysSince(topico?.ultimaRevisao) > 7) {
          riscos.push(`${topico.materia}: tópico "${topico.topico || topico.nome || 'sem nome'}" sem revisão recente.`);
        }
      });

      const cabecalho = prioridades[0]
        ? `Maior ponto de atenção agora: ${prioridades[0].nome}.`
        : 'Ainda faltam dados para uma análise profunda de risco.';

      return [
        cabecalho,
        urgencias.length ? `Urgências: ${urgencias.join(' ')}` : 'Urgências imediatas: nenhuma crítica encontrada.',
        riscos.length ? `Sinais de risco: ${riscos.join(' ')}` : 'Sinais de risco: nenhum alerta forte encontrado.',
        prioridades.length
          ? `Prioridade prática de ação: foque primeiro em ${prioridades.slice(0, 2).map(item => item.nome).join(' e ')}.`
          : ''
      ].filter(Boolean).join('\n\n');
    }

    sugerirEstudoAgora() {
      const prioridades = this._getMatterPriorityList();
      if (!prioridades.length) {
        return 'Ainda não tenho dados suficientes. Cadastre matérias, provas, tarefas ou sessões concluídas para eu sugerir algo realmente útil.';
      }

      const melhor = prioridades[0];
      const partes = [
        `Agora, eu começaria por ${melhor.nome}.`,
        `Motivo: ${melhor.justificativaCurta}.`,
        `Plano rápido: ${melhor.planoRapido}.`
      ];

      if (melhor.provaProxima) {
        partes.push(`Atenção extra: existe uma avaliação próxima em ${formatDate(melhor.provaProxima.data)}.`);
      }

      if (melhor.ultimaAula?.conteudo) {
        partes.push(`Gancho da última aula: ${melhor.ultimaAula.conteudo}.`);
      }

      return partes.join(' ');
    }

    gerarPlanoHoje() {
      const prioridades = this._getMatterPriorityList();
      if (!prioridades.length) {
        return 'Cadastre mais dados para eu montar um plano de hoje mais certeiro.';
      }

      const user = this.context.user || {};
      const horasMaximas = Math.max(2, Math.min(6, Number(user.horasMaximas) || 4));
      const deslocamento = Math.max(0, Number(user.tempoDeslocamento) || 0);
      // O tempo de deslocamento cadastrado na rotina consome parte das horas
      // disponíveis do dia — sem isso o plano prometia mais estudo do que a
      // pessoa realmente teria tempo de fazer.
      let minutosDisponiveis = Math.max(25, (horasMaximas * 60) - deslocamento);

      const diasMap = { 0: 'dom', 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sab' };
      const diaHoje = diasMap[new Date().getDay()];
      const diasPreferidos = Array.isArray(user.diasPreferidos) && user.diasPreferidos.length ? user.diasPreferidos : null;
      const foraDaRotina = diasPreferidos && !diasPreferidos.includes(diaHoje);

      const blocos = [];

      prioridades.slice(0, 4).forEach((item, index) => {
        if (minutosDisponiveis < 25) return;
        const duracao = index === 0 ? 60 : index === 1 ? 45 : 35;
        const minutos = Math.min(duracao, minutosDisponiveis);
        blocos.push({
          materia: item.nome,
          tipo: item.tipoSugestao,
          duracao: minutos,
          motivo: item.justificativaCurta
        });
        minutosDisponiveis -= minutos;
      });

      this.lastPlans = blocos;
      this.lastReasoningSnapshot = prioridades.map(item => `${item.nome}: ${item.justificativaCurta}`).join(' | ');

      const cabecalho = ['Plano de estudo para hoje:'];
      if (foraDaRotina) {
        cabecalho.push(`(Hoje não é um dos dias que você marcou como rotina de estudo na sua Rotina — se puder, deixe algo mais leve.)`);
      }

      return [
        ...cabecalho,
        ...blocos.map((bloco, index) =>
          `- ${bloco.materia} — ${this._labelForStudyType(bloco.tipo)} (${bloco.duracao} min). Motivo: ${bloco.motivo}.`
        ),
        '',
        deslocamento > 0
          ? `Considerei ${deslocamento} min de deslocamento (da sua Rotina) e ${horasMaximas}h de disponibilidade máxima por dia.`
          : `Considerei ${horasMaximas}h de disponibilidade máxima por dia (configurado na sua Rotina).`,
        'Ordem sugerida: comece pela maior urgência, faça uma pausa curta entre blocos e termine revisando erros/anotações.'
      ].join('\n');
    }

    gerarPlanoSemanal() {
      const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      const prioridades = this._getMatterPriorityList();
      if (!prioridades.length) return 'Cadastre mais dados para eu gerar um plano semanal realmente útil.';

      const materias = prioridades.slice(0, 5);
      let cursor = 0;
      const linhas = ['Plano da semana:'];

      for (let i = 0; i < 7; i += 1) {
        const data = new Date();
        data.setDate(data.getDate() + i);
        const diaSemana = data.getDay();
        const aulas = (this.context.classSchedule || []).filter(a => Number(a?.dia) === diaSemana);
        const materia = materias[cursor % materias.length];
        cursor += 1;

        linhas.push(`\n${dias[diaSemana]} (${formatDate(data)})`);
        if (aulas.length) {
          linhas.push(`Aulas: ${aulas.map(a => `${a.materia} ${a.inicio}-${a.fim}`).join(' | ')}`);
        }
        linhas.push(`Estudo principal: ${materia.nome} • ${this._labelForStudyType(materia.tipoSugestao)} • ${materia.duracaoBase} min.`);
        linhas.push(`Foco do dia: ${materia.metaSemanal}.`);
      }

      return linhas.join('\n');
    }

    generateDailyPlan() {
      const prioridades = this._getMatterPriorityList();
      if (!prioridades.length) return [];
      return prioridades.slice(0, 4).map(item => ({
        materia: item.nome,
        tipo: item.tipoSugestao,
        duracao: item.duracaoBase,
        motivo: item.justificativaCurta
      }));
    }

    async ask(pergunta) {
      const texto = String(pergunta || '').trim();
      const p = texto.toLowerCase();

      if (!texto) {
        return 'Manda uma pergunta que eu respondo com base nos seus dados reais do site.';
      }

      const materiaEncontrada = this._findSubjectInQuestion(texto);

      if (p.includes('o que devo estudar agora') || p.includes('oque estudar agora') || p.includes('o que estudar')) {
        return this.sugerirEstudoAgora();
      }

      if (p.includes('risco acadêmico') || p.includes('risco academico') || p.includes('como está meu risco') || p.includes('como esta meu risco')) {
        return this.analisarRiscoAcademico();
      }

      if (p.includes('plano de estudo para hoje') || p.includes('plano para hoje') || p.includes('hoje eu estudo o que')) {
        return this.gerarPlanoHoje();
      }

      if (p.includes('plano para a semana') || p.includes('plano semanal') || p.includes('semana')) {
        return this.gerarPlanoSemanal();
      }

      if (p.includes('próximas provas') || p.includes('proximas provas') || p.includes('provas') || p.includes('trabalhos')) {
        return this.listarProvas();
      }

      if (p.includes('revisão') || p.includes('revisao') || p.includes('revisões') || p.includes('revisoes')) {
        return this.listarRevisoes();
      }

      if (p.includes('próxima aula') || p.includes('proxima aula')) {
        return this.getProximaAulaInfo();
      }

      if (p.includes('dica de estudo') || p.includes('me dá uma dica') || p.includes('me de uma dica')) {
        return this.getDicaEstudo();
      }

      if ((p.includes('dificuldade') || p.includes('matéria difícil') || p.includes('materia dificil')) && materiaEncontrada) {
        return this.preverDificuldadeMateria(materiaEncontrada.nome);
      }

      if (materiaEncontrada && (p.includes('como estou') || p.includes('como tá') || p.includes('como ta') || p.includes('situação') || p.includes('situacao'))) {
        return this._buildSubjectStatusAnswer(materiaEncontrada.nome);
      }

      if (materiaEncontrada && (p.includes('quanto estudei') || p.includes('horas') || p.includes('estudei'))) {
        const horas = this.getHorasEstudadasMateria(materiaEncontrada.nome);
        return `Você estudou ${horas.toFixed(1)}h de ${materiaEncontrada.nome} no total.${horas < 3 ? ' Ainda está pouco para ter folga na matéria.' : ''}`;
      }

      return [
        'Posso responder com base nos seus dados reais.',
        'Perguntas que funcionam muito bem:',
        '- qual meu plano de hoje?',
        '- quais os riscos acadêmicos?',
        '- próximas provas?',
        '- qual a próxima aula?',
        '- como estou em [nome da matéria]?'
      ].join('\n');
    }

    _buildSubjectStatusAnswer(materiaNome) {
      const subject = (this.context.subjects || []).find(item => item?.nome === materiaNome);
      if (!subject) return `Não achei a matéria ${materiaNome}.`;

      const horas = this.getHorasEstudadasMateria(materiaNome);
      const minutos7d = this.getMinutosEstudadosUltimosDias(materiaNome, 7);
      const notas = (this.context.grades || []).filter(item => item?.materia === materiaNome);
      const media = weightedAverage(notas);
      const prova = this.getProximasProvas(21).find(item => item?.materia === materiaNome);
      const faltas = this.getFaltasMateria(materiaNome);
      const ultimaAula = this.getUltimaAulaRegistrada(materiaNome);

      const partes = [
        `Status de ${materiaNome}:`,
        `- dificuldade cadastrada: ${Number(subject?.dificuldade) || 3}/5`,
        `- horas estudadas no total: ${horas.toFixed(1)}h`,
        `- estudo nos últimos 7 dias: ${formatHours(minutos7d)}`,
      ];

      if (notas.length) partes.push(`- média atual: ${media.toFixed(1)}`);
      if (prova) partes.push(`- próxima avaliação: ${formatDate(prova.data)} (${diffDays(prova.data)} dia(s))`);
      if (faltas) partes.push(`- faltas registradas: ${faltas}`);
      if (ultimaAula?.conteudo) partes.push(`- último conteúdo anotado: ${ultimaAula.conteudo}`);

      let conclusao = 'Situação controlada.';
      if (prova && diffDays(prova.data) <= 7 && horas < 4) conclusao = 'Situação de atenção: avaliação próxima e pouca carga de estudo.';
      else if (notas.length && media < 6) conclusao = 'Situação de risco: média baixa.';
      else if ((Number(subject?.dificuldade) || 3) >= 4 && minutos7d < 90) conclusao = 'Situação de atenção: matéria difícil com pouco estudo recente.';

      partes.push(`- leitura do mentor: ${conclusao}`);
      return partes.join('\n');
    }

    _getMatterPriorityList() {
      const subjects = this.context.subjects || [];
      const provas = this.getProximasProvas(21);
      const revisoesHoje = this.getRevisoesPendentes();
      const tarefas = (this.context.tasks || []).filter(item => !item?.concluida);
      const topicos = this.context.learningMap || [];

      const list = subjects.map(subject => {
        const nome = subject?.nome;
        const horasTotal = this.getHorasEstudadasMateria(nome);
        const minutos7d = this.getMinutosEstudadosUltimosDias(nome, 7);
        const notas = (this.context.grades || []).filter(item => item?.materia === nome);
        const media = weightedAverage(notas);
        const provaProxima = provas.find(item => item?.materia === nome);
        const revisoes = revisoesHoje.filter(item => item?.materia === nome);
        const tarefasPendentes = tarefas.filter(item => item?.materia === nome);
        const topicosAtrasados = topicos.filter(item => item?.materia === nome && (item?.status === 'estudando' || item?.status === 'revisando') && daysSince(item?.ultimaRevisao) > 7);
        const faltas = this.getFaltasMateria(nome);
        const ultimaAula = this.getUltimaAulaRegistrada(nome);

        let score = 0;
        const motivos = [];

        const dificuldade = Number(subject?.dificuldade) || 3;
        score += dificuldade * 5;
        if (dificuldade >= 4) motivos.push('é uma matéria difícil para você');

        if (provaProxima) {
          const dias = Math.max(0, diffDays(provaProxima.data));
          const pesoUrgencia = Math.max(0, 24 - dias);
          score += pesoUrgencia * 4;
          motivos.push(`tem avaliação em ${dias} dia(s)`);
        }

        if (tarefasPendentes.length) {
          score += tarefasPendentes.length * 8;
          motivos.push(`tem ${tarefasPendentes.length} tarefa(s) pendente(s)`);
        }

        if (revisoes.length) {
          score += revisoes.length * 10;
          motivos.push(`tem revisão pendente hoje`);
        }

        if (topicosAtrasados.length) {
          score += topicosAtrasados.length * 7;
          motivos.push(`há tópico(s) sem revisão recente`);
        }

        if (horasTotal < 3) {
          score += 14;
          motivos.push(`você ainda estudou pouco essa matéria`);
        } else if (horasTotal < 6) {
          score += 7;
        }

        if (minutos7d < 90) {
          score += 10;
          motivos.push(`o estudo recente está baixo`);
        }

        if (notas.length) {
          if (media < 6) {
            score += 18;
            motivos.push(`a média está baixa`);
          } else if (media < 7) {
            score += 8;
            motivos.push(`a média ainda não está confortável`);
          }
        }

        if (faltas > 0) {
          score += faltas * 4;
          motivos.push(`${faltas} falta(s) registrada(s)`);
        }

        const justificativaCurta = motivos.length
          ? motivos.slice(0, 3).join(', ')
          : 'está equilibrada, mas ainda vale manter constância';

        const tipoSugestao = provaProxima ? 'exercicios' : revisoes.length ? 'revisao' : topicosAtrasados.length ? 'revisao' : 'teoria';
        const duracaoBase = provaProxima ? 60 : dificuldade >= 4 ? 50 : 40;
        const metaSemanal = provaProxima
          ? 'priorize exercícios e correção de erros'
          : tarefasPendentes.length
            ? 'avance nas pendências e feche um conteúdo'
            : 'ganhe constância com teoria + exercícios curtos';

        const planoRapido = provaProxima
          ? '15 min de revisão + 35 min de exercícios + 10 min corrigindo erros'
          : revisoes.length
            ? '20 min revisando anotações + 25 min testando memória ativa'
            : '25 min de teoria prática + 20 min de exercício ou resumo';

        return {
          nome,
          score,
          justificativaCurta: justificativaCurta.charAt(0).toUpperCase() + justificativaCurta.slice(1),
          tipoSugestao,
          duracaoBase,
          metaSemanal,
          planoRapido,
          provaProxima,
          ultimaAula
        };
      });

      return list.sort((a, b) => b.score - a.score);
    }

    _findSubjectInQuestion(question) {
      const normalized = String(question || '').toLowerCase();
      return (this.context.subjects || [])
        .find(item => normalized.includes(String(item?.nome || '').toLowerCase()));
    }

    _timeToMinutes(value) {
      if (!value || !String(value).includes(':')) return NaN;
      const [h, m] = String(value).split(':').map(Number);
      if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
      return h * 60 + m;
    }

    _weekdayName(index) {
      return ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][index] || 'dia indefinido';
    }

    _labelForStudyType(type) {
      if (type === 'revisao') return 'revisão';
      if (type === 'exercicios') return 'exercícios';
      if (type === 'pratica') return 'prática';
      return 'teoria';
    }
  }

  window.AIAssistant = AIAssistant;
  window.aiAssistant = new AIAssistant();
})();


// __mentor_upgrade_v4__
(function () {
  if (!window.AIAssistant || window.AIAssistant.prototype.__mentorUpgradePatched) return;

  const safeToDate = (value) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const getTodayDateOnly = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  };

  const diffDays = (value) => {
    if (typeof window.diasAte === 'function') {
      try {
        return window.diasAte(value);
      } catch (_) {}
    }
    const date = safeToDate(value);
    if (!date) return Infinity;
    const only = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return Math.round((only - getTodayDateOnly()) / 86400000);
  };

  const daysSince = (value) => {
    if (!value) return Infinity;
    const date = safeToDate(value);
    if (!date) return Infinity;
    return Math.floor((Date.now() - date.getTime()) / 86400000);
  };

  const weightedAverage = (items = []) => {
    if (typeof window.calcularMediaPonderada === 'function') {
      try {
        return window.calcularMediaPonderada(items);
      } catch (_) {}
    }
    const valid = items
      .map(item => ({
        nota: Number(item?.nota ?? item?.notaObtida ?? item?.valor),
        peso: Number(item?.peso ?? 1)
      }))
      .filter(item => Number.isFinite(item.nota) && Number.isFinite(item.peso) && item.peso > 0);

    if (!valid.length) return 0;
    const totalPeso = valid.reduce((acc, item) => acc + item.peso, 0);
    const total = valid.reduce((acc, item) => acc + (item.nota * item.peso), 0);
    return totalPeso ? total / totalPeso : 0;
  };

  const proto = window.AIAssistant.prototype;

  proto.getMemorySnapshot = function () {
    const weak = this._getMatterPriorityList().slice(0, 3).map(item => item.nome);
    const exams = this.getProximasProvas(10).slice(0, 3).map(item => `${item.materia} (${diffDays(item.data)}d)`);
    const reviews = this.getRevisoesPendentes().slice(0, 3).map(item => item.materia);
    return { weak, exams, reviews };
  };

  proto.generateDailyPlan = function () {
    const prioridades = this._getMatterPriorityList();
    if (!prioridades.length) return [];
    const userHours = Math.max(2, Math.min(8, Number(this.context.user?.horasMaximas) || 4));
    let remaining = userHours * 60;
    return prioridades.slice(0, 5).map((item, index) => {
      const base = item.provaProxima ? 60 : item.revisoesPendentes ? 35 : index === 0 ? 50 : 40;
      const duracao = Math.max(25, Math.min(base, remaining));
      remaining -= duracao;
      return {
        materia: item.nome,
        tipo: item.tipoSugestao,
        duracao,
        prioridade: item.score >= 80 ? 'danger' : item.score >= 55 ? 'warning' : 'success',
        motivo: `${item.justificativaCurta}${item.provaProxima ? ` • avaliação em ${diffDays(item.provaProxima.data)} dia(s)` : ''}`
      };
    }).filter(item => item.duracao > 0);
  };

  proto._getMatterPriorityList = function () {
    const subjects = this.context.subjects || [];
    const provas = this.getProximasProvas(21);
    const revisoesHoje = this.getRevisoesPendentes();
    const tarefas = (this.context.tasks || []).filter(item => !item?.concluida);
    const topicos = this.context.learningMap || [];

    return subjects.map(subject => {
      const nome = subject?.nome;
      const horasTotal = this.getHorasEstudadasMateria(nome);
      const minutos7d = this.getMinutosEstudadosUltimosDias(nome, 7);
      const notas = (this.context.grades || []).filter(item => item?.materia === nome);
      const media = weightedAverage(notas);
      const provaProxima = provas.find(item => item?.materia === nome);
      const revisoes = revisoesHoje.filter(item => item?.materia === nome);
      const tarefasPendentes = tarefas.filter(item => item?.materia === nome);
      const topicosAtrasados = topicos.filter(item => item?.materia === nome && (item?.status === 'estudando' || item?.status === 'revisando') && daysSince(item?.ultimaRevisao) > 7);
      const faltas = this.getFaltasMateria(nome);
      const ultimaAula = this.getUltimaAulaRegistrada(nome);
      const attendance = (this.context.classDiaries || []).filter(item => item?.materia === nome);
      const taxaPresenca = attendance.length ? Math.round((attendance.filter(item => item?.presenca === 'present').length / attendance.length) * 100) : 100;

      let score = 0;
      const motivos = [];
      const dificuldade = Number(subject?.dificuldade) || 3;
      score += dificuldade * 5;
      if (dificuldade >= 4) motivos.push('é uma matéria difícil para você');

      if (provaProxima) {
        const dias = Math.max(0, diffDays(provaProxima.data));
        score += Math.max(0, 26 - dias) * 4;
        motivos.push(`tem avaliação em ${dias} dia(s)`);
      }
      if (tarefasPendentes.length) {
        score += tarefasPendentes.length * 8;
        motivos.push(`tem ${tarefasPendentes.length} tarefa(s) pendente(s)`);
      }
      if (revisoes.length) {
        score += revisoes.length * 11;
        motivos.push('tem revisão pendente hoje');
      }
      if (topicosAtrasados.length) {
        score += topicosAtrasados.length * 7;
        motivos.push('há tópico sem revisão recente');
      }
      if (horasTotal < 3) {
        score += 16;
        motivos.push('você estudou pouco essa matéria');
      } else if (horasTotal < 6) {
        score += 7;
      }
      if (minutos7d < 90) {
        score += 11;
        motivos.push('o estudo recente está baixo');
      }
      if (notas.length) {
        if (media < 6) {
          score += 18;
          motivos.push('a média está baixa');
        } else if (media < 7) {
          score += 8;
          motivos.push('a média ainda não está confortável');
        }
      }
      if (faltas > 0 || taxaPresenca < 80) {
        score += Math.max(faltas * 4, taxaPresenca < 80 ? 10 : 0);
        motivos.push(`presença em ${taxaPresenca}% das aulas`);
      }

      const tipoSugestao = provaProxima ? 'exercicios' : revisoes.length || topicosAtrasados.length ? 'revisao' : 'teoria';
      const duracaoBase = provaProxima ? 60 : dificuldade >= 4 ? 50 : 40;
      const metaSemanal = provaProxima ? 'priorize exercícios e correção de erros' : tarefasPendentes.length ? 'feche pendências e avance um conteúdo' : 'ganhe constância com teoria e prática';
      const justificativaCurta = motivos.length ? motivos.slice(0, 3).join(', ') : 'está equilibrada, mas vale manter constância';

      return {
        nome,
        score,
        justificativaCurta: justificativaCurta.charAt(0).toUpperCase() + justificativaCurta.slice(1),
        tipoSugestao,
        duracaoBase,
        metaSemanal,
        provaProxima,
        ultimaAula,
        revisoesPendentes: revisoes.length,
        tarefasPendentes: tarefasPendentes.length,
        attendance: taxaPresenca,
        media: Number.isFinite(media) ? media : 0,
        planoRapido: provaProxima ? '15 min de revisão + 35 min de exercícios + 10 min corrigindo erros' : revisoes.length ? '20 min revisando anotações + 25 min de memória ativa' : '25 min teoria prática + 20 min exercícios'
      };
    }).sort((a, b) => b.score - a.score);
  };

  const originalAsk = proto.ask;
  proto.ask = async function (pergunta) {
    const texto = String(pergunta || '').trim();
    const p = texto.toLowerCase();
    const materia = this._findSubjectInQuestion(texto);
    const memory = this.getMemorySnapshot();

    if (p.includes('recuperação') || p.includes('recuperacao') || p.includes('anti procrast') || p.includes('procrast')) {
      const plano = window.app?.getRecoveryPlan?.(3);
      if (!plano) return 'Ainda não vi sinais fortes de acúmulo. Continue mantendo constância.';
      return [
        `Modo recuperação: ${plano.reason}.`,
        ...plano.days.map((item, index) => `${index + 1}. ${item.date} — foco em ${item.focus}: ${item.action}. Extra: ${item.extra}.`)
      ].join('\n');
    }

    if (p.includes('meta') || p.includes('metas')) {
      const goals = window.app?.getStudyGoalsSnapshot?.();
      if (!goals) return 'Cadastre mais dados para eu acompanhar suas metas.';
      return `Metas atuais: ${goals.weeklyHours.toFixed(1)}h/${goals.goals.weeklyHours}h na semana, ${goals.monthlyHours.toFixed(1)}h/${goals.goals.monthlyHours}h no mês, ${goals.weeklyPomodoros}/${goals.goals.weeklyPomodoros} pomodoros e ${goals.weeklyReviewsDone}/${goals.goals.weeklyReviews} revisões.`;
    }

    if (p.includes('relatório') || p.includes('relatorio') || p.includes('resumo da semana')) {
      const report = window.app?.getAutoReports?.();
      if (!report) return 'Ainda faltam dados para um relatório confiável.';
      return `${report.daily}

${report.weekly}

${report.monthly}`;
    }

    if (materia && (p.includes('próxima nota') || p.includes('proxima nota') || p.includes('quanto preciso'))) {
      const perf = window.app?.getSubjectPerformance?.(materia.nome);
      if (!perf) return `Não encontrei dados suficientes de ${materia.nome}.`;
      return `Para ${materia.nome}, sua média atual está em ${perf.average.toFixed(1)}. Para buscar a meta desejada, a próxima nota ideal seria perto de ${perf.nextRequiredGrade}. ${perf.recommendation}`;
    }

    if (materia && (p.includes('como estou') || p.includes('situação') || p.includes('situacao'))) {
      const perf = window.app?.getSubjectPerformance?.(materia.nome);
      if (perf) {
        return [
          `Raio-x de ${materia.nome}:`,
          `- média atual: ${perf.average > 0 ? perf.average.toFixed(1) : 'sem notas ainda'}`,
          `- horas estudadas: ${perf.hours.toFixed(1)}h`,
          `- presença: ${perf.attendance}%`,
          `- tarefas pendentes: ${perf.tasksPending}`,
          `- provas futuras: ${perf.upcomingExamsCount}`,
          `- risco: ${perf.riskLevel} (${perf.riskReason})`,
          `- recomendação: ${perf.recommendation}`
        ].join('\n');
      }
    }

    if (p.includes('memória') || p.includes('memoria') || p.includes('lembra do que eu preciso')) {
      return `O que mais pede atenção agora: ${memory.weak.join(', ') || 'nenhuma matéria crítica'}. Provas próximas: ${memory.exams.join(', ') || 'nenhuma'}. Revisões de hoje: ${memory.reviews.join(', ') || 'nenhuma'}.`;
    }

    return originalAsk.call(this, pergunta);
  };

  proto.__mentorUpgradePatched = true;
})();


// __mentor_upgrade_v5_nlp__
(function () {
  if (!window.AIAssistant || window.AIAssistant.prototype.__mentorUpgradeV5Patched) return;

  const proto = window.AIAssistant.prototype;

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s:/.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const fmtDate = (value) => {
    const d = value ? new Date(value) : null;
    return d && !Number.isNaN(d.getTime())
      ? d.toLocaleDateString('pt-BR')
      : 'data indefinida';
  };

  const fmtHours = (hours) => `${Number(hours || 0).toFixed(1)}h`;

  const daysTo = (value) => {
    if (!value) return Infinity;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return Infinity;
    const now = new Date();
    const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.round((b - a) / 86400000);
  };

  proto._normalizeMentorText = normalize;

  proto._findSubjectInQuestion = function (question) {
    const normalized = normalize(question);
    const subjects = Array.isArray(this.context.subjects) ? this.context.subjects : [];
    if (!subjects.length) return null;

    let best = null;
    let bestScore = 0;

    const normWords = normalized.split(' ').filter(Boolean);

    subjects.forEach(item => {
      const nome = String(item?.nome || '').trim();
      const nNome = normalize(nome);
      if (!nNome) return;

      let score = 0;
      if (normalized.includes(nNome)) score += 100;

      const nameWords = nNome.split(' ').filter(Boolean);
      nameWords.forEach(word => {
        if (word.length >= 3 && normalized.includes(word)) score += 18;
      });

      normWords.forEach(word => {
        if (word.length >= 4 && nNome.includes(word)) score += 10;
      });

      const sigla = nameWords.map(w => w[0]).join('');
      if (sigla && normalized.includes(sigla)) score += 14;

      if (score > bestScore) {
        best = item;
        bestScore = score;
      }
    });

    return bestScore >= 18 ? best : null;
  };

  proto._getPendingTasks = function () {
    return (this.context.tasks || [])
      .filter(item => !item?.concluida)
      .sort((a, b) => {
        const da = new Date(a?.dataLimite || a?.data || 0).getTime();
        const db = new Date(b?.dataLimite || b?.data || 0).getTime();
        return da - db;
      });
  };

  proto._getOverdueTasks = function () {
    return this._getPendingTasks().filter(item => daysTo(item?.dataLimite || item?.data) < 0);
  };

  proto._getOpenExams = function (days = 30) {
    return (this.context.exams || [])
      .filter(item => !item?.concluida)
      .filter(item => daysTo(item?.data) <= days)
      .sort((a, b) => new Date(a?.data || 0) - new Date(b?.data || 0));
  };

  proto._getMaterialsSummary = function (materiaNome = null) {
    const materials = (this.context.materials || []).filter(item => !materiaNome || item?.materia === materiaNome);
    if (!materials.length) {
      return materiaNome
        ? `Você ainda não cadastrou materiais em ${materiaNome}.`
        : 'Você ainda não cadastrou materiais de estudo.';
    }

    const byType = {};
    materials.forEach(item => {
      const tipo = item?.tipo || 'outro';
      byType[tipo] = (byType[tipo] || 0) + 1;
    });

    const head = materiaNome
      ? `Materiais de ${materiaNome}: ${materials.length} item(ns).`
      : `Você tem ${materials.length} material(is) cadastrados no total.`;

    const dist = Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}: ${v}`)
      .join(' • ');

    const latest = materials
      .slice()
      .sort((a, b) => new Date(b?.updatedAt || b?.createdAt || 0) - new Date(a?.updatedAt || a?.createdAt || 0))
      .slice(0, 3)
      .map(item => item?.titulo || item?.conteudo || 'material sem título');

    return [head, dist ? `Distribuição: ${dist}.` : '', latest.length ? `Mais recentes: ${latest.join(' • ')}.` : ''].filter(Boolean).join(' ');
  };

  proto._getCurriculumSummary = function () {
    const items = this.context.curriculum || [];
    if (!items.length) return 'Você ainda não cadastrou o fluxograma/currículo do curso.';
    const done = items.filter(i => i?.status === 'concluida' || i?.status === 'aprovada' || i?.status === 'cursada').length;
    const current = items.filter(i => i?.status === 'cursando').length;
    const pending = items.filter(i => !['concluida', 'aprovada', 'cursada', 'cursando'].includes(i?.status)).length;
    const next = items
      .filter(i => !['concluida', 'aprovada', 'cursada'].includes(i?.status))
      .sort((a, b) => Number(a?.semestre || 999) - Number(b?.semestre || 999))
      .slice(0, 5)
      .map(i => i?.nome || i?.codigo)
      .filter(Boolean);
    return [
      `Fluxograma: ${items.length} disciplina(s) cadastrada(s).`,
      `Concluídas: ${done}. Em andamento: ${current}. Pendentes: ${pending}.`,
      next.length ? `Próximas no radar: ${next.join(', ')}.` : ''
    ].filter(Boolean).join(' ');
  };

  proto._getExtraCoursesSummary = function () {
    const items = this.context.extraCourses || [];
    if (!items.length) return 'Você ainda não cadastrou cursos extras.';
    const active = items.filter(i => i?.status === 'em-andamento').length;
    const done = items.filter(i => i?.status === 'concluido').length;
    const top = items
      .slice()
      .sort((a, b) => Number(b?.progresso || 0) - Number(a?.progresso || 0))
      .slice(0, 3)
      .map(i => `${i?.nome || 'curso'} (${Number(i?.progresso || 0)}%)`);
    return `Cursos extras: ${items.length} no total, ${active} em andamento e ${done} concluído(s). Destaques: ${top.join(' • ')}.`;
  };

  proto._getAttendanceSummary = function (materiaNome = null) {
    const diaries = (this.context.classDiaries || []).filter(item => !materiaNome || item?.materia === materiaNome);
    if (!diaries.length) {
      return materiaNome
        ? `Ainda não há diário de aula suficiente para medir presença em ${materiaNome}.`
        : 'Ainda não há diário de aula suficiente para medir presença.';
    }
    const present = diaries.filter(d => d?.presenca === 'present').length;
    const rate = Math.round((present / diaries.length) * 100);
    const latest = diaries
      .slice()
      .sort((a, b) => new Date(b?.data || 0) - new Date(a?.data || 0))[0];
    return [
      materiaNome ? `Presença em ${materiaNome}: ${rate}% (${present}/${diaries.length}).` : `Presença média registrada: ${rate}% (${present}/${diaries.length}).`,
      latest?.conteudoExplicado ? `Último conteúdo anotado: ${latest.conteudoExplicado}.` : '',
      latest?.precisoRevisar ? 'Tem sinal de conteúdo que precisa de revisão.' : ''
    ].filter(Boolean).join(' ');
  };

  proto._getDailyLogSummary = function () {
    const logs = this.context.dailyLogs || [];
    if (!logs.length) return 'Você ainda não registrou diário de rotina/energia.';
    const latest = logs.slice().sort((a, b) => new Date(b?.data || 0) - new Date(a?.data || 0))[0];
    const worked = logs.filter(i => i?.trabalho?.trabalhou || i?.trabalhou).length;
    const lowEnergy = logs.filter(i => (i?.energia || '').toLowerCase() === 'baixa').length;
    return [
      `Diário pessoal: ${logs.length} registro(s).`,
      `Dias com trabalho anotado: ${worked}. Dias com energia baixa: ${lowEnergy}.`,
      latest ? `Último registro: ${fmtDate(latest.data)} • energia ${latest.energia || 'não informada'} • foco ${latest.foco || 'não informado'}.` : ''
    ].filter(Boolean).join(' ');
  };

  proto._getGamificationSummary = function () {
    const g = this.context.user?.gamification || this.context.gamification || null;
    if (!g) return 'Gamificação: ainda sem dados suficientes.';
    const level = Number(g.level || 1);
    const xp = Number(g.xp || 0);
    const streak = Number(g.streak || this.context.user?.streak || 0);
    const unlocked = Array.isArray(g.achievements) ? g.achievements.filter(a => a?.unlocked).length : 0;
    return `Gamificação: nível ${level}, ${xp} XP total, streak de ${streak} dia(s) e ${unlocked} conquista(s) desbloqueada(s).`;
  };

  proto._getRotinaSummary = function () {
    const user = this.context.user || {};
    if (!user.turnoPrincipal && !user.diasPreferidos) {
      return 'Você ainda não preencheu sua rotina (turno, dias de estudo, horas por dia). Pode ajustar em Configurações → Perfil → Sua rotina — isso melhora bastante minhas sugestões de horário.';
    }
    const turnoLabel = { manha: 'manhã', tarde: 'tarde', noite: 'noite', madrugada: 'madrugada' }[user.turnoPrincipal] || user.turnoPrincipal || 'não definido';
    const diasLabel = { seg: 'seg', ter: 'ter', qua: 'qua', qui: 'qui', sex: 'sex', sab: 'sáb', dom: 'dom' };
    const dias = Array.isArray(user.diasPreferidos) && user.diasPreferidos.length
      ? user.diasPreferidos.map(d => diasLabel[d] || d).join(', ')
      : 'seg a sex (padrão)';
    const rotinaLabel = { 'so-estuda': 'só estudo', 'estuda-trabalha': 'estudo + trabalho', 'estuda-estagio': 'estudo + estágio', 'rotina-pesada': 'rotina muito pesada' }[user.tipoRotina] || 'não definida';
    const partes = [
      `Sua rotina: estuda melhor à ${turnoLabel}, nos dias ${dias}, até ${Number(user.horasMaximas) || 4}h por dia.`,
      `Tipo de rotina: ${rotinaLabel}.`
    ];
    if (Number(user.tempoDeslocamento) > 0) partes.push(`Deslocamento: ${Number(user.tempoDeslocamento)} min — já desconto isso do tempo de estudo disponível quando monto seu plano.`);
    if (user.horarioSono) partes.push(`Sono: ${user.horarioSono}.`);
    return partes.join(' ');
  };

  proto._getSiteSnapshot = function () {
    const subjects = this.context.subjects || [];
    const sessions = (this.context.sessions || []).filter(s => s?.concluida || s?.status === 'concluida');
    const totalHours = sessions.reduce((acc, s) => acc + (Number(s?.duracao) || 0), 0) / 60;
    const pendingTasks = this._getPendingTasks().length;
    const overdueTasks = this._getOverdueTasks().length;
    const exams = this._getOpenExams(30);
    const reviews = (this.context.reviews || []).filter(r => !r?.concluida);
    const materials = (this.context.materials || []).length;
    const grades = (this.context.grades || []).length;
    const curriculum = (this.context.curriculum || []).length;
    const extraCourses = (this.context.extraCourses || []).length;
    return [
      `Resumo geral do seu site: ${subjects.length} matéria(s), ${fmtHours(totalHours)} estudadas, ${pendingTasks} tarefa(s) pendente(s), ${overdueTasks} atrasada(s), ${exams.length} prova(s)/trabalho(s) nos próximos 30 dias, ${reviews.length} revisão(ões) pendente(s), ${materials} material(is), ${grades} nota(s), ${curriculum} item(ns) de currículo e ${extraCourses} curso(s) extra(s).`,
      this._getRotinaSummary(),
      this._getGamificationSummary()
    ].join(' ');
  };

  proto._getWhatIsMissing = function () {
    const missing = [];
    if (!(this.context.subjects || []).length) missing.push('matérias');
    if (!this.context.user?.turnoPrincipal) missing.push('rotina (turno, dias e horas de estudo)');
    if (!(this.context.classSchedule || []).length) missing.push('grade horária');
    if (!(this.context.sessions || []).some(s => s?.concluida || s?.status === 'concluida')) missing.push('sessões de estudo concluídas');
    if (!(this.context.tasks || []).length) missing.push('tarefas');
    if (!(this.context.exams || []).length) missing.push('provas/trabalhos');
    if (!(this.context.grades || []).length) missing.push('notas');
    if (!(this.context.materials || []).length) missing.push('materiais');
    if (!(this.context.classDiaries || []).length) missing.push('diário de aula');
    if (!(this.context.curriculum || []).length) missing.push('fluxograma/currículo');
    if (!(this.context.extraCourses || []).length) missing.push('cursos extras');
    return missing.length
      ? `Para eu te ajudar ainda melhor, o que mais está faltando cadastrar é: ${missing.join(', ')}.`
      : 'Seu site já está bem completo em dados. O próximo passo é manter o registro atualizado.';
  };

  proto._getMentorCapabilities = function () {
    return [
      'Eu consigo puxar praticamente tudo do seu site:',
      '- plano de hoje, da semana e recuperação',
      '- matérias mais críticas e risco acadêmico',
      '- tarefas pendentes e atrasadas',
      '- provas, trabalhos e revisões',
      '- horas estudadas por matéria e no total',
      '- notas, média, presença e faltas',
      '- próxima aula, grade horária e diário de aula',
      '- materiais, currículo/fluxograma e cursos extras',
      '- sua rotina (turno, dias, horas por dia, deslocamento) para dar horários realistas',
      '- metas, relatórios, gamificação e visão geral do perfil',
      '',
      'Perguntas que chamam atenção e funcionam bem:',
      '- me dá um raio-x completo',
      '- o que está mais atrasado?',
      '- qual matéria está mais perigosa?',
      '- o que falta cadastrar no meu site?',
      '- como está minha presença?',
      '- resume minha semana',
      '- como estou em [matéria]?',
      '- organiza meu dia agora'
    ].join('\n');
  };

  proto._smallTalk = function (normalized) {
    if (!normalized) return null;
    if (/^(oi|ola|olá|e ai|eae|salve|bom dia|boa tarde|boa noite)$/.test(normalized)) {
      const weak = this.getMemorySnapshot?.().weak || [];
      return weak.length
        ? `Oi! Tô com teu contexto na mão. Hoje eu já vejo ${weak[0]} e ${weak[1] || weak[0]} como matérias que merecem atenção. Quer que eu monte um plano, faça um raio-x geral ou te diga o que está atrasado?`
        : 'Oi! Já consigo puxar teus dados do site. Posso montar teu plano, mostrar risco, tarefas, notas, presença, provas e muito mais.';
    }
    if (normalized.includes('tudo bem') || normalized.includes('como voce esta') || normalized.includes('como vc esta')) {
      return 'Tô bem e pronto pra ser útil. Me pede qualquer coisa do teu site: resumo geral, tarefas atrasadas, matéria mais crítica, próximas provas, presença, notas, rotina ou plano do dia.';
    }
    if (normalized.includes('obrigad') || normalized.includes('valeu')) {
      return 'Tamo junto. Se quiser, agora eu posso ir além e te dar a próxima melhor ação com base no teu momento atual.';
    }
    if (normalized.includes('quem e voce') || normalized.includes('quem é voce')) {
      return 'Eu sou teu mentor IA do site. Não sou uma IA aberta tipo ChatGPT com internet, mas puxo teus dados reais e transformo isso em respostas úteis e personalizadas.';
    }
    return null;
  };

  const originalAsk = proto.ask;
  proto.ask = async function (pergunta) {
    const raw = String(pergunta || '').trim();
    if (!raw) return 'Me manda uma pergunta. Eu consigo usar praticamente tudo do teu site para te responder.';
    const p = normalize(raw);
    const materia = this._findSubjectInQuestion(raw);
    const app = window.app;

    const smallTalk = this._smallTalk(p);
    if (smallTalk) return smallTalk;

    if (p.includes('o que voce faz') || p.includes('o que vc faz') || p.includes('como voce pode ajudar') || p.includes('ajuda') || p.includes('comandos') || p.includes('o que voce consegue')) {
      return this._getMentorCapabilities();
    }

    if (p.includes('raio x') || p.includes('raiox') || p.includes('resumo geral') || p.includes('visao geral') || p.includes('visão geral') || p.includes('me da um resumo') || p.includes('me da um raio x') || p.includes('resuma meu site')) {
      return this._getSiteSnapshot();
    }

    if (p.includes('minha rotina') || p.includes('meu turno') || p.includes('quando eu estudo') || p.includes('quando estudo melhor') || (p.includes('quantas horas') && p.includes('dia'))) {
      return this._getRotinaSummary();
    }

    if (p.includes('o que falta cadastrar') || p.includes('faltando cadastrar') || p.includes('o que ta faltando') || p.includes('oque ta faltando')) {
      return this._getWhatIsMissing();
    }

    if ((p.includes('organiza meu dia') || p.includes('organize meu dia') || p.includes('o que eu faco agora') || p.includes('o que eu faço agora') || p.includes('to perdido') || p.includes('estou perdido')) && app?.getHojeInteligenteData) {
      const today = app.getHojeInteligenteData();
      const nextClass = today.nextClass ? `${today.nextClass.materia} às ${today.nextClass.inicio}` : 'sem aula próxima detectada';
      const urgent = today.urgentTasks.slice(0, 3).map(t => t.titulo).join(', ') || 'nenhuma pendência urgente';
      const top = today.topSuggestion ? `${today.topSuggestion.materia} por ${today.topSuggestion.duracao} min` : '30 min para organizar pendências';
      return [
        `Plano rápido para agora:`,
        `- próximo compromisso: ${nextClass}`,
        `- tarefa urgente: ${urgent}`,
        `- bloco principal: ${top}`,
        `- meta do dia: ${Number(today.dailyTargetHours || 0).toFixed(0)}h`,
        `- progresso de hoje: ${Number(today.todayProgress?.concluido || 0).toFixed(1)}h concluídas`,
        today.antiProcrastination ? `- modo recuperação ligado: ${today.antiProcrastination.reason}` : '- você pode focar sem precisar entrar em modo recuperação'
      ].join('\n');
    }

    if (p.includes('tarefa') || p.includes('pendencia') || p.includes('pendência') || p.includes('atrasada') || p.includes('atrasado')) {
      const pending = this._getPendingTasks();
      const overdue = this._getOverdueTasks();
      if (!pending.length) return 'Você não tem tarefas pendentes agora.';
      const top = pending.slice(0, 6).map(item => `- ${item.titulo} (${item.materia || 'sem matéria'}) • prazo ${fmtDate(item.dataLimite || item.data)}${daysTo(item.dataLimite || item.data) < 0 ? ' • atrasada' : ''}`);
      return [
        `Você tem ${pending.length} tarefa(s) pendente(s), sendo ${overdue.length} atrasada(s).`,
        ...top,
        overdue.length ? 'Ação recomendada: feche primeiro as atrasadas e só depois avance nas de prazo futuro.' : 'Ação recomendada: ataque primeiro as de prazo mais próximo.'
      ].join('\n');
    }

    if (p.includes('presenca') || p.includes('presença') || p.includes('falta') || p.includes('faltas')) {
      return this._getAttendanceSummary(materia?.nome || null);
    }

    if (p.includes('material') || p.includes('apostila') || p.includes('pdf') || p.includes('link de estudo')) {
      return this._getMaterialsSummary(materia?.nome || null);
    }

    if (p.includes('curriculo') || p.includes('currículo') || p.includes('fluxograma') || p.includes('grade do curso') || p.includes('disciplinas do curso')) {
      return this._getCurriculumSummary();
    }

    if (p.includes('curso extra') || p.includes('cursos extras') || p.includes('curso por fora') || p.includes('plataforma')) {
      return this._getExtraCoursesSummary();
    }

    if (p.includes('diario') || p.includes('diário') || p.includes('rotina') || p.includes('energia') || p.includes('foco de hoje')) {
      return this._getDailyLogSummary();
    }

    if (p.includes('gamificacao') || p.includes('gamificação') || p.includes('xp') || p.includes('nivel') || p.includes('nível') || p.includes('streak') || p.includes('conquista')) {
      return this._getGamificationSummary();
    }

    if (materia && (p.includes('nota') || p.includes('media') || p.includes('média') || p.includes('quanto preciso'))) {
      const perf = app?.getSubjectPerformance?.(materia.nome);
      if (perf) {
        return [
          `Notas em ${materia.nome}:`,
          `- média atual: ${perf.average > 0 ? perf.average.toFixed(1) : 'sem notas ainda'}`,
          `- próxima nota ideal para buscar sua meta: ${perf.nextRequiredGrade}`,
          `- recomendação: ${perf.recommendation}`
        ].join('\n');
      }
    }

    if (materia && (p.includes('presenca') || p.includes('presença') || p.includes('falta') || p.includes('faltas'))) {
      return this._getAttendanceSummary(materia.nome);
    }

    if (materia && (p.includes('material') || p.includes('materiais'))) {
      return this._getMaterialsSummary(materia.nome);
    }

    if (materia && (p.includes('ultimo conteudo') || p.includes('último conteúdo') || p.includes('ultima aula') || p.includes('última aula'))) {
      const last = this.getUltimaAulaRegistrada(materia.nome);
      if (!last) return `Ainda não achei diário de aula suficiente em ${materia.nome}.`;
      return [
        `Último registro de ${materia.nome}:`,
        `- data: ${fmtDate(last.data)}`,
        last.conteudo || last.conteudoExplicado ? `- conteúdo: ${last.conteudo || last.conteudoExplicado}` : '',
        last.exerciciosPassados ? `- exercícios passados: ${last.exerciciosPassados}` : '',
        last.trabalhoAnunciado ? `- trabalho anunciado: ${last.trabalhoAnunciado}` : '',
        last.precisoRevisar ? '- sinal: esse conteúdo foi marcado como algo para revisar' : ''
      ].filter(Boolean).join('\n');
    }

    if (p.includes('semana') && (p.includes('resum') || p.includes('como foi') || p.includes('me fala da'))) {
      const report = app?.getAutoReports?.();
      if (report) return report.weekly;
    }

    if (p.includes('hoje') && (p.includes('resum') || p.includes('como estou') || p.includes('como foi meu dia'))) {
      const report = app?.getAutoReports?.();
      if (report) return report.daily;
    }

    if (p.includes('mes') || p.includes('mês')) {
      const report = app?.getAutoReports?.();
      if (report && (p.includes('resum') || p.includes('relatorio') || p.includes('relatório'))) return report.monthly;
    }

    if (p.includes('me conhece') || p.includes('o que voce sabe de mim') || p.includes('o que vc sabe de mim')) {
      const user = this.context.user || {};
      return [
        `Eu sei o que está no teu site: nome ${user.nome || 'não cadastrado'}, curso ${user.curso || 'não cadastrado'}, universidade ${user.universidade || 'não cadastrada'}, semestre ${user.semestre || 'não cadastrado'}.`,
        this._getRotinaSummary(),
        this._getSiteSnapshot()
      ].join(' ');
    }

    return originalAsk.call(this, pergunta);
  };

  proto.__mentorUpgradeV5Patched = true;
})();


(function () {
  if (!window.AIAssistant || window.AIAssistant.prototype.__coachSessionPatched) return;
  const proto = window.AIAssistant.prototype;

  proto._ensureSessionMemory = function () {
    if (!Array.isArray(this.sessionMemory)) this.sessionMemory = [];
    if (!this.sessionState) this.sessionState = { lastSubject: null, lastIntent: null, mood: 'coach' };
  };

  proto._rememberTurn = function (question, answer, meta = {}) {
    this._ensureSessionMemory();
    const turn = {
      at: new Date().toISOString(),
      question: String(question || ''),
      answer: String(answer || ''),
      subject: meta.subject || null,
      intent: meta.intent || null
    };
    this.sessionMemory.push(turn);
    if (this.sessionMemory.length > 12) this.sessionMemory.shift();
    if (turn.subject) this.sessionState.lastSubject = turn.subject;
    if (turn.intent) this.sessionState.lastIntent = turn.intent;
  };

  proto._resolveSubjectFromMemory = function (question) {
    const current = this._findSubjectInQuestion?.(question || '');
    if (current?.nome) return current.nome;
    this._ensureSessionMemory();
    const q = String(question || '').toLowerCase();
    if (/(essa materia|essa matéria|essa|ela|nela|nessa|nisso|dela)/.test(q) && this.sessionState?.lastSubject) return this.sessionState.lastSubject;
    return null;
  };

  proto._detectIntent = function (question) {
    const p = String(question || '').toLowerCase();
    if (/plano|organiza|estudar hoje|agora/.test(p)) return 'plan';
    if (/risco|atrasad|pendenc|pendênc/.test(p)) return 'risk';
    if (/prova|trabalho|avalia/.test(p)) return 'exam';
    if (/como estou|situa|desempenho|nota|media|média/.test(p)) return 'status';
    if (/presen|falta/.test(p)) return 'attendance';
    if (/motivad|desanimad|cansad|perdid/.test(p)) return 'motivation';
    return 'general';
  };

  proto._coachWrap = function (text, question, subjectName, intent) {
    const q = String(question || '').toLowerCase();
    const subjectLabel = subjectName ? ` em ${subjectName}` : '';
    let opener = 'Papo reto:';
    let closer = 'Se quiser, eu consigo puxar isso para um plano mais direto agora.';

    if (/oi|olá|ola|tudo bem|eai|e aí/.test(q)) {
      opener = 'Fala. Tô contigo nessa.';
      closer = 'Me chama com algo tipo “organiza meu dia”, “o que está atrasado?” ou “como estou em X?”.';
    } else if (intent === 'motivation') {
      opener = `Respira. Dá para destravar isso${subjectLabel}.`;
      closer = 'Vamos no simples: escolhe 1 bloco curto, fecha 1 tarefa e cria tração.';
    } else if (intent === 'risk') {
      opener = 'Vou te mostrar o que realmente merece atenção agora.';
      closer = 'Minha recomendação é agir primeiro no que está mais perto de te cobrar resultado.';
    } else if (intent === 'plan') {
      opener = 'Fechou. Montei um caminho direto para você não ficar travado.';
      closer = 'O importante é começar pelo bloco 1 sem ficar negociando muito com a própria cabeça.';
    } else if (intent === 'status') {
      opener = `Olhei tua situação${subjectLabel}.`;
      closer = 'Se quiser, eu transformo isso em próximos passos objetivos.';
    }

    return `${opener}\n\n${String(text || '').trim()}\n\n${closer}`.trim();
  };

  proto._quickActionsFor = function (question, answer, subjectName, intent) {
    const actions = [];
    if (subjectName) {
      actions.push(`Como estou em ${subjectName}?`);
      actions.push(`Quanto preciso tirar em ${subjectName}?`);
    }
    if (intent === 'plan' || /plano|estudar/i.test(question || '')) {
      actions.push('Organiza meu dia agora');
      actions.push('Qual meu plano da semana?');
    }
    if (intent === 'risk') {
      actions.push('O que está mais atrasado?');
      actions.push('Qual matéria devo priorizar agora?');
    }
    if (intent === 'exam' || /prova|trabalho/i.test(answer || '')) {
      actions.push('Próximas provas');
      actions.push('Me dá um plano até a próxima prova');
    }
    if (intent === 'general') {
      actions.push('Me dá um raio-x completo');
      actions.push('O que falta cadastrar no meu site?');
      actions.push('Como está minha presença?');
    }
    return actions.filter((item, index, arr) => item && arr.indexOf(item) === index).slice(0, 4);
  };

  const originalAsk = proto.ask;
  proto.askRich = async function (pergunta) {
    this._ensureSessionMemory();
    const subjectName = this._resolveSubjectFromMemory(pergunta);
    const intent = this._detectIntent(pergunta);
    let rawAnswer = await originalAsk.call(this, pergunta);
    if (subjectName && /(essa materia|essa matéria|essa|ela|nela|nessa|dela)/i.test(String(pergunta || ''))) {
      if (/como estou|situa|status|nota|m[eé]dia|horas|presen|falta/i.test(String(pergunta || ''))) {
        rawAnswer = this._buildSubjectStatusAnswer(subjectName);
      }
    }
    const finalText = this._coachWrap(rawAnswer, pergunta, subjectName, intent);
    const actions = this._quickActionsFor(pergunta, rawAnswer, subjectName, intent);
    this._rememberTurn(pergunta, finalText, { subject: subjectName, intent });
    return { text: finalText, actions, memory: this.sessionMemory.slice(-6) };
  };

  proto.getSessionMemorySummary = function () {
    this._ensureSessionMemory();
    if (!this.sessionMemory.length) return 'Ainda não tivemos conversa suficiente nessa sessão.';
    return this.sessionMemory.map((turn, index) => `${index + 1}. ${turn.question}`).join('\n');
  };

  proto.__coachSessionPatched = true;
})();


// __mentor_upgrade_v6_smart__
// Upgrade: IA mais inteligente — previsão de reprovação, plano semanal real,
// análise de padrão de estudo, diagnóstico completo e conselhos práticos
(function () {
  if (!window.AIAssistant || window.AIAssistant.prototype.__mentorV6Patched) return;
  const proto = window.AIAssistant.prototype;

  // ── Helpers ──────────────────────────────────────────────────────────────
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();

  function horasEstudadasPorMateria(ctx, nomeMat) {
    return (ctx.sessions || [])
      .filter(s => s.concluida && norm(s.materia) === norm(nomeMat))
      .reduce((acc, s) => acc + (parseInt(s.duracao) || 0) / 60, 0);
  }

  function mediaNotas(ctx, nomeMat) {
    const notas = (ctx.grades || []).filter(g => norm(g.materia) === norm(nomeMat) && g.nota != null);
    if (!notas.length) return null;
    const pesoTotal = notas.reduce((a, g) => a + (g.peso || 1), 0);
    return notas.reduce((a, g) => a + g.nota * (g.peso || 1), 0) / pesoTotal;
  }

  function tarefasAtrasadas(ctx, nomeMat) {
    const hoje = new Date();
    return (ctx.tasks || []).filter(t =>
      !t.concluida && norm(t.materia) === norm(nomeMat) &&
      t.dataLimite && new Date(t.dataLimite + 'T23:59') < hoje
    ).length;
  }

  function proximaProva(ctx, nomeMat) {
    const hoje = new Date();
    const provas = (ctx.exams || [])
      .filter(e => !e.concluida && norm(e.materia) === norm(nomeMat) && new Date(e.data) >= hoje)
      .sort((a, b) => new Date(a.data) - new Date(b.data));
    return provas[0] || null;
  }

  function diasAte(dataStr) {
    if (!dataStr) return null;
    const d = new Date(dataStr);
    const hoje = new Date();
    const a = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.round((b - a) / 86400000);
  }

  function riscoReprovacao(ctx, subject) {
    const media = mediaNotas(ctx, subject.nome);
    const horas = horasEstudadasPorMateria(ctx, subject.nome);
    const atr = tarefasAtrasadas(ctx, subject.nome);
    const dif = parseInt(subject.dificuldade) || 3;
    let score = 0;
    if (media !== null) { if (media < 5) score += 40; else if (media < 6.5) score += 20; }
    if (horas < 2) score += 25; else if (horas < 8) score += 10;
    if (atr >= 2) score += 20; else if (atr >= 1) score += 8;
    if (dif >= 4) score += 10;
    return score; // 0-100+
  }

  function nivelRisco(score) {
    if (score >= 55) return { nivel: 'ALTO', emoji: '🔴', cor: 'danger' };
    if (score >= 28) return { nivel: 'MÉDIO', emoji: '🟡', cor: 'warning' };
    return { nivel: 'BAIXO', emoji: '🟢', cor: 'success' };
  }

  // ── Diagnóstico completo ──────────────────────────────────────────────────
  proto._buildSmartDiagnosis = function () {
    const ctx = this.context;
    const subjects = ctx.subjects || [];
    if (!subjects.length) return 'Cadastre suas matérias primeiro para eu poder te ajudar de verdade.';

    const linhas = ['📊 **Diagnóstico completo das suas matérias:**\n'];

    const ordenadas = [...subjects].sort((a, b) => riscoReprovacao(ctx, b) - riscoReprovacao(ctx, a));

    for (const s of ordenadas) {
      const score = riscoReprovacao(ctx, s);
      const { nivel, emoji } = nivelRisco(score);
      const media = mediaNotas(ctx, s.nome);
      const horas = horasEstudadasPorMateria(ctx, s.nome);
      const atr = tarefasAtrasadas(ctx, s.nome);
      const prova = proximaProva(ctx, s.nome);
      const diasProva = prova ? diasAte(prova.data) : null;

      linhas.push(`${emoji} **${s.nome}** — Risco: ${nivel}`);
      if (media !== null) linhas.push(`   Média atual: ${media.toFixed(1)}`);
      else linhas.push('   Média: sem notas cadastradas');
      linhas.push(`   Horas estudadas: ${horas.toFixed(1)}h`);
      if (atr) linhas.push(`   ⚠️ ${atr} tarefa(s) atrasada(s)`);
      if (diasProva !== null) linhas.push(`   📝 Prova em ${diasProva === 0 ? 'HOJE' : diasProva + ' dias'}`);
      linhas.push('');
    }

    // Conselho geral
    const emRisco = ordenadas.filter(s => riscoReprovacao(ctx, s) >= 55);
    if (emRisco.length) {
      linhas.push(`⚡ **Prioridade agora:** Foca em ${emRisco.map(s => s.nome).join(', ')}. ${emRisco.length > 1 ? 'Essas matérias têm maior risco de reprovação.' : 'Essa matéria precisa de atenção urgente.'}`);
    } else {
      linhas.push('✅ Nenhuma matéria em risco crítico no momento. Mantenha a constância!');
    }

    return linhas.join('\n');
  };

  // ── Plano de estudo semanal real ──────────────────────────────────────────
  proto._buildWeeklyPlan = function () {
    const ctx = this.context;
    const subjects = ctx.subjects || [];
    if (!subjects.length) return 'Cadastre suas matérias e rotina para eu montar um plano real.';

    const user = ctx.user || {};
    const diasPref = Array.isArray(user.diasPreferidos) && user.diasPreferidos.length
      ? user.diasPreferidos
      : ['seg','ter','qua','qui','sex'];
    const horasMax = parseInt(user.horasMaximas) || 4;
    const turno = user.turnoPrincipal || 'noite';

    const diasPT = { seg:'Segunda', ter:'Terça', qua:'Quarta', qui:'Quinta', sex:'Sexta', sab:'Sábado', dom:'Domingo' };

    // Ordenar por risco (maior risco = mais tempo)
    const ordenadas = [...subjects]
      .map(s => ({ ...s, score: riscoReprovacao(ctx, s), horas: horasEstudadasPorMateria(ctx, s.nome) }))
      .sort((a, b) => (b.score * 2 + b.dificuldade) - (a.score * 2 + a.dificuldade));

    const linhas = [`📅 **Plano de estudo para essa semana** (${horasMax}h/dia, turno: ${turno}):\n`];

    let materiaIdx = 0;
    for (const dia of diasPref.slice(0, 6)) {
      const diaLabel = diasPT[dia] || dia;
      const materiaDia = ordenadas[materiaIdx % ordenadas.length];
      const materia2 = ordenadas[(materiaIdx + 1) % ordenadas.length];
      materiaIdx++;

      const h1 = Math.min(horasMax - 1, Math.ceil(horasMax * 0.6));
      const h2 = horasMax - h1;

      const prova = proximaProva(ctx, materiaDia.nome);
      const diasP = prova ? diasAte(prova.data) : null;
      const urgencia = diasP !== null && diasP <= 3 ? ' ⚠️ PROVA PRÓXIMA!' : '';

      linhas.push(`**${diaLabel}** (${horasMax}h)`);
      linhas.push(`  • ${h1}h → ${materiaDia.nome}${urgencia}`);
      if (materia2 && materia2.nome !== materiaDia.nome) {
        linhas.push(`  • ${h2}h → ${materia2.nome}`);
      }
      linhas.push('');
    }

    const totalH = diasPref.slice(0,6).length * horasMax;
    linhas.push(`Total estimado: ${totalH}h na semana.`);
    linhas.push('Ajuste conforme as provas se aproximarem!');

    return linhas.join('\n');
  };

  // ── Previsão de reprovação ────────────────────────────────────────────────
  proto._buildReprovacaoForecast = function () {
    const ctx = this.context;
    const subjects = ctx.subjects || [];
    if (!subjects.length) return 'Sem matérias cadastradas.';

    const emRisco = subjects
      .map(s => ({ s, score: riscoReprovacao(ctx, s) }))
      .filter(({ score }) => score >= 28)
      .sort((a, b) => b.score - a.score);

    if (!emRisco.length) {
      return '✅ Nenhuma matéria com risco de reprovação detectado agora. Continue assim!';
    }

    const linhas = ['⚠️ **Previsão de risco de reprovação:**\n'];
    for (const { s, score } of emRisco) {
      const { nivel, emoji } = nivelRisco(score);
      const media = mediaNotas(ctx, s.nome);
      const horas = horasEstudadasPorMateria(ctx, s.nome);
      const prova = proximaProva(ctx, s.nome);
      linhas.push(`${emoji} **${s.nome}** — Risco ${nivel}`);
      if (media !== null) linhas.push(`   Média: ${media.toFixed(1)} ${media < 5 ? '(abaixo da mínima!)' : media < 6 ? '(precisa melhorar)' : ''}`);
      linhas.push(`   Horas: ${horas.toFixed(1)}h estudadas`);
      if (prova) linhas.push(`   Próxima prova: ${diasAte(prova.data)} dias`);

      // Conselho específico
      if (score >= 55) {
        linhas.push(`   💡 Conselho: Estude pelo menos ${Math.max(2, Math.ceil((5.5 - (media || 3)) * 3))}h por dia nessa matéria até a próxima prova.`);
      } else {
        linhas.push('   💡 Conselho: Mantenha a constância e não deixe tarefas acumularem.');
      }
      linhas.push('');
    }
    return linhas.join('\n');
  };

  // ── Análise de padrão de estudo ───────────────────────────────────────────
  proto._buildStudyPattern = function () {
    const ctx = this.context;
    const sessions = (ctx.sessions || []).filter(s => s.concluida);
    if (sessions.length < 3) return 'Preciso de pelo menos 3 sessões de estudo para analisar seu padrão. Continue registrando!';

    const totalH = sessions.reduce((a, s) => a + (parseInt(s.duracao) || 0) / 60, 0);
    const mediaH = totalH / sessions.length;
    const maisDe1h = sessions.filter(s => (parseInt(s.duracao) || 0) >= 60).length;
    const diasUnicos = new Set(sessions.map(s => s.data || s.timestamp?.split?.('T')?.[0])).size;
    const consistencia = diasUnicos >= 5 ? 'alta' : diasUnicos >= 3 ? 'moderada' : 'baixa';

    const horasPorMateria = {};
    for (const s of sessions) {
      horasPorMateria[s.materia] = (horasPorMateria[s.materia] || 0) + (parseInt(s.duracao) || 0) / 60;
    }
    const topMateria = Object.entries(horasPorMateria).sort((a,b) => b[1]-a[1])[0];
    const neglected = (ctx.subjects || []).filter(s => !horasPorMateria[s.nome] || horasPorMateria[s.nome] < 1);

    const linhas = ['📈 **Análise do seu padrão de estudo:**\n'];
    linhas.push(`Total: ${totalH.toFixed(1)}h em ${sessions.length} sessões (${diasUnicos} dias diferentes)`);
    linhas.push(`Média por sessão: ${mediaH.toFixed(1)}h`);
    linhas.push(`Sessões acima de 1h: ${maisDe1h} de ${sessions.length}`);
    linhas.push(`Consistência: ${consistencia === 'alta' ? '🟢 Alta' : consistencia === 'moderada' ? '🟡 Moderada' : '🔴 Baixa'}`);
    if (topMateria) linhas.push(`\nMatéria mais estudada: ${topMateria[0]} (${topMateria[1].toFixed(1)}h)`);
    if (neglected.length) {
      linhas.push(`\n⚠️ Matérias com menos de 1h estudada: ${neglected.map(s => s.nome).join(', ')}`);
    }

    // Conselho
    if (consistencia === 'baixa') {
      linhas.push('\n💡 Dica: Você estuda em poucos dias. Tente distribuir melhor durante a semana — sessões curtas todo dia valem mais do que longas sessões esparsas.');
    } else if (mediaH < 0.5) {
      linhas.push('\n💡 Dica: Suas sessões são bem curtas. Tente blocos de pelo menos 45 minutos para entrar em ritmo de concentração.');
    } else {
      linhas.push('\n✅ Padrão razoável. Mantenha a consistência e varie as matérias!');
    }

    return linhas.join('\n');
  };

  // ── Patch do ask() ────────────────────────────────────────────────────────
  const _origAsk = proto.ask;
  proto.ask = async function (pergunta) {
    const p = norm(pergunta);

    // Diagnóstico completo / raio-x de todas matérias
    if (p.match(/diagnostico|raio.?x|completo|todas.*materias|materias.*todas|visao geral|situacao geral|como estou em tudo/)) {
      return this._buildSmartDiagnosis();
    }

    // Plano semanal
    if (p.match(/plano.*semana|semana.*plano|organiza.*semana|planejar.*semana|horario.*semana|rotina.*semana/)) {
      return this._buildWeeklyPlan();
    }

    // Risco de reprovação
    if (p.match(/risco.*reprov|reprov|vou reprovar|chance.*reprovar|perigo.*reprovar|vai mal/)) {
      return this._buildReprovacaoForecast();
    }

    // Padrão de estudo
    if (p.match(/padrao|pattern|como estou estudando|meu estilo|minhas sessoes|quantas horas.*total|total.*horas/)) {
      return this._buildStudyPattern();
    }

    // Prioridade agora — melhorada
    if (p.match(/prioridade|priorizar|o que estudar|estudar agora|o que fazer agora|comecar por|comecar agora/)) {
      const ctx = this.context;
      const subjects = ctx.subjects || [];
      if (!subjects.length) return 'Cadastre suas matérias para eu poder indicar a prioridade.';

      const ordenadas = [...subjects]
        .map(s => {
          const score = riscoReprovacao(ctx, s);
          const prova = proximaProva(ctx, s.nome);
          const diasP = prova ? diasAte(prova.data) : 99;
          return { s, score, diasP };
        })
        .sort((a, b) => (b.score + (a.diasP < 7 ? 30 : 0)) - (a.score + (b.diasP < 7 ? 30 : 0)));

      const top = ordenadas[0];
      const { nivel, emoji } = nivelRisco(top.score);
      const prova = proximaProva(ctx, top.s.nome);

      let resp = `${emoji} **Prioridade agora: ${top.s.nome}**\n`;
      resp += `Risco: ${nivel} | Horas estudadas: ${horasEstudadasPorMateria(ctx, top.s.nome).toFixed(1)}h\n`;
      if (prova && top.diasP <= 7) resp += `⚠️ Prova em ${top.diasP} dias! Foco total.\n`;

      if (ordenadas.length > 1) {
        resp += `\nEm seguida: ${ordenadas.slice(1, 3).map(o => o.s.nome).join(' → ')}`;
      }
      return resp;
    }

    return _origAsk.call(this, pergunta);
  };

  proto.__mentorV6Patched = true;
})();

// ══════════════════════════════════════════════════════
// MENTOR IA v8 — mais esperto, 100% em regras (sem API paga)
// Adiciona: projeção de nota necessária, tendência semanal por
// matéria, melhor horário de estudo (baseado no diário) e
// respostas de prioridade/diagnóstico já citando a tendência.
// ══════════════════════════════════════════════════════
(function () {
  if (!window.AIAssistant || window.AIAssistant.prototype.__mentorV8Patched) return;
  const proto = window.AIAssistant.prototype;

  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  const parseNumeroPtBr = (texto) => {
    const match = String(texto || '').match(/(\d{1,2}[,.]\d{1,2}|\d{1,2})/);
    if (!match) return null;
    const valor = parseFloat(match[1].replace(',', '.'));
    return Number.isFinite(valor) ? valor : null;
  };

  // ── Projeção de nota necessária ────────────────────────────────────────
  function projetarNotaNecessaria(ctx, subject, notaDesejada) {
    const notas = (ctx.grades || []).filter(g => g?.materia === subject.nome && typeof g.valor === 'number' && typeof g.peso === 'number');
    const pesoFeito = notas.reduce((acc, n) => acc + n.peso, 0);
    const pesoRestante = Math.max(0, 100 - pesoFeito);
    const somaPonderada = notas.reduce((acc, n) => acc + (n.valor * n.peso), 0);
    const mediaAtual = pesoFeito ? somaPonderada / pesoFeito : null;

    if (pesoRestante <= 0) {
      const passou = mediaAtual !== null && mediaAtual >= notaDesejada;
      return {
        texto: passou
          ? `✅ **${subject.nome}**: todas as avaliações já foram lançadas e sua média (${mediaAtual.toFixed(1)}) já bate ${notaDesejada}.`
          : `❌ **${subject.nome}**: todas as avaliações já foram lançadas e a média (${mediaAtual !== null ? mediaAtual.toFixed(1) : 'sem notas'}) ficou abaixo de ${notaDesejada}. Não dá mais pra mudar via nota — verifique se há prova final/recuperação.`
      };
    }

    const notaNecessaria = ((notaDesejada * 100) - somaPonderada) / pesoRestante;
    const notaNecessariaClamp = Math.max(0, Math.min(10, notaNecessaria));
    const possivel = notaNecessaria <= 10;

    let texto = `🎯 **${subject.nome}**: `;
    if (!notas.length) {
      texto += `ainda não tem nota lançada. Considerando peso 100% restante, você precisa tirar ${notaDesejada.toFixed(1)} nas avaliações que faltam para fechar com média ${notaDesejada.toFixed(1)}.`;
    } else if (possivel) {
      texto += `média atual ${mediaAtual.toFixed(1)}. Nas avaliações restantes (peso ${pesoRestante}% do total), você precisa tirar em média ${notaNecessariaClamp.toFixed(1)} para fechar com ${notaDesejada.toFixed(1)}.`;
      if (notaNecessaria <= 4) texto += ' Tranquilo, está numa boa posição.';
      else if (notaNecessaria >= 8) texto += ' Vai exigir foco — comece a revisar essa matéria com prioridade.';
    } else {
      texto += `média atual ${mediaAtual.toFixed(1)}. Mesmo tirando 10 no que resta (peso ${pesoRestante}%), não dá pra fechar com ${notaDesejada.toFixed(1)} — o máximo possível fica perto de ${(((10 * pesoRestante) + somaPonderada) / 100).toFixed(1)}. Se a meta é só passar, mira num valor mais realista.`;
    }
    return { texto, mediaAtual, notaNecessaria: notaNecessariaClamp, possivel };
  }

  proto._answerNotaNecessaria = function (pergunta) {
    const ctx = this.context;
    const subjects = ctx.subjects || [];
    if (!subjects.length) return 'Cadastre suas matérias e notas primeiro para eu calcular isso.';

    const notaDesejada = parseNumeroPtBr(pergunta) ?? 6;
    const materiaAlvo = this._findSubjectInQuestion ? this._findSubjectInQuestion(pergunta) : null;

    if (materiaAlvo) {
      const subject = subjects.find(s => s.nome === materiaAlvo) || subjects.find(s => norm(s.nome) === norm(materiaAlvo));
      if (subject) return projetarNotaNecessaria(ctx, subject, notaDesejada).texto;
    }

    // Sem matéria específica: mostra as que têm avaliação pendente
    const linhas = subjects
      .map(s => projetarNotaNecessaria(ctx, s, notaDesejada))
      .filter(r => r && r.texto)
      .map(r => r.texto);

    if (!linhas.length) return 'Não encontrei matérias com avaliações pendentes para calcular.';
    return `Considerando meta de média ${notaDesejada.toFixed(1)} (me diga a nota da matéria específica se quiser outro valor):\n\n${linhas.join('\n\n')}`;
  };

  // ── Tendência semanal (esta semana vs. semana anterior) ────────────────
  function minutosNoIntervalo(ctx, nomeMateria, diasInicio, diasFim) {
    const hoje = new Date();
    const inicio = new Date(hoje.getTime() - diasInicio * 86400000);
    const fim = new Date(hoje.getTime() - diasFim * 86400000);
    return (ctx.sessions || [])
      .filter(s => s?.concluida && norm(s.materia) === norm(nomeMateria))
      .filter(s => {
        const d = s?.data ? new Date(s.data) : null;
        return d && !Number.isNaN(d.getTime()) && d >= inicio && d < fim;
      })
      .reduce((acc, s) => acc + (parseInt(s.duracao) || 0), 0);
  }

  function tendenciaMateria(ctx, nomeMateria) {
    const semanaAtual = minutosNoIntervalo(ctx, nomeMateria, 7, 0);
    const semanaAnterior = minutosNoIntervalo(ctx, nomeMateria, 14, 7);
    if (semanaAtual === 0 && semanaAnterior === 0) return null;
    if (semanaAnterior === 0) return { direcao: 'novo', semanaAtual, semanaAnterior };
    const variacao = ((semanaAtual - semanaAnterior) / semanaAnterior) * 100;
    if (variacao >= 20) return { direcao: 'subindo', variacao, semanaAtual, semanaAnterior };
    if (variacao <= -20) return { direcao: 'caindo', variacao, semanaAtual, semanaAnterior };
    return { direcao: 'estavel', variacao, semanaAtual, semanaAnterior };
  }

  proto._answerTendencia = function (pergunta) {
    const ctx = this.context;
    const subjects = ctx.subjects || [];
    if (!subjects.length) return 'Cadastre suas matérias para eu acompanhar sua evolução.';

    const materiaAlvo = this._findSubjectInQuestion ? this._findSubjectInQuestion(pergunta) : null;
    const alvo = materiaAlvo ? subjects.filter(s => norm(s.nome) === norm(materiaAlvo)) : subjects;

    const linhas = [];
    alvo.forEach(s => {
      const t = tendenciaMateria(ctx, s.nome);
      if (!t) { linhas.push(`⚪ **${s.nome}**: sem sessões registradas nas últimas 2 semanas.`); return; }
      const h1 = (t.semanaAtual / 60).toFixed(1);
      const h2 = (t.semanaAnterior / 60).toFixed(1);
      if (t.direcao === 'novo') linhas.push(`🆕 **${s.nome}**: ${h1}h essa semana (não tinha estudo na semana anterior).`);
      else if (t.direcao === 'subindo') linhas.push(`📈 **${s.nome}**: subiu de ${h2}h para ${h1}h (${t.variacao > 0 ? '+' : ''}${t.variacao.toFixed(0)}%). Bom ritmo!`);
      else if (t.direcao === 'caindo') linhas.push(`📉 **${s.nome}**: caiu de ${h2}h para ${h1}h (${t.variacao.toFixed(0)}%). Vale retomar antes que vire uma dívida grande.`);
      else linhas.push(`➖ **${s.nome}**: estável, ${h1}h essa semana (${h2}h na anterior).`);
    });

    return linhas.length ? linhas.join('\n') : 'Ainda não tenho sessões suficientes para comparar as semanas.';
  };

  // ── Melhor horário de estudo (a partir do diário: foco x horário) ──────
  proto._answerMelhorHorario = function () {
    const ctx = this.context;
    const logs = (ctx.dailyLogs || []).filter(l => l?.estudoInicio && l?.foco != null && l.foco !== '');
    if (logs.length < 3) {
      return 'Ainda preciso de mais registros no seu diário (horário de início + nível de foco) para descobrir seu melhor horário. Continue preenchendo o diário do dia!';
    }

    const buckets = { madrugada: [], manha: [], tarde: [], noite: [] };
    const labels = { madrugada: 'madrugada (0h-6h)', manha: 'manhã (6h-12h)', tarde: 'tarde (12h-18h)', noite: 'noite (18h-24h)' };
    logs.forEach(l => {
      const hora = parseInt(String(l.estudoInicio).split(':')[0], 10);
      const foco = Number(l.foco);
      if (Number.isNaN(hora) || !Number.isFinite(foco)) return;
      const bucket = hora < 6 ? 'madrugada' : hora < 12 ? 'manha' : hora < 18 ? 'tarde' : 'noite';
      buckets[bucket].push(foco);
    });

    const stats = Object.entries(buckets)
      .filter(([, arr]) => arr.length)
      .map(([nome, arr]) => ({ nome, media: arr.reduce((a, b) => a + b, 0) / arr.length, n: arr.length }))
      .sort((a, b) => b.media - a.media);

    if (!stats.length) return 'Não consegui cruzar horário e foco nos registros — confira se o diário está salvando esses dois campos.';

    const melhor = stats[0];
    let resp = `⏰ Pelos seus registros, seu foco costuma ser maior estudando de **${labels[melhor.nome]}** (foco médio ${melhor.media.toFixed(1)}, em ${melhor.n} registro(s)).`;
    if (stats.length > 1) {
      const pior = stats[stats.length - 1];
      resp += `\nO período com foco mais baixo foi **${labels[pior.nome]}** (${pior.media.toFixed(1)}).`;
    }
    if (melhor.n < 5) resp += '\n\n(Ainda são poucos registros — quanto mais você preencher o diário, mais precisa fica essa análise.)';
    return resp;
  };

  // ── Patch do ask() — plugando os novos intents ──────────────────────────
  const _origAskV8 = proto.ask;
  proto.ask = async function (pergunta) {
    const p = norm(pergunta);

    if (p.match(/quanto.*preciso|nota necessaria|preciso tirar|quanto.*tirar|nota.*passar|media.*passar|nota minima|consigo passar|vou passar/)) {
      return this._answerNotaNecessaria(pergunta);
    }

    if (p.match(/tendencia|evolu|melhorei|piorei|melhorando|piorando|comparad[oa].*semana|estou indo bem|estou progredindo/)) {
      return this._answerTendencia(pergunta);
    }

    if (p.match(/melhor horario|que horas.*estudar|quando.*devo estudar|periodo.*mais produtiv|horario.*produtiv/)) {
      return this._answerMelhorHorario();
    }

    return _origAskV8.call(this, pergunta);
  };

  // ── Enriquecer o diagnóstico completo (v6) com a tendência semanal ─────
  if (typeof proto._buildSmartDiagnosis === 'function') {
    const _origDiag = proto._buildSmartDiagnosis;
    proto._buildSmartDiagnosis = function () {
      const base = _origDiag.call(this);
      const ctx = this.context;
      const subjects = ctx.subjects || [];
      if (!subjects.length) return base;

      const emQueda = subjects.filter(s => {
        const t = tendenciaMateria(ctx, s.nome);
        return t && t.direcao === 'caindo';
      });

      if (!emQueda.length) return base;
      return `${base}\n\n📉 **Atenção ao ritmo:** ${emQueda.map(s => s.nome).join(', ')} ${emQueda.length > 1 ? 'estão' : 'está'} com estudo em queda na última semana comparado à anterior.`;
    };
  }

  proto.__mentorV8Patched = true;
  console.info('[MentorIA v8] Regras avançadas ativadas (nota necessária, tendência, melhor horário) — sem chamadas de API externa.');
})();
