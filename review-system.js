// review-system.js - Revisão espaçada aprimorada
class ReviewSystem {
    constructor() {
        this.revisoes = [];
        this.intervalos = [1, 3, 7, 15, 30];
    }

    loadReviews() {
        this.revisoes = window.app?.data?.reviews || [];
    }

    _signature(item) {
        return [item?.materia, item?.topico, item?.data, item?.tipo, item?.aulaId || '', item?.sessaoId || '']
            .join('|').toLowerCase().trim();
    }

    async gerarRevisoesFromAula(classDiary) {
        // O checkbox "Preciso revisar esse conteúdo depois" é o consentimento
        // explícito para transformar uma aula em uma cadeia de revisões. Antes,
        // toda aula gerava revisões mesmo quando o usuário não pediu, o que
        // alimentava notificações demais. Evidência de aprendizagem do Modo Foco
        // continua podendo criar revisões adaptativas separadamente.
        if (!classDiary?.precisoRevisar && classDiary?.criarRevisoesAutomaticas !== true) return [];
        this.loadReviews();
        const hoje = new Date();
        const dataBase = new Date(classDiary.data || hoje);
        const revisoesGeradas = [];
        const topicoBase = classDiary.conteudoExplicado || classDiary.naoEntendi || 'Conteúdo da aula';

        const adaptiveIntervals = window.SLCAdaptive?.reviewIntervals?.(window.app, classDiary.materia) || this.intervalos;
        for (const intervalo of adaptiveIntervals) {
            const dataRevisao = new Date(dataBase);
            dataRevisao.setDate(dataBase.getDate() + intervalo);
            const review = {
                id: generateId(),
                materia: classDiary.materia,
                topico: topicoBase,
                data: dataRevisao.toISOString().split('T')[0],
                duracao: intervalo <= 3 ? 25 : intervalo <= 7 ? 35 : 45,
                tipo: `${intervalo}d`,
                concluida: false,
                aulaId: classDiary.id,
                sourceClassDate: classDiary.data || '',
                sourceClassWeekday: new Date(`${classDiary.data}T00:00:00Z`).getUTCDay(),
                notificationPolicy: 'due-day-free-window'
            };
            const exists = this.revisoes.some(item => this._signature(item) === this._signature(review));
            if (!exists) {
                await dbService.addItem('reviews', review);
                revisoesGeradas.push(review);
                this.revisoes.push(review);
            }
        }

        const provasMateria = (window.app?.data?.exams || [])
            .filter(e => e.materia === classDiary.materia && !e.concluida && new Date(e.data) > hoje)
            .sort((a, b) => new Date(a.data) - new Date(b.data));

        if (provasMateria.length) {
            const provaMaisProxima = provasMateria[0];
            const dataProva = new Date(provaMaisProxima.data);
            const preExam = new Date(dataProva);
            preExam.setDate(dataProva.getDate() - 2);
            const review = {
                id: generateId(),
                materia: classDiary.materia,
                topico: `Revisão pré-prova: ${topicoBase}`,
                data: preExam.toISOString().split('T')[0],
                duracao: 60,
                tipo: 'pre-exam',
                concluida: false,
                aulaId: classDiary.id,
                provaId: provaMaisProxima.id,
                sourceClassDate: classDiary.data || '',
                sourceClassWeekday: new Date(`${classDiary.data}T00:00:00Z`).getUTCDay(),
                notificationPolicy: 'due-day-free-window'
            };
            const exists = this.revisoes.some(item => this._signature(item) === this._signature(review));
            if (!exists && preExam > hoje) {
                await dbService.addItem('reviews', review);
                revisoesGeradas.push(review);
                this.revisoes.push(review);
            }
        }

        this.loadReviews();
        return revisoesGeradas;
    }

    async gerarRevisoesFromSessao(sessao) {
        // Sessões de estudo não geram automaticamente uma nova cadeia de
        // revisões. O Modo Foco já registra evidência de aprendizagem e cria
        // revisões adaptativas quando necessário. Criar outra cadeia aqui
        // duplicava revisões e era a principal fonte de notificações diárias.
        if (!sessao?.materia) return [];
        return [];
    }

    getRevisoesPorData(data) {
        this.loadReviews();
        return this.revisoes.filter(r => (r.data === data || toDateString(r.data) === toDateString(data)) && !r.concluida)
            .sort((a, b) => {
                if (a.tipo === 'pre-exam') return -1;
                if (b.tipo === 'pre-exam') return 1;
                return new Date(a.data) - new Date(b.data);
            });
    }

    getRevisoesHoje() {
        return this.getRevisoesPorData(new Date().toISOString().split('T')[0]);
    }

    async concluirRevisao(revisaoId) {
        this.loadReviews();
        const revisao = this.revisoes.find(r => r.id === revisaoId);
        if (!revisao) return false;

        if (revisao.materia) {
            const topico = (window.app?.data?.learningMap || []).find(t => t.materia === revisao.materia && t.nome === revisao.topico);
            if (topico) {
                const novoStatus = topico.status === 'estudando' ? 'revisando' : 'dominado';
                await dbService.updateItem('learningMap', topico.id, {
                    status: novoStatus,
                    ultimaRevisao: new Date().toISOString()
                });
            }
        }

        const success = await dbService.updateItem('reviews', revisaoId, { concluida: true, updatedAt: new Date().toISOString() });
        if (success) {
            this.loadReviews();
            showToast('Revisão concluída! 🎯');
        }
        return success;
    }

    async reprogramarRevisao(revisaoId, novaData) {
        return dbService.updateItem('reviews', revisaoId, { data: novaData, updatedAt: new Date().toISOString() });
    }
}
window.reviewSystem = new ReviewSystem();
