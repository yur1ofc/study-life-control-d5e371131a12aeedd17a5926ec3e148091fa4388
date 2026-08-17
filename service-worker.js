// service-worker.js — Cache inteligente com estratégias por tipo de recurso
//
// IMPORTANTE: esta lista precisa ficar em sincronia com os <script> do
// index.html. Toda vez que um arquivo .js novo for adicionado ao site,
// adicione ele aqui também — senão ele só entra no cache dinâmico depois
// do primeiro acesso online, e falha se o usuário abrir o app offline
// (ou logo após instalar como PWA) antes disso acontecer.
const CACHE_VERSION = 'slc-v12';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

// Apenas assets locais no cache estático — nunca CDNs externos
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './launch-polish.css',
  './manifest.json',
  './favicon.svg',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './theme-engine.js',
  './env-config.js',
  './curriculum-catalog.js',
  './firebase-config.js',
  './security.js',
  './utils.js',
  './auth.js',
  './database.js',
  './daily-log.js',
  './class-diary.js',
  './diary-view.js',
  './review-system.js',
  './grade-calculator.js',
  './smart-dashboard.js',
  './ai-assistant.js',
  './schedule.js',
  './views.js',
  './tutorial.js',
  './app.js',
  './semester-finish.js',
  './setup-wizard.js',
  './launch-ready.js',
  './script.js',
  './dashboard-prioritario.js',
  './onboarding-simplificado.js',
  './schedule-ia-import.js',
  './subjects-curriculum-sync.js',
  './grade-structure-modal.js',
  './grade-ia-import.js',
  './setup-onboarding-enhancer.js',
  './app-enhancements.js',
  './xp-widget.js',
  './calendar-feed.js',
  './push-notifications.js',
  './export-data.js',
  './feedback-widget.js',
  './launch-polish.js',
  './improvements.js',
  './ux-improvements.js'
];

// Origens externas: busca sempre da rede, sem interceptar
const EXTERNAL_ORIGINS = [
  'https://www.gstatic.com',
  'https://apis.google.com',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://cdnjs.cloudflare.com',
  'https://firestore.googleapis.com',
  'https://identitytoolkit.googleapis.com',
  'https://securetoken.googleapis.com',
  'https://lh3.googleusercontent.com',
];

function isExternal(url) {
  return EXTERNAL_ORIGINS.some(origin => url.startsWith(origin));
}

function isFirebase(url) {
  return url.includes('firebaseio.com') ||
         url.includes('googleapis.com') ||
         url.includes('firebaseapp.com');
}

// env-config.js carrega as variáveis de ambiente (inclusive VAPID_PUBLIC_KEY)
// injetadas NO BUILD. Elas podem mudar entre deploys mesmo quando nenhum
// arquivo de código muda — e como o service-worker.js não muda de bytes
// nesses casos, o navegador nunca reinstala o SW e cache-first serviria
// esse arquivo desatualizado para sempre. Por isso ele é tratado à parte:
// tenta a rede primeiro, só cai pro cache se estiver offline.
const NETWORK_FIRST_ASSETS = ['/env-config.js'];

function isNetworkFirst(url) {
  return NETWORK_FIRST_ASSETS.some(path => url.endsWith(path));
}

// ── Install: pré-cacheia assets locais ──────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .catch(() => null)
  );
  self.skipWaiting();
});

// ── Activate: limpa caches antigos ──────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: estratégia por tipo de recurso ───────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = request.url;

  // Ignora requisições não-GET
  if (request.method !== 'GET') return;

  // NUNCA intercepta recursos externos — deixa o browser buscar diretamente
  if (isExternal(url) || isFirebase(url)) return;

  // Ignora URLs de extensões do browser
  if (url.startsWith('chrome-extension://') || url.startsWith('moz-extension://')) return;

  // env-config.js: rede primeiro (ver comentário acima de NETWORK_FIRST_ASSETS)
  if (isNetworkFirst(url)) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Assets locais: Cache First (serve do cache, atualiza em background)
  event.respondWith(
    caches.match(request).then(cached => {
      const fetchPromise = fetch(request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => null);

      return cached || fetchPromise || caches.match('./index.html');
    })
  );
});

// ── Push: recebe o alarme mandado por api/send-reminders.js e mostra a
// notificação, mesmo com o app fechado ─────────────────────────────────────
self.addEventListener('push', event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = { title: 'Study Life Control', body: event.data ? event.data.text() : 'Você tem um lembrete de estudo.' };
  }

  const title = payload.title || 'Study Life Control';
  const options = {
    body: payload.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: payload.tag || 'slc-reminder',
    renotify: !!payload.tag,
    data: { url: payload.url || './' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Clique na notificação: foca a aba já aberta, ou abre uma nova ──────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || './';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
