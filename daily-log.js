// daily-log.js - Registro Diário de Atividades

class DailyLogService {
    constructor() {
        this.logs = [];
    }

    loadLogs() {
        this.logs = window.app?.data?.dailyLogs || [];
    }

    // Registrar log do dia (ou de uma data específica, se logData.data vier preenchido —
    // usado pela página de Diário para editar/lançar dias retroativos)
    async registrarLog(logData) {
        const dataAlvo = logData.data || new Date().toISOString().split('T')[0];

        // Verificar se já existe log para essa data
        const logExistente = this.logs.find(l => l.data === dataAlvo);
        
        const estudoDuracao = logData.estudoInicio && logData.estudoFim ? 
            calcularDuracaoMinutos(logData.estudoInicio, logData.estudoFim) : 0;
        
        const novoLog = {
            id: logExistente?.id || generateId(),
            data: dataAlvo,
            estudo: {
                inicio: logData.estudoInicio || '',
                fim: logData.estudoFim || '',
                duracao: estudoDuracao
            },
            aula: {
                foi: logData.foiAula || false,
                materias: logData.materiasAula || []
            },
            trabalho: {
                trabalhou: logData.trabalhou || false,
                duracao: logData.trabalhoDuracao || 0
            },
            energia: logData.energia || 'media',
            foco: logData.foco || 'normal',
            observacoes: logData.observacoes || ''
        };

        let success;
        if (logExistente) {
            success = await dbService.updateItem('dailyLogs', logExistente.id, novoLog);
        } else {
            success = await dbService.addItem('dailyLogs', novoLog);
        }

        if (success) {
            this.loadLogs();
            showToast('Registro do dia salvo!');
        }
        return success;
    }

    // Obter log de uma data específica
    getLogPorData(data) {
        return this.logs.find(l => l.data === data);
    }

    // Remover um registro do dia (usado pelo Diário)
    async removerLog(id) {
        const success = await dbService.removeItem('dailyLogs', id);
        if (success) {
            this.loadLogs();
            showToast('Registro removido.');
        }
        return success;
    }

    // Obter último log
    getUltimoLog() {
        return this.logs.sort((a, b) => new Date(b.data) - new Date(a.data))[0];
    }

    // Calcular médias de energia e foco dos últimos 7 dias
    getMediaUltimos7Dias() {
        const hoje = new Date();
        const ultimos7Dias = [];
        
        for (let i = 0; i < 7; i++) {
            const data = new Date(hoje);
            data.setDate(hoje.getDate() - i);
            const dataStr = data.toISOString().split('T')[0];
            const log = this.logs.find(l => l.data === dataStr);
            ultimos7Dias.push(log);
        }

        const energiaMap = { 'baixa': 1, 'media': 2, 'alta': 3 };
        const focoMap = { 'ruim': 1, 'normal': 2, 'bom': 3 };

        const logsComEnergia = ultimos7Dias.filter(l => l?.energia);
        const logsComFoco = ultimos7Dias.filter(l => l?.foco);

        const mediaEnergia = logsComEnergia.length > 0 ?
            logsComEnergia.reduce((acc, l) => acc + energiaMap[l.energia], 0) / logsComEnergia.length : 0;
        
        const mediaFoco = logsComFoco.length > 0 ?
            logsComFoco.reduce((acc, l) => acc + focoMap[l.foco], 0) / logsComFoco.length : 0;

        return {
            energia: mediaEnergia > 2.5 ? 'alta' : mediaEnergia > 1.5 ? 'media' : 'baixa',
            foco: mediaFoco > 2.5 ? 'bom' : mediaFoco > 1.5 ? 'normal' : 'ruim'
        };
    }
}

window.dailyLogService = new DailyLogService();