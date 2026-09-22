// semester-history-manager.js
// Histórico acadêmico completo: migração de dados legados + cadastro manual de semestres.
(function () {
    'use strict';

    const CLONE = value => {
        try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
    };
    const slug = value => String(value || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ').trim();
    const esc = value => String(value ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    const id = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const num = (v, fallback = 0) => {
        const n = Number(String(v ?? '').replace(',', '.'));
        return Number.isFinite(n) ? n : fallback;
    };

    function normalizeSubject(item, fallbackStatus = 'concluida') {
        const statusMap = { aprovado: 'concluida', aprovada: 'concluida', concluido: 'concluida', concluída: 'concluida', reprovado: 'reprovada', reprovada: 'reprovada', trancado: 'trancada', trancada: 'trancada', cursando: 'cursando' };
        const rawStatus = String(item?.status || item?.resultado || fallbackStatus).toLowerCase().trim();
        const status = statusMap[rawStatus] || rawStatus || fallbackStatus;
        const finalGradeRaw = item?.notaFinal ?? item?.nota ?? item?.media ?? '';
        const finalGrade = finalGradeRaw === '' || finalGradeRaw === null || finalGradeRaw === undefined ? null : num(finalGradeRaw, null);
        return {
            id: item?.id || id('hist-sub'),
            codigo: String(item?.codigo || '').trim().toUpperCase(),
            nome: String(item?.nome || item?.materia || '').trim(),
            semestre: String(item?.semestre || '').trim(),
            cargaHoraria: num(item?.cargaHoraria ?? item?.horas, 0),
            creditos: num(item?.creditos, 0),
            tipo: item?.tipo || 'obrigatoria',
            status,
            nota: finalGrade,
            notaFinal: finalGrade,
            prerequisitosLista: Array.isArray(item?.prerequisitosLista) ? CLONE(item.prerequisitosLista) : [],
            prerequisitos: item?.prerequisitos || '',
            observacoes: String(item?.observacoes || '').trim(),
            tentativas: Array.isArray(item?.tentativas) ? CLONE(item.tentativas) : []
        };
    }

    function normalizeArchive(raw, index = 0) {
        const subjectsSource = Array.isArray(raw?.subjects) ? raw.subjects : (Array.isArray(raw?.curriculum) ? raw.curriculum : []);
        const names = Array.isArray(raw?.materias) ? raw.materias : subjectsSource.map(s => s?.nome).filter(Boolean);
        const subjects = subjectsSource.length
            ? subjectsSource.map(s => normalizeSubject(s))
            : names.map(nome => normalizeSubject({ nome }));
        const curriculum = Array.isArray(raw?.curriculum) && raw.curriculum.length
            ? raw.curriculum.map(s => normalizeSubject(s))
            : subjects.map(s => ({ ...CLONE(s), status: s.status || 'concluida' }));
        const numero = num(raw?.numero ?? raw?.semestre, 0) || null;
        return {
            id: raw?.id || id('hist-sem'),
            tipo: raw?.tipo || 'finalizado',
            origem: raw?.origem || 'site',
            numero,
            semestre: numero || raw?.semestre || null,
            periodo: String(raw?.periodo || raw?.anoPeriodo || '').trim(),
            titulo: String(raw?.titulo || '').trim(),
            inicio: raw?.inicio || null,
            fim: raw?.fim || raw?.finalizadoEm || null,
            finalizadoEm: raw?.finalizadoEm || raw?.fim || null,
            observacoes: String(raw?.observacoes || '').trim(),
            materias: [...new Set(names.map(String).filter(Boolean))],
            subjects,
            curriculum,
            grades: Array.isArray(raw?.grades) ? CLONE(raw.grades) : [],
            sessions: Array.isArray(raw?.sessions) ? CLONE(raw.sessions) : [],
            tasks: Array.isArray(raw?.tasks) ? CLONE(raw.tasks) : [],
            exams: Array.isArray(raw?.exams) ? CLONE(raw.exams) : [],
            materials: Array.isArray(raw?.materials) ? CLONE(raw.materials) : [],
            learningMap: Array.isArray(raw?.learningMap) ? CLONE(raw.learningMap) : [],
            classDiaries: Array.isArray(raw?.classDiaries) ? CLONE(raw.classDiaries) : [],
            reviews: Array.isArray(raw?.reviews) ? CLONE(raw.reviews) : [],
            classSchedule: Array.isArray(raw?.classSchedule) ? CLONE(raw.classSchedule) : [],
            attendance: raw?.attendance && typeof raw.attendance === 'object' ? CLONE(raw.attendance) : {},
            recovered: !!raw?.recovered,
            recoveryNote: String(raw?.recoveryNote || '').trim()
        };
    }

    function getArchives(app) {
        if (!Array.isArray(app.data.archivedSemesters)) app.data.archivedSemesters = [];
        return app.data.archivedSemesters;
    }

    function archiveKey(a) {
        return `${a?.numero || a?.semestre || ''}|${String(a?.periodo || '').toLowerCase()}|${String(a?.titulo || '').toLowerCase()}`;
    }

    // Recupera automaticamente históricos antigos que não tinham archivedSemesters.
    // A única fonte realmente confiável nesse caso são as tentativas registradas
    // pela finalização; tarefas/notas sem identificador de semestre não são movidas.
    function migrateLegacy(app) {
        const rawArchives = [];
        const candidateKeys = ['historicoSemestres', 'semestresAnteriores', 'semesterHistory', 'completedSemesters', 'finishedSemesters'];
        candidateKeys.forEach(key => {
            if (Array.isArray(app.data[key])) rawArchives.push(...app.data[key]);
        });
        if (Array.isArray(app.data.archivedSemesters)) rawArchives.push(...app.data.archivedSemesters);

        const normalized = rawArchives.map((a, i) => normalizeArchive(a, i));
        const byKey = new Map(normalized.map(a => [archiveKey(a), a]));
        const curriculum = Array.isArray(app.data.curriculum) ? app.data.curriculum : [];
        const attemptsBySemester = new Map();

        curriculum.forEach(item => {
            const attempts = Array.isArray(item?.tentativas) ? item.tentativas : [];
            attempts.forEach(attempt => {
                const sem = num(attempt?.semestre, 0);
                if (!sem) return;
                if (!attemptsBySemester.has(sem)) attemptsBySemester.set(sem, []);
                attemptsBySemester.get(sem).push({ item, attempt });
            });
        });

        let created = 0;
        attemptsBySemester.forEach((entries, sem) => {
            const existing = normalized.find(a => num(a.numero ?? a.semestre, 0) === sem);
            if (existing) {
                entries.forEach(({ item, attempt }) => {
                    const key = slug(item.nome);
                    const target = existing.subjects.find(s => slug(s.nome) === key);
                    if (target) {
                        target.tentativas = [...(target.tentativas || []), CLONE(attempt)];
                        if (attempt.nota !== undefined && attempt.nota !== null) target.nota = num(attempt.nota, target.nota);
                        if (attempt.resultado) target.status = String(attempt.resultado).toLowerCase().startsWith('reprov') ? 'reprovada' : 'concluida';
                    }
                });
                existing.materias = [...new Set(existing.subjects.map(s => s.nome).filter(Boolean))];
                existing.curriculum = existing.subjects.map(s => CLONE(s));
                return;
            }

            const subjects = [];
            entries.forEach(({ item, attempt }) => {
                const subject = normalizeSubject({ ...item, nota: attempt.nota, status: attempt.resultado });
                const existingSubject = subjects.find(s => slug(s.nome) === slug(subject.nome));
                if (existingSubject) {
                    existingSubject.tentativas = [...(existingSubject.tentativas || []), CLONE(attempt)];
                } else {
                    subject.tentativas = [CLONE(attempt)];
                    subjects.push(subject);
                }
            });
            const archive = normalizeArchive({
                id: id('hist-recovered'),
                tipo: 'recuperado', origem: 'dados-legados', numero: sem, semestre: sem,
                titulo: `${sem}º semestre recuperado`,
                finalizadoEm: entries.map(e => e.attempt?.data).filter(Boolean).sort().pop() || null,
                materias: subjects.map(s => s.nome), subjects, curriculum: subjects,
                recovered: true,
                recoveryNote: 'Recuperado automaticamente das tentativas registradas antes do sistema de histórico. Tarefas, provas e avaliações detalhadas só entram aqui quando o semestre estava identificado nos dados.'
            });
            byKey.set(archiveKey(archive), archive);
            created++;
        });

        const merged = [...byKey.values()].sort((a, b) => (num(a.numero, 999) - num(b.numero, 999)) || String(a.periodo).localeCompare(String(b.periodo)));
        const hasLegacyArrays = candidateKeys.some(key => Array.isArray(app.data[key]) && app.data[key].length);
        const changed = created > 0 || hasLegacyArrays;
        if (changed) {
            app.data.archivedSemesters = merged;
            // Só salva a coleção nova. Nunca apaga os campos antigos.
            window.dbService?.saveData?.('archivedSemesters', merged).catch(() => {});
        }
        return { created, total: merged.length };
    }

    function stats(archives) {
        let subjects = 0, passed = 0, failed = 0, locked = 0, hours = 0, credits = 0;
        archives.forEach(a => (a.subjects || a.curriculum || []).forEach(s => {
            subjects++; hours += num(s.cargaHoraria); credits += num(s.creditos);
            const st = String(s.status || '').toLowerCase();
            if (st === 'concluida' || st === 'aprovado' || st === 'aprovada') passed++;
            else if (st === 'reprovada' || st === 'reprovado') failed++;
            else if (st === 'trancada' || st === 'trancado') locked++;
        }));
        return { semesters: archives.length, subjects, passed, failed, locked, hours, credits };
    }

    function injectStyles() {
        if (document.getElementById('hist-manager-styles')) return;
        const style = document.createElement('style');
        style.id = 'hist-manager-styles';
        style.textContent = `
          .hist-overlay{position:fixed;inset:0;z-index:11000;background:rgba(2,6,23,.78);display:flex;align-items:center;justify-content:center;padding:14px;}
          .hist-modal{width:min(1080px,100%);max-height:94vh;overflow:auto;background:var(--bg-secondary,#151f2f);color:var(--text-primary,#f8fafc);border:1px solid var(--border,#2d3a4f);border-radius:24px;box-shadow:0 30px 90px rgba(0,0,0,.55);}
          .hist-head{position:sticky;top:0;z-index:3;padding:20px 22px;border-bottom:1px solid var(--border,#2d3a4f);background:var(--bg-secondary,#151f2f);display:flex;justify-content:space-between;gap:16px;align-items:flex-start;}
          .hist-head h2{margin:0 0 4px;font-size:1.25rem}.hist-head p{margin:0;color:var(--text-secondary,#94a3b8);font-size:.9rem}.hist-close{border:0;background:none;color:inherit;font-size:1.5rem;cursor:pointer}
          .hist-body{padding:20px 22px}.hist-kpis{display:grid;grid-template-columns:repeat(6,minmax(100px,1fr));gap:10px;margin-bottom:18px}.hist-kpi{padding:13px;border:1px solid var(--border,#2d3a4f);background:var(--bg-tertiary,#1e2b3a);border-radius:15px}.hist-kpi strong{display:block;font-size:1.15rem;color:var(--accent-primary,#60a5fa);margin-top:3px}.hist-kpi small{color:var(--text-secondary,#94a3b8)}
          .hist-toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px}.hist-search{flex:1;min-width:220px}.hist-search input,.hist-field input,.hist-field select,.hist-field textarea{width:100%;box-sizing:border-box;border:1px solid var(--border,#2d3a4f);border-radius:10px;padding:10px 11px;background:var(--bg-primary,#0a0f1f);color:inherit;font:inherit}.hist-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.hist-card{border:1px solid var(--border,#2d3a4f);border-radius:18px;background:var(--bg-tertiary,#1e2b3a);padding:16px}.hist-card-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.hist-card h3{margin:0;font-size:1.05rem}.hist-card-meta{color:var(--text-secondary,#94a3b8);font-size:.8rem;margin-top:4px}.hist-badges{display:flex;flex-wrap:wrap;gap:6px;margin:11px 0}.hist-badge{font-size:.72rem;padding:4px 8px;border-radius:999px;background:rgba(59,130,246,.12);color:#93c5fd}.hist-badge.warn{background:rgba(245,158,11,.12);color:#fbbf24}.hist-subjects{display:grid;gap:6px;margin:10px 0}.hist-subject-row{display:flex;justify-content:space-between;gap:10px;padding:8px 10px;border-radius:10px;background:rgba(15,23,42,.18);font-size:.84rem}.hist-subject-row small{color:var(--text-secondary,#94a3b8)}
          .hist-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.hist-actions button,.hist-btn{border:1px solid var(--border,#2d3a4f);border-radius:10px;padding:8px 11px;background:transparent;color:inherit;cursor:pointer;font:inherit;font-weight:650}.hist-btn.primary{background:var(--accent-primary,#3b82f6);border-color:transparent;color:#fff}.hist-btn.danger{color:#fca5a5}.hist-empty{text-align:center;padding:42px 20px;color:var(--text-secondary,#94a3b8);border:1px dashed var(--border,#2d3a4f);border-radius:16px}.hist-import-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.hist-field{min-width:0}.hist-field label{display:block;font-size:.75rem;font-weight:700;color:var(--text-secondary,#94a3b8);margin-bottom:5px}.hist-field.full{grid-column:1/-1}.hist-subject-editor{border:1px solid var(--border,#2d3a4f);border-radius:15px;padding:12px;margin-top:12px}.hist-subject-editor-head{display:flex;justify-content:space-between;gap:8px;align-items:center}.hist-table-wrap{overflow:auto;margin-top:10px}.hist-table{width:100%;border-collapse:collapse;min-width:820px}.hist-table th,.hist-table td{padding:7px;border-bottom:1px solid var(--border,#2d3a4f);text-align:left;font-size:.8rem}.hist-table input,.hist-table select{width:100%;box-sizing:border-box;padding:7px;border-radius:8px;border:1px solid var(--border,#2d3a4f);background:var(--bg-primary,#0a0f1f);color:inherit}.hist-bulk{margin-top:14px}.hist-bulk textarea{min-height:120px}.hist-step{display:none}.hist-step.active{display:block}.hist-footer{display:flex;justify-content:space-between;gap:10px;padding:16px 22px;border-top:1px solid var(--border,#2d3a4f);flex-wrap:wrap}.hist-footer-right{display:flex;gap:8px;flex-wrap:wrap}.hist-note{padding:11px 13px;border-radius:12px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.18);color:#fbbf24;font-size:.82rem;margin:12px 0}.hist-progress{display:flex;gap:7px;margin-bottom:16px}.hist-progress span{height:5px;flex:1;border-radius:99px;background:rgba(148,163,184,.16)}.hist-progress span.active{background:var(--accent-primary,#3b82f6)}
          @media(max-width:800px){.hist-kpis{grid-template-columns:repeat(3,minmax(90px,1fr))}.hist-grid{grid-template-columns:1fr}.hist-import-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
          @media(max-width:520px){.hist-overlay{padding:0}.hist-modal{max-height:100vh;height:100%;border-radius:0}.hist-head,.hist-body,.hist-footer{padding:16px}.hist-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.hist-import-grid{grid-template-columns:1fr}.hist-footer{position:sticky;bottom:0;background:var(--bg-secondary,#151f2f);z-index:4}.hist-head{position:sticky}.hist-card-top{flex-direction:column}.hist-actions button{flex:1}.hist-toolbar .hist-btn{width:100%}}
        `;
        document.head.appendChild(style);
    }

    function closeOverlay() { document.querySelector('.hist-overlay')?.remove(); }

    function parseSigaaText(text) {
        const lines = String(text || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
        const rows = [];
        let current = null;
        const headerRe = /^(\d{4})\.(\d)\s+(.+)$/;
        const resultRe = /([A-Z]{2,}\d{4})\s+(\d+)\s+(\d+)\s+(\d+)\s+([\d,.-]+|--)\s+([\d,.-]+|--)\s+([\d,.-]+|--)\s+([A-Z]+)\s*$/;
        const statusMap = {
            APR: 'concluida', APRN: 'concluida', DISP: 'concluida', TRANS: 'concluida', INCORP: 'concluida', CUMP: 'concluida',
            REP: 'reprovada', REPF: 'reprovada', REPMF: 'reprovada', REPN: 'reprovada', REPNF: 'reprovada',
            TRANC: 'trancada', CANC: 'trancada'
        };
        const toNum = value => { const n = Number(String(value || '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
        for (const line of lines) {
            const h = line.match(headerRe);
            if (h) {
                current = { year: Number(h[1]), half: Number(h[2]), period: `${h[1]}.${h[2]}`, name: h[3] };
                continue;
            }
            if (!current) continue;
            const r = line.match(resultRe);
            if (!r) continue;
            const [, codigo, ch, , , , media, , status] = r;
            const normalizedStatus = statusMap[status];
            if (!normalizedStatus) { current = null; continue; }
            const nome = current.name.replace(/\s+/g, ' ').trim();
            if (!nome || /^(ENADE|COMPONENTES|CÓDIGO|COMPONENTE CURRICULAR)$/i.test(nome)) { current = null; continue; }
            rows.push({
                periodo: current.period,
                ano: current.year,
                etapa: current.half,
                nome,
                codigo,
                cargaHoraria: Number(ch) || 0,
                creditos: 0,
                status: normalizedStatus,
                nota: toNum(media),
                notaFinal: toNum(media)
            });
            current = null;
        }
        const periods = [...new Set(rows.map(r => r.periodo))].sort();
        const first = periods[0];
        const firstYear = first ? Number(first.split('.')[0]) : 0;
        const firstHalf = first ? Number(first.split('.')[1]) : 1;
        const grouped = new Map();
        rows.forEach(row => {
            const ordinal = firstYear ? ((row.ano - firstYear) * 2 + (row.etapa - firstHalf) + 1) : 0;
            if (!grouped.has(row.periodo)) grouped.set(row.periodo, { numero: ordinal, periodo: row.periodo, subjects: [] });
            const g = grouped.get(row.periodo);
            if (!g.subjects.some(s => slug(s.nome) === slug(row.nome))) g.subjects.push(normalizeSubject(row));
        });
        return [...grouped.values()].sort((a,b) => a.periodo.localeCompare(b.periodo));
    }

    function renderSigaaImporter(app) {
        injectStyles(); closeOverlay();
        const overlay = document.createElement('div'); overlay.className='hist-overlay';
        overlay.innerHTML=`<div class="hist-modal"><div class="hist-head"><div><h2><i class="fas fa-file-import"></i> Importar histórico do SIGAA</h2><p>Cole o texto copiado do PDF/histórico. O SLC identifica automaticamente período, disciplina, código, carga horária, situação e média.</p></div><button class="hist-close" type="button">&times;</button></div><div class="hist-body"><div class="hist-field"><label>Texto do histórico</label><textarea id="sigaa-text" style="min-height:280px" placeholder="Cole aqui o texto do histórico escolar do SIGAA..."></textarea></div><div id="sigaa-preview" style="margin-top:14px"></div></div><div class="hist-footer"><button class="hist-btn" id="sigaa-cancel">Cancelar</button><div class="hist-footer-right"><button class="hist-btn" id="sigaa-preview-btn"><i class="fas fa-eye"></i> Analisar</button><button class="hist-btn primary" id="sigaa-import-btn" disabled><i class="fas fa-check"></i> Importar semestres</button></div></div></div>`;
        document.body.appendChild(overlay);
        const close=()=>overlay.remove(); overlay.querySelector('.hist-close').onclick=close; overlay.querySelector('#sigaa-cancel').onclick=close;
        let parsed=[];
        overlay.querySelector('#sigaa-preview-btn').onclick=()=>{
            parsed=parseSigaaText(overlay.querySelector('#sigaa-text').value);
            const host=overlay.querySelector('#sigaa-preview');
            if(!parsed.length){host.innerHTML='<div class="hist-empty">Não encontrei linhas no formato esperado. No SIGAA, copie também a parte "Componentes Curriculares Cursados/Cursando".</div>';overlay.querySelector('#sigaa-import-btn').disabled=true;return;}
            host.innerHTML=`<div class="hist-kpis">${parsed.map(g=>`<div class="hist-kpi"><small>${esc(g.periodo)}</small><strong>${g.subjects.length}</strong><small>disciplinas</small></div>`).join('')}</div><div class="hist-note">Foram encontrados ${parsed.reduce((n,g)=>n+g.subjects.length,0)} componentes em ${parsed.length} período(s). O número do semestre é calculado pela ordem cronológica e pode ser ajustado depois.</div><div class="hist-grid">${parsed.map(g=>`<div class="hist-card"><h3>${g.numero}º semestre — ${esc(g.periodo)}</h3><div class="hist-subjects">${g.subjects.map(s=>`<div class="hist-subject-row"><span>${esc(s.nome)}</span><small>${esc(s.codigo)} • ${s.notaFinal ?? '—'} • ${s.status==='concluida'?'APR':s.status==='reprovada'?'REP':'TRANC'}</small></div>`).join('')}</div></div>`).join('')}</div>`;
            overlay.querySelector('#sigaa-import-btn').disabled=false;
        };
        overlay.querySelector('#sigaa-import-btn').onclick=async()=>{
            if(!parsed.length)return;
            const archives=getArchives(app); let added=0, skipped=0;
            parsed.forEach(g=>{
                if(archives.some(a=>String(a.periodo||'')===g.periodo)){skipped++;return;}
                const importedSubjects=g.subjects.map(s=>({...s,semestre:String(g.numero)}));
                const archive=normalizeArchive({id:id('hist-sigaa'),tipo:'manual',origem:'SIGAA',numero:g.numero,semestre:g.numero,periodo:g.periodo,titulo:`${g.numero}º semestre — ${g.periodo}`,subjects:importedSubjects,curriculum:importedSubjects,materias:importedSubjects.map(s=>s.nome),finalizadoEm:null});
                archives.push(archive);added++;
            });
            archives.sort((a,b)=>(num(a.numero,999)-num(b.numero,999))||String(a.periodo).localeCompare(String(b.periodo)));
            const ok=await window.dbService?.saveData?.('archivedSemesters',archives); if(!ok){showToast?.('Falha ao salvar o histórico importado.','error');return;}
            showToast?.(`${added} semestre(s) importado(s)${skipped?`; ${skipped} já existente(s) foram ignorados`:''}.`,'success');
            close(); renderMain(app);
        };
    }

    function renderMain(app, filter = '') {
        injectStyles();
        closeOverlay();
        const archives = getArchives(app).map(normalizeArchive);
        const q = slug(filter);
        const visible = archives.map((a, originalIndex) => ({ a, originalIndex })).filter(x => !q || slug(`${x.a.numero} ${x.a.periodo} ${x.a.titulo} ${x.a.materias.join(' ')}`).includes(q));
        const s = stats(archives);
        const overlay = document.createElement('div');
        overlay.className = 'hist-overlay';
        overlay.innerHTML = `<div class="hist-modal">
          <div class="hist-head"><div><h2><i class="fas fa-clock-rotate-left"></i> Histórico acadêmico</h2><p>Semestres finalizados pelo site e semestres anteriores cadastrados manualmente. O histórico é separado do semestre atual.</p></div><button class="hist-close" type="button">&times;</button></div>
          <div class="hist-body">
            <div class="hist-kpis">
              <div class="hist-kpi"><small>Semestres</small><strong>${s.semesters}</strong></div><div class="hist-kpi"><small>Disciplinas</small><strong>${s.subjects}</strong></div><div class="hist-kpi"><small>Aprovadas</small><strong>${s.passed}</strong></div><div class="hist-kpi"><small>Reprovadas</small><strong>${s.failed}</strong></div><div class="hist-kpi"><small>Horas</small><strong>${s.hours}</strong></div><div class="hist-kpi"><small>Créditos</small><strong>${s.credits}</strong></div>
            </div>
            <div class="hist-toolbar"><div class="hist-search"><input id="hist-search" placeholder="Buscar semestre, período ou matéria..." value="${esc(filter)}"></div><button class="hist-btn primary" id="hist-new"><i class="fas fa-plus"></i> Cadastrar semestre</button><button class="hist-btn" id="hist-sigaa"><i class="fas fa-file-import"></i> Importar SIGAA</button><button class="hist-btn" id="hist-recover"><i class="fas fa-wand-magic-sparkles"></i> Recuperar dados antigos</button></div>
            <div class="hist-grid">
              ${visible.length ? visible.sort((x,y)=>(num(y.a.numero,0)-num(x.a.numero,0)) || String(y.a.periodo).localeCompare(String(x.a.periodo))).map(x => cardHtml(x.a, x.originalIndex)).join('') : '<div class="hist-empty" style="grid-column:1/-1"><i class="fas fa-box-open"></i><br><br>Nenhum semestre encontrado.</div>'}
            </div>
          </div></div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('.hist-close').onclick = closeOverlay;
        overlay.addEventListener('click', e => { if (e.target === overlay) closeOverlay(); });
        overlay.querySelector('#hist-new').onclick = () => renderEditor(app, null);
        overlay.querySelector('#hist-sigaa').onclick = () => renderSigaaImporter(app);
        overlay.querySelector('#hist-recover').onclick = () => { migrateLegacy(app); renderMain(app, filter); };
        overlay.querySelector('#hist-search').oninput = e => {
            const value = e.target.value;
            clearTimeout(overlay.__searchTimer); overlay.__searchTimer = setTimeout(() => renderMain(app, value), 180);
        };
        overlay.querySelectorAll('[data-hist-open]').forEach(btn => btn.onclick = async () => {
            const archive = getArchives(app)[Number(btn.dataset.histOpen)];
            if (!archive) return;
            closeOverlay();
            await app.enterSemesterContext?.(Number(btn.dataset.histOpen));
        });
        overlay.querySelectorAll('[data-hist-edit]').forEach(btn => btn.onclick = () => renderEditor(app, Number(btn.dataset.histEdit)));
        overlay.querySelectorAll('[data-hist-delete]').forEach(btn => btn.onclick = async () => {
            const idx = Number(btn.dataset.histDelete); const archive = getArchives(app)[idx]; if (!archive) return;
            if (!confirm(`Excluir o registro histórico de ${archive.numero ? archive.numero + 'º semestre' : 'este semestre'}? Isso não altera o semestre atual.`)) return;
            getArchives(app).splice(idx, 1);
            const ok = await window.dbService?.saveData?.('archivedSemesters', getArchives(app));
            if (!ok) { showToast?.('Não foi possível salvar a exclusão.', 'error'); return; }
            showToast?.('Registro histórico excluído.', 'success'); renderMain(app, filter);
        });
    }

    function cardHtml(a, index) {
        const subjects = a.subjects || a.curriculum || [];
        const passed = subjects.filter(s => ['concluida','aprovado','aprovada'].includes(String(s.status).toLowerCase())).length;
        const failed = subjects.filter(s => ['reprovada','reprovado'].includes(String(s.status).toLowerCase())).length;
        const title = a.titulo || (a.numero ? `${a.numero}º semestre` : 'Semestre histórico');
        const period = a.periodo ? ` • ${esc(a.periodo)}` : '';
        return `<article class="hist-card"><div class="hist-card-top"><div><h3>${esc(title)}</h3><div class="hist-card-meta">${a.tipo === 'recuperado' ? 'Recuperado dos dados antigos' : a.tipo === 'manual' ? 'Cadastro manual' : 'Finalizado pelo SLC'}${period}</div></div><span class="hist-badge">${subjects.length} matéria(s)</span></div>
          <div class="hist-badges"><span class="hist-badge">${passed} aprovadas</span><span class="hist-badge">${failed} reprovadas</span>${a.recovered ? '<span class="hist-badge warn">Dados recuperados</span>' : ''}</div>
          <div class="hist-subjects">${subjects.slice(0,6).map(s => `<div class="hist-subject-row"><span>${esc(s.nome)}</span><small>${s.notaFinal ?? s.nota ?? '—'} ${num(s.cargaHoraria) ? '• '+num(s.cargaHoraria)+'h' : ''}</small></div>`).join('')}${subjects.length > 6 ? `<small class="text-secondary">+ ${subjects.length-6} matérias</small>` : ''}</div>
          ${a.recoveryNote ? `<div class="hist-note">${esc(a.recoveryNote)}</div>` : ''}
          <div class="hist-actions"><button class="hist-btn primary" data-hist-open="${index}"><i class="fas fa-pen"></i> Abrir e editar</button><button class="hist-btn" data-hist-edit="${index}"><i class="fas fa-sliders"></i> Dados do semestre</button><button class="hist-btn danger" data-hist-delete="${index}"><i class="fas fa-trash"></i></button></div>
        </article>`;
    }

    function renderEditor(app, index) {
        injectStyles(); closeOverlay();
        const existing = index === null ? null : normalizeArchive(getArchives(app)[index]);
        let step = 1;
        let draft = existing ? CLONE(existing) : normalizeArchive({ tipo:'manual', origem:'cadastro-manual', numero:'', periodo:'', titulo:'', subjects:[], curriculum:[] });
        draft.tipo = existing?.tipo || 'manual'; draft.origem = existing?.origem || 'cadastro-manual';
        draft.numero = existing?.numero || ''; draft.semestre = draft.numero;
        if (!Array.isArray(draft.subjects)) draft.subjects = [];
        if (!Array.isArray(draft.grades)) draft.grades = [];

        const overlay = document.createElement('div'); overlay.className='hist-overlay';
        overlay.innerHTML = `<div class="hist-modal"><div class="hist-head"><div><h2>${existing ? 'Editar semestre histórico' : 'Cadastrar semestre anterior'}</h2><p>Você pode cadastrar um semestre completo sem alterar o semestre atual.</p></div><button class="hist-close" type="button">&times;</button></div><div class="hist-body"><div class="hist-progress"><span class="active"></span><span></span><span></span></div>
          <section class="hist-step active" data-step="1"><h3>1. Identificação</h3><div class="hist-import-grid">
            <div class="hist-field"><label>Número do semestre</label><input id="he-num" type="number" min="1" max="20" value="${esc(draft.numero)}" placeholder="Ex.: 1"></div>
            <div class="hist-field"><label>Período letivo</label><input id="he-periodo" value="${esc(draft.periodo)}" placeholder="Ex.: 2025.1"></div>
            <div class="hist-field"><label>Início</label><input id="he-inicio" type="date" value="${esc(String(draft.inicio||'').slice(0,10))}"></div>
            <div class="hist-field"><label>Fim</label><input id="he-fim" type="date" value="${esc(String(draft.fim||'').slice(0,10))}"></div>
            <div class="hist-field full"><label>Nome personalizado</label><input id="he-titulo" value="${esc(draft.titulo)}" placeholder="Ex.: 1º semestre — 2025.1"></div>
            <div class="hist-field full"><label>Observações</label><textarea id="he-obs" placeholder="Opcional: trancamentos, equivalências, observações do histórico...">${esc(draft.observacoes)}</textarea></div>
          </div><div class="hist-note">Use o número do semestre acadêmico, não a posição atual no site. O período letivo é opcional, mas ajuda a organizar seu histórico.</div></section>
          <section class="hist-step" data-step="2"><h3>2. Disciplinas</h3><p class="text-secondary">Cadastre as matérias e depois informe carga horária, créditos, resultado e nota final. Também há importação rápida por texto.</p><div id="hist-subject-list"></div><button class="hist-btn" id="he-add-sub"><i class="fas fa-plus"></i> Adicionar matéria</button>
            <div class="hist-bulk"><div class="hist-field"><label>Importação rápida — uma matéria por linha</label><textarea id="he-bulk" placeholder="CET0001 | Cálculo I | 60 | 4 | aprovado | 8,5\nCET0002 | Física I | 60 | 4 | reprovado | 4,2\nGeometria Analítica | 90 | 6 | aprovado | 7,8"></textarea></div><button class="hist-btn" id="he-parse"><i class="fas fa-file-import"></i> Adicionar linhas</button><small class="text-secondary">Formato aceito: código | nome | horas | créditos | status | nota. Se não houver código, comece pelo nome.</small></div>
          </section>
          <section class="hist-step" data-step="3"><h3>3. Avaliações detalhadas <span class="hist-badge">opcional</span></h3><p class="text-secondary">O histórico pode guardar só a nota final. Se quiser reproduzir a previsão de notas antiga, registre P1/P2/trabalhos com seus pesos.</p><div id="hist-grade-editor"></div><button class="hist-btn" id="he-add-grade"><i class="fas fa-plus"></i> Adicionar avaliação</button><div class="hist-note">As avaliações cadastradas aqui ficam dentro deste semestre histórico e não aparecem na previsão do semestre atual.</div></section>
        </div><div class="hist-footer"><button class="hist-btn" id="he-cancel">Cancelar</button><div class="hist-footer-right"><button class="hist-btn" id="he-back" style="display:none">Voltar</button><button class="hist-btn primary" id="he-next">Continuar</button></div></div></div>`;
        document.body.appendChild(overlay);
        const close = () => overlay.remove(); overlay.querySelector('.hist-close').onclick=close; overlay.querySelector('#he-cancel').onclick=close;

        const steps = () => { overlay.querySelectorAll('.hist-step').forEach(el => el.classList.toggle('active', Number(el.dataset.step)===step)); overlay.querySelectorAll('.hist-progress span').forEach((el,i)=>el.classList.toggle('active',i<step)); overlay.querySelector('#he-back').style.display=step>1?'inline-flex':'none'; overlay.querySelector('#he-next').textContent=step===3?'Salvar semestre':'Continuar'; };
        const readMeta = () => { draft.numero=num(overlay.querySelector('#he-num').value,0)||null; draft.semestre=draft.numero; draft.periodo=overlay.querySelector('#he-periodo').value.trim(); draft.inicio=overlay.querySelector('#he-inicio').value||null; draft.fim=overlay.querySelector('#he-fim').value||null; draft.titulo=overlay.querySelector('#he-titulo').value.trim() || (draft.numero ? `${draft.numero}º semestre${draft.periodo?' — '+draft.periodo:''}` : 'Semestre histórico'); draft.observacoes=overlay.querySelector('#he-obs').value.trim(); };
        const renderSubjects = () => { const host=overlay.querySelector('#hist-subject-list'); host.innerHTML = draft.subjects.map((s,i)=>`<div class="hist-subject-editor" data-si="${i}"><div class="hist-subject-editor-head"><strong>Matéria ${i+1}</strong><button class="hist-btn danger" data-remove-sub="${i}"><i class="fas fa-trash"></i></button></div><div class="hist-table-wrap"><table class="hist-table"><thead><tr><th>Nome</th><th>Código</th><th>Horas</th><th>Créditos</th><th>Status</th><th>Nota final</th></tr></thead><tbody><tr><td><input data-f="nome" value="${esc(s.nome)}"></td><td><input data-f="codigo" value="${esc(s.codigo)}"></td><td><input data-f="cargaHoraria" type="number" min="0" value="${num(s.cargaHoraria)||''}"></td><td><input data-f="creditos" type="number" min="0" value="${num(s.creditos)||''}"></td><td><select data-f="status"><option value="concluida" ${s.status==='concluida'?'selected':''}>Aprovada</option><option value="reprovada" ${s.status==='reprovada'?'selected':''}>Reprovada</option><option value="trancada" ${s.status==='trancada'?'selected':''}>Trancada</option></select></td><td><input data-f="notaFinal" type="number" min="0" max="10" step="0.1" value="${s.notaFinal??''}"></td></tr></tbody></table></div></div>`).join('') || '<div class="hist-empty">Nenhuma matéria cadastrada. Adicione manualmente ou use a importação rápida.</div>'; host.querySelectorAll('[data-remove-sub]').forEach(btn=>btn.onclick=()=>{draft.subjects.splice(Number(btn.dataset.removeSub),1);renderSubjects();}); host.querySelectorAll('.hist-subject-editor').forEach((row)=>row.querySelectorAll('[data-f]').forEach(input=>input.onchange=()=>{const s=draft.subjects[Number(row.dataset.si)]; const f=input.dataset.f; s[f]=['cargaHoraria','creditos'].includes(f)?num(input.value):f==='notaFinal'?(input.value===''?null:num(input.value)):input.value;})); };
        const addSubject=(s={})=>{draft.subjects.push(normalizeSubject({...s,status:s.status||'concluida'}));renderSubjects();};
        const parseBulk=()=>{const text=overlay.querySelector('#he-bulk').value; text.split(/\n+/).map(x=>x.trim()).filter(Boolean).forEach(line=>{const p=line.split('|').map(x=>x.trim()); if(p.length>=2){let codigo='',nome='',hours=0,credits=0,status='concluida',grade=null;if(p.length>=6){[codigo,nome]=p;hours=num(p[2]);credits=num(p[3]);status=p[4];grade=p[5]===''?null:num(p[5],null);}else{nome=p[0];hours=num(p[1]);credits=num(p[2]);status=p[3]||'concluida';grade=p[4]===''||p[4]===undefined?null:num(p[4],null);} addSubject({codigo,nome,cargaHoraria:hours,creditos:credits,status,nota:grade,notaFinal:grade});}});overlay.querySelector('#he-bulk').value='';};
        const renderGrades=()=>{const host=overlay.querySelector('#hist-grade-editor'); const subjects=draft.subjects.filter(s=>s.nome); host.innerHTML=draft.grades.map((g,i)=>`<div class="hist-subject-editor" data-gi="${i}"><div class="hist-table-wrap"><table class="hist-table"><tbody><tr><td><select data-gf="materia">${subjects.map(s=>`<option ${s.nome===g.materia?'selected':''}>${esc(s.nome)}</option>`).join('')}</select></td><td><input data-gf="avaliacao" value="${esc(g.avaliacao)}" placeholder="P1"></td><td><input data-gf="valor" type="number" min="0" max="10" step="0.1" value="${g.valor??''}" placeholder="Nota"></td><td><input data-gf="peso" type="number" min="0.1" max="100" step="0.1" value="${g.peso??''}" placeholder="Peso %"></td><td><button class="hist-btn danger" data-remove-grade="${i}"><i class="fas fa-trash"></i></button></td></tr></tbody></table></div></div>`).join('') || '<div class="hist-empty">Nenhuma avaliação detalhada. Isso é opcional.</div>'; host.querySelectorAll('[data-remove-grade]').forEach(btn=>btn.onclick=()=>{draft.grades.splice(Number(btn.dataset.removeGrade),1);renderGrades();}); host.querySelectorAll('.hist-subject-editor').forEach(row=>row.querySelectorAll('[data-gf]').forEach(input=>input.onchange=()=>{const g=draft.grades[Number(row.dataset.gi)];const f=input.dataset.gf;g[f]=f==='valor'||f==='peso'?num(input.value):input.value;})); };
        overlay.querySelector('#he-add-sub').onclick=()=>addSubject(); overlay.querySelector('#he-parse').onclick=parseBulk; overlay.querySelector('#he-add-grade').onclick=()=>{if(!draft.subjects.length){showToast?.('Cadastre pelo menos uma matéria antes das avaliações.','warning');return;}draft.grades.push({id:id('hist-grade'),materia:draft.subjects[0].nome,avaliacao:'',valor:null,peso:null,data:draft.fim||null});renderGrades();};
        overlay.querySelector('#he-next').onclick=async()=>{readMeta(); if(step===1){if(!draft.numero){showToast?.('Informe o número do semestre.','warning');return;}step=2;renderSubjects();steps();return;} if(step===2){draft.subjects=draft.subjects.map(normalizeSubject).filter(s=>s.nome);if(!draft.subjects.length){showToast?.('Cadastre pelo menos uma matéria.','warning');return;}draft.curriculum=draft.subjects.map(s=>CLONE(s));draft.materias=draft.subjects.map(s=>s.nome);step=3;renderGrades();steps();return;} await saveDraft(app,draft,index);};
        overlay.querySelector('#he-back').onclick=()=>{if(step>1){step--;steps();if(step===2)renderSubjects();}};
        steps(); if(existing) renderSubjects();
    }

    async function saveDraft(app, draft, index) {
        draft.fim = draft.fim || draft.finalizadoEm || new Date().toISOString().slice(0,10);
        draft.finalizadoEm = draft.fim;
        draft.tipo = draft.tipo || 'manual'; draft.origem = draft.origem || 'cadastro-manual';
        draft.subjects = draft.subjects.map(s => normalizeSubject({...s, semestre: draft.numero ? String(draft.numero) : s.semestre})); draft.curriculum=draft.subjects.map(s=>CLONE(s)); draft.materias=draft.subjects.map(s=>s.nome);
        draft.grades = draft.grades.filter(g=>g.materia && Number.isFinite(num(g.valor,NaN)) && num(g.peso,0)>0).map(g=>({...g,id:g.id||id('hist-grade'),valor:num(g.valor),peso:num(g.peso),data:g.data||draft.fim}));
        const totalWeight = new Map(); draft.grades.forEach(g=>totalWeight.set(slug(g.materia),(totalWeight.get(slug(g.materia))||0)+g.peso));
        const invalid = [...totalWeight.values()].some(v=>v>100.0001); if(invalid){showToast?.('Os pesos das avaliações de uma matéria ultrapassam 100%.','warning');return;}
        const archives=getArchives(app); if(index===null){archives.push(draft);}else{archives[index]=draft;}
        const ok=await window.dbService?.saveData?.('archivedSemesters',archives); if(!ok){showToast?.('Não foi possível salvar o semestre.','error');return;}
        showToast?.(index===null?'Semestre histórico cadastrado.':'Semestre histórico atualizado.','success');
        closeOverlay(); renderMain(app);
    }

    function patch() {
        if (!window.StudyLifeControl) return;
        window.StudyLifeControl.prototype.abrirSemestresAnteriores = async function () {
            // O gerenciador trabalha sobre a conta principal. Se estiver dentro
            // de um semestre histórico, primeiro restaura o contexto atual para
            // não editar uma cópia temporária de archivedSemesters.
            if (this._semesterContext?.type === 'archived') {
                const ok = await this.exitSemesterContext?.();
                if (!ok) return;
            }
            renderMain(this);
        };
    }

    function init() {
        if (!window.app) return;
        const result=migrateLegacy(window.app);
        patch();
        // O botão/selector pode ter sido renderizado antes da migração.
        if (result.created) window.app.loadView?.(window.app.currentView || 'dashboard');
    }

    document.addEventListener('app-ready', init);
    if (document.readyState !== 'loading') setTimeout(init, 0);
})();
