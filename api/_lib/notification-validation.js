// SLCampus — validação server-side de destinos de notificação.
//
// O documento users/{uid} é gravável pelo próprio usuário. Sem validar no
// servidor, um cliente malicioso poderia gravar um chatId do Telegram de
// terceiros ou um endpoint de Push arbitrário e usar o backend como proxy de
// spam/SSRF. Estas funções são a última linha de defesa (as regras do
// Firestore também protegem os campos, mas podem não estar publicadas).

const PUSH_HOSTS = [
  'fcm.googleapis.com',                 // Chrome / Android / Edge
  'updates.push.services.mozilla.com',  // Firefox
  'push.services.mozilla.com',          // Firefox (legado)
  'web.push.apple.com',                 // Safari / iOS
  'notify.windows.com'                  // WNS (sufixo: *.notify.windows.com)
];

function isValidTelegramChatId(value) {
  // IDs do Telegram são numéricos (negativos para grupos/canais).
  return typeof value === 'string' && /^-?\d{5,20}$/.test(value);
}

function isValidPushEndpoint(value) {
  if (typeof value !== 'string' || value.length > 600) return false;
  let url;
  try { url = new URL(value); } catch (_) { return false; }
  if (url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  return PUSH_HOSTS.some(allowed => host === allowed || host.endsWith('.' + allowed));
}

function isValidPushSubscription(sub) {
  if (!sub || typeof sub !== 'object') return false;
  if (!isValidPushEndpoint(sub.endpoint)) return false;
  const keys = sub.keys;
  return !!keys
    && typeof keys.p256dh === 'string' && keys.p256dh.length > 0 && keys.p256dh.length <= 200
    && typeof keys.auth === 'string' && keys.auth.length > 0 && keys.auth.length <= 100;
}

module.exports = { isValidTelegramChatId, isValidPushEndpoint, isValidPushSubscription };
