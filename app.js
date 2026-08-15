// app.js - Classe principal do aplicativo COMPLETA, CORRIGIDA E MELHORADA

class StudyLifeControl {
    constructor() {
        this.data = typeof DEFAULT_APP_DATA === 'function' ? DEFAULT_APP_DATA() : {
            user: null,
            subjects: [],
            sessions: [],
            tasks: [],
            exams: [],
            materials: [],
            grades: [],
            habits: [],
            learningMap: [],
            classSchedule: [],
            dailyLogs: [],
            classDiaries: [],
            reviews: [],
            curriculum: [],
            extraCourses: [],
            attendance: {},
            settings: {
                heavyMode: false,
                notifications: true,
                autoPlan: true
            }
        };

        this.currentView = 'dashboard';
        this.timerInterval = null;
        this.timerSeconds = 0;
        this.timerRunning = false;
        this.timerDuration = 0;
        this.timerStartedAt = null;
        this.viewRenderer = null;
        this.initialized = false;

        this.editingSessionId = null;
        this.editingTopicId = null;
        this.editingAulaId = null;
        this.editingMateriaId = null;
        this.editingTaskId = null;
        this.editingExamId = null;
        this.editingGradeId = null;
        this.editingMaterialId = null;
        this.editingCurriculumId = null;
        this.editingExtraCourseId = null;
        this.curriculumPrerequisitosSelecionados = [];
        this.curriculumViewState = { startSemester: 'all', visibleCount: 4 };
    }

    async init() {
        if (this.initialized) return;

        await this.loadData();

        this.viewRenderer = new ViewRenderer(this);
        this.setupEventListeners();
        this.updateSidebarInfo();
        this.applyHeavyMode();

        document.dispatchEvent(new Event('app-ready'));

        window.scheduleManager?.loadAulas();
        window.reviewSystem?.loadReviews();
        window.dailyLogService?.loadLogs();
        window.classDiaryService?.loadDiaries();
        window.gradeCalculator?.loadData();
        window.aiAssistant?.updateContext(this.data);

        this.loadView('dashboard');
        this.initialized = true;
        this.checkDailyReviews();
    }

    async loadData() {
        const user = auth.currentUser;
        if (!user) return this.data;

        const data = await dbService.loadUserData(user.uid);
        this.data = data || (typeof DEFAULT_APP_DATA === 'function' ? DEFAULT_APP_DATA() : this.data);
        if (!Array.isArray(this.data.curriculum)) this.data.curriculum = [];
        if (!Array.isArray(this.data.extraCourses)) this.data.extraCourses = [];
        this.normalizeCurriculumInMemory();
        return this.data;
    }

    checkDailyReviews() {
        if (!window.reviewSystem) return;

        const revisoesHoje = window.reviewSystem.getRevisoesHoje();
        if (revisoesHoje.length > 0) {
            showToast(`Você tem ${revisoesHoje.length} revisão(ões) para hoje!`, 'info');
        }
    }

    renderSetupForm() {
        const container = document.getElementById('materias-container');
        if (container) {
            container.innerHTML = '';
            this.addMateriaField();
        }

        const aulasContainer = document.getElementById('aulas-container');
        if (aulasContainer) aulasContainer.innerHTML = '';
    }

    addMateriaField() {
        const container = document.getElementById('materias-container');
        if (!container) return;

        const item = document.createElement('div');
        item.className = 'materia-item';
        item.innerHTML = `
            <div class="materia-fields">
                <input type="text" class="materia-nome" placeholder="Nome da matéria" required>
                <select class="materia-dificuldade">
                    <option value="1">Dificuldade 1</option>
                    <option value="2">Dificuldade 2</option>
                    <option value="3" selected>Dificuldade 3</option>
                    <option value="4">Dificuldade 4</option>
                    <option value="5">Dificuldade 5</option>
                </select>
                <select class="materia-peso" title="Peso: quanto essa matéria exige de você em relação às outras">
                    <option value="1">⚡ Peso 1 — pouco esforço</option>
                    <option value="2">⚡ Peso 2 — esforço leve</option>
                    <option value="3" selected>⚡ Peso 3 — esforço médio</option>
                    <option value="4">⚡ Peso 4 — exige bastante</option>
                    <option value="5">⚡ Peso 5 — prioridade máxima</option>
                </select>
                <input type="number" class="materia-nota-desejada" placeholder="Nota desejada" min="0" max="10" step="0.1" value="7">
            </div>
            <button type="button" class="btn-remove"><i class="fas fa-times"></i></button>
        `;

        item.querySelector('.btn-remove')?.addEventListener('click', () => item.remove());
        container.appendChild(item);
    }

    addAulaField() {
        const container = document.getElementById('aulas-container');
        if (!container) return;

        const materiaInputs = document.querySelectorAll('.materia-nome');
        const materias = Array.from(materiaInputs)
            .map(input => input.value.trim())
            .filter(Boolean);

        if (!materias.length) {
            showToast('Adicione pelo menos uma matéria primeiro', 'warning');
            return;
        }

        const item = document.createElement('div');
        item.className = 'aula-item';

        const optionsHtml = [
            '<option value="">Selecione</option>',
            ...materias.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`)
        ].join('');

        item.innerHTML = `
            <div class="aula-fields">
                <select class="aula-materia" required>${optionsHtml}</select>
                <select class="aula-dia" required>
                    <option value="0">Domingo</option>
                    <option value="1">Segunda</option>
                    <option value="2">Terça</option>
                    <option value="3">Quarta</option>
                    <option value="4">Quinta</option>
                    <option value="5">Sexta</option>
                    <option value="6">Sábado</option>
                </select>
                <input type="time" class="aula-inicio" required>
                <input type="time" class="aula-fim" required>
                <input type="text" class="aula-sala" placeholder="Sala">
                <input type="text" class="aula-professor" placeholder="Professor">
            </div>
            <button type="button" class="btn-remove"><i class="fas fa-times"></i></button>
        `;

        item.querySelector('.btn-remove')?.addEventListener('click', () => item.remove());
        container.appendChild(item);
    }

    async handleSetupSubmit(e) {
        e.preventDefault();
        showLoading();

        try {
            const subjects = [];
            document.querySelectorAll('.materia-item').forEach(item => {
                const nome = item.querySelector('.materia-nome')?.value.trim();
                if (!nome) return;

                subjects.push({
                    id: generateId(),
                    nome,
                    dificuldade: parseInt(item.querySelector('.materia-dificuldade')?.value, 10) || 3,
                    peso: parseInt(item.querySelector('.materia-peso')?.value, 10) || 3,
                    notaDesejada: parseFloat(item.querySelector('.materia-nota-desejada')?.value) || 7
                });
            });

            const diasPreferidos = Array.from(
                document.querySelectorAll('#dias-preferidos-container input:checked')
            ).map(cb => cb.value);

            this.data.user = {
                nome: document.getElementById('nome')?.value?.trim() || '',
                curso: document.getElementById('curso')?.value?.trim() || '',
                universidade: document.getElementById('universidade')?.value?.trim() || '',
                semestre: document.getElementById('semestre')?.value || '',
                turnoPrincipal: document.getElementById('turno-principal')?.value || 'noite',
                diasPreferidos,
                horasMaximas: parseInt(document.getElementById('horas-maximas')?.value, 10) || 6,
                horarioSono: document.getElementById('horario-sono')?.value || '',
                tempoDeslocamento: parseInt(document.getElementById('tempo-deslocamento')?.value, 10) || 30,
                tipoRotina: document.getElementById('tipo-rotina')?.value || 'so-estuda',
                nivelDisciplina: document.getElementById('nivel-disciplina')?.value || 'medio',
                dificuldadeAtual: document.getElementById('dificuldade-atual')?.value || 'organizacao',
                createdAt: new Date().toISOString(),
                streak: 0,
                lastStudyDate: null
            };

            this.data.subjects = subjects;

            const aulas = [];
            document.querySelectorAll('.aula-item').forEach(item => {
                const materia = item.querySelector('.aula-materia')?.value;
                if (!materia) return;

                aulas.push({
                    id: generateId(),
                    materia,
                    dia: item.querySelector('.aula-dia')?.value || '1',
                    inicio: item.querySelector('.aula-inicio')?.value || '',
                    fim: item.querySelector('.aula-fim')?.value || '',
                    sala: item.querySelector('.aula-sala')?.value || '',
                    professor: item.querySelector('.aula-professor')?.value || '',
                    bloco: '',
                    cor: '#3b82f6'
                });
            });

            this.data.classSchedule = aulas;

            const success = await dbService.saveAllData(this.data);

            if (success) {
                await this.ensurePostSetupReady();
                showToast('Configuração concluída!');
            }
        } catch (error) {
            console.error('Erro no setup:', error);
            showToast('Erro ao concluir configuração', 'error');
        } finally {
            hideLoading();
        }
    }

    setupEventListeners() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', e => {
                e.preventDefault();

                const view = e.currentTarget.dataset.view;
                this.loadView(view);

                document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
                e.currentTarget.classList.add('active');

                const span = e.currentTarget.querySelector('span');
                const pageTitle = document.getElementById('page-title');
                if (span && pageTitle) pageTitle.textContent = span.textContent;
            });
        });

        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.modal').forEach(modal => {
                    modal.style.display = 'none';
                });
                this.resetModalStates();
            });
        });

        window.addEventListener('click', e => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
                this.resetModalStates();
            }
        });

        document.getElementById('form-sessao')?.addEventListener('submit', e => this.handleSessaoSubmit(e));
        document.getElementById('form-tarefa')?.addEventListener('submit', e => this.handleTarefaSubmit(e));
        document.getElementById('form-prova')?.addEventListener('submit', e => this.handleProvaSubmit(e));
        document.getElementById('form-topico')?.addEventListener('submit', e => this.handleTopicoSubmit(e));
        document.getElementById('form-nota')?.addEventListener('submit', e => this.handleNotaSubmit(e));
        document.getElementById('form-material')?.addEventListener('submit', e => this.handleMaterialSubmit(e));
        document.getElementById('form-materia')?.addEventListener('submit', e => this.handleMateriaSubmit(e));
        document.getElementById('form-curriculum')?.addEventListener('submit', e => this.handleCurriculumSubmit(e));
        document.getElementById('form-extra-course')?.addEventListener('submit', e => this.handleExtraCourseSubmit(e));
        document.getElementById('form-aula')?.addEventListener('submit', e => this.handleAulaSubmit(e));
        document.getElementById('form-daily-log')?.addEventListener('submit', e => this.handleDailyLogSubmit(e));
        document.getElementById('form-class-diary')?.addEventListener('submit', e => this.handleClassDiarySubmit(e));

        document.getElementById('modo-faculdade-pesada')?.addEventListener('change', async e => {
            this.data.settings.heavyMode = e.target.checked;
            await dbService.saveData('settings', this.data.settings);
            this.applyHeavyMode();
            showToast(`Modo Faculdade Pesada ${e.target.checked ? 'ativado' : 'desativado'}`, 'info');
        });

        document.getElementById('refresh-data')?.addEventListener('click', async () => {
            await this.loadData();
            this.loadView(this.currentView);
            showToast('Dados atualizados');
        });
    }

    resetModalStates() {
        this.editingSessionId = null;
        this.editingTopicId = null;
        this.editingAulaId = null;
        this.editingMateriaId = null;
        this.editingTaskId = null;
        this.editingExamId = null;
        this.editingGradeId = null;
        this.editingMaterialId = null;
        this.editingCurriculumId = null;
        this.editingExtraCourseId = null;
        this.curriculumPrerequisitosSelecionados = [];

        const sessaoBtn = document.querySelector('#form-sessao .btn-primary');
        const topicoBtn = document.querySelector('#form-topico .btn-primary');
        const aulaBtn = document.querySelector('#form-aula .btn-primary');
        const tarefaBtn = document.querySelector('#form-tarefa .btn-primary');
        const provaBtn = document.querySelector('#form-prova .btn-primary');
        const notaBtn = document.querySelector('#form-nota .btn-primary');
        const materialBtn = document.querySelector('#form-material .btn-primary');
        const materiaBtn = document.querySelector('#form-materia .btn-primary');
        const curriculumBtn = document.querySelector('#form-curriculum .btn-primary');
        const extraCourseBtn = document.querySelector('#form-extra-course .btn-primary');

        if (sessaoBtn) sessaoBtn.textContent = 'Agendar Sessão';
        if (topicoBtn) topicoBtn.textContent = 'Adicionar Tópico';
        if (aulaBtn) aulaBtn.textContent = 'Salvar Aula';
        if (tarefaBtn) tarefaBtn.textContent = 'Adicionar Tarefa';
        if (provaBtn) provaBtn.textContent = 'Salvar';
        if (notaBtn) notaBtn.textContent = 'Registrar Nota';
        if (materialBtn) materialBtn.textContent = 'Salvar Material';
        if (materiaBtn) materiaBtn.textContent = 'Salvar Matéria';
        if (curriculumBtn) curriculumBtn.textContent = 'Salvar Componente';
        if (extraCourseBtn) extraCourseBtn.textContent = 'Salvar Curso';
    }

    applyHeavyMode() {
        if (this.data.settings?.heavyMode) {
            document.body.classList.add('heavy-mode');
        } else {
            document.body.classList.remove('heavy-mode');
        }

        const checkbox = document.getElementById('modo-faculdade-pesada');
        if (checkbox) checkbox.checked = !!this.data.settings?.heavyMode;

        const configCheckbox = document.getElementById('config-heavy-mode');
        if (configCheckbox) configCheckbox.checked = !!this.data.settings?.heavyMode;
    }

    updateSidebarInfo() {
        if (!this.data.user) return;

        const user = auth.currentUser;
        const nameEl = document.getElementById('sidebar-user-name');
        const emailEl = document.getElementById('sidebar-user-email');
        const streakEl = document.getElementById('sidebar-streak');
        const avatarEl = document.getElementById('user-avatar');

        if (nameEl) nameEl.textContent = this.data.user.nome || 'Usuário';
        if (emailEl) emailEl.textContent = user?.email || '';
        if (streakEl) streakEl.textContent = `${this.data.user.streak || 0} dias`;

        if (avatarEl) {
            if (user?.photoURL) {
                avatarEl.src = user.photoURL;
                avatarEl.style.display = 'block';
            } else {
                avatarEl.style.display = 'none';
            }
        }
    }

    loadView(view) {
        if (!this.viewRenderer) {
            this.viewRenderer = new ViewRenderer(this);
        }

        this.currentView = view;
        const container = document.getElementById('view-container');
        if (!container) return;

        let html = '';

        switch (view) {
            case 'dashboard': html = this.viewRenderer.renderDashboard(); break;
            case 'mentor-ia': html = this.viewRenderer.renderMentorIA(); break;
            case 'grade-horaria': html = this.viewRenderer.renderGradeHoraria(); break;
            case 'sessoes': html = this.viewRenderer.renderSessoes(); break;
            case 'tarefas': html = this.viewRenderer.renderTarefas(); break;
            case 'provas': html = this.viewRenderer.renderProvas(); break;
            case 'mapa-aprendizado': html = this.viewRenderer.renderMapaAprendizado(); break;
            case 'materiais': html = this.viewRenderer.renderMateriais(); break;
            case 'calendario': html = this.viewRenderer.renderCalendario(); break;
            case 'previsao-notas': html = this.viewRenderer.renderPrevisaoNotas(); break;
            case 'habitos': html = this.viewRenderer.renderHabitos(); break;
            case 'estatisticas': html = this.viewRenderer.renderEstatisticas(); break;
            case 'foco': html = this.viewRenderer.renderModoFoco(); break;
            case 'configuracoes': html = this.viewRenderer.renderConfiguracoes(); break;
            case 'materias': html = this.viewRenderer.renderMaterias(); break;
            case 'grade-curricular': html = this.viewRenderer.renderGradeCurricular(); break;
            case 'cursos-extras': html = this.viewRenderer.renderCursosExtras(); break;
            default: html = this.viewRenderer.renderDashboard();
        }

        container.innerHTML = html;
        this.setupViewEvents(view);
        window.aiAssistant?.updateContext(this.data);
    }

    setupViewEvents(view) {
        if (view === 'sessoes') {
            document.getElementById('btn-nova-sessao')?.addEventListener('click', () => this.openModal('sessao'));

            document.querySelectorAll('.btn-concluir-sessao').forEach(btn => {
                btn.addEventListener('click', e => this.concluirSessao(e.currentTarget.dataset.id));
            });

            document.querySelectorAll('.btn-editar-sessao').forEach(btn => {
                btn.addEventListener('click', e => this.editarSessao(e.currentTarget.dataset.id));
            });

            document.querySelectorAll('.btn-excluir-sessao').forEach(btn => {
                btn.addEventListener('click', e => this.excluirSessao(e.currentTarget.dataset.id));
            });
        }

        if (view === 'tarefas') {
            document.getElementById('btn-nova-tarefa')?.addEventListener('click', () => this.openModal('tarefa'));

            document.querySelectorAll('.btn-concluir-tarefa').forEach(btn => {
                btn.addEventListener('click', e => this.concluirTarefa(e.currentTarget.dataset.id));
            });

            document.querySelectorAll('.btn-editar-tarefa').forEach(btn => {
                btn.addEventListener('click', e => this.editarTarefa(e.currentTarget.dataset.id));
            });

            document.querySelectorAll('.btn-excluir-tarefa').forEach(btn => {
                btn.addEventListener('click', e => this.excluirTarefa(e.currentTarget.dataset.id));
            });
        }

        if (view === 'provas') {
            document.getElementById('btn-nova-prova')?.addEventListener('click', () => this.openModal('prova'));

            document.querySelectorAll('.btn-editar-prova').forEach(btn => {
                btn.addEventListener('click', e => this.editarProva(e.currentTarget.dataset.id));
            });

            document.querySelectorAll('.btn-excluir-prova').forEach(btn => {
                btn.addEventListener('click', e => this.excluirProva(e.currentTarget.dataset.id));
            });
        }

        if (view === 'grade-horaria') {
            document.getElementById('btn-nova-aula')?.addEventListener('click', () => this.openModal('aula'));

            document.querySelectorAll('.btn-remover-aula').forEach(btn => {
                btn.addEventListener('click', async e => {
                    const id = e.currentTarget.dataset.id;
                    if (window.scheduleManager) {
                        await window.scheduleManager.removeAula(id);
                        document.dispatchEvent(new Event('aulas-atualizadas'));
                    }
                    this.loadView('grade-horaria');
                    showToast('Aula removida');
                });
            });

            document.querySelectorAll('.btn-editar-aula').forEach(btn => {
                btn.addEventListener('click', e => this.editarAula(e.currentTarget.dataset.id));
            });

            document.getElementById('grade-view-mode')?.addEventListener('change', e => {
                if (window.scheduleManager) {
                    window.scheduleManager.viewMode = e.target.value === 'semana' ? 'week' : 'day';
                }
                this.loadView('grade-horaria');
            });

            document.getElementById('grade-day-select')?.addEventListener('change', e => {
                if (window.scheduleManager) {
                    window.scheduleManager.selectedDay = parseInt(e.target.value, 10);
                }
                this.loadView('grade-horaria');
            });

            document.getElementById('exportar-grade')?.addEventListener('click', () => this.exportarGradeHoraria());
        }

        if (view === 'mentor-ia') {
            this.setupIAEvents();
        }

        if (view === 'mapa-aprendizado') {
            document.getElementById('btn-novo-topico')?.addEventListener('click', () => this.openModal('topico'));

            document.querySelectorAll('.btn-editar-topico').forEach(btn => {
                btn.addEventListener('click', e => this.editarTopico(e.currentTarget.dataset.id));
            });

            document.querySelectorAll('.btn-excluir-topico').forEach(btn => {
                btn.addEventListener('click', e => this.excluirTopico(e.currentTarget.dataset.id));
            });
        }

        if (view === 'previsao-notas') {
            document.getElementById('btn-registrar-nota')?.addEventListener('click', () => this.openModal('nota'));

            document.querySelectorAll('.btn-editar-nota').forEach(btn => {
                btn.addEventListener('click', e => this.editarNota(e.currentTarget.dataset.id));
            });

            document.querySelectorAll('.btn-excluir-nota').forEach(btn => {
                btn.addEventListener('click', e => this.excluirNota(e.currentTarget.dataset.id));
            });
        }

        if (view === 'materiais') {
            document.getElementById('btn-novo-material')?.addEventListener('click', () => this.openModal('material'));

            document.querySelectorAll('.btn-editar-material').forEach(btn => {
                btn.addEventListener('click', e => this.editarMaterial(e.currentTarget.dataset.id));
            });

            document.querySelectorAll('.btn-excluir-material').forEach(btn => {
                btn.addEventListener('click', e => this.excluirMaterial(e.currentTarget.dataset.id));
            });
        }

        if (view === 'foco') {
            document.getElementById('timer-start')?.addEventListener('click', () => this.startTimer());
            document.getElementById('timer-pause')?.addEventListener('click', () => this.pauseTimer());
            document.getElementById('timer-reset')?.addEventListener('click', () => this.resetTimer());
        }

        if (view === 'habitos') {
            document.querySelectorAll('.toggle-habito').forEach(btn => {
                btn.addEventListener('click', e => this.toggleHabito(e.currentTarget.dataset.habito));
            });
        }

        if (view === 'configuracoes') {
            // Navegação entre abas
            document.querySelectorAll('[data-config-aba]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const aba = btn.dataset.configAba;
                    const container = document.getElementById('view-container');
                    if (container) {
                        container.innerHTML = this.viewRenderer.renderConfiguracoes(aba);
                        this.setupViewEvents('configuracoes');
                    }
                });
            });

            // Aba Geral
            document.getElementById('config-notificacoes')?.addEventListener('change', async e => {
                this.data.settings.notifications = e.target.checked;
                await dbService.saveData('settings', this.data.settings);
            });
            document.getElementById('config-auto-plan')?.addEventListener('change', async e => {
                this.data.settings.autoPlan = e.target.checked;
                await dbService.saveData('settings', this.data.settings);
            });
            document.getElementById('config-heavy-mode')?.addEventListener('change', async e => {
                this.data.settings.heavyMode = e.target.checked;
                await dbService.saveData('settings', this.data.settings);
                this.applyHeavyMode?.();
            });

            // Aba Calendário — link .ics assinável
            document.getElementById('btn-gerar-calendario')?.addEventListener('click', async () => {
                const btn = document.getElementById('btn-gerar-calendario');
                if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...'; }
                const token = await window.calendarFeed?.getOrCreateToken();
                if (token) {
                    const container = document.getElementById('view-container');
                    if (container) {
                        container.innerHTML = this.viewRenderer.renderConfiguracoes('calendario');
                        this.setupViewEvents('configuracoes');
                    }
                    window.showToast?.('Link de calendário criado!', 'success');
                } else {
                    window.showToast?.('Não foi possível gerar o link agora.', 'error');
                    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-calendar-plus"></i> Gerar meu link de calendário'; }
                }
            });

            document.getElementById('btn-regenerar-calendario')?.addEventListener('click', async () => {
                if (!confirm('O link antigo vai parar de funcionar. Você vai precisar assinar o novo link de novo no seu app de calendário. Continuar?')) return;
                const token = await window.calendarFeed?.regenerateToken();
                if (token) {
                    const container = document.getElementById('view-container');
                    if (container) {
                        container.innerHTML = this.viewRenderer.renderConfiguracoes('calendario');
                        this.setupViewEvents('configuracoes');
                    }
                    window.showToast?.('Novo link gerado — o antigo foi revogado.', 'success');
                } else {
                    window.showToast?.('Não foi possível gerar um novo link agora.', 'error');
                }
            });

            document.getElementById('btn-copiar-calendario')?.addEventListener('click', () => {
                const input = document.getElementById('calendario-url');
                if (!input) return;
                input.select();
                navigator.clipboard?.writeText(input.value)
                    .then(() => window.showToast?.('Link copiado!', 'success'))
                    .catch(() => document.execCommand('copy'));
            });

            // Aba Calendário — alarmes push
            document.getElementById('config-push-enabled')?.addEventListener('change', async e => {
                const checkbox = e.target;
                if (checkbox.checked) {
                    try {
                        await window.pushNotifications.enable();
                        window.showToast?.('Alarmes ativados neste dispositivo!', 'success');
                    } catch (error) {
                        checkbox.checked = false;
                        window.showToast?.(error.message || 'Não foi possível ativar os alarmes.', 'error');
                    }
                } else {
                    await window.pushNotifications.disable();
                    window.showToast?.('Alarmes desativados neste dispositivo.', 'success');
                }
            });

            ['exams', 'tasks', 'sessions'].forEach(tipo => {
                const map = { exams: 'examsHoursBefore', tasks: 'tasksHoursBefore', sessions: 'sessionsMinutesBefore' };
                document.getElementById(`config-reminder-${tipo}`)?.addEventListener('change', async e => {
                    await window.pushNotifications?.saveReminderPrefs({ [map[tipo]]: parseInt(e.target.value, 10) });
                    window.showToast?.('Preferência de lembrete salva!', 'success');
                });
            });

            // Aba Perfil
            document.getElementById('btn-salvar-perfil')?.addEventListener('click', async () => {
                const nome = document.getElementById('config-nome')?.value?.trim();
                const universidade = document.getElementById('config-universidade')?.value?.trim();
                const curso = document.getElementById('config-curso')?.value?.trim();
                const semestre = document.getElementById('config-semestre')?.value;
                if (nome) this.data.user.nome = nome;
                if (universidade) this.data.user.universidade = universidade;
                if (curso) this.data.user.curso = curso;
                if (semestre) this.data.user.semestre = semestre;
                await dbService.saveData('user', this.data.user);
                window.showToast?.('Perfil atualizado!', 'success');
            });

            // Aba Tema
            document.querySelectorAll('.config-tema-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const tema = btn.dataset.tema;
                    localStorage.setItem('slc-theme', tema);
                    window.applyTheme?.(tema);
                    document.querySelectorAll('.config-tema-btn').forEach(b => {
                        b.style.borderColor = b.dataset.tema === tema ? 'var(--accent-primary)' : 'var(--border)';
                    });
                    window.showToast?.('Tema aplicado!', 'success');
                });
            });

            // Aba Dados
            document.getElementById('exportar-dados')?.addEventListener('click', () => this.exportarDados());
            document.getElementById('limpar-dados')?.addEventListener('click', () => this.limparDados());
            document.getElementById('btn-relatar-problema')?.addEventListener('click', () => {
                window.open('https://github.com/yur1ofc/study-life-control/issues/new', '_blank');
            });
        }

        if (view === 'materias') {
            document.getElementById('btn-nova-materia')?.addEventListener('click', () => this.openModal('materia'));

            document.querySelectorAll('.btn-editar-materia').forEach(btn => {
                btn.addEventListener('click', e => this.editarMateria(e.currentTarget.dataset.id));
            });

            document.querySelectorAll('.btn-excluir-materia').forEach(btn => {
                btn.addEventListener('click', e => this.excluirMateria(e.currentTarget.dataset.id));
            });
        }

        if (view === 'grade-curricular') {
            document.getElementById('btn-novo-curriculum')?.addEventListener('click', () => this.openModal('curriculum'));
            document.getElementById('btn-importar-ufob')?.addEventListener('click', () => this.importarGradeUfob());
            document.getElementById('btn-finalizar-semestre')?.addEventListener('click', () => this.abrirFinalizarSemestre());
            document.getElementById('btn-editar-semestre-atual')?.addEventListener('click', () => this.abrirGerenciarSemestreAtual());

            document.querySelectorAll('.btn-editar-curriculum').forEach(btn => {
                btn.addEventListener('click', e => this.editarCurriculum(e.currentTarget.dataset.id));
            });

            document.querySelectorAll('.btn-excluir-curriculum').forEach(btn => {
                btn.addEventListener('click', e => this.excluirCurriculum(e.currentTarget.dataset.id));
            });
       
            document.getElementById('curriculum-semester-start')?.addEventListener('change', async e => {
                this.curriculumViewState.startSemester = e.target.value;
                await this.saveCurriculumViewSettings();
                this.loadView('grade-curricular');
            });

            document.getElementById('curriculum-semester-count')?.addEventListener('change', async e => {
                this.curriculumViewState.visibleCount = e.target.value === 'all' ? 'all' : (parseInt(e.target.value, 10) || 4);
                await this.saveCurriculumViewSettings();
                this.loadView('grade-curricular');
            });

            document.querySelectorAll('.semester-shortcut-pill').forEach(btn => {
                btn.addEventListener('click', async e => {
                    this.curriculumViewState.startSemester = e.currentTarget.dataset.semester || 'all';
                    const startSelect = document.getElementById('curriculum-semester-start');
                    if (startSelect) startSelect.value = this.curriculumViewState.startSemester;
                    await this.saveCurriculumViewSettings();
                    this.loadView('grade-curricular');
                });
            });
        }

        if (view === 'cursos-extras') {
            document.getElementById('btn-novo-extra-course')?.addEventListener('click', () => this.openModal('extra-course'));

            document.querySelectorAll('.btn-editar-extra-course').forEach(btn => {
                btn.addEventListener('click', e => this.editarExtraCourse(e.currentTarget.dataset.id));
            });

            document.querySelectorAll('.btn-excluir-extra-course').forEach(btn => {
                btn.addEventListener('click', e => this.excluirExtraCourse(e.currentTarget.dataset.id));
            });
        }

        document.getElementById('quick-sessao')?.addEventListener('click', () => this.openModal('sessao'));
        document.getElementById('quick-tarefa')?.addEventListener('click', () => this.openModal('tarefa'));
        document.getElementById('quick-prova')?.addEventListener('click', () => this.openModal('prova'));
        document.getElementById('quick-foco')?.addEventListener('click', () => this.loadView('foco'));
        document.getElementById('perguntar-ia')?.addEventListener('click', () => this.loadView('mentor-ia'));

        document.querySelectorAll('.btn-adicionar-sessao-rapida').forEach(btn => {
            btn.addEventListener('click', e => {
                this.openModal('sessao', {
                    materia: e.currentTarget.dataset.materia,
                    tipo: e.currentTarget.dataset.tipo,
                    duracao: e.currentTarget.dataset.duracao
                });
            });
        });
    }

    setupIAEvents() {
        const input = document.getElementById('chat-input');
        const sendBtn = document.getElementById('chat-send');
        const messages = document.getElementById('chat-messages');

        if (!input || !sendBtn || !messages) return;

        const appendMessage = (role, content, isLoading = false) => {
            const wrapper = document.createElement('div');
            wrapper.className = `message ${role}${isLoading ? ' loading' : ''}`;

            const contentEl = document.createElement('div');
            contentEl.className = 'message-content';

            if (role === 'assistant') {
                contentEl.innerHTML = nl2brSafe(content);
            } else {
                contentEl.textContent = content;
            }

            wrapper.appendChild(contentEl);
            messages.appendChild(wrapper);
            messages.scrollTop = messages.scrollHeight;

            return wrapper;
        };

        const sendMessage = async () => {
            const text = input.value.trim();
            if (!text) return;

            appendMessage('user', text);
            input.value = '';

            const loadingEl = appendMessage('assistant', 'Pensando...', true);

            try {
                window.aiAssistant?.updateContext(this.data);
                const resposta = await window.aiAssistant.ask(text);

                loadingEl.remove();
                appendMessage('assistant', resposta || 'Não consegui responder agora.');
            } catch (error) {
                console.error('Erro no chat IA:', error);
                loadingEl.remove();
                appendMessage('assistant', 'Deu erro ao responder. Tenta de novo.');
            }
        };

        sendBtn.onclick = sendMessage;
        input.onkeypress = e => {
            if (e.key === 'Enter') sendMessage();
        };

        document.querySelectorAll('.sugestao-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                input.value = btn.dataset.pergunta || '';
                sendMessage();
            });
        });

        document.getElementById('ia-plano-hoje')?.addEventListener('click', () => {
            input.value = 'Qual meu plano de estudo para hoje?';
            sendMessage();
        });

        document.getElementById('ia-plano-semana')?.addEventListener('click', () => {
            input.value = 'Qual o plano para a semana?';
            sendMessage();
        });

        document.getElementById('ia-analisar-risco')?.addEventListener('click', () => {
            input.value = 'Quais os riscos acadêmicos?';
            sendMessage();
        });
    }

    populateSubjectSelects() {
        const selectIds = [
            'sessao-materia',
            'tarefa-materia',
            'prova-materia',
            'topico-materia',
            'nota-materia',
            'material-materia',
            'aula-materia'
        ];

        selectIds.forEach(id => {
            const select = document.getElementById(id);
            if (!select) return;

            const currentValue = select.value;
            select.innerHTML = '<option value="">Selecione</option>';

            this.data.subjects.forEach(s => {
                const option = document.createElement('option');
                option.value = s.nome;
                option.textContent = s.nome;
                select.appendChild(option);
            });

            if (currentValue && this.data.subjects.some(s => s.nome === currentValue)) {
                select.value = currentValue;
            }
        });
    }

    openModal(modalType, data = {}) {
        if (['sessao', 'tarefa', 'prova', 'topico', 'nota', 'material', 'aula', 'curriculum', 'extra-course'].includes(modalType)) {
            this.populateSubjectSelects();
        }

        if (modalType === 'sessao') {
            const btn = document.querySelector('#form-sessao .btn-primary');
            if (btn) btn.textContent = this.editingSessionId ? 'Atualizar Sessão' : 'Agendar Sessão';

            if (data.materia) document.getElementById('sessao-materia').value = data.materia;
            if (data.tipo) document.getElementById('sessao-tipo').value = data.tipo;
            if (data.duracao) document.getElementById('sessao-duracao').value = data.duracao;

            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            document.getElementById('sessao-data').value = data.data || now.toISOString().slice(0, 16);
            document.getElementById('sessao-topico').value = data.topico || '';
        }

        if (modalType === 'tarefa') {
            const btn = document.querySelector('#form-tarefa .btn-primary');
            if (btn) btn.textContent = this.editingTaskId ? 'Atualizar Tarefa' : 'Adicionar Tarefa';

            document.getElementById('tarefa-titulo').value = data.titulo || '';
            if (data.materia) document.getElementById('tarefa-materia').value = data.materia;
            document.getElementById('tarefa-prioridade').value = data.prioridade || 'media';
            document.getElementById('tarefa-data').value = data.dataLimite || '';
            document.getElementById('tarefa-estimativa').value = data.estimativa || 60;
        }

        if (modalType === 'prova') {
            const btn = document.querySelector('#form-prova .btn-primary');
            if (btn) btn.textContent = this.editingExamId ? 'Atualizar' : 'Salvar';

            document.getElementById('prova-titulo').value = data.titulo || '';
            if (data.materia) document.getElementById('prova-materia').value = data.materia;
            document.getElementById('prova-tipo').value = data.tipo || 'prova';
            document.getElementById('prova-data').value = data.data || '';
            document.getElementById('prova-peso').value = data.peso || 100;
            document.getElementById('prova-importancia').value = data.importancia || 'alta';
        }

        if (modalType === 'topico') {
            const btn = document.querySelector('#form-topico .btn-primary');
            if (btn) btn.textContent = this.editingTopicId ? 'Atualizar Tópico' : 'Adicionar Tópico';

            if (data.materia) document.getElementById('topico-materia').value = data.materia;
            document.getElementById('topico-nome').value = data.nome || '';
            document.getElementById('topico-dificuldade').value = data.dificuldade || 3;
            document.getElementById('topico-status').value = data.status || 'nao-comecei';
            document.getElementById('topico-confianca').value = data.confianca || 3;
        }

        if (modalType === 'nota') {
            const btn = document.querySelector('#form-nota .btn-primary');
            if (btn) btn.textContent = this.editingGradeId ? 'Atualizar Nota' : 'Registrar Nota';

            if (data.materia) document.getElementById('nota-materia').value = data.materia;
            document.getElementById('nota-avaliacao').value = data.avaliacao || '';
            document.getElementById('nota-valor').value = data.valor ?? '';
            document.getElementById('nota-peso').value = data.peso || 100;
        }

        if (modalType === 'material') {
            const btn = document.querySelector('#form-material .btn-primary');
            if (btn) btn.textContent = this.editingMaterialId ? 'Atualizar Material' : 'Salvar Material';

            document.getElementById('material-titulo').value = data.titulo || '';
            if (data.materia) document.getElementById('material-materia').value = data.materia;
            document.getElementById('material-tipo').value = data.tipo || 'link';
            document.getElementById('material-conteudo').value = data.conteudo || '';
        }

        if (modalType === 'aula') {
            const btn = document.querySelector('#form-aula .btn-primary');
            if (btn) btn.textContent = this.editingAulaId ? 'Atualizar Aula' : 'Salvar Aula';

            if (data.materia) document.getElementById('aula-materia').value = data.materia;
            if (data.dia !== undefined) document.getElementById('aula-dia').value = data.dia;
            if (data.inicio) document.getElementById('aula-inicio').value = data.inicio;
            if (data.fim) document.getElementById('aula-fim').value = data.fim;
            document.getElementById('aula-sala').value = data.sala || '';
            document.getElementById('aula-professor').value = data.professor || '';
            if (document.getElementById('aula-bloco')) document.getElementById('aula-bloco').value = data.bloco || '';
            if (document.getElementById('aula-cor')) document.getElementById('aula-cor').value = data.cor || '#3b82f6';
        }

        if (modalType === 'materia') {
            const btn = document.querySelector('#form-materia .btn-primary');
            if (btn) btn.textContent = this.editingMateriaId ? 'Atualizar Matéria' : 'Salvar Matéria';

            document.getElementById('materia-nome-modal').value = data.nome || '';
            document.getElementById('materia-dificuldade-modal').value = data.dificuldade || 3;
            document.getElementById('materia-peso-modal').value = data.peso || 3;
            document.getElementById('materia-nota-desejada-modal').value = data.notaDesejada || 7;
            document.getElementById('materia-carga-horaria-modal').value = data.cargaHoraria || '';
            document.getElementById('materia-professor-modal').value = data.professor || '';
        }

        if (modalType === 'curriculum') {
            const btn = document.querySelector('#form-curriculum .btn-primary');
            if (btn) btn.textContent = this.editingCurriculumId ? 'Atualizar Componente' : 'Salvar Componente';

            document.getElementById('curriculum-nome').value = data.nome || '';
            document.getElementById('curriculum-codigo').value = data.codigo || '';
            document.getElementById('curriculum-semestre').value = data.semestre || '';
            document.getElementById('curriculum-carga-horaria').value = data.cargaHoraria || '';
            document.getElementById('curriculum-status').value = data.status || 'nao-cursada';
            document.getElementById('curriculum-tipo').value = data.tipo || 'obrigatoria';
            document.getElementById('curriculum-creditos').value = data.creditos || '';
            document.getElementById('curriculum-prerequisitos').value = data.prerequisitos || '';
            document.getElementById('curriculum-observacoes').value = data.observacoes || '';
            this.curriculumPrerequisitosSelecionados = this.normalizePrerequisitos(data.prerequisitosLista || data.prerequisitos || '');
            this.setupCurriculumModalUI(data.nome || '');
        }

        if (modalType === 'extra-course') {
            const btn = document.querySelector('#form-extra-course .btn-primary');
            if (btn) btn.textContent = this.editingExtraCourseId ? 'Atualizar Curso' : 'Salvar Curso';

            document.getElementById('extra-course-nome').value = data.nome || '';
            document.getElementById('extra-course-plataforma').value = data.plataforma || '';
            document.getElementById('extra-course-area').value = data.area || '';
            document.getElementById('extra-course-status').value = data.status || 'em-andamento';
            document.getElementById('extra-course-meta-horas').value = data.metaHoras || '';
            document.getElementById('extra-course-horas-estudadas').value = data.horasEstudadas || '';
            document.getElementById('extra-course-progresso').value = data.progresso || '';
            document.getElementById('extra-course-data-inicio').value = data.dataInicio || '';
            document.getElementById('extra-course-link').value = data.link || '';
            document.getElementById('extra-course-observacoes').value = data.observacoes || '';
        }

        const modal = document.getElementById(`modal-${modalType}`);
        if (modal) modal.style.display = 'block';
    }

    async salvarNovaMateria(materiaData) {
        const existe = this.data.subjects.some(s => s.nome.toLowerCase() === materiaData.nome.toLowerCase());
        if (existe) {
            showToast('Já existe uma matéria com esse nome', 'warning');
            return;
        }

        const success = await dbService.addItem('subjects', {
            id: generateId(),
            ...materiaData
        });

        if (success) {
            this.loadView(this.currentView);
            showToast('Matéria adicionada!');
        }
    }

    async salvarMateriaEditada(id, materiaData) {
        const materiaAntiga = this.data.subjects.find(s => s.id === id);
        if (!materiaAntiga) return;

        const nomeAntigo = materiaAntiga.nome;
        const nomeNovo = materiaData.nome;

        if (nomeNovo !== nomeAntigo) {
            this.data.sessions.forEach(item => { if (item.materia === nomeAntigo) item.materia = nomeNovo; });
            this.data.tasks.forEach(item => { if (item.materia === nomeAntigo) item.materia = nomeNovo; });
            this.data.exams.forEach(item => { if (item.materia === nomeAntigo) item.materia = nomeNovo; });
            this.data.learningMap.forEach(item => { if (item.materia === nomeAntigo) item.materia = nomeNovo; });
            this.data.grades.forEach(item => { if (item.materia === nomeAntigo) item.materia = nomeNovo; });
            this.data.materials.forEach(item => { if (item.materia === nomeAntigo) item.materia = nomeNovo; });
            this.data.classSchedule.forEach(item => { if (item.materia === nomeAntigo) item.materia = nomeNovo; });
            this.data.classDiaries.forEach(item => { if (item.materia === nomeAntigo) item.materia = nomeNovo; });
            this.data.reviews.forEach(item => { if (item.materia === nomeAntigo) item.materia = nomeNovo; });
        }

        const index = this.data.subjects.findIndex(s => s.id === id);
        this.data.subjects[index] = { ...this.data.subjects[index], ...materiaData };

        const success = await dbService.saveAllData(this.data);
        if (success) {
            this.editingMateriaId = null;
            this.loadView(this.currentView);
            showToast('Matéria atualizada!');
        }
    }

    async handleMateriaSubmit(e) {
        e.preventDefault();

        const materiaData = {
            nome: document.getElementById('materia-nome-modal')?.value?.trim() || '',
            dificuldade: parseInt(document.getElementById('materia-dificuldade-modal')?.value, 10) || 3,
            peso: parseInt(document.getElementById('materia-peso-modal')?.value, 10) || 3,
            notaDesejada: parseFloat(document.getElementById('materia-nota-desejada-modal')?.value) || 7,
            cargaHoraria: parseInt(document.getElementById('materia-carga-horaria-modal')?.value, 10) || 0,
            professor: document.getElementById('materia-professor-modal')?.value?.trim() || ''
        };

        if (!materiaData.nome) {
            showToast('Informe o nome da matéria', 'warning');
            return;
        }

        if (this.editingMateriaId) {
            await this.salvarMateriaEditada(this.editingMateriaId, materiaData);
        } else {
            await this.salvarNovaMateria(materiaData);
        }

        document.getElementById('modal-materia').style.display = 'none';
        this.resetModalStates();
    }

    async handleCurriculumSubmit(e) {
        e.preventDefault();

        const curriculumData = {
            nome: document.getElementById('curriculum-nome')?.value?.trim() || '',
            codigo: document.getElementById('curriculum-codigo')?.value?.trim().toUpperCase() || '',
            semestre: document.getElementById('curriculum-semestre')?.value?.trim() || '',
            cargaHoraria: parseInt(document.getElementById('curriculum-carga-horaria')?.value, 10) || 0,
            status: document.getElementById('curriculum-status')?.value || 'nao-cursada',
            tipo: document.getElementById('curriculum-tipo')?.value || 'obrigatoria',
            creditos: parseFloat(document.getElementById('curriculum-creditos')?.value) || 0,
            prerequisitos: document.getElementById('curriculum-prerequisitos')?.value?.trim() || '',
            observacoes: document.getElementById('curriculum-observacoes')?.value?.trim() || ''
        };

        if (!curriculumData.nome) {
            showToast('Informe o nome da disciplina/componente', 'warning');
            return;
        }

        if (this.editingCurriculumId) {
            await this.salvarCurriculumEditado(this.editingCurriculumId, curriculumData);
        } else {
            await this.salvarNovoCurriculum(curriculumData);
        }

        document.getElementById('modal-curriculum').style.display = 'none';
        this.resetModalStates();
    }

    async salvarNovoCurriculum(curriculumData) {
        if (!Array.isArray(this.data.curriculum)) this.data.curriculum = [];

        const existe = this.data.curriculum.some(item => item.nome.toLowerCase() === curriculumData.nome.toLowerCase());
        if (existe) {
            showToast('Esse componente já está na grade curricular', 'warning');
            return;
        }

        const success = await dbService.addItem('curriculum', {
            id: generateId(),
            ...curriculumData
        });

        if (success) {
            this.loadView(this.currentView);
            showToast('Componente curricular adicionado!');
        }
    }

    async salvarCurriculumEditado(id, curriculumData) {
        const success = await dbService.updateItem('curriculum', id, curriculumData);
        if (success) {
            this.editingCurriculumId = null;
        this.editingExtraCourseId = null;
        this.curriculumPrerequisitosSelecionados = [];
            this.loadView(this.currentView);
            showToast('Componente curricular atualizado!');
        }
    }

    editarCurriculum(id) {
        const item = (this.data.curriculum || []).find(c => c.id === id);
        if (!item) return;

        this.editingCurriculumId = id;
        this.openModal('curriculum', item);
    }

    async excluirCurriculum(id) {
        if (!confirm('Deseja excluir este componente da grade curricular?')) return;

        const success = await dbService.removeItem('curriculum', id);
        if (success) {
            this.loadView(this.currentView);
            showToast('Componente curricular excluído!');
        }
    }


    editarSessao(id) {
        const sessao = this.data.sessions.find(s => s.id === id);
        if (!sessao) return;

        this.editingSessionId = id;
        this.openModal('sessao', {
            materia: sessao.materia,
            tipo: sessao.tipo,
            duracao: sessao.duracao,
            data: sessao.data?.slice(0, 16),
            topico: sessao.topico || ''
        });
    }

    editarTarefa(id) {
        const tarefa = this.data.tasks.find(t => t.id === id);
        if (!tarefa) return;

        this.editingTaskId = id;
        this.openModal('tarefa', tarefa);
    }

    editarProva(id) {
        const prova = this.data.exams.find(p => p.id === id);
        if (!prova) return;

        this.editingExamId = id;
        this.openModal('prova', prova);
    }

    editarTopico(id) {
        const topico = this.data.learningMap.find(t => t.id === id);
        if (!topico) return;

        this.editingTopicId = id;
        this.openModal('topico', topico);
    }

    editarAula(id) {
        const aula = this.data.classSchedule.find(a => a.id === id);
        if (!aula) return;

        this.editingAulaId = id;
        this.openModal('aula', aula);
    }

    editarNota(id) {
        const nota = this.data.grades.find(n => n.id === id);
        if (!nota) return;

        this.editingGradeId = id;
        this.openModal('nota', nota);
    }

    editarMaterial(id) {
        const material = this.data.materials.find(m => m.id === id);
        if (!material) return;

        this.editingMaterialId = id;
        this.openModal('material', material);
    }

    editarMateria(id) {
        const materia = this.data.subjects.find(s => s.id === id);
        if (!materia) return;

        this.editingMateriaId = id;
        this.openModal('materia', materia);
    }

    openDailyLogModal() {
        const modal = document.getElementById('modal-daily-log');
        if (!modal) return;

        const hoje = toDateString();
        const logHoje = window.dailyLogService?.getLogPorData(hoje);

        document.getElementById('daily-log-estudo-inicio').value = logHoje?.estudo?.inicio || '';
        document.getElementById('daily-log-estudo-fim').value = logHoje?.estudo?.fim || '';
        document.getElementById('daily-log-foi-aula').checked = logHoje?.aula?.foi || false;
        document.getElementById('daily-log-trabalhou').checked = logHoje?.trabalho?.trabalhou || false;
        document.getElementById('daily-log-trabalho-duracao').value = logHoje?.trabalho?.duracao || 0;
        document.getElementById('daily-log-energia').value = logHoje?.energia || 'media';
        document.getElementById('daily-log-foco').value = logHoje?.foco || 'normal';
        document.getElementById('daily-log-observacoes').value = logHoje?.observacoes || '';

        modal.style.display = 'block';
    }

    openClassDiaryModal(aulaId = null) {
        const modal = document.getElementById('modal-class-diary');
        if (!modal) return;

        const select = document.getElementById('class-diary-materia');
        if (!select) return;

        select.innerHTML = '<option value="">Selecione</option>';
        this.data.subjects.forEach(s => {
            const option = document.createElement('option');
            option.value = s.nome;
            option.textContent = s.nome;
            select.appendChild(option);
        });

        if (aulaId && window.scheduleManager) {
            const aula = window.scheduleManager.aulas.find(a => a.id === aulaId);
            if (aula) {
                select.value = aula.materia;
                document.getElementById('class-diary-data').value = toDateString();
            }
        } else {
            document.getElementById('class-diary-data').value = toDateString();
        }

        modal.style.display = 'block';
    }

    openAulaModal(aulaId) {
        const modal = document.getElementById('modal-aula-detail');
        if (!modal || !window.scheduleManager) return;

        const aula = window.scheduleManager.aulas.find(a => a.id === aulaId);
        if (!aula) return;

        document.getElementById('aula-detail-materia').textContent = aula.materia;
        document.getElementById('aula-detail-horario').textContent = `${aula.inicio} - ${aula.fim}`;
        document.getElementById('aula-detail-sala').textContent = aula.sala || 'Não informada';
        document.getElementById('aula-detail-professor').textContent = aula.professor || 'Não informado';

        const hoje = toDateString();
        const key = `${aulaId}_${hoje}`;
        const presencaHoje = this.data.attendance[key];
        const presencaContainer = document.getElementById('aula-detail-presenca');

        if (presencaContainer) {
            if (presencaHoje) {
                presencaContainer.innerHTML = `<span class="tag ${presencaHoje === 'present' ? 'success' : 'danger'}">${presencaHoje === 'present' ? 'Presente' : 'Faltou'}</span>`;
            } else {
                presencaContainer.innerHTML = `
                    <button class="btn-small btn-success" data-status="present">✅ Presente</button>
                    <button class="btn-small btn-danger" data-status="absent">❌ Faltei</button>
                `;

                presencaContainer.querySelectorAll('button').forEach(btn => {
                    btn.addEventListener('click', () => this.marcarPresenca(aulaId, btn.dataset.status));
                });
            }
        }

        const ultimoDiario = window.classDiaryService?.getUltimoDiarioPorMateria(aula.materia);
        const ultimoConteudoEl = document.getElementById('aula-detail-ultimo-conteudo');
        if (ultimoConteudoEl) {
            if (ultimoDiario) {
                ultimoConteudoEl.innerHTML = `
                    <strong>${escapeHtml(ultimoDiario.data)}</strong>: ${escapeHtml(ultimoDiario.conteudoExplicado || 'Nenhum conteúdo registrado')}
                    ${ultimoDiario.precisoRevisar ? '<span class="badge warning">Revisar</span>' : ''}
                `;
            } else {
                ultimoConteudoEl.textContent = 'Nenhum registro de aula';
            }
        }

        modal.style.display = 'block';
    }

    async marcarPresenca(aulaId, status) {
        const hoje = toDateString();
        if (!window.scheduleManager) return;

        const success = await window.scheduleManager.marcarPresenca(aulaId, hoje, status);
        if (success) {
            showToast(`Presença marcada como ${status === 'present' ? 'presente' : 'falta'}`);
            this.openAulaModal(aulaId);
        }
    }

    async handleDailyLogSubmit(e) {
        e.preventDefault();

        const logData = {
            estudoInicio: document.getElementById('daily-log-estudo-inicio').value,
            estudoFim: document.getElementById('daily-log-estudo-fim').value,
            estudoDuracao: calcularDuracaoMinutos(
                document.getElementById('daily-log-estudo-inicio').value,
                document.getElementById('daily-log-estudo-fim').value
            ),
            foiAula: document.getElementById('daily-log-foi-aula').checked,
            materiasAula: [],
            trabalhou: document.getElementById('daily-log-trabalhou').checked,
            trabalhoDuracao: parseInt(document.getElementById('daily-log-trabalho-duracao').value, 10) || 0,
            energia: document.getElementById('daily-log-energia').value,
            foco: document.getElementById('daily-log-foco').value,
            observacoes: document.getElementById('daily-log-observacoes').value
        };

        await window.dailyLogService?.registrarLog(logData);
        document.getElementById('modal-daily-log').style.display = 'none';
        this.loadView(this.currentView);
    }

    async handleClassDiarySubmit(e) {
        e.preventDefault();

        const diaryData = {
            materia: document.getElementById('class-diary-materia').value,
            data: document.getElementById('class-diary-data').value,
            presenca: document.getElementById('class-diary-presenca').value,
            conteudoExplicado: document.getElementById('class-diary-conteudo').value,
            exerciciosPassados: document.getElementById('class-diary-exercicios').value,
            trabalhoAnunciado: document.getElementById('class-diary-trabalho').value,
            dificuldade: parseInt(document.getElementById('class-diary-dificuldade').value, 10) || 3,
            precisoRevisar: document.getElementById('class-diary-revisar').checked,
            observacoes: document.getElementById('class-diary-observacoes').value
        };

        await window.classDiaryService?.registrarDiario(diaryData);
        document.getElementById('modal-class-diary').style.display = 'none';
        this.loadView(this.currentView);
    }

    async handleSessaoSubmit(e) {
        e.preventDefault();

        const sessaoData = {
            materia: document.getElementById('sessao-materia').value,
            tipo: document.getElementById('sessao-tipo').value,
            duracao: parseInt(document.getElementById('sessao-duracao').value, 10),
            topico: document.getElementById('sessao-topico').value,
            data: document.getElementById('sessao-data').value,
            concluida: false
        };

        const isEditing = !!this.editingSessionId;
        let success = false;

        if (isEditing) {
            success = await dbService.updateItem('sessions', this.editingSessionId, sessaoData);
        } else {
            success = await dbService.addItem('sessions', {
                id: generateId(),
                ...sessaoData
            });
        }

        if (success) {
            document.getElementById('modal-sessao').style.display = 'none';
            this.editingSessionId = null;
            this.resetModalStates();
            this.loadView(this.currentView);
            showToast(isEditing ? 'Sessão atualizada!' : 'Sessão adicionada!');
        }
    }

    async handleTarefaSubmit(e) {
        e.preventDefault();

        const tarefaData = {
            titulo: document.getElementById('tarefa-titulo').value,
            materia: document.getElementById('tarefa-materia').value,
            prioridade: document.getElementById('tarefa-prioridade').value,
            dataLimite: document.getElementById('tarefa-data').value,
            estimativa: parseInt(document.getElementById('tarefa-estimativa').value, 10) || 60,
            concluida: false
        };

        const isEditing = !!this.editingTaskId;
        let success = false;

        if (isEditing) {
            const tarefaOriginal = this.data.tasks.find(t => t.id === this.editingTaskId);
            success = await dbService.updateItem('tasks', this.editingTaskId, {
                ...tarefaData,
                concluida: tarefaOriginal?.concluida || false
            });
        } else {
            success = await dbService.addItem('tasks', {
                id: generateId(),
                ...tarefaData
            });
        }

        if (success) {
            document.getElementById('modal-tarefa').style.display = 'none';
            this.editingTaskId = null;
            this.resetModalStates();
            this.loadView(this.currentView);
            showToast(isEditing ? 'Tarefa atualizada!' : 'Tarefa adicionada!');
        }
    }

    async handleProvaSubmit(e) {
        e.preventDefault();

        const provaData = {
            titulo: document.getElementById('prova-titulo').value,
            materia: document.getElementById('prova-materia').value,
            tipo: document.getElementById('prova-tipo').value,
            data: document.getElementById('prova-data').value,
            peso: parseInt(document.getElementById('prova-peso').value, 10) || 100,
            importancia: document.getElementById('prova-importancia').value,
            concluida: false
        };

        const isEditing = !!this.editingExamId;
        let success = false;

        if (isEditing) {
            const original = this.data.exams.find(p => p.id === this.editingExamId);
            success = await dbService.updateItem('exams', this.editingExamId, {
                ...provaData,
                concluida: original?.concluida || false
            });
        } else {
            success = await dbService.addItem('exams', {
                id: generateId(),
                ...provaData
            });
        }

        if (success) {
            document.getElementById('modal-prova').style.display = 'none';
            this.editingExamId = null;
            this.resetModalStates();
            this.loadView(this.currentView);
            showToast(isEditing ? 'Evento atualizado!' : 'Evento adicionado!');
        }
    }

    async handleAulaSubmit(e) {
        e.preventDefault();

        const aulaData = {
            materia: document.getElementById('aula-materia').value,
            dia: document.getElementById('aula-dia').value,
            inicio: document.getElementById('aula-inicio').value,
            fim: document.getElementById('aula-fim').value,
            sala: document.getElementById('aula-sala').value,
            professor: document.getElementById('aula-professor').value,
            bloco: document.getElementById('aula-bloco')?.value || '',
            cor: document.getElementById('aula-cor')?.value || '#3b82f6'
        };

        let success = false;
        const isEditing = !!this.editingAulaId;

        if (window.scheduleManager) {
            if (isEditing) {
                success = await window.scheduleManager.editAula(this.editingAulaId, aulaData);
            } else {
                success = await window.scheduleManager.addAula({
                    id: generateId(),
                    ...aulaData
                });
            }
        }

        if (success) {
            document.getElementById('modal-aula').style.display = 'none';
            this.editingAulaId = null;
            this.resetModalStates();
            document.dispatchEvent(new Event('aulas-atualizadas'));
            this.loadView('grade-horaria');
            showToast(isEditing ? 'Aula atualizada com sucesso!' : 'Aula salva com sucesso!');
        }
    }

    async handleTopicoSubmit(e) {
        e.preventDefault();

        const topicoData = {
            materia: document.getElementById('topico-materia').value,
            nome: document.getElementById('topico-nome').value,
            dificuldade: parseInt(document.getElementById('topico-dificuldade').value, 10) || 3,
            status: document.getElementById('topico-status').value,
            confianca: parseInt(document.getElementById('topico-confianca').value, 10) || 3,
            ultimaRevisao: new Date().toISOString()
        };

        const isEditing = !!this.editingTopicId;
        let success = false;

        if (isEditing) {
            success = await dbService.updateItem('learningMap', this.editingTopicId, topicoData);
        } else {
            success = await dbService.addItem('learningMap', {
                id: generateId(),
                ...topicoData
            });
        }

        if (success) {
            document.getElementById('modal-topico').style.display = 'none';
            this.editingTopicId = null;
            this.resetModalStates();
            this.loadView(this.currentView);
            showToast(isEditing ? 'Tópico atualizado!' : 'Tópico salvo!');
        }
    }

    async handleNotaSubmit(e) {
        e.preventDefault();

        const notaData = {
            materia: document.getElementById('nota-materia').value,
            avaliacao: document.getElementById('nota-avaliacao').value,
            valor: parseFloat(document.getElementById('nota-valor').value),
            peso: parseInt(document.getElementById('nota-peso').value, 10) || 100,
            data: new Date().toISOString()
        };

        const isEditing = !!this.editingGradeId;
        let success = false;

        if (isEditing) {
            success = await dbService.updateItem('grades', this.editingGradeId, notaData);
        } else {
            success = await dbService.addItem('grades', {
                id: generateId(),
                ...notaData
            });
        }

        if (success) {
            document.getElementById('modal-nota').style.display = 'none';
            this.editingGradeId = null;
            this.resetModalStates();
            this.loadView(this.currentView);
            showToast(isEditing ? 'Nota atualizada!' : 'Nota registrada!');
        }
    }

    async handleMaterialSubmit(e) {
        e.preventDefault();

        const materialData = {
            titulo: document.getElementById('material-titulo').value,
            materia: document.getElementById('material-materia').value,
            tipo: document.getElementById('material-tipo').value,
            conteudo: document.getElementById('material-conteudo').value
        };

        const isEditing = !!this.editingMaterialId;
        let success = false;

        if (isEditing) {
            success = await dbService.updateItem('materials', this.editingMaterialId, materialData);
        } else {
            success = await dbService.addItem('materials', {
                id: generateId(),
                ...materialData
            });
        }

        if (success) {
            document.getElementById('modal-material').style.display = 'none';
            this.editingMaterialId = null;
        this.editingCurriculumId = null;
        this.editingExtraCourseId = null;
        this.curriculumPrerequisitosSelecionados = [];
            this.resetModalStates();
            this.loadView(this.currentView);
            showToast(isEditing ? 'Material atualizado!' : 'Material adicionado!');
        }
    }

    async concluirSessao(id) {
        const sessao = this.data.sessions.find(s => s.id === id);
        if (!sessao) return;

        const success = await dbService.updateItem('sessions', id, { concluida: true });
        if (success) {
            sessao.concluida = true;
            this.updateStreak();
            this.loadView(this.currentView);
            showToast('Sessão concluída!');
        }
    }

    async concluirTarefa(id) {
        const tarefa = this.data.tasks.find(t => t.id === id);
        if (!tarefa) return;

        const success = await dbService.updateItem('tasks', id, { concluida: true });
        if (success) {
            tarefa.concluida = true;
            this.loadView(this.currentView);
            showToast('Tarefa concluída!');
        }
    }

    async toggleHabito(id) {
        const hoje = toDateString();
        const idx = this.data.habits.findIndex(h => h.id === id && toDateString(h.data) === hoje);

        let success = false;

        if (idx >= 0) {
            this.data.habits.splice(idx, 1);
            success = await dbService.saveData('habits', this.data.habits);
        } else {
            this.data.habits.push({ id, data: new Date().toISOString() });
            success = await dbService.saveData('habits', this.data.habits);
        }

        if (success) this.loadView(this.currentView);
    }

    startTimer() {
        const durationInput = document.getElementById('timer-duracao');

        if (!this.timerRunning && this.timerSeconds <= 0) {
            const d = parseInt(durationInput?.value, 10) || 25;
            this.timerSeconds = d * 60;
            this.timerDuration = d;
        }

        if (this.timerRunning || this.timerSeconds <= 0) return;

        this.timerRunning = true;
        this.timerStartedAt = Date.now();

        const startBtn = document.getElementById('timer-start');
        const pauseBtn = document.getElementById('timer-pause');

        if (startBtn) startBtn.style.display = 'none';
        if (pauseBtn) pauseBtn.style.display = 'inline-block';

        this.timerInterval = setInterval(() => {
            this.timerSeconds--;
            this.updateTimerDisplay();

            if (this.timerSeconds <= 0) {
                this.timerComplete();
            }
        }, 1000);

        this.updateTimerDisplay();
    }

    pauseTimer() {
        this.timerRunning = false;
        clearInterval(this.timerInterval);

        const startBtn = document.getElementById('timer-start');
        const pauseBtn = document.getElementById('timer-pause');

        if (startBtn) startBtn.style.display = 'inline-block';
        if (pauseBtn) pauseBtn.style.display = 'none';
    }

    resetTimer() {
        this.pauseTimer();
        this.timerSeconds = 0;
        this.timerDuration = 0;
        this.timerStartedAt = null;
        this.updateTimerDisplay();
    }

    async timerComplete() {
        this.pauseTimer();

        const sessaoFoco = {
            id: generateId(),
            materia: 'Modo Foco',
            tipo: 'foco',
            duracao: this.timerDuration,
            data: new Date().toISOString(),
            concluida: true
        };

        const success = await dbService.addItem('sessions', sessaoFoco);
        if (success) {
            showToast('Sessão de foco concluída!');
            this.updateStreak();
            this.loadView(this.currentView);
        }

        this.timerSeconds = 0;
        this.timerDuration = 0;
        this.updateTimerDisplay();
    }

    updateTimerDisplay() {
        const display = document.getElementById('timer-display');
        if (!display) return;

        const m = Math.floor(this.timerSeconds / 60);
        const s = this.timerSeconds % 60;
        display.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    updateStreak() {
        if (!this.data.user) return;

        const hoje = toDateString();
        if (this.data.user.lastStudyDate === hoje) return;

        const ontem = new Date();
        ontem.setDate(ontem.getDate() - 1);
        const ontemStr = toDateString(ontem);

        if (this.data.user.lastStudyDate === ontemStr) {
            this.data.user.streak = (this.data.user.streak || 0) + 1;
        } else {
            this.data.user.streak = 1;
        }

        this.data.user.lastStudyDate = hoje;
        dbService.saveData('user', this.data.user);
        this.updateSidebarInfo();
    }

    async whatsNow() {
        if (!window.aiAssistant) return;

        const sugestao = window.aiAssistant.sugerirEstudoAgora();
        const modal = document.getElementById('modal-whats-now');

        if (modal) {
            document.getElementById('whats-now-content').innerHTML = nl2brSafe(sugestao);
            modal.style.display = 'block';
        } else {
            showToast(sugestao, 'info');
        }
    }

    exportarGradeHoraria() {
        const aulas = [...(this.data.classSchedule || [])];
        const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

        let csv = 'Dia,Matéria,Início,Fim,Sala,Professor,Bloco\n';

        aulas.sort((a, b) => {
            if (parseInt(a.dia, 10) !== parseInt(b.dia, 10)) {
                return parseInt(a.dia, 10) - parseInt(b.dia, 10);
            }
            return a.inicio.localeCompare(b.inicio);
        }).forEach(a => {
            csv += `"${diasSemana[parseInt(a.dia, 10)]}","${(a.materia || '').replace(/"/g, '""')}","${a.inicio || ''}","${a.fim || ''}","${(a.sala || '').replace(/"/g, '""')}","${(a.professor || '').replace(/"/g, '""')}","${(a.bloco || '').replace(/"/g, '""')}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'grade-horaria.csv';
        link.click();
        URL.revokeObjectURL(url);

        showToast('Grade exportada!');
    }

    exportarDados() {
        const dataStr = JSON.stringify(this.data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'study-life-control-backup.json';
        a.click();

        URL.revokeObjectURL(url);
        showToast('Dados exportados!');
    }

    async limparDados() {
        if (!confirm('Tem certeza? Todos os dados serão perdidos.')) return;

        const success = await dbService.clearAllData();
        if (success) {
            localStorage.clear();
            showToast('Dados limpos!');
            location.reload();
        }
    }

    async excluirSessao(id) {
        if (!confirm('Tem certeza que deseja excluir esta sessão?')) return;

        const success = await dbService.removeItem('sessions', id);
        if (success) {
            this.loadView(this.currentView);
            showToast('Sessão excluída!');
        }
    }

    async excluirTarefa(id) {
        if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;

        const success = await dbService.removeItem('tasks', id);
        if (success) {
            this.loadView(this.currentView);
            showToast('Tarefa excluída!');
        }
    }

    async excluirProva(id) {
        if (!confirm('Tem certeza que deseja excluir esta prova?')) return;

        const success = await dbService.removeItem('exams', id);
        if (success) {
            this.loadView(this.currentView);
            showToast('Prova excluída!');
        }
    }

    async excluirTopico(id) {
        if (!confirm('Tem certeza que deseja excluir este tópico?')) return;

        const success = await dbService.removeItem('learningMap', id);
        if (success) {
            this.loadView(this.currentView);
            showToast('Tópico excluído!');
        }
    }

    async excluirMaterial(id) {
        if (!confirm('Tem certeza que deseja excluir este material?')) return;

        const success = await dbService.removeItem('materials', id);
        if (success) {
            this.loadView(this.currentView);
            showToast('Material excluído!');
        }
    }

    async excluirNota(id) {
        if (!confirm('Tem certeza que deseja excluir esta nota?')) return;

        const success = await dbService.removeItem('grades', id);
        if (success) {
            this.loadView(this.currentView);
            showToast('Nota excluída!');
        }
    }

    async excluirMateria(id) {
        if (!confirm('ATENÇÃO: Excluir esta matéria também excluirá todas as sessões, tarefas, provas, tópicos, notas, materiais e aulas relacionados. Continuar?')) return;

        const materia = this.data.subjects.find(s => s.id === id);
        if (!materia) return;

        showLoading();

        try {
            this.data.sessions = this.data.sessions.filter(s => s.materia !== materia.nome);
            this.data.tasks = this.data.tasks.filter(t => t.materia !== materia.nome);
            this.data.exams = this.data.exams.filter(e => e.materia !== materia.nome);
            this.data.learningMap = this.data.learningMap.filter(t => t.materia !== materia.nome);
            this.data.grades = this.data.grades.filter(g => g.materia !== materia.nome);
            this.data.materials = this.data.materials.filter(m => m.materia !== materia.nome);
            this.data.classSchedule = this.data.classSchedule.filter(a => a.materia !== materia.nome);
            this.data.classDiaries = this.data.classDiaries.filter(d => d.materia !== materia.nome);
            this.data.reviews = this.data.reviews.filter(r => r.materia !== materia.nome);
            this.data.subjects = this.data.subjects.filter(s => s.id !== id);

            const success = await dbService.saveAllData(this.data);

            if (success) {
                this.loadView(this.currentView);
                showToast('Matéria e todos os itens relacionados excluídos!');
            }
        } catch (error) {
            console.error('Erro ao excluir matéria:', error);
            showToast('Erro ao excluir matéria', 'error');
        } finally {
            hideLoading();
        }
    }

    getDelayedSubjects(limit = this.data.settings?.heavyMode ? 3 : 5) {
        return this.data.subjects
            .map(subject => {
                const ultima = this.data.sessions
                    .filter(s => s.materia === subject.nome && s.concluida)
                    .sort((a, b) => new Date(b.data) - new Date(a.data))[0];

                if (!ultima) {
                    return { nome: subject.nome, diasSemEstudar: null, nunca: true };
                }

                return {
                    nome: subject.nome,
                    diasSemEstudar: diasDesde(ultima.data),
                    nunca: false
                };
            })
            .filter(s => s.nunca || (s.diasSemEstudar !== null && s.diasSemEstudar >= limit))
            .sort((a, b) => {
                if (a.nunca && !b.nunca) return -1;
                if (!a.nunca && b.nunca) return 1;
                return (b.diasSemEstudar || 0) - (a.diasSemEstudar || 0);
            });
    }

    getStudyHoursSummary() {
        const sessoesConcluidas = this.data.sessions.filter(s => s.concluida);
        const hoje = toDateOnly(new Date());
        const inicioSemana = new Date(hoje);
        inicioSemana.setDate(hoje.getDate() - hoje.getDay());
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

        return {
            hoje: sessoesConcluidas
                .filter(s => toDateOnly(s.data).getTime() === hoje.getTime())
                .reduce((acc, s) => acc + s.duracao, 0) / 60,
            semana: sessoesConcluidas
                .filter(s => new Date(s.data) >= inicioSemana)
                .reduce((acc, s) => acc + s.duracao, 0) / 60,
            mes: sessoesConcluidas
                .filter(s => new Date(s.data) >= inicioMes)
                .reduce((acc, s) => acc + s.duracao, 0) / 60,
            total: sessoesConcluidas.reduce((acc, s) => acc + s.duracao, 0) / 60
        };
    }

    generateAlerts() {
        const alerts = [];

        this.data.subjects.forEach(materia => {
            const ultimo = this.data.sessions
                .filter(ses => ses.materia === materia.nome && ses.concluida)
                .sort((a, b) => new Date(b.data) - new Date(a.data))[0];

            if (ultimo && diasDesde(ultimo.data) >= 5) {
                alerts.push({
                    type: 'warning',
                    title: `${materia.nome} esquecida`,
                    message: `${diasDesde(ultimo.data)} dias sem estudar`
                });
            }
        });

        this.data.exams.forEach(e => {
            const dias = diasAte(e.data);
            if (dias <= 3 && dias >= 0) {
                const horas = this.data.sessions
                    .filter(s => s.materia === e.materia && s.concluida)
                    .reduce((a, s) => a + s.duracao, 0) / 60;

                if (horas < 2) {
                    alerts.push({
                        type: 'danger',
                        title: `Prova de ${e.materia} em ${dias} dias`,
                        message: `Estudou apenas ${horas.toFixed(1)}h`
                    });
                }
            }
        });

        return alerts;
    }

    analyzeAcademicRisk() {
        const risks = [];
        const hoje = new Date();

        this.data.subjects.forEach(subject => {
            const notas = this.data.grades.filter(g => g.materia === subject.nome);
            const media = calcularMediaPonderada(notas);
            const exames = this.data.exams.filter(e => e.materia === subject.nome && new Date(e.data) >= hoje && diasAte(e.data) <= 14);
            const horas = this.data.sessions
                .filter(ses => ses.materia === subject.nome && ses.concluida)
                .reduce((a, ses) => a + ses.duracao, 0) / 60;

            if (media > 0 && media < 6) {
                risks.push({ materia: subject.nome, nivel: 'alto', motivo: `Média ${media.toFixed(1)}` });
            } else if (exames.length && horas < 3) {
                risks.push({ materia: subject.nome, nivel: 'alto', motivo: `Prova próxima, ${horas.toFixed(1)}h estudadas` });
            } else if (subject.dificuldade >= 4 && horas < 2) {
                risks.push({ materia: subject.nome, nivel: 'medio', motivo: 'Matéria difícil, pouco estudo' });
            }
        });

        return risks;
    }

    calcularMedia(notas) {
        return calcularMediaPonderada(notas);
    }

    calcularPrevisaoNota(subject, notas) {
        const media = calcularMediaPonderada(notas);
        const horas = this.data.sessions
            .filter(s => s.materia === subject.nome && s.concluida)
            .reduce((a, s) => a + s.duracao, 0) / 60;

        const restantes = this.data.exams.filter(
            e => e.materia === subject.nome && new Date(e.data) >= new Date()
        );

        const pesoRestante = restantes.reduce((a, e) => a + (e.peso || 0), 0);

        let notaNecessaria = subject.notaDesejada || 7;
        if (pesoRestante > 0) {
            notaNecessaria = (((subject.notaDesejada || 7) * 100) - (media * (100 - pesoRestante))) / pesoRestante;
        }

        let chance = 50;
        if (horas > subject.dificuldade * 5) chance += 20;
        if (media > 7) chance += 20;
        if (media < 5) chance -= 20;
        if (subject.dificuldade >= 4) chance -= 10;
        if (!restantes.length) chance = media >= 6 ? 100 : 0;

        chance = Math.min(100, Math.max(0, chance));

        const risco = chance < 30 ? 'alto' : chance < 60 ? 'medio' : 'baixo';
        const motivo =
            chance >= 80 ? 'Você está no caminho certo!' :
            chance >= 50 ? 'Mantenha o foco que dá tempo' :
            'Precisa intensificar os estudos';

        return {
            chance: Math.round(chance),
            notaNecessaria: Math.max(0, notaNecessaria).toFixed(1),
            risco,
            motivo
        };
    }

    calcularProgressoHoje() {
        const hoje = toDateString();
        const sessoes = this.data.sessions.filter(s => toDateString(s.data) === hoje);
        const planejado = sessoes.reduce((a, s) => a + (s.duracao || 0), 0) / 60;
        const concluido = sessoes.filter(s => s.concluida).reduce((a, s) => a + (s.duracao || 0), 0) / 60;
        const percentual = planejado ? Math.min((concluido / planejado) * 100, 100) : 0;

        return {
            planejado: planejado.toFixed(1),
            concluido: concluido.toFixed(1),
            percentual
        };
    }

    calcularProdutividade() {
        const hoje = toDateString();
        const total = this.data.sessions.filter(s => toDateString(s.data) === hoje).length;
        const concluidas = this.data.sessions.filter(s => toDateString(s.data) === hoje && s.concluida).length;
        return total ? `${Math.round((concluidas / total) * 100)}%` : '0%';
    }

    getUrgentTasks() {
        return this.data.tasks
            .filter(t => !t.concluida && diasAte(t.dataLimite) <= 3)
            .sort((a, b) => new Date(a.dataLimite) - new Date(b.dataLimite));
    }

    getUpcomingExams(days) {
        return this.data.exams
            .filter(e => !e.concluida && diasAte(e.data) <= days && diasAte(e.data) >= 0)
            .sort((a, b) => new Date(a.data) - new Date(b.data));
    }

    calcularHorasPorMateria() {
        const horas = {};
        this.data.sessions.filter(s => s.concluida).forEach(s => {
            horas[s.materia] = (horas[s.materia] || 0) + s.duracao / 60;
        });

        return Object.entries(horas)
            .map(([materia, h]) => ({ materia, horas: h }))
            .sort((a, b) => b.horas - a.horas);
    }

    calcularHorasPorTipo() {
        const tipos = {};
        this.data.sessions.filter(s => s.concluida).forEach(s => {
            tipos[s.tipo] = (tipos[s.tipo] || 0) + s.duracao / 60;
        });

        return Object.entries(tipos)
            .map(([tipo, horas]) => ({ tipo, horas }))
            .sort((a, b) => b.horas - a.horas);
    }

    calcularMediaDiaria() {
        if (!this.data.user?.createdAt) return '0.0';

        const dias = Math.max(1, Math.ceil((new Date() - new Date(this.data.user.createdAt)) / 86400000));
        const total = this.data.sessions
            .filter(s => s.concluida)
            .reduce((a, s) => a + s.duracao / 60, 0);

        return (total / dias).toFixed(1);
    }

    calcularMelhorDia() {
        const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const horas = new Array(7).fill(0);

        this.data.sessions.filter(s => s.concluida).forEach(s => {
            horas[new Date(s.data).getDay()] += s.duracao / 60;
        });

        const maxIndex = horas.indexOf(Math.max(...horas));
        return maxIndex >= 0 ? dias[maxIndex] : 'N/A';
    }

    calcularMelhorDiaHoras() {
        const horas = new Array(7).fill(0);

        this.data.sessions.filter(s => s.concluida).forEach(s => {
            horas[new Date(s.data).getDay()] += s.duracao / 60;
        });

        return Math.max(...horas).toFixed(1);
    }

    calcularTaxaConclusaoTarefas() {
        if (!this.data.tasks.length) return 0;
        return Math.round((this.data.tasks.filter(t => t.concluida).length / this.data.tasks.length) * 100);
    }

    calcularConsistencia() {
        const hoje = new Date();
        const inicio = new Date(hoje);
        inicio.setDate(hoje.getDate() - hoje.getDay());

        const dias = new Set();
        this.data.sessions.filter(s => s.concluida).forEach(s => {
            const d = new Date(s.data);
            if (d >= inicio) dias.add(toDateString(d));
        });

        return Math.round((dias.size / 7) * 100);
    }

    getExamRiskClass(e) {
        const d = diasAte(e.data);
        return d <= 3 ? 'danger' : d <= 7 ? 'warning' : 'success';
    }
}

window.StudyLifeControl = StudyLifeControl;

const UFOB_ENGINEERING_CIVIL_REFERENCE = [
    { codigo: '', semestre: '1', nome: 'Cálculo Diferencial I', cargaHoraria: 60, creditos: 0, tipo: 'obrigatoria', prerequisitos: [] },
    { codigo: '', semestre: '1', nome: 'Introdução à Engenharia Civil', cargaHoraria: 30, creditos: 0, tipo: 'obrigatoria', prerequisitos: [] },
    { codigo: '', semestre: '1', nome: 'Geometria Analítica', cargaHoraria: 90, creditos: 0, tipo: 'obrigatoria', prerequisitos: [] },
    { codigo: '', semestre: '1', nome: 'Programação de Computadores I', cargaHoraria: 60, creditos: 0, tipo: 'obrigatoria', prerequisitos: [] },
    { codigo: '', semestre: '1', nome: 'Introdução ao Desenho Técnico', cargaHoraria: 60, creditos: 0, tipo: 'obrigatoria', prerequisitos: [] },
    { codigo: '', semestre: '1', nome: 'Filosofia e História das Ciências', cargaHoraria: 60, creditos: 0, tipo: 'obrigatoria', prerequisitos: [] },
    { codigo: '', semestre: '1', nome: 'Oficina de Leitura e Produção Textual', cargaHoraria: 60, creditos: 0, tipo: 'obrigatoria', prerequisitos: [] },
    { codigo: '', semestre: '1', nome: 'Ética e Política', cargaHoraria: 30, creditos: 0, tipo: 'obrigatoria', prerequisitos: [] },
    { codigo: '', semestre: '2', nome: 'Cálculo Diferencial II', cargaHoraria: 60, creditos: 0, tipo: 'obrigatoria', prerequisitos: ['Cálculo Diferencial I', 'Geometria Analítica'] },
    { codigo: '', semestre: '2', nome: 'Física Geral I', cargaHoraria: 60, creditos: 0, tipo: 'obrigatoria', prerequisitos: [] },
    { codigo: '', semestre: '2', nome: 'Álgebra Linear I', cargaHoraria: 60, creditos: 0, tipo: 'obrigatoria', prerequisitos: ['Geometria Analítica'] },
    { codigo: '', semestre: '2', nome: 'Programação de Computadores II', cargaHoraria: 60, creditos: 0, tipo: 'obrigatoria', prerequisitos: ['Programação de Computadores I'] },
    { codigo: '', semestre: '2', nome: 'Desenho Arquitetônico', cargaHoraria: 60, creditos: 0, tipo: 'obrigatoria', prerequisitos: ['Introdução ao Desenho Técnico'] },
    { codigo: '', semestre: '2', nome: 'Cálculo Integral I', cargaHoraria: 60, creditos: 0, tipo: 'obrigatoria', prerequisitos: ['Cálculo Diferencial I'] },
    { codigo: '', semestre: '2', nome: 'Oficina de Leitura e Produção de Textos Acadêmicos', cargaHoraria: 60, creditos: 0, tipo: 'obrigatoria', prerequisitos: ['Oficina de Leitura e Produção Textual'] },
    { codigo: '', semestre: '2', nome: 'Física Experimental I', cargaHoraria: 30, creditos: 0, tipo: 'obrigatoria', prerequisitos: [] },
    { codigo: '', semestre: '3', nome: 'Cálculo Integral II', cargaHoraria: 60, creditos: 0, tipo: 'obrigatoria', prerequisitos: ['Geometria Analítica', 'Cálculo Integral I'] },
    { codigo: '', semestre: '3', nome: 'Física Geral II', cargaHoraria: 60, creditos: 0, tipo: 'obrigatoria', prerequisitos: ['Física Geral I'] },
    { codigo: '', semestre: '3', nome: 'Mecânica Geral', cargaHoraria: 90, creditos: 0, tipo: 'obrigatoria', prerequisitos: ['Física Geral I', 'Cálculo Integral I'] },
    { codigo: '', semestre: '3', nome: 'Equações Diferenciais Ordinárias', cargaHoraria: 90, creditos: 0, tipo: 'obrigatoria', prerequisitos: ['Álgebra Linear I', 'Cálculo Integral I'] },
    { codigo: '', semestre: '3', nome: 'Fundamentos de Química Geral e Inorgânica', cargaHoraria: 60, creditos: 0, tipo: 'obrigatoria', prerequisitos: [] },
    { codigo: '', semestre: '3', nome: 'Fundamentos de Química Geral Experimental', cargaHoraria: 30, creditos: 0, tipo: 'obrigatoria', prerequisitos: ['Fundamentos de Química Geral e Inorgânica'] },
    { codigo: '', semestre: '3', nome: 'Geologia Geral', cargaHoraria: 60, creditos: 0, tipo: 'obrigatoria', prerequisitos: [] },
    { codigo: '', semestre: '3', nome: 'Física Experimental II', cargaHoraria: 30, creditos: 0, tipo: 'obrigatoria', prerequisitos: ['Física Geral I', 'Física Experimental I'] },
    { codigo: '', semestre: '4', nome: 'Cálculo Numérico', cargaHoraria: 60, creditos: 0, tipo: 'obrigatoria', prerequisitos: ['Equações Diferenciais Ordinárias', 'Programação de Computadores II'] },
    { codigo: '', semestre: '4', nome: 'Física Geral III', cargaHoraria: 60, creditos: 0, tipo: 'obrigatoria', prerequisitos: ['Física Geral II'] },
    { codigo: '', semestre: '4', nome: 'Resistência dos Materiais I', cargaHoraria: 90, creditos: 0, tipo: 'obrigatoria', prerequisitos: ['Mecânica Geral'] },
    { codigo: '', semestre: '4', nome: 'Introdução à Administração', cargaHoraria: 60, creditos: 0, tipo: 'obrigatoria', prerequisitos: ['Introdução à Engenharia Civil'] },
    { codigo: '', semestre: '4', nome: 'Topografia', cargaHoraria: 60, creditos: 0, tipo: 'obrigatoria', prerequisitos: ['Desenho Arquitetônico'] },
    { codigo: '', semestre: '4', nome: 'Materiais de Construção I', cargaHoraria: 60, creditos: 0, tipo: 'obrigatoria', prerequisitos: ['Fundamentos de Química Geral Experimental'] },
    { codigo: '', semestre: '4', nome: 'Métodos Estatísticos', cargaHoraria: 60, creditos: 0, tipo: 'obrigatoria', prerequisitos: ['Cálculo Integral I'] },
    { codigo: '', semestre: '4', nome: 'Física Experimental III', cargaHoraria: 30, creditos: 0, tipo: 'obrigatoria', prerequisitos: ['Física Geral II', 'Física Experimental II'] }
];

StudyLifeControl.prototype.getUfobCurriculumReference = function() {
    return UFOB_ENGINEERING_CIVIL_REFERENCE.map(item => ({ ...item, prerequisitosLista: [...item.prerequisitos] }));
};

StudyLifeControl.prototype.slugifyName = function(value) {
    return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
};

StudyLifeControl.prototype.normalizePrerequisitos = function(value) {
    if (Array.isArray(value)) {
        return value.map(v => String(v || '').trim()).filter(Boolean);
    }
    const raw = String(value || '').trim();
    if (!raw) return [];
    return raw
        .split(/\s*(?:\||,|;|\+|\/|\be\b|\band\b)\s*/i)
        .map(v => v.trim())
        .filter(Boolean);
};

StudyLifeControl.prototype.normalizeCurriculumItem = function(item) {
    const normalized = { ...item };
    normalized.semestre = String(item.semestre || '').trim();
    normalized.nome = String(item.nome || '').trim();
    normalized.codigo = String(item.codigo || '').trim().toUpperCase();
    normalized.cargaHoraria = Number(item.cargaHoraria) || 0;
    normalized.creditos = Number(item.creditos) || 0;
    normalized.status = item.status || 'nao-cursada';
    normalized.tipo = item.tipo || 'obrigatoria';
    normalized.prerequisitosLista = this.normalizePrerequisitos(item.prerequisitosLista || item.prerequisitos || '');
    normalized.prerequisitos = normalized.prerequisitosLista.join(' | ');
    return normalized;
};

StudyLifeControl.prototype.normalizeCurriculumInMemory = function() {
    if (!Array.isArray(this.data.curriculum)) this.data.curriculum = [];
    this.data.curriculum = this.data.curriculum.map(item => this.normalizeCurriculumItem(item));
    if (!Array.isArray(this.data.extraCourses)) this.data.extraCourses = [];
};

StudyLifeControl.prototype.getNormalizedCurriculum = function() {
    this.normalizeCurriculumInMemory();
    return this.data.curriculum;
};


StudyLifeControl.prototype.getCurriculumSmartSuggestions = function(currentName = '', selectedSemester = '') {
    const normalizedCurrentName = this.slugifyName(currentName);
    const semesterNumber = parseInt(selectedSemester || 0, 10) || 0;
    const referenceMatch = this.getUfobCurriculumReference().find(item => this.slugifyName(item.nome) === normalizedCurrentName);
    const current = this.getNormalizedCurriculum();
    const previousSemesterItems = current
        .filter(item => (parseInt(item.semestre || 0, 10) < semesterNumber || !semesterNumber) && this.slugifyName(item.nome) !== normalizedCurrentName)
        .sort((a, b) => (parseInt(b.semestre || 0, 10) || 0) - (parseInt(a.semestre || 0, 10) || 0))
        .slice(0, 12)
        .map(item => item.nome);

    const suggestions = [];
    if (referenceMatch?.prerequisitos?.length) suggestions.push(...referenceMatch.prerequisitos);
    suggestions.push(...previousSemesterItems);

    return [...new Map(suggestions.filter(Boolean).map(name => [this.slugifyName(name), name])).values()].slice(0, 8);
};

StudyLifeControl.prototype.renderCurriculumAISuggestions = function(currentName = '', selectedSemester = '') {
    const container = document.getElementById('curriculum-ai-suggestions');
    if (!container) return;
    const suggestions = this.getCurriculumSmartSuggestions(currentName, selectedSemester)
        .filter(nome => !this.curriculumPrerequisitosSelecionados.includes(nome));
    if (!suggestions.length) {
        container.innerHTML = '<div class="ai-helper-card"><div><strong>Assistente de pré-requisitos</strong><p>Digite o nome da disciplina ou semestre que eu tento puxar sugestões automaticamente.</p></div></div>';
        return;
    }
    container.innerHTML = `
        <div class="ai-helper-card">
            <div class="ai-helper-head">
                <div>
                    <strong>Assistente de pré-requisitos</strong>
                    <p>Com base no nome da disciplina, semestre e matérias já cadastradas, estas parecem ser as mais prováveis.</p>
                </div>
                <span class="badge badge-soft">Sugestões</span>
            </div>
            <div class="ai-suggestion-list">
                ${suggestions.map(nome => `<button type="button" class="ai-suggestion-pill" data-value="${escapeHtml(nome)}"><i class="fas fa-sparkles"></i> ${escapeHtml(nome)}</button>`).join('')}
            </div>
        </div>
    `;
    container.querySelectorAll('.ai-suggestion-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!this.curriculumPrerequisitosSelecionados.includes(btn.dataset.value)) {
                this.curriculumPrerequisitosSelecionados.push(btn.dataset.value);
                this.curriculumPrerequisitosSelecionados = [...new Set(this.curriculumPrerequisitosSelecionados)];
                this.setupCurriculumModalUI(currentName);
                document.getElementById('curriculum-prerequisito-busca').focus();
            }
        });
    });
};

StudyLifeControl.prototype.setupCurriculumModalUI = function(currentName = '') {
    const searchInput = document.getElementById('curriculum-prerequisito-busca');
    const hiddenInput = document.getElementById('curriculum-prerequisitos');
    const tagsContainer = document.getElementById('curriculum-prerequisitos-tags');
    const suggestions = document.getElementById('curriculum-prerequisitos-sugestoes');
    const semesterInput = document.getElementById('curriculum-semestre');
    const nameInput = document.getElementById('curriculum-nome');
    if (!searchInput || !hiddenInput || !tagsContainer || !suggestions) return;

    const updateHidden = () => {
        hiddenInput.value = this.curriculumPrerequisitosSelecionados.join(' | ');
        tagsContainer.innerHTML = this.curriculumPrerequisitosSelecionados.map(req => `
            <span class="chip chip-removable">${escapeHtml(req)} <button type="button" class="chip-remove" data-value="${escapeHtml(req)}">×</button></span>
        `).join('');
        tagsContainer.querySelectorAll('.chip-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                this.curriculumPrerequisitosSelecionados = this.curriculumPrerequisitosSelecionados.filter(item => item !== btn.dataset.value);
                updateHidden();
                renderSuggestions();
                this.renderCurriculumAISuggestions(nameInput?.value || currentName, semesterInput?.value || '');
            });
        });
    };

    const pool = [...new Map([...this.getNormalizedCurriculum(), ...this.getUfobCurriculumReference()]
        .filter(item => item.nome && this.slugifyName(item.nome) !== this.slugifyName(currentName))
        .map(item => [this.slugifyName(item.nome), item.nome])).values()];

    const renderSuggestions = () => {
        const term = this.slugifyName(searchInput.value);
        const filtered = pool.filter(nome => !this.curriculumPrerequisitosSelecionados.includes(nome) && (!term || this.slugifyName(nome).includes(term))).slice(0, 16);
        suggestions.innerHTML = filtered.map(nome => `<button type="button" class="prereq-option" data-value="${escapeHtml(nome)}">${escapeHtml(nome)}</button>`).join('');
        suggestions.querySelectorAll('.prereq-option').forEach(btn => {
            btn.addEventListener('click', () => {
                this.curriculumPrerequisitosSelecionados.push(btn.dataset.value);
                this.curriculumPrerequisitosSelecionados = [...new Set(this.curriculumPrerequisitosSelecionados)];
                searchInput.value = '';
                updateHidden();
                renderSuggestions();
                this.renderCurriculumAISuggestions(nameInput?.value || currentName, semesterInput?.value || '');
            });
        });
    };

    searchInput.oninput = renderSuggestions;
    searchInput.onclick = renderSuggestions;
    document.getElementById('btn-add-custom-prereq')?.addEventListener('click', () => {
        const value = searchInput.value.trim();
        if (!value) return;
        if (!this.curriculumPrerequisitosSelecionados.includes(value)) this.curriculumPrerequisitosSelecionados.push(value);
        searchInput.value = '';
        updateHidden();
        renderSuggestions();
        this.renderCurriculumAISuggestions(nameInput?.value || currentName, semesterInput?.value || '');
    });

    document.querySelectorAll('.btn-ch-preset').forEach(btn => {
        btn.onclick = () => {
            if (btn.dataset.value === '0') {
                document.getElementById('curriculum-carga-horaria').focus();
                return;
            }
            document.getElementById('curriculum-carga-horaria').value = btn.dataset.value;
        };
    });

    const autofillFromReference = () => {
        const typed = this.slugifyName(nameInput?.value || '');
        const match = this.getUfobCurriculumReference().find(item => this.slugifyName(item.nome) === typed);
        if (match) {
            if (!document.getElementById('curriculum-carga-horaria').value) document.getElementById('curriculum-carga-horaria').value = match.cargaHoraria;
            if (!document.getElementById('curriculum-semestre').value) document.getElementById('curriculum-semestre').value = match.semestre;
            if (!Number(document.getElementById('curriculum-creditos').value)) document.getElementById('curriculum-creditos').value = match.creditos || '';
            if (!document.getElementById('curriculum-codigo').value && match.codigo) document.getElementById('curriculum-codigo').value = match.codigo;
            if (!this.curriculumPrerequisitosSelecionados.length && match.prerequisitos?.length) {
                this.curriculumPrerequisitosSelecionados = [...match.prerequisitos];
                updateHidden();
                renderSuggestions();
            }
        }
        this.renderCurriculumAISuggestions(nameInput?.value || currentName, semesterInput?.value || '');
    };

    nameInput?.addEventListener('blur', autofillFromReference);
    nameInput?.addEventListener('input', () => this.renderCurriculumAISuggestions(nameInput?.value || currentName, semesterInput?.value || ''));
    semesterInput?.addEventListener('input', () => this.renderCurriculumAISuggestions(nameInput?.value || currentName, semesterInput?.value || ''));

    updateHidden();
    renderSuggestions();
    this.renderCurriculumAISuggestions(nameInput?.value || currentName, semesterInput?.value || '');
};

StudyLifeControl.prototype.importarGradeUfob = async function() {
    this.normalizeCurriculumInMemory();
    const current = this.getNormalizedCurriculum();
    const existingMap = new Map(current.map(item => [this.slugifyName(item.nome), item]));
    const merged = [...current];
    let added = 0;
    this.getUfobCurriculumReference().forEach(item => {
        const key = this.slugifyName(item.nome);
        if (existingMap.has(key)) {
            const target = existingMap.get(key);
            target.semestre = target.semestre || item.semestre;
            target.cargaHoraria = Number(target.cargaHoraria) || item.cargaHoraria;
            target.creditos = Number(target.creditos) || item.creditos;
            const prereqs = new Set([...(target.prerequisitosLista || []), ...(item.prerequisitos || [])]);
            target.prerequisitosLista = [...prereqs];
            target.prerequisitos = target.prerequisitosLista.join(' | ');
            target.tipo = target.tipo || item.tipo;
        } else {
            merged.push({ id: generateId(), ...item, prerequisitosLista: [...item.prerequisitos], prerequisitos: item.prerequisitos.join(' | '), status: 'nao-cursada', observacoes: '' });
            added += 1;
        }
    });
    this.data.curriculum = merged.map(item => this.normalizeCurriculumItem(item));
    const success = await dbService.saveData('curriculum', this.data.curriculum);
    if (success) {
        this.loadView('grade-curricular');
        showToast(added ? `${added} componente(s) sugerido(s) pela UFOB foram adicionados.` : 'Sua grade já foi reorganizada com as referências da UFOB.');
    }
};



StudyLifeControl.prototype.saveCurriculumViewSettings = async function() {
    if (!this.data.settings) this.data.settings = {};
    this.data.settings.curriculumView = {
        startSemester: this.curriculumViewState?.startSemester || 'all',
        visibleCount: this.curriculumViewState?.visibleCount || 4
    };
    try {
        await dbService.saveData('settings', this.data.settings);
    } catch (error) {
        console.warn('Não foi possível salvar preferências da grade curricular.', error);
    }
};

StudyLifeControl.prototype.extractCourseLevel = function(value) {
    const normalized = String(value || '').toUpperCase();
    const romanMap = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };
    const romanMatch = normalized.match(/\b(VI|IV|V|III|II|I)\b/);
    if (romanMatch) return romanMap[romanMatch[1]] || 0;
    const arabicMatch = normalized.match(/\b(\d{1,2})\b/);
    return arabicMatch ? parseInt(arabicMatch[1], 10) : 0;
};

StudyLifeControl.prototype.getCurriculumCodeToken = function(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
};

StudyLifeControl.prototype.getCurriculumPrereqKnowledge = function() {
    const allItems = [...this.getNormalizedCurriculum(), ...this.getUfobCurriculumReference()].map(item => this.normalizeCurriculumItem(item));
    const dependencyFrequency = new Map();
    const usedAsPrereq = new Map();

    allItems.forEach(item => {
        const targetKey = this.slugifyName(item.nome);
        (item.prerequisitosLista || []).forEach(req => {
            const reqKey = this.slugifyName(req);
            const edgeKey = `${targetKey}__${reqKey}`;
            dependencyFrequency.set(edgeKey, (dependencyFrequency.get(edgeKey) || 0) + 1);
            usedAsPrereq.set(reqKey, (usedAsPrereq.get(reqKey) || 0) + 1);
        });
    });

    return { dependencyFrequency, usedAsPrereq };
};

StudyLifeControl.prototype.getCurriculumSuggestionObjects = function(currentName = '', selectedSemester = '') {
    const currentSlug = this.slugifyName(currentName);
    const currentCode = this.getCurriculumCodeToken(document.getElementById('curriculum-codigo')?.value || '');
    const semesterNumber = parseInt(selectedSemester || 0, 10) || 0;
    const currentLevel = this.extractCourseLevel(currentName || currentCode);
    const knowledge = this.getCurriculumPrereqKnowledge();
    const exactReference = this.getUfobCurriculumReference().find(item => this.slugifyName(item.nome) === currentSlug || (currentCode && this.getCurriculumCodeToken(item.codigo) === currentCode));

    const pool = [...this.getNormalizedCurriculum(), ...this.getUfobCurriculumReference()]
        .map(item => this.normalizeCurriculumItem(item))
        .filter(item => item.nome && this.slugifyName(item.nome) !== currentSlug);

    const uniquePool = [...new Map(pool.map(item => [this.slugifyName(item.nome), item])).values()];

    const suggestions = uniquePool.map(candidate => {
        let score = 0;
        const reasons = [];
        const candidateSlug = this.slugifyName(candidate.nome);
        const candidateCode = this.getCurriculumCodeToken(candidate.codigo);
        const candidateSemester = parseInt(candidate.semestre || 0, 10) || 0;
        const edgeKey = `${currentSlug}__${candidateSlug}`;

        if (exactReference?.prerequisitos?.some(req => this.slugifyName(req) === candidateSlug)) {
            score += 120;
            reasons.push('aparece na referência da UFOB');
        }

        const learnedWeight = knowledge.dependencyFrequency.get(edgeKey) || 0;
        if (learnedWeight) {
            score += 80 + (learnedWeight * 10);
            reasons.push('já apareceu como pré-requisito nesse padrão');
        }

        if (semesterNumber && candidateSemester && candidateSemester < semesterNumber) {
            score += Math.max(0, 50 - ((semesterNumber - candidateSemester - 1) * 6));
            reasons.push('vem de semestre anterior');
        }

        const currentTokens = new Set(currentSlug.split(' ').filter(token => token.length > 2));
        const candidateTokens = candidateSlug.split(' ').filter(token => token.length > 2);
        const overlap = candidateTokens.filter(token => currentTokens.has(token)).length;
        if (overlap) {
            score += overlap * 9;
            reasons.push('nome parecido');
        }

        const candidateLevel = this.extractCourseLevel(candidate.nome || candidate.codigo);
        if (currentLevel && candidateLevel && candidateLevel === currentLevel - 1) {
            score += 35;
            reasons.push('sequência I/II/III provável');
        }

        if (currentCode && candidateCode && currentCode.slice(0, 3) === candidateCode.slice(0, 3)) {
            score += 14;
            reasons.push('código próximo');
        }

        const popularAsPrereq = knowledge.usedAsPrereq.get(candidateSlug) || 0;
        if (popularAsPrereq) {
            score += Math.min(18, popularAsPrereq * 3);
            reasons.push('muito usada como base');
        }

        return {
            nome: candidate.nome,
            codigo: candidate.codigo || '',
            semestre: candidate.semestre || '',
            score,
            reasons: [...new Set(reasons)].slice(0, 2)
        };
    }).filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || a.nome.localeCompare(b.nome, 'pt-BR'));

    return suggestions;
};

StudyLifeControl.prototype.getCurriculumSmartSuggestions = function(currentName = '', selectedSemester = '') {
    return this.getCurriculumSuggestionObjects(currentName, selectedSemester).slice(0, 10).map(item => item.nome);
};

StudyLifeControl.prototype.renderCurriculumAISuggestions = function(currentName = '', selectedSemester = '') {
    const container = document.getElementById('curriculum-ai-suggestions');
    if (!container) return;
    const suggestions = this.getCurriculumSuggestionObjects(currentName, selectedSemester)
        .filter(item => !this.curriculumPrerequisitosSelecionados.includes(item.nome))
        .slice(0, 6);
    if (!suggestions.length) {
        container.innerHTML = '<div class="ai-helper-card"><div><strong>Assistente inteligente de pré-requisitos</strong><p>Digite nome, código ou semestre. Eu cruzo seus componentes já cadastrados, a ordem da grade e a base da UFOB para priorizar sugestões úteis.</p></div></div>';
        return;
    }
    container.innerHTML = `
        <div class="ai-helper-card ai-helper-card-strong">
            <div class="ai-helper-head">
                <div>
                    <strong>Assistente inteligente de pré-requisitos</strong>
                    <p>Ranking montado com nome, código, semestre anterior, relações já usadas na sua grade e referência da UFOB.</p>
                </div>
                <span class="badge badge-soft">Top ${suggestions.length}</span>
            </div>
            <div class="ai-suggestion-grid">
                ${suggestions.map(item => `
                    <button type="button" class="ai-suggestion-card" data-value="${escapeHtml(item.nome)}">
                        <div class="ai-suggestion-card-top">
                            <strong>${escapeHtml(item.nome)}</strong>
                            <span class="ai-score-badge">${Math.round(item.score)}</span>
                        </div>
                        <div class="ai-suggestion-card-meta">
                            ${item.codigo ? `<span class="code-badge">${escapeHtml(item.codigo)}</span>` : ''}
                            ${item.semestre ? `<span>${escapeHtml(item.semestre)}º semestre</span>` : ''}
                        </div>
                        <small>${escapeHtml(item.reasons.join(' • ') || 'sugestão provável')}</small>
                    </button>
                `).join('')}
            </div>
        </div>
    `;
    container.querySelectorAll('.ai-suggestion-card').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!this.curriculumPrerequisitosSelecionados.includes(btn.dataset.value)) {
                this.curriculumPrerequisitosSelecionados.push(btn.dataset.value);
                this.curriculumPrerequisitosSelecionados = [...new Set(this.curriculumPrerequisitosSelecionados)];
                this.setupCurriculumModalUI(currentName);
                document.getElementById('curriculum-prerequisito-busca')?.focus();
            }
        });
    });
};

StudyLifeControl.prototype.setupCurriculumModalUI = function(currentName = '') {
    const searchInput = document.getElementById('curriculum-prerequisito-busca');
    const hiddenInput = document.getElementById('curriculum-prerequisitos');
    const tagsContainer = document.getElementById('curriculum-prerequisitos-tags');
    const suggestions = document.getElementById('curriculum-prerequisitos-sugestoes');
    const semesterInput = document.getElementById('curriculum-semestre');
    const nameInput = document.getElementById('curriculum-nome');
    const codeInput = document.getElementById('curriculum-codigo');
    if (!searchInput || !hiddenInput || !tagsContainer || !suggestions) return;

    const updateHidden = () => {
        hiddenInput.value = this.curriculumPrerequisitosSelecionados.join(' | ');
        tagsContainer.innerHTML = this.curriculumPrerequisitosSelecionados.map(req => {
            const source = [...this.getNormalizedCurriculum(), ...this.getUfobCurriculumReference()].find(item => this.slugifyName(item.nome) === this.slugifyName(req));
            return `
                <span class="chip chip-removable">
                    ${source?.codigo ? `<span class="chip-code">${escapeHtml(source.codigo)}</span>` : ''}
                    <span>${escapeHtml(req)}</span>
                    <button type="button" class="chip-remove" data-value="${escapeHtml(req)}">×</button>
                </span>
            `;
        }).join('');
        tagsContainer.querySelectorAll('.chip-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                this.curriculumPrerequisitosSelecionados = this.curriculumPrerequisitosSelecionados.filter(item => item !== btn.dataset.value);
                updateHidden();
                renderSuggestions();
                this.renderCurriculumAISuggestions(nameInput?.value || currentName, semesterInput?.value || '');
            });
        });
    };

    const pool = [...new Map([...this.getNormalizedCurriculum(), ...this.getUfobCurriculumReference()]
        .map(item => this.normalizeCurriculumItem(item))
        .filter(item => item.nome && this.slugifyName(item.nome) !== this.slugifyName(currentName))
        .map(item => [this.slugifyName(item.nome), item])).values()];

    const renderSuggestions = () => {
        const term = this.slugifyName(searchInput.value);
        const codeTerm = this.getCurriculumCodeToken(searchInput.value);
        const filtered = pool
            .filter(item => !this.curriculumPrerequisitosSelecionados.includes(item.nome))
            .filter(item => {
                if (!term && !codeTerm) return true;
                return this.slugifyName(item.nome).includes(term) || this.getCurriculumCodeToken(item.codigo).includes(codeTerm);
            })
            .sort((a, b) => {
                const aStarts = this.getCurriculumCodeToken(a.codigo).startsWith(codeTerm) || this.slugifyName(a.nome).startsWith(term);
                const bStarts = this.getCurriculumCodeToken(b.codigo).startsWith(codeTerm) || this.slugifyName(b.nome).startsWith(term);
                if (aStarts !== bStarts) return aStarts ? -1 : 1;
                return (parseInt(a.semestre || 0, 10) || 99) - (parseInt(b.semestre || 0, 10) || 99);
            })
            .slice(0, 18);

        suggestions.innerHTML = filtered.map(item => `
            <button type="button" class="prereq-option prereq-option-rich" data-value="${escapeHtml(item.nome)}">
                <div>
                    <strong>${escapeHtml(item.nome)}</strong>
                    <small>${item.semestre ? `${escapeHtml(item.semestre)}º semestre` : 'Sem semestre'}</small>
                </div>
                ${item.codigo ? `<span class="code-badge">${escapeHtml(item.codigo)}</span>` : ''}
            </button>
        `).join('');

        suggestions.querySelectorAll('.prereq-option').forEach(btn => {
            btn.addEventListener('click', () => {
                this.curriculumPrerequisitosSelecionados.push(btn.dataset.value);
                this.curriculumPrerequisitosSelecionados = [...new Set(this.curriculumPrerequisitosSelecionados)];
                searchInput.value = '';
                updateHidden();
                renderSuggestions();
                this.renderCurriculumAISuggestions(nameInput?.value || currentName, semesterInput?.value || '');
            });
        });
    };

    searchInput.oninput = renderSuggestions;
    searchInput.onclick = renderSuggestions;
    searchInput.placeholder = 'Pesquise por nome ou código. Ex: Cálculo, CET0155';

    document.getElementById('btn-add-custom-prereq')?.addEventListener('click', () => {
        const value = searchInput.value.trim();
        if (!value) return;
        const existing = pool.find(item => this.slugifyName(item.nome) === this.slugifyName(value) || this.getCurriculumCodeToken(item.codigo) === this.getCurriculumCodeToken(value));
        const label = existing?.nome || value;
        if (!this.curriculumPrerequisitosSelecionados.includes(label)) this.curriculumPrerequisitosSelecionados.push(label);
        searchInput.value = '';
        updateHidden();
        renderSuggestions();
        this.renderCurriculumAISuggestions(nameInput?.value || currentName, semesterInput?.value || '');
    });

    document.querySelectorAll('.btn-ch-preset').forEach(btn => {
        btn.onclick = () => {
            if (btn.dataset.value === '0') {
                document.getElementById('curriculum-carga-horaria')?.focus();
                return;
            }
            document.getElementById('curriculum-carga-horaria').value = btn.dataset.value;
        };
    });

    const autofillFromReference = () => {
        const typed = this.slugifyName(nameInput?.value || '');
        const typedCode = this.getCurriculumCodeToken(codeInput?.value || '');
        const match = this.getUfobCurriculumReference().find(item => this.slugifyName(item.nome) === typed || (typedCode && this.getCurriculumCodeToken(item.codigo) === typedCode));
        if (match) {
            if (!document.getElementById('curriculum-carga-horaria').value) document.getElementById('curriculum-carga-horaria').value = match.cargaHoraria;
            if (!document.getElementById('curriculum-semestre').value) document.getElementById('curriculum-semestre').value = match.semestre;
            if (!Number(document.getElementById('curriculum-creditos').value)) document.getElementById('curriculum-creditos').value = match.creditos || '';
            if (!document.getElementById('curriculum-codigo').value && match.codigo) document.getElementById('curriculum-codigo').value = match.codigo;
            if (!this.curriculumPrerequisitosSelecionados.length && match.prerequisitos?.length) {
                this.curriculumPrerequisitosSelecionados = [...match.prerequisitos];
                updateHidden();
                renderSuggestions();
            }
        }
        this.renderCurriculumAISuggestions(nameInput?.value || currentName, semesterInput?.value || '');
    };

    nameInput?.addEventListener('blur', autofillFromReference);
    nameInput?.addEventListener('input', () => this.renderCurriculumAISuggestions(nameInput?.value || currentName, semesterInput?.value || ''));
    codeInput?.addEventListener('input', () => this.renderCurriculumAISuggestions(nameInput?.value || currentName, semesterInput?.value || ''));
    semesterInput?.addEventListener('input', () => this.renderCurriculumAISuggestions(nameInput?.value || currentName, semesterInput?.value || ''));

    updateHidden();
    renderSuggestions();
    this.renderCurriculumAISuggestions(nameInput?.value || currentName, semesterInput?.value || '');
};

const originalHandleCurriculumSubmit = StudyLifeControl.prototype.handleCurriculumSubmit;
StudyLifeControl.prototype.handleCurriculumSubmit = async function(e) {
    e.preventDefault();
    const curriculumData = {
        nome: document.getElementById('curriculum-nome')?.value?.trim() || '',
        codigo: document.getElementById('curriculum-codigo')?.value?.trim().toUpperCase() || '',
        semestre: document.getElementById('curriculum-semestre')?.value?.trim() || '',
        cargaHoraria: parseInt(document.getElementById('curriculum-carga-horaria')?.value, 10) || 0,
        status: document.getElementById('curriculum-status')?.value || 'nao-cursada',
        tipo: document.getElementById('curriculum-tipo')?.value || 'obrigatoria',
        creditos: parseFloat(document.getElementById('curriculum-creditos')?.value) || 0,
        prerequisitosLista: [...new Set(this.curriculumPrerequisitosSelecionados || [])],
        observacoes: document.getElementById('curriculum-observacoes')?.value?.trim() || ''
    };
    curriculumData.prerequisitos = curriculumData.prerequisitosLista.join(' | ');
    if (!curriculumData.nome) return showToast('Informe o nome da disciplina/componente', 'warning');
    if (!curriculumData.cargaHoraria) return showToast('Informe a carga horária', 'warning');
    if (this.editingCurriculumId) await this.salvarCurriculumEditado(this.editingCurriculumId, curriculumData);
    else await this.salvarNovoCurriculum(curriculumData);
    document.getElementById('modal-curriculum').style.display = 'none';
    this.resetModalStates();
};

StudyLifeControl.prototype.handleExtraCourseSubmit = async function(e) {
    e.preventDefault();
    const courseData = {
        nome: document.getElementById('extra-course-nome')?.value?.trim() || '',
        plataforma: document.getElementById('extra-course-plataforma')?.value?.trim() || '',
        area: document.getElementById('extra-course-area')?.value?.trim() || '',
        status: document.getElementById('extra-course-status')?.value || 'em-andamento',
        metaHoras: parseFloat(document.getElementById('extra-course-meta-horas')?.value) || 0,
        horasEstudadas: parseFloat(document.getElementById('extra-course-horas-estudadas')?.value) || 0,
        progresso: parseFloat(document.getElementById('extra-course-progresso')?.value) || 0,
        dataInicio: document.getElementById('extra-course-data-inicio')?.value || '',
        link: document.getElementById('extra-course-link')?.value?.trim() || '',
        observacoes: document.getElementById('extra-course-observacoes')?.value?.trim() || ''
    };
    if (!courseData.nome) return showToast('Informe o nome do curso', 'warning');
    if (!Array.isArray(this.data.extraCourses)) this.data.extraCourses = [];
    if (this.editingExtraCourseId) {
        const success = await dbService.updateItem('extraCourses', this.editingExtraCourseId, courseData);
        if (success) showToast('Curso extra atualizado!');
    } else {
        const success = await dbService.addItem('extraCourses', { id: generateId(), ...courseData });
        if (success) showToast('Curso extra adicionado!');
    }
    document.getElementById('modal-extra-course').style.display = 'none';
    this.resetModalStates();
    this.loadView('cursos-extras');
};

StudyLifeControl.prototype.editarExtraCourse = function(id) {
    const item = (this.data.extraCourses || []).find(c => c.id === id);
    if (!item) return;
    this.editingExtraCourseId = id;
    this.openModal('extra-course', item);
};

StudyLifeControl.prototype.excluirExtraCourse = async function(id) {
    if (!confirm('Deseja excluir este curso extra?')) return;
    const success = await dbService.removeItem('extraCourses', id);
    if (success) {
        this.loadView('cursos-extras');
        showToast('Curso extra excluído!');
    }
};


// __advanced_dashboard_v4__
(function () {
    if (!window.StudyLifeControl || window.StudyLifeControl.prototype.__advancedDashboardPatched) return;
    const proto = window.StudyLifeControl.prototype;

    proto.ensureAdvancedData = function() {
        this.data.settings = this.data.settings || {};
        this.data.settings.studyGoals = this.data.settings.studyGoals || {
            weeklyHours: Number(this.data.user?.horasMaximas || 4) * 5,
            monthlyHours: Number(this.data.user?.horasMaximas || 4) * 20,
            weeklyPomodoros: 10,
            weeklyTasks: 8,
            weeklyReviews: 6
        };
        return this.data.settings.studyGoals;
    };

    proto.getReviewItemsForDays = function(days = 7) {
        const today = new Date();
        today.setHours(0,0,0,0);
        return (this.data.reviews || []).filter(item => {
            if (item?.concluida) return false;
            const date = new Date(item?.data);
            if (Number.isNaN(date.getTime())) return false;
            date.setHours(0,0,0,0);
            const diff = Math.round((date - today) / 86400000);
            return diff >= 0 && diff <= days;
        }).sort((a,b) => new Date(a.data) - new Date(b.data));
    };

    proto.getPomodoroCount = function(days = 7) {
        const limit = Date.now() - (days * 86400000);
        return (this.data.sessions || []).filter(s => {
            const date = new Date(s?.data || 0).getTime();
            return (s?.concluida || s?.status === 'concluida') && date >= limit && ['foco', 'pomodoro'].includes(String(s?.tipo || '').toLowerCase());
        }).length;
    };

    proto.getCompletedTasksCount = function(days = 7) {
        return (this.data.tasks || []).filter(t => !!t?.concluida).length;
    };

    proto.getCompletedReviewsCount = function(days = 7) {
        const limit = Date.now() - (days * 86400000);
        return (this.data.reviews || []).filter(r => {
            if (!r?.concluida) return false;
            const updated = new Date(r?.updatedAt || r?.data || 0).getTime();
            return updated >= limit;
        }).length;
    };

    proto.getStudyGoalsSnapshot = function() {
        const goals = this.ensureAdvancedData();
        const now = new Date();
        const startWeek = new Date(now);
        startWeek.setHours(0,0,0,0);
        startWeek.setDate(now.getDate() - now.getDay());
        const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const completedSessions = (this.data.sessions || []).filter(s => s?.concluida || s?.status === 'concluida');
        const weeklyMinutes = completedSessions.filter(s => new Date(s.data) >= startWeek).reduce((a,s) => a + (Number(s?.duracao)||0), 0);
        const monthlyMinutes = completedSessions.filter(s => new Date(s.data) >= startMonth).reduce((a,s) => a + (Number(s?.duracao)||0), 0);

        const weeklyHours = weeklyMinutes / 60;
        const monthlyHours = monthlyMinutes / 60;
        const weeklyPomodoros = this.getPomodoroCount(7);
        const weeklyTasksDone = this.getCompletedTasksCount(7);
        const weeklyReviewsDone = this.getCompletedReviewsCount(7);

        return {
            goals,
            weeklyHours,
            monthlyHours,
            weeklyPomodoros,
            weeklyTasksDone,
            weeklyReviewsDone,
            progress: {
                weeklyHours: goals.weeklyHours ? Math.min(100, Math.round((weeklyHours / goals.weeklyHours) * 100)) : 0,
                monthlyHours: goals.monthlyHours ? Math.min(100, Math.round((monthlyHours / goals.monthlyHours) * 100)) : 0,
                weeklyPomodoros: goals.weeklyPomodoros ? Math.min(100, Math.round((weeklyPomodoros / goals.weeklyPomodoros) * 100)) : 0,
                weeklyTasks: goals.weeklyTasks ? Math.min(100, Math.round((weeklyTasksDone / goals.weeklyTasks) * 100)) : 0,
                weeklyReviews: goals.weeklyReviews ? Math.min(100, Math.round((weeklyReviewsDone / goals.weeklyReviews) * 100)) : 0,
            }
        };
    };

    proto.saveStudyGoals = async function(partialGoals = {}) {
        const goals = { ...this.ensureAdvancedData(), ...partialGoals };
        this.data.settings.studyGoals = goals;
        return dbService.saveData('settings', this.data.settings);
    };

    proto.getSubjectPerformance = function(subjectName) {
        const subject = (this.data.subjects || []).find(s => s?.nome === subjectName);
        if (!subject) return null;
        const tasks = (this.data.tasks || []).filter(t => t?.materia === subjectName && !t?.concluida);
        const exams = (this.data.exams || []).filter(e => e?.materia === subjectName && !e?.concluida).sort((a,b) => new Date(a.data) - new Date(b.data));
        const sessions = (this.data.sessions || []).filter(s => s?.materia === subjectName && (s?.concluida || s?.status === 'concluida'));
        const grades = (this.data.grades || []).filter(g => g?.materia === subjectName);
        const reviewsPending = (this.data.reviews || []).filter(r => r?.materia === subjectName && !r?.concluida);
        const diaries = (this.data.classDiaries || []).filter(d => d?.materia === subjectName).sort((a,b) => new Date(b.data) - new Date(a.data));
        const upcomingExam = exams[0] || null;
        const average = this.calcularMedia(grades);
        const hours = sessions.reduce((a,s) => a + (Number(s?.duracao)||0), 0) / 60;
        const attended = diaries.filter(d => d?.presenca === 'present').length;
        const attendance = diaries.length ? Math.round((attended / diaries.length) * 100) : 100;
        const lastStudy = sessions.sort((a,b) => new Date(b.data) - new Date(a.data))[0];
        const daysWithoutStudy = lastStudy ? diasDesde(lastStudy.data) : null;
        const risk = this.analyzeAcademicRisk().find(r => r.materia === subjectName) || null;

        let recommendation = 'Manter constância com teoria e exercícios.';
        if (upcomingExam && diasAte(upcomingExam.data) <= 7) recommendation = `Focar em ${subjectName} agora: revisar conteúdo + resolver questões até ${formatarData(upcomingExam.data)}.`;
        else if (average > 0 && average < 6) recommendation = 'Prioridade alta: recuperar média com revisão ativa e lista de exercícios.';
        else if (tasks.length >= 2) recommendation = 'Fechar pendências dessa matéria antes de abrir novos conteúdos.';
        else if (reviewsPending.length) recommendation = 'Aproveitar revisões pendentes para fixar o conteúdo.';

        return {
            subject,
            average,
            hours,
            tasksPending: tasks.length,
            upcomingExam,
            upcomingExamsCount: exams.length,
            attendance,
            absences: Math.max(0, diaries.length - attended),
            reviewsPending: reviewsPending.length,
            riskLevel: risk?.nivel || (average > 0 && average < 6 ? 'alto' : upcomingExam && diasAte(upcomingExam.data) <= 7 ? 'medio' : 'baixo'),
            riskReason: risk?.motivo || (daysWithoutStudy !== null && daysWithoutStudy >= 7 ? `${daysWithoutStudy} dias sem estudar` : 'sem alerta forte agora'),
            recommendation,
            daysWithoutStudy,
            lastDiary: diaries[0] || null,
            nextRequiredGrade: this.estimateNextRequiredGrade(subjectName, Number(subject?.notaDesejada || 7))
        };
    };

    proto.estimateNextRequiredGrade = function(subjectName, target = 7) {
        const grades = (this.data.grades || []).filter(g => g?.materia === subjectName);
        if (!grades.length) return Number(target).toFixed(1);
        const totalWeight = grades.reduce((a,g) => a + (Number(g?.peso)||0), 0);
        const weighted = grades.reduce((a,g) => a + ((Number(g?.valor)||0) * (Number(g?.peso)||0)), 0);
        const remaining = Math.max(0, 100 - totalWeight);
        if (!remaining) return '0.0';
        const needed = (((Number(target) || 7) * 100) - weighted) / remaining;
        return Math.max(0, needed).toFixed(1);
    };

    proto.getHojeInteligenteData = function() {
        this.ensureAdvancedData();
        const now = new Date();
        const today = toDateString(now);
        const goals = this.getStudyGoalsSnapshot();
        const urgentTasks = this.getUrgentTasks().slice(0, 5);
        const reviewsToday = this.getReviewItemsForDays(0);
        const upcomingExams = this.getUpcomingExams(7).slice(0, 4);
        const nextClass = window.scheduleManager?.getProximaAula?.() || null;
        const currentClass = window.scheduleManager?.getAulaAtual?.() || null;
        const suggestions = window.aiAssistant?.generateDailyPlan?.() || [];
        const topSuggestion = suggestions[0] || null;
        const pomodoroMinutes = topSuggestion ? Math.max(25, Math.min(90, Number(topSuggestion.duracao) || 45)) : 45;
        const risk = this.analyzeAcademicRisk();
        const overdueTasks = (this.data.tasks || []).filter(t => !t?.concluida && diasAte(t.dataLimite) < 0);
        const lowStudy = (this.data.sessions || []).filter(s => s?.concluida && diasDesde(s.data) <= 7).reduce((a,s) => a + (Number(s?.duracao)||0), 0) / 60;
        const focusToday = (this.data.dailyLogs || []).find(log => log?.data === today)?.foco || null;
        const dailyTargetHours = Math.max(2, Math.min(8, Number(this.data.user?.horasMaximas) || 4));
        const todayProgress = this.calcularProgressoHoje();
        const antiProcrastination = (overdueTasks.length >= 2 || (risk.length >= 2 && lowStudy < 4))
            ? this.getRecoveryPlan(3)
            : null;

        return {
            today,
            nextClass,
            currentClass,
            urgentTasks,
            overdueTasks,
            reviewsToday,
            upcomingExams,
            topSuggestion,
            pomodoroMinutes,
            dailyTargetHours,
            todayProgress,
            goals,
            risk,
            antiProcrastination,
            focusToday
        };
    };

    proto.getRecoveryPlan = function(days = 3) {
        const priorities = (window.aiAssistant?.generateDailyPlan?.() || []).slice(0, Math.max(2, days));
        const overdueTasks = (this.data.tasks || []).filter(t => !t?.concluida && diasAte(t.dataLimite) < 0).slice(0, 5);
        const exams = this.getUpcomingExams(10).slice(0, 4);
        const daysList = [];
        for (let i = 0; i < days; i += 1) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            const main = priorities[i % Math.max(1, priorities.length)] || null;
            daysList.push({
                date: formatarData(date),
                focus: main?.materia || 'Organização geral',
                action: main ? `${main.tipo} por ${main.duracao} min` : '30 min para revisar pendências',
                extra: overdueTasks[i] ? `Fechar tarefa: ${overdueTasks[i].titulo}` : exams[i] ? `Avançar em ${exams[i].materia}` : 'Separar materiais da próxima aula'
            });
        }
        return {
            level: overdueTasks.length >= 4 ? 'alto' : 'medio',
            reason: overdueTasks.length ? `${overdueTasks.length} pendência(s) vencida(s)` : 'sinais de acúmulo em matérias importantes',
            days: daysList
        };
    };

    proto.getAutoReports = function() {
        const goals = this.getStudyGoalsSnapshot();
        const bySubject = this.calcularHorasPorMateria();
        const strongest = bySubject[0]?.materia || 'nenhuma';
        const weakest = this.data.subjects.map(s => ({ nome: s.nome, horas: bySubject.find(i => i.materia === s.nome)?.horas || 0 }))
            .sort((a,b) => a.horas - b.horas)[0]?.nome || 'nenhuma';
        const tasksDone = (this.data.tasks || []).filter(t => t?.concluida).length;
        const tasksTotal = (this.data.tasks || []).length;
        const reviewsToday = this.getReviewItemsForDays(0).length;
        return {
            daily: `Hoje você concluiu ${Number(this.calcularProgressoHoje().concluido).toFixed(1)}h de estudo e tem ${reviewsToday} revisão(ões) pendente(s).`,
            weekly: `Essa semana você estudou ${goals.weeklyHours.toFixed(1)}h. A matéria mais forte foi ${strongest} e a mais negligenciada foi ${weakest}. Você concluiu ${tasksDone} de ${tasksTotal} tarefa(s).`,
            monthly: `No mês atual você acumula ${goals.monthlyHours.toFixed(1)}h estudadas e ${goals.weeklyPomodoros} pomodoro(s) registrados nos últimos 7 dias.`
        };
    };

    proto.getAcademicSituationSummary = function() {
        const performances = (this.data.subjects || []).map(s => this.getSubjectPerformance(s.nome)).filter(Boolean);
        const safe = performances.filter(p => p.riskLevel === 'baixo');
        const attention = performances.filter(p => p.riskLevel === 'medio');
        const risk = performances.filter(p => p.riskLevel === 'alto');
        const avgAttendance = performances.length ? Math.round(performances.reduce((a,p) => a + p.attendance, 0) / performances.length) : 100;
        const avgGradeItems = performances.filter(p => p.average > 0);
        const generalAverage = avgGradeItems.length ? (avgGradeItems.reduce((a,p) => a + p.average, 0) / avgGradeItems.length).toFixed(1) : '0.0';
        const weekPending = (this.data.tasks || []).filter(t => !t?.concluida && diasAte(t.dataLimite) <= 7).length + this.getReviewItemsForDays(7).length;
        return { safe, attention, risk, avgAttendance, generalAverage, weekPending, performances };
    };

    const originalHandleClassDiarySubmit = proto.handleClassDiarySubmit;
    proto.handleClassDiarySubmit = async function(e) {
        e.preventDefault();
        const diaryData = {
            materia: document.getElementById('class-diary-materia')?.value,
            data: document.getElementById('class-diary-data')?.value,
            presenca: document.getElementById('class-diary-presenca')?.value,
            conteudoExplicado: document.getElementById('class-diary-conteudo')?.value,
            exerciciosPassados: document.getElementById('class-diary-exercicios')?.value,
            entendi: document.getElementById('class-diary-entendi')?.value || '',
            naoEntendi: document.getElementById('class-diary-nao-entendi')?.value || '',
            duvidaPendente: document.getElementById('class-diary-duvida')?.value || '',
            linksAnexos: document.getElementById('class-diary-links')?.value || '',
            trabalhoAnunciado: document.getElementById('class-diary-trabalho')?.value,
            dificuldade: parseInt(document.getElementById('class-diary-dificuldade')?.value, 10) || 3,
            precisoRevisar: !!document.getElementById('class-diary-revisar')?.checked,
            observacoes: document.getElementById('class-diary-observacoes')?.value
        };
        await window.classDiaryService?.registrarDiario(diaryData);
        const modal = document.getElementById('modal-class-diary');
        if (modal) modal.style.display = 'none';
        this.loadView(this.currentView);
    };

    proto.__advancedDashboardPatched = true;
})();


const STUDY_LIFE_TEMPLATE_CATALOG = [
    {
        id: 'ufob-engenharia-civil',
        universidade: 'UFOB',
        curso: 'Engenharia Civil',
        aliasesUniversidade: ['ufob', 'universidade federal do oeste da bahia'],
        aliasesCurso: ['engenharia civil', 'eng civil'],
        getCurriculum() {
            return UFOB_ENGINEERING_CIVIL_REFERENCE.map(item => ({ ...item, prerequisitosLista: [...(item.prerequisitos || [])] }));
        }
    }
];

StudyLifeControl.prototype.getCourseTemplateCatalog = function() {
    return STUDY_LIFE_TEMPLATE_CATALOG.map(template => ({
        ...template,
        curriculum: typeof template.getCurriculum === 'function'
            ? template.getCurriculum()
            : (template.curriculum || []).map(item => ({ ...item, prerequisitosLista: [...(item.prerequisitosLista || item.prerequisitos || [])] }))
    }));
};

StudyLifeControl.prototype.getCourseTemplateById = function(templateId) {
    return this.getCourseTemplateCatalog().find(template => template.id === templateId) || null;
};

StudyLifeControl.prototype.matchTemplateByProfile = function(universidade = '', curso = '') {
    const uni = this.slugifyName(universidade);
    const course = this.slugifyName(curso);
    if (!uni && !course) return null;
    return this.getCourseTemplateCatalog().find(template => {
        const uniTokens = [template.universidade, ...(template.aliasesUniversidade || [])].map(value => this.slugifyName(value));
        const courseTokens = [template.curso, ...(template.aliasesCurso || [])].map(value => this.slugifyName(value));
        const uniOk = !uni || uniTokens.some(token => token && (token === uni || uni.includes(token) || token.includes(uni)));
        const courseOk = !course || courseTokens.some(token => token && (token === course || course.includes(token) || token.includes(course)));
        return uniOk && courseOk;
    }) || null;
};

StudyLifeControl.prototype.buildCurriculumFromTemplate = function(template) {
    if (!template) return [];
    return (template.curriculum || []).map(item => this.normalizeCurriculumItem({
        id: generateId(),
        status: 'nao-cursada',
        observacoes: '',
        ...item,
        prerequisitosLista: [...(item.prerequisitosLista || item.prerequisitos || [])]
    }));
};

StudyLifeControl.prototype.getTemplateCurrentSemesterSubjects = function(template, semester) {
    if (!template) return [];
    const targetSemester = String(semester || '').trim();
    return (template.curriculum || [])
        .filter(item => String(item.semestre || '').trim() === targetSemester)
        .map(item => ({
            id: generateId(),
            nome: item.nome,
            dificuldade: this.extractCourseLevel(item.nome) >= 3 ? 4 : 3,
            peso: item.tipo === 'obrigatoria' ? 4 : 3,
            notaDesejada: 7
        }));
};

StudyLifeControl.prototype.populateSetupSubjects = function(subjects = []) {
    const container = document.getElementById('materias-container');
    if (!container) return;
    container.innerHTML = '';
    if (!subjects.length) {
        this.addMateriaField();
        return;
    }
    subjects.forEach(subject => {
        this.addMateriaField();
        const item = container.lastElementChild;
        if (!item) return;
        const nameInput = item.querySelector('.materia-nome');
        const diffInput = item.querySelector('.materia-dificuldade');
        const weightInput = item.querySelector('.materia-peso');
        const targetInput = item.querySelector('.materia-nota-desejada');
        if (nameInput) nameInput.value = subject.nome || '';
        if (diffInput) diffInput.value = subject.dificuldade || 3;
        if (weightInput) weightInput.value = subject.peso || 3;
        if (targetInput) targetInput.value = subject.notaDesejada || 7;
    });
};

StudyLifeControl.prototype.getCurriculumTemplatePreviewHtml = function(templateId, semester) {
    const template = this.getCourseTemplateById(templateId);
    const preview = document.getElementById('setup-template-preview');
    if (!preview) return;
    if (!template) {
        preview.innerHTML = '<div class="setup-import-preview-empty">Escolha uma faculdade e um curso da lista ou use o importador por texto logo abaixo.</div>';
        return;
    }
    const total = template.curriculum.length;
    const semesterItems = this.getTemplateCurrentSemesterSubjects(template, semester);
    const totalHoras = template.curriculum.reduce((acc, item) => acc + (Number(item.cargaHoraria) || 0), 0);
    preview.innerHTML = `
        <div class="setup-import-preview-card">
            <div>
                <strong>${escapeHtml(template.universidade)} • ${escapeHtml(template.curso)}</strong>
                <p>${total} componentes cadastrados no modelo e ${semesterItems.length} matérias encontradas para o ${escapeHtml(String(semester || '?'))}º semestre.</p>
            </div>
            <div class="setup-import-kpis">
                <span><strong>${totalHoras}h</strong><small>carga total</small></span>
                <span><strong>${semesterItems.length}</strong><small>matérias do semestre</small></span>
            </div>
        </div>
        <div class="setup-import-subject-tags">
            ${semesterItems.slice(0, 8).map(item => `<span class="chip">${escapeHtml(item.nome)}</span>`).join('') || '<span class="setup-import-preview-empty">Semestre ainda não selecionado ou sem disciplinas no modelo.</span>'}
        </div>
    `;
};

StudyLifeControl.prototype.renderSetupSmartImporter = function() {
    const form = document.getElementById('setup-form');
    if (!form) return;

    let section = document.getElementById('setup-smart-import-section');
    if (!section) {
        section = document.createElement('div');
        section.className = 'form-section setup-smart-import-section';
        section.id = 'setup-smart-import-section';
        section.innerHTML = `
            <h2><i class="fas fa-wand-magic-sparkles"></i> Importação inteligente da grade</h2>
            <p class="setup-import-helper">Você pode usar um modelo pronto, colar texto do fluxograma ou importar um arquivo <strong>.json</strong> gerado com ajuda do ChatGPT a partir do PDF/imagem da sua faculdade.</p>
            <div class="form-row setup-import-row">
                <div class="form-group">
                    <label>Modelo de faculdade</label>
                    <select id="setup-template-id">
                        <option value="">Selecionar depois</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>O que fazer</label>
                    <select id="setup-template-mode">
                        <option value="merge">Somar ao que eu já preencher</option>
                        <option value="replace">Substituir a grade curricular por este modelo</option>
                    </select>
                </div>
            </div>
            <div class="setup-import-actions">
                <button type="button" class="btn-secondary" id="btn-detectar-template-setup"><i class="fas fa-bullseye"></i> Detectar pelo curso</button>
                <button type="button" class="btn-primary" id="btn-aplicar-template-setup"><i class="fas fa-layer-group"></i> Preencher matérias do semestre</button>
            </div>
            <div id="setup-template-preview" class="setup-template-preview"></div>
            <div class="setup-import-assist-grid">
                <div class="setup-import-chatgpt-card">
                    <h3><i class="fas fa-robot"></i> Usar ChatGPT para converter PDF/imagem</h3>
                    <p>Se sua faculdade só disponibiliza a grade em PDF ou imagem, envie o arquivo ao ChatGPT e peça um JSON no formato certo do site.</p>
                    <div class="setup-import-actions compact">
                        <button type="button" class="btn-secondary" id="btn-setup-chatgpt-helper"><i class="fas fa-magic"></i> Ver instruções para o ChatGPT</button>
                        <button type="button" class="btn-secondary" id="btn-setup-copy-chatgpt-prompt"><i class="fas fa-copy"></i> Copiar prompt</button>
                        <button type="button" class="btn-primary" id="btn-setup-import-json"><i class="fas fa-file-code"></i> Importar JSON do ChatGPT</button>
                    </div>
                    <p class="setup-import-microcopy">Fluxo recomendado: anexar PDF/imagem no ChatGPT → gerar JSON → importar aqui.</p>
                </div>
                <div class="setup-import-textbox">
                    <label for="setup-curriculum-json"><strong>JSON da grade</strong></label>
                    <textarea id="setup-curriculum-json" rows="6" placeholder='Cole aqui o JSON gerado pelo ChatGPT. Ex:
{
  "faculdade": "UFOB",
  "curso": "Engenharia Civil",
  "disciplinas": [
    {"nome": "Cálculo I", "semestre": 1, "cargaHoraria": 60, "creditos": 4, "prerequisitos": []}
  ]
}'></textarea>
                    <div class="setup-import-actions compact">
                        <button type="button" class="btn-secondary" id="btn-processar-grade-json"><i class="fas fa-code"></i> Ler JSON e montar grade</button>
                    </div>
                    <div id="setup-json-import-feedback" class="setup-import-feedback"></div>
                </div>
            </div>
            <div class="setup-import-textbox">
                <label for="setup-curriculum-text"><strong>Ou cole a grade em texto</strong></label>
                <textarea id="setup-curriculum-text" rows="6" placeholder="Cole aqui o texto copiado do PDF/site, com semestres e disciplinas. Ex:
1º semestre
Cálculo I - 60h
Geometria Analítica - 90h

2º semestre
Física I - 60h"></textarea>
                <div class="setup-import-actions compact">
                    <button type="button" class="btn-secondary" id="btn-processar-grade-texto"><i class="fas fa-file-import"></i> Ler texto e montar grade</button>
                </div>
                <div id="setup-text-import-feedback" class="setup-import-feedback"></div>
            </div>
        `;
        const targetSection = form.querySelectorAll('.form-section')[1] || form.firstElementChild;
        targetSection?.insertAdjacentElement('afterend', section);
    }

    const select = document.getElementById('setup-template-id');
    if (select) {
        const baseOptions = this.getCourseTemplateCatalog().map(template => ({
            value: template.id,
            label: `${template.universidade} • ${template.curso}`
        }));
        const extraOptions = Array.isArray(this.setupDynamicCatalogOptions) ? this.setupDynamicCatalogOptions : [];
        const mergedOptions = [];
        const seen = new Set();
        [...baseOptions, ...extraOptions].forEach(option => {
            if (!option?.value || seen.has(option.value)) return;
            seen.add(option.value);
            mergedOptions.push(option);
        });
        const currentValue = select.value || this.pendingSetupTemplateId || '';
        select.innerHTML = '<option value="">Selecionar depois</option>' + mergedOptions.map(option => `
            <option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>
        `).join('');
        if (currentValue && seen.has(currentValue)) select.value = currentValue;
        select.dataset.ready = '1';
    }

    const syncPreview = () => {
        this.pendingSetupTemplateId = document.getElementById('setup-template-id')?.value || '';
        this.getCurriculumTemplatePreviewHtml(this.pendingSetupTemplateId, document.getElementById('semestre')?.value || '');
    };

    document.getElementById('setup-template-id')?.addEventListener('change', syncPreview);
    document.getElementById('semestre')?.addEventListener('change', syncPreview);

    document.getElementById('btn-detectar-template-setup')?.addEventListener('click', () => {
        const selectedTemplateId = document.getElementById('setup-template-id')?.value || this.pendingSetupTemplateId || '';
        const selectedTemplate = this.getCourseTemplateById(selectedTemplateId);
        if (selectedTemplate) {
            this.pendingSetupTemplateId = selectedTemplate.id;
            syncPreview();
            showToast(`Modelo já selecionado: ${selectedTemplate.universidade} • ${selectedTemplate.curso}`, 'success');
            return;
        }

        const universidadeAtual = document.getElementById('universidade')?.value || '';
        const cursoAtual = document.getElementById('curso')?.value || '';
        const match = this.matchTemplateByProfile(universidadeAtual, cursoAtual);
        if (!match) {
            if (Array.isArray(this.pendingSetupImportedCurriculum) && this.pendingSetupImportedCurriculum.length) {
                showToast('Você já tem uma grade importada nesta configuração. Ajuste o semestre ou preencha as matérias agora.', 'info');
                return;
            }
            showToast('Ainda não achei um modelo pronto para esse curso. Você pode colar a grade em texto.', 'warning');
            return;
        }
        const templateSelect = document.getElementById('setup-template-id');
        if (templateSelect) templateSelect.value = match.id;
        this.pendingSetupTemplateId = match.id;
        syncPreview();
        showToast(`Modelo encontrado: ${match.universidade} • ${match.curso}`, 'success');
        return;
    });

    document.getElementById('btn-aplicar-template-setup')?.addEventListener('click', () => {
        const templateId = document.getElementById('setup-template-id')?.value || this.pendingSetupTemplateId || '';
        const template = this.getCourseTemplateById(templateId);
        const semester = String(document.getElementById('semestre')?.value || '').trim();

        if (template) {
            document.getElementById('universidade').value = document.getElementById('universidade').value || template.universidade;
            document.getElementById('curso').value = document.getElementById('curso').value || template.curso;
            const semesterSubjects = this.getTemplateCurrentSemesterSubjects(template, semester);
            this.pendingSetupTemplateId = template.id;
            this.pendingSetupImportedCurriculum = this.buildCurriculumFromTemplate(template);
            syncPreview();
            if (!semesterSubjects.length) {
                showToast('Esse modelo não trouxe matérias para o semestre escolhido. Mesmo assim a grade curricular será salva no fim do setup.', 'info');
                return;
            }
            this.populateSetupSubjects(semesterSubjects);
            showToast(`${semesterSubjects.length} matéria(s) do semestre foram preenchidas.`, 'success');
            return;
        }

        if (Array.isArray(this.pendingSetupImportedCurriculum) && this.pendingSetupImportedCurriculum.length) {
            const semesterSubjects = this.pendingSetupImportedCurriculum
                .filter(item => String(item.semestre || '').trim() === semester)
                .map(item => ({
                    id: generateId(),
                    nome: item.nome,
                    dificuldade: this.extractCourseLevel(item.nome) >= 3 ? 4 : 3,
                    peso: item.tipo === 'obrigatoria' ? 4 : 3,
                    notaDesejada: 7
                }));
            syncPreview();
            if (!semesterSubjects.length) {
                showToast('A grade foi importada, mas não encontrei matérias para o semestre escolhido.', 'info');
                return;
            }
            this.populateSetupSubjects(semesterSubjects);
            showToast(`${semesterSubjects.length} matéria(s) do semestre foram preenchidas com a grade importada.`, 'success');
            return;
        }

        showToast('Selecione um modelo primeiro ou cole a grade em texto.', 'warning');
        return;
    });

    document.getElementById('btn-processar-grade-texto')?.addEventListener('click', () => {
        const raw = document.getElementById('setup-curriculum-text')?.value || '';
        const parsed = this.parseCurriculumText(raw);
        const feedback = document.getElementById('setup-text-import-feedback');
        if (!parsed.length) {
            if (feedback) feedback.textContent = 'Não consegui identificar disciplinas no texto. Tente colar com semestres e uma disciplina por linha.';
            showToast('Não consegui entender a grade colada.', 'warning');
            return;
        }
        this.pendingSetupImportedCurriculum = parsed.map(item => this.normalizeCurriculumItem(item));
        this.pendingSetupTemplateId = 'text-import';
        const semester = document.getElementById('semestre')?.value || '';
        const semesterSubjects = parsed
            .filter(item => String(item.semestre || '') === String(semester || ''))
            .map(item => ({ id: generateId(), nome: item.nome, dificuldade: 3, peso: item.tipo === 'obrigatoria' ? 4 : 3, notaDesejada: 7 }));
        if (semesterSubjects.length) this.populateSetupSubjects(semesterSubjects);
        if (feedback) feedback.textContent = `${parsed.length} componente(s) identificados. ${semesterSubjects.length} matéria(s) do semestre atual foram preenchidas.`;
        showToast('Grade em texto interpretada com sucesso!');
    });

    document.getElementById('btn-processar-grade-json')?.addEventListener('click', () => {
        const raw = document.getElementById('setup-curriculum-json')?.value || '';
        const feedback = document.getElementById('setup-json-import-feedback');
        try {
            const parsed = this.parseCurriculumImportJson(raw);
            if (!parsed.items.length) {
                if (feedback) feedback.textContent = 'O JSON foi lido, mas não encontrei disciplinas em disciplinas/curriculum/items.';
                showToast('JSON sem disciplinas válidas.', 'warning');
                return;
            }
            this.applyImportedSetupCurriculum(parsed, 'json-import');
            if (feedback) feedback.textContent = `${parsed.items.length} componente(s) identificados em ${parsed.meta?.curso || 'seu arquivo'}.`;
            showToast('JSON importado com sucesso!');
        } catch (error) {
            if (feedback) feedback.textContent = error.message || 'JSON inválido.';
            showToast('Não consegui ler esse JSON.', 'warning');
        }
    });

    document.getElementById('btn-setup-chatgpt-helper')?.addEventListener('click', () => this.showChatGPTImportHelper());
    document.getElementById('btn-setup-copy-chatgpt-prompt')?.addEventListener('click', async () => {
        const prompt = this.getChatGPTCurriculumPrompt();
        try {
            await navigator.clipboard.writeText(prompt);
            showToast('Prompt copiado. Agora é só colar no ChatGPT junto com o PDF/imagem.', 'success');
        } catch (error) {
            console.error(error);
            this.showChatGPTImportHelper();
            showToast('Abri as instruções porque não consegui copiar automaticamente.', 'info');
        }
    });
    document.getElementById('btn-setup-import-json')?.addEventListener('click', () => this.ensureSetupImportJsonInput().click());

    syncPreview();
};

StudyLifeControl.prototype.parseCurriculumText = function(rawText = '') {
    const lines = String(rawText || '')
        .split(/\r?\n/)
        .map(line => line.replace(/[•▪●◦►]/g, ' ').trim())
        .filter(Boolean);
    if (!lines.length) return [];

    let currentSemester = '';
    const result = [];

    lines.forEach(line => {
        const semesterMatch = line.match(/(?:^|\b)(\d{1,2})\s*(?:º|o)?\s*sem(?:estre)?\b/i) || line.match(/sem(?:estre)?\s*(\d{1,2})/i);
        if (semesterMatch) {
            currentSemester = semesterMatch[1];
            return;
        }

        if (/^(obrigat[oó]rias?|optativas?|eletivas?|extens[aã]o|atividades? complementares?)$/i.test(line)) return;

        const cargaMatch = line.match(/(\d{2,3})\s*h\b/i);
        const codigoMatch = line.match(/\b([A-Z]{2,}\d{0,4})\b/);
        const tipo = /optativa|eletiva/i.test(line) ? 'optativa' : /extens[aã]o/i.test(line) ? 'extensao' : /atividade complementar/i.test(line) ? 'atividade-complementar' : 'obrigatoria';
        let nome = line
            .replace(/^(\d+[\.)-]\s*)/, '')
            .replace(/\b(\d{2,3})\s*h\b/ig, '')
            .replace(/\b(CH|CARGA HOR[ÁA]RIA)\b[:\s-]*/ig, '')
            .replace(/\b([A-Z]{2,}\d{0,4})\b/g, '')
            .replace(/[-–—|]+/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim();
        if (!nome || nome.length < 4) return;
        result.push(this.normalizeCurriculumItem({
            id: generateId(),
            nome,
            codigo: codigoMatch ? codigoMatch[1] : '',
            semestre: currentSemester || '',
            cargaHoraria: cargaMatch ? parseInt(cargaMatch[1], 10) : 0,
            creditos: 0,
            tipo,
            prerequisitosLista: [],
            status: 'nao-cursada',
            observacoes: ''
        }));
    });

    const unique = new Map();
    result.forEach(item => {
        const key = `${this.slugifyName(item.nome)}::${item.semestre}`;
        if (!unique.has(key)) unique.set(key, item);
    });
    return [...unique.values()];
};

StudyLifeControl.prototype.mergeCurriculumItems = function(baseItems = [], incomingItems = []) {
    const merged = [...baseItems.map(item => this.normalizeCurriculumItem(item))];
    const map = new Map(merged.map(item => [this.slugifyName(item.nome), item]));
    let added = 0;
    incomingItems.forEach(item => {
        const normalized = this.normalizeCurriculumItem(item);
        const key = this.slugifyName(normalized.nome);
        if (map.has(key)) {
            const target = map.get(key);
            target.semestre = target.semestre || normalized.semestre;
            target.cargaHoraria = Number(target.cargaHoraria) || Number(normalized.cargaHoraria) || 0;
            target.creditos = Number(target.creditos) || Number(normalized.creditos) || 0;
            target.codigo = target.codigo || normalized.codigo;
            target.tipo = target.tipo || normalized.tipo;
            const prereqs = [...new Set([...(target.prerequisitosLista || []), ...(normalized.prerequisitosLista || [])])];
            target.prerequisitosLista = prereqs;
            target.prerequisitos = prereqs.join(' | ');
        } else {
            merged.push(normalized);
            map.set(key, normalized);
            added += 1;
        }
    });
    return { merged, added };
};

StudyLifeControl.prototype.applyCurriculumImport = async function(items = [], mode = 'merge') {
    const incoming = (items || []).map(item => this.normalizeCurriculumItem(item));
    if (!incoming.length) {
        showToast('Nada para importar na grade curricular.', 'warning');
        return false;
    }
    this.normalizeCurriculumInMemory();
    const nextCurriculum = mode === 'replace'
        ? incoming
        : this.mergeCurriculumItems(this.data.curriculum || [], incoming).merged;
    this.data.curriculum = nextCurriculum;
    const success = await dbService.saveData('curriculum', this.data.curriculum);
    if (success) this.loadView('grade-curricular');
    return success;
};

StudyLifeControl.prototype.showCurriculumImportWizard = function() {
    const existing = document.getElementById('curriculum-import-overlay');
    existing?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'curriculum-import-overlay';
    overlay.className = 'slc-overlay';
    const options = this.getCourseTemplateCatalog().map(template => `<option value="${escapeHtml(template.id)}">${escapeHtml(template.universidade)} • ${escapeHtml(template.curso)}</option>`).join('');
    overlay.innerHTML = `
        <div class="slc-overlay-card">
            <div class="slc-overlay-header">
                <div>
                    <h3><i class="fas fa-file-import"></i> Importar grade curricular</h3>
                    <p>Escolha um modelo pronto ou cole o texto copiado do PDF/site da faculdade.</p>
                </div>
                <button type="button" class="icon-btn" id="close-curriculum-import">×</button>
            </div>
            <div class="slc-overlay-body">
                <div class="form-group">
                    <label>Modelo pronto</label>
                    <select id="curriculum-import-template">
                        <option value="">Selecionar modelo</option>
                        ${options}
                    </select>
                </div>
                <div class="form-group">
                    <label>Modo de importação</label>
                    <select id="curriculum-import-mode">
                        <option value="merge">Somar ao que já existe</option>
                        <option value="replace">Substituir grade atual</option>
                    </select>
                </div>
                <div class="slc-overlay-actions">
                    <button type="button" class="btn-secondary" id="btn-curriculum-detect-profile"><i class="fas fa-bullseye"></i> Detectar pelo meu perfil</button>
                    <button type="button" class="btn-primary" id="btn-curriculum-import-template"><i class="fas fa-layer-group"></i> Importar modelo</button>
                </div>
                <div class="form-group">
                    <label>Importação por texto</label>
                    <textarea id="curriculum-import-text" rows="8" placeholder="Cole aqui a matriz curricular copiada do PDF/site."></textarea>
                </div>
                <div class="slc-overlay-actions">
                    <button type="button" class="btn-secondary" id="btn-curriculum-import-text"><i class="fas fa-wand-magic-sparkles"></i> Ler texto e importar</button>
                </div>
                <div id="curriculum-import-feedback" class="setup-import-feedback"></div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('#close-curriculum-import')?.addEventListener('click', close);
    overlay.addEventListener('click', e => {
        if (e.target === overlay) close();
    });

    overlay.querySelector('#btn-curriculum-detect-profile')?.addEventListener('click', () => {
        const match = this.matchTemplateByProfile(this.data.user?.universidade, this.data.user?.curso);
        if (!match) {
            showToast('Ainda não existe modelo pronto para esse perfil. Use o campo de texto.', 'warning');
            return;
        }
        overlay.querySelector('#curriculum-import-template').value = match.id;
        showToast(`Modelo detectado: ${match.universidade} • ${match.curso}`);
    });

    overlay.querySelector('#btn-curriculum-import-template')?.addEventListener('click', async () => {
        const template = this.getCourseTemplateById(overlay.querySelector('#curriculum-import-template')?.value || '');
        const mode = overlay.querySelector('#curriculum-import-mode')?.value || 'merge';
        if (!template) {
            showToast('Selecione um modelo antes de importar.', 'warning');
            return;
        }
        const success = await this.applyCurriculumImport(this.buildCurriculumFromTemplate(template), mode);
        if (success) {
            if (!this.data.settings) this.data.settings = {};
            this.data.settings.lastCurriculumTemplate = template.id;
            await dbService.saveData('settings', this.data.settings);
            showToast('Grade importada com sucesso!');
            close();
        }
    });

    overlay.querySelector('#btn-curriculum-import-text')?.addEventListener('click', async () => {
        const raw = overlay.querySelector('#curriculum-import-text')?.value || '';
        const parsed = this.parseCurriculumText(raw);
        const feedback = overlay.querySelector('#curriculum-import-feedback');
        if (!parsed.length) {
            if (feedback) feedback.textContent = 'Não consegui entender a estrutura da grade colada.';
            showToast('Não consegui entender o texto da grade.', 'warning');
            return;
        }
        const mode = overlay.querySelector('#curriculum-import-mode')?.value || 'merge';
        const success = await this.applyCurriculumImport(parsed, mode);
        if (success) {
            if (feedback) feedback.textContent = `${parsed.length} componente(s) importados pela leitura do texto.`;
            showToast('Grade importada a partir do texto!');
            close();
        }
    });
};

StudyLifeControl.prototype.ensureBackupImportInput = function() {
    let input = document.getElementById('backup-import-input');
    if (input) return input;
    input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.id = 'backup-import-input';
    input.style.display = 'none';
    input.addEventListener('change', async e => {
        const file = e.target.files?.[0];
        if (!file) return;
        await this.importarDadosDeArquivo(file);
        input.value = '';
    });
    document.body.appendChild(input);
    return input;
};

StudyLifeControl.prototype.importarDadosDeArquivo = async function(file) {
    const raw = await file.text();
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        showToast('Arquivo JSON inválido.', 'error');
        return false;
    }
    const nextData = { ...DEFAULT_APP_DATA(), ...parsed, settings: { ...DEFAULT_APP_DATA().settings, ...(parsed.settings || {}) } };
    this.data = nextData;
    this.normalizeCurriculumInMemory();
    const success = await dbService.saveAllData(this.data);
    if (success) {
        this.updateSidebarInfo();
        this.loadView(this.currentView || 'dashboard');
        showToast('Backup importado com sucesso!');
    }
    return success;
};

StudyLifeControl.prototype.criarDadosDemo = function() {
    const demo = DEFAULT_APP_DATA();
    demo.user = {
        nome: 'Aluno Demo',
        curso: 'Engenharia Civil',
        universidade: 'UFOB',
        semestre: '1',
        turnoPrincipal: 'noite',
        diasPreferidos: ['seg', 'ter', 'qua', 'qui', 'sex'],
        horasMaximas: 4,
        horarioSono: '23:30 - 07:00',
        tempoDeslocamento: 25,
        tipoRotina: 'so-estuda',
        nivelDisciplina: 'medio',
        dificuldadeAtual: 'organizacao',
        createdAt: new Date().toISOString(),
        streak: 5,
        lastStudyDate: toDateString(new Date())
    };
    demo.subjects = [
        { id: generateId(), nome: 'Cálculo Diferencial I', dificuldade: 5, peso: 5, notaDesejada: 8 },
        { id: generateId(), nome: 'Geometria Analítica', dificuldade: 4, peso: 4, notaDesejada: 7.5 },
        { id: generateId(), nome: 'Introdução ao Desenho Técnico', dificuldade: 3, peso: 4, notaDesejada: 7 }
    ];
    const hoje = new Date();
    const amanha = new Date(hoje); amanha.setDate(hoje.getDate() + 1);
    const daqui3 = new Date(hoje); daqui3.setDate(hoje.getDate() + 3);
    demo.tasks = [
        { id: generateId(), titulo: 'Lista 1 de limites', materia: 'Cálculo Diferencial I', prioridade: 'alta', dataLimite: toDateString(amanha), estimativa: 90, concluida: false },
        { id: generateId(), titulo: 'Resumo de vetores', materia: 'Geometria Analítica', prioridade: 'media', dataLimite: toDateString(daqui3), estimativa: 60, concluida: false }
    ];
    demo.exams = [
        { id: generateId(), titulo: 'Prova 1', materia: 'Cálculo Diferencial I', tipo: 'prova', data: toDateString(daqui3), peso: 30, importancia: 'alta' }
    ];
    demo.sessions = [
        { id: generateId(), materia: 'Cálculo Diferencial I', tipo: 'exercicios', duracao: 50, data: toDateString(hoje), topico: 'Limites', concluida: true },
        { id: generateId(), materia: 'Geometria Analítica', tipo: 'teoria', duracao: 45, data: toDateString(amanha), topico: 'Vetores', concluida: false }
    ];
    demo.curriculum = this.buildCurriculumFromTemplate(this.getCourseTemplateById('ufob-engenharia-civil'));
    demo.materials = [
        { id: generateId(), titulo: 'Playlist de Limites', materia: 'Cálculo Diferencial I', tipo: 'vídeo', conteudo: 'https://youtube.com/', criadoEm: new Date().toISOString() }
    ];
    demo.settings.lastCurriculumTemplate = 'ufob-engenharia-civil';
    return demo;
};

StudyLifeControl.prototype.carregarDemoPublica = async function() {
    if (!confirm('Isso vai substituir os dados atuais pela demonstração. Continuar?')) return false;
    this.data = this.criarDadosDemo();
    const success = await dbService.saveAllData(this.data);
    if (success) {
        await this.ensurePostSetupReady();
        showToast('Demo carregada!');
    }
    return success;
};


StudyLifeControl.prototype.ensurePostSetupReady = async function() {
    document.getElementById('setup-screen')?.style.setProperty('display', 'none');
    document.getElementById('main-dashboard')?.style.setProperty('display', 'block');

    await this.loadData();

    if (!this.viewRenderer && typeof ViewRenderer !== 'undefined') {
        this.viewRenderer = new ViewRenderer(this);
    }

    if (!this.initialized) {
        this.setupEventListeners();
        this.applyHeavyMode?.();
        this.initialized = true;
    }

    this.updateSidebarInfo();
    this.loadView('dashboard');
    document.dispatchEvent(new Event('app-ready'));
};
StudyLifeControl.prototype.registerSetupDynamicCatalogOption = function(meta = {}) {
    const faculdade = String(meta.faculdade || '').trim();
    const curso = String(meta.curso || '').trim();
    if (!faculdade || !curso) return '';
    const value = `community:${faculdade.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')}:${curso.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')}`;
    if (!Array.isArray(this.setupDynamicCatalogOptions)) this.setupDynamicCatalogOptions = [];
    if (!this.setupDynamicCatalogOptions.some(option => option.value === value)) {
        this.setupDynamicCatalogOptions.push({ value, label: `${faculdade} • ${curso} (comunidade)` });
    }
    const select = document.getElementById('setup-template-id');
    if (select) {
        if (![...select.options].some(option => option.value === value)) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = `${faculdade} • ${curso} (comunidade)`;
            select.appendChild(option);
        }
        select.value = value;
    }
    return value;
};

StudyLifeControl.prototype.applyImportedSetupCurriculum = function(parsed, source = 'json-import') {
    const items = (parsed?.items || []).map(item => this.normalizeCurriculumItem(item)).filter(item => item?.nome);
    if (!items.length) return;
    this.pendingSetupImportedCurriculum = items;
    this.pendingSetupTemplateId = source;
    if (parsed?.meta?.faculdade && parsed?.meta?.curso) {
        this.pendingSetupTemplateId = this.registerSetupDynamicCatalogOption(parsed.meta) || source;
    }

    const universidadeInput = document.getElementById('universidade');
    const cursoInput = document.getElementById('curso');
    if (universidadeInput && !universidadeInput.value && parsed?.meta?.faculdade) universidadeInput.value = parsed.meta.faculdade;
    if (cursoInput && !cursoInput.value && parsed?.meta?.curso) cursoInput.value = parsed.meta.curso;

    if (!this.data) this.data = {};
    if (!Array.isArray(this.data.curriculum)) this.data.curriculum = [];
    const mergeMode = document.getElementById('setup-template-mode')?.value || 'merge';
    this.data.curriculum = mergeMode === 'replace'
        ? items.map(item => this.normalizeCurriculumItem(item))
        : this.mergeCurriculumItems(this.data.curriculum || [], items).merged;
    this.normalizeCurriculumInMemory?.();

    const semester = String(document.getElementById('semestre')?.value || '').trim();
    const semesterSubjects = items.filter(item => String(item.semestre || '').trim() === semester)
        .map(item => ({ id: generateId(), nome: item.nome, dificuldade: 3, peso: item.tipo === 'obrigatoria' ? 4 : 3, notaDesejada: 7 }));
    if (semesterSubjects.length) this.populateSetupSubjects(semesterSubjects);

    const preview = document.getElementById('setup-template-preview');
    if (preview) {
        const totalHoras = items.reduce((acc, item) => acc + (Number(item.cargaHoraria) || 0), 0);
        preview.innerHTML = `
            <div class="setup-import-preview-card">
                <div>
                    <strong>${escapeHtml(parsed?.meta?.faculdade || universidadeInput?.value || 'Faculdade não informada')} • ${escapeHtml(parsed?.meta?.curso || cursoInput?.value || 'Curso não informado')}</strong>
                    <p>${items.length} componentes identificados via ${source === 'json-import' ? 'JSON do ChatGPT' : 'importação'} e ${semesterSubjects.length} matéria(s) encontradas para o semestre atual.</p>
                </div>
                <div class="setup-import-kpis">
                    <span><strong>${totalHoras}h</strong><small>carga total</small></span>
                    <span><strong>${semesterSubjects.length}</strong><small>matérias do semestre</small></span>
                </div>
            </div>
            <div class="setup-import-subject-tags">${items.slice(0, 8).map(item => `<span class="chip">${escapeHtml(item.nome)}</span>`).join('')}</div>`;
    }

    if (source === 'json-import' && auth?.currentUser && window.dbService?.saveData) {
        dbService.saveData('curriculum', this.data.curriculum).catch(() => {});
    }
};

StudyLifeControl.prototype.parseCurriculumImportJson = function(raw = '') {
    let data;
    try { data = typeof raw === 'string' ? JSON.parse(raw) : raw; }
    catch (error) { throw new Error('O arquivo não está em JSON válido.'); }
    if (!data || typeof data !== 'object') throw new Error('JSON inválido.');
    const sourceItems = Array.isArray(data.disciplinas) ? data.disciplinas : Array.isArray(data.curriculum) ? data.curriculum : Array.isArray(data.items) ? data.items : [];
    const items = sourceItems.map((item, index) => ({
        id: generateId(),
        nome: item.nome || item.name || item.disciplina || item.componente || `Disciplina ${index + 1}`,
        codigo: item.codigo || item.code || '',
        semestre: item.semestre || item.semester || item.periodo || '',
        cargaHoraria: Number(item.cargaHoraria || item.carga_horaria || item.ch || item.hours || 0) || 0,
        creditos: Number(item.creditos || item.credits || 0) || 0,
        prerequisitos: Array.isArray(item.prerequisitos) ? item.prerequisitos : Array.isArray(item.prerequisites) ? item.prerequisites : (item.prerequisitos ? [item.prerequisitos] : []),
        tipo: item.tipo || item.type || 'obrigatoria',
        status: item.status || 'nao-cursada'
    }));
    return { meta: { faculdade: data.faculdade || data.universidade || data.faculty || '', curso: data.curso || data.course || '', versao: data.versao || data.version || '' }, items };
};

StudyLifeControl.prototype.getChatGPTCurriculumPrompt = function() {
    return `Leia o arquivo da grade curricular/fluxograma que vou anexar e devolva SOMENTE um JSON válido, sem texto antes ou depois.

Formato obrigatório:
{
  "faculdade": "Nome da faculdade",
  "curso": "Nome do curso",
  "versao": "Opcional",
  "disciplinas": [
    {
      "nome": "Nome da disciplina",
      "codigo": "Opcional",
      "semestre": 1,
      "cargaHoraria": 60,
      "creditos": 4,
      "prerequisitos": ["Disciplina anterior"],
      "tipo": "obrigatoria"
    }
  ]
}

Regras:
- Retorne apenas JSON puro.
- Use a chave "disciplinas".
- Em "semestre", use número quando estiver claro.
- Em "cargaHoraria" e "creditos", use número sem texto.
- Em "prerequisitos", use lista de nomes das disciplinas.
- Se algum dado não aparecer, use string vazia ou 0.
- Não invente disciplinas que não existirem no arquivo.
- Se houver disciplinas optativas/eletivas, em "tipo" use "optativa".

me entregue em arquivo .json`;
};

StudyLifeControl.prototype.showChatGPTImportHelper = function() {
    const existing = document.getElementById('setup-chatgpt-import-modal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'setup-chatgpt-import-modal';
    modal.className = 'setup-chatgpt-modal';
    modal.innerHTML = `
        <div class="setup-chatgpt-dialog">
            <button type="button" class="setup-chatgpt-close" aria-label="Fechar">&times;</button>
            <h3><i class="fas fa-robot"></i> Como usar o ChatGPT para importar sua grade</h3>
            <ol>
                <li>Abra o ChatGPT e envie o PDF ou imagem do seu fluxograma.</li>
                <li>Cole o prompt abaixo e peça para ele responder apenas com JSON.</li>
                <li>Salve a resposta em um arquivo <strong>.json</strong> ou cole no campo JSON desta tela.</li>
                <li>Use o botão <strong>Importar JSON do ChatGPT</strong> aqui no site.</li>
            </ol>
            <label><strong>Prompt pronto</strong></label>
            <textarea readonly>${this.getChatGPTCurriculumPrompt()}</textarea>
            <div class="setup-import-actions compact">
                <button type="button" class="btn-secondary" id="setup-chatgpt-copy-inline"><i class="fas fa-copy"></i> Copiar prompt</button>
                <button type="button" class="btn-primary" id="setup-chatgpt-import-inline"><i class="fas fa-file-code"></i> Importar JSON agora</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.setup-chatgpt-close')?.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    modal.querySelector('#setup-chatgpt-copy-inline')?.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(this.getChatGPTCurriculumPrompt()); showToast('Prompt copiado!', 'success'); }
        catch (error) { showToast('Não consegui copiar automaticamente.', 'warning'); }
    });
    modal.querySelector('#setup-chatgpt-import-inline')?.addEventListener('click', () => { close(); this.ensureSetupImportJsonInput().click(); });
};

StudyLifeControl.prototype.ensureSetupImportJsonInput = function() {
    let input = document.getElementById('setup-import-json-file');
    if (input) return input;
    input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json,text/json';
    input.id = 'setup-import-json-file';
    input.style.display = 'none';
    input.addEventListener('change', async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const parsed = this.parseCurriculumImportJson(text);
            this.applyImportedSetupCurriculum(parsed, 'json-import');
            const jsonField = document.getElementById('setup-curriculum-json');
            if (jsonField) jsonField.value = text;
            const feedback = document.getElementById('setup-json-import-feedback');
            if (feedback) feedback.textContent = `${parsed.items.length} componente(s) importados do arquivo ${file.name}.`;
            showToast('Arquivo JSON importado com sucesso!', 'success');
        } catch (error) {
            console.error(error);
            showToast(error.message || 'Não consegui importar esse arquivo JSON.', 'warning');
        } finally {
            event.target.value = '';
        }
    });
    document.body.appendChild(input);
    return input;
};

(() => {
    const originalRenderSetupForm = StudyLifeControl.prototype.renderSetupForm;
    StudyLifeControl.prototype.renderSetupForm = function(...args) {
        const response = originalRenderSetupForm ? originalRenderSetupForm.apply(this, args) : undefined;
        this.renderSetupSmartImporter();
        return response;
    };

    const originalHandleSetupSubmit = StudyLifeControl.prototype.handleSetupSubmit;
    StudyLifeControl.prototype.handleSetupSubmit = async function(e) {
        const selectedTemplateId = document.getElementById('setup-template-id')?.value || this.pendingSetupTemplateId || '';
        const importMode = document.getElementById('setup-template-mode')?.value || 'merge';
        if (!this.data.settings) this.data.settings = {};
        if (selectedTemplateId && selectedTemplateId !== 'text-import' && selectedTemplateId !== 'json-import') {
            this.data.settings.lastCurriculumTemplate = selectedTemplateId;
            const template = this.getCourseTemplateById(selectedTemplateId);
            if (template) {
                const imported = this.buildCurriculumFromTemplate(template);
                this.data.curriculum = importMode === 'replace'
                    ? imported
                    : this.mergeCurriculumItems(this.data.curriculum || [], imported).merged;
            }
        } else if (Array.isArray(this.pendingSetupImportedCurriculum) && this.pendingSetupImportedCurriculum.length) {
            this.data.curriculum = importMode === 'replace'
                ? this.pendingSetupImportedCurriculum.map(item => this.normalizeCurriculumItem(item))
                : this.mergeCurriculumItems(this.data.curriculum || [], this.pendingSetupImportedCurriculum).merged;
        }
        const response = await originalHandleSetupSubmit.call(this, e);
        if (Array.isArray(this.data.curriculum) && this.data.curriculum.length) {
            await dbService.saveData('curriculum', this.data.curriculum);
        }
        return response;
    };

    const originalSetupViewEvents = StudyLifeControl.prototype.setupViewEvents;
    StudyLifeControl.prototype.setupViewEvents = function(view, ...rest) {
        const result = originalSetupViewEvents ? originalSetupViewEvents.call(this, view, ...rest) : undefined;
        if (view === 'grade-curricular') {
            document.getElementById('btn-importar-ufob')?.addEventListener('click', () => this.showCurriculumImportWizard());
        }
        if (view === 'configuracoes') {
            document.getElementById('importar-dados')?.addEventListener('click', () => this.ensureBackupImportInput().click());
            document.getElementById('carregar-demo-publica')?.addEventListener('click', () => this.carregarDemoPublica());
        }
        return result;
    };
})();
