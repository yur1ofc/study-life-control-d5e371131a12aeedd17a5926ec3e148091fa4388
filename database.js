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
    settings: {
        heavyMode: false,
        notifications: true,
        autoPlan: true,
        // Token do feed de calendário (.ics) assinável — ver calendar-feed.js.
        calendarToken: null,
        // Preferências de alarme/lembrete por push — ver push-notifications.js.
        studyReminders: {
            enabled: false,
            examsHoursBefore: 24,
            tasksHoursBefore: 24,
            sessionsMinutesBefore: 15
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

            saveLocalBackup(userId, data);

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
            await db.collection('users').doc(user.uid).set({
                [field]: data
            }, { merge: true });

            if (window.app?.data) {
                window.app.data[field] = data;
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
        if (!window.app?.data?.[collection]) return false;
        window.app.data[collection].push(item);
        return this.saveData(collection, window.app.data[collection]);
    },

    async updateItem(collection, id, updates) {
        if (!window.app?.data?.[collection]) return false;

        const index = window.app.data[collection].findIndex(i => i.id === id);
        if (index === -1) return false;

        window.app.data[collection][index] = {
            ...window.app.data[collection][index],
            ...updates
        };

        return this.saveData(collection, window.app.data[collection]);
    },

    async removeItem(collection, id) {
        if (!window.app?.data?.[collection]) return false;

        window.app.data[collection] = window.app.data[collection].filter(i => i.id !== id);
        return this.saveData(collection, window.app.data[collection]);
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
