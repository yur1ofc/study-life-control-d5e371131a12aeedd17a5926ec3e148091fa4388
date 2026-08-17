// class-diary.js - Registro de Aulas aprimorado
class ClassDiaryService {
    constructor() {
        this.diaries = [];
    }

    loadDiaries() {
        this.diaries = window.app?.data?.classDiaries || [];
    }

    // Se diaryData.id vier preenchido, atualiza o diário existente em vez de criar
    // um novo (usado pela edição na página de Diário).
    async registrarDiario(diaryData) {
        this.loadDiaries();
        const novoDiario = {
            id: diaryData.id || generateId(),
            materia: diaryData.materia,
            data: diaryData.data || new Date().toISOString().split('T')[0],
            presenca: diaryData.presenca,
            conteudoExplicado: diaryData.conteudoExplicado || '',
            exerciciosPassados: diaryData.exerciciosPassados || '',
            trabalhoAnunciado: diaryData.trabalhoAnunciado || '',
            dificuldade: diaryData.dificuldade || 3,
            precisoRevisar: diaryData.precisoRevisar || false,
            observacoes: diaryData.observacoes || '',
            entendi: diaryData.entendi || '',
            naoEntendi: diaryData.naoEntendi || '',
            duvidaPendente: diaryData.duvidaPendente || '',
            linksAnexos: diaryData.linksAnexos || ''
        };

        if (diaryData.id) {
            const success = await dbService.updateItem('classDiaries', diaryData.id, novoDiario);
            if (success) {
                this.loadDiaries();
                showToast('Diário de aula atualizado!');
            }
            return success;
        }

        const assinatura = [novoDiario.materia, novoDiario.data, novoDiario.conteudoExplicado, novoDiario.exerciciosPassados].join('|').toLowerCase().trim();
        const duplicado = this.diaries.find(item => [item.materia, item.data, item.conteudoExplicado, item.exerciciosPassados].join('|').toLowerCase().trim() === assinatura);
        if (duplicado) {
            showToast('Esse diário já está salvo.', 'warning');
            return false;
        }

        const success = await dbService.addItem('classDiaries', novoDiario);
        if (success) {
            this.loadDiaries();
            if (window.reviewSystem?.gerarRevisoesFromAula) {
                await window.reviewSystem.gerarRevisoesFromAula(novoDiario);
            }
            showToast(novoDiario.precisoRevisar ? 'Diário salvo e revisões automáticas criadas!' : 'Diário de aula salvo!');
        }
        return success;
    }

    // Remover uma entrada de diário de aula (usado pelo Diário)
    async removerDiario(id) {
        const success = await dbService.removeItem('classDiaries', id);
        if (success) {
            this.loadDiaries();
            showToast('Diário de aula removido.');
        }
        return success;
    }

    getDiariosPorMateria(materiaNome) {
        return this.diaries.filter(d => d.materia === materiaNome)
            .sort((a, b) => new Date(b.data) - new Date(a.data));
    }

    getUltimoDiarioPorMateria(materiaNome) {
        return this.getDiariosPorMateria(materiaNome)[0];
    }

    getDiariosParaRevisar() {
        return this.diaries.filter(d => d.precisoRevisar)
            .sort((a, b) => new Date(b.data) - new Date(a.data));
    }

    calcularFrequencia(materiaNome) {
        const diarios = this.getDiariosPorMateria(materiaNome);
        if (!diarios.length) return 100;
        const presencas = diarios.filter(d => d.presenca === 'present').length;
        return Math.round((presencas / diarios.length) * 100);
    }
}
window.classDiaryService = new ClassDiaryService();
