// semester-archive-viewer.js - "Semestres anteriores"
// Modal somente-leitura que lista cada semestre já arquivado por
// "Finalizar Semestre" (semester-finish.js), com o total de itens de cada
// tipo e uma lista expansível de tarefas/provas/sessões/notas/etc. Não edita
// nem apaga nada — é só uma forma de consultar o histórico.
(function () {
    'use strict';

    const COLLECTION_LABELS = {
        sessions: { icon: 'fa-stopwatch', label: 'Sessões de estudo' },
        tasks: { icon: 'fa-list-check', label: 'Tarefas' },
        exams: { icon: 'fa-graduation-cap', label: 'Provas e trabalhos' },
        learningMap: { icon: 'fa-map', label: 'Tópicos (mapa de aprendizado)' },
        grades: { icon: 'fa-chart-line', label: 'Notas' },
        materials: { icon: 'fa-folder', label: 'Materiais' },
        classDiaries: { icon: 'fa-book', label: 'Diários de aula' },
        reviews: { icon: 'fa-rotate', label: 'Revisões' },
        classSchedule: { icon: 'fa-table', label: 'Grade horária' }
    };

    function injectStyles() {
        if (document.getElementById('semarch-styles')) return;
        const style = document.createElement('style');
        style.id = 'semarch-styles';
        style.textContent = `
            .semarch-overlay{position:fixed;inset:0;background:rgba(2,6,23,.72);display:flex;align-items:center;justify-content:center;z-index:10000;padding:16px;}
            .semarch-modal{width:min(760px,100%);max-height:92vh;overflow:auto;background:var(--bg-secondary,#151f2f);color:var(--text-primary,#f8fafc);border:1px solid var(--border,#2d3a4f);border-radius:24px;box-shadow:var(--card-shadow,0 25px 80px rgba(0,0,0,.5));}
            .semarch-header{padding:20px 22px;border-bottom:1px solid var(--border,#2d3a4f);display:flex;align-items:flex-start;justify-content:space-between;gap:12px;position:sticky;top:0;background:var(--bg-secondary,#151f2f);}
            .semarch-header h2{margin:0 0 4px;font-size:1.2rem;color:var(--text-primary,#f8fafc);}
            .semarch-header p{margin:0;color:var(--text-secondary,#94a3b8);font-size:.92rem;}
            .semarch-close{cursor:pointer;font-size:1.4rem;line-height:1;opacity:.6;background:none;border:none;color:var(--text-primary,#f8fafc);}
            .semarch-close:hover{opacity:1;}
.semarch-open{border:1px solid rgba(59,130,246,.28);background:rgba(59,130,246,.12);color:#93c5fd;border-radius:10px;padding:7px 11px;font:inherit;font-size:.8rem;font-weight:700;cursor:pointer;white-space:nowrap;}
            .semarch-open:hover{background:rgba(59,130,246,.2);}
            .semarch-body{padding:20px 22px;}
            .semarch-empty{padding:24px;text-align:center;color:var(--text-secondary,#94a3b8);}
            .semarch-item{border:1px solid var(--border,#2d3a4f);border-radius:14px;margin-bottom:12px;background:var(--bg-tertiary,#1e2b3a);overflow:hidden;}
            .semarch-item-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;cursor:pointer;}
            .semarch-item-head strong{display:block;color:var(--text-primary,#f8fafc);font-size:1rem;}
            .semarch-item-head small{color:var(--text-secondary,#94a3b8);}
            .semarch-item-head i.semarch-chevron{transition:transform .15s ease;opacity:.7;}
            .semarch-item.open .semarch-chevron{transform:rotate(180deg);}
            .semarch-item-body{display:none;padding:0 16px 16px;}
            .semarch-item.open .semarch-item-body{display:block;}
            .semarch-materias{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px;}
            .semarch-materia-tag{font-size:.78rem;font-weight:600;padding:3px 10px;border-radius:999px;background:rgba(59,130,246,.14);color:#93c5fd;}
            .semarch-sub{border-top:1px solid var(--border,#2d3a4f);padding-top:10px;margin-top:10px;}
            .semarch-sub-head{display:flex;align-items:center;gap:8px;font-weight:600;color:var(--text-secondary,#94a3b8);font-size:.88rem;margin-bottom:6px;}
            .semarch-sub ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px;}
            .semarch-sub li{font-size:.88rem;color:var(--text-primary,#f8fafc);padding:6px 8px;border-radius:8px;background:var(--bg-primary,#0a0f1f);}
            .semarch-sub li small{display:block;color:var(--text-secondary,#94a3b8);}
            .semarch-sub .semarch-more{color:var(--text-tertiary,#64748b);font-size:.82rem;padding:2px 8px;}
        `;
        document.head.appendChild(style);
    }

    function esc(value) {
        return String(value === undefined || value === null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function formatDate(value) {
        if (!value) return '';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return String(value);
        return d.toLocaleDateString('pt-BR');
    }

    function subCollectionHtml(key, list) {
        const meta = COLLECTION_LABELS[key] || { icon: 'fa-box', label: key };
        const items = Array.isArray(list) ? list : [];
        if (!items.length) return '';
        const visible = items.slice(0, 8);
        const restante = items.length - visible.length;
        const rows = visible.map(item => {
            const titulo = item.titulo || item.topico || item.nome || item.conteudoExplicado || item.avaliacao || 'Item';
            const data = item.data || item.dataLimite || '';
            const materia = item.materia ? ` • ${esc(item.materia)}` : '';
            return `<li><strong>${esc(titulo)}</strong><small>${esc(materia).replace(/^ • /, '')}${data ? ` ${materia ? '•' : ''} ${formatDate(data)}` : ''}</small></li>`;
        }).join('');
        return `
            <div class="semarch-sub">
                <div class="semarch-sub-head"><i class="fas ${meta.icon}"></i> ${meta.label} (${items.length})</div>
                <ul>${rows}${restante > 0 ? `<li class="semarch-more">+ ${restante} outros</li>` : ''}</ul>
            </div>`;
    }

    function archiveItemHtml(archive, index) {
        const materias = Array.isArray(archive.materias) ? archive.materias : [];
        const totalItens = Object.keys(COLLECTION_LABELS).reduce((acc, key) => acc + (Array.isArray(archive[key]) ? archive[key].length : 0), 0);
        const titulo = archive.semestre ? `${archive.semestre}º Semestre` : `Semestre finalizado`;
        const subHtml = Object.keys(COLLECTION_LABELS).map(key => subCollectionHtml(key, archive[key])).join('');

        return `
            <div class="semarch-item" data-semarch-index="${index}">
                <div class="semarch-item-head" data-semarch-toggle="${index}">
                    <div>
                        <strong>${esc(titulo)}</strong>
                        <small>Finalizado em ${formatDate(archive.finalizadoEm)} • ${materias.length} matéria${materias.length === 1 ? '' : 's'} • ${totalItens} itens arquivados</small>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <button type="button" class="semarch-open" data-semarch-open="${index}"><i class="fas fa-pen"></i> Abrir e editar</button>
                        <i class="fas fa-chevron-down semarch-chevron"></i>
                    </div>
                </div>
                <div class="semarch-item-body">
                    <div class="semarch-materias">
                        ${materias.map(m => `<span class="semarch-materia-tag">${esc(m)}</span>`).join('') || '<span class="text-secondary">Nenhuma matéria registrada.</span>'}
                    </div>
                    ${subHtml || '<p class="text-secondary">Nenhum item detalhado guardado neste semestre.</p>'}
                </div>
            </div>`;
    }

    function render(app) {
        injectStyles();
        const archived = Array.isArray(app.data.archivedSemesters) ? app.data.archivedSemesters.slice().reverse() : [];

        const overlay = document.createElement('div');
        overlay.className = 'semarch-overlay';
        overlay.innerHTML = `
            <div class="semarch-modal">
                <div class="semarch-header">
                    <div>
                        <h2><i class="fas fa-box-archive"></i> Semestres anteriores</h2>
                        <p>Abra um semestre anterior para consultar ou editar os dados dele. O histórico fica isolado do semestre atual.</p>
                    </div>
                    <button class="semarch-close" type="button" aria-label="Fechar">&times;</button>
                </div>
                <div class="semarch-body">
                    ${archived.length
                        ? archived.map((archive, i) => archiveItemHtml(archive, i)).join('')
                        : '<div class="semarch-empty">Nenhum semestre finalizado ainda. Quando você usar "Finalizar Semestre", o histórico aparece aqui.</div>'}
                </div>
            </div>`;

        document.body.appendChild(overlay);

        const close = () => overlay.remove();
        overlay.querySelector('.semarch-close').addEventListener('click', close);
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

        overlay.querySelectorAll('[data-semarch-toggle]').forEach(head => {
            head.addEventListener('click', (event) => {
                if (event.target.closest('[data-semarch-open]')) return;
                head.closest('.semarch-item').classList.toggle('open');
            });
        });

        overlay.querySelectorAll('[data-semarch-open]').forEach(btn => {
            btn.addEventListener('click', async (event) => {
                event.stopPropagation();
                const index = Number(btn.dataset.semarchOpen);
                overlay.remove();
                if (Number.isInteger(index) && typeof app.enterSemesterContext === 'function') {
                    await app.enterSemesterContext(index);
                }
            });
        });
    }

    if (window.StudyLifeControl) {
        window.StudyLifeControl.prototype.abrirSemestresAnteriores = function () {
            render(this);
        };
    }
})();
