// subjects-curriculum-sync.js
//
// Problema que este arquivo resolve:
// A aba "Matérias" e todos os seletores de disciplina do site (Grade Horária,
// Sessões, Tarefas, Provas, Tópicos, Notas, Materiais) leem de
// `app.data.subjects` — uma lista separada de `app.data.curriculum`
// (a Grade Curricular / Plano de Estudos).
//
// Quando o usuário finaliza um semestre, ou usa "Editar Semestre Atual"
// (adicionar/trancar/remover matéria), ou edita o status de uma disciplina
// direto na Grade Curricular, apenas `app.data.curriculum` era atualizado.
// `app.data.subjects` ficava parado, então a aba Matérias e o formulário de
// Grade Horária continuavam mostrando as disciplinas do semestre anterior.
//
// Este arquivo centraliza a sincronização: sempre que a Grade Curricular
// mudar quais disciplinas estão "cursando", `app.data.subjects` é
// recalculado automaticamente a partir dela, salvo, e todos os seletores
// e a view atual são atualizados — sem precisar mexer manualmente em cada
// aba.
(function () {
    'use strict';

    function slugifyName(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    function makeId() {
        return (typeof window.generateId === 'function')
            ? window.generateId()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }

    let pendingCurriculumSave = false;

    // Recalcula app.data.subjects a partir das disciplinas "cursando" na
    // Grade Curricular. Retorna true se algo mudou.
    function syncSubjectsWithCurriculum(app) {
        if (!app || !app.data) return false;
        const curriculum = Array.isArray(app.data.curriculum) ? app.data.curriculum : [];
        if (!Array.isArray(app.data.subjects)) app.data.subjects = [];

        // Todas as disciplinas que a Grade Curricular conhece (para não mexer
        // em matérias criadas manualmente, fora da Grade Curricular).
        const curriculumByName = new Map();
        curriculum.forEach(item => {
            const key = slugifyName(item.nome);
            if (key) curriculumByName.set(key, item);
        });

        // Armadilha da "não cursada": quem cadastra a matéria na aba Matérias
        // (wizard, importação por IA, cadastro manual) enquanto o currículo
        // ainda a marca como "não cursada" tinha a matéria RECOLHIDA da aba
        // na primeira sincronização — e ela sumia do site inteiro. O cadastro
        // da matéria É a declaração de que ela está em curso agora, então
        // promovemos 'nao-cursada' → 'cursando'. Status já decididos
        // (aprovada, reprovada, trancada) nunca são alterados por aqui.
        pendingCurriculumSave = false;
        app.data.subjects.forEach(subject => {
            const item = curriculumByName.get(slugifyName(subject.nome));
            if (item && item.status === 'nao-cursada') {
                item.status = 'cursando';
                pendingCurriculumSave = true;
            }
        });

        const cursando = curriculum.filter(item => item.status === 'cursando');
        const cursandoNames = new Set(cursando.map(item => slugifyName(item.nome)));

        let changed = false;

        // Remove da aba "Matérias" disciplinas que a Grade Curricular
        // controla mas que não estão mais "Cursando" (aprovada, reprovada,
        // trancada ou removida do semestre atual).
        const kept = app.data.subjects.filter(subject => {
            const key = slugifyName(subject.nome);
            const controladaPelaGrade = curriculumByName.has(key);
            const estaCursando = cursandoNames.has(key);
            if (controladaPelaGrade && !estaCursando) {
                changed = true;
                return false;
            }
            return true;
        });

        // Adiciona disciplinas "Cursando" que ainda não estão na aba "Matérias"
        const existingNames = new Set(kept.map(s => slugifyName(s.nome)));
        cursando.forEach(item => {
            const key = slugifyName(item.nome);
            if (!key || existingNames.has(key)) return;
            kept.push({
                id: makeId(),
                nome: item.nome,
                dificuldade: 3,
                peso: item.tipo === 'optativa' ? 3 : 4,
                notaDesejada: 7
            });
            existingNames.add(key);
            changed = true;
        });

        if (changed) app.data.subjects = kept;
        return changed;
    }

    // Sincroniza, salva (se mudou) e atualiza tudo que depende da lista de
    // matérias: os <select> de disciplina abertos em qualquer modal e,
    // se a view atual for uma das afetadas, recarrega a view.
    async function syncAndRefresh(app, options) {
        const opts = options || {};
        const reload = opts.reload !== false;
        if (!app) return false;

        const changed = syncSubjectsWithCurriculum(app);
        const curriculumPromoted = pendingCurriculumSave;
        if (!changed && !curriculumPromoted) return false;

        try {
            if (window.dbService && typeof window.dbService.saveData === 'function') {
                if (pendingCurriculumSave) {
                    pendingCurriculumSave = false;
                    await window.dbService.saveData('curriculum', app.data.curriculum);
                }
                if (changed) await window.dbService.saveData('subjects', app.data.subjects);
            }
        } catch (error) {
            console.warn('Não foi possível salvar a sincronização automática de matérias.', error);
        }

        if (typeof app.populateSubjectSelects === 'function') {
            try { app.populateSubjectSelects(); } catch (error) { /* nenhum modal aberto, tudo bem */ }
        }

        if (reload && typeof app.loadView === 'function') {
            const viewsAfetadas = ['materias', 'grade-horaria', 'dashboard', 'sessoes', 'tarefas', 'provas', 'mapa-aprendizado', 'materiais', 'previsao-notas'];
            if (viewsAfetadas.includes(app.currentView)) app.loadView(app.currentView);
            else if (curriculumPromoted && app.currentView === 'grade-curricular') app.loadView(app.currentView);
        }

        return true;
    }

    function wrapAsyncMethod(proto, name) {
        const original = proto[name];
        const flag = `__subjSync_${name}`;
        if (typeof original !== 'function' || proto[flag]) return;
        proto[flag] = true;
        proto[name] = async function (...args) {
            const result = await original.apply(this, args);
            await syncAndRefresh(this);
            return result;
        };
    }

    function patch() {
        if (!window.StudyLifeControl || window.StudyLifeControl.prototype.__subjectsCurriculumSyncPatched) return;
        const proto = window.StudyLifeControl.prototype;
        proto.__subjectsCurriculumSyncPatched = true;

        proto.syncSubjectsWithCurriculum = function () {
            return syncSubjectsWithCurriculum(this);
        };
        proto.syncSubjectsWithCurriculumAndRefresh = function (options) {
            return syncAndRefresh(this, options);
        };

        // Pontos onde o status "cursando" de uma disciplina pode mudar
        // diretamente pelo formulário/modal da Grade Curricular.
        wrapAsyncMethod(proto, 'salvarCurriculumEditado');
        wrapAsyncMethod(proto, 'salvarNovoCurriculum');
        wrapAsyncMethod(proto, 'applyCurriculumImport');
        wrapAsyncMethod(proto, 'importarGradeUfob');

        // Reparo na abertura: contas que já foram pegas pela armadilha da
        // "não cursada" (matéria cadastrada, currículo em 'nao-cursada', e a
        // matéria sumindo da aba Matérias) são consertadas uma vez no load,
        // sem depender de o usuário mexer em qualquer formulário.
        document.addEventListener('app-ready', () => {
            setTimeout(() => {
                if (window.app?.data?.curriculum?.length && Array.isArray(window.app.data.subjects)) {
                    syncAndRefresh(window.app, { reload: false }).catch(() => {});
                }
            }, 1200);
        });
    }

    // Clique em "Marcar como cursando" nos banners de matérias arquivadas
    // (Provas, Calendário, Previsão de Notas) — devolve a matéria para o
    // semestre atual em 1 clique.
    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-subj-sync-cursando]');
        if (!btn || !window.app?.data?.curriculum) return;
        const nome = btn.getAttribute('data-subj-sync-cursando');
        const item = window.app.data.curriculum.find(c => slugifyName(c.nome) === slugifyName(nome));
        if (!item) return;
        item.status = 'cursando';
        btn.disabled = true;
        try {
            if (window.dbService?.saveData) await window.dbService.saveData('curriculum', window.app.data.curriculum);
            await syncAndRefresh(window.app);
            if (window.app.currentView) window.app.loadView(window.app.currentView);
            window.showToast?.(`${item.nome} voltou para "cursando".`, 'success');
        } catch (_) {
            btn.disabled = false;
            window.showToast?.('Não consegui devolver a matéria. Tente novamente.', 'error');
        }
    });

    document.addEventListener('DOMContentLoaded', patch);
    if (document.readyState !== 'loading') patch();

    // Exposto globalmente para "Finalizar Semestre" e "Editar Semestre Atual"
    // (semester-finish.js), que mudam o status "cursando" fora dos métodos
    // acima.
    window.syncSubjectsWithCurriculumAndRefresh = function (app, options) {
        return syncAndRefresh(app, options);
    };
})();
