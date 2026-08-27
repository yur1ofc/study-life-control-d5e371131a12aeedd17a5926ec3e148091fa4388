// grade-calculator.js - Cálculo de Notas e Médias

class GradeCalculator {
    constructor() {
        this.grades = [];
        this.subjects = [];
    }

    loadData() {
        this.grades = window.app?.data?.grades || [];
        this.subjects = window.app?.data?.subjects || [];
    }

    calcularMedia(materiaNome) {
        this.loadData();
        const notasMateria = this.grades.filter(g => g.materia === materiaNome);
        return calcularMediaPonderada(notasMateria);
    }

    calcularNotaNecessaria(materiaNome, notaDesejada) {
        this.loadData();

        const materia = this.subjects.find(s => s.nome === materiaNome);
        if (!materia) return null;

        const notasMateria = this.grades.filter(g => g.materia === materiaNome);
        const somaPesosRealizados = notasMateria.reduce((acc, n) => acc + n.peso, 0);
        const mediaAtual = this.calcularMedia(materiaNome);

        if (somaPesosRealizados >= 100) {
            return {
                possivel: mediaAtual >= notaDesejada,
                notaNecessaria: 0,
                mediaAtual: mediaAtual.toFixed(1),
                mensagem: mediaAtual >= notaDesejada
                    ? `✅ Você já atingiu a média desejada (${mediaAtual.toFixed(1)})`
                    : `❌ Infelizmente não é mais possível. Média atual: ${mediaAtual.toFixed(1)}`
            };
        }

        const pesoRestante = 100 - somaPesosRealizados;
        const somaPonderadaAtual = notasMateria.reduce((acc, n) => acc + (n.valor * n.peso), 0);

        const notaNecessaria = ((notaDesejada * 100) - somaPonderadaAtual) / pesoRestante;
        const possivel = notaNecessaria <= 10;

        return {
            possivel,
            notaNecessaria: Math.max(0, Math.min(10, notaNecessaria)).toFixed(1),
            mediaAtual: mediaAtual.toFixed(1),
            pesoRestante,
            mensagem: possivel
                ? `🎯 Você precisa tirar ${Math.max(0, Math.min(10, notaNecessaria)).toFixed(1)} na próxima avaliação (peso ${pesoRestante}%) para atingir média ${notaDesejada}.`
                : `❌ Não é mais possível atingir ${notaDesejada}. Foque em maximizar as notas restantes.`
        };
    }

    preverNotaFinal(materiaNome) {
        this.loadData();

        const materia = this.subjects.find(s => s.nome === materiaNome);
        if (!materia) return null;

        const notasMateria = this.grades.filter(g => g.materia === materiaNome);
        const somaPesosRealizados = notasMateria.reduce((acc, n) => acc + n.peso, 0);

        if (somaPesosRealizados === 0) {
            return {
                previsao: '?',
                confianca: 'baixa',
                mensagem: 'Nenhuma nota registrada'
            };
        }

        const mediaAtual = this.calcularMedia(materiaNome);

        if (somaPesosRealizados >= 70) {
            return {
                previsao: mediaAtual.toFixed(1),
                confianca: 'alta',
                mensagem: `Com base em ${somaPesosRealizados}% das notas`
            };
        }

        return {
            previsao: mediaAtual.toFixed(1),
            confianca: 'media',
            mensagem: `Previsão preliminar (${somaPesosRealizados}% das notas)`
        };
    }

    async configurarEstruturaNotas(materiaNome, estrutura) {
        this.loadData();

        const materia = this.subjects.find(s => s.nome === materiaNome);
        if (!materia) return false;

        materia.estruturaNotas = estrutura;
        return dbService.updateItem('subjects', materia.id, { estruturaNotas: estrutura });
    }

    async registrarNota(notaData) {
        const novaNota = {
            id: generateId(),
            materia: notaData.materia,
            avaliacao: notaData.avaliacao,
            valor: parseFloat(notaData.valor),
            peso: parseInt(notaData.peso, 10) || 100,
            data: new Date().toISOString()
        };

        const success = await dbService.addItem('grades', novaNota);
        if (success) {
            this.loadData();
            showToast('Nota registrada!');
        }
        return success;
    }
}

window.gradeCalculator = new GradeCalculator();