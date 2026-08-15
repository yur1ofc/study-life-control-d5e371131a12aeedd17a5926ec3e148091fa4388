// schedule.js - Grade horária com modo dia/semana, edição e conflitos

class ScheduleManager {
    constructor() {
        this.aulas = [];
        this.HORARIO_INICIO = 7;
        this.HORARIO_FIM = 22;
        this.ALTURA_POR_HORA = 80;
        this.initialized = false;
        this.viewMode = 'day';
        this.selectedDay = new Date().getDay();
    }

    init() {
        this.loadAulas();
        this.initialized = true;
    }

    loadAulas() {
        this.aulas = window.app?.data?.classSchedule || [];
        return this.aulas;
    }

    async addAula(aula) {
        if (!aula.id) aula.id = generateId();

        const conflitos = this.verificarConflitos(aula);
        if (conflitos.length) {
            showToast(`Conflito com ${conflitos.map(c => c.materia).join(', ')}`, 'warning');
            return false;
        }

        const success = await dbService.addItem('classSchedule', aula);
        if (success) this.loadAulas();
        return success;
    }

    async editAula(id, updates) {
        this.loadAulas();

        const aulaExistente = this.aulas.find(a => a.id === id);
        if (!aulaExistente) return false;

        const aulaAtualizada = { ...aulaExistente, ...updates };
        const conflitos = this.verificarConflitos(aulaAtualizada, id);

        if (conflitos.length) {
            showToast(`Conflito com ${conflitos.map(c => c.materia).join(', ')}`, 'warning');
            return false;
        }

        const success = await dbService.updateItem('classSchedule', id, aulaAtualizada);
        if (success) this.loadAulas();
        return success;
    }

    async removeAula(id) {
        const success = await dbService.removeItem('classSchedule', id);
        if (success) this.loadAulas();
        return success;
    }

    getAulasPorDia(diaSemana) {
        this.loadAulas();
        return this.aulas
            .filter(a => parseInt(a.dia, 10) === diaSemana)
            .sort((a, b) => a.inicio.localeCompare(b.inicio));
    }

    verificarConflitos(novaAula, ignorarId = null) {
        const aulasDia = this.getAulasPorDia(parseInt(novaAula.dia, 10));

        return aulasDia.filter(a => {
            if (ignorarId && a.id === ignorarId) return false;

            const inicioExistente = calcularDuracaoMinutos('00:00', a.inicio);
            const fimExistente = calcularDuracaoMinutos('00:00', a.fim);
            const inicioNovo = calcularDuracaoMinutos('00:00', novaAula.inicio);
            const fimNovo = calcularDuracaoMinutos('00:00', novaAula.fim);

            return inicioNovo < fimExistente && fimNovo > inicioExistente;
        });
    }

    calcularPosicaoTop(horario) {
        const [horas, minutos] = horario.split(':').map(Number);
        const minutosDesdeInicio = (horas - this.HORARIO_INICIO) * 60 + minutos;
        return Math.max(0, (minutosDesdeInicio / 60) * this.ALTURA_POR_HORA);
    }

    calcularAltura(inicio, fim) {
        const duracaoMinutos = calcularDuracaoMinutos(inicio, fim);
        return Math.max(20, (duracaoMinutos / 60) * this.ALTURA_POR_HORA);
    }

    renderGrade() {
        if (this.viewMode === 'week') {
            this.renderGradeSemanal('schedule-vertical-container');
        } else {
            this.renderGradeDia(this.selectedDay, 'schedule-vertical-container');
        }
    }

    renderGradeDia(diaSemana, containerId) {
        this.loadAulas();

        const aulas = this.getAulasPorDia(diaSemana);
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';

        if (!aulas.length) {
            container.innerHTML = `
                <div class="no-classes-message">
                    <i class="fas fa-calendar-times"></i>
                    <p>Nenhuma aula neste dia</p>
                </div>
            `;
            return;
        }

        const totalHoras = this.HORARIO_FIM - this.HORARIO_INICIO + 1;
        const alturaTotal = totalHoras * this.ALTURA_POR_HORA;

        const scheduleDiv = document.createElement('div');
        scheduleDiv.className = 'schedule-vertical';
        scheduleDiv.style.height = `${alturaTotal}px`;

        for (let hora = this.HORARIO_INICIO; hora <= this.HORARIO_FIM; hora++) {
            const horaFormatada = `${hora.toString().padStart(2, '0')}:00`;
            const hourRow = document.createElement('div');
            hourRow.className = 'schedule-hour-row';
            hourRow.innerHTML = `
                <div class="hour-label">${horaFormatada}</div>
                <div class="hour-line"></div>
            `;
            scheduleDiv.appendChild(hourRow);
        }

        const eventsContainer = document.createElement('div');
        eventsContainer.className = 'schedule-events';
        eventsContainer.style.height = `${alturaTotal}px`;

        aulas.forEach(aula => {
            const top = this.calcularPosicaoTop(aula.inicio);
            const altura = this.calcularAltura(aula.inicio, aula.fim);
            const cor = aula.cor || '#3b82f6';

            const eventBlock = document.createElement('div');
            eventBlock.className = 'schedule-event-block';
            eventBlock.style.top = `${top}px`;
            eventBlock.style.height = `${altura}px`;
            eventBlock.style.backgroundColor = `${cor}20`;
            eventBlock.style.borderLeft = `4px solid ${cor}`;
            eventBlock.dataset.aulaId = aula.id;

            eventBlock.innerHTML = `
                <div class="event-content">
                    <strong>${escapeHtml(aula.materia)}</strong>
                    <div class="event-time">${escapeHtml(aula.inicio)} - ${escapeHtml(aula.fim)}</div>
                    ${aula.sala ? `<div class="event-room">📍 ${escapeHtml(aula.sala)}</div>` : ''}
                    ${aula.professor ? `<div class="event-prof">👤 ${escapeHtml(aula.professor)}</div>` : ''}
                </div>
            `;

            eventBlock.onclick = () => {
                if (window.app) window.app.openAulaModal(aula.id);
            };

            eventsContainer.appendChild(eventBlock);
        });

        scheduleDiv.appendChild(eventsContainer);
        container.appendChild(scheduleDiv);
    }

    renderGradeSemanal(containerId) {
        this.loadAulas();
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';

        const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        const weeklyGrid = document.createElement('div');
        weeklyGrid.className = 'weekly-schedule-grid';

        for (let dia = 0; dia < 7; dia++) {
            const aulasDia = this.getAulasPorDia(dia);

            const column = document.createElement('div');
            column.className = 'weekly-day-column';
            column.innerHTML = `
                <div class="weekly-day-header ${dia === new Date().getDay() ? 'today' : ''}">
                    <h4>${dias[dia]}</h4>
                    <small>${this.getTotalHorasDia(aulasDia)}h</small>
                </div>
                <div class="weekly-events">
                    ${
                        aulasDia.length
                            ? aulasDia.map(aula => `
                                <div class="weekly-event" data-aula-id="${aula.id}" style="border-left-color:${aula.cor || '#3b82f6'}">
                                    <div class="weekly-event-time">${escapeHtml(aula.inicio)} - ${escapeHtml(aula.fim)}</div>
                                    <div class="weekly-event-title">${escapeHtml(aula.materia)}</div>
                                    ${aula.sala ? `<div class="weekly-event-detail">📍 ${escapeHtml(aula.sala)}</div>` : ''}
                                    ${aula.professor ? `<div class="weekly-event-detail">👤 ${escapeHtml(aula.professor)}</div>` : ''}
                                </div>
                            `).join('')
                            : `<p class="no-classes">Sem aulas</p>`
                    }
                </div>
            `;
            weeklyGrid.appendChild(column);
        }

        container.appendChild(weeklyGrid);

        container.querySelectorAll('.weekly-event').forEach(el => {
            el.addEventListener('click', e => {
                const aulaId = e.currentTarget.dataset.aulaId;
                if (window.app) window.app.openAulaModal(aulaId);
            });
        });
    }

    getProximaAula() {
        this.loadAulas();

        const hoje = new Date();
        const diaSemana = hoje.getDay();
        const minutosAtuais = hoje.getHours() * 60 + hoje.getMinutes();

        const aulasHoje = this.getAulasPorDia(diaSemana);
        const proximaHoje = aulasHoje.find(a => calcularDuracaoMinutos('00:00', a.inicio) > minutosAtuais);
        if (proximaHoje) return proximaHoje;

        for (let i = 1; i <= 7; i++) {
            const proximoDia = (diaSemana + i) % 7;
            const aulas = this.getAulasPorDia(proximoDia);
            if (aulas.length) return aulas[0];
        }

        return null;
    }

    getAulaAtual() {
        this.loadAulas();

        const hoje = new Date();
        const diaSemana = hoje.getDay();
        const minutosAtuais = hoje.getHours() * 60 + hoje.getMinutes();

        return this.getAulasPorDia(diaSemana).find(a => {
            const minutosInicio = calcularDuracaoMinutos('00:00', a.inicio);
            const minutosFim = calcularDuracaoMinutos('00:00', a.fim);
            return minutosAtuais >= minutosInicio && minutosAtuais <= minutosFim;
        }) || null;
    }

    async marcarPresenca(aulaId, data, status) {
        const key = `${aulaId}_${data}`;
        const attendance = { ...(window.app?.data?.attendance || {}), [key]: status };
        const success = await dbService.saveData('attendance', attendance);

        if (success && window.app) {
            window.app.data.attendance = attendance;
        }

        if (success && status === 'absent') {
            const aula = this.aulas.find(a => a.id === aulaId);
            if (aula) {
                const tarefa = {
                    id: generateId(),
                    titulo: `Recuperar conteúdo da aula perdida - ${aula.materia}`,
                    materia: aula.materia,
                    prioridade: 'alta',
                    dataLimite: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    estimativa: 60,
                    concluida: false,
                    automatica: true
                };
                await dbService.addItem('tasks', tarefa);
                showToast('Tarefa de recuperação criada automaticamente!');
            }
        }

        return success;
    }

    getGradeStats() {
        const stats = {
            totalAulas: this.aulas.length,
            horasSemanais: 0,
            aulasPorMateria: {},
            diasMaisCheios: []
        };

        const horasPorDia = new Array(7).fill(0);
        const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

        this.aulas.forEach(aula => {
            const dia = parseInt(aula.dia, 10);
            const duracao = calcularDuracaoMinutos(aula.inicio, aula.fim) / 60;

            horasPorDia[dia] += duracao;
            stats.horasSemanais += duracao;
            stats.aulasPorMateria[aula.materia] = (stats.aulasPorMateria[aula.materia] || 0) + 1;
        });

        stats.diasMaisCheios = horasPorDia
            .map((horas, index) => ({ dia: diasSemana[index], horas }))
            .filter(d => d.horas > 0)
            .sort((a, b) => b.horas - a.horas);

        return stats;
    }

    getTotalHorasDia(aulas) {
        const totalMinutos = aulas.reduce((acc, a) => acc + calcularDuracaoMinutos(a.inicio, a.fim), 0);
        return (totalMinutos / 60).toFixed(1);
    }

    atualizarERenderizar() {
        this.loadAulas();
        this.renderGrade();
    }
}

window.scheduleManager = new ScheduleManager();

document.addEventListener('app-ready', () => {
    window.scheduleManager.init();
});

document.addEventListener('aulas-atualizadas', () => {
    if (window.scheduleManager) {
        window.scheduleManager.atualizarERenderizar();
    }
});