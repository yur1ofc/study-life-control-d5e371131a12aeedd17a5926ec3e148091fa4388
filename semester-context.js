// semester-context.js
// Contexto isolado para consultar e editar um semestre já finalizado.
// O semestre atual nunca é substituído no Firestore por engano: ao entrar no
// histórico, somente as coleções acadêmicas são carregadas do snapshot; cada
// save é redirecionado para archivedSemesters[index]. Ao sair, os dados atuais
// são restaurados em memória e a interface volta ao ponto anterior.
(function () {
    'use strict';

    const SEMESTER_FIELDS = [
        'subjects', 'curriculum', 'sessions', 'tasks', 'exams', 'materials',
        'learningMap', 'grades', 'classDiaries', 'reviews', 'classSchedule', 'attendance'
    ];

    const CLONE = value => {
        try { return JSON.parse(JSON.stringify(value)); }
        catch (_) { return value; }
    };

    const slug = value => String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

    function esc(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function getArchive(app, index) {
        const archives = Array.isArray(app?.data?.archivedSemesters)
            ? app.data.archivedSemesters
            : [];
        return archives[index] || null;
    }

    function buildSubjects(archive) {
        if (Array.isArray(archive?.subjects) && archive.subjects.length) return CLONE(archive.subjects);
        const names = Array.isArray(archive?.materias) ? archive.materias : [];
        return names.map((nome, i) => ({
            id: `historical-subject-${i}-${slug(nome).replace(/ /g, '-')}`,
            nome,
            dificuldade: 3,
            peso: 4,
            notaDesejada: 7
        }));
    }

    function buildCurriculum(archive) {
        if (Array.isArray(archive?.curriculum) && archive.curriculum.length) return CLONE(archive.curriculum);
        const names = Array.isArray(archive?.materias) ? archive.materias : [];
        const semestre = String(archive?.semestre || '').trim();
        return names.map((nome, i) => ({
            id: `historical-curriculum-${i}-${slug(nome).replace(/ /g, '-')}`,
            nome,
            semestre,
            status: 'cursando',
            tipo: 'obrigatoria',
            cargaHoraria: 0,
            creditos: 0,
            prerequisitosLista: [],
            prerequisitos: ''
        }));
    }

    function syncArchiveAliases(ctx, workspace) {
        const archive = ctx.liveData.archivedSemesters[ctx.index];
        if (!archive) return;

        if (Array.isArray(workspace.subjects)) {
            archive.subjects = CLONE(workspace.subjects);
            archive.materias = workspace.subjects.map(s => s?.nome).filter(Boolean);
        }
        if (Array.isArray(workspace.curriculum)) {
            archive.curriculum = CLONE(workspace.curriculum);
            if (!Array.isArray(archive.materias) || !archive.materias.length) {
                archive.materias = workspace.curriculum.map(c => c?.nome).filter(Boolean);
            }
        }

        SEMESTER_FIELDS.forEach(field => {
            if (field === 'subjects' || field === 'curriculum') return;
            if (Object.prototype.hasOwnProperty.call(workspace, field)) {
                archive[field] = CLONE(workspace[field]);
            }
        });
    }

    async function persistArchive(app) {
        const ctx = app?._semesterContext;
        const user = window.auth?.currentUser;
        if (!ctx || ctx.type !== 'archived' || !user) return false;

        syncArchiveAliases(ctx, app.data);
        try {
            await window.db.collection('users').doc(user.uid).set({
                archivedSemesters: ctx.liveData.archivedSemesters
            }, { merge: true });

            // Mantém o fallback local coerente com o estado do servidor. Isso
            // não substitui o Firestore; só evita voltar para um backup antigo
            // quando o usuário estiver temporariamente sem conexão.
            try {
                localStorage.setItem(`slc-backup:${user.uid}`, JSON.stringify({
                    savedAt: new Date().toISOString(),
                    data: ctx.liveData
                }));
            } catch (_) {}

            window.updateSyncStatus?.(true);
            if (typeof window.notifyDataSaved === 'function') window.notifyDataSaved(['archivedSemesters']);
            return true;
        } catch (error) {
            console.error('[SLC] Erro ao salvar semestre histórico:', error);
            window.updateSyncStatus?.(false);
            window.showToast?.('Não foi possível salvar a alteração no histórico.', 'error');
            return false;
        }
    }

    function renderSwitcher(app) {
        const host = document.getElementById('semester-context-switcher');
        if (!host) return;

        const archives = Array.isArray(app?.data?.archivedSemesters)
            ? app.data.archivedSemesters
            : (app?._semesterContext?.liveData?.archivedSemesters || []);
        const ctx = app?._semesterContext;
        const currentSemester = parseInt(app?._semesterContext?.liveData?.user?.semestre || app?.data?.user?.semestre || 0, 10) || 0;

        if (!archives.length && !currentSemester) {
            host.innerHTML = '';
            return;
        }

        const selected = ctx?.type === 'archived' ? `archive:${ctx.index}` : 'current';
        host.innerHTML = `
            <label class="sr-only" for="semester-context-select">Semestre em visualização</label>
            <select id="semester-context-select" class="semester-context-select" title="Escolher semestre para visualizar e editar">
                <option value="current" ${selected === 'current' ? 'selected' : ''}>${currentSemester ? `Atual — ${currentSemester}º semestre` : 'Semestre atual'}</option>
                ${archives.map((archive, index) => {
                    const label = archive?.semestre ? `${archive.semestre}º semestre` : `Semestre arquivado ${index + 1}`;
                    return `<option value="archive:${index}" ${selected === `archive:${index}` ? 'selected' : ''}>Histórico — ${esc(label)}</option>`;
                }).join('')}
            </select>
            ${ctx?.type === 'archived' ? '<span class="semester-context-badge"><i class="fas fa-box-archive"></i> Histórico</span>' : ''}
        `;

        host.querySelector('#semester-context-select')?.addEventListener('change', async event => {
            const value = event.target.value;
            if (value === 'current') {
                await app.exitSemesterContext();
                return;
            }
            const index = Number(value.split(':')[1]);
            if (Number.isInteger(index)) await app.enterSemesterContext(index);
        });
    }

    function renderBanner(app) {
        const container = document.getElementById('view-container');
        if (!container) return;
        container.querySelector('.semester-context-banner')?.remove();
        const ctx = app?._semesterContext;
        if (!ctx || ctx.type !== 'archived') return;

        const label = ctx.label || 'semestre anterior';
        const banner = document.createElement('div');
        banner.className = 'semester-context-banner';
        banner.innerHTML = `
            <div><strong><i class="fas fa-box-archive"></i> Histórico: ${esc(label)}</strong> — você pode editar notas, provas, tarefas, sessões, materiais, diário e outros dados deste semestre. O semestre atual permanece separado.</div>
            <button type="button" id="semester-context-back">Voltar ao atual</button>
        `;
        container.prepend(banner);
        banner.querySelector('#semester-context-back')?.addEventListener('click', () => app.exitSemesterContext());
    }

    function refreshAcademicModules(app) {
        window.scheduleManager?.loadAulas?.();
        window.reviewSystem?.loadReviews?.();
        window.dailyLogService?.loadLogs?.();
        window.classDiaryService?.loadDiaries?.();
        window.gradeCalculator?.loadData?.();
        window.aiAssistant?.updateContext?.(app.data);
        app.populateSubjectSelects?.();
    }

    function patchDatabase() {
        if (!window.dbService || window.dbService.__semesterContextPatched) return;
        window.dbService.__semesterContextPatched = true;

        const originalSaveData = window.dbService.saveData.bind(window.dbService);
        const originalSaveAllData = window.dbService.saveAllData.bind(window.dbService);
        const originalClearAllData = window.dbService.clearAllData.bind(window.dbService);

        window.dbService.saveData = async function (field, data) {
            const app = window.app;
            if (app?._semesterContext?.type === 'archived') {
                if (SEMESTER_FIELDS.includes(field)) {
                    app.data[field] = data;
                    return persistArchive(app);
                }
                // O catálogo do histórico não deve substituir o ponteiro
                // `archivedSemesters` inteiro por uma cópia do workspace.
                if (field === 'archivedSemesters') return persistArchive(app);
                // Perfil acadêmico é global à conta; não permita que editar um
                // semestre antigo altere silenciosamente o semestre atual.
                if (field === 'user') {
                    window.showToast?.('O perfil e o semestre atual só podem ser alterados fora do histórico.', 'warning');
                    return false;
                }
            }
            return originalSaveData(field, data);
        };

        window.dbService.saveAllData = async function (dataOverride = null) {
            const app = window.app;
            if (app?._semesterContext?.type === 'archived') {
                if (dataOverride && dataOverride !== app.data) app.data = dataOverride;
                return persistArchive(app);
            }
            return originalSaveAllData(dataOverride);
        };

        window.dbService.clearAllData = async function () {
            if (window.app?._semesterContext?.type === 'archived') {
                window.showToast?.('Saia do histórico antes de usar "Limpar todos os dados".', 'warning');
                return false;
            }
            return originalClearAllData();
        };
    }

    function patchApp() {
        if (!window.StudyLifeControl || window.StudyLifeControl.prototype.__semesterContextPatched) return;
        const proto = window.StudyLifeControl.prototype;
        proto.__semesterContextPatched = true;

        proto.enterSemesterContext = async function (index) {
            const archive = getArchive(this, index);
            if (!archive) {
                window.showToast?.('Esse semestre histórico não foi encontrado.', 'warning');
                return false;
            }

            if (this._semesterContext?.type === 'archived') {
                if (this._semesterContext.index === index) return true;
                await this.exitSemesterContext();
            }

            const liveData = CLONE(this.data);
            const workspace = CLONE(this.data);
            const selectedArchive = CLONE(archive);

            SEMESTER_FIELDS.forEach(field => {
                if (field === 'subjects') workspace[field] = buildSubjects(selectedArchive);
                else if (field === 'curriculum') workspace[field] = buildCurriculum(selectedArchive);
                else workspace[field] = Array.isArray(selectedArchive[field])
                    ? CLONE(selectedArchive[field])
                    : (field === 'attendance' ? {} : []);
            });

            workspace.archivedSemesters = CLONE(liveData.archivedSemesters || []);
            this._semesterContext = {
                type: 'archived',
                index,
                label: selectedArchive.semestre ? `${selectedArchive.semestre}º semestre` : `Semestre arquivado ${index + 1}`,
                liveData,
                previousView: this.currentView,
                previousCurriculumViewState: CLONE(this.curriculumViewState || { startSemester: 'all', visibleCount: 4 })
            };
            this.data = workspace;
            this.curriculumViewState = { startSemester: 'all', visibleCount: 'all' };
            this.normalizeCurriculumInMemory?.();

            renderSwitcher(this);
            refreshAcademicModules(this);
            this.loadView(this.currentView || 'dashboard');
            window.showToast?.(`Visualizando ${this._semesterContext.label}. Alterações ficam no histórico.`, 'info');
            return true;
        };

        proto.exitSemesterContext = async function () {
            const ctx = this._semesterContext;
            if (!ctx || ctx.type !== 'archived') {
                renderSwitcher(this);
                return true;
            }

            // Persiste qualquer alteração pendente antes de restaurar a memória.
            const saved = await persistArchive(this);
            if (!saved) return false;

            this.data = ctx.liveData;
            this.curriculumViewState = ctx.previousCurriculumViewState || { startSemester: 'all', visibleCount: 4 };
            const view = ctx.previousView || 'dashboard';
            this._semesterContext = null;

            renderSwitcher(this);
            refreshAcademicModules(this);
            this.loadView(view);
            window.showToast?.('Semestre atual restaurado. Nenhum dado do histórico foi misturado a ele.', 'success');
            return true;
        };

        // Recarregar do servidor enquanto o histórico está aberto deve primeiro
        // voltar ao contexto atual; caso contrário o snapshot ficaria órfão em
        // memória e a próxima edição poderia ser aplicada no lugar errado.
        const originalLoadData = proto.loadData;
        proto.loadData = async function (...args) {
            if (this._semesterContext?.type === 'archived') {
                const exited = await this.exitSemesterContext();
                if (!exited) return this.data;
            }
            return originalLoadData.apply(this, args);
        };

        // Impede finalização/gestão do semestre atual enquanto o usuário está
        // navegando no histórico. Esses dois fluxos são destrutivos por design.
        const originalLoadView = proto.loadView;
        proto.loadView = function (...args) {
            const result = originalLoadView.apply(this, args);
            renderSwitcher(this);
            setTimeout(() => renderBanner(this), 0);
            return result;
        };
    }

    function init() {
        patchDatabase();
        patchApp();
        if (window.app) renderSwitcher(window.app);
    }

    document.addEventListener('app-ready', init);
    if (document.readyState !== 'loading') setTimeout(init, 0);
    else document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));

    window.slcSemesterContext = { SEMESTER_FIELDS, persistArchive, renderSwitcher };
})();
