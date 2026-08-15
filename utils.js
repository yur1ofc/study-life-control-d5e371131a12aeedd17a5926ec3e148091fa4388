// utils.js

function generateId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Faz o parse de uma data SEM sofrer o "bug do dia anterior".
// Strings no formato "YYYY-MM-DD" (o que <input type="date"> sempre gera)
// são interpretadas pelo `new Date(string)` nativo como UTC meia-noite —
// em qualquer fuso atrás de UTC (Brasil inteiro, por exemplo) isso resulta
// num Date que na hora LOCAL já é o dia anterior. Aqui, datas "só dia" são
// montadas manualmente em horário local; tudo o resto (Date, timestamp,
// ISO com horário) continua indo pelo `new Date()` normal.
function parseDateSafe(dateInput) {
    if (dateInput instanceof Date) return new Date(dateInput.getTime());
    if (typeof dateInput === 'string') {
        const m = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) {
            return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        }
    }
    return new Date(dateInput);
}

function toDateOnly(dateInput = new Date()) {
    const d = parseDateSafe(dateInput);
    d.setHours(0, 0, 0, 0);
    return d;
}

function toDateString(dateInput = new Date()) {
    // Monta "YYYY-MM-DD" a partir dos componentes locais — evita o mesmo
    // problema de fuso horário que toISOString() teria aqui (toISOString
    // sempre converte para UTC antes de formatar).
    const d = toDateOnly(dateInput);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function diasAte(data) {
    if (!data) return 0;
    const hoje = toDateOnly(new Date());
    const alvo = toDateOnly(data);
    const diff = alvo - hoje;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function diasDesde(data) {
    if (!data) return 0;
    const hoje = toDateOnly(new Date());
    const alvo = toDateOnly(data);
    const diff = hoje - alvo;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function formatarData(data) {
    if (!data) return '';
    return parseDateSafe(data).toLocaleDateString('pt-BR');
}

function formatarHora(data) {
    if (!data) return '';
    return parseDateSafe(data).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatarHoraString(horaString) {
    return horaString || '';
}

function tempoRestante(data) {
    if (!data) return 'Sem data';
    const agora = new Date();
    const evento = new Date(data);
    const diff = evento - agora;

    if (diff < 0) return 'Passado';

    const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
    const horas = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (dias > 0) return `${dias} dia${dias > 1 ? 's' : ''}`;
    if (horas > 0) return `${horas}h ${minutos}min`;
    if (minutos > 0) return `${minutos}min`;
    return 'Agora';
}

function calcularDuracaoMinutos(inicio, fim) {
    if (!inicio || !fim) return 0;
    const [hInicio, mInicio] = inicio.split(':').map(Number);
    const [hFim, mFim] = fim.split(':').map(Number);
    return (hFim * 60 + mFim) - (hInicio * 60 + mInicio);
}

function calcularMediaPonderada(notas = []) {
    if (!Array.isArray(notas) || !notas.length) return 0;

    const notasValidas = notas.filter(n =>
        typeof n.valor === 'number' &&
        !Number.isNaN(n.valor) &&
        typeof n.peso === 'number' &&
        !Number.isNaN(n.peso) &&
        n.peso > 0
    );

    if (!notasValidas.length) return 0;

    const somaPesos = notasValidas.reduce((acc, n) => acc + n.peso, 0);
    const somaPonderada = notasValidas.reduce((acc, n) => acc + (n.valor * n.peso), 0);

    return somaPesos ? somaPonderada / somaPesos : 0;
}

function escapeHtml(text = '') {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function nl2brSafe(text = '') {
    return escapeHtml(text).replace(/\n/g, '<br>');
}

function getToastIcon(type = 'success') {
    switch (type) {
        case 'success': return 'check-circle';
        case 'error': return 'times-circle';
        case 'warning': return 'exclamation-triangle';
        case 'info': return 'info-circle';
        default: return 'check-circle';
    }
}

function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${getToastIcon(type)}"></i>
        <span>${escapeHtml(msg)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4500);
}

let _loadingTimeout = null;

function showLoading(msg) {
    const loadingScreen = document.getElementById('loading-screen');
    const loadingText = document.getElementById('loading-text');
    if (loadingScreen) loadingScreen.style.display = 'flex';
    if (loadingText && msg) loadingText.textContent = msg;

    // Timeout: se demorar mais de 8s mostra opção de recarregar
    if (_loadingTimeout) clearTimeout(_loadingTimeout);
    _loadingTimeout = setTimeout(() => {
        if (loadingText && loadingScreen && loadingScreen.style.display !== 'none') {
            loadingText.innerHTML = 'Isso está demorando mais que o normal...<br><button onclick="location.reload()" style="margin-top:12px;padding:8px 18px;background:#3b82f6;border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;font-size:.9rem;">Recarregar página</button>';
        }
    }, 8000);
}

function hideLoading() {
    const loadingScreen = document.getElementById('loading-screen');
    const loadingText = document.getElementById('loading-text');
    if (loadingScreen) loadingScreen.style.display = 'none';
    if (loadingText) loadingText.innerHTML = 'Carregando seu painel acadêmico...';
    if (_loadingTimeout) { clearTimeout(_loadingTimeout); _loadingTimeout = null; }
}

function updateSyncStatus(success) {
    const status = document.getElementById('sync-status');
    if (!status) return;

    if (success) {
        status.innerHTML = '<i class="fas fa-check-circle" style="color: var(--accent-success);"></i>';
        setTimeout(() => {
            status.innerHTML = '<i class="fas fa-sync-alt"></i>';
        }, 2000);
    } else {
        status.innerHTML = '<i class="fas fa-exclamation-circle" style="color: var(--accent-danger);"></i>';
    }
}

window.utils = {
    generateId,
    toDateOnly,
    toDateString,
    diasAte,
    diasDesde,
    formatarData,
    formatarHora,
    formatarHoraString,
    tempoRestante,
    calcularDuracaoMinutos,
    calcularMediaPonderada,
    escapeHtml,
    nl2brSafe,
    showToast,
    showLoading,
    hideLoading,
    updateSyncStatus
};

window.generateId = generateId;
window.toDateOnly = toDateOnly;
window.toDateString = toDateString;
window.diasAte = diasAte;
window.diasDesde = diasDesde;
window.formatarData = formatarData;
window.formatarHora = formatarHora;
window.formatarHoraString = formatarHoraString;
window.tempoRestante = tempoRestante;
window.calcularDuracaoMinutos = calcularDuracaoMinutos;
window.calcularMediaPonderada = calcularMediaPonderada;
window.escapeHtml = escapeHtml;
window.nl2brSafe = nl2brSafe;
window.showToast = showToast;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.updateSyncStatus = updateSyncStatus;