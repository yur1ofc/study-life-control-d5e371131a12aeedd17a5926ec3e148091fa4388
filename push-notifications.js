// push-notifications.js
// Alarmes de estudo via notificação push real (funciona mesmo com o app
// fechado, em Android e desktop; no iPhone só depois de instalar o site
// como app na tela de início — ver aviso na UI).
//
// O botão "Ativar alarmes" pede permissão de notificação, assina esse
// navegador no Push API do browser (usando a chave VAPID pública) e salva
// essa assinatura em pushSubscriptions (dentro do documento do usuário).
// Quem realmente DISPARA a notificação no horário certo é o servidor
// (api/send-reminders.js), rodando periodicamente — ver esse arquivo pra
// entender como agendar isso.

(function () {
  'use strict';

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  }

  function isSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  function vapidPublicKey() {
    return window.__ENV?.VAPID_PUBLIC_KEY || null;
  }

  function permissionStatus() {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission; // 'default' | 'granted' | 'denied'
  }

  async function getExistingSubscription() {
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  }

  async function saveSubscription(subscription) {
    const settings = window.app?.data?.settings;
    if (!settings) return false;

    const list = Array.isArray(window.app.data.pushSubscriptions) ? window.app.data.pushSubscriptions : [];
    const json = subscription.toJSON();
    // Evita duplicar a mesma assinatura (endpoint) se o usuário clicar em
    // "ativar" mais de uma vez no mesmo navegador.
    const semDuplicata = list.filter(s => s.endpoint !== json.endpoint);
    semDuplicata.push({ ...json, savedAt: new Date().toISOString() });
    // No máximo 10 dispositivos (bate com o limite em firestore.rules).
    const limitado = semDuplicata.slice(-10);

    settings.studyReminders = { ...settings.studyReminders, enabled: true };
    const ok1 = await window.dbService.saveData('pushSubscriptions', limitado);
    const ok2 = await window.dbService.saveData('settings', settings);
    return ok1 && ok2;
  }

  async function removeSubscription(endpoint) {
    const list = Array.isArray(window.app?.data?.pushSubscriptions) ? window.app.data.pushSubscriptions : [];
    const restante = list.filter(s => s.endpoint !== endpoint);
    return window.dbService.saveData('pushSubscriptions', restante);
  }

  // Ativa: pede permissão, cria a assinatura push e salva.
  async function enable() {
    if (!isSupported()) throw new Error('Esse navegador não suporta notificações push.');
    const key = vapidPublicKey();
    if (!key) throw new Error('Alarmes push não configurados neste site (falta VAPID_PUBLIC_KEY no servidor).');

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Permissão de notificação negada.');

    const reg = await navigator.serviceWorker.ready;
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key)
      });
    }

    const ok = await saveSubscription(subscription);
    if (!ok) throw new Error('Não foi possível salvar a assinatura de notificações.');
    return true;
  }

  // Desativa só neste navegador/dispositivo.
  async function disable() {
    const settings = window.app?.data?.settings;
    try {
      const subscription = await getExistingSubscription();
      if (subscription) {
        await removeSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
    } catch (error) {
      console.warn('[push-notifications] erro ao cancelar assinatura:', error);
    }

    if (settings) {
      settings.studyReminders = { ...settings.studyReminders, enabled: false };
      await window.dbService.saveData('settings', settings);
    }
    return true;
  }

  async function saveReminderPrefs(prefs) {
    const settings = window.app?.data?.settings;
    if (!settings) return false;
    settings.studyReminders = { ...settings.studyReminders, ...prefs };
    return window.dbService.saveData('settings', settings);
  }

  async function isEnabledOnThisDevice() {
    if (!isSupported()) return false;
    try {
      const subscription = await getExistingSubscription();
      return !!subscription;
    } catch (_) {
      return false;
    }
  }

  // ─── Recuperação automática de assinatura ──────────────────────────────
  // Cobre os dois jeitos que fazem as notificações "pararem do nada":
  //   1) O navegador dispara pushsubscriptionchange (ver service-worker.js)
  //      enquanto nenhuma aba estava aberta pra receber o postMessage — a
  //      nova assinatura fica esperando no Cache Storage até agora.
  //   2) A assinatura simplesmente sumiu (ex.: dado do site limpo, app
  //      reinstalado) sem nenhum evento avisando — mas a permissão do
  //      navegador ainda está concedida, então dá pra recriar sozinho, sem
  //      precisar pedir de novo pro usuário.
  // Roda toda vez que o app abre (ver chamada em app.js), silenciosamente.
  async function syncSubscription() {
    if (!isSupported()) return;
    const settings = window.app?.data?.settings;
    const remindersEnabled = !!settings?.studyReminders?.enabled;

    // 1) Existe uma assinatura renovada esperando pra ser sincronizada?
    try {
      const cache = await caches.open('slc-pending-push-subscription');
      const cached = await cache.match('./__pending-subscription');
      if (cached) {
        const json = await cached.json();
        await saveSubscription({ toJSON: () => json });
        await cache.delete('./__pending-subscription');
      }
    } catch (_) { /* Cache Storage indisponível — segue pro próximo passo */ }

    if (!remindersEnabled) return; // usuário não tinha ativado — nada a recuperar

    // 2) Reminders marcados como ativos, mas sem assinatura válida agora?
    // Só tenta recriar sozinho se a permissão ainda estiver concedida —
    // sem isso o navegador bloqueia silenciosamente (e teria que ser um
    // clique do usuário mesmo).
    try {
      if (Notification.permission !== 'granted') return;
      const existing = await getExistingSubscription();
      if (existing) return; // já tem assinatura válida, nada a fazer

      const key = vapidPublicKey();
      if (!key) return;
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key)
      });
      await saveSubscription(subscription);
    } catch (error) {
      console.warn('[push-notifications] não foi possível recuperar a assinatura automaticamente:', error);
    }
  }

  // Escuta a notificação "rápida" do service worker (aba já aberta no
  // momento em que a assinatura foi renovada) — sem precisar esperar o
  // próximo carregamento da página pra sincronizar com o servidor.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === 'slc-push-subscription-renewed' && event.data.subscription) {
        saveSubscription({ toJSON: () => event.data.subscription }).catch(() => null);
      }
    });
  }

  window.pushNotifications = {
    isSupported,
    permissionStatus,
    vapidPublicKey,
    enable,
    disable,
    saveReminderPrefs,
    isEnabledOnThisDevice,
    syncSubscription
  };
})();
