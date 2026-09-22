// semester-finish.js - Assistente "Finalizar Semestre" + "Editar Semestre Atual"
// Finalizar Semestre: marcar cada matéria em curso como aprovada, reprovada ou
// trancada, registrar a média final e escolher as matérias do próximo semestre.
// Editar Semestre Atual: a qualquer momento, adicionar, remover ou trancar
// matérias do semestre em andamento (sem precisar finalizar o semestre).
(function () {
    'use strict';

    function slug(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    function injectStyles() {
        if (document.getElementById('semfin-styles')) return;
        const style = document.createElement('style');
        style.id = 'semfin-styles';
        style.textContent = `
            .semfin-overlay{position:fixed;inset:0;background:rgba(2,6,23,.72);display:flex;align-items:center;justify-content:center;z-index:10000;padding:16px;}
            .semfin-modal{width:min(720px,100%);max-height:92vh;overflow:auto;background:var(--bg-secondary,#151f2f);color:var(--text-primary,#f8fafc);border:1px solid var(--border,#2d3a4f);border-radius:24px;box-shadow:var(--card-shadow,0 25px 80px rgba(0,0,0,.5));}
            .semfin-header{padding:20px 22px;border-bottom:1px solid var(--border,#2d3a4f);display:flex;align-items:flex-start;justify-content:space-between;gap:12px;}
            .semfin-header h2{margin:0 0 4px;font-size:1.2rem;color:var(--text-primary,#f8fafc);}
            .semfin-header p{margin:0;color:var(--text-secondary,#94a3b8);font-size:.92rem;}
            .semfin-close{cursor:pointer;font-size:1.4rem;line-height:1;opacity:.6;background:none;border:none;color:var(--text-primary,#f8fafc);}
            .semfin-close:hover{opacity:1;}
            .semfin-body{padding:20px 22px;}
            .semfin-steps{display:flex;gap:8px;margin-bottom:16px;}
            .semfin-step-dot{flex:1;height:6px;border-radius:999px;background:var(--bg-tertiary,#1e2b3a);}
            .semfin-step-dot.active{background:var(--accent-primary,#3b82f6);}
            .semfin-empty{padding:24px;text-align:center;color:var(--text-secondary,#94a3b8);}
            .semfin-row{border:1px solid var(--border,#2d3a4f);border-radius:14px;padding:14px;margin-bottom:12px;background:var(--bg-tertiary,#1e2b3a);}
            .semfin-row-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;}
            .semfin-row-head strong{display:block;font-size:1rem;color:var(--text-primary,#f8fafc);}
            .semfin-row-head small{color:var(--text-secondary,#94a3b8);}
            .semfin-row-remove{background:none;border:none;color:var(--text-tertiary,#64748b);cursor:pointer;font-size:.82rem;text-decoration:underline;white-space:nowrap;}
            .semfin-row-remove:hover{color:var(--accent-danger,#ef4444);}
            .semfin-row-controls{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end;margin-top:10px;}
            .semfin-toggle{display:flex;gap:8px;flex-wrap:wrap;}
            .semfin-pill{border:1px solid var(--border,#2d3a4f);background:transparent;color:var(--text-secondary,#94a3b8);border-radius:999px;padding:8px 14px;font-weight:600;cursor:pointer;font-size:.88rem;}
            .semfin-pill[data-choice="aprovado"].active{background:rgba(16,185,129,.16);border-color:#10b981;color:#34d399;}
            .semfin-pill[data-choice="reprovado"].active{background:rgba(239,68,68,.16);border-color:#ef4444;color:#f87171;}
            .semfin-pill[data-choice="trancado"].active{background:rgba(148,163,184,.2);border-color:#94a3b8;color:#cbd5e1;}
            .semfin-nota-field{display:flex;flex-direction:column;gap:4px;}
            .semfin-nota-field label{font-size:.82rem;font-weight:600;color:var(--text-secondary,#94a3b8);}
            .semfin-nota-field input{width:100px;border:1px solid var(--border,#2d3a4f);border-radius:10px;padding:8px 10px;font:inherit;background:var(--bg-primary,#0a0f1f);color:var(--text-primary,#f8fafc);}
            .semfin-nota-field input:disabled{opacity:.4;}
            .semfin-nota-field input.semfin-invalid{border-color:#ef4444;}
            .semfin-candidate{display:flex;align-items:flex-start;gap:12px;border:1px solid var(--border,#2d3a4f);background:var(--bg-tertiary,#1e2b3a);border-radius:14px;padding:12px 14px;margin-bottom:10px;}
            .semfin-candidate.blocked{opacity:.5;}
            .semfin-candidate input[type="checkbox"]{margin-top:4px;width:18px;height:18px;}
            .semfin-candidate-info{flex:1;}
            .semfin-candidate-info strong{display:block;color:var(--text-primary,#f8fafc);}
            .semfin-candidate-info small{color:var(--text-secondary,#94a3b8);display:block;margin-top:2px;}
            .semfin-tag{display:inline-block;font-size:.72rem;font-weight:700;padding:2px 8px;border-radius:999px;margin-top:6px;margin-right:6px;}
            .semfin-tag.recomendada{background:rgba(59,130,246,.16);color:#93c5fd;}
            .semfin-tag.repescagem{background:rgba(239,68,68,.16);color:#f87171;}
            .semfin-tag.trancada{background:rgba(148,163,184,.2);color:#cbd5e1;}
            .semfin-tag.bloqueada{background:rgba(148,163,184,.16);color:#94a3b8;}
            .semfin-group-title{font-weight:700;margin:16px 0 8px;color:var(--text-secondary,#94a3b8);}
            .semfin-summary{background:var(--bg-tertiary,#1e2b3a);border:1px solid var(--border,#2d3a4f);border-radius:14px;padding:14px;margin-bottom:16px;font-size:.92rem;color:var(--text-primary,#f8fafc);}
            .semfin-footer{display:flex;justify-content:space-between;gap:10px;padding:16px 22px 22px;border-top:1px solid var(--border,#2d3a4f);flex-wrap:wrap;}
            .semfin-footer-right{display:flex;gap:10px;flex-wrap:wrap;}
            .semfin-manage-row{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--border,#2d3a4f);background:var(--bg-tertiary,#1e2b3a);border-radius:14px;padding:12px 14px;margin-bottom:10px;}
            .semfin-manage-info strong{display:block;color:var(--text-primary,#f8fafc);}
            .semfin-manage-info small{color:var(--text-secondary,#94a3b8);}
            .semfin-manage-actions{display:flex;gap:8px;flex-wrap:wrap;}
            .semfin-manage-actions button{border-radius:10px;padding:7px 12px;font-size:.82rem;font-weight:600;cursor:pointer;border:1px solid var(--border,#2d3a4f);background:transparent;color:var(--text-primary,#f8fafc);}
            .semfin-manage-actions .semfin-btn-lock:hover{border-color:#94a3b8;color:#cbd5e1;}
            .semfin-manage-actions .semfin-btn-remove:hover{border-color:#ef4444;color:#f87171;}
            .semfin-add-row{display:flex;gap:10px;align-items:center;margin-top:6px;flex-wrap:wrap;}
            .semfin-add-row select{flex:1;min-width:220px;border:1px solid var(--border,#2d3a4f);border-radius:10px;padding:9px 10px;font:inherit;background:var(--bg-primary,#0a0f1f);color:var(--text-primary,#f8fafc);}
        `;
        document.head.appendChild(style);
    }

    // Coleções da conta que guardam itens presos a uma matéria específica
    // (mesmo padrão usado em excluirMateria, no app.js).
    const MATERIA_COLLECTIONS = ['sessions', 'tasks', 'exams', 'learningMap', 'grades', 'materials', 'classDiaries', 'reviews'];

    // Arquiva (não apaga) tudo que pertencia às matérias do semestre que
    // está sendo finalizado: sessões, tarefas, provas, tópicos, notas,
    // materiais, diários de aula, revisões e a grade horária inteira.
    // Fica guardado em app.data.archivedSemesters para histórico, e some
    // das telas ativas do site.
    async function archiveFinishedSemesterData(app, subjectNames, semesterLabel, snapshots = {}) {
        const nameSet = new Set(subjectNames.filter(Boolean).map(n => slug(n)));
        if (!nameSet.size) return { archivedCount: 0, archive: null };

        const archive = {
            semestre: semesterLabel || null,
            finalizadoEm: new Date().toISOString(),
            materias: subjectNames.slice(),
            // Snapshot da grade e das matérias exatamente como estavam antes
            // do fechamento. Isso permite abrir e editar o histórico sem
            // reutilizar a estrutura do semestre atual.
            subjects: Array.isArray(snapshots.subjects) ? snapshots.subjects.map(item => ({ ...item })) : [],
            curriculum: Array.isArray(snapshots.curriculum) ? snapshots.curriculum.map(item => ({ ...item })) : []
        };
        let archivedCount = 0;

        MATERIA_COLLECTIONS.forEach(key => {
            const list = Array.isArray(app.data[key]) ? app.data[key] : [];
            const toKeep = [];
            const toArchive = [];
            list.forEach(item => {
                if (item && nameSet.has(slug(item.materia))) toArchive.push(item);
                else toKeep.push(item);
            });
            if (toArchive.length) {
                archive[key] = toArchive;
                archivedCount += toArchive.length;
                app.data[key] = toKeep;
            }
        });

        // Grade Horária: some inteira, já que o próximo semestre tem um
        // horário novo (mesmo que alguma matéria continue por repescagem,
        // dias/salas/horários costumam mudar de semestre pra semestre).
        const aulas = Array.isArray(app.data.classSchedule) ? app.data.classSchedule : [];
        if (aulas.length) {
            archive.classSchedule = aulas;
            archivedCount += aulas.length;
            app.data.classSchedule = [];

            // Presença fica salva num mapa por aulaId+data — limpa as
            // entradas das aulas que acabaram de ser arquivadas.
            const aulaIds = new Set(aulas.map(a => a.id));
            if (app.data.attendance && typeof app.data.attendance === 'object') {
                const attendanceKept = {};
                Object.entries(app.data.attendance).forEach(([key, value]) => {
                    const aulaId = key.split('_')[0];
                    if (!aulaIds.has(aulaId)) attendanceKept[key] = value;
                });
                app.data.attendance = attendanceKept;
            }
        }

        if (!Array.isArray(app.data.archivedSemesters)) app.data.archivedSemesters = [];
        app.data.archivedSemesters.push(archive);

        // A função agora só monta/muta o estado em memória. O fechamento do
        // semestre faz UM saveAllData no final, evitando o estado parcialmente
        // salvo (currículo novo + histórico antigo, por exemplo) quando uma
        // das escritas anteriores falha.
        return { archivedCount, archive };
    }

    // Depois de finalizar, garante que toda a interface reflete o novo
    // semestre imediatamente: caches internos (grade horária, mentor IA,
    // notificações) e a view que estiver aberta na hora.
    function refreshWholeApp(app) {
        window.scheduleManager?.loadAulas?.();
        window.aiAssistant?.updateContext?.(app.data);
        if (typeof app.populateSubjectSelects === 'function') {
            try { app.populateSubjectSelects(); } catch (error) { /* nenhum modal aberto */ }
        }
        if (typeof window.renderNotifications === 'function') {
            try { window.renderNotifications(); } catch (error) { /* painel pode não existir ainda */ }
        }
    }

    function closeModal() {
        document.getElementById('semfin-overlay')?.remove();
    }

    function ensureOverlay() {
        let overlay = document.getElementById('semfin-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'semfin-overlay';
            overlay.className = 'semfin-overlay';
            overlay.addEventListener('click', e => {
                if (e.target === overlay) closeModal();
            });
            document.body.appendChild(overlay);
        }
        return overlay;
    }

    function stepDots(step) {
        return `
            <div class="semfin-steps">
                <div class="semfin-step-dot ${step >= 1 ? 'active' : ''}"></div>
                <div class="semfin-step-dot ${step >= 2 ? 'active' : ''}"></div>
            </div>
        `;
    }

    // =====================================================================
    // FINALIZAR SEMESTRE
    // =====================================================================

    // ---------- PASSO 1: aprovação/reprovação/trancamento + média ----------
    function renderStep1(app) {
        const state = app._semFinState;
        const overlay = ensureOverlay();

        if (!state.cursando.length) {
            overlay.innerHTML = `
                <div class="semfin-modal">
                    <div class="semfin-header">
                        <div>
                            <h2><i class="fas fa-flag-checkered"></i> Finalizar Semestre</h2>
                        </div>
                        <button type="button" class="semfin-close" id="semfin-close-btn">&times;</button>
                    </div>
                    <div class="semfin-body">
                        <div class="semfin-empty">Nenhuma matéria restante para avaliar neste semestre.</div>
                    </div>
                    <div class="semfin-footer">
                        <div></div>
                        <div class="semfin-footer-right">
                            <button type="button" class="btn-primary" id="semfin-continue-btn">Continuar <i class="fas fa-arrow-right"></i></button>
                        </div>
                    </div>
                </div>
            `;
            document.getElementById('semfin-close-btn')?.addEventListener('click', closeModal);
            document.getElementById('semfin-continue-btn')?.addEventListener('click', () => {
                buildWorkingCurriculum(app);
                renderStep2(app);
            });
            return;
        }

        overlay.innerHTML = `
            <div class="semfin-modal">
                <div class="semfin-header">
                    <div>
                        <h2><i class="fas fa-flag-checkered"></i> Finalizar Semestre</h2>
                        <p>Passo 1 de 2 — Marque o resultado de cada matéria e informe a média final. Se alguma não deveria estar aqui, use "remover da lista".</p>
                    </div>
                    <button type="button" class="semfin-close" id="semfin-close-btn">&times;</button>
                </div>
                <div class="semfin-body" id="semfin-step1-list">
                    ${stepDots(1)}
                    ${state.cursando.map(item => renderStep1Row(state, item)).join('')}
                </div>
                <div class="semfin-footer">
                    <button type="button" class="btn-secondary" id="semfin-cancel-btn">Cancelar</button>
                    <div class="semfin-footer-right">
                        <button type="button" class="btn-primary" id="semfin-continue-btn">Continuar <i class="fas fa-arrow-right"></i></button>
                    </div>
                </div>
            </div>
        `;

        bindStep1Events(app);

        document.getElementById('semfin-close-btn')?.addEventListener('click', closeModal);
        document.getElementById('semfin-cancel-btn')?.addEventListener('click', closeModal);

        document.getElementById('semfin-continue-btn')?.addEventListener('click', () => {
            if (!state.cursando.length) {
                buildWorkingCurriculum(app);
                renderStep2(app);
                return;
            }

            let valid = true;
            document.querySelectorAll('.semfin-row').forEach(row => {
                const id = row.dataset.id;
                const result = state.resultados[id];
                if (result.choice === 'trancado') return;
                const input = row.querySelector('.semfin-nota-input');
                const raw = result.nota;
                const num = parseFloat(String(raw).replace(',', '.'));
                if (raw === '' || raw === undefined || raw === null || isNaN(num) || num < 0 || num > 10) {
                    valid = false;
                    input?.classList.add('semfin-invalid');
                } else {
                    result.nota = num;
                }
            });

            if (!valid) {
                showToast('Informe uma média válida (0 a 10) para cada matéria aprovada ou reprovada.', 'warning');
                return;
            }

            buildWorkingCurriculum(app);
            renderStep2(app);
        });
    }

    function renderStep1Row(state, item) {
        const result = state.resultados[item.id] || { choice: 'aprovado', nota: item.nota ?? '' };
        state.resultados[item.id] = result;
        const isTrancado = result.choice === 'trancado';
        return `
            <div class="semfin-row" data-id="${item.id}">
                <div class="semfin-row-head">
                    <div>
                        <strong>${escapeHtml(item.nome)}</strong>
                        <small>${item.semestre ? `${escapeHtml(item.semestre)}º semestre` : 'Sem semestre'} ${item.codigo ? `• ${escapeHtml(item.codigo)}` : ''}</small>
                    </div>
                    <button type="button" class="semfin-row-remove" data-remove-id="${item.id}">remover da lista</button>
                </div>
                <div class="semfin-row-controls">
                    <div class="semfin-toggle">
                        <button type="button" class="semfin-pill ${result.choice === 'aprovado' ? 'active' : ''}" data-choice="aprovado">✅ Aprovado</button>
                        <button type="button" class="semfin-pill ${result.choice === 'reprovado' ? 'active' : ''}" data-choice="reprovado">❌ Reprovado</button>
                        <button type="button" class="semfin-pill ${result.choice === 'trancado' ? 'active' : ''}" data-choice="trancado">🔒 Trancado</button>
                    </div>
                    <div class="semfin-nota-field">
                        <label>Média final</label>
                        <input type="number" class="semfin-nota-input" min="0" max="10" step="0.1" placeholder="0 a 10" value="${result.nota === '' || result.nota === undefined || result.nota === null ? '' : result.nota}" ${isTrancado ? 'disabled' : ''}>
                    </div>
                </div>
            </div>
        `;
    }

    function bindStep1Events(app) {
        const state = app._semFinState;
        const overlay = document.getElementById('semfin-overlay');
        if (!overlay) return;

        overlay.querySelectorAll('.semfin-row').forEach(row => {
            const id = row.dataset.id;

            row.querySelectorAll('.semfin-pill').forEach(btn => {
                btn.addEventListener('click', () => {
                    state.resultados[id].choice = btn.dataset.choice;
                    row.querySelectorAll('.semfin-pill').forEach(b => b.classList.toggle('active', b === btn));
                    const notaInput = row.querySelector('.semfin-nota-input');
                    if (notaInput) notaInput.disabled = btn.dataset.choice === 'trancado';
                });
            });

            const notaInput = row.querySelector('.semfin-nota-input');
            notaInput?.addEventListener('input', () => {
                state.resultados[id].nota = notaInput.value;
                notaInput.classList.remove('semfin-invalid');
            });

            row.querySelector('.semfin-row-remove')?.addEventListener('click', () => {
                state.cursando = state.cursando.filter(i => i.id !== id);
                delete state.resultados[id];
                showToast('Matéria removida desta finalização. O status dela não foi alterado — edite-a em "Editar Semestre Atual" se necessário.', 'success');
                renderStep1(app);
            });
        });
    }

    // Guarda uma entrada no histórico de tentativas da matéria (usado pelo
    // "ecossistema de repescagem" para comparar notas entre tentativas).
    // Não apaga tentativas anteriores — só acrescenta.
    function registrarTentativa(item, entry) {
        const lista = Array.isArray(item.tentativas) ? item.tentativas.slice() : [];
        lista.push({ ...entry, data: new Date().toISOString() });
        return lista;
    }

    // Aplica os resultados do passo 1 sobre uma cópia de trabalho da grade
    function buildWorkingCurriculum(app) {
        const state = app._semFinState;
        const source = app.getNormalizedCurriculum ? app.getNormalizedCurriculum() : (app.data.curriculum || []);
        state.working = source.map(item => ({ ...item }));

        const semestreQueEstaFechando = app.data?.user?.semestre || null;

        state.working.forEach(item => {
            const result = state.resultados[item.id];
            if (!result) return;
            if (result.choice === 'aprovado') {
                item.tentativas = registrarTentativa(item, { semestre: semestreQueEstaFechando, nota: result.nota, resultado: 'aprovado' });
                item.status = 'concluida';
                item.nota = result.nota;
            } else if (result.choice === 'reprovado') {
                item.tentativas = registrarTentativa(item, { semestre: semestreQueEstaFechando, nota: result.nota, resultado: 'reprovado' });
                item.status = 'reprovada';
                item.nota = result.nota;
            } else if (result.choice === 'trancado') {
                item.status = 'trancada';
                item.nota = null;
            }
        });
    }

    // ---------- PASSO 2: escolha das matérias do próximo semestre ----------
    function renderStep2(app) {
        const state = app._semFinState;
        const overlay = ensureOverlay();
        const working = state.working;

        const contagem = Object.values(state.resultados).reduce((acc, r) => {
            if (r.choice === 'aprovado') acc.aprovadas++;
            else if (r.choice === 'reprovado') acc.reprovadas++;
            else if (r.choice === 'trancado') acc.trancadas++;
            return acc;
        }, { aprovadas: 0, reprovadas: 0, trancadas: 0 });

        const currentSemester = parseInt(app.data?.user?.semestre || 0, 10) || 0;
        const nextSemester = currentSemester ? currentSemester + 1 : 0;

        const cursandoIds = new Set(state.cursando.map(i => i.id));
        const candidatos = working.filter(item => !cursandoIds.has(item.id) && ['nao-cursada', 'reprovada', 'trancada'].includes(item.status));

        function prereqsSatisfeitos(item) {
            if (!item.prerequisitosLista?.length) return { ok: true, pendentes: [] };
            const pendentes = item.prerequisitosLista.filter(req => {
                const key = slug(req);
                const match = working.find(c => slug(c.nome) === key);
                if (!match) return false; // pré-requisito não cadastrado: não bloqueia
                return match.status !== 'concluida';
            });
            return { ok: pendentes.length === 0, pendentes };
        }

        if (!state.selecionadas) {
            state.selecionadas = new Set(
                candidatos
                    .filter(item => {
                        const { ok } = prereqsSatisfeitos(item);
                        if (!ok) return false;
                        if (item.status === 'reprovada' || item.status === 'trancada') return true;
                        return nextSemester && parseInt(item.semestre || 0, 10) === nextSemester;
                    })
                    .map(item => item.id)
            );
        }

        const porSemestre = candidatos.reduce((acc, item) => {
            const sem = String(item.semestre || '0').trim();
            const chave = sem && sem !== '0' ? `${sem}º Semestre` : 'Sem semestre definido';
            if (!acc[chave]) acc[chave] = [];
            acc[chave].push(item);
            return acc;
        }, {});
        const chaves = Object.keys(porSemestre).sort((a, b) => (parseInt(a, 10) || 999) - (parseInt(b, 10) || 999));

        overlay.innerHTML = `
            <div class="semfin-modal">
                <div class="semfin-header">
                    <div>
                        <h2><i class="fas fa-graduation-cap"></i> Finalizar Semestre</h2>
                        <p>Passo 2 de 2 — Escolha as matérias que você vai cursar no próximo semestre.</p>
                    </div>
                    <button type="button" class="semfin-close" id="semfin-close-btn">&times;</button>
                </div>
                <div class="semfin-body">
                    ${stepDots(2)}
                    <div class="semfin-summary">
                        ✅ <strong>${contagem.aprovadas}</strong> aprovada(s) &nbsp;•&nbsp;
                        ❌ <strong>${contagem.reprovadas}</strong> reprovada(s) &nbsp;•&nbsp;
                        🔒 <strong>${contagem.trancadas}</strong> trancada(s)
                        ${nextSemester ? `&nbsp;•&nbsp; Próximo semestre: <strong>${nextSemester}º</strong>` : ''}
                    </div>

                    ${!candidatos.length ? `
                        <div class="semfin-empty">Nenhuma matéria disponível para seleção. Cadastre novos componentes na Grade Curricular se precisar.</div>
                    ` : chaves.map(chave => `
                        <div class="semfin-group-title">${escapeHtml(chave)}</div>
                        ${porSemestre[chave].map(item => {
                            const { ok, pendentes } = prereqsSatisfeitos(item);
                            const checked = state.selecionadas.has(item.id);
                            return `
                                <label class="semfin-candidate ${ok ? '' : 'blocked'}">
                                    <input type="checkbox" class="semfin-candidate-check" data-id="${item.id}" ${checked ? 'checked' : ''} ${ok ? '' : 'disabled'}>
                                    <div class="semfin-candidate-info">
                                        <strong>${escapeHtml(item.nome)}</strong>
                                        <small>${Number(item.cargaHoraria) || 0}h ${item.codigo ? `• ${escapeHtml(item.codigo)}` : ''}</small>
                                        ${item.status === 'reprovada' ? '<span class="semfin-tag repescagem">Repescagem</span>' : ''}
                                        ${item.status === 'trancada' ? '<span class="semfin-tag trancada">Trancada anteriormente</span>' : ''}
                                        ${ok && item.status === 'nao-cursada' && nextSemester && parseInt(item.semestre || 0, 10) === nextSemester ? '<span class="semfin-tag recomendada">Recomendada</span>' : ''}
                                        ${!ok ? `<span class="semfin-tag bloqueada">Falta: ${pendentes.map(escapeHtml).join(', ')}</span>` : ''}
                                    </div>
                                </label>
                            `;
                        }).join('')}
                    `).join('')}
                </div>
                <div class="semfin-footer">
                    <button type="button" class="btn-secondary" id="semfin-back-btn"><i class="fas fa-arrow-left"></i> Voltar</button>
                    <div class="semfin-footer-right">
                        <button type="button" class="btn-secondary" id="semfin-cancel-btn">Cancelar</button>
                        <button type="button" class="btn-primary" id="semfin-finish-btn">Finalizar Semestre <i class="fas fa-check"></i></button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('semfin-close-btn')?.addEventListener('click', closeModal);
        document.getElementById('semfin-cancel-btn')?.addEventListener('click', closeModal);
        document.getElementById('semfin-back-btn')?.addEventListener('click', () => renderStep1(app));

        overlay.querySelectorAll('.semfin-candidate-check').forEach(cb => {
            cb.addEventListener('change', () => {
                if (cb.checked) state.selecionadas.add(cb.dataset.id);
                else state.selecionadas.delete(cb.dataset.id);
            });
        });

        document.getElementById('semfin-finish-btn')?.addEventListener('click', () => finalizarSemestre(app));
    }

    async function finalizarSemestre(app) {
        const state = app._semFinState;
        const working = state.working;
        const contagem = Object.values(state.resultados).reduce((acc, r) => {
            if (r.choice === 'aprovado') acc.aprovadas++;
            else if (r.choice === 'reprovado') acc.reprovadas++;
            else if (r.choice === 'trancado') acc.trancadas++;
            return acc;
        }, { aprovadas: 0, reprovadas: 0, trancadas: 0 });

        const materiasDoSemestreQueFecha = state.cursando.map(item => item.nome);
        const currentSemester = parseInt(app.data?.user?.semestre || 0, 10) || 0;

        // Backup completo em memória. Nenhuma escrita no Firestore acontece
        // até o estado novo + arquivo histórico estarem prontos.
        const backupData = JSON.parse(JSON.stringify(app.data));
        const snapshot = {
            subjects: (app.data.subjects || [])
                .filter(s => materiasDoSemestreQueFecha.some(nome => slug(nome) === slug(s.nome)))
                .map(item => ({ ...item })),
            curriculum: state.cursando.map(item => ({ ...item }))
        };

        working.forEach(item => {
            if (state.selecionadas.has(item.id)) {
                // Repescagem: matéria já reprovada antes está sendo cursada de novo.
                if (item.status === 'reprovada' && (!Array.isArray(item.tentativas) || !item.tentativas.length)) {
                    item.tentativas = (item.nota !== null && item.nota !== undefined)
                        ? [{ semestre: null, nota: item.nota, resultado: 'reprovado', data: null }]
                        : [];
                }
                item.status = 'cursando';
                item.nota = null;
            }
        });

        app.data.curriculum = working;

        // Sincroniza `subjects` apenas em memória. O save único abaixo grava
        // currículo, matérias, usuário e histórico juntos.
        if (typeof app.syncSubjectsWithCurriculum === 'function') {
            app.syncSubjectsWithCurriculum();
        }

        const nextSemester = currentSemester + 1;
        if (currentSemester && app.data.user) app.data.user.semestre = nextSemester;

        const { archivedCount } = await archiveFinishedSemesterData(
            app,
            materiasDoSemestreQueFecha,
            currentSemester || null,
            snapshot
        );

        const okSave = await dbService.saveAllData(app.data);
        if (!okSave) {
            // Como ainda não houve escrita parcial, restaurar a memória deixa
            // o usuário exatamente como estava antes de clicar em finalizar.
            app.data = backupData;
            refreshWholeApp(app);
            showToast('Não foi possível finalizar o semestre. Seus dados anteriores foram preservados.', 'error');
            return;
        }

        refreshWholeApp(app);
        closeModal();
        app._semFinState = null;

        const extra = archivedCount
            ? ` ${archivedCount} item(ns) do semestre anterior (tarefas, provas, sessões, grade horária etc.) foram arquivados e saíram das telas ativas.`
            : '';
        showToast(`Semestre finalizado! ✅ ${contagem.aprovadas} aprovada(s), ❌ ${contagem.reprovadas} reprovada(s), 🔒 ${contagem.trancadas} trancada(s), ${state.selecionadas.size} matéria(s) selecionada(s) para o próximo semestre.${extra}`, 'success');

        if (typeof app.loadView === 'function') app.loadView('dashboard');
    }

    // =====================================================================
    // EDITAR SEMESTRE ATUAL (a qualquer momento, sem finalizar o semestre)
    // =====================================================================

    function renderGerenciar(app) {
        injectStyles();
        const overlay = ensureOverlay();
        const curriculum = app.getNormalizedCurriculum ? app.getNormalizedCurriculum() : (app.data.curriculum || []);
        const cursando = curriculum.filter(i => i.status === 'cursando').sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
        const disponiveis = curriculum
            .filter(i => ['nao-cursada', 'reprovada', 'trancada'].includes(i.status))
            .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));

        const statusLabel = { 'nao-cursada': 'Não cursada', 'reprovada': 'Reprovada', 'trancada': 'Trancada' };

        overlay.innerHTML = `
            <div class="semfin-modal">
                <div class="semfin-header">
                    <div>
                        <h2><i class="fas fa-sliders"></i> Editar Semestre Atual</h2>
                        <p>Adicione, remova ou tranque matérias do semestre em andamento a qualquer momento.</p>
                    </div>
                    <button type="button" class="semfin-close" id="semfin-close-btn">&times;</button>
                </div>
                <div class="semfin-body">
                    <div class="semfin-group-title">Cursando agora (${cursando.length})</div>
                    ${!cursando.length ? `<div class="semfin-empty">Nenhuma matéria marcada como "Cursando" no momento.</div>` : cursando.map(item => `
                        <div class="semfin-manage-row" data-id="${item.id}">
                            <div class="semfin-manage-info">
                                <strong>${escapeHtml(item.nome)}</strong>
                                <small>${item.semestre ? `${escapeHtml(item.semestre)}º semestre` : 'Sem semestre'} ${item.codigo ? `• ${escapeHtml(item.codigo)}` : ''}</small>
                            </div>
                            <div class="semfin-manage-actions">
                                <button type="button" class="semfin-btn-lock" data-lock-id="${item.id}"><i class="fas fa-lock"></i> Trancar</button>
                                <button type="button" class="semfin-btn-remove" data-remove-id="${item.id}"><i class="fas fa-rotate-left"></i> Remover</button>
                            </div>
                        </div>
                    `).join('')}

                    <div class="semfin-group-title" style="margin-top:22px;">Adicionar matéria a este semestre</div>
                    <div class="semfin-add-row">
                        <select id="semfin-add-select">
                            <option value="">Selecione uma matéria...</option>
                            ${disponiveis.map(item => `<option value="${item.id}">${escapeHtml(item.nome)} (${statusLabel[item.status] || item.status})</option>`).join('')}
                        </select>
                        <button type="button" class="btn-primary" id="semfin-add-btn"><i class="fas fa-plus"></i> Adicionar</button>
                    </div>
                    ${!disponiveis.length ? `<small style="color:var(--text-secondary,#94a3b8);">Não há outras matérias cadastradas na Grade Curricular para adicionar.</small>` : ''}
                </div>
                <div class="semfin-footer">
                    <div></div>
                    <div class="semfin-footer-right">
                        <button type="button" class="btn-primary" id="semfin-done-btn">Concluído</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('semfin-close-btn')?.addEventListener('click', closeModal);
        document.getElementById('semfin-done-btn')?.addEventListener('click', closeModal);

        overlay.querySelectorAll('[data-lock-id]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.lockId;
                const item = curriculum.find(i => i.id === id);
                if (!item) return;
                if (!confirm(`Trancar "${item.nome}"? Ela ficará disponível para cursar novamente mais tarde, sem nota registrada.`)) return;
                item.status = 'trancada';
                item.nota = null;
                app.data.curriculum = curriculum;
                const ok = await dbService.saveData('curriculum', app.data.curriculum);
                if (ok && typeof window.syncSubjectsWithCurriculumAndRefresh === 'function') {
                    await window.syncSubjectsWithCurriculumAndRefresh(app, { reload: false });
                }
                showToast(ok ? `"${item.nome}" foi trancada.` : 'Não foi possível salvar. Verifique sua conexão.', ok ? 'success' : 'error');
                renderGerenciar(app);
                if (typeof app.loadView === 'function' && ok) app.loadView('grade-curricular');
            });
        });

        overlay.querySelectorAll('[data-remove-id]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.removeId;
                const item = curriculum.find(i => i.id === id);
                if (!item) return;
                if (!confirm(`Remover "${item.nome}" das matérias que você está cursando agora? Ela voltará para "Não cursada".`)) return;
                item.status = 'nao-cursada';
                item.nota = null;
                app.data.curriculum = curriculum;
                const ok = await dbService.saveData('curriculum', app.data.curriculum);
                if (ok && typeof window.syncSubjectsWithCurriculumAndRefresh === 'function') {
                    await window.syncSubjectsWithCurriculumAndRefresh(app, { reload: false });
                }
                showToast(ok ? `"${item.nome}" foi removida do semestre atual.` : 'Não foi possível salvar. Verifique sua conexão.', ok ? 'success' : 'error');
                renderGerenciar(app);
                if (typeof app.loadView === 'function' && ok) app.loadView('grade-curricular');
            });
        });

        document.getElementById('semfin-add-btn')?.addEventListener('click', async () => {
            const select = document.getElementById('semfin-add-select');
            const id = select?.value;
            if (!id) {
                showToast('Selecione uma matéria para adicionar.', 'warning');
                return;
            }
            const item = curriculum.find(i => i.id === id);
            if (!item) return;
            item.status = 'cursando';
            item.nota = null;
            app.data.curriculum = curriculum;
            const ok = await dbService.saveData('curriculum', app.data.curriculum);
            if (ok && typeof window.syncSubjectsWithCurriculumAndRefresh === 'function') {
                await window.syncSubjectsWithCurriculumAndRefresh(app, { reload: false });
            }
            showToast(ok ? `"${item.nome}" adicionada ao semestre atual.` : 'Não foi possível salvar. Verifique sua conexão.', ok ? 'success' : 'error');
            renderGerenciar(app);
            if (typeof app.loadView === 'function' && ok) app.loadView('grade-curricular');
        });
    }

    if (window.StudyLifeControl) {
        window.StudyLifeControl.prototype.abrirFinalizarSemestre = function () {
            if (this._semesterContext?.type === 'archived') {
                showToast('Você está visualizando um semestre anterior. Volte ao semestre atual para finalizar o semestre.', 'warning');
                return;
            }
            if (this.normalizeCurriculumInMemory) this.normalizeCurriculumInMemory();
            const curriculum = this.getNormalizedCurriculum ? this.getNormalizedCurriculum() : (this.data.curriculum || []);
            const cursando = curriculum.filter(item => item.status === 'cursando');

            if (!cursando.length) {
                showToast('Nenhuma matéria está marcada como "Cursando" na Grade Curricular. Use "Editar Semestre Atual" para adicionar as matérias deste semestre antes de finalizar.', 'warning');
                return;
            }

            injectStyles();
            this._semFinState = {
                cursando,
                resultados: {},
                working: null,
                selecionadas: null
            };
            renderStep1(this);
        };

        window.StudyLifeControl.prototype.abrirGerenciarSemestreAtual = function () {
            if (this._semesterContext?.type === 'archived') {
                showToast('Esse painel altera o semestre atual. Volte ao semestre atual antes de usá-lo.', 'warning');
                return;
            }
            if (this.normalizeCurriculumInMemory) this.normalizeCurriculumInMemory();
            renderGerenciar(this);
        };
    }
})();
