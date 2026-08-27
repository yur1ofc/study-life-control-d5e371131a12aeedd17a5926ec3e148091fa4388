// schedule-ia-import.js
// Cadastro, atualização e remoção RÁPIDA da Grade Horária (aulas) por IA,
// lendo um print de tela, foto ou PDF do horário — mesmo fluxo de
// "Importar/Atualizar com IA" já usado na Grade Curricular (grade-ia-import.js),
// só que aplicado às aulas (matéria, dia, horário, sala, professor).
//
// Usa o mesmo proxy /api/gemini já configurado no projeto (mesma chave,
// mesmo limite diário). Não precisa de nenhuma configuração nova.
//
// Adicione no index.html depois de schedule.js e app.js:
//   <script src="schedule-ia-import.js"></script>

(function () {
    'use strict';

    const DIAS_LABEL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

    const DIA_MAP = {
        domingo: 0, dom: 0,
        segunda: 1, 'segunda feira': 1, seg: 1, '2': 1, '2feira': 1,
        terca: 2, 'terca feira': 2, ter: 2, '3': 2, '3feira': 2,
        quarta: 3, 'quarta feira': 3, qua: 3, '4': 3, '4feira': 3,
        quinta: 4, 'quinta feira': 4, qui: 4, '5': 4, '5feira': 4,
        sexta: 5, 'sexta feira': 5, sex: 5, '6': 5, '6feira': 5,
        sabado: 6, 'sabado feira': 6, sab: 6
    };

    const SCHEDULE_PROMPT_BASE = `Leia o conteúdo fornecido (print de tela, foto ou PDF de um horário de aulas / grade horária universitária) e retorne SOMENTE um JSON válido, sem texto antes ou depois, sem markdown, sem blocos de código.

Formato obrigatório:
{
  "aulas": [
    {
      "materia": "Nome da disciplina",
      "dia": "segunda",
      "inicio": "19:00",
      "fim": "20:40",
      "sala": "Sala ou string vazia",
      "professor": "Nome do professor ou string vazia"
    }
  ]
}

Regras gerais:
- "dia" deve ser um destes valores exatos, em minúsculas e sem acento: domingo, segunda, terca, quarta, quinta, sexta, sabado.
- "inicio" e "fim" no formato 24h "HH:MM".
- Não invente aulas, dias ou horários que não estiverem no conteúdo enviado.
- Ignore intervalos/recreio que não sejam aulas.
- Revise seu resultado antes de responder: confira se TODAS as disciplinas visíveis no documento foram incluídas, em TODOS os dias em que elas aparecem (é comum uma disciplina aparecer 2 ou 3 vezes por semana, em dias diferentes — inclua uma entrada para cada dia).

Caso especial MUITO COMUM — documentos de sistemas acadêmicos (SIGAA, atestado de matrícula, etc.) com DUAS tabelas:
1) Uma tabela "Turmas Matriculadas" / lista de componentes, com colunas tipo Código, Componente Curricular/Docente, Local. Essa tabela é a LEGENDA: cada código (ex.: CET5030) corresponde a um nome de disciplina, um professor e uma sala.
2) Uma "Tabela de Horários" em formato de grade, com colunas Dom/Seg/Ter/Qua/Qui/Sex/Sab e linhas de faixas de horário (ex.: "07:30-08:20", "08:20-09:10"). Cada célula preenchida contém o CÓDIGO da disciplina (não o nome) que ocorre naquele dia/faixa.
Quando encontrar esse formato:
- Primeiro monte mentalmente o mapa código → nome da disciplina (e professor/sala) usando a tabela de legenda.
- Depois percorra a grade célula por célula: para cada dia (coluna) e cada código que aparecer, gere as aulas correspondentes usando o NOME da disciplina (nunca o código) no campo "materia".
- Se um mesmo código ocupar duas ou mais faixas de horário SEGUIDAS (sem intervalo) no mesmo dia, uma a essas faixas em UMA ÚNICA aula, do início da primeira faixa até o fim da última (ex.: código na faixa 07:30-08:20 e também em 08:20-09:10 no mesmo dia = uma aula única das 07:30 às 09:10). Não gere uma aula por faixa de 50 minutos.
- Se a coluna "Local" da legenda mostrar salas diferentes por dia entre parênteses (ex.: "PD 12 (3M56) PD 11 (5M56)"), use a sala correta para cada dia — nesse exemplo, os números antes da letra indicam os dias da semana (2=segunda, 3=terça, 4=quarta, 5=quinta, 6=sexta, 7=sábado), então "3M56" é terça e "5M56" é quinta: sala PD 12 na terça, sala PD 11 na quinta.
- Também pode aparecer um código compacto de horário ao lado de cada disciplina na lista de turmas (ex.: "246T12", "35M56"), no formato [dias][turno][faixas]: os dígitos antes da letra são os dias (2=segunda...7=sábado), a letra é o turno (M=manhã, T=tarde, N=noite). Use isso apenas como conferência extra de quais dias a disciplina ocorre — a fonte principal e mais confiável para o horário exato (início/fim) é sempre a grade "Tabela de Horários", não esse código.
- Ignore disciplinas com status diferente de "MATRICULADO" (ex.: "INDEFERIDO", "CANCELADO", "TRANCADO") — essas não devem virar aulas.`;

    // ─── Helpers de arquivo / IA (mesma lógica de grade-ia-import.js) ──────────

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = () => reject(new Error('Falha ao ler o arquivo'));
            reader.readAsDataURL(file);
        });
    }

    function getMimeType(file) {
        if (file.type) return file.type;
        const ext = (file.name || '').split('.').pop().toLowerCase();
        const map = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
        return map[ext] || 'application/octet-stream';
    }

    async function callGemini(parts) {
        const user = window.auth?.currentUser;
        if (!user) throw new Error('Você precisa estar logado para usar a importação com IA.');
        const idToken = await user.getIdToken();

        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ contents: [{ parts }] })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            const msg = (typeof err?.error === 'string' ? err.error : err?.error?.message) || `Erro HTTP ${response.status}`;
            throw new Error(msg);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const clean = text.replace(/```json|```/gi, '').trim();

        try {
            return JSON.parse(clean);
        } catch {
            throw new Error('A IA retornou um formato inesperado. Tente novamente — geralmente funciona na segunda tentativa.');
        }
    }

    // ─── Normalização ────────────────────────────────────────────────────────

    function makeId() {
        return typeof generateId === 'function' ? generateId() : Math.random().toString(36).slice(2, 10);
    }

    function slugKey(nome) {
        return String(nome || '')
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    function normalizeDia(value) {
        if (value === null || value === undefined || value === '') return null;
        const n = Number(value);
        if (!Number.isNaN(n) && Number.isInteger(n) && n >= 0 && n <= 6) return n;
        const key = slugKey(value).replace(/\s+/g, '');
        const keyComEspaco = slugKey(value);
        if (Object.prototype.hasOwnProperty.call(DIA_MAP, keyComEspaco)) return DIA_MAP[keyComEspaco];
        if (Object.prototype.hasOwnProperty.call(DIA_MAP, key)) return DIA_MAP[key];
        return null;
    }

    function normalizeHora(value) {
        const m = String(value || '').trim().match(/^(\d{1,2})[:h](\d{2})/);
        if (!m) return '';
        const h = String(Math.min(23, parseInt(m[1], 10))).padStart(2, '0');
        const min = m[2];
        return `${h}:${min}`;
    }

    // Tenta casar o nome vindo da IA com uma matéria já cadastrada em data.subjects
    function matchSubjectName(nomeIA, subjects) {
        const key = slugKey(nomeIA);
        if (!key) return null;
        let match = subjects.find(s => slugKey(s.nome) === key);
        if (match) return match.nome;
        match = subjects.find(s => {
            const sKey = slugKey(s.nome);
            return sKey.length >= 4 && (key.includes(sKey) || sKey.includes(key));
        });
        return match ? match.nome : null;
    }

    // ─── Diff entre a Grade Horária atual e o que a IA leu ─────────────────────

    function prepareAulas(app, aulasIA) {
        const subjects = Array.isArray(app.data.subjects) ? app.data.subjects : [];
        return aulasIA.map(raw => {
            const dia = normalizeDia(raw.dia);
            const matched = matchSubjectName(raw.materia, subjects);
            return {
                materia: (matched || String(raw.materia || '').trim()),
                materiaEncontrada: !!matched,
                dia,
                inicio: normalizeHora(raw.inicio),
                fim: normalizeHora(raw.fim),
                sala: String(raw.sala || '').trim(),
                professor: String(raw.professor || '').trim()
            };
        }).filter(a => a.materia && a.dia !== null && a.inicio && a.fim);
    }

    function computeScheduleDiff(app, prepared) {
        const existing = Array.isArray(app.data.classSchedule) ? [...app.data.classSchedule] : [];

        const byKey = new Map();
        existing.forEach(item => {
            const key = slugKey(item.materia) + '|' + parseInt(item.dia, 10);
            if (!byKey.has(key)) byKey.set(key, []);
            byKey.get(key).push(item);
        });

        const matchedIds = new Set();
        const added = [];
        const updated = [];

        prepared.forEach(nova => {
            const key = slugKey(nova.materia) + '|' + nova.dia;
            const queue = byKey.get(key);
            const target = queue && queue.length ? queue.shift() : null;

            if (target) {
                matchedIds.add(target.id);
                const changes = {};
                if ((target.inicio || '') !== nova.inicio) changes.inicio = { de: target.inicio || '—', para: nova.inicio };
                if ((target.fim || '') !== nova.fim) changes.fim = { de: target.fim || '—', para: nova.fim };
                if ((target.sala || '') !== nova.sala) changes.sala = { de: target.sala || '—', para: nova.sala || '—' };
                if ((target.professor || '') !== nova.professor) changes.professor = { de: target.professor || '—', para: nova.professor || '—' };
                if (Object.keys(changes).length) updated.push({ item: target, nova, changes });
            } else {
                added.push(nova);
            }
        });

        const removedCandidates = existing.filter(item => !matchedIds.has(item.id));
        const unmatchedSubjects = [...new Set(prepared.filter(a => !a.materiaEncontrada).map(a => a.materia))];

        return { added, updated, removedCandidates, unmatchedSubjects };
    }

    function applyScheduleUpdate(app, diff, { removeIds = [], createSubjects = [] } = {}) {
        if (!Array.isArray(app.data.classSchedule)) app.data.classSchedule = [];
        if (!Array.isArray(app.data.subjects)) app.data.subjects = [];

        let subjectsChanged = false;
        createSubjects.forEach(nome => {
            const key = slugKey(nome);
            if (!app.data.subjects.some(s => slugKey(s.nome) === key)) {
                app.data.subjects.push({ id: makeId(), nome, dificuldade: 3, peso: 3, notaDesejada: 7 });
                subjectsChanged = true;
            }
        });

        diff.updated.forEach(({ item, nova }) => {
            item.materia = nova.materia;
            item.inicio = nova.inicio;
            item.fim = nova.fim;
            item.sala = nova.sala;
            item.professor = nova.professor;
        });

        diff.added.forEach(nova => {
            app.data.classSchedule.push({
                id: makeId(),
                materia: nova.materia,
                dia: String(nova.dia),
                inicio: nova.inicio,
                fim: nova.fim,
                sala: nova.sala || '',
                professor: nova.professor || '',
                bloco: '',
                cor: '#3b82f6'
            });
        });

        if (removeIds.length) {
            const removeSet = new Set(removeIds);
            app.data.classSchedule = app.data.classSchedule.filter(item => !removeSet.has(item.id));
        }

        if (typeof dbService !== 'undefined') {
            dbService.saveData('classSchedule', app.data.classSchedule);
            if (subjectsChanged) dbService.saveData('subjects', app.data.subjects);
        }

        if (window.scheduleManager) window.scheduleManager.loadAulas();
        document.dispatchEvent(new Event('aulas-atualizadas'));
        if (app.loadView) app.loadView('grade-horaria');
    }

    // ─── Modal de diferenças (confirmação antes de aplicar) ────────────────────

    function showDiffModal(app, diff) {
        return new Promise(resolve => {
            const wrap = document.createElement('div');
            wrap.id = 'slc-sim-diff-modal';
            wrap.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:1rem;';

            const fmtAula = a => `${DIAS_LABEL[a.dia]} · ${a.inicio}–${a.fim}${a.sala ? ' · ' + a.sala : ''}${a.professor ? ' · ' + a.professor : ''}`;

            const addedRows = diff.added.map(a => `<li style="padding:.3rem 0;font-size:.82rem;"><strong>${a.materia}</strong><br><span style="color:#94a3b8">${fmtAula(a)}</span>${!a.materiaEncontrada ? ' <span style="color:#d97706;font-size:.72rem;">· matéria não cadastrada ainda</span>' : ''}</li>`).join('');

            const updatedRows = diff.updated.map(u => {
                const bits = Object.entries(u.changes).map(([campo, v]) => {
                    const label = { inicio: 'início', fim: 'fim', sala: 'sala', professor: 'professor' }[campo] || campo;
                    return `${label}: <s style="opacity:.55">${v.de}</s> → <strong>${v.para}</strong>`;
                }).join(' · ');
                return `<li style="padding:.4rem 0;border-bottom:1px solid #eef2f7;font-size:.82rem;"><strong>${u.item.materia}</strong> <span style="color:#94a3b8">(${DIAS_LABEL[parseInt(u.item.dia, 10)]})</span><br><span style="color:#64748b">${bits}</span></li>`;
            }).join('');

            const removedRows = diff.removedCandidates.map(item => `
                <li style="padding:.35rem 0;font-size:.82rem;display:flex;align-items:center;gap:.5rem;">
                    <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;flex:1;">
                        <input type="checkbox" class="slc-sim-remove-check" value="${item.id}">
                        <span>${item.materia} <span style="color:#94a3b8">· ${DIAS_LABEL[parseInt(item.dia, 10)]} ${item.inicio}–${item.fim}</span></span>
                    </label>
                </li>`).join('');

            const unmatchedRows = diff.unmatchedSubjects.map(nome => `
                <li style="padding:.3rem 0;font-size:.82rem;display:flex;align-items:center;gap:.5rem;">
                    <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;flex:1;">
                        <input type="checkbox" class="slc-sim-create-check" value="${nome}" checked>
                        <span>Cadastrar "<strong>${nome}</strong>" na aba Matérias</span>
                    </label>
                </li>`).join('');

            wrap.innerHTML = `
                <div style="background:#fff;color:#1e293b;border-radius:16px;width:100%;max-width:560px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 8px 40px rgba(0,0,0,.22);overflow:hidden;">
                    <div style="padding:1.1rem 1.4rem;background:linear-gradient(135deg,#1a73e8,#4f46e5);color:#fff;">
                        <h3 style="margin:0;font-size:1rem;">Confira o que vai mudar na Grade Horária</h3>
                        <p style="margin:.2rem 0 0;font-size:.78rem;opacity:.85;">Nada é aplicado até você confirmar.</p>
                    </div>
                    <div style="padding:1.2rem 1.4rem;overflow-y:auto;flex:1;">
                        ${diff.unmatchedSubjects.length ? `<h4 style="font-size:.85rem;margin:.2rem 0 .4rem;color:#d97706;">Matérias novas encontradas</h4><ul style="list-style:none;padding:0;margin:0 0 1rem;">${unmatchedRows}</ul>` : ''}
                        ${diff.added.length ? `<h4 style="font-size:.85rem;margin:.2rem 0 .4rem;color:#16a34a;">+ ${diff.added.length} aula(s) nova(s)</h4><ul style="list-style:none;padding:0;margin:0 0 1rem;">${addedRows}</ul>` : ''}
                        ${diff.updated.length ? `<h4 style="font-size:.85rem;margin:.2rem 0 .4rem;color:#1a73e8;">${diff.updated.length} aula(s) com horário/sala/professor atualizado</h4><ul style="list-style:none;padding:0;margin:0 0 1rem;">${updatedRows}</ul>` : ''}
                        ${diff.removedCandidates.length ? `
                            <h4 style="font-size:.85rem;margin:.2rem 0 .4rem;color:#dc2626;">${diff.removedCandidates.length} aula(s) não apareceram no arquivo novo</h4>
                            <p style="font-size:.76rem;color:#64748b;margin:0 0 .4rem;">Marque só as que você quer remover da grade. As desmarcadas continuam como estão.</p>
                            <ul style="list-style:none;padding:0;margin:0 0 1rem;">${removedRows}</ul>` : ''}
                        ${(!diff.added.length && !diff.updated.length && !diff.removedCandidates.length) ? '<p style="font-size:.85rem;color:#64748b;">Nenhuma diferença encontrada — sua grade horária já está igual ao arquivo enviado.</p>' : ''}
                    </div>
                    <div style="padding:1rem 1.4rem;border-top:1px solid #eef2f7;display:flex;gap:.6rem;justify-content:flex-end;">
                        <button id="slc-sim-diff-cancel" style="padding:.55rem 1rem;border-radius:8px;border:1px solid #e2e8f0;background:#fff;cursor:pointer;font-size:.83rem;">Cancelar</button>
                        <button id="slc-sim-diff-confirm" style="padding:.55rem 1.1rem;border-radius:8px;border:none;background:#1a73e8;color:#fff;cursor:pointer;font-size:.83rem;font-weight:600;">Aplicar</button>
                    </div>
                </div>`;

            document.body.appendChild(wrap);

            wrap.querySelector('#slc-sim-diff-cancel').addEventListener('click', () => { wrap.remove(); resolve(null); });
            wrap.addEventListener('click', e => { if (e.target === wrap) { wrap.remove(); resolve(null); } });
            wrap.querySelector('#slc-sim-diff-confirm').addEventListener('click', () => {
                const removeIds = Array.from(wrap.querySelectorAll('.slc-sim-remove-check:checked')).map(el => el.value);
                const createSubjects = Array.from(wrap.querySelectorAll('.slc-sim-create-check:checked')).map(el => el.value);
                wrap.remove();
                resolve({ removeIds, createSubjects });
            });
        });
    }

    // ─── Modal principal de importação ──────────────────────────────────────

    function createImportModal() {
        document.getElementById('slc-schedule-ia-modal')?.remove();

        const app = window.app;
        const subjectsList = (app?.data?.subjects || []).map(s => `- ${s.nome}`).join('\n');

        const modal = document.createElement('div');
        modal.id = 'slc-schedule-ia-modal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.52);display:flex;align-items:center;justify-content:center;padding:1rem;';

        modal.innerHTML = `
            <div style="background:#fff;color:#1e293b;border-radius:16px;width:100%;max-width:540px;box-shadow:0 8px 40px rgba(0,0,0,.22);overflow:hidden;">
                <div style="background:linear-gradient(135deg,#1a73e8,#4f46e5);padding:1.25rem 1.5rem;display:flex;align-items:center;gap:.75rem;">
                    <i class="fas fa-wand-magic-sparkles" style="color:#fff;font-size:1.25rem;"></i>
                    <div style="flex:1">
                        <h3 style="margin:0;color:#fff;font-size:1rem;font-weight:600;">Cadastrar Grade Horária com IA</h3>
                        <p style="margin:0;color:rgba(255,255,255,.8);font-size:.78rem;">Google Gemini • Grátis • lê print, foto ou PDF do seu horário</p>
                    </div>
                    <button id="slc-sim-close" style="background:rgba(255,255,255,.2);border:none;border-radius:8px;padding:5px 10px;color:#fff;cursor:pointer;">✕</button>
                </div>

                <div style="padding:1.5rem;">
                    <p style="font-size:.82rem;color:#475569;margin:0 0 1rem;background:#f8fafc;border:1px solid #eef2f7;border-radius:8px;padding:.6rem .8rem;">Envie um print de tela, foto ou PDF do seu horário de aulas. A IA identifica matéria, dia, horário, sala e professor — você confere o que vai ser adicionado, atualizado ou removido antes de salvar.</p>

                    <div style="display:flex;gap:.5rem;margin-bottom:1.25rem;">
                        <button class="slc-sim-tab slc-sim-tab-on" data-tab="arquivo" style="flex:1;padding:.5rem;border-radius:8px;border:1.5px solid #1a73e8;background:#e8f0fe;color:#1a73e8;cursor:pointer;font-size:.83rem;font-weight:500;">
                            <i class="fas fa-file-upload"></i> Print, foto ou PDF
                        </button>
                        <button class="slc-sim-tab" data-tab="texto" style="flex:1;padding:.5rem;border-radius:8px;border:1px solid #e2e8f0;background:#fff;color:#64748b;cursor:pointer;font-size:.83rem;">
                            <i class="fas fa-align-left"></i> Colar texto
                        </button>
                    </div>

                    <div id="slc-sim-tab-arquivo">
                        <div id="slc-sim-dropzone" style="border:2px dashed #cbd5e1;border-radius:12px;padding:2rem;text-align:center;cursor:pointer;background:#f8fafc;transition:all .2s;">
                            <i class="fas fa-cloud-upload-alt" style="font-size:2rem;color:#94a3b8;display:block;margin-bottom:.5rem;"></i>
                            <p style="margin:0 0 .2rem;font-weight:500;color:#475569;">Arraste o print, foto ou PDF do horário</p>
                            <p style="margin:0;font-size:.78rem;color:#94a3b8;">ou clique para escolher · PDF, PNG, JPG, WEBP</p>
                            <input type="file" id="slc-sim-file-input" accept=".pdf,.png,.jpg,.jpeg,.webp" style="display:none;">
                        </div>
                        <div id="slc-sim-preview" style="display:none;margin-top:.75rem;padding:.65rem 1rem;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;align-items:center;gap:.5rem;">
                            <i class="fas fa-file-check" style="color:#16a34a;"></i>
                            <span id="slc-sim-fname" style="font-size:.83rem;color:#166534;flex:1;"></span>
                            <button id="slc-sim-fremove" style="background:none;border:none;color:#ef4444;cursor:pointer;">✕</button>
                        </div>
                    </div>

                    <div id="slc-sim-tab-texto" style="display:none;">
                        <label style="font-size:.83rem;font-weight:500;color:#374151;display:block;margin-bottom:.4rem;">Cole o texto do horário (portal do aluno, planilha, etc.):</label>
                        <textarea id="slc-sim-texto" rows="8" placeholder="Segunda 19:00-20:40 Cálculo I Sala B12 Prof. João&#10;Terça 19:00-20:40 Física I Sala A03 Prof. Maria" style="width:100%;box-sizing:border-box;border:1px solid #e2e8f0;border-radius:8px;padding:.7rem;font-size:.83rem;font-family:inherit;resize:vertical;outline:none;"></textarea>
                    </div>

                    <div id="slc-sim-status" style="display:none;margin-top:1rem;padding:.7rem 1rem;border-radius:8px;font-size:.83rem;"></div>

                    <button id="slc-sim-run" style="width:100%;margin-top:1rem;padding:.75rem;background:#1a73e8;color:#fff;border:none;border-radius:10px;font-size:.93rem;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:.5rem;">
                        <i class="fas fa-magic"></i> Analisar horário
                    </button>

                    <p style="text-align:center;font-size:.73rem;color:#94a3b8;margin:.65rem 0 0;">
                        Powered by Google Gemini · o arquivo não fica salvo, só é lido na hora
                    </p>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        let selectedFile = null;
        let activeTab = 'arquivo';

        modal.querySelector('#slc-sim-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

        modal.querySelectorAll('.slc-sim-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                activeTab = btn.dataset.tab;
                modal.querySelectorAll('.slc-sim-tab').forEach(b => {
                    const on = b.dataset.tab === activeTab;
                    b.style.border = on ? '1.5px solid #1a73e8' : '1px solid #e2e8f0';
                    b.style.background = on ? '#e8f0fe' : '#fff';
                    b.style.color = on ? '#1a73e8' : '#64748b';
                });
                modal.querySelector('#slc-sim-tab-arquivo').style.display = activeTab === 'arquivo' ? 'block' : 'none';
                modal.querySelector('#slc-sim-tab-texto').style.display = activeTab === 'texto' ? 'block' : 'none';
            });
        });

        const dropzone = modal.querySelector('#slc-sim-dropzone');
        const fileInput = modal.querySelector('#slc-sim-file-input');
        const preview = modal.querySelector('#slc-sim-preview');
        const fname = modal.querySelector('#slc-sim-fname');

        dropzone.addEventListener('click', () => fileInput.click());
        dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.style.background = '#e8f0fe'; dropzone.style.borderColor = '#1a73e8'; });
        dropzone.addEventListener('dragleave', () => { dropzone.style.background = '#f8fafc'; dropzone.style.borderColor = '#cbd5e1'; });
        dropzone.addEventListener('drop', e => {
            e.preventDefault();
            dropzone.style.background = '#f8fafc'; dropzone.style.borderColor = '#cbd5e1';
            if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
        });
        fileInput.addEventListener('change', () => { if (fileInput.files[0]) setFile(fileInput.files[0]); });

        function setFile(file) {
            selectedFile = file;
            fname.textContent = file.name;
            preview.style.display = 'flex';
            dropzone.style.display = 'none';
        }

        modal.querySelector('#slc-sim-fremove').addEventListener('click', () => {
            selectedFile = null; fileInput.value = '';
            preview.style.display = 'none'; dropzone.style.display = 'block';
        });

        const btn = modal.querySelector('#slc-sim-run');
        const statusEl = modal.querySelector('#slc-sim-status');

        function setStatus(html, type) {
            const cfg = {
                loading: ['#eff6ff', '#bfdbfe', '#1e40af'],
                success: ['#f0fdf4', '#bbf7d0', '#166534'],
                error: ['#fef2f2', '#fecaca', '#991b1b']
            };
            const [bg, border, color] = cfg[type] || cfg.loading;
            statusEl.style.cssText = `display:block;background:${bg};border:1px solid ${border};color:${color};padding:.7rem 1rem;border-radius:8px;font-size:.83rem;margin-top:1rem;`;
            statusEl.innerHTML = html;
        }

        btn.addEventListener('click', async () => {
            statusEl.style.display = 'none';
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';

            try {
                const prompt = SCHEDULE_PROMPT_BASE + (subjectsList ? `\n\nMatérias já cadastradas nesse semestre (use estes nomes exatos quando corresponder):\n${subjectsList}` : '');
                let parts;

                if (activeTab === 'arquivo') {
                    if (!selectedFile) throw new Error('Selecione um print, foto ou PDF primeiro.');
                    const mime = getMimeType(selectedFile);
                    const isPdf = mime === 'application/pdf';
                    const isImg = mime.startsWith('image/');
                    if (!isPdf && !isImg) throw new Error('Formato não suportado. Use PDF, PNG, JPG ou WEBP.');

                    setStatus('<i class="fas fa-spinner fa-spin"></i> Lendo o horário com IA...', 'loading');
                    const b64 = await fileToBase64(selectedFile);

                    parts = [
                        { text: prompt },
                        { inline_data: { mime_type: mime, data: b64 } }
                    ];
                } else {
                    const text = modal.querySelector('#slc-sim-texto').value.trim();
                    if (!text) throw new Error('Cole o texto do horário primeiro.');
                    setStatus('<i class="fas fa-spinner fa-spin"></i> Interpretando com IA...', 'loading');
                    parts = [{ text: prompt + '\n\nConteúdo do horário:\n\n' + text }];
                }

                const result = await callGemini(parts);
                const aulasIA = result?.aulas || [];
                if (!aulasIA.length) throw new Error('Nenhuma aula foi encontrada no arquivo.');

                if (!app) throw new Error('App não encontrado.');
                const prepared = prepareAulas(app, aulasIA);
                if (!prepared.length) throw new Error('Não consegui identificar dia/horário válidos nas aulas encontradas.');

                const diff = computeScheduleDiff(app, prepared);
                modal.remove();

                const decision = await showDiffModal(app, diff);
                if (!decision) return;

                applyScheduleUpdate(app, diff, decision);
                if (typeof showToast === 'function') {
                    showToast(`Grade horária atualizada: +${diff.added.length} novas, ${diff.updated.length} ajustadas${decision.removeIds.length ? `, ${decision.removeIds.length} removidas` : ''}.`, 'success');
                }
            } catch (err) {
                setStatus(`<i class="fas fa-exclamation-circle"></i> ${err.message}`, 'error');
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-magic"></i> Tentar novamente';
            }
        });
    }

    // ─── API pública + botão na Grade Horária ──────────────────────────────────

    window.ScheduleIAImport = {
        openModal() { createImportModal(); }
    };

    function ensureButton() {
        const novaAulaBtn = document.getElementById('btn-nova-aula');
        const header = novaAulaBtn?.closest('.view-header');
        if (!header || header.dataset.iaBtnAdded) return;
        header.dataset.iaBtnAdded = '1';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-secondary';
        btn.id = 'btn-importar-aulas-ia';
        btn.style.cssText = 'background:linear-gradient(135deg,#1a73e8,#4f46e5);border:none;color:#fff;';
        btn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Cadastrar com IA (print/PDF)';
        btn.addEventListener('click', () => window.ScheduleIAImport.openModal());

        // Agrupa os dois botões num único bloco à direita do cabeçalho,
        // um do lado do outro, em vez de ficarem espalhados pelo
        // justify-content:space-between do .view-header.
        const group = document.createElement('div');
        group.className = 'header-actions';
        group.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;';
        novaAulaBtn.parentNode.insertBefore(group, novaAulaBtn);
        group.appendChild(btn);
        group.appendChild(novaAulaBtn);
    }

    new MutationObserver(ensureButton).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('app-ready', () => setTimeout(ensureButton, 200));
})();
