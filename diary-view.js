// diary-view.js - Página "Diário": unifica Registro do Dia + Diário de Aula
// numa só tela, com histórico, filtros e gráficos de evolução.
//
// Segue o mesmo padrão de "página especial" usado por Ajuda/Gamificação/
// Situação Acadêmica em script.js (ver patchLoadView -> view === 'diario').

class DiaryView {
    constructor() {
        this.filtro = { materia: 'todas', periodo: '30' };
        this._blockCounter = 0;
    }

    // ---------- helpers ----------

    energiaInfo(v) {
        return { baixa: { emoji: '🔴', texto: 'Baixa' }, media: { emoji: '🟡', texto: 'Média' }, alta: { emoji: '🟢', texto: 'Alta' } }[v] || { emoji: '⚪', texto: '—' };
    }

    focoInfo(v) {
        return { ruim: { emoji: '🔴', texto: 'Ruim' }, normal: { emoji: '🟡', texto: 'Normal' }, bom: { emoji: '🟢', texto: 'Bom' } }[v] || { emoji: '⚪', texto: '—' };
    }

    diffStars(n) {
        const nivel = Math.min(5, Math.max(1, parseInt(n, 10) || 3));
        return '★'.repeat(nivel) + '☆'.repeat(5 - nivel);
    }

    diaLabel(dataStr) {
        const hoje = toDateString();
        const ontem = toDateString(new Date(Date.now() - 86400000));
        if (dataStr === hoje) return 'Hoje';
        if (dataStr === ontem) return 'Ontem';
        const diaSemana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][parseDateSafe(dataStr).getDay()];
        return `${formatarData(dataStr)} • ${diaSemana}`;
    }

    calcularStreak(app) {
        const logs = app.data.dailyLogs || [];
        const datasComLog = new Set(logs.map(l => l.data));
        let streak = 0;
        let cursor = new Date();
        // Se hoje ainda não tem registro, começa a contagem de ontem pra trás
        if (!datasComLog.has(toDateString(cursor))) {
            cursor.setDate(cursor.getDate() - 1);
        }
        while (datasComLog.has(toDateString(cursor))) {
            streak++;
            cursor.setDate(cursor.getDate() - 1);
        }
        return streak;
    }

    // ---------- página principal ----------

    renderPage(app) {
        window.dailyLogService?.loadLogs();
        window.classDiaryService?.loadDiaries();

        const streak = this.calcularStreak(app);
        const medias = window.dailyLogService?.getMediaUltimos7Dias() || { energia: null, foco: null };
        const energiaInfo = this.energiaInfo(medias.energia);
        const focoInfo = this.focoInfo(medias.foco);

        const subjects = app.data.subjects || [];
        const subjectsComDiario = subjects.filter(s => (app.data.classDiaries || []).some(d => d.materia === s.nome));
        const freqMedia = subjectsComDiario.length
            ? Math.round(subjectsComDiario.reduce((acc, s) => acc + window.classDiaryService.calcularFrequencia(s.nome), 0) / subjectsComDiario.length)
            : null;

        const totalLogs = (app.data.dailyLogs || []).length;
        const totalDiarios = (app.data.classDiaries || []).length;

        return `
            <div class="view-header">
                <h2><i class="fas fa-book-open"></i> Diário</h2>
                <button class="btn-primary" id="diario-novo-btn"><i class="fas fa-plus"></i> Novo registro</button>
            </div>

            <div class="dashboard-grid">
                <div class="card">
                    <div class="card-header"><h3>🔥 Sequência</h3></div>
                    <div class="card-body">
                        <div class="stats-row">
                            <div class="stat-item">
                                <span class="stat-value">${streak}</span>
                                <span class="stat-label">dia${streak === 1 ? '' : 's'} seguido${streak === 1 ? '' : 's'}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header"><h3>⚡ Energia (7 dias)</h3></div>
                    <div class="card-body">
                        <div class="stats-row">
                            <div class="stat-item">
                                <span class="stat-value">${energiaInfo.emoji}</span>
                                <span class="stat-label">${energiaInfo.texto}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header"><h3>🎯 Foco (7 dias)</h3></div>
                    <div class="card-body">
                        <div class="stats-row">
                            <div class="stat-item">
                                <span class="stat-value">${focoInfo.emoji}</span>
                                <span class="stat-label">${focoInfo.texto}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header"><h3>🏛️ Frequência média</h3></div>
                    <div class="card-body">
                        <div class="stats-row">
                            <div class="stat-item">
                                <span class="stat-value">${freqMedia === null ? '—' : freqMedia + '%'}</span>
                                <span class="stat-label">${subjectsComDiario.length} matéria${subjectsComDiario.length === 1 ? '' : 's'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="dashboard-grid">
                <div class="card">
                    <div class="card-header"><h3><i class="fas fa-chart-line"></i> Energia &amp; Foco — últimos 14 dias</h3></div>
                    <div class="card-body">
                        ${this.renderEnergiaFocoChart(app)}
                        <div class="diary-chart-legend">
                            <span><i class="diary-legend-dot energia"></i> Energia</span>
                            <span><i class="diary-legend-dot foco"></i> Foco</span>
                        </div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header"><h3><i class="fas fa-chalkboard-teacher"></i> Frequência por matéria</h3></div>
                    <div class="card-body">
                        ${this.renderFrequenciaPorMateria(app, subjectsComDiario)}
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-history"></i> Histórico</h3>
                </div>
                <div class="card-body">
                    <div class="diary-filters">
                        <select id="diario-filtro-materia">
                            <option value="todas">Todas as matérias</option>
                            ${subjects.map(s => `<option value="${escapeHtml(s.nome)}" ${this.filtro.materia === s.nome ? 'selected' : ''}>${escapeHtml(s.nome)}</option>`).join('')}
                        </select>
                        <select id="diario-filtro-periodo">
                            <option value="7" ${this.filtro.periodo === '7' ? 'selected' : ''}>Últimos 7 dias</option>
                            <option value="30" ${this.filtro.periodo === '30' ? 'selected' : ''}>Últimos 30 dias</option>
                            <option value="90" ${this.filtro.periodo === '90' ? 'selected' : ''}>Últimos 90 dias</option>
                            <option value="all" ${this.filtro.periodo === 'all' ? 'selected' : ''}>Tudo</option>
                        </select>
                    </div>
                    <div id="diario-timeline">
                        ${this.renderTimeline(app)}
                    </div>
                </div>
            </div>

            ${!totalLogs && !totalDiarios ? '' : ''}
        `;
    }

    renderEnergiaFocoChart(app) {
        const energiaMap = { baixa: 1, media: 2, alta: 3 };
        const focoMap = { ruim: 1, normal: 2, bom: 3 };
        const dias = [];
        for (let i = 13; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            dias.push(toDateString(d));
        }

        const logsPorData = {};
        (app.data.dailyLogs || []).forEach(l => { logsPorData[l.data] = l; });

        return `
            <div class="diary-chart-days">
                ${dias.map(dataStr => {
                    const log = logsPorData[dataStr];
                    const eNivel = log?.energia ? energiaMap[log.energia] : 0;
                    const fNivel = log?.foco ? focoMap[log.foco] : 0;
                    const eAltura = eNivel ? eNivel * 16 : 3;
                    const fAltura = fNivel ? fNivel * 16 : 3;
                    const label = parseDateSafe(dataStr).getDate();
                    return `
                        <div class="diary-chart-day" title="${formatarData(dataStr)}${log ? '' : ' — sem registro'}">
                            <div class="diary-dual-bar-group">
                                <div class="diary-dual-bar energia" style="height:${eAltura}px"></div>
                                <div class="diary-dual-bar foco" style="height:${fAltura}px"></div>
                            </div>
                            <span>${label}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    renderFrequenciaPorMateria(app, subjectsComDiario) {
        if (!subjectsComDiario.length) {
            return '<p class="diary-empty-mini">Registre uma aula no diário para ver a frequência por matéria aqui.</p>';
        }

        return subjectsComDiario.map(s => {
            const pct = window.classDiaryService.calcularFrequencia(s.nome);
            const cor = pct >= 75 ? 'var(--accent-success)' : pct >= 50 ? 'var(--accent-warning)' : 'var(--accent-danger)';
            return `
                <div class="diary-freq-row">
                    <span class="diary-freq-label">${escapeHtml(s.nome)}</span>
                    <div class="progress-bar"><div class="progress-fill" style="width:${pct}%; background:${cor};"></div></div>
                    <span class="diary-freq-pct">${pct}%</span>
                </div>
            `;
        }).join('');
    }

    renderTimeline(app) {
        const logs = app.data.dailyLogs || [];
        const diaries = app.data.classDiaries || [];

        const limiteDias = this.filtro.periodo === 'all' ? null : parseInt(this.filtro.periodo, 10);
        const dataLimite = limiteDias ? toDateString(new Date(Date.now() - limiteDias * 86400000)) : null;

        const materiaFiltro = this.filtro.materia;

        const datasSet = new Set();
        logs.forEach(l => { if (!dataLimite || l.data >= dataLimite) datasSet.add(l.data); });
        diaries.forEach(d => {
            if (materiaFiltro !== 'todas' && d.materia !== materiaFiltro) return;
            if (!dataLimite || d.data >= dataLimite) datasSet.add(d.data);
        });

        // Se filtrando por matéria específica, só mostra dias que tenham diário dessa matéria
        const datas = Array.from(datasSet)
            .filter(d => {
                if (materiaFiltro === 'todas') return true;
                return diaries.some(dr => dr.data === d && dr.materia === materiaFiltro);
            })
            .sort((a, b) => b.localeCompare(a));

        if (!datas.length) {
            return `
                <div class="diary-empty-state">
                    <i class="fas fa-book" style="font-size:32px; opacity:.4; margin-bottom:10px;"></i>
                    <p>Nenhum registro por aqui ainda.</p>
                    <button class="btn-primary" id="diario-empty-novo-btn"><i class="fas fa-plus"></i> Criar primeiro registro</button>
                </div>
            `;
        }

        return datas.map(dataStr => {
            const log = logs.find(l => l.data === dataStr);
            const diariosDoDia = diaries
                .filter(d => d.data === dataStr && (materiaFiltro === 'todas' || d.materia === materiaFiltro))
                .sort((a, b) => a.materia.localeCompare(b.materia));

            return `
                <div class="diary-day-group">
                    <div class="diary-day-label"><span>${this.diaLabel(dataStr)}</span><span class="diary-day-line"></span></div>
                    ${log ? this.renderLogCard(log) : ''}
                    ${diariosDoDia.map(d => this.renderDiaryCard(d)).join('')}
                </div>
            `;
        }).join('');
    }

    renderLogCard(log) {
        const eInfo = this.energiaInfo(log.energia);
        const fInfo = this.focoInfo(log.foco);
        return `
            <div class="diary-entry-card">
                <div class="diary-entry-head">
                    <strong><i class="fas fa-user"></i> Meu dia</strong>
                    <div class="diary-entry-actions">
                        <button class="btn-icon diario-editar-dia" data-data="${escapeHtml(log.data)}" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon diario-excluir-log" data-id="${escapeHtml(log.id)}" title="Excluir" style="color:var(--accent-danger);"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div class="diary-entry-meta">
                    ${log.estudo?.duracao ? `<span><i class="fas fa-book-reader"></i> ${log.estudo.duracao} min de estudo</span>` : ''}
                    ${log.trabalho?.trabalhou ? `<span><i class="fas fa-briefcase"></i> Trabalhou ${log.trabalho.duracao || 0} min</span>` : ''}
                    <span>${eInfo.emoji} Energia ${eInfo.texto}</span>
                    <span>${fInfo.emoji} Foco ${fInfo.texto}</span>
                </div>
                ${log.observacoes ? `<p style="margin-top:8px; color:var(--text-secondary); font-size:13.5px;">${nl2brSafe(log.observacoes)}</p>` : ''}
            </div>
        `;
    }

    renderDiaryCard(d) {
        return `
            <div class="diary-entry-card aula">
                <div class="diary-entry-head">
                    <strong><i class="fas fa-chalkboard"></i> ${escapeHtml(d.materia)}</strong>
                    <div class="diary-entry-actions">
                        <button class="btn-icon diario-editar-dia" data-data="${escapeHtml(d.data)}" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon diario-excluir-diario" data-id="${escapeHtml(d.id)}" title="Excluir" style="color:var(--accent-danger);"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div class="diary-entry-meta">
                    <span class="tag ${d.presenca === 'present' ? 'success' : 'danger'}">${d.presenca === 'present' ? '✅ Presente' : '❌ Faltou'}</span>
                    <span title="Dificuldade">${this.diffStars(d.dificuldade)}</span>
                    ${d.precisoRevisar ? '<span class="badge warning">Revisar</span>' : ''}
                </div>
                ${d.conteudoExplicado ? `<p style="margin-top:8px; font-size:13.5px;"><strong>Conteúdo:</strong> ${nl2brSafe(d.conteudoExplicado)}</p>` : ''}
                ${d.exerciciosPassados ? `<p style="margin-top:4px; font-size:13.5px; color:var(--text-secondary);"><strong>Exercícios:</strong> ${nl2brSafe(d.exerciciosPassados)}</p>` : ''}
                ${d.duvidaPendente ? `<p style="margin-top:4px; font-size:13.5px; color:var(--accent-warning);"><strong>Dúvida:</strong> ${escapeHtml(d.duvidaPendente)}</p>` : ''}
            </div>
        `;
    }

    // ---------- eventos da página ----------

    bindPageEvents(app) {
        document.getElementById('diario-novo-btn')?.addEventListener('click', () => this.openModal());
        document.getElementById('diario-empty-novo-btn')?.addEventListener('click', () => this.openModal());

        document.getElementById('diario-filtro-materia')?.addEventListener('change', e => {
            this.filtro.materia = e.target.value;
            this.refreshTimeline(app);
        });
        document.getElementById('diario-filtro-periodo')?.addEventListener('change', e => {
            this.filtro.periodo = e.target.value;
            this.refreshTimeline(app);
        });

        this.bindTimelineEvents(app);
    }

    bindTimelineEvents(app) {
        document.querySelectorAll('.diario-editar-dia').forEach(btn => {
            btn.addEventListener('click', e => this.openModal(e.currentTarget.dataset.data));
        });

        document.querySelectorAll('.diario-excluir-log').forEach(btn => {
            btn.addEventListener('click', async e => {
                if (!confirm('Excluir o registro do dia?')) return;
                await window.dailyLogService.removerLog(e.currentTarget.dataset.id);
                this.refreshTimeline(app);
            });
        });

        document.querySelectorAll('.diario-excluir-diario').forEach(btn => {
            btn.addEventListener('click', async e => {
                if (!confirm('Excluir esse diário de aula?')) return;
                await window.classDiaryService.removerDiario(e.currentTarget.dataset.id);
                this.refreshTimeline(app);
            });
        });
    }

    refreshTimeline(app) {
        const container = document.getElementById('diario-timeline');
        if (!container) return;
        container.innerHTML = this.renderTimeline(app);
        this.bindTimelineEvents(app);
    }

    // ---------- modal unificado ----------

    openModal(dataStr = null, prefillMateria = null) {
        const app = window.app;
        if (!app) return;

        const modal = document.getElementById('modal-diario');
        if (!modal) return;

        window.dailyLogService?.loadLogs();
        window.classDiaryService?.loadDiaries();

        const data = dataStr || toDateString(new Date());
        const log = window.dailyLogService?.getLogPorData(data);
        const diariosDoDia = (app.data.classDiaries || []).filter(d => d.data === data);

        document.getElementById('modal-diario-titulo').textContent = (log || diariosDoDia.length)
            ? `Editar registro de ${formatarData(data)}`
            : `Novo registro — ${formatarData(data)}`;

        document.getElementById('diario-data').value = data;
        document.getElementById('diario-estudo-inicio').value = log?.estudo?.inicio || '';
        document.getElementById('diario-estudo-fim').value = log?.estudo?.fim || '';
        document.getElementById('diario-energia').value = log?.energia || 'media';
        document.getElementById('diario-foco').value = log?.foco || 'normal';
        document.getElementById('diario-trabalhou').checked = log?.trabalho?.trabalhou || false;
        document.getElementById('diario-trabalho-duracao').value = log?.trabalho?.duracao || 0;
        document.getElementById('diario-observacoes').value = log?.observacoes || '';

        this._blockCounter = 0;
        const container = document.getElementById('diario-aulas-container');
        container.innerHTML = '';

        if (diariosDoDia.length) {
            diariosDoDia.forEach(d => this.addAulaBlock(app, d));
        } else {
            const bloco = prefillMateria ? { materia: prefillMateria, data } : null;
            this.addAulaBlock(app, bloco);
        }

        modal.style.display = 'block';
    }

    addAulaBlock(app, existente = null) {
        const container = document.getElementById('diario-aulas-container');
        if (!container) return;

        const idx = this._blockCounter++;
        const subjects = app.data.subjects || [];
        const materiaAtual = existente?.materia || '';

        const div = document.createElement('div');
        div.className = 'diario-aula-block';
        div.dataset.index = idx;
        div.innerHTML = `
            <button type="button" class="diario-aula-block-remove" title="Remover essa aula"><i class="fas fa-times"></i></button>
            <input type="hidden" class="diario-aula-id" value="${existente?.id ? escapeHtml(existente.id) : ''}">
            <div class="form-row">
                <div class="form-group">
                    <label>Matéria</label>
                    <select class="diario-aula-materia" required>
                        <option value="">Selecione</option>
                        ${subjects.map(s => `<option value="${escapeHtml(s.nome)}" ${s.nome === materiaAtual ? 'selected' : ''}>${escapeHtml(s.nome)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Presença</label>
                    <select class="diario-aula-presenca">
                        <option value="present" ${!existente || existente.presenca === 'present' ? 'selected' : ''}>✅ Fui</option>
                        <option value="absent" ${existente?.presenca === 'absent' ? 'selected' : ''}>❌ Faltei</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Conteúdo explicado</label>
                <textarea class="diario-aula-conteudo" rows="2" placeholder="O que foi explicado?">${existente?.conteudoExplicado ? escapeHtml(existente.conteudoExplicado) : ''}</textarea>
            </div>
            <div class="form-group">
                <label>Exercícios passados</label>
                <textarea class="diario-aula-exercicios" rows="2" placeholder="Lista de exercícios, páginas...">${existente?.exerciciosPassados ? escapeHtml(existente.exerciciosPassados) : ''}</textarea>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>O que eu entendi</label>
                    <textarea class="diario-aula-entendi" rows="2">${existente?.entendi ? escapeHtml(existente.entendi) : ''}</textarea>
                </div>
                <div class="form-group">
                    <label>O que eu não entendi</label>
                    <textarea class="diario-aula-nao-entendi" rows="2">${existente?.naoEntendi ? escapeHtml(existente.naoEntendi) : ''}</textarea>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Dúvida pendente</label>
                    <input type="text" class="diario-aula-duvida" value="${existente?.duvidaPendente ? escapeHtml(existente.duvidaPendente) : ''}" placeholder="Ex: perguntar ao professor sobre integrais por partes">
                </div>
                <div class="form-group">
                    <label>Links / anexos</label>
                    <input type="text" class="diario-aula-links" value="${existente?.linksAnexos ? escapeHtml(existente.linksAnexos) : ''}">
                </div>
            </div>
            <div class="form-group">
                <label>Trabalho anunciado</label>
                <input type="text" class="diario-aula-trabalho" value="${existente?.trabalhoAnunciado ? escapeHtml(existente.trabalhoAnunciado) : ''}">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Dificuldade (1-5)</label>
                    <input type="number" class="diario-aula-dificuldade" min="1" max="5" value="${existente?.dificuldade || 3}">
                </div>
                <div class="form-group">
                    <label><input type="checkbox" class="diario-aula-revisar" ${existente?.precisoRevisar ? 'checked' : ''}> Preciso revisar</label>
                </div>
            </div>
            <div class="form-group">
                <label>Observações</label>
                <textarea class="diario-aula-observacoes" rows="2">${existente?.observacoes ? escapeHtml(existente.observacoes) : ''}</textarea>
            </div>
        `;

        div.querySelector('.diario-aula-block-remove').addEventListener('click', () => div.remove());
        container.appendChild(div);
    }

    async handleSubmit(e) {
        e.preventDefault();
        const app = window.app;
        if (!app) return;

        const data = document.getElementById('diario-data').value;
        if (!data) { showToast('Escolha uma data.', 'warning'); return; }

        const blocos = Array.from(document.querySelectorAll('#diario-aulas-container .diario-aula-block'));
        const temAula = blocos.some(b => b.querySelector('.diario-aula-materia').value);

        const logData = {
            data,
            estudoInicio: document.getElementById('diario-estudo-inicio').value,
            estudoFim: document.getElementById('diario-estudo-fim').value,
            foiAula: temAula,
            materiasAula: blocos.map(b => b.querySelector('.diario-aula-materia').value).filter(Boolean),
            trabalhou: document.getElementById('diario-trabalhou').checked,
            trabalhoDuracao: parseInt(document.getElementById('diario-trabalho-duracao').value, 10) || 0,
            energia: document.getElementById('diario-energia').value,
            foco: document.getElementById('diario-foco').value,
            observacoes: document.getElementById('diario-observacoes').value
        };

        await window.dailyLogService.registrarLog(logData);

        for (const bloco of blocos) {
            const materia = bloco.querySelector('.diario-aula-materia').value;
            if (!materia) continue;

            const diaryData = {
                id: bloco.querySelector('.diario-aula-id').value || null,
                materia,
                data,
                presenca: bloco.querySelector('.diario-aula-presenca').value,
                conteudoExplicado: bloco.querySelector('.diario-aula-conteudo').value,
                exerciciosPassados: bloco.querySelector('.diario-aula-exercicios').value,
                entendi: bloco.querySelector('.diario-aula-entendi').value,
                naoEntendi: bloco.querySelector('.diario-aula-nao-entendi').value,
                duvidaPendente: bloco.querySelector('.diario-aula-duvida').value,
                linksAnexos: bloco.querySelector('.diario-aula-links').value,
                trabalhoAnunciado: bloco.querySelector('.diario-aula-trabalho').value,
                dificuldade: parseInt(bloco.querySelector('.diario-aula-dificuldade').value, 10) || 3,
                precisoRevisar: bloco.querySelector('.diario-aula-revisar').checked,
                observacoes: bloco.querySelector('.diario-aula-observacoes').value
            };

            await window.classDiaryService.registrarDiario(diaryData);
        }

        document.getElementById('modal-diario').style.display = 'none';
        if (app.currentView === 'diario') {
            app.loadView('diario');
        } else {
            showToast('Registro salvo no Diário!');
        }
    }
}

window.diaryView = new DiaryView();

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('diario-add-aula-btn')?.addEventListener('click', () => {
        window.diaryView.addAulaBlock(window.app);
    });
});
