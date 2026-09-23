// database.js - Gerenciamento do Firestore

const DEFAULT_APP_DATA = () => ({
    user: null,
    subjects: [],
    sessions: [],
    tasks: [],
    exams: [],
    materials: [],
    grades: [],
    habits: [],
    learningMap: [],
    classSchedule: [],
    dailyLogs: [],
    classDiaries: [],
    reviews: [],
    curriculum: [],
    extraCourses: [],
    attendance: {},
    // Assinaturas de push (uma por navegador/dispositivo onde o usuário
    // ativou "Ativar alarmes de estudo") e registro do que já foi
    // notificado, pra api/send-reminders.js não mandar o mesmo lembrete
    // de novo a cada vez que o cron roda. Ver push-notifications.js.
    pushSubscriptions: [],
    sentReminders: [],
    // Evidências e desempenho em recuperação ativa usados pelo motor adaptativo V18.
    learningEvidence: [],
    questionAttempts: [],
    focusPushSchedule: null,
    telegram: null,
    telegramInbox: [],
    settings: {
        heavyMode: false,
        autoPlan: true,
        focusPushEnabled: false,
        // Token do feed de calendário (.ics) assinável — ver calendar-feed.js.
        calendarToken: null,
        // Tema personalizado (cores, tamanho de fonte, arredondamento) —
        // salvo na conta pra valer em qualquer aparelho logado, não só
        // neste navegador. Ver theme-engine.js.
        theme: { preset: 'dark', custom: {} },
        // Preferências de alarme/lembrete por push — ver push-notifications.js.
        studyReminders: {
            enabled: false,
            examsHoursBefore: 24,
            tasksHoursBefore: 24,
            sessionsMinutesBefore: 15,
            // Revisão espaçada (review-system.js) e aulas da grade horária —
            // adicionados depois dos 3 originais; ver CALENDARIO-E-LEMBRETES.md.
            reviewsHoursBefore: 24,
            classMinutesBefore: 15
        }
    }
});

const LOCAL_BACKUP_PREFIX = 'slc-backup:';

function getBackupKey(userId) {
    return `${LOCAL_BACKUP_PREFIX}${userId}`;
}

function saveLocalBackup(userId, data) {
    try {
        localStorage.setItem(getBackupKey(userId), JSON.stringify({
            savedAt: new Date().toISOString(),
            data
        }));
    } catch (error) {
        console.warn('Não foi possível salvar backup local:', error);
    }
}

function loadLocalBackup(userId) {
    try {
        const raw = localStorage.getItem(getBackupKey(userId));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed?.data || null;
    } catch (error) {
        console.warn('Não foi possível ler backup local:', error);
        return null;
    }
}

// Dispara um evento global toda vez que algo é salvo com sucesso.
// Existia um listener disso no xp-widget.js que nunca era acionado por
// ninguém — agora ele (e qualquer outra coisa que queira reagir a saves,
// como o feed de calendário) tem um gancho real pra se pendurar.
// `fields` é a lista de campos alterados nesse save (ex: ['tasks']) quando
// souber; em saves genéricos (saveAllData/clearAllData) vai vazio.
function notifyDataSaved(fields = []) {
    try {
        document.dispatchEvent(new CustomEvent('slc-data-saved', { detail: { fields } }));
    } catch (error) {
        console.warn('Não foi possível disparar slc-data-saved:', error);
    }
}

const dbService = {
    async loadUserData(userId) {
        try {
            const userDoc = await db.collection('users').doc(userId).get();

            let data;
            if (!userDoc.exists) {
                data = DEFAULT_APP_DATA();
            } else {
                const raw = userDoc.data() || {};
                data = {
                    ...DEFAULT_APP_DATA(),
                    ...raw,
                    settings: {
                        ...DEFAULT_APP_DATA().settings,
                        ...(raw.settings || {})
                    }
                };
            }

            if (window.app) {
                window.app.data = data;
            }

            // Reaplica o tema salvo NA CONTA (pode ser diferente do que
            // estava em cache neste aparelho) — é isso que faz o tema
            // valer por conta e não por aparelho.
            window.themeEngine?.syncFromAccount(data.settings?.theme);

            saveLocalBackup(userId, data);
            window.app.__lastSyncedData = JSON.parse(JSON.stringify(data));

            if (window.updateSyncStatus) window.updateSyncStatus(true);
            return data;
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            const backup = loadLocalBackup(userId);
            if (backup) {
                if (window.updateSyncStatus) window.updateSyncStatus(false);
                if (window.showToast) window.showToast('Sem conexão com o banco. Carregando último backup local.', 'warning');
                return {
                    ...DEFAULT_APP_DATA(),
                    ...backup,
                    settings: {
                        ...DEFAULT_APP_DATA().settings,
                        ...(backup.settings || {})
                    }
                };
            }
            if (window.updateSyncStatus) window.updateSyncStatus(false);
            if (window.showToast) window.showToast('Erro ao sincronizar dados', 'error');
            throw error;
        }
    },

    async saveAllData(dataOverride = null) {
        const user = auth.currentUser;
        if (!user) return false;

        try {
            if (window.showLoading) window.showLoading();

            const dataToSave = dataOverride || window.app?.data || DEFAULT_APP_DATA();
            await db.collection('users').doc(user.uid).set(dataToSave, { merge: true });
            saveLocalBackup(user.uid, dataToSave);

            if (window.app) {
                window.app.data = dataToSave;
            }

            if (window.updateSyncStatus) window.updateSyncStatus(true);
            notifyDataSaved(Object.keys(dataToSave));
            return true;
        } catch (error) {
            console.error('Erro ao salvar dados:', error);
            if (window.updateSyncStatus) window.updateSyncStatus(false);
            if (window.showToast) window.showToast('Erro ao salvar dados', 'error');
            return false;
        } finally {
            if (window.hideLoading) window.hideLoading();
        }
    },

    async saveData(field, data) {
        const user = auth.currentUser;
        if (!user) return false;

        try {
            // Transactional writes prevent two browser tabs/devices from silently
            // overwriting a newer scalar field. Array mutations are handled by
            // addItem/updateItem/removeItem below, which operate on the latest
            // transaction snapshot.
            await db.runTransaction(async tx => {
                const ref = db.collection('users').doc(user.uid);
                tx.set(ref, { [field]: data }, { merge: true });
            });

            if (window.app?.data) {
                window.app.data[field] = data;
                window.app.__lastSyncedData = window.app.__lastSyncedData || {};
                try { window.app.__lastSyncedData[field] = JSON.parse(JSON.stringify(data)); } catch (_) { window.app.__lastSyncedData[field] = data; }
                saveLocalBackup(user.uid, window.app.data);
            }

            if (window.updateSyncStatus) window.updateSyncStatus(true);
            notifyDataSaved([field]);
            return true;
        } catch (error) {
            console.error(`Erro ao salvar campo "${field}":`, error);
            if (window.updateSyncStatus) window.updateSyncStatus(false);
            if (window.showToast) window.showToast('Erro ao salvar', 'error');
            return false;
        }
    },

    async addItem(collection, item) {
        const user = auth.currentUser;
        if (!user || !window.app?.data?.[collection]) return false;
        // Historical semester context wraps saveData so writes are redirected
        // into archivedSemesters. Keep that isolation intact.
        if (window.app?._semesterContext?.type === 'archived') {
            const next = [...window.app.data[collection], item];
            window.app.data[collection] = next;
            return this.saveData(collection, next);
        }
        try {
            const ref = db.collection('users').doc(user.uid);
            await db.runTransaction(async tx => {
                const snap = await tx.get(ref);
                const latest = snap.exists ? (snap.data()?.[collection] || []) : [];
                if (!Array.isArray(latest)) throw new Error(`Campo ${collection} não é uma lista.`);
                const exists = item?.id && latest.some(x => x?.id === item.id);
                if (!exists) tx.set(ref, { [collection]: [...latest, item] }, { merge: true });
            });
            // Rebase local state on the latest server state to avoid stale-tab
            // overwrites when another client (including Telegram) wrote meanwhile.
            const fresh = await ref.get();
            if (fresh.exists) window.app.data[collection] = fresh.data()?.[collection] || [];
            saveLocalBackup(user.uid, window.app.data);
            window.app.__lastSyncedData = window.app.__lastSyncedData || {};
            window.app.__lastSyncedData[collection] = JSON.parse(JSON.stringify(window.app.data[collection]));
            notifyDataSaved([collection]);
            return true;
        } catch (error) {
            console.error(`[SLC] Erro ao adicionar em "${collection}":`, error);
            window.updateSyncStatus?.(false);
            return false;
        }
    },

    async updateItem(collection, id, updates) {
        const user = auth.currentUser;
        if (!user || !window.app?.data?.[collection]) return false;
        if (window.app?._semesterContext?.type === 'archived') {
            const next = window.app.data[collection].map(i => i?.id === id ? { ...i, ...updates } : i);
            window.app.data[collection] = next;
            return this.saveData(collection, next);
        }
        try {
            const ref = db.collection('users').doc(user.uid);
            await db.runTransaction(async tx => {
                const snap = await tx.get(ref);
                const latest = Array.isArray(snap.data()?.[collection]) ? snap.data()[collection] : [];
                const index = latest.findIndex(i => i?.id === id);
                if (index === -1) throw new Error('Item não encontrado no servidor.');
                latest[index] = { ...latest[index], ...updates };
                tx.set(ref, { [collection]: latest }, { merge: true });
            });
            const fresh = await ref.get();
            window.app.data[collection] = fresh.data()?.[collection] || [];
            saveLocalBackup(user.uid, window.app.data);
            window.app.__lastSyncedData = window.app.__lastSyncedData || {};
            window.app.__lastSyncedData[collection] = JSON.parse(JSON.stringify(window.app.data[collection]));
            notifyDataSaved([collection]);
            return true;
        } catch (error) {
            console.error(`[SLC] Erro ao atualizar "${collection}/${id}":`, error);
            window.updateSyncStatus?.(false);
            return false;
        }
    },

    async removeItem(collection, id) {
        const user = auth.currentUser;
        if (!user || !window.app?.data?.[collection]) return false;
        if (window.app?._semesterContext?.type === 'archived') {
            const next = window.app.data[collection].filter(i => i?.id !== id);
            window.app.data[collection] = next;
            return this.saveData(collection, next);
        }
        try {
            const ref = db.collection('users').doc(user.uid);
            await db.runTransaction(async tx => {
                const snap = await tx.get(ref);
                const latest = Array.isArray(snap.data()?.[collection]) ? snap.data()[collection] : [];
                tx.set(ref, { [collection]: latest.filter(i => i?.id !== id) }, { merge: true });
            });
            const fresh = await ref.get();
            window.app.data[collection] = fresh.data()?.[collection] || [];
            saveLocalBackup(user.uid, window.app.data);
            window.app.__lastSyncedData = window.app.__lastSyncedData || {};
            window.app.__lastSyncedData[collection] = JSON.parse(JSON.stringify(window.app.data[collection]));
            notifyDataSaved([collection]);
            return true;
        } catch (error) {
            console.error(`[SLC] Erro ao remover "${collection}/${id}":`, error);
            window.updateSyncStatus?.(false);
            return false;
        }
    },

    async clearAllData() {
        const user = auth.currentUser;
        if (!user) return false;

        try {
            if (window.showLoading) window.showLoading();

            const emptyData = DEFAULT_APP_DATA();
            await db.collection('users').doc(user.uid).set(emptyData);
            if (window.app) window.app.data = emptyData;

            if (window.updateSyncStatus) window.updateSyncStatus(true);
            notifyDataSaved(Object.keys(emptyData));
            return true;
        } catch (error) {
            console.error('Erro ao limpar dados:', error);
            if (window.updateSyncStatus) window.updateSyncStatus(false);
            if (window.showToast) window.showToast('Erro ao limpar dados', 'error');
            return false;
        } finally {
            if (window.hideLoading) window.hideLoading();
        }
    }
};

window.DEFAULT_APP_DATA = DEFAULT_APP_DATA;
window.dbService = dbService;
