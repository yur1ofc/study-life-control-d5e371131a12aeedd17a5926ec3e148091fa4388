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
        // Contas novas podem chegar ao init antes de data ser hidratado.
        // A migração é uma operação no-op nesse estado, não deve derrubar o app.
        if (!app || !app.data || typeof app.data !== 'object') return { created: 0, skipped: true };
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
          .hist-catalog-picker{position:fixed;inset:0;z-index:12000;background:rgba(2,6,23,.84);display:flex;align-items:center;justify-content:center;padding:14px}.hist-catalog-box{width:min(900px,100%);max-height:92vh;overflow:auto;background:var(--bg-secondary,#151f2f);color:var(--text-primary,#f8fafc);border:1px solid var(--border,#2d3a4f);border-radius:24px;box-shadow:0 30px 90px rgba(0,0,0,.55)}.hist-catalog-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.hist-catalog-row{display:flex;gap:10px;align-items:flex-start;padding:11px;border:1px solid var(--border,#2d3a4f);border-radius:12px;background:rgba(15,23,42,.18);cursor:pointer}.hist-catalog-row input{margin-top:3px}.hist-catalog-row span{display:grid;gap:3px}.hist-catalog-row small{color:var(--text-secondary,#94a3b8)}
          @media(max-width:800px){.hist-kpis{grid-template-columns:repeat(3,minmax(90px,1fr))}.hist-grid{grid-template-columns:1fr}.hist-import-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
          @media(max-width:520px){.hist-catalog-list{grid-template-columns:1fr}.hist-overlay{padding:0}.hist-modal{max-height:100vh;height:100%;border-radius:0}.hist-head,.hist-body,.hist-footer{padding:16px}.hist-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.hist-import-grid{grid-template-columns:1fr}.hist-footer{position:sticky;bottom:0;background:var(--bg-secondary,#151f2f);z-index:4}.hist-head{position:sticky}.hist-card-top{flex-direction:column}.hist-actions button{flex:1}.hist-toolbar .hist-btn{width:100%}}
        `;
        document.head.appendChild(style);
    }

    function closeOverlay() { document.querySelector('.hist-overlay')?.remove(); }

    function parseSigaaText(text) {
        const lines = String(text || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
        const rows = [];
        const statusMap = {
            APR:'concluida', APRN:'concluida', DISP:'concluida', TRANS:'concluida', INCORP:'concluida', CUMP:'concluida',
            REP:'reprovada', REPF:'reprovada', REPMF:'reprovada', REPN:'reprovada', REPNF:'reprovada',
            TRANC:'trancada', CANC:'trancada', MATR:'cursando', REC:'cursando'
        };
        const toNum = value => { const n = Number(String(value ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
        const pushRow = (period, codigo, nome, ch, media, status) => {
            const normalizedStatus = statusMap[String(status || '').toUpperCase()];
            if (!normalizedStatus || !nome || /^ENADE$/i.test(nome)) return;
            rows.push({ periodo:String(period), ano:Number(String(period).split('.')[0]), etapa:Number(String(period).split('.')[1]), nome:String(nome).replace(/\s+/g,' ').trim(), codigo:String(codigo||'').toUpperCase(), cargaHoraria:Number(ch)||0, creditos:0, status:normalizedStatus, nota:toNum(media), notaFinal:toNum(media) });
        };
        // Formato do PDF copiado com layout preservado: período + código + nome + colunas na mesma linha.
        const sameLine = /^(\d{4}\.\d)\s+(?:e\s+)?([A-Z]{2,}\d{4})\s+(.+?)\s+(\d{2,3})\s+(\d+)\s+(\d+)\s+([\d,.-]+|--)\s+([\d,.-]+|--)\s+([\d,.-]+|--)\s+([A-Z]+)$/i;
        const headerRe = /^(\d{4}\.\d)\s+(.+)$/;
        const resultRe = /(?:^|\s)([A-Z]{2,}\d{4})\s+(\d+)\s+(\d+)\s+(\d+)\s+([\d,.-]+|--)\s+([\d,.-]+|--)\s+([\d,.-]+|--)\s+([A-Z]+)\s*$/i;
        let pending = null;
        for (const line of lines) {
            const m = line.match(sameLine);
            if (m) { pushRow(m[1],m[2],m[3],m[4],m[8],m[10]); pending=null; continue; }
            const h = line.match(headerRe);
            if (h && !/^(Histórico|Nome:|Ano\/Período|Componentes|Página)/i.test(line)) { pending={period:h[1],name:h[2]}; continue; }
            if (pending) {
                const r = line.match(resultRe);
                if (r) { pushRow(pending.period,r[1],pending.name,r[2],r[6],r[8]); pending=null; continue; }
            }
        }
        const periods=[...new Set(rows.map(r=>r.periodo))].sort();
        const first=periods[0]; const firstYear=first?Number(first.split('.')[0]):0; const firstHalf=first?Number(first.split('.')[1]):1;
        const grouped=new Map();
        rows.forEach(row=>{
            const ordinal=firstYear?((row.ano-firstYear)*2+(row.etapa-firstHalf)+1):0;
            if(!grouped.has(row.periodo)) grouped.set(row.periodo,{numero:ordinal,periodo:row.periodo,subjects:[]});
            const g=grouped.get(row.periodo); const key=String(row.codigo||slug(row.nome));
            if(!g.subjects.some(s=>String(s.codigo||slug(s.nome))===key)) g.subjects.push(normalizeSubject(row));
        });
        return [...grouped.values()].sort((a,b)=>a.periodo.localeCompare(b.periodo));
    }

    const HISTORY_AI_PROMPT = `Você é o módulo de importação acadêmica do SLCampus. Analise o PDF/imagem/texto de um histórico escolar oficial do SIGAA.
Retorne SOMENTE JSON válido, sem markdown e sem texto fora do JSON.

Formato:
{
  "curso":"",
  "universidade":"",
  "periodoAtualDetectado":"",
  "periodos":[
    {
      "periodo":"2025.1",
      "disciplinas":[
        {
          "codigo":"CET5115",
          "nome":"GEOMETRIA ANALÍTICA",
          "cargaHoraria":90,
          "notaFinal":0.2,
          "situacao":"REP",
          "frequencia":100
        }
      ]
    }
  ],
  "equivalencias":[]
}

REGRAS CRÍTICAS:
- Extraia TODAS as disciplinas da seção Componentes Curriculares Cursados/Cursando.
- Preserve o período letivo exatamente como aparece (ex.: 2025.1, 2025.2, 2026.1, 2026.2).
- Preserve código, nome, carga horária, média/nota e situação. Não invente valores.
- Situações devem usar as siglas do SIGAA quando encontradas: APR, APRN, CANC, DISP, MATR, REC, REP, REPF, REPMF, REPN, REPNF, TRANC, TRANS, INCORP, CUMP.
- Para MATR/REC e outras situações sem nota, use null em notaFinal.
- Não transforme a nota final em média 0 quando o documento mostra --.
- ENADE não deve ser tratado como disciplina comum; pode ser ignorado.
- Não use a lista de componentes pendentes para inventar disciplinas cursadas.
- Se houver uma disciplina repetida em semestres diferentes, mantenha as duas ocorrências em seus respectivos períodos.
- Se houver equivalência, preserve-a em equivalencias, mas não crie uma disciplina cursada adicional apenas por causa da equivalência.
- Identifique periodoAtualDetectado somente quando houver evidência no documento de que aquele período está em andamento (por exemplo, situação MATR). Caso contrário, use string vazia.
- Se alguma informação não estiver presente, use string vazia, 0 ou null conforme o tipo.
- A ordem dos períodos deve ser cronológica.`;

    function normalizeAiStatus(status) {
        const s = String(status || '').toUpperCase().trim();
        const map = {
            APR:'concluida', APRN:'concluida', DISP:'concluida', TRANS:'concluida', INCORP:'concluida', CUMP:'concluida',
            REP:'reprovada', REPF:'reprovada', REPMF:'reprovada', REPN:'reprovada', REPNF:'reprovada',
            TRANC:'trancada', CANC:'trancada', MATR:'cursando', REC:'cursando'
        };
        return map[s] || 'cursando';
    }

    function periodOrdinal(periods, period) {
        const list = periods.map(String).filter(Boolean).sort();
        const idx = list.indexOf(String(period));
        return idx >= 0 ? idx + 1 : 0;
    }

    function matchCatalogSubject(app, subject) {
        const catalog = Array.isArray(app.data?.curriculum) ? app.data.curriculum : [];
        const code = String(subject.codigo || '').trim().toUpperCase();
        const name = slug(subject.nome);
        let found = code ? catalog.find(c => String(c.codigo || '').trim().toUpperCase() === code) : null;
        if (!found && name) found = catalog.find(c => slug(c.nome) === name);
        return found || null;
    }

    function subjectFromCatalog(app, subject, ordinal, status, notaFinal) {
        const catalog = matchCatalogSubject(app, subject);
        const base = catalog ? CLONE(catalog) : {};
        return normalizeSubject({
            ...base,
            id: base.id || id('hist-sub'),
            codigo: subject.codigo || base.codigo || '',
            nome: subject.nome || base.nome || '',
            semestre: String(ordinal || base.semestre || ''),
            cargaHoraria: Number(subject.cargaHoraria) || Number(base.cargaHoraria) || 0,
            creditos: Number(base.creditos) || 0,
            tipo: base.tipo || 'obrigatoria',
            status,
            notaFinal: notaFinal === null || notaFinal === undefined ? null : num(notaFinal, null),
            nota: notaFinal === null || notaFinal === undefined ? null : num(notaFinal, null)
        });
    }

    function aiResultToGroups(app, result) {
        const rawPeriods = Array.isArray(result?.periodos) ? result.periodos : [];
        const periods = rawPeriods.map(p => String(p?.periodo || '').trim()).filter(p => /^\d{4}\.\d$/.test(p)).sort();
        return periods.map(periodo => {
            const raw = rawPeriods.find(p => String(p?.periodo || '').trim() === periodo) || {};
            const subjects = (Array.isArray(raw.disciplinas) ? raw.disciplinas : [])
                .filter(s => s && s.nome && String(s.nome).trim() && !/^ENADE$/i.test(String(s.nome).trim()))
                .map(s => subjectFromCatalog(app, s, periodOrdinal(periods, periodo), normalizeAiStatus(s.situacao), s.notaFinal));
            return { numero: periodOrdinal(periods, periodo), periodo, subjects };
        }).filter(g => g.subjects.length);
    }

    function mergeArchiveByPeriod(app, group) {
        const archives = getArchives(app);
        const existingIndex = archives.findIndex(a => String(a.periodo || '') === String(group.periodo));
        const imported = normalizeArchive({
            id: id('hist-ai'), tipo:'manual', origem:'SIGAA-IA', numero:group.numero, semestre:group.numero,
            periodo:group.periodo, titulo:`${group.numero}º semestre — ${group.periodo}`,
            subjects:group.subjects, curriculum:group.subjects, materias:group.subjects.map(s => s.nome)
        });
        if (existingIndex < 0) { archives.push(imported); return { added:true, updated:false }; }

        const existing = normalizeArchive(archives[existingIndex]);
        const map = new Map();
        (existing.subjects || []).forEach(s => map.set(String(s.codigo || slug(s.nome)), s));
        (imported.subjects || []).forEach(s => {
            const key = String(s.codigo || slug(s.nome));
            const old = map.get(key);
            if (!old) map.set(key, s);
            else map.set(key, normalizeSubject({ ...old, ...s, id:old.id, tentativas:old.tentativas || s.tentativas || [] }));
        });
        existing.subjects = [...map.values()];
        existing.curriculum = existing.subjects.map(s => CLONE(s));
        existing.materias = existing.subjects.map(s => s.nome);
        existing.origem = existing.origem === 'cadastro-manual' ? existing.origem : 'SIGAA-IA';
        archives[existingIndex] = existing;
        return { added:false, updated:true };
    }

    async function syncCurrentGroup(app, group) {
        if (!group) return { subjects:0 };
        const current = Array.isArray(app.data.subjects) ? app.data.subjects : [];
        const curriculum = Array.isArray(app.data.curriculum) ? app.data.curriculum : [];
        let changedSubjects = 0;

        group.subjects.forEach(s => {
            const catalog = matchCatalogSubject(app, s);
            const canonicalName = catalog?.nome || s.nome;
            const idx = current.findIndex(x => slug(x.nome) === slug(canonicalName) || (s.codigo && String(x.codigo || '').toUpperCase() === String(s.codigo).toUpperCase()));
            const payload = {
                id: idx >= 0 ? current[idx].id : id('subject'),
                nome: canonicalName,
                dificuldade: idx >= 0 ? (current[idx].dificuldade ?? 3) : 3,
                peso: idx >= 0 ? (current[idx].peso ?? 3) : 3,
                notaDesejada: idx >= 0 ? (current[idx].notaDesejada ?? 7) : 7,
                status: 'cursando'
            };
            if (idx >= 0) current[idx] = { ...current[idx], ...payload };
            else { current.push(payload); changedSubjects++; }

            const ci = curriculum.findIndex(x => (s.codigo && String(x.codigo || '').toUpperCase() === String(s.codigo).toUpperCase()) || slug(x.nome) === slug(canonicalName));
            if (ci >= 0) curriculum[ci] = { ...curriculum[ci], status:'cursando' };
        });
        app.data.subjects = current;
        app.data.curriculum = curriculum;
        await window.dbService?.saveData?.('subjects', current);
        await window.dbService?.saveData?.('curriculum', curriculum);
        return { subjects:changedSubjects };
    }

    function renderAiHistoryPreview(app, groups, currentPeriod, aiMeta) {
        const currentSem = parseInt(app.data?.user?.semestre || 0, 10) || 0;
        return `<div class="hist-ai-summary">
          <div class="hist-kpis"><div class="hist-kpi"><small>Períodos encontrados</small><strong>${groups.length}</strong></div><div class="hist-kpi"><small>Disciplinas</small><strong>${groups.reduce((n,g)=>n+g.subjects.length,0)}</strong></div><div class="hist-kpi"><small>Semestre atual</small><strong>${currentSem ? currentSem+'º' : 'não definido'}</strong></div></div>
          <div class="hist-note">${currentPeriod ? `<strong>${esc(currentPeriod)}</strong> foi identificado como período em andamento. ${currentSem ? `Ele será associado ao seu ${currentSem}º semestre atual e não será criado como histórico.` : 'O SLC não vai criar um semestre atual automaticamente; você poderá confirmar isso depois.'}` : 'Nenhum período em andamento foi identificado com segurança. O SLC não criará um semestre atual automaticamente.'}</div>
          <div class="hist-grid">${groups.map(g => `<div class="hist-card"><div class="hist-card-top"><div><h3>${g.numero}º semestre — ${esc(g.periodo)}</h3><div class="hist-card-meta">${currentPeriod === g.periodo ? 'Atual detectado' : 'Será salvo no histórico'}</div></div><span class="hist-badge">${g.subjects.length} matéria(s)</span></div><div class="hist-subjects">${g.subjects.map(s => `<div class="hist-subject-row"><span>${esc(s.nome)}${s.codigo ? ` <small>${esc(s.codigo)}</small>` : ''}</span><small>${s.notaFinal ?? '—'} • ${s.status}</small></div>`).join('')}</div></div>`).join('')}</div>
        </div>`;
    }

    function renderSigaaImporter(app) {
        injectStyles(); closeOverlay();
        const overlay = document.createElement('div'); overlay.className='hist-overlay';
        overlay.innerHTML=`<div class="hist-modal"><div class="hist-head"><div><h2><i class="fas fa-file-pdf"></i> Importar histórico completo</h2><p>Envie o PDF oficial do SIGAA. A IA identifica os períodos, matérias, notas, reprovações e o que está sendo cursado agora.</p></div><button class="hist-close" type="button">&times;</button></div><div class="hist-body">
          <div class="hist-field"><label>PDF do histórico escolar</label><input id="sigaa-file" type="file" accept="application/pdf,.pdf" style="width:100%;box-sizing:border-box;padding:12px;border:1px dashed var(--border,#2d3a4f);border-radius:12px;background:var(--bg-primary,#0a0f1f);color:inherit"></div>
          <div class="hist-note">O arquivo é enviado para o mesmo módulo de IA que já existe no SLCampus. Antes de salvar, você verá exatamente quais períodos vão para o histórico e qual período será associado ao semestre atual. Nada é aplicado antes da confirmação.</div>
          <div id="sigaa-ai-status" style="margin-top:14px"></div><div id="sigaa-ai-preview" style="margin-top:14px"></div>
          <details style="margin-top:16px"><summary style="cursor:pointer;color:var(--text-secondary,#94a3b8)">Alternativa: colar texto do SIGAA</summary><div class="hist-field" style="margin-top:10px"><textarea id="sigaa-text" style="min-height:180px" placeholder="Cole o texto da seção Componentes Curriculares Cursados/Cursando..."></textarea></div><button class="hist-btn" id="sigaa-text-analyze" type="button">Analisar texto sem IA</button></details>
        </div><div class="hist-footer"><button class="hist-btn" id="sigaa-cancel">Cancelar</button><div class="hist-footer-right"><button class="hist-btn primary" id="sigaa-ai-analyze" disabled><i class="fas fa-wand-magic-sparkles"></i> Analisar PDF com IA</button><button class="hist-btn primary" id="sigaa-import-btn" disabled><i class="fas fa-check"></i> Confirmar importação</button></div></div></div>`;
        document.body.appendChild(overlay);
        const close=()=>overlay.remove(); overlay.querySelector('.hist-close').onclick=close; overlay.querySelector('#sigaa-cancel').onclick=close;
        let groups=[]; let currentPeriod='';
        const status=html=>overlay.querySelector('#sigaa-ai-status').innerHTML=html;
        const prepare = result => {
            groups = aiResultToGroups(app, result);
            currentPeriod = String(result?.periodoAtualDetectado || '').trim();
            if (!currentPeriod) {
                const candidate = groups.slice().reverse().find(g=>g.subjects.some(s=>s.status==='cursando'));
                currentPeriod = candidate?.periodo || '';
            }
            if (!groups.length) { overlay.querySelector('#sigaa-import-btn').disabled=true; overlay.querySelector('#sigaa-ai-preview').innerHTML='<div class="hist-empty">Nenhum componente cursado/cursando foi identificado.</div>'; return; }
            overlay.querySelector('#sigaa-ai-preview').innerHTML=renderAiHistoryPreview(app,groups,currentPeriod,result);
            overlay.querySelector('#sigaa-import-btn').disabled=false;
        };
        overlay.querySelector('#sigaa-file').onchange=e=>{overlay.querySelector('#sigaa-ai-analyze').disabled=!e.target.files?.[0];};
        overlay.querySelector('#sigaa-ai-analyze').onclick=async()=>{
            const file=overlay.querySelector('#sigaa-file').files?.[0]; if(!file)return;
            overlay.querySelector('#sigaa-ai-analyze').disabled=true; status('<div class="hist-note">Analisando o histórico com IA… isso pode levar alguns segundos.</div>');
            try {
                if (!window.GradeIAImport?.analyzeFile) throw new Error('Módulo de IA não carregado. Recarregue a página.');
                const result=await window.GradeIAImport.analyzeFile(file,HISTORY_AI_PROMPT,()=>status('<div class="hist-note">Analisando com IA. Se o primeiro modelo estiver indisponível, o servidor tentará automaticamente um segundo modelo.</div>'));
                prepare(result); status('<div class="hist-note" style="border-color:rgba(34,197,94,.3);color:#86efac">Análise concluída. Confira a prévia antes de confirmar.</div>');
            } catch(err) { status(`<div class="hist-note" style="color:#fca5a5">${esc(err.message || 'Falha ao analisar o PDF.')}</div>`); }
            overlay.querySelector('#sigaa-ai-analyze').disabled=false;
        };
        overlay.querySelector('#sigaa-text-analyze').onclick=()=>{groups=parseSigaaText(overlay.querySelector('#sigaa-text').value);currentPeriod=groups.slice().reverse().find(g=>g.subjects.some(s=>s.status==='cursando'))?.periodo||'';overlay.querySelector('#sigaa-ai-preview').innerHTML=groups.length?renderAiHistoryPreview(app,groups,currentPeriod,{}):'<div class="hist-empty">Nenhum componente reconhecido no texto.</div>';overlay.querySelector('#sigaa-import-btn').disabled=!groups.length;status('<div class="hist-note">Análise local concluída. Para o PDF, use a análise com IA.</div>');};
        overlay.querySelector('#sigaa-import-btn').onclick=async()=>{
            if(!groups.length)return;
            const currentSem=parseInt(app.data?.user?.semestre||0,10)||0;
            const currentGroup=currentPeriod?groups.find(g=>g.periodo===currentPeriod):null;
            let added=0,updated=0,currentSync=0;
            // Nunca cria automaticamente um semestre atual. Se o usuário já tem
            // semestre configurado, o período detectado é sincronizado com ele.
            if(currentGroup && currentSem) {
                const r=await syncCurrentGroup(app,currentGroup); currentSync=r.subjects;
                // Remove somente snapshots automáticos de SIGAA do mesmo período;
                // nunca apaga um registro manual/histórico do usuário.
                const archives=getArchives(app); for(let i=archives.length-1;i>=0;i--){if(String(archives[i].periodo||'')===currentGroup.periodo && ['SIGAA','SIGAA-IA'].includes(archives[i].origem)) archives.splice(i,1);}
            }
            groups.filter(g=>!currentGroup || g.periodo!==currentGroup.periodo).forEach(g=>{const r=mergeArchiveByPeriod(app,g);if(r.added)added++;if(r.updated)updated++;});
            const archives=getArchives(app); archives.sort((a,b)=>(num(a.numero,999)-num(b.numero,999))||String(a.periodo).localeCompare(String(b.periodo)));
            const ok=await window.dbService?.saveData?.('archivedSemesters',archives); if(!ok){status('<div class="hist-note" style="color:#fca5a5">Falha ao salvar o histórico. Nenhuma confirmação final foi concluída.</div>');return;}
            const missingCurrent = !currentSem && currentGroup;
            if(missingCurrent) showToast?.(`Histórico importado. ${currentGroup.periodo} foi detectado como atual, mas o SLC não criou o semestre atual automaticamente. Configure-o no perfil para sincronizar.`, 'warning');
            else showToast?.(`${added} período(s) adicionados, ${updated} atualizado(s)${currentSync?` e ${currentSync} matéria(s) sincronizada(s) no semestre atual`:''}.`, 'success');
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

    function openCatalogPicker(app, draft, renderSubjects) {
        const catalog = Array.isArray(app.data?.curriculum) ? app.data.curriculum : [];
        if (!catalog.length) { showToast?.('Sua grade curricular ainda está vazia. Importe/cadastre a grade primeiro.', 'warning'); return; }
        const wrap=document.createElement('div'); wrap.className='hist-catalog-picker';
        const semesters=[...new Set(catalog.map(c=>String(c.semestre||'').trim()).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));
        const currentDraft=new Set(draft.subjects.map(s=>String(s.codigo||slug(s.nome))));
        wrap.innerHTML=`<div class="hist-catalog-box"><div class="hist-head"><div><h2><i class="fas fa-layer-group"></i> Puxar matérias da grade curricular</h2><p>Use a grade já cadastrada no SLC. Você não precisa recriar nome, código, carga horária ou créditos.</p></div><button class="hist-close" type="button">&times;</button></div><div class="hist-body"><div class="hist-toolbar"><input id="hcp-search" placeholder="Buscar matéria ou código..." style="flex:1;min-width:220px"><select id="hcp-sem" style="min-width:180px"><option value="">Todos os semestres</option>${semesters.map(x=>`<option value="${esc(x)}">${esc(x)}º semestre da grade</option>`).join('')}</select><button class="hist-btn" id="hcp-all">Selecionar todos visíveis</button></div><div id="hcp-list" class="hist-catalog-list"></div></div><div class="hist-footer"><button class="hist-btn" id="hcp-cancel">Cancelar</button><button class="hist-btn primary" id="hcp-add">Adicionar selecionadas</button></div></div>`;
        document.body.appendChild(wrap);
        const close=()=>wrap.remove(); wrap.querySelector('.hist-close').onclick=close; wrap.querySelector('#hcp-cancel').onclick=close;
        const list=wrap.querySelector('#hcp-list');
        const render=()=>{
            const q=slug(wrap.querySelector('#hcp-search').value); const sem=wrap.querySelector('#hcp-sem').value;
            const visible=catalog.filter(c=>(!sem||String(c.semestre)===sem)&&(!q||slug(`${c.nome} ${c.codigo}`).includes(q)));
            list.innerHTML=visible.length?visible.map(c=>{const key=String(c.codigo||slug(c.nome));const checked=currentDraft.has(key);return `<label class="hist-catalog-row"><input type="checkbox" data-ci="${catalog.indexOf(c)}" ${checked?'checked':''}><span><strong>${esc(c.nome)}</strong><small>${esc(c.codigo||'Sem código')} • ${num(c.cargaHoraria)||0}h${c.creditos?` • ${num(c.creditos)} cr.`:''}${c.semestre?` • ${esc(c.semestre)}º sem.`:''}</small></span></label>`}).join(''):'<div class="hist-empty">Nenhuma matéria encontrada.</div>';
        };
        render(); wrap.querySelector('#hcp-search').oninput=render; wrap.querySelector('#hcp-sem').onchange=render;
        wrap.querySelector('#hcp-all').onclick=()=>{list.querySelectorAll('input[type=checkbox]').forEach(x=>x.checked=true);};
        wrap.querySelector('#hcp-add').onclick=()=>{
            const selected=[...list.querySelectorAll('input[type=checkbox]:checked')].map(x=>catalog[Number(x.dataset.ci)]).filter(Boolean);
            let added=0;
            selected.forEach(c=>{const key=String(c.codigo||slug(c.nome));if(currentDraft.has(key))return;draft.subjects.push(normalizeSubject({...c,status:'concluida'}));currentDraft.add(key);added++;});
            renderSubjects(); close(); showToast?.(`${added} matéria(s) puxada(s) da grade curricular.`, 'success');
        };
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
          <section class="hist-step" data-step="2"><h3>2. Disciplinas</h3><p class="text-secondary">Puxe as matérias da sua grade curricular e depois informe apenas o que aconteceu naquele semestre. Você também pode adicionar uma matéria avulsa.</p><div id="hist-subject-list"></div><div class="hist-toolbar"><button class="hist-btn primary" id="he-from-catalog"><i class="fas fa-layer-group"></i> Puxar da grade curricular</button><button class="hist-btn" id="he-add-sub"><i class="fas fa-plus"></i> Adicionar matéria avulsa</button></div>
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
        overlay.querySelector('#he-add-sub').onclick=()=>addSubject(); overlay.querySelector('#he-from-catalog').onclick=()=>openCatalogPicker(app,draft,renderSubjects); overlay.querySelector('#he-parse').onclick=parseBulk; overlay.querySelector('#he-add-grade').onclick=()=>{if(!draft.subjects.length){showToast?.('Cadastre pelo menos uma matéria antes das avaliações.','warning');return;}draft.grades.push({id:id('hist-grade'),materia:draft.subjects[0].nome,avaliacao:'',valor:null,peso:null,data:draft.fim||null});renderGrades();};
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
