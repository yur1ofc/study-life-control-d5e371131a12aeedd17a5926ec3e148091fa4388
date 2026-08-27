// reprovado-ecosystem.js — "Ecossistema de Repescagem"
//
// O que faz:
// 1. Lê o histórico de tentativas de cada matéria (item.tentativas, gravado
//    pelo semester-finish.js toda vez que uma matéria é marcada como
//    aprovada ou reprovada) e identifica quais matérias "cursando" agora
//    já foram reprovadas antes.
// 2. Mostra essas matérias em destaque no Dashboard e na Previsão de Notas,
//    comparando a nota da tentativa atual com a(s) tentativa(s) anterior(es).
// 3. Faz o Mentor IA priorizar essas matérias automaticamente (aumenta a
//    pontuação delas na fila de prioridade que já existia) e entende
//    perguntas do tipo "estou repetindo alguma matéria?".
//
// Não duplica nada que já existe: usa o mesmo app.data.curriculum e o mesmo
// sistema de arquivamento por semestre (semester-finish.js), só acrescenta
// a camada de "isso já foi reprovado antes, preste atenção nisso".
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

    function esc(value) {
        return String(value === undefined || value === null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Lê app.data.curriculum e devolve as matérias que estão "cursando"
    // agora e que já têm pelo menos uma tentativa reprovada no histórico.
    function getRepescagemSubjects(data) {
        const curriculum = Array.isArray(data?.curriculum) ? data.curriculum : [];
        return curriculum
            .filter(item => item.status === 'cursando' && Array.isArray(item.tentativas) && item.tentativas.some(t => t.resultado === 'reprovado'))
            .map(item => {
                const reprovadas = item.tentativas.filter(t => t.resultado === 'reprovado');
                return {
                    id: item.id,
                    nome: item.nome,
                    tentativas: item.tentativas.slice().sort((a, b) => new Date(a.data || 0) - new Date(b.data || 0)),
                    vezesReprovada: reprovadas.length,
                    ultimaTentativa: reprovadas[reprovadas.length - 1]
                };
            });
    }

    function mediaAtualDaMateria(nome) {
        try {
            const notas = (window.app?.data?.grades || []).filter(g => g.materia === nome);
            if (typeof window.app?.calcularMedia === 'function') return window.app.calcularMedia(notas);
        } catch (_) { /* segue sem média */ }
        return 0;
    }

    // ======================================================================
    // ESTILOS
    // ======================================================================
    function injectStyles() {
        if (document.getElementById('repro-eco-styles')) return;
        const style = document.createElement('style');
        style.id = 'repro-eco-styles';
        style.textContent = `
            #repro-eco-card{background:linear-gradient(135deg,#7c2d12 0%,#9a3412 100%);border-radius:14px;padding:1.1rem 1.25rem;margin-bottom:1.25rem;color:#fff;position:relative;overflow:hidden;}
            #repro-eco-card .repro-label{font-size:.72rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.7);margin-bottom:.4rem;}
            #repro-eco-card .repro-title{font-size:1.02rem;font-weight:700;margin-bottom:.5rem;line-height:1.35;}
            #repro-eco-card .repro-list{display:flex;flex-direction:column;gap:.45rem;margin-bottom:.9rem;}
            #repro-eco-card .repro-item{display:flex;align-items:center;justify-content:space-between;gap:.6rem;background:rgba(255,255,255,.1);border-radius:10px;padding:.5rem .7rem;font-size:.85rem;}
            #repro-eco-card .repro-item b{font-weight:700;}
            #repro-eco-card .repro-delta{font-weight:700;white-space:nowrap;}
            #repro-eco-card .repro-delta.up{color:#86efac;}
            #repro-eco-card .repro-delta.down{color:#fca5a5;}
            #repro-eco-card .repro-delta.same{color:#fde68a;}
            #repro-eco-card .repro-btn{padding:.45rem 1rem;border-radius:8px;border:none;font-size:.82rem;font-weight:600;cursor:pointer;background:#fff;color:#7c2d12;}
            .repro-badge{display:inline-flex;align-items:center;gap:4px;font-size:.7rem;font-weight:700;padding:2px 9px;border-radius:999px;background:rgba(249,115,22,.16);color:#fb923c;margin-left:8px;vertical-align:middle;}
            .repro-history{margin-top:14px;border-top:1px dashed var(--border,#2d3a4f);padding-top:12px;}
            .repro-history h4{margin:0 0 8px;font-size:.85rem;color:#fb923c;}
            .repro-history ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;}
            .repro-history li{display:flex;justify-content:space-between;gap:8px;font-size:.82rem;color:var(--text-secondary,#94a3b8);background:var(--bg-tertiary,#1e2b3a);border-radius:8px;padding:6px 10px;}
            .repro-history li strong{color:var(--text-primary,#f8fafc);}
            .repro-compare{margin-top:6px;font-size:.82rem;font-weight:600;}
            .repro-compare.up{color:#22c55e;}
            .repro-compare.down{color:#ef4444;}
            .repro-compare.same{color:#eab308;}
        `;
        document.head.appendChild(style);
    }

    // ======================================================================
    // DASHBOARD: card de destaque
    // ======================================================================
    function renderDashboardCard() {
        const existing = document.getElementById('repro-eco-card');
        if (existing) existing.remove();

        const repescagem = getRepescagemSubjects(window.app?.data);
        if (!repescagem.length) return;

        const card = document.createElement('div');
        card.id = 'repro-eco-card';
        card.innerHTML = `
            <div class="repro-label">🔁 Repescagem</div>
            <div class="repro-title">${repescagem.length > 1 ? `Você está repetindo ${repescagem.length} matérias` : `Você está repetindo ${esc(repescagem[0].nome)}`} — o mentor IA já está priorizando ${repescagem.length > 1 ? 'elas' : 'ela'}.</div>
            <div class="repro-list">
                ${repescagem.map(item => {
                    const atual = mediaAtualDaMateria(item.nome);
                    const antiga = Number(item.ultimaTentativa?.nota) || 0;
                    const delta = atual - antiga;
                    const cls = !atual ? 'same' : delta > 0.05 ? 'up' : delta < -0.05 ? 'down' : 'same';
                    const deltaTxt = !atual ? 'ainda sem notas nessa nova tentativa' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)} vs. tentativa anterior`;
                    return `
                        <div class="repro-item">
                            <span><b>${esc(item.nome)}</b> • reprovada ${item.vezesReprovada}x (última: ${esc(item.ultimaTentativa?.nota ?? '—')})</span>
                            <span class="repro-delta ${cls}">${deltaTxt}</span>
                        </div>
                    `;
                }).join('')}
            </div>
            <button class="repro-btn" id="repro-eco-btn">Ver comparação de notas</button>
        `;

        const content = document.getElementById('content-area');
        const header = content?.querySelector('.dashboard-header');
        const priorityCard = document.getElementById('slc-priority-card');
        if (priorityCard) priorityCard.insertAdjacentElement('afterend', card);
        else if (header) header.insertAdjacentElement('afterend', card);
        else content?.prepend(card);

        document.getElementById('repro-eco-btn')?.addEventListener('click', () => {
            window.app?.loadView?.('previsao-notas');
        });
    }

    // ======================================================================
    // PREVISÃO DE NOTAS: badge + histórico de tentativas em cada card
    // ======================================================================
    function injectPrevisaoNotasHistory() {
        const repescagem = getRepescagemSubjects(window.app?.data);
        if (!repescagem.length) return;
        const byName = new Map(repescagem.map(item => [slug(item.nome), item]));

        document.querySelectorAll('#content-area .subject-grade-card').forEach(card => {
            const h3 = card.querySelector('.card-header h3');
            if (!h3) return;
            const item = byName.get(slug(h3.textContent));
            if (!item) return;

            if (!card.querySelector('.repro-badge')) {
                const badge = document.createElement('span');
                badge.className = 'repro-badge';
                badge.innerHTML = `🔁 Repescagem (${item.vezesReprovada}ª reprovação)`;
                h3.insertAdjacentElement('afterend', badge);
            }

            if (!card.querySelector('.repro-history')) {
                const atual = mediaAtualDaMateria(item.nome);
                const antiga = Number(item.ultimaTentativa?.nota) || 0;
                const delta = atual - antiga;
                const cls = !atual ? 'same' : delta > 0.05 ? 'up' : delta < -0.05 ? 'down' : 'same';
                const compareTxt = !atual
                    ? 'Ainda sem notas registradas nesta nova tentativa.'
                    : delta > 0.05 ? `📈 Melhorou ${delta.toFixed(1)} ponto(s) em relação à última tentativa.`
                    : delta < -0.05 ? `📉 Está ${Math.abs(delta).toFixed(1)} ponto(s) abaixo da última tentativa.`
                    : '➡️ Praticamente igual à última tentativa.';

                const block = document.createElement('div');
                block.className = 'repro-history';
                block.innerHTML = `
                    <h4>Histórico de tentativas</h4>
                    <ul>
                        ${item.tentativas.map(t => `
                            <li>
                                <span>${t.semestre ? `${esc(t.semestre)}º semestre` : 'Semestre anterior'}</span>
                                <strong>${t.resultado === 'aprovado' ? '✅' : '❌'} Nota ${esc(t.nota ?? '—')}</strong>
                            </li>
                        `).join('')}
                    </ul>
                    <div class="repro-compare ${cls}">${compareTxt}</div>
                `;
                const body = card.querySelector('.card-body');
                body?.appendChild(block);
            }
        });
    }

    // ======================================================================
    // GANCHO NAS TROCAS DE VIEW
    // ======================================================================
    function patchApp() {
        const app = window.app;
        if (!app || app.__reproEcoPatched) return;
        app.__reproEcoPatched = true;

        const orig = app.loadView?.bind(app);
        if (!orig) return;

        window.app.loadView = function (view) {
            const result = orig(view);
            if (view === 'dashboard') setTimeout(renderDashboardCard, 250);
            if (view === 'previsao-notas') setTimeout(injectPrevisaoNotasHistory, 200);
            return result;
        };
    }

    // ======================================================================
    // MENTOR IA: prioriza repescagem, entende contexto e novas perguntas
    // ======================================================================
    function patchAI() {
        if (!window.AIAssistant || !window.AIAssistant.prototype._getMatterPriorityList) return;
        const proto = window.AIAssistant.prototype;
        if (proto.__reproEcoPatched) return;
        proto.__reproEcoPatched = true;

        // Contexto: acrescenta curriculum + a lista de repescagem, sem
        // remover nada do que updateContext já monta.
        if (window.aiAssistant && !window.aiAssistant.__reproEcoCtxPatched) {
            window.aiAssistant.__reproEcoCtxPatched = true;
            const origUpdateContext = window.aiAssistant.updateContext.bind(window.aiAssistant);
            window.aiAssistant.updateContext = function (data) {
                origUpdateContext(data);
                this.context.curriculum = Array.isArray(data?.curriculum) ? data.curriculum : [];
                this.context.repescagem = getRepescagemSubjects(data);
            };
        }

        // Prioridade: matéria em repescagem ganha peso extra na fila que já
        // existe (a mesma usada em plano do dia, plano semanal, "o que
        // estudar agora" e análise de risco).
        const origPriorityList = proto._getMatterPriorityList;
        proto._getMatterPriorityList = function () {
            const list = origPriorityList.call(this);
            const repescagemMap = new Map((this.context.repescagem || []).map(r => [r.nome, r]));
            if (!repescagemMap.size) return list;

            list.forEach(item => {
                const info = repescagemMap.get(item.nome);
                if (!info) return;
                item.score += 30;
                item.emRepescagem = true;
                item.vezesReprovada = info.vezesReprovada;
                const prefixo = `você já foi reprovado nessa matéria ${info.vezesReprovada}x antes`;
                item.justificativaCurta = item.justificativaCurta
                    ? `${prefixo}, ${item.justificativaCurta.charAt(0).toLowerCase()}${item.justificativaCurta.slice(1)}`
                    : prefixo.charAt(0).toUpperCase() + prefixo.slice(1);
            });

            return list.sort((a, b) => b.score - a.score);
        };

        // Diagnóstico completo: acrescenta uma seção de repescagem, no
        // mesmo formato usado pelas outras extensões desse arquivo.
        if (typeof proto._buildSmartDiagnosis === 'function') {
            const origDiag = proto._buildSmartDiagnosis;
            proto._buildSmartDiagnosis = function () {
                const base = origDiag.call(this);
                const repescagem = this.context.repescagem || [];
                if (!repescagem.length) return base;
                const linhas = repescagem.map(item => `${item.nome} (${item.vezesReprovada}x reprovada, última nota ${item.ultimaTentativa?.nota ?? '—'})`);
                return `${base}\n\n🔁 **Em repescagem:** ${linhas.join(' • ')}. Essas matérias estão recebendo prioridade extra no seu plano.`;
            };
        }

        // Nova pergunta: "estou repetindo alguma matéria?"
        const origAsk = proto.ask;
        proto.ask = async function (pergunta) {
            const p = String(pergunta || '').toLowerCase();
            if (p.match(/repescagem|repetindo.*materia|materia.*repetindo|ja.*reprovei|reprovei.*antes|de novo.*materia|cursando.*de novo/)) {
                const repescagem = this.context.repescagem || [];
                if (!repescagem.length) return 'Você não está cursando nenhuma matéria em repescagem agora — nenhuma das que você está fazendo foi reprovada antes.';
                const linhas = repescagem.map(item => {
                    const atual = mediaAtualDaMateria(item.nome);
                    const antiga = Number(item.ultimaTentativa?.nota) || 0;
                    const cmp = !atual ? 'ainda sem notas nesta tentativa' : atual > antiga ? `melhor que da última vez (${antiga.toFixed(1)})` : atual < antiga ? `pior que da última vez (${antiga.toFixed(1)})` : 'igual à última vez';
                    return `- ${item.nome}: reprovada ${item.vezesReprovada}x, nota atual ${atual.toFixed(1)} (${cmp}).`;
                });
                return [`Você está em repescagem em ${repescagem.length} matéria(s):`, ...linhas, '\nEstou priorizando essas matérias no seu plano automaticamente.'].join('\n');
            }
            return origAsk.call(this, pergunta);
        };
    }

    // ======================================================================
    // INIT
    // ======================================================================
    injectStyles();

    document.addEventListener('app-ready', () => {
        setTimeout(patchApp, 500);
        setTimeout(patchAI, 500);
    });
    if (window.app?.initialized) {
        setTimeout(patchApp, 100);
        setTimeout(patchAI, 100);
    }
    // Reforço: o AIAssistant e o app podem inicializar em momentos meio
    // diferentes dependendo da conexão — tenta de novo em alguns segundos
    // caso a primeira tentativa tenha sido cedo demais.
    setTimeout(() => { patchApp(); patchAI(); }, 2500);
})();
