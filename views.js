// views.js - Renderizador de visualizações COMPLETO, CORRIGIDO E COMPATÍVEL

// Converte "23:30 - 07:00" (formato salvo em user.horarioSono) em
// { inicio, fim } pros dois campos type="time" da tela de Configurações.
function parseTimeRange(str) {
    const m = String(str || '').match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    return m ? { inicio: m[1], fim: m[2] } : { inicio: '', fim: '' };
}

class ViewRenderer {
    constructor(app) {
        this.app = app;
    }

    esc(value) {
        return escapeHtml(value ?? '');
    }

    // Lista única de hábitos, usada na tela de Hábitos e no widget rápido do Dashboard
    getHabitosDefinition() {
        return [
            { id: 'estudar', nome: 'Estudar', icone: 'fa-book' },
            { id: 'revisar', nome: 'Revisar conteúdo', icone: 'fa-sync-alt' },
            { id: 'dormir', nome: 'Dormir bem', icone: 'fa-bed' },
            { id: 'aula', nome: 'Ir para aula', icone: 'fa-university' },
            { id: 'exercicio', nome: 'Fazer exercícios', icone: 'fa-dumbbell' },
            { id: 'agua', nome: 'Beber água', icone: 'fa-tint' },
            { id: 'anotacoes', nome: 'Ler anotações', icone: 'fa-sticky-note' }
        ];
    }

    // Widget compacto de 1 toque: marca hábitos do dia sem precisar abrir a tela de Hábitos
    renderHabitosWidget() {
        const habitos = this.getHabitosDefinition();
        const hoje = toDateString();
        const feitos = habitos.filter(h => this.app.data.habits.some(hb => hb.id === h.id && toDateString(hb.data) === hoje)).length;

        return `
            <div class="card habitos-widget-card">
                <div class="card-header">
                    <h3><i class="fas fa-heart"></i> Hábitos de Hoje</h3>
                    <span class="tag ${feitos === habitos.length ? 'success' : ''}">${feitos}/${habitos.length}</span>
                </div>
                <div class="card-body">
                    <div class="habitos-widget-grid">
                        ${habitos.map(h => {
                            const feito = this.app.data.habits.some(hb => hb.id === h.id && toDateString(hb.data) === hoje);
                            return `
                                <button type="button" class="habito-chip toggle-habito-mini ${feito ? 'active' : ''}" data-habito="${this.esc(h.id)}" title="${this.esc(h.nome)}">
                                    <i class="fas ${feito ? 'fa-check-circle' : h.icone}"></i>
                                    <span>${this.esc(h.nome)}</span>
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    renderDashboard() {
        const hoje = new Date();
        const alerts = this.app.generateAlerts();
        const risk = this.app.analyzeAcademicRisk();
        const progresso = this.app.calcularProgressoHoje();
        const tarefasUrgentes = this.app.getUrgentTasks();
        const proximosExames = this.app.getUpcomingExams(7);
        const horasResumo = this.getResumoHorasEstudo();
        const materiasAtrasadas = this.getMateriasAtrasadas();
        const resumoSemana = this.getResumoSemana();

        window.aiAssistant?.updateContext(this.app.data);

        const planoIA = window.aiAssistant ? window.aiAssistant.generateDailyPlan() : [];
        const proximaAula = window.scheduleManager ? window.scheduleManager.getProximaAula() : null;
        const aulaAtual = window.scheduleManager ? window.scheduleManager.getAulaAtual() : null;

        const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

        return `
            <div class="dashboard-header">
                <h2>Olá, ${this.esc(this.app.data.user?.nome || 'Estudante')}! 👋</h2>
                <p>${hoje.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>

            ${aulaAtual ? `
                <div class="current-class-card">
                    <i class="fas fa-chalkboard-teacher"></i>
                    <div class="current-class-info">
                        <h3>Aula Agora: ${this.esc(aulaAtual.materia)}</h3>
                        <p>
                            ${aulaAtual.sala ? `Sala ${this.esc(aulaAtual.sala)}` : ''}
                            ${aulaAtual.professor ? `${aulaAtual.sala ? ' • ' : ''}Prof. ${this.esc(aulaAtual.professor)}` : ''}
                        </p>
                        <small>Até às ${this.esc(aulaAtual.fim)}</small>
                    </div>
                </div>
            ` : proximaAula ? `
                <div class="next-class-card">
                    <i class="fas fa-clock"></i>
                    <div class="next-class-info">
                        <h3>Próxima Aula: ${this.esc(proximaAula.materia)}</h3>
                        <p>
                            ${diasSemana[parseInt(proximaAula.dia, 10)]} • ${this.esc(proximaAula.inicio)} - ${this.esc(proximaAula.fim)}
                            ${proximaAula.sala ? ` • Sala ${this.esc(proximaAula.sala)}` : ''}
                        </p>
                        <small>${tempoRestante(this.getProximaAulaDateTime(proximaAula))}</small>
                    </div>
                </div>
            ` : ''}

            ${alerts.length ? `
                <div class="alerts-container">
                    <h3><i class="fas fa-exclamation-triangle"></i> Alertas Inteligentes</h3>
                    ${alerts.map(a => this.renderAlert(a)).join('')}
                </div>
            ` : ''}

            ${this.renderHabitosWidget()}

            <div class="dashboard-grid">
                <div class="card">
                    <div class="card-header">
                        <h3><i class="fas fa-clock"></i> Progresso Hoje</h3>
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <div class="card-body">
                        <div class="progress-container">
                            <div class="progress-label">
                                <span>Disponibilidade: ${this.esc(this.app.data.user?.horasMaximas || 6)}h</span>
                                <span>${this.esc(progresso.concluido)}h</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${progresso.percentual}%"></div>
                            </div>
                        </div>
                        <div class="stats-row">
                            <div class="stat-item">
                                <span class="stat-value">${this.esc(this.app.data.user?.streak || 0)}</span>
                                <span class="stat-label">streak</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-value">${this.esc(this.app.calcularProdutividade())}</span>
                                <span class="stat-label">produtividade</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-value">${tarefasUrgentes.length}</span>
                                <span class="stat-label">urgentes</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h3><i class="fas fa-book-open"></i> Horas Estudadas</h3>
                        <i class="fas fa-stopwatch"></i>
                    </div>
                    <div class="card-body">
                        <div class="stats-row">
                            <div class="stat-item">
                                <span class="stat-value">${horasResumo.hoje.toFixed(1)}h</span>
                                <span class="stat-label">hoje</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-value">${horasResumo.semana.toFixed(1)}h</span>
                                <span class="stat-label">semana</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-value">${horasResumo.total.toFixed(1)}h</span>
                                <span class="stat-label">total</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h3><i class="fas fa-exclamation-circle"></i> Risco Acadêmico</h3>
                        <i class="fas fa-shield-alt"></i>
                    </div>
                    <div class="card-body">
                        ${risk.length ? risk.map(r => `
                            <div class="risk-item">
                                <div class="risk-info">
                                    <strong>${this.esc(r.materia)}</strong>
                                    <span class="risk-indicator risk-${this.esc(r.nivel)}">${this.esc(r.nivel)}</span>
                                </div>
                                <p class="risk-desc">${this.esc(r.motivo)}</p>
                            </div>
                        `).join('') : '<p class="text-secondary">Nenhum risco identificado</p>'}
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h3><i class="fas fa-tasks"></i> Tarefas Urgentes</h3>
                        <i class="fas fa-clock"></i>
                    </div>
                    <div class="card-body">
                        <ul class="item-list">
                            ${tarefasUrgentes.map(t => `
                                <li>
                                    <div>
                                        <strong>${this.esc(t.titulo)}</strong>
                                        <small>${this.esc(t.materia)}</small>
                                    </div>
                                    <span class="tag high">${diasAte(t.dataLimite)}d</span>
                                </li>
                            `).join('')}
                            ${!tarefasUrgentes.length ? '<li>Nenhuma tarefa urgente</li>' : ''}
                        </ul>
                    </div>
                </div>
            </div>

            <div class="dashboard-grid">
                <div class="card">
                    <div class="card-header">
                        <h3><i class="fas fa-graduation-cap"></i> Próximas Provas</h3>
                        <i class="fas fa-calendar"></i>
                    </div>
                    <div class="card-body">
                        <ul class="item-list">
                            ${proximosExames.map(e => `
                                <li>
                                    <div>
                                        <strong>${this.esc(e.titulo)}</strong>
                                        <small>${this.esc(e.materia)}</small>
                                    </div>
                                    <span class="tag ${this.app.getExamRiskClass(e)}">${diasAte(e.data)}d</span>
                                </li>
                            `).join('')}
                            ${!proximosExames.length ? '<li>Nenhuma prova próxima</li>' : ''}
                        </ul>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h3><i class="fas fa-history"></i> Matérias Atrasadas</h3>
                        <i class="fas fa-book"></i>
                    </div>
                    <div class="card-body">
                        <ul class="item-list">
                            ${materiasAtrasadas.map(m => `
                                <li>
                                    <div>
                                        <strong>${this.esc(m.materia)}</strong>
                                        <small>${m.nuncaEstudou ? 'Sem registro de estudo' : `${m.dias} dias sem estudar`}</small>
                                    </div>
                                    <span class="tag ${m.nuncaEstudou || m.dias >= 7 ? 'danger' : 'warning'}">
                                        ${m.nuncaEstudou ? 'Novo' : `${m.dias}d`}
                                    </span>
                                </li>
                            `).join('')}
                            ${!materiasAtrasadas.length ? '<li>Nenhuma matéria atrasada</li>' : ''}
                        </ul>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-calendar-week"></i> Resumo da Semana</h3>
                    <i class="fas fa-chart-bar"></i>
                </div>
                <div class="card-body">
                    <div class="semana-grid">
                        ${resumoSemana.map(dia => `
                            <div class="dia-card">
                                <h4>${this.esc(dia.nome)}</h4>
                                <div class="sessao-item">
                                    <span>Estudo</span>
                                    <strong>${dia.horas.toFixed(1)}h</strong>
                                </div>
                                <div class="sessao-item">
                                    <span>Aulas</span>
                                    <strong>${dia.aulas}</strong>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-robot"></i> Plano de Hoje (IA)</h3>
                    <button class="btn-secondary" id="perguntar-ia">Perguntar à IA</button>
                </div>
                <div class="card-body">
                    <div class="plano-ia">
                        ${planoIA.map(item => `
                            <div class="plano-item">
                                <div class="plano-materia">${this.esc(item.materia)}</div>
                                <div class="plano-detalhes">
                                    <span class="tag ${this.esc(item.prioridade)}">${this.esc(item.tipo)} • ${this.esc(item.duracao)}min</span>
                                </div>
                                <div class="plano-motivo">💡 ${this.esc(item.motivo)}</div>
                                <button class="btn-secondary btn-adicionar-sessao-rapida"
                                        data-materia="${this.esc(item.materia)}"
                                        data-tipo="${this.esc(item.tipo)}"
                                        data-duracao="${this.esc(item.duracao)}">
                                    <i class="fas fa-plus"></i> Adicionar
                                </button>
                            </div>
                        `).join('')}
                        ${!planoIA.length ? '<p class="text-secondary">Nenhuma recomendação para hoje</p>' : ''}
                    </div>
                </div>
            </div>

            <div class="quick-actions">
                <button class="btn-primary" id="quick-sessao"><i class="fas fa-clock"></i> Nova Sessão</button>
                <button class="btn-primary" id="quick-tarefa"><i class="fas fa-tasks"></i> Nova Tarefa</button>
                <button class="btn-primary" id="quick-prova"><i class="fas fa-graduation-cap"></i> Nova Prova</button>
                <button class="btn-primary" id="quick-foco"><i class="fas fa-bullseye"></i> Modo Foco</button>
            </div>
        `;
    }

    renderMentorIA() {
        return `
            <div class="view-header">
                <h2><i class="fas fa-robot"></i> Mentor IA</h2>
                <div class="header-actions mentor-header-actions">
                    <button class="btn-secondary" id="ia-plano-hoje"><i class="fas fa-calendar-day"></i> Plano Hoje</button>
                    <button class="btn-secondary" id="ia-plano-semana"><i class="fas fa-calendar-week"></i> Plano Semana</button>
                    <button class="btn-secondary" id="ia-analisar-risco"><i class="fas fa-exclamation-triangle"></i> Analisar Risco</button>
                </div>
            </div>

            <div class="mentor-ia-container">
                <div class="chat-container" id="chat-container">
                    <div class="chat-messages" id="chat-messages">
                        <div class="message assistant">
                            <div class="message-content">
                                Olá! Sou seu mentor IA. Eu puxo praticamente tudo do teu site: plano do dia, tarefas, provas, notas, presença, materiais, currículo, cursos extras, rotina, gamificação, Mapa de Aprendizado e Diário de Aula. Você pode escrever normal, tipo: “me dá um raio-x completo”, “o que está atrasado?”, “o que estudar agora?”, “o que eu vi hoje?” ou qualquer outra pergunta — se eu não souber por regra fixa, eu uso IA de verdade com os teus dados para responder.
                            </div>
                        </div>
                    </div>

                    <div class="chat-input-container">
                        <input type="text" id="chat-input" placeholder="Digite sua pergunta..." class="chat-input">
                        <button class="btn-primary" id="chat-send"><i class="fas fa-paper-plane"></i></button>
                    </div>
                </div>

                <div class="sugestoes-container">
                    <h3>Sugestões de Perguntas</h3>
                    <div class="sugestoes-grid">
                        <button class="sugestao-btn" data-pergunta="Qual meu plano de estudo para hoje?">
                            <i class="fas fa-calendar-day"></i> Plano para hoje
                        </button>
                        <button class="sugestao-btn" data-pergunta="Qual o plano para a semana?">
                            <i class="fas fa-calendar-week"></i> Plano semanal
                        </button>
                        <button class="sugestao-btn" data-pergunta="Quais os riscos acadêmicos?">
                            <i class="fas fa-exclamation-triangle"></i> Riscos acadêmicos
                        </button>
                        <button class="sugestao-btn" data-pergunta="Qual a próxima aula?">
                            <i class="fas fa-chalkboard-teacher"></i> Próxima aula
                        </button>
                        <button class="sugestao-btn" data-pergunta="Próximas provas?">
                            <i class="fas fa-graduation-cap"></i> Próximas provas
                        </button>
                        <button class="sugestao-btn" data-pergunta="Dica de estudo">
                            <i class="fas fa-lightbulb"></i> Dica de estudo
                        </button>
                        <button class="sugestao-btn" data-pergunta="O que eu vi hoje? Quero revisar o conteúdo de hoje.">
                            <i class="fas fa-book-open"></i> Revisar aula de hoje
                        </button>
                        <button class="sugestao-btn" data-pergunta="O que estudar agora, por onde eu começo?">
                            <i class="fas fa-route"></i> Trilha de estudo
                        </button>
                        <button class="sugestao-btn" data-pergunta="Me dá um raio-x completo">
                            <i class="fas fa-heartbeat"></i> Raio-x completo
                        </button>
                        <button class="sugestao-btn" data-pergunta="O que está mais atrasado?">
                            <i class="fas fa-list-check"></i> O que está atrasado?
                        </button>
                        <button class="sugestao-btn" data-pergunta="Como está minha presença?">
                            <i class="fas fa-user-check"></i> Minha presença
                        </button>
                        <button class="sugestao-btn" data-pergunta="O que falta cadastrar no meu site?">
                            <i class="fas fa-database"></i> O que falta cadastrar?
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    renderGradeHoraria() {
        if (!window.scheduleManager) {
            return '<div class="card"><div class="card-body"><p class="text-secondary">Erro ao carregar grade horária</p></div></div>';
        }

        window.scheduleManager.loadAulas();

        const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        const aulas = window.scheduleManager.loadAulas() || [];
        const totalAulas = aulas.length;
        const horasSemana = this.calcularHorasAulaSemana(aulas);

        const uid = Date.now().toString();
        const viewModeId = `grade-view-mode-${uid}`;
        const daySelectId = `grade-day-select-${uid}`;
        const wrapperId = `grade-day-select-wrapper-${uid}`;
        const containerId = `schedule-vertical-container-${uid}`;

        const currentViewMode = window.scheduleManager.viewMode === 'week' ? 'semana' : 'dia';
        const currentDay = Number.isInteger(window.scheduleManager.selectedDay)
            ? window.scheduleManager.selectedDay
            : new Date().getDay();

        setTimeout(() => {
            this.setupGradeHoraria(containerId, viewModeId, daySelectId, wrapperId);
        }, 50);

        return `
            <div class="view-header">
                <h2><i class="fas fa-calendar-week"></i> Grade Horária</h2>
                <button class="btn-primary" id="btn-nova-aula"><i class="fas fa-plus"></i> Nova Aula</button>
            </div>

            <div class="card" style="margin-bottom: 24px;">
                <div class="card-body">
                    <div class="form-row" style="margin-bottom:0;">
                        <div class="form-group" style="margin-bottom:0;">
                            <label>Visualização</label>
                            <select id="${viewModeId}" class="grade-view-mode">
                                <option value="dia" ${currentViewMode === 'dia' ? 'selected' : ''}>Dia atual / um dia</option>
                                <option value="semana" ${currentViewMode === 'semana' ? 'selected' : ''}>Semana toda</option>
                            </select>
                        </div>
                        <div class="form-group" style="margin-bottom:0;" id="${wrapperId}">
                            <label>Dia</label>
                            <select id="${daySelectId}" class="grade-day-select">
                                ${dias.map((dia, index) => `
                                    <option value="${index}" ${index === currentDay ? 'selected' : ''}>${dia}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div class="schedule-container card" style="padding: 20px; margin-bottom: 24px;">
                <div id="${containerId}"></div>
            </div>

            <div class="dashboard-grid">
                <div class="card">
                    <div class="card-header">
                        <h3>Resumo da Grade</h3>
                    </div>
                    <div class="card-body">
                        <div class="stats-row">
                            <div class="stat-item">
                                <span class="stat-value">${totalAulas}</span>
                                <span class="stat-label">aulas</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-value">${horasSemana.toFixed(1)}h</span>
                                <span class="stat-label">semana</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-value">${(totalAulas ? horasSemana / totalAulas : 0).toFixed(1)}h</span>
                                <span class="stat-label">média</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="aulas-list card">
                <div class="card-header">
                    <h3>Minhas Aulas (${this.app.data.classSchedule?.length || 0})</h3>
                </div>
                <div class="card-body">
                    <ul class="item-list">
                        ${(this.app.data.classSchedule || []).map(a => `
                            <li>
                                <div>
                                    <strong>${this.esc(a.materia)}</strong><br>
                                    <small>${dias[parseInt(a.dia, 10)]} • ${this.esc(a.inicio)} - ${this.esc(a.fim)}</small>
                                    ${a.sala ? `<br><small>Sala: ${this.esc(a.sala)}</small>` : ''}
                                    ${a.professor ? `<br><small>Prof: ${this.esc(a.professor)}</small>` : ''}
                                </div>
                                <div style="display:flex; gap:8px;">
                                    <button class="btn-icon btn-editar-aula" data-id="${this.esc(a.id)}" title="Editar aula">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn-icon btn-remover-aula" data-id="${this.esc(a.id)}" title="Remover aula" style="color: var(--accent-danger);">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </li>
                        `).join('') || '<li>Nenhuma aula cadastrada</li>'}
                    </ul>
                </div>
            </div>
        `;
    }

    setupGradeHoraria(containerId, viewModeId, daySelectId, wrapperId) {
        const container = document.getElementById(containerId);
        const modoSelect = document.getElementById(viewModeId);
        const diaSelect = document.getElementById(daySelectId);
        const dayWrapper = document.getElementById(wrapperId);

        if (!container || !window.scheduleManager || !modoSelect || !diaSelect) return;

        const renderizar = () => {
            const modo = modoSelect.value;
            const diaSelecionado = parseInt(diaSelect.value, 10);

            if (dayWrapper) {
                dayWrapper.style.display = modo === 'semana' ? 'none' : 'block';
            }

            window.scheduleManager.viewMode = modo === 'semana' ? 'week' : 'day';
            window.scheduleManager.selectedDay = diaSelecionado;

            const aulas = window.scheduleManager.loadAulas() || [];

            if (!aulas.length) {
                container.innerHTML = '<p class="text-secondary" style="padding:20px;">Nenhuma aula cadastrada</p>';
                return;
            }

            if (modo === 'semana') {
                window.scheduleManager.renderGradeSemanalGrid(containerId);
            } else {
                window.scheduleManager.renderGradeDia(diaSelecionado, containerId);
            }
        };

        renderizar();

        modoSelect.addEventListener('change', renderizar);
        diaSelect.addEventListener('change', renderizar);
    }

    renderGradeSemanalComHoras(containerId) {
        const container = document.getElementById(containerId);
        if (!container || !window.scheduleManager) return;

        const aulas = window.scheduleManager.loadAulas() || [];
        const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        const hoje = new Date().getDay();

        // Agenda vertical: um bloco por dia, aulas empilhadas em cards.
        // Sem colunas fixas por dia, então nunca precisa de scroll lateral.
        const diasComAula = dias
            .map((nome, index) => ({
                nome,
                index,
                aulas: aulas
                    .filter(a => parseInt(a.dia, 10) === index)
                    .sort((a, b) => String(a.inicio).localeCompare(String(b.inicio)))
            }))
            .filter(d => d.aulas.length);

        if (!diasComAula.length) {
            container.innerHTML = `
                <div class="no-classes-message">
                    <i class="fas fa-calendar-times"></i>
                    <p>Nenhuma aula cadastrada</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="week-agenda">
                ${diasComAula.map(d => {
                    const totalMin = d.aulas.reduce((soma, a) => soma + calcularDuracaoMinutos(a.inicio, a.fim), 0);
                    const totalH = (totalMin / 60).toFixed(1).replace(/\.0$/, '');
                    return `
                        <div class="week-agenda-day ${d.index === hoje ? 'is-today' : ''}">
                            <div class="week-agenda-day-header">
                                <h4>${d.nome}${d.index === hoje ? '<span class="week-agenda-today-tag">hoje</span>' : ''}</h4>
                                <span class="week-agenda-day-total">${d.aulas.length} aula${d.aulas.length > 1 ? 's' : ''} • ${totalH}h</span>
                            </div>
                            <div class="week-agenda-day-list">
                                ${d.aulas.map(aula => {
                                    const cor = aula.cor || '#3b82f6';
                                    return `
                                        <div class="week-agenda-item" data-aula-id="${this.esc(aula.id)}" style="border-left-color:${cor};">
                                            <div class="week-agenda-time">
                                                <strong>${this.esc(aula.inicio)}</strong>
                                                <span>${this.esc(aula.fim)}</span>
                                            </div>
                                            <div class="week-agenda-info">
                                                <strong>${this.esc(aula.materia)}</strong>
                                                <div class="week-agenda-meta">
                                                    ${aula.sala ? `<span>📍 ${this.esc(aula.sala)}</span>` : ''}
                                                    ${aula.professor ? `<span>👤 ${this.esc(aula.professor)}</span>` : ''}
                                                </div>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        container.querySelectorAll('.week-agenda-item').forEach(item => {
            item.addEventListener('click', e => {
                const aulaId = e.currentTarget.dataset.aulaId;
                if (aulaId && window.app) {
                    window.app.openAulaModal(aulaId);
                }
            });
        });
    }

    renderSessoes() {
        const hoje = toDateString();
        const agora = new Date();

        const sessoesHoje = this.app.data.sessions.filter(s => toDateString(s.data) === hoje && !s.concluida);
        const futuras = this.app.data.sessions
            .filter(s => new Date(s.data) > agora && !s.concluida && toDateString(s.data) !== hoje)
            .sort((a, b) => new Date(a.data) - new Date(b.data));

        const concluidas = this.app.data.sessions
            .filter(s => s.concluida)
            .sort((a, b) => new Date(b.data) - new Date(a.data))
            .slice(0, 10);

        return `
            <div class="view-header">
                <h2><i class="fas fa-clock"></i> Sessões de Estudo</h2>
                <button class="btn-primary" id="btn-nova-sessao"><i class="fas fa-plus"></i> Nova Sessão</button>
            </div>

            <div class="dashboard-grid">
                <div class="card">
                    <div class="card-header"><h3>⏰ Hoje (${sessoesHoje.length})</h3></div>
                    <div class="card-body">
                        <ul class="item-list">
                            ${sessoesHoje.map(s => `
                                <li>
                                    <div>
                                        <strong>${this.esc(s.materia)}</strong>
                                        <small>${this.esc(s.tipo)} • ${this.esc(s.duracao)}min • ${formatarHora(s.data)}</small>
                                    </div>
                                    <div style="display:flex; gap:8px;">
                                        <button class="btn-icon btn-editar-sessao" data-id="${this.esc(s.id)}" title="Editar sessão">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button class="btn-icon btn-concluir-sessao" data-id="${this.esc(s.id)}" title="Concluir sessão">
                                            <i class="fas fa-check-circle"></i>
                                        </button>
                                        <button class="btn-icon btn-excluir-sessao" data-id="${this.esc(s.id)}" title="Excluir sessão" style="color: var(--accent-danger);">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </li>
                            `).join('')}
                            ${!sessoesHoje.length ? '<li>Nenhuma sessão programada para hoje</li>' : ''}
                        </ul>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header"><h3>📅 Próximas (${futuras.length})</h3></div>
                    <div class="card-body">
                        <ul class="item-list">
                            ${futuras.map(s => `
                                <li>
                                    <div>
                                        <strong>${this.esc(s.materia)}</strong>
                                        <small>${formatarData(s.data)} • ${formatarHora(s.data)} • ${this.esc(s.tipo)}</small>
                                    </div>
                                    <div style="display:flex; gap:8px;">
                                        <button class="btn-icon btn-editar-sessao" data-id="${this.esc(s.id)}" title="Editar sessão">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button class="btn-icon btn-excluir-sessao" data-id="${this.esc(s.id)}" title="Excluir sessão" style="color: var(--accent-danger);">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </li>
                            `).join('')}
                            ${!futuras.length ? '<li>Nenhuma sessão futura</li>' : ''}
                        </ul>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header"><h3>✅ Concluídas Recentemente</h3></div>
                    <div class="card-body">
                        <ul class="item-list">
                            ${concluidas.map(s => `
                                <li>
                                    <div>
                                        <strong>${this.esc(s.materia)}</strong>
                                        <small>${formatarData(s.data)}</small>
                                    </div>
                                    <div style="display:flex; gap:8px;">
                                        <i class="fas fa-check" style="color: var(--accent-success);"></i>
                                        <button class="btn-icon btn-excluir-sessao" data-id="${this.esc(s.id)}" title="Excluir sessão" style="color: var(--accent-danger);">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </li>
                            `).join('')}
                            ${!concluidas.length ? '<li>Nenhuma sessão concluída</li>' : ''}
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }

    renderTarefas() {
        // Tarefas são registros independentes: não ocultá-las pelo status atual
        // da matéria, pois isso fazia tarefas recém-cadastradas parecerem perdidas.
        const tasksAtuais = Array.isArray(this.app.data.tasks) ? this.app.data.tasks : [];

        const pendentes = tasksAtuais
            .filter(t => !t.concluida)
            .sort((a, b) => new Date(a.dataLimite) - new Date(b.dataLimite));

        const concluidas = tasksAtuais
            .filter(t => t.concluida)
            .sort((a, b) => new Date(b.dataLimite) - new Date(a.dataLimite));

        return `
            <div class="view-header">
                <h2><i class="fas fa-tasks"></i> Tarefas</h2>
                <button class="btn-primary" id="btn-nova-tarefa"><i class="fas fa-plus"></i> Nova Tarefa</button>
            </div>
            <div class="dashboard-grid">
                <div class="card">
                    <div class="card-header"><h3>📋 Pendentes (${pendentes.length})</h3></div>
                    <div class="card-body">
                        <ul class="item-list">
                            ${pendentes.map(t => `
                                <li class="task-list-item">
                                    <div class="task-list-content">
                                        <strong>${this.esc(t.titulo)}</strong>
                                        <small>${this.esc(t.materia)} • até ${formatarData(t.dataLimite)}</small>
                                    </div>
                                    <div class="task-list-actions" style="display:flex; gap:8px;">
                                        <span class="tag ${this.esc(t.prioridade)}">${this.esc(t.prioridade)}</span>
                                        <button class="btn-icon btn-editar-tarefa" data-id="${this.esc(t.id)}" title="Editar tarefa">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button class="btn-icon btn-concluir-tarefa" data-id="${this.esc(t.id)}" title="Concluir tarefa">
                                            <i class="fas fa-check-circle"></i>
                                        </button>
                                        <button class="btn-icon btn-excluir-tarefa" data-id="${this.esc(t.id)}" title="Excluir tarefa" style="color: var(--accent-danger);">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </li>
                            `).join('')}
                            ${!pendentes.length ? '<li>Nenhuma tarefa pendente</li>' : ''}
                        </ul>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header"><h3>✅ Concluídas (${concluidas.length})</h3></div>
                    <div class="card-body">
                        <ul class="item-list">
                            ${concluidas.slice(0, 10).map(t => `
                                <li class="task-list-item">
                                    <div class="task-list-content">
                                        <strong>${this.esc(t.titulo)}</strong>
                                        <small>${this.esc(t.materia)}</small>
                                    </div>
                                    <div class="task-list-actions" style="display:flex; gap:8px;">
                                        <i class="fas fa-check" style="color: var(--accent-success);"></i>
                                        <button class="btn-icon btn-editar-tarefa" data-id="${this.esc(t.id)}" title="Editar tarefa">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button class="btn-icon btn-excluir-tarefa" data-id="${this.esc(t.id)}" title="Excluir tarefa" style="color: var(--accent-danger);">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </li>
                            `).join('')}
                            ${!concluidas.length ? '<li>Nenhuma tarefa concluída</li>' : ''}
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }

    renderProvaMeta(e) {
        const partes = [this.esc(e.tipo), formatarData(e.data)];
        if (e.horario) partes.push(`⏰ ${this.esc(e.horario)}`);
        if (e.local) partes.push(`📍 ${this.esc(e.local)}`);
        if (e.peso && e.peso !== 100) partes.push(`peso ${this.esc(e.peso)}%`);
        return partes.join(' • ');
    }

    renderProvaItem(e, { passada = false } = {}) {
        return `
            <li class="prova-item">
                <div>
                    <strong>${this.esc(e.titulo)}</strong>
                    <small>${this.renderProvaMeta(e)}</small>
                    ${e.observacoes ? `<small class="prova-obs"><i class="fas fa-circle-info"></i> ${this.esc(e.observacoes)}</small>` : ''}
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                    ${passada
                        ? `<span class="tag ${e.concluida ? 'success' : 'warning'}">${e.concluida ? 'Concluído' : 'Data passada'}</span>`
                        : `<span class="tag ${this.app.getExamRiskClass(e)}">${diasAte(e.data)} dias</span>`
                    }
                    <button class="btn-icon btn-concluir-prova" data-id="${this.esc(e.id)}" title="${e.concluida ? 'Marcar como pendente' : 'Marcar como concluído'}">
                        <i class="fas ${e.concluida ? 'fa-rotate-left' : 'fa-check'}"></i>
                    </button>
                    <button class="btn-icon btn-editar-prova" data-id="${this.esc(e.id)}" title="Editar evento">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-excluir-prova" data-id="${this.esc(e.id)}" title="Excluir evento" style="color: var(--accent-danger);">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </li>
        `;
    }

    renderProvas() {
        const agora = toDateOnly(new Date());
        const { atuais: examsAtuais, arquivadas } = this.app.filterSemestreAtual(this.app.data.exams, 'materia');

        const proximas = examsAtuais
            .filter(e => toDateOnly(e.data) >= agora && !e.concluida)
            .sort((a, b) => new Date(a.data) - new Date(b.data));

        const passadas = examsAtuais
            .filter(e => toDateOnly(e.data) < agora || e.concluida)
            .sort((a, b) => new Date(b.data) - new Date(a.data))
            .slice(0, 15);

        // Agrupa os próximos eventos por matéria, ordenando os grupos pelo evento mais próximo
        const grupos = {};
        proximas.forEach(e => {
            if (!grupos[e.materia]) grupos[e.materia] = [];
            grupos[e.materia].push(e);
        });
        const materiasOrdenadas = Object.keys(grupos).sort((a, b) =>
            new Date(grupos[a][0].data) - new Date(grupos[b][0].data)
        );

        return `
            <div class="view-header">
                <h2><i class="fas fa-graduation-cap"></i> Provas e Trabalhos</h2>
                <button class="btn-primary" id="btn-nova-prova"><i class="fas fa-plus"></i> Novo Evento</button>
            </div>
            ${arquivadas ? `<p class="text-secondary archived-note"><i class="fas fa-box-archive"></i> ${arquivadas} matéria${arquivadas > 1 ? 's' : ''} arquivada${arquivadas > 1 ? 's' : ''} (fora do semestre atual) — as provas continuam salvas em Grade Curricular › Semestres anteriores.</p>` : ''}

            <h3 class="section-subtitle">📅 Próximos por matéria (${proximas.length})</h3>
            <div class="mapa-grid mapa-grid-compact">
                ${materiasOrdenadas.map(materia => {
                    const eventos = grupos[materia];
                    return `
                        <div class="card materia-map" data-materia-prova="${this.esc(materia)}">
                            <button type="button" class="card-header materia-map-toggle" data-toggle-materia-prova>
                                <h3>${this.esc(materia)}</h3>
                                <span class="badge">${eventos.length} evento${eventos.length === 1 ? '' : 's'} • próx. ${diasAte(eventos[0].data)}d</span>
                                <i class="fas fa-chevron-down materia-map-chevron"></i>
                            </button>
                            <div class="card-body materia-map-body">
                                <ul class="item-list">
                                    ${eventos.map(e => this.renderProvaItem(e)).join('')}
                                </ul>
                            </div>
                        </div>
                    `;
                }).join('')}
                ${!materiasOrdenadas.length ? '<p class="text-secondary">Nenhum evento próximo</p>' : ''}
            </div>

            <div class="card" style="margin-top:20px;">
                <div class="card-header"><h3>📜 Eventos Passados</h3></div>
                <div class="card-body">
                    <ul class="item-list">
                        ${passadas.map(e => this.renderProvaItem(e, { passada: true })).join('')}
                        ${!passadas.length ? '<li>Nenhum evento passado</li>' : ''}
                    </ul>
                </div>
            </div>
        `;
    }

    renderMapaAprendizado() {
        return `
            <div class="view-header">
                <h2><i class="fas fa-map"></i> Mapa de Aprendizado</h2>
                <button class="btn-primary" id="btn-novo-topico"><i class="fas fa-plus"></i> Novo Tópico</button>
            </div>

            <div class="mapa-grid mapa-grid-compact">
                ${this.app.data.subjects.map(s => {
                    const topicos = this.app.data.learningMap.filter(t => t.materia === s.nome);
                    const dominados = topicos.filter(t => String(t.status).toLowerCase() === 'dominado').length;
                    return `
                        <div class="card materia-map materia-map-collapsed" data-materia-map="${this.esc(s.nome)}">
                            <button type="button" class="card-header materia-map-toggle" data-toggle-materia-map>
                                <h3>${this.esc(s.nome)}</h3>
                                <span class="badge">${topicos.length} tópico${topicos.length === 1 ? '' : 's'}${dominados ? ` • ${dominados} dominado${dominados === 1 ? '' : 's'}` : ''}</span>
                                <i class="fas fa-chevron-down materia-map-chevron"></i>
                            </button>
                            <div class="card-body materia-map-body" hidden>
                                ${topicos.map(t => `
                                    <div class="topico-item">
                                        <div class="topico-info">
                                            <strong>${this.esc(t.nome)}</strong>
                                            <span class="tag ${this.esc(t.status)}">${this.esc(t.status)}</span>
                                        </div>
                                        <div class="topico-meta">
                                            <span>📊 ${this.esc(t.dificuldade)}/5</span>
                                            <span>🎯 ${this.esc(t.confianca)}/5</span>
                                            <span>🔄 ${t.ultimaRevisao ? diasDesde(t.ultimaRevisao) : 0}d</span>
                                        </div>
                                        <div style="margin-top:10px; display:flex; justify-content:flex-end; gap:8px;">
                                            <button class="btn-icon btn-editar-topico" data-id="${this.esc(t.id)}" title="Editar tópico">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button class="btn-icon btn-excluir-topico" data-id="${this.esc(t.id)}" title="Excluir tópico" style="color: var(--accent-danger);">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </div>
                                `).join('')}
                                ${!topicos.length ? '<p class="text-secondary">Nenhum tópico cadastrado</p>' : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    renderMateriais() {
        const totalMateriais = this.app.data.materials.length;

        return `
            <div class="view-header">
                <h2><i class="fas fa-folder"></i> Materiais de Estudo</h2>
                <button class="btn-primary" id="btn-novo-material"><i class="fas fa-plus"></i> Novo Material</button>
            </div>

            ${!totalMateriais ? `
                <div class="card materiais-intro-card">
                    <div class="card-body">
                        <h3><i class="fas fa-lightbulb"></i> Pra que serve essa tela?</h3>
                        <p class="text-secondary">É onde você guarda, por matéria, tudo que usa pra estudar — sem precisar procurar de novo depois. Cada item fica um clique de distância dentro da matéria certa.</p>
                        <div class="materiais-intro-grid">
                            <div class="materiais-intro-item"><i class="fas fa-link"></i><div><strong>Link</strong><span>Site, PDF online, playlist, artigo</span></div></div>
                            <div class="materiais-intro-item"><i class="fas fa-file-pdf"></i><div><strong>PDF</strong><span>Apostila, slide da aula, resumo</span></div></div>
                            <div class="materiais-intro-item"><i class="fas fa-video"></i><div><strong>Vídeo</strong><span>Aula gravada, videoaula do YouTube</span></div></div>
                            <div class="materiais-intro-item"><i class="fas fa-sticky-note"></i><div><strong>Anotação</strong><span>Texto livre: fórmulas, resumo, lembrete</span></div></div>
                        </div>
                        <p class="text-secondary" style="margin-top:12px;">Ex: antes de uma prova, abra a matéria aqui e já tem tudo junto — em vez de vasculhar o WhatsApp ou o Drive.</p>
                    </div>
                </div>
            ` : ''}

            <div class="materiais-grid">
                ${this.app.data.subjects.map(s => {
                    const materiais = this.app.data.materials.filter(m => m.materia === s.nome);
                    return `
                        <div class="card">
                            <div class="card-header">
                                <h3>${this.esc(s.nome)}</h3>
                                <span>${materiais.length} itens</span>
                            </div>
                            <div class="card-body">
                                <ul class="item-list">
                                    ${materiais.map(m => {
                                        const isExternal = ['link', 'pdf', 'video'].includes(m.tipo);
                                        const contentPreview = m.tipo === 'anotacao'
                                            ? `<small>${this.esc(String(m.conteudo || '').slice(0, 80))}${String(m.conteudo || '').length > 80 ? '...' : ''}</small>`
                                            : `<small>${this.esc(m.tipo)}</small>`;

                                        return `
                                            <li>
                                                <div style="display:flex; align-items:center; gap:8px;">
                                                    <i class="fas ${this.getMaterialIcon(m.tipo)}"></i>
                                                    <div>
                                                        <strong>${this.esc(m.titulo)}</strong><br>
                                                        ${contentPreview}
                                                    </div>
                                                </div>
                                                <div style="display:flex; gap:8px;">
                                                    ${isExternal ? `
                                                        <a href="${this.esc(m.conteudo)}" target="_blank" rel="noopener noreferrer" class="btn-icon" title="Abrir material">
                                                            <i class="fas fa-external-link-alt"></i>
                                                        </a>
                                                    ` : ''}
                                                    <button class="btn-icon btn-editar-material" data-id="${this.esc(m.id)}" title="Editar material">
                                                        <i class="fas fa-edit"></i>
                                                    </button>
                                                    <button class="btn-icon btn-excluir-material" data-id="${this.esc(m.id)}" title="Excluir material" style="color: var(--accent-danger);">
                                                        <i class="fas fa-trash"></i>
                                                    </button>
                                                </div>
                                            </li>
                                        `;
                                    }).join('')}
                                    ${!materiais.length ? '<li>Nenhum material cadastrado</li>' : ''}
                                </ul>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    renderCalendario() {
        const hoje = new Date();
        const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
        const diasNoMes = ultimoDia.getDate();
        const primeiroDiaSemana = primeiroDia.getDay();

        const dias = [];
        for (let i = 0; i < primeiroDiaSemana; i++) dias.push(null);
        for (let i = 1; i <= diasNoMes; i++) dias.push(i);

        const eventosBrutos = [
            ...this.app.data.sessions.map(s => ({ ...s, tipo: 'sessao', data: s.data, label: s.topico || s.materia })),
            ...this.app.data.tasks.map(t => ({ ...t, tipo: 'tarefa', data: t.dataLimite, label: t.titulo })),
            ...this.app.data.exams.map(e => ({ ...e, tipo: 'exame', data: e.data, label: e.titulo }))
        ];
        const { atuais: eventos, arquivadas } = this.app.filterSemestreAtual(eventosBrutos, 'materia');

        return `
            <h2><i class="fas fa-calendar"></i> Calendário</h2>
            ${arquivadas ? `<p class="text-secondary archived-note"><i class="fas fa-box-archive"></i> ${arquivadas} matéria${arquivadas > 1 ? 's' : ''} arquivada${arquivadas > 1 ? 's' : ''} (fora do semestre atual) escondida${arquivadas > 1 ? 's' : ''} do calendário.</p>` : ''}

            <div class="card">
                <div class="card-header">
                    <h3>${hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h3>
                </div>
                <div class="card-body">
                    <div class="calendar-grid">
                        <div class="calendar-weekdays">
                            <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
                        </div>
                        <div class="calendar-days">
                            ${dias.map(d => {
                                if (!d) return '<div class="calendar-day empty"></div>';

                                const eventosDia = eventos.filter(e => {
                                    const data = new Date(e.data);
                                    return data.getDate() === d &&
                                        data.getMonth() === hoje.getMonth() &&
                                        data.getFullYear() === hoje.getFullYear();
                                });

                                return `
                                    <div class="calendar-day ${eventosDia.length ? 'has-events' : ''}">
                                        <span class="day-number">${d}</span>
                                        ${eventosDia.length ? `
                                            <div class="day-events">
                                                ${eventosDia.slice(0, 3).map(e => `
                                                    <div class="event-indicator" title="${this.esc(e.label)}">
                                                        <i class="fas ${this.getEventIcon(e.tipo)}"></i>
                                                    </div>
                                                `).join('')}
                                                ${eventosDia.length > 3 ? `<span class="more-events">+${eventosDia.length - 3}</span>` : ''}
                                            </div>
                                        ` : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderPrevisaoNotas() {
        // app.data.subjects já é sincronizado automaticamente com a Grade
        // Curricular (subjects-curriculum-sync.js) e só contém matérias
        // "cursando" (+ matérias criadas manualmente, fora do plano). O
        // filtro abaixo é uma segunda camada de proteção, caso o status de
        // uma matéria mude sem passar por esse sincronismo.
        const { atuais: subjectsAtuais, arquivadas } = this.app.filterSemestreAtual(this.app.data.subjects, 'nome');

        return `
            <div class="view-header">
                <h2><i class="fas fa-chart-line"></i> Previsão de Notas</h2>
                <button class="btn-primary" id="btn-registrar-nota"><i class="fas fa-plus"></i> Registrar Nota</button>
            </div>
            ${arquivadas ? `<p class="text-secondary archived-note"><i class="fas fa-box-archive"></i> ${arquivadas} matéria${arquivadas > 1 ? 's' : ''} arquivada${arquivadas > 1 ? 's' : ''} (fora do semestre atual) — as notas continuam salvas em Grade Curricular › Semestres anteriores.</p>` : ''}

            <div class="dashboard-grid">
                ${subjectsAtuais.map(s => {
                    const notas = this.app.data.grades.filter(g => g.materia === s.nome);
                    const media = this.app.calcularMedia(notas);
                    const previsao = this.app.calcularPrevisaoNota(s, notas);

                    return `
                        <div class="card subject-grade-card">
                            <div class="card-header">
                                <h3>${this.esc(s.nome)}</h3>
                                <span class="risk-indicator risk-${this.esc(previsao.risco)}">${this.esc(previsao.risco)}</span>
                            </div>
                            <div class="card-body">
                                <div class="grade-stats">
                                    <div class="grade-item">
                                        <span class="grade-label">Média atual</span>
                                        <span class="grade-value">${media.toFixed(1)}</span>
                                        <span class="grade-context">nas avaliações</span>
                                    </div>
                                    <div class="grade-item">
                                        <span class="grade-label">Nota desejada</span>
                                        <span class="grade-value">${this.esc(s.notaDesejada)}</span>
                                        <span class="grade-context">média final</span>
                                    </div>
                                    <div class="grade-item">
                                        <span class="grade-label">Necessário</span>
                                        <span class="grade-value">${this.esc(previsao.notaNecessaria)}</span>
                                        <span class="grade-context">nas avaliações restantes</span>
                                    </div>
                                </div>
                                <div class="grade-accumulated-note">
                                    <span><strong>${this.esc(previsao.acumulado)}</strong>/10 acumulado</span>
                                    <span>${this.esc(previsao.pesoConcluido)}% das avaliações lançadas</span>
                                </div>
                                <div class="progress-container grade-goal-progress">
                                    <div class="progress-label">
                                        <span>${this.esc(previsao.indicadorLabel || 'Progresso para meta')}</span>
                                        <span>${this.esc(previsao.indicadorValor || '—')}</span>
                                    </div>
                                    <div class="progress-bar">
                                        <div class="progress-fill" style="width: ${previsao.progressoMeta || 0}%"></div>
                                    </div>
                                    <small class="grade-progress-note">Indicador objetivo baseado no que já entrou na média; não representa probabilidade estatística.</small>
                                </div>
                                <p class="previsao-motivo">💡 ${this.esc(previsao.motivo)}</p>
                                
                                <div style="margin-top:16px;">
                                    <h4>Notas Registradas</h4>
                                    <ul class="item-list">
                                        ${notas.map(n => `
                                            <li>
                                                <div>
                                                    <strong>${this.esc(n.avaliacao)}</strong>
                                                    <small>Nota: ${this.esc(n.valor)} • Peso: ${this.esc(n.peso)}%</small>
                                                </div>
                                                <div style="display:flex; gap:8px;">
                                                    <button class="btn-icon btn-editar-nota" data-id="${this.esc(n.id)}" title="Editar nota">
                                                        <i class="fas fa-edit"></i>
                                                    </button>
                                                    <button class="btn-icon btn-excluir-nota" data-id="${this.esc(n.id)}" title="Excluir nota" style="color: var(--accent-danger);">
                                                        <i class="fas fa-trash"></i>
                                                    </button>
                                                </div>
                                            </li>
                                        `).join('')}
                                        ${!notas.length ? '<li>Nenhuma nota registrada</li>' : ''}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    renderHabitos() {
        const habitos = this.getHabitosDefinition();

        const hoje = toDateString();

        return `
            <h2><i class="fas fa-heart"></i> Hábitos e Rotina</h2>

            <div class="dashboard-grid">
                <div class="card">
                    <div class="card-header">
                        <h3>📋 Hábitos Diários</h3>
                    </div>
                    <div class="card-body">
                        <div class="habitos-list">
                            ${habitos.map(h => {
                                const feito = this.app.data.habits.some(hb => hb.id === h.id && toDateString(hb.data) === hoje);
                                return `
                                    <div class="habito-item">
                                        <div class="habito-info">
                                            <i class="fas ${h.icone}"></i>
                                            <span>${this.esc(h.nome)}</span>
                                        </div>
                                        <button class="btn-icon toggle-habito ${feito ? 'active' : ''}" data-habito="${this.esc(h.id)}">
                                            <i class="fas ${feito ? 'fa-check-circle' : 'fa-circle'}"></i>
                                        </button>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h3>📊 Consistência Semanal</h3>
                    </div>
                    <div class="card-body">
                        <div class="consistency-chart">
                            ${this.renderConsistencyChart()}
                        </div>
                        <div class="consistency-stats">
                            <div class="stat-item">
                                <span class="stat-value">${this.app.calcularConsistencia()}%</span>
                                <span class="stat-label">esta semana</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-value">${this.esc(this.app.data.user?.streak || 0)}</span>
                                <span class="stat-label">dias seguidos</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderEstatisticas() {
        const horasPorMateria = this.app.calcularHorasPorMateria();
        const horasPorTipo = this.app.calcularHorasPorTipo();
        const total = this.app.data.sessions.filter(s => s.concluida)
            .reduce((a, s) => a + s.duracao / 60, 0);

        const maxHorasMateria = horasPorMateria.length ? Math.max(...horasPorMateria.map(h => h.horas)) : 1;
        const maxHorasTipo = horasPorTipo.length ? Math.max(...horasPorTipo.map(t => t.horas)) : 1;

        const situacao = this.app.getAcademicSituationSummary ? this.app.getAcademicSituationSummary() : null;
        const { atuais: examsAtuais } = this.app.filterSemestreAtual(this.app.data.exams, 'materia');
        const provasConcluidas = examsAtuais.filter(e => e.concluida).length;
        const provasPendentes = examsAtuais.length - provasConcluidas;

        return `
            <h2><i class="fas fa-chart-bar"></i> Estatísticas</h2>

            <div class="dashboard-grid">
                <div class="card">
                    <div class="card-header"><h3>⏱️ Total Estudado</h3></div>
                    <div class="card-body text-center">
                        <div class="big-number">${total.toFixed(1)}</div>
                        <p>horas no total</p>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header"><h3>📊 Média Diária</h3></div>
                    <div class="card-body text-center">
                        <div class="big-number">${this.app.calcularMediaDiaria()}</div>
                        <p>horas por dia</p>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header"><h3>🔥 Melhor Dia</h3></div>
                    <div class="card-body text-center">
                        <div class="big-number">${this.esc(this.app.calcularMelhorDia())}</div>
                        <p>${this.app.calcularMelhorDiaHoras()}h</p>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header"><h3>✅ Tarefas</h3></div>
                    <div class="card-body text-center">
                        <div class="big-number">${this.app.calcularTaxaConclusaoTarefas()}%</div>
                        <p>concluídas</p>
                    </div>
                </div>

                ${situacao ? `
                <div class="card">
                    <div class="card-header"><h3>🎓 Média Geral</h3></div>
                    <div class="card-body text-center">
                        <div class="big-number">${this.esc(situacao.generalAverage)}</div>
                        <p>nas matérias com nota lançada</p>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header"><h3>🙋 Presença Média</h3></div>
                    <div class="card-body text-center">
                        <div class="big-number">${situacao.avgAttendance !== null ? `${situacao.avgAttendance}%` : '—'}</div>
                        <p>${situacao.avgAttendance !== null ? 'nas matérias com diário registrado' : 'registre o Diário de Aula para ver'}</p>
                    </div>
                </div>
                ` : ''}

                <div class="card">
                    <div class="card-header"><h3>📝 Provas e Trabalhos</h3></div>
                    <div class="card-body text-center">
                        <div class="big-number">${provasConcluidas}/${examsAtuais.length}</div>
                        <p>${provasPendentes > 0 ? `${provasPendentes} pendente${provasPendentes > 1 ? 's' : ''}` : 'tudo em dia'}</p>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header"><h3>📚 Horas por Matéria</h3></div>
                <div class="card-body">
                    ${horasPorMateria.map(item => `
                        <div class="stat-row">
                            <div class="stat-label">${this.esc(item.materia)}</div>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${(item.horas / maxHorasMateria) * 100}%"></div>
                            </div>
                            <div class="stat-value">${item.horas.toFixed(1)}h</div>
                        </div>
                    `).join('')}
                    ${!horasPorMateria.length ? '<p class="text-secondary">Nenhuma sessão de estudo registrada ainda.</p>' : ''}
                </div>
            </div>

            <div class="card">
                <div class="card-header"><h3>📖 Tipos de Estudo</h3></div>
                <div class="card-body">
                    <div class="tipos-grid">
                        ${horasPorTipo.map(t => `
                            <div class="tipo-item">
                                <div class="tipo-header">
                                    <span>${this.esc(t.tipo)}</span>
                                    <span>${t.horas.toFixed(1)}h</span>
                                </div>
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${(t.horas / maxHorasTipo) * 100}%"></div>
                                </div>
                            </div>
                        `).join('')}
                        ${!horasPorTipo.length ? '<p class="text-secondary">Nenhum dado ainda.</p>' : ''}
                    </div>
                </div>
            </div>
        `;
    }

    renderModoFoco() {
        const hoje = toDateString();
        const sessoesHoje = (this.app.data.sessions || [])
            .filter(s => !s.concluida && toDateString(s.data) === hoje)
            .sort((a, b) => new Date(a.data) - new Date(b.data));
        const materias = (this.app.data.subjects || []).slice().sort((a, b) => a.nome.localeCompare(b.nome));

        const optsSessao = sessoesHoje.map(s => `<option value="${this.esc(s.id)}" data-materia="${this.esc(s.materia)}" data-duracao="${this.esc(s.duracao || '')}">${this.esc(s.materia)} • ${this.esc(s.tipo)} (${formatarHora(s.data)})</option>`).join('');
        const optsMateria = materias.map(m => `<option value="${this.esc(m.nome)}">${this.esc(m.nome)}</option>`).join('');

        return `
            <h2><i class="fas fa-clock"></i> Modo Foco</h2>

            <div class="card timer-card">
                <div class="card-body text-center">
                    <div class="timer-display" id="timer-display">25:00</div>

                    <div class="timer-settings">
                        ${sessoesHoje.length ? `
                        <select id="timer-sessao-vinculada" class="timer-select">
                            <option value="">🔓 Sessão livre (não vincular)</option>
                            ${optsSessao}
                        </select>` : ''}
                        <select id="timer-materia" class="timer-select">
                            <option value="">Sem matéria específica</option>
                            ${optsMateria}
                        </select>
                        <input id="timer-topico" class="timer-select" list="timer-topicos-list" placeholder="Tópico (opcional, ex.: Regra da cadeia)" autocomplete="off">
                        <datalist id="timer-topicos-list">
                            ${(this.app.data.learningMap || []).map(t => `<option value="${this.esc(t.nome)}"></option>`).join('')}
                        </datalist>
                        <select id="timer-duracao" class="timer-select">
                            <option value="25">Pomodoro (25 min)</option>
                            <option value="50">Estudo longo (50 min)</option>
                            <option value="90">Bloco pesado (90 min)</option>
                            <option value="15">Pausa curta (15 min)</option>
                        </select>
                    </div>
                    <p class="text-secondary" id="timer-vinculo-info" style="font-size:0.85em;margin-top:-8px;">
                        ${sessoesHoje.length ? 'Vincule a uma sessão programada de hoje para marcá-la como concluída automaticamente ao terminar o foco.' : 'Nenhuma sessão programada para hoje — crie uma em "Sessões de Estudo" para poder vinculá-la aqui.'}
                    </p>

                    <div class="timer-controls">
                        <button class="timer-btn start" id="timer-start">
                            <i class="fas fa-play"></i> Iniciar
                        </button>
                        <button class="timer-btn pause" id="timer-pause" style="display: none;">
                            <i class="fas fa-pause"></i> Pausar
                        </button>
                        <button class="timer-btn break" id="focus-break-start" style="display: none;">
                            <i class="fas fa-mug-hot"></i> Descanso <span id="focus-break-label">5 min</span>
                        </button>
                        <button class="timer-btn reset" id="timer-reset">
                            <i class="fas fa-undo"></i> Reset
                        </button>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3>📊 Sessões de Foco Hoje</h3>
                </div>
                <div class="card-body">
                    <ul class="item-list" id="sessoes-foco-hoje">
                        ${this.renderSessoesFocoHoje()}
                    </ul>
                </div>
            </div>
        `;
    }

    renderConfiguracoes(aba = null) {
        const s = this.app.data.settings || {};
        const user = this.app.data.user || {};
        const email = this.esc(auth.currentUser?.email || 'Não conectado');

        const abas = [
            { id: 'geral',    icon: 'fa-sliders-h',   label: 'Geral',      desc: 'Notificações, planejamento e modo pesado' },
            { id: 'perfil',   icon: 'fa-user',        label: 'Perfil e conta', desc: 'Dados pessoais, semestre atual e sair da conta' },
            { id: 'notificacoes', icon: 'fa-bell',    label: 'Notificações', desc: 'Alarmes push de provas, tarefas, sessões, revisões e aulas' },
            { id: 'calendario', icon: 'fa-calendar-alt', label: 'Calendário', desc: 'Assinatura de calendário externo (Google, Apple, Outlook)' },
            { id: 'tema',     icon: 'fa-palette',     label: 'Tema',       desc: 'Aparência e tamanho da fonte' },
            { id: 'dados',    icon: 'fa-database',    label: 'Dados',      desc: 'Backup, restauração e limpeza de dados' },
            { id: 'sobre',    icon: 'fa-info-circle', label: 'Sobre',      desc: 'Versão do app e conta conectada' },
        ];

        // Tela inicial: só o menu de categorias, sem detalhes.
        if (!aba) {
            const itensMenu = abas.map(a => `
                <button class="config-menu-item" data-config-aba="${a.id}">
                    <span class="config-menu-icon"><i class="fas ${a.icon}"></i></span>
                    <span class="config-menu-text">
                        <span class="config-menu-label">${a.label}</span>
                        <span class="config-menu-desc">${a.desc}</span>
                    </span>
                    <i class="fas fa-chevron-right config-menu-arrow"></i>
                </button>`).join('');

            return `
            <div class="view-header">
                <h2><i class="fas fa-cog"></i> Configurações</h2>
            </div>
            <div class="config-menu-list">${itensMenu}</div>`;
        }

        const abaAtual = abas.find(a => a.id === aba) || abas[0];
        let conteudo = '';

        if (aba === 'geral') {
            conteudo = `
            <div class="config-section-title">⚙️ Preferências gerais</div>
            <div class="config-item">
                <div class="config-info"><h4>Notificações</h4><p>Receber alertas e lembretes</p></div>
                <label class="toggle-switch">
                    <input type="checkbox" ${s.studyReminders?.enabled ? 'checked' : ''} id="config-notificacoes">
                    <span class="toggle-slider"></span>
                </label>
            </div>
            <div class="config-item">
                <div class="config-info"><h4>Planejamento automático</h4><p>Gerar recomendações automaticamente</p></div>
                <label class="toggle-switch">
                    <input type="checkbox" ${s.autoPlan ? 'checked' : ''} id="config-auto-plan">
                    <span class="toggle-slider"></span>
                </label>
            </div>
            <div class="config-item">
                <div class="config-info"><h4>Modo Faculdade Pesada</h4><p>Priorizar matérias difíceis e aumentar alertas</p></div>
                <label class="toggle-switch">
                    <input type="checkbox" ${s.heavyMode ? 'checked' : ''} id="config-heavy-mode">
                    <span class="toggle-slider"></span>
                </label>
            </div>`;
        }

        if (aba === 'perfil') {
            const perfil = user.perfil || 'faculdade';
            const labelPrincipal = perfil === 'concurso' ? 'Concurso'
                : perfil === 'ensino_medio' ? 'Série / Tipo de escola'
                : perfil === 'geral' ? 'Objetivo'
                : 'Curso';
            const placeholderPrincipal = perfil === 'concurso' ? 'Ex: PRF, TJ, Banco do Brasil'
                : perfil === 'ensino_medio' ? 'Ex: 2º ano — Ensino Médio Regular'
                : perfil === 'geral' ? 'Ex: idiomas, certificações, empreender'
                : 'Ex: Engenharia Civil';

            conteudo = `
            <div class="config-section-title">👤 Informações do perfil</div>
            <div class="config-item" style="flex-direction:column;align-items:flex-start;gap:10px;">
                <div class="wiz-field" style="width:100%"><label>Nome</label>
                    <input type="text" id="config-nome" value="${this.esc(user.nome || '')}" placeholder="Seu nome">
                </div>
                ${perfil === 'faculdade' ? `
                <div class="wiz-field" style="width:100%"><label>Universidade</label>
                    <input type="text" id="config-universidade" value="${this.esc(user.universidade || '')}" placeholder="Ex: UFOB">
                </div>` : ''}
                <div class="wiz-field" style="width:100%"><label>${labelPrincipal}</label>
                    <input type="text" id="config-curso" value="${this.esc(perfil === 'concurso' || perfil === 'vestibular' ? (user.concurso || user.curso || '') : perfil === 'geral' ? (user.objetivo || user.curso || '') : user.curso || '')}" placeholder="${placeholderPrincipal}">
                </div>
                ${perfil === 'ensino_medio' ? `
                <div style="display:flex;gap:10px;flex-wrap:wrap;width:100%">
                  <div class="wiz-field" style="flex:1;min-width:140px"><label>Série</label>
                    <select id="config-serie">
                      ${['6','7','8','9'].map(n => `<option value="${n}" ${String(user.serie)===n?'selected':''}>${n}º ano — Ensino Fundamental</option>`).join('')}
                      ${['1','2','3'].map(n => `<option value="${n}" ${String(user.serie)===n?'selected':''}>${n}º ano — Ensino Médio</option>`).join('')}
                    </select>
                  </div>
                  <div class="wiz-field" style="flex:1;min-width:140px"><label>Tipo de escola</label>
                    <select id="config-tipo-escola">
                      ${((window.SLC_EnsinoMedio?.TIPOS_ESCOLA)||[]).map(t => `<option value="${this.esc(t.valor)}" ${user.tipoEscola===t.valor?'selected':''}>${this.esc(t.label)}</option>`).join('')}
                    </select>
                  </div>
                </div>` : ''}
                ${perfil === 'faculdade' ? `
                <div class="wiz-field" style="width:100%"><label>Semestre atual</label>
                    <select id="config-semestre">
                        ${[1,2,3,4,5,6,7,8,9,10].map(n => `<option value="${n}" ${parseInt(user.semestre) === n ? 'selected' : ''}>${n}º semestre</option>`).join('')}
                    </select>
                </div>` : ''}
                <button class="btn-primary" id="btn-salvar-perfil" style="margin-top:8px;">
                    <i class="fas fa-save"></i> Salvar alterações
                </button>
            </div>

            <div class="config-section-title" style="margin-top:28px;">⏰ Sua rotina</div>
            <p style="font-size:.82rem;color:var(--text-tertiary);margin:-6px 0 12px;">
                Preenchida no cadastro inicial. O Mentor IA e o plano de estudos usam esses dados
                para sugerir horários que fazem sentido pra você — mantenha atualizado se sua rotina mudar.
            </p>
            <div class="config-item" style="flex-direction:column;align-items:flex-start;gap:10px;">
                <div class="wiz-field" style="width:100%"><label>Quando você estuda melhor?</label>
                    <select id="config-turno">
                        <option value="manha" ${user.turnoPrincipal === 'manha' ? 'selected' : ''}>☀️ Manhã</option>
                        <option value="tarde" ${(!user.turnoPrincipal || user.turnoPrincipal === 'tarde') ? 'selected' : ''}>🌤 Tarde</option>
                        <option value="noite" ${user.turnoPrincipal === 'noite' ? 'selected' : ''}>🌙 Noite</option>
                        <option value="madrugada" ${user.turnoPrincipal === 'madrugada' ? 'selected' : ''}>🌑 Madrugada</option>
                    </select>
                </div>
                <div class="wiz-field" style="width:100%"><label>Dias que você costuma estudar</label>
                    <div class="wiz-days" id="config-dias-group">
                        ${['seg','ter','qua','qui','sex','sab','dom'].map((v, i) => {
                            const labels = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
                            const dias = Array.isArray(user.diasPreferidos) && user.diasPreferidos.length ? user.diasPreferidos : ['seg','ter','qua','qui','sex'];
                            return `<button class="wiz-day-btn ${dias.includes(v) ? 'active' : ''}" data-val="${v}" type="button">${labels[i]}</button>`;
                        }).join('')}
                    </div>
                </div>
                <div style="display:flex;gap:10px;width:100%;flex-wrap:wrap;">
                    <div class="wiz-field" style="flex:1;min-width:140px;"><label>Horas máximas por dia</label>
                        <select id="config-horas">
                            ${[1,2,3,4,5,6,7,8,9,10,12].map(h => `<option value="${h}" ${h === (parseInt(user.horasMaximas) || 4) ? 'selected' : ''}>${h}h</option>`).join('')}
                        </select>
                    </div>
                    <div class="wiz-field" style="flex:1;min-width:140px;"><label>Tipo de rotina</label>
                        <select id="config-tipo-rotina">
                            <option value="so-estuda" ${(!user.tipoRotina || user.tipoRotina === 'so-estuda') ? 'selected' : ''}>Só estudo</option>
                            <option value="estuda-trabalha" ${user.tipoRotina === 'estuda-trabalha' ? 'selected' : ''}>Estudo + Trabalho</option>
                            <option value="estuda-estagio" ${user.tipoRotina === 'estuda-estagio' ? 'selected' : ''}>Estudo + Estágio</option>
                            <option value="rotina-pesada" ${user.tipoRotina === 'rotina-pesada' ? 'selected' : ''}>Rotina muito pesada</option>
                        </select>
                    </div>
                </div>
                <div style="display:flex;gap:10px;width:100%;flex-wrap:wrap;">
                    <div class="wiz-field" style="flex:1;min-width:140px;"><label>Tempo de deslocamento (min)</label>
                        <input type="number" id="config-deslocamento" min="0" max="240" value="${parseInt(user.tempoDeslocamento) || 20}">
                    </div>
                    <div class="wiz-field" style="flex:1;min-width:140px;"><label>Horário de sono (opcional)</label>
                        <div class="wiz-time-range">
                            <input type="time" id="config-sono-inicio" value="${this.esc(parseTimeRange(user.horarioSono).inicio)}" aria-label="Início do sono">
                            <span class="wiz-time-sep">até</span>
                            <input type="time" id="config-sono-fim" value="${this.esc(parseTimeRange(user.horarioSono).fim)}" aria-label="Fim do sono">
                        </div>
                    </div>
                </div>
                <button class="btn-primary" id="btn-salvar-rotina" style="margin-top:4px;">
                    <i class="fas fa-save"></i> Salvar rotina
                </button>
            </div>

            <div class="config-section-title" style="margin-top:28px;">🔐 Conta</div>
            <div class="config-item">
                <div class="config-info"><h4>Conectado como</h4><p>${email}</p></div>
            </div>
            <button class="btn-secondary" id="config-logout-btn" style="margin-top:12px;">
                <i class="fas fa-sign-out-alt"></i> Sair da conta
            </button>
            <div class="account-danger-box">
                <div>
                    <strong>Excluir minha conta</strong>
                    <p>Apaga permanentemente seu login, dados, materiais e arquivos privados.</p>
                </div>
                <button class="btn-danger" id="btn-delete-account"><i class="fas fa-user-xmark"></i> Excluir conta</button>
            </div>`;
        }

        if (aba === 'calendario') {
            const token = s.calendarToken || null;
            const urls = token && window.calendarFeed ? window.calendarFeed.feedUrls(token) : null;

            const tzAtual = window.calendarFeed?.getTimezone?.() || s.timezone || 'America/Sao_Paulo';
            const tzDetectado = window.calendarFeed?.detectedTimezone?.() || null;
            let tzOpcoes = [];
            try { tzOpcoes = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []; } catch (_) { tzOpcoes = []; }
            if (!tzOpcoes.includes(tzAtual)) tzOpcoes.unshift(tzAtual);

            conteudo = `
            <div class="config-section-title">📅 Calendário automático</div>
            <p style="font-size:.88rem;color:var(--text-secondary);margin-bottom:16px;">
                Gere um link e cole ele UMA VEZ no seu app de calendário (Google, Apple ou Outlook)
                como "assinar por URL". A partir daí, toda prova, tarefa, sessão de estudo e aula que
                você cadastrar aqui aparece sozinha lá — sem precisar exportar nada de novo.
            </p>

            <div class="wiz-field" style="margin-bottom:18px;">
                <label>Fuso horário</label>
                ${tzOpcoes.length ? `
                <select id="config-timezone">
                    ${tzOpcoes.map(tz => `<option value="${this.esc(tz)}" ${tz === tzAtual ? 'selected' : ''}>${this.esc(tz)}${tz === tzDetectado ? ' (detectado automaticamente)' : ''}</option>`).join('')}
                </select>
                ` : `
                <input type="text" id="config-timezone" value="${this.esc(tzAtual)}" placeholder="Ex: America/Sao_Paulo">
                `}
                <p style="font-size:.8rem;color:var(--text-tertiary);margin-top:6px;">
                    Detectamos automaticamente pelo seu navegador${tzDetectado ? ` (<strong>${this.esc(tzDetectado)}</strong>)` : ''}.
                    Só mude aqui se estiver errado — isso é o que garante que o horário das aulas apareça certo
                    no seu calendário, esteja você onde estiver.
                </p>
            </div>

            ${!token ? `
                <button class="btn-primary" id="btn-gerar-calendario">
                    <i class="fas fa-calendar-plus"></i> Gerar meu link de calendário
                </button>
            ` : `
                <div class="wiz-field" style="margin-bottom:10px;">
                    <label>Link de assinatura</label>
                    <div style="display:flex;gap:8px;">
                        <input type="text" id="calendario-url" readonly value="${this.esc(urls.https)}" style="flex:1;">
                        <button class="btn-secondary" id="btn-copiar-calendario" title="Copiar link">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>
                <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px;">
                    <a class="btn-secondary" href="${this.esc(urls.webcal)}" style="text-decoration:none;display:inline-flex;align-items:center;gap:8px;">
                        <i class="fas fa-calendar-day"></i> Abrir no app de calendário
                    </a>
                    <button class="btn-secondary" id="btn-regenerar-calendario">
                        <i class="fas fa-sync-alt"></i> Gerar novo link (revoga este)
                    </button>
                </div>

                <details style="margin-bottom:8px;">
                    <summary style="cursor:pointer;font-weight:600;font-size:.9rem;">Como assinar no Google Agenda</summary>
                    <p style="font-size:.85rem;color:var(--text-secondary);margin-top:8px;">
                        No computador: Google Agenda → "Outras agendas" (+) → "A partir do URL" → cole o link acima → Adicionar agenda.
                        O Google não permite assinar por URL pelo app do celular — assine pelo navegador e ela aparece no app depois.
                    </p>
                </details>
                <details style="margin-bottom:8px;">
                    <summary style="cursor:pointer;font-weight:600;font-size:.9rem;">Como assinar no Calendário da Apple (iPhone/Mac)</summary>
                    <p style="font-size:.85rem;color:var(--text-secondary);margin-top:8px;">
                        Toque no botão "Abrir no app de calendário" acima — o iOS/macOS já oferece pra assinar direto.
                        Ou manualmente: Ajustes → Calendário → Contas → Adicionar Conta → Outra → Adicionar Assinatura de Calendário → cole o link.
                    </p>
                </details>
                <details style="margin-bottom:16px;">
                    <summary style="cursor:pointer;font-weight:600;font-size:.9rem;">Como assinar no Outlook</summary>
                    <p style="font-size:.85rem;color:var(--text-secondary);margin-top:8px;">
                        Outlook.com: Adicionar calendário → Assinar da web → cole o link acima.
                    </p>
                </details>
                <p style="font-size:.8rem;color:var(--text-tertiary);">
                    Os apps de calendário costumam buscar atualizações a cada 12–24h — não é instantâneo, mas não precisa
                    fazer nada manualmente depois de assinar uma vez.
                </p>
            `}`;
        }

        if (aba === 'notificacoes') {
            const reminders = s.studyReminders || {};
            const pushOk = window.pushNotifications?.isSupported?.();

            conteudo = `
            <div class="config-section-title">🔔 Alarmes de estudo (notificação push)</div>
            ${!pushOk ? `
                <p style="font-size:.88rem;color:var(--text-secondary);">
                    Esse navegador não suporta notificações push.
                </p>
            ` : `
                <div class="config-item">
                    <div class="config-info"><h4>Ativar alarmes neste dispositivo</h4>
                        <p>Manda uma notificação mesmo com o app fechado, perto da hora de provas, tarefas, sessões, revisões e aulas</p>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" id="config-push-enabled" ${reminders.enabled ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>

                <p style="font-size:.85rem;color:var(--text-secondary);margin-top:16px;">
                    É só ativar acima — os horários de aviso já vêm prontos com um padrão que funciona bem,
                    sem precisar mexer em nada:
                </p>

                <div style="margin-top:10px;">
                    <label style="font-size:.8rem;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.03em;">Prova, tarefa ou trabalho</label>
                    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;">
                        ${['7 dias antes', '5 dias antes', '3 dias antes', '1 dia antes', 'No dia da entrega'].map(l => `
                            <span style="padding:6px 12px;border-radius:999px;background:var(--bg-tertiary);border:1px solid var(--border);font-size:.78rem;color:var(--text-primary);">${l}</span>
                        `).join('')}
                    </div>
                    <p style="font-size:.78rem;color:var(--text-tertiary);margin-top:6px;">
                        Automático e fixo — quanto mais perto da data, mais vezes você é lembrado.
                    </p>
                </div>

                <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:16px;">
                    <span style="padding:6px 12px;border-radius:999px;background:var(--bg-tertiary);border:1px solid var(--border);font-size:.78rem;color:var(--text-primary);">Sessão de estudo · ${Number(reminders.sessionsMinutesBefore ?? 15)} min antes</span>
                    <span style="padding:6px 12px;border-radius:999px;background:var(--bg-tertiary);border:1px solid var(--border);font-size:.78rem;color:var(--text-primary);">Revisão espaçada · ${Number(reminders.reviewsHoursBefore ?? 24)}h antes</span>
                    <span style="padding:6px 12px;border-radius:999px;background:var(--bg-tertiary);border:1px solid var(--border);font-size:.78rem;color:var(--text-primary);">Aula · ${Number(reminders.classMinutesBefore ?? 15)} min antes</span>
                    <span style="padding:6px 12px;border-radius:999px;background:var(--bg-tertiary);border:1px solid var(--border);font-size:.78rem;color:var(--text-primary);">📖 Diário do dia · se não registrar até ${Number(reminders.diaryReminderHour ?? 20)}h</span>
                </div>

                <details style="margin-top:18px;">
                    <summary style="cursor:pointer;font-weight:600;font-size:.85rem;color:var(--text-secondary);">Personalizar horários (opcional)</summary>
                    <div style="display:flex;flex-wrap:wrap;gap:16px;margin-top:14px;">
                        <div class="wiz-field">
                            <label>Avisar sessão de estudo com quantos minutos de antecedência?</label>
                            <select id="config-reminder-sessions">
                                ${[5, 10, 15, 30, 60].map(m => `<option value="${m}" ${Number(reminders.sessionsMinutesBefore ?? 15) === m ? 'selected' : ''}>${m} min antes</option>`).join('')}
                            </select>
                        </div>
                        <div class="wiz-field">
                            <label>Avisar revisão espaçada com quantas horas de antecedência?</label>
                            <select id="config-reminder-reviews">
                                ${[6, 12, 24, 48, 72].map(h => `<option value="${h}" ${Number(reminders.reviewsHoursBefore ?? 24) === h ? 'selected' : ''}>${h}h antes</option>`).join('')}
                            </select>
                        </div>
                        <div class="wiz-field">
                            <label>Avisar aula com quantos minutos de antecedência?</label>
                            <select id="config-reminder-class">
                                ${[5, 10, 15, 30, 60].map(m => `<option value="${m}" ${Number(reminders.classMinutesBefore ?? 15) === m ? 'selected' : ''}>${m} min antes</option>`).join('')}
                            </select>
                        </div>
                        <div class="wiz-field">
                            <label>Lembrar de preencher o Diário a partir de que horas, se ainda não registrou o dia?</label>
                            <select id="config-reminder-diario">
                                ${[18, 19, 20, 21, 22].map(h => `<option value="${h}" ${Number(reminders.diaryReminderHour ?? 20) === h ? 'selected' : ''}>${h}h</option>`).join('')}
                            </select>
                        </div>
                    </div>
                </details>

                <p style="font-size:.8rem;color:var(--text-tertiary);margin-top:16px;">
                    No iPhone, notificação push só funciona depois de instalar o site na tela de início
                    (Compartilhar → Adicionar à Tela de Início) — o Safari em aba comum não recebe push do iOS.
                </p>
            `}`;
        }

        if (aba === 'tema') {
            conteudo = '';
        }

        if (aba === 'dados') {
            conteudo = `
            <div class="config-section-title">📦 Backup e restauração</div>
            <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:24px;">
                <button class="btn-secondary" id="exportar-dados" style="justify-content:flex-start;">
                    <i class="fas fa-download"></i> Exportar todos os dados (JSON)
                </button>
                <button class="btn-secondary" id="importar-dados" style="justify-content:flex-start;">
                    <i class="fas fa-upload"></i> Importar backup
                </button>
                <button class="btn-secondary" id="carregar-demo-publica" style="justify-content:flex-start;">
                    <i class="fas fa-flask"></i> Carregar dados de demonstração
                </button>
            </div>
            <div class="config-section-title" style="color:var(--accent-danger)">⚠️ Zona de perigo</div>
            <p style="font-size:.88rem;color:var(--text-secondary);margin-bottom:12px;">
                Essas ações são irreversíveis. Faça um backup antes.
            </p>
            <button class="btn-danger" id="limpar-dados">
                <i class="fas fa-trash"></i> Limpar todos os dados
            </button>`;
        }

        if (aba === 'sobre') {
            conteudo = `
            <div class="config-section-title">ℹ️ Sobre o app</div>
            <div style="display:flex;flex-direction:column;gap:12px;">
                <div class="card" style="padding:18px;">
                    <strong style="font-size:1.1rem">SLCampus</strong>
                    <p style="color:var(--text-secondary);margin-top:4px">Seu espaço inteligente para estudar, organizar materiais e acompanhar sua evolução</p>
                    
                </div>
                <div class="card" style="padding:18px;">
                    <strong>Conta conectada</strong>
                    <p style="color:var(--text-secondary);margin-top:4px;font-size:.9rem">${email}</p>
                </div>
                <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px;">
                    <button class="btn-secondary" id="btn-abrir-ajuda">
                        <i class="fas fa-question-circle"></i> Central de Ajuda
                    </button>

                </div>
            </div>`;
        }

        return `
        <div class="view-header config-detail-header">
            <button class="config-back-btn" data-config-aba="" aria-label="Voltar para Configurações">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h2><i class="fas ${abaAtual.icon}"></i> ${abaAtual.label}</h2>
        </div>
        ${conteudo ? `<div class="config-content">${conteudo}</div>` : ''}`;
    }

    renderMaterias() {
        return `
            <div class="view-header">
                <h2><i class="fas fa-book"></i> Matérias</h2>
                <button class="btn-primary" id="btn-nova-materia"><i class="fas fa-plus"></i> Nova Matéria</button>
            </div>

            <div class="dashboard-grid">
                ${this.app.data.subjects.map(s => {
                    const totalSessoes = this.app.data.sessions.filter(ses => ses.materia === s.nome).length;
                    const totalTarefas = this.app.data.tasks.filter(t => t.materia === s.nome && !t.concluida).length;
                    const totalProvas = this.app.data.exams.filter(e => e.materia === s.nome && new Date(e.data) >= new Date()).length;

                    return `
                        <div class="card subject-card">
                            <div class="card-header">
                                <h3>${this.esc(s.nome)}</h3>
                                <span class="badge" style="background: ${this.getDificuldadeColor(s.dificuldade)};">${this.esc(this.getDificuldadeLabel(s))}</span>
                            </div>
                            <div class="card-body">
                                <div class="subject-stats">
                                    <div><i class="fas fa-clock"></i> ${totalSessoes} sessões</div>
                                    <div><i class="fas fa-tasks"></i> ${totalTarefas} tarefas</div>
                                    <div><i class="fas fa-graduation-cap"></i> ${totalProvas} provas</div>
                                </div>
                                <div class="subject-actions" style="display:flex; gap:8px; margin-top:16px;">
                                    <button class="btn-secondary btn-editar-materia" data-id="${this.esc(s.id)}" style="flex:1;">
                                        <i class="fas fa-edit"></i> Editar
                                    </button>
                                    <button class="btn-danger btn-excluir-materia" data-id="${this.esc(s.id)}" style="flex:1;">
                                        <i class="fas fa-trash"></i> Excluir
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    renderAlert(alert) {
        const icon = alert.type === 'warning'
            ? 'fa-exclamation-triangle'
            : alert.type === 'danger'
                ? 'fa-exclamation-circle'
                : 'fa-info-circle';

        return `
            <div class="alert-card ${this.esc(alert.type)}">
                <i class="fas ${icon}"></i>
                <div class="alert-content">
                    <div class="alert-title">${this.esc(alert.title)}</div>
                    <div class="alert-description">${this.esc(alert.message)}</div>
                </div>
            </div>
        `;
    }

    renderConsistencyChart() {
        const hoje = new Date();
        const inicio = new Date(hoje);
        inicio.setDate(hoje.getDate() - hoje.getDay());

        let html = '<div class="chart-bars">';

        for (let i = 0; i < 7; i++) {
            const data = new Date(inicio);
            data.setDate(inicio.getDate() + i);

            const temEstudo = this.app.data.sessions.some(s =>
                new Date(s.data).toDateString() === data.toDateString() && s.concluida
            );

            const intensidade = temEstudo ? 100 : 20;

            html += `
                <div class="chart-bar-container" title="${temEstudo ? 'Estudou' : 'Não estudou'}">
                    <div class="chart-bar" style="height: ${intensidade}px"></div>
                    <span class="chart-label">${['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][i]}</span>
                </div>
            `;
        }

        html += '</div>';
        return html;
    }

    renderSessoesFocoHoje() {
        const hoje = toDateString();
        const sessoes = this.app.data.sessions.filter(s =>
            toDateString(s.data) === hoje && s.concluida && s.tipo === 'foco'
        );

        if (!sessoes.length) {
            return '<li>Nenhuma sessão de foco concluída hoje</li>';
        }

        return sessoes.map(s => `
            <li>
                <span>${this.esc(s.materia)}</span>
                <span>${this.esc(s.duracao)} min</span>
            </li>
        `).join('');
    }

    getProximaAulaDateTime(aula) {
        const hoje = new Date();
        const diaSemana = hoje.getDay();
        const dataAula = new Date(hoje);

        if (parseInt(aula.dia, 10) > diaSemana) {
            dataAula.setDate(hoje.getDate() + (parseInt(aula.dia, 10) - diaSemana));
        } else if (parseInt(aula.dia, 10) < diaSemana) {
            dataAula.setDate(hoje.getDate() + (7 - diaSemana + parseInt(aula.dia, 10)));
        } else {
            const [h, m] = aula.inicio.split(':');
            const horaAula = new Date(hoje);
            horaAula.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);

            if (horaAula < hoje) {
                dataAula.setDate(hoje.getDate() + 7);
            }
        }

        const [h, m] = aula.inicio.split(':');
        dataAula.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);

        return dataAula.toISOString();
    }

    getMaterialIcon(tipo) {
        const icons = {
            link: 'fa-link',
            pdf: 'fa-file-pdf',
            video: 'fa-video',
            anotacao: 'fa-sticky-note'
        };
        return icons[tipo] || 'fa-file';
    }

    getEventIcon(tipo) {
        const icons = {
            sessao: 'fa-clock',
            tarefa: 'fa-tasks',
            exame: 'fa-graduation-cap'
        };
        return icons[tipo] || 'fa-calendar';
    }

    getDificuldadeLabel(subjectOrValue) {
        const s = typeof subjectOrValue === 'object' ? subjectOrValue : null;
        const value = Number(s ? s.dificuldade : subjectOrValue) || 3;
        const labels = {1:'Fácil', 2:'Média-baixa', 3:'Média', 4:'Média-alta', 5:'Difícil'};
        const label = labels[value] || 'Média';
        return s?.dificuldadeAutomatica ? `Dificuldade ${label} • automática` : `Dificuldade ${label}`;
    }

    getDificuldadeColor(dificuldade) {
        const cores = {
            1: '#10b981',
            2: '#34d399',
            3: '#f59e0b',
            4: '#f97316',
            5: '#ef4444'
        };
        return cores[dificuldade] || '#3b82f6';
    }

    getResumoHorasEstudo() {
        const hoje = toDateString();
        const inicioSemana = new Date();
        inicioSemana.setHours(0, 0, 0, 0);
        inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());

        const sessoesConcluidas = this.app.data.sessions.filter(s => s.concluida);

        const horasHoje = sessoesConcluidas
            .filter(s => toDateString(s.data) === hoje)
            .reduce((acc, s) => acc + s.duracao, 0) / 60;

        const horasSemana = sessoesConcluidas
            .filter(s => new Date(s.data) >= inicioSemana)
            .reduce((acc, s) => acc + s.duracao, 0) / 60;

        const horasTotal = sessoesConcluidas
            .reduce((acc, s) => acc + s.duracao, 0) / 60;

        return {
            hoje: horasHoje,
            semana: horasSemana,
            total: horasTotal
        };
    }

    getMateriasAtrasadas() {
        return this.app.data.subjects.map(subject => {
            const ultimaSessao = this.app.data.sessions
                .filter(s => s.materia === subject.nome && s.concluida)
                .sort((a, b) => new Date(b.data) - new Date(a.data))[0];

            if (!ultimaSessao) {
                return {
                    materia: subject.nome,
                    dias: null,
                    nuncaEstudou: true
                };
            }

            return {
                materia: subject.nome,
                dias: diasDesde(ultimaSessao.data),
                nuncaEstudou: false
            };
        })
        .filter(item => item.nuncaEstudou || item.dias >= 5)
        .sort((a, b) => {
            if (a.nuncaEstudou && !b.nuncaEstudou) return -1;
            if (!a.nuncaEstudou && b.nuncaEstudou) return 1;
            return (b.dias || 0) - (a.dias || 0);
        })
        .slice(0, 5);
    }

    getResumoSemana() {
        const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const hoje = new Date();
        const inicioSemana = new Date(hoje);
        inicioSemana.setHours(0, 0, 0, 0);
        inicioSemana.setDate(hoje.getDate() - hoje.getDay());

        return diasSemana.map((nome, index) => {
            const data = new Date(inicioSemana);
            data.setDate(inicioSemana.getDate() + index);

            const horas = this.app.data.sessions
                .filter(s => s.concluida && new Date(s.data).toDateString() === data.toDateString())
                .reduce((acc, s) => acc + s.duracao, 0) / 60;

            const aulas = (window.scheduleManager?.getAulasPorDia(index) || []).length;

            return { nome, horas, aulas };
        });
    }

    renderGradeCurricular() {
        const curriculum = (this.app.getNormalizedCurriculum ? this.app.getNormalizedCurriculum() : (this.app.data.curriculum || [])).slice().sort((a, b) => {
            const semA = parseInt(a.semestre || 999, 10);
            const semB = parseInt(b.semestre || 999, 10);
            if (semA !== semB) return semA - semB;
            return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
        });

        const totais = curriculum.reduce((acc, item) => {
            const ch = Number(item.cargaHoraria) || 0;
            acc.totalHoras += ch;
            acc.totalComponentes += 1;

            if (item.status === 'concluida') acc.horasConcluidas += ch;
            else if (item.status === 'cursando') acc.horasCursando += ch;
            else acc.horasPendentes += ch;

            return acc;
        }, {
            totalHoras: 0,
            totalComponentes: 0,
            horasConcluidas: 0,
            horasCursando: 0,
            horasPendentes: 0
        });

        const progresso = totais.totalHoras ? Math.round((totais.horasConcluidas / totais.totalHoras) * 100) : 0;
        const progressoCursando = totais.totalHoras ? Math.round((totais.horasCursando / totais.totalHoras) * 100) : 0;
        const progressoPendente = Math.max(0, 100 - progresso - progressoCursando);
        const horasRestantes = Math.max(0, totais.totalHoras - totais.horasConcluidas);
        const isHistorical = this.app._semesterContext?.type === 'archived';
        const currentSemester = isHistorical
            ? (parseInt(this.app._semesterContext?.label || '', 10) || 0)
            : (parseInt(this.app.data?.user?.semestre || 0, 10) || 0);
        const cursandoAgora = curriculum.filter(item => item.status === 'cursando').length;

        const porSemestre = curriculum.reduce((acc, item) => {
            const sem = String(item.semestre || '0').trim();
            const chave = sem ? `${sem}º Semestre` : 'Sem semestre definido';
            if (!acc[chave]) acc[chave] = [];
            acc[chave].push(item);
            return acc;
        }, {});

        const semestresOrdenados = Object.keys(porSemestre).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
        const numericSemesters = semestresOrdenados.map(label => parseInt(label, 10)).filter(Boolean);
        const startState = this.app.curriculumViewState?.startSemester || 'all';
        const countState = this.app.curriculumViewState?.visibleCount || 4;

        let startIndex = 0;

        if (startState === 'current' && currentSemester) {
            const idx = numericSemesters.findIndex(n => n === currentSemester);
            startIndex = idx >= 0 ? idx : 0;
        } else if (startState !== 'all') {
            const target = parseInt(startState, 10);
            const idx = numericSemesters.findIndex(n => n === target);
            startIndex = idx >= 0 ? idx : 0;
        }

        const visibleSemesterLabels = startState === 'all'
            ? (countState === 'all'
                ? semestresOrdenados
                : semestresOrdenados.slice(0, Number(countState) || 4))
            : (countState === 'all'
                ? semestresOrdenados.slice(startIndex)
                : semestresOrdenados.slice(startIndex, startIndex + (Number(countState) || 4)));

        const visibleSet = new Set(visibleSemesterLabels);
        const visibleItems = curriculum.filter(item =>
            visibleSet.has(`${String(item.semestre || '0').trim()}º Semestre`)
        );

        const blockedCount = curriculum.filter(item => item.status !== 'concluida' && item.prerequisitosLista?.length).length;
        const withCodeCount = curriculum.filter(item => item.codigo).length;
        const próximos = curriculum.filter(item => item.status !== 'concluida').slice(0, 5);

        const semesterOptions = [...new Set(numericSemesters)]
            .map(n => `<option value="${n}" ${String(startState) === String(n) ? 'selected' : ''}>A partir do ${n}º</option>`)
            .join('');

        return `
            <div class="view-header view-header-grade-upgraded">
                <div>
                    <h2><i class="fas fa-sitemap"></i> Grade Curricular</h2>
                </div>
                <div class="view-actions-inline">
                    <button class="btn-secondary" id="btn-importar-ufob">
                        <i class="fas fa-wand-magic-sparkles"></i> Importar grade pronta
                    </button>
                    ${!isHistorical ? `
                    <button class="btn-secondary" id="btn-editar-semestre-atual" title="Adicionar, remover ou trancar matérias do semestre em andamento">
                        <i class="fas fa-sliders"></i> Editar Semestre Atual
                        ${cursandoAgora ? `<span class="badge badge-soft">${cursandoAgora}</span>` : ''}
                    </button>
                    <button class="btn-secondary btn-finalizar-semestre-cta" id="btn-finalizar-semestre" title="Encerrar o semestre atual, registrar aprovações/reprovações e escolher as matérias do próximo">
                        <i class="fas fa-flag-checkered"></i> Finalizar Semestre
                    </button>` : `
                    <span class="badge badge-soft"><i class="fas fa-box-archive"></i> Histórico em edição</span>`}
                    <button class="btn-secondary" id="btn-semestres-anteriores" title="Ver o histórico de tarefas, provas, sessões e notas dos semestres já finalizados">
                        <i class="fas fa-box-archive"></i> Semestres anteriores
                        ${(this.app.data.archivedSemesters || []).length ? `<span class="badge badge-soft">${this.app.data.archivedSemesters.length}</span>` : ''}
                    </button>
                    <button class="btn-primary" id="btn-novo-curriculum">
                        <i class="fas fa-plus"></i> Novo Componente
                    </button>
                </div>
            </div>

            <div class="grade-shell">
                <div class="card grade-hero-card-upgraded">
                    <div class="card-body grade-hero-body-upgraded">
                        <div class="grade-progress-panel">
                            <div class="grade-progress-head">
                                <span class="badge badge-soft">${totais.totalComponentes} componentes</span>
                                ${currentSemester ? `<span class="badge badge-soft">${currentSemester}º semestre atual</span>` : ''}
                                <span class="badge badge-soft">${totais.totalHoras}h cadastradas</span>
                            </div>

                            <div class="grade-progress-display">
                                <div class="progress-ring progress-ring-lg" style="--progress:${progresso}%;">
                                    <div class="progress-ring-inner">
                                        <strong>${progresso}%</strong>
                                        <span>concluído</span>
                                    </div>
                                </div>

                                <div class="grade-progress-copy">
                                    <h3>Visão geral da sua caminhada no curso</h3>
                                    <p>Acompanhe o avanço da grade, filtre só os semestres que quer ver e organize os componentes com muito mais clareza.</p>
                                </div>
                            </div>

                            <div class="grade-progress-stack">
                                <div class="grade-progress-stack-fill done" style="width:${progresso}%"></div>
                                <div class="grade-progress-stack-fill doing" style="width:${progressoCursando}%"></div>
                                <div class="grade-progress-stack-fill pending" style="width:${progressoPendente}%"></div>
                            </div>

                            <div class="grade-progress-legend">
                                <span><i class="legend-dot done"></i> ${totais.horasConcluidas}h concluídas</span>
                                <span><i class="legend-dot doing"></i> ${totais.horasCursando}h cursando</span>
                                <span><i class="legend-dot pending"></i> ${horasRestantes}h restantes</span>
                            </div>
                        </div>

                        <div class="grade-kpi-grid-upgraded">
                            <div class="grade-kpi-card highlight">
                                <span>Visíveis agora</span>
                                <strong>${visibleItems.length}</strong>
                                <small>componentes na tela</small>
                            </div>
                            <div class="grade-kpi-card">
                                <span>Com código</span>
                                <strong>${withCodeCount}</strong>
                                <small>busca e organização melhores</small>
                            </div>
                            <div class="grade-kpi-card">
                                <span>Com pré-requisito</span>
                                <strong>${blockedCount}</strong>
                                <small>dependem de base anterior</small>
                            </div>
                            <div class="grade-kpi-card">
                                <span>Semestres visíveis</span>
                                <strong>${visibleSemesterLabels.length}</strong>
                                <small>recorte atual da grade</small>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="card grade-toolbar-card">
                    <div class="card-body grade-toolbar-body">
                        <div class="grade-toolbar-main">
                            <div class="form-group compact">
                                <label>Começar em</label>
                                <select id="curriculum-semester-start">
                                    <option value="all" ${startState === 'all' ? 'selected' : ''}>Do início</option>
                                    ${currentSemester ? `<option value="current" ${startState === 'current' ? 'selected' : ''}>Meu semestre atual</option>` : ''}
                                    ${semesterOptions}
                                </select>
                            </div>

                            <div class="form-group compact">
                                <label>Mostrar</label>
                                <select id="curriculum-semester-count">
                                    ${['2', '3', '4', '5', '6', 'all'].map(value => `
                                        <option value="${value}" ${String(countState) === String(value) ? 'selected' : ''}>
                                            ${value === 'all' ? 'Todos os semestres' : `${value} semestre(s)`}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>

                        <div class="semester-shortcuts">
                            <button type="button" class="semester-shortcut-pill ${startState === 'all' ? 'active' : ''}" data-semester="all">Tudo</button>
                            ${numericSemesters.map(n => `
                                <button
                                    type="button"
                                    class="semester-shortcut-pill ${(String(startState) === String(n) || (startState === 'current' && currentSemester === n)) ? 'active' : ''}"
                                    data-semester="${n}"
                                >${n}º</button>
                            `).join('')}
                        </div>
                    </div>
                </div>

                ${próximos.length ? `
                    <div class="card grade-focus-card-upgraded">
                        <div class="card-header">
                            <h3>Próximos para ajustar ou acompanhar</h3>
                            <span class="badge">${próximos.length}</span>
                        </div>
                        <div class="card-body grade-focus-list-scroll">
                            ${próximos.map(item => `
                                <div class="grade-focus-item compact">
                                    <div>
                                        <strong>${this.esc(item.nome)}</strong>
                                        <small>
                                            ${item.semestre ? `${this.esc(item.semestre)}º semestre` : 'Sem semestre'}
                                            • ${Number(item.cargaHoraria) || 0}h
                                            ${item.codigo ? `• ${this.esc(item.codigo)}` : ''}
                                        </small>
                                    </div>
                                    <span class="tag ${this.esc(item.status)}">${this.esc((item.status || '').replaceAll('-', ' '))}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <div class="semester-grid-upgraded">
                    ${visibleSemesterLabels.map(semestre => {
                        const numeroSemestre = parseInt(semestre, 10) || 0;
                        const itens = porSemestre[semestre] || [];
                        const horasSemestre = itens.reduce((acc, item) => acc + (Number(item.cargaHoraria) || 0), 0);
                        const horasConcluidasSem = itens
                            .filter(item => item.status === 'concluida')
                            .reduce((acc, item) => acc + (Number(item.cargaHoraria) || 0), 0);
                        const progressoSemestre = horasSemestre ? Math.round((horasConcluidasSem / horasSemestre) * 100) : 0;

                        return `
                            <section class="card semester-card-upgraded ${currentSemester && numeroSemestre === currentSemester ? 'semester-card-active' : ''}">
                                <div class="card-header semester-card-header upgraded">
                                    <div>
                                        <h3>${this.esc(semestre)}</h3>
                                        <p>${itens.length} componente(s) • ${horasSemestre}h</p>
                                    </div>
                                    <div class="semester-card-side">
                                        <span class="badge badge-soft">${progressoSemestre}%</span>
                                        ${currentSemester && numeroSemestre === currentSemester ? '<span class="tag em-andamento">Atual</span>' : ''}
                                    </div>
                                </div>

                                <div class="card-body">
                                    <div class="semester-mini-progress upgraded">
                                        <div class="progress-bar large">
                                            <div class="progress-fill" style="width:${progressoSemestre}%"></div>
                                        </div>
                                    </div>

                                    <div class="curriculum-list-modern-spaced">
                                        ${itens.map(item => `
                                            <article class="curriculum-item-modern-upgraded status-${this.esc(item.status)}">
                                                <div class="curriculum-main">
                                                    <div class="curriculum-title-row-upgraded">
                                                        <div>
                                                            <h4>${this.esc(item.nome)}</h4>
                                                            <div class="curriculum-inline-meta wrap">
                                                                ${item.codigo ? `<span class="code-badge">${this.esc(item.codigo)}</span>` : ''}
                                                                <span>${Number(item.cargaHoraria) || 0}h</span>
                                                                <span>${this.esc(item.tipo || 'obrigatoria')}</span>
                                                                ${Number(item.creditos) ? `<span>${this.esc(item.creditos)} créditos</span>` : ''}
                                                            </div>
                                                        </div>
                                                        <span class="tag ${this.esc(item.status)}">${this.esc((item.status || '').replaceAll('-', ' '))}</span>
                                                    </div>

                                                    ${(item.nota !== undefined && item.nota !== null && item.nota !== '') ? `
                                                        <div class="curriculum-nota-row">
                                                            <span class="chip chip-nota ${Number(item.nota) >= 6 ? 'chip-nota-ok' : 'chip-nota-baixa'}">
                                                                <i class="fas fa-star"></i> Média: ${this.esc(Number(item.nota).toFixed(1))}
                                                            </span>
                                                        </div>
                                                    ` : ''}

                                                    ${item.prerequisitosLista?.length ? `
                                                        <div class="prereq-inline-row upgraded">
                                                            <span class="prereq-label">Pré-requisitos</span>
                                                            <div class="prereq-chip-wrap">
                                                                ${item.prerequisitosLista.map(req => `<span class="chip">${this.esc(req)}</span>`).join('')}
                                                            </div>
                                                        </div>
                                                    ` : '<div class="prereq-empty">Sem pré-requisitos cadastrados</div>'}

                                                    ${item.observacoes ? `<small class="curriculum-note">${this.esc(item.observacoes)}</small>` : ''}
                                                </div>

                                                <div class="curriculum-actions curriculum-actions-inline">
                                                    <button class="btn-icon btn-editar-curriculum" data-id="${this.esc(item.id)}" title="Editar componente">
                                                        <i class="fas fa-edit"></i>
                                                    </button>
                                                    <button class="btn-icon btn-excluir-curriculum" data-id="${this.esc(item.id)}" title="Excluir componente" style="color: var(--accent-danger);">
                                                        <i class="fas fa-trash"></i>
                                                    </button>
                                                </div>
                                            </article>
                                        `).join('')}
                                    </div>
                                </div>
                            </section>
                        `;
                    }).join('')}
                </div>

                ${!visibleSemesterLabels.length ? `
                    <div class="card">
                        <div class="card-body empty-state">
                            <h3>Nenhum semestre para exibir nesse filtro</h3>
                            <p>Mude o ponto de início ou a quantidade de semestres mostrados.</p>
                        </div>
                    </div>
                ` : ''}

                ${!curriculum.length ? `
                    <div class="card">
                        <div class="card-body empty-state">
                            <h3>Nenhum componente cadastrado ainda</h3>
                            <p>Cadastre manualmente ou use a sugestão da UFOB para puxar uma base inicial.</p>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderCursosExtras() {
        const cursos = (this.app.data.extraCourses || []).slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
        return `
            <div class="view-header">
                <h2><i class="fas fa-language"></i> Cursos Extras</h2>
                <button class="btn-primary" id="btn-novo-extra-course"><i class="fas fa-plus"></i> Novo Curso</button>
            </div>
            <div class="dashboard-grid">
                ${cursos.map(curso => {
                    const tipo = curso.tipoAcompanhamento || 'horas';
                    const meta = Number(curso.metaHoras) || 0;
                    const estudadas = Number(curso.horasEstudadas) || 0;
                    const progresso = Math.min(100, Math.max(0, Number(curso.progresso) || (meta ? Math.round((estudadas / meta) * 100) : 0)));

                    let linhaAcompanhamento = `<p><strong>Horas:</strong> ${estudadas}h${meta ? ` / ${meta}h` : ''}</p>`;
                    if (tipo === 'modulos') {
                        const total = Number(curso.totalModulos) || 0;
                        const feitos = Number(curso.modulosConcluidos) || 0;
                        linhaAcompanhamento = `<p><strong>Módulos/aulas:</strong> ${feitos}${total ? ` / ${total}` : ''}</p>`;
                    } else if (tipo === 'data') {
                        const inicio = curso.dataInicio ? new Date(curso.dataInicio + 'T00:00:00').toLocaleDateString('pt-BR') : 'não informada';
                        const fim = curso.dataFimPrevista ? new Date(curso.dataFimPrevista + 'T00:00:00').toLocaleDateString('pt-BR') : 'não informada';
                        const faltam = curso.dataFimPrevista ? Math.ceil((new Date(curso.dataFimPrevista + 'T00:00:00') - new Date()) / 86400000) : null;
                        const faltamTexto = faltam === null ? '' : (faltam >= 0 ? ` (faltam ${faltam}d)` : ' (prazo encerrado)');
                        linhaAcompanhamento = `<p><strong>Período:</strong> ${inicio} até ${fim}${faltamTexto}</p>`;
                    } else if (tipo === 'manual') {
                        linhaAcompanhamento = '';
                    }

                    return `
                        <div class="card">
                            <div class="card-header">
                                <h3>${this.esc(curso.nome)}</h3>
                                <span class="tag">${this.esc((curso.status || 'planejado').replaceAll('-', ' '))}</span>
                            </div>
                            <div class="card-body">
                                <p><strong>Plataforma:</strong> ${this.esc(curso.plataforma || 'Não informada')}</p>
                                <p><strong>Área:</strong> ${this.esc(curso.area || 'Não informada')}</p>
                                ${linhaAcompanhamento}
                                <div class="progress-bar"><div class="progress-fill" style="width:${progresso}%"></div></div>
                                <p class="muted-text">${progresso}% concluído</p>
                                ${curso.link ? `<p><a href="${this.esc(curso.link)}" target="_blank" rel="noopener noreferrer">Abrir link do curso</a></p>` : ''}
                                ${curso.observacoes ? `<small>${this.esc(curso.observacoes)}</small>` : ''}
                                <div class="curriculum-actions">
                                    <button class="btn-icon btn-editar-extra-course" data-id="${this.esc(curso.id)}" title="Editar curso"><i class="fas fa-edit"></i></button>
                                    <button class="btn-icon btn-excluir-extra-course" data-id="${this.esc(curso.id)}" title="Excluir curso" style="color: var(--accent-danger);"><i class="fas fa-trash"></i></button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
                ${!cursos.length ? `<div class="card"><div class="card-body empty-state"><h3>Nenhum curso extra cadastrado</h3><p>Registre aqui Duolingo, cursos online, treinamentos e estudos fora da faculdade — por horas, por módulos ou por período, do jeito que fizer mais sentido pra cada curso.</p></div></div>` : ''}
            </div>
        `;
    }

    calcularHorasAulaSemana(aulas) {
        return aulas.reduce((total, aula) => total + (calcularDuracaoMinutos(aula.inicio, aula.fim) / 60), 0);
    }
}

window.ViewRenderer = ViewRenderer;
