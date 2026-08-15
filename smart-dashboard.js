// smart-dashboard.js - Dashboard Inteligente Aprimorado

class SmartDashboard {
    constructor(app) {
        this.app = app;
    }

    // Dados consolidados para o dashboard
    getDashboardData() {
        const hoje = new Date();
        const inicioSemana = new Date(hoje);
        inicioSemana.setDate(hoje.getDate() - hoje.getDay());
        
        return {
            proximasProvas: this.getProximasProvasDetalhadas(),
            materiasAtrasadas: this.getMateriasAtrasadas(),
            horasEstudadas: this.getHorasEstudadasPeriodo(),
            progressoSemanal: this.getProgressoSemanal(),
            topicoRiscados: this.getTopicosRisco(),
            recomendacoesIA: this.getRecomendacoesIA(),
            estatisticasRapidas: this.getEstatisticasRapidas(),
            caloriasEstudo: this.calcularCaloriasEstudo(),
            rankingMaterias: this.getRankingMaterias(),
            previsaoSemana: this.getPrevisaoSemana()
        };
    }

    // Próximas provas com detalhes
    getProximasProvasDetalhadas() {
        return (this.app.data.exams || [])
            .filter(e => new Date(e.data) >= new Date())
            .sort((a, b) => new Date(a.data) - new Date(b.data))
            .map(prova => {
                const horasEstudadas = this.calcularHorasMateria(prova.materia);
                const horasNecessarias = this.calcularHorasNecessarias(prova);
                const progresso = Math.min((horasEstudadas / horasNecessarias) * 100, 100);
                
                return {
                    ...prova,
                    diasRestantes: diasAte(prova.data),
                    horasEstudadas: horasEstudadas.toFixed(1),
                    horasNecessarias: horasNecessarias.toFixed(1),
                    progresso: Math.round(progresso),
                    status: this.getStatusProva(prova, horasEstudadas, horasNecessarias),
                    corStatus: this.getCorStatus(progresso)
                };
            });
    }

    // Matérias atrasadas (sem estudo há muitos dias)
    getMateriasAtrasadas() {
        const limiteDias = this.app.data.settings?.heavyMode ? 3 : 5;
        
        return this.app.data.subjects
            .map(materia => {
                const ultimaSessao = this.app.data.sessions
                    .filter(s => s.materia === materia.nome && s.concluida)
                    .sort((a, b) => new Date(b.data) - new Date(a.data))[0];
                
                if (!ultimaSessao) return null;
                
                const diasSemEstudar = diasDesde(ultimaSessao.data);
                if (diasSemEstudar <= limiteDias) return null;
                
                return {
                    materia: materia.nome,
                    diasSemEstudar,
                    ultimoEstudo: formatarData(ultimaSessao.data),
                    urgencia: diasSemEstudar > 7 ? 'alta' : 'media',
                    sugestao: `Estude ${materia.nome} hoje para não acumular`
                };
            })
            .filter(Boolean)
            .sort((a, b) => b.diasSemEstudar - a.diasSemEstudar);
    }

    // Horas estudadas por período
    getHorasEstudadasPeriodo() {
        const hoje = new Date();
        const inicioSemana = new Date(hoje);
        inicioSemana.setDate(hoje.getDate() - hoje.getDay());
        
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        
        const sessoes = this.app.data.sessions.filter(s => s.concluida);
        
        const horasHoje = sessoes
            .filter(s => new Date(s.data).toDateString() === hoje.toDateString())
            .reduce((acc, s) => acc + s.duracao, 0) / 60;
            
        const horasSemana = sessoes
            .filter(s => new Date(s.data) >= inicioSemana)
            .reduce((acc, s) => acc + s.duracao, 0) / 60;
            
        const horasMes = sessoes
            .filter(s => new Date(s.data) >= inicioMes)
            .reduce((acc, s) => acc + s.duracao, 0) / 60;
            
        const horasTotal = sessoes.reduce((acc, s) => acc + s.duracao, 0) / 60;
        
        return { horasHoje, horasSemana, horasMes, horasTotal };
    }

    // Progresso semanal (gráfico)
    getProgressoSemanal() {
        const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const hoje = new Date();
        const inicioSemana = new Date(hoje);
        inicioSemana.setDate(hoje.getDate() - hoje.getDay());
        
        return dias.map((dia, index) => {
            const data = new Date(inicioSemana);
            data.setDate(inicioSemana.getDate() + index);
            const dataStr = data.toDateString();
            
            const horas = this.app.data.sessions
                .filter(s => s.concluida && new Date(s.data).toDateString() === dataStr)
                .reduce((acc, s) => acc + s.duracao, 0) / 60;
                
            const meta = this.app.data.user?.horasMaximas || 6;
            
            return {
                dia,
                horas: horas.toFixed(1),
                meta,
                percentual: Math.min((horas / meta) * 100, 100),
                data: dataStr
            };
        });
    }

    // Tópicos em risco (sem revisão)
    getTopicosRisco() {
        return (this.app.data.learningMap || [])
            .filter(t => t.status !== 'dominado' && diasDesde(t.ultimaRevisao) > 7)
            .map(t => ({
                ...t,
                diasSemRevisar: diasDesde(t.ultimaRevisao),
                urgencia: diasDesde(t.ultimaRevisao) > 14 ? 'alta' : 'media'
            }))
            .sort((a, b) => b.diasSemRevisar - a.diasSemRevisar)
            .slice(0, 5);
    }

    // Recomendações da IA
    getRecomendacoesIA() {
        if (!window.aiAssistant) return [];
        
        const recomendacoes = [];
        
        // Recomendar estudo para provas próximas
        const provasProximas = this.getProximasProvasDetalhadas()
            .filter(p => p.diasRestantes <= 7 && p.progresso < 50);
            
        provasProximas.forEach(p => {
            recomendacoes.push({
                tipo: 'prova',
                titulo: `Foco em ${p.materia}`,
                descricao: `Prova em ${p.diasRestantes} dias e você estudou apenas ${p.horasEstudadas}h`,
                acao: 'Estudar agora',
                icone: 'fa-graduation-cap',
                cor: 'danger',
                prioridade: p.diasRestantes <= 3 ? 1 : 2
            });
        });
        
        // Recomendar revisão para tópicos atrasados
        const topicosRisco = this.getTopicosRisco();
        topicosRisco.slice(0, 3).forEach(t => {
            recomendacoes.push({
                tipo: 'revisao',
                titulo: `Revisar ${t.nome}`,
                descricao: `Não revisa há ${t.diasSemRevisar} dias`,
                acao: 'Revisar agora',
                icone: 'fa-sync-alt',
                cor: 'warning',
                prioridade: 3
            });
        });
        
        // Recomendar matérias atrasadas
        const atrasadas = this.getMateriasAtrasadas();
        atrasadas.slice(0, 2).forEach(m => {
            recomendacoes.push({
                tipo: 'atraso',
                titulo: `${m.materia} atrasada`,
                descricao: `${m.diasSemEstudar} dias sem estudar`,
                acao: 'Programar estudo',
                icone: 'fa-clock',
                cor: 'warning',
                prioridade: 4
            });
        });
        
        return recomendacoes.sort((a, b) => a.prioridade - b.prioridade);
    }

    // Estatísticas rápidas
    getEstatisticasRapidas() {
        const streak = this.app.data.user?.streak || 0;
        const totalTarefas = this.app.data.tasks.length;
        const tarefasConcluidas = this.app.data.tasks.filter(t => t.concluida).length;
        const taxaTarefas = totalTarefas ? Math.round((tarefasConcluidas / totalTarefas) * 100) : 0;
        
        const totalSessoes = this.app.data.sessions.length;
        const sessoesConcluidas = this.app.data.sessions.filter(s => s.concluida).length;
        const taxaSessoes = totalSessoes ? Math.round((sessoesConcluidas / totalSessoes) * 100) : 0;
        
        return {
            streak,
            taxaTarefas,
            taxaSessoes,
            materiasCount: this.app.data.subjects.length,
            topicosCount: this.app.data.learningMap.length
        };
    }

    // Calorias de estudo (gamificação)
    calcularCaloriasEstudo() {
        const minutosEstudo = this.app.data.sessions
            .filter(s => s.concluida)
            .reduce((acc, s) => acc + s.duracao, 0);
            
        // Fórmula: minutos * 0.1 = calorias mentais aproximadas
        return Math.round(minutosEstudo * 0.1);
    }

    // Ranking de matérias por dificuldade e horas
    getRankingMaterias() {
        return this.app.data.subjects
            .map(m => {
                const horas = this.calcularHorasMateria(m.nome);
                const notas = this.app.data.grades.filter(g => g.materia === m.nome);
                const media = this.app.calcularMedia(notas);
                
                // Score = (horas * 10) + (media * 5) - (dificuldade * 2)
                const score = (horas * 10) + (media * 5) - (m.dificuldade * 2);
                
                return {
                    ...m,
                    horas: horas.toFixed(1),
                    media: media.toFixed(1),
                    score: Math.max(0, Math.round(score))
                };
            })
            .sort((a, b) => b.score - a.score);
    }

    // Previsão para a semana
    getPrevisaoSemana() {
        const hoje = new Date();
        const previsao = [];
        
        for (let i = 0; i < 7; i++) {
            const data = new Date(hoje);
            data.setDate(hoje.getDate() + i);
            const dataStr = data.toISOString().split('T')[0];
            
            // Eventos do dia
            const provas = this.app.data.exams.filter(e => e.data === dataStr);
            const tarefas = this.app.data.tasks.filter(t => t.dataLimite === dataStr && !t.concluida);
            const sessoes = this.app.data.sessions.filter(s => s.data.startsWith(dataStr) && !s.concluida);
            
            // Aulas do dia
            const aulas = window.scheduleManager?.getAulasPorDia(data.getDay()) || [];
            
            // Horas planejadas
            const horasPlanejadas = sessoes.reduce((acc, s) => acc + s.duracao, 0) / 60;
            
            previsao.push({
                data: dataStr,
                diaSemana: data.toLocaleDateString('pt-BR', { weekday: 'short' }),
                diaMes: data.getDate(),
                provas: provas.length,
                tarefas: tarefas.length,
                sessoes: sessoes.length,
                aulas: aulas.length,
                horasPlanejadas: horasPlanejadas.toFixed(1),
                temEvento: provas.length > 0 || tarefas.length > 0,
                resumo: this.resumirDia(provas, tarefas, aulas, sessoes)
            });
        }
        
        return previsao;
    }

    // Utilitários
    calcularHorasMateria(materia) {
        return this.app.data.sessions
            .filter(s => s.materia === materia && s.concluida)
            .reduce((acc, s) => acc + s.duracao, 0) / 60;
    }

    calcularHorasNecessarias(prova) {
        const materia = this.app.data.subjects.find(s => s.nome === prova.materia);
        const dificuldade = materia?.dificuldade || 3;
        const diasRestantes = Math.max(1, diasAte(prova.data));
        
        // Fórmula: (dificuldade * 2) horas base + ajuste por tempo restante
        return Math.max(2, (dificuldade * 2) + (7 - Math.min(7, diasRestantes)) * 0.5);
    }

    getStatusProva(prova, horasEstudadas, horasNecessarias) {
        if (horasEstudadas >= horasNecessarias) return 'preparado';
        if (diasAte(prova.data) <= 3) return 'urgente';
        if (horasEstudadas < horasNecessarias * 0.3) return 'preocupante';
        return 'andamento';
    }

    getCorStatus(progresso) {
        if (progresso >= 80) return 'success';
        if (progresso >= 50) return 'warning';
        return 'danger';
    }

    resumirDia(provas, tarefas, aulas, sessoes) {
        const partes = [];
        if (provas.length) partes.push(`${provas.length} prova(s)`);
        if (tarefas.length) partes.push(`${tarefas.length} tarefa(s)`);
        if (aulas.length) partes.push(`${aulas.length} aula(s)`);
        if (sessoes.length) partes.push(`${sessoes.length} sessão(ões)`);
        
        return partes.join(' • ') || 'Dia livre';
    }
}

window.SmartDashboard = SmartDashboard;