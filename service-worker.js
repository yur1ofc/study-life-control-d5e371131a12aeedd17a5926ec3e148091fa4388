// service-worker.js — Cache inteligente com estratégias por tipo de recurso
//
// IMPORTANTE: esta lista precisa ficar em sincronia com os <script> do
// index.html. Toda vez que um arquivo .js novo for adicionado ao site,
// adicione ele aqui também — senão ele só entra no cache dinâmico depois
// do primeiro acesso online, e falha se o usuário abrir o app offline
// (ou logo após instalar como PWA) antes disso acontecer.
const CACHE_VERSION = 'slc-v49-ai-groq-v36';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

// Apenas assets locais no cache estático — nunca CDNs externos
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './launch-polish.css',
  './manifest.json',
  './logo.png',
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
  './subject-difficulty.js',
  './smart-dashboard.js',
  './ai-assistant.js',
  './schedule.js',
  './views.js',
  './tutorial.js',
  './app.js',
  './semester-finish.js',
  './semester-archive-viewer.js',
  './semester-context.js', './shared/academic-context.js',
  './semester-history-manager.js',
  './universidades-brasil.js',
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
  './auto-notification-prompt.js',
  './exam-study-popup.js',
  './quick-search.js',
  './export-data.js',
  './feedback-widget.js',
  './launch-polish.js',
  './improvements.js',
  './ux-improvements.js',
  './reprovado-ecosystem.js',
  './academic-intelligence.js',
  './perfil-adaptativo.js',
  './audit-fixes.js',
  './product-shell.js',
  './focus-engine.js',
  './learning-intelligence-v18.js',
  './adaptive-learning-engine.js',
  './notification-ui.js',
  './telegram-integration.js',
  './app-enhancements.js',
  './curriculum-catalog.js',
  './concursos-brasil.js',
  './ensino-medio-curriculo.js',
  './quick-search.js'
];

// Firebase SDK vem da CDN (gstatic.com) — não existe cópia local no repo.
// Como esses arquivos são carregados via <script src> cross-origin, o
// navegador os pede em modo "no-cors", então a resposta chega "opaque"
// (não dá pra checar o status). O SW cacheia essa resposta mesmo assim na
// primeira visita online, e passa a servir do cache quando offline —
// sem precisar de nenhum arquivo baixado manualmente.
const FIREBASE_CDN_ASSETS = [
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics-compat.js'
];

// Origens externas: busca sempre da rede, sem interceptar
const EXTERNAL_ORIGINS = [
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
    Promise.all([
      caches.open(STATIC_CACHE)
        .then(cache => cache.addAll(STATIC_ASSETS))
        .catch(() => null),
      // Cada URL da CDN é buscada/cacheada separadamente: se uma falhar
      // (ex.: sem internet na primeira instalação), as outras continuam
      // sendo cacheadas normalmente.
      caches.open(STATIC_CACHE).then(cache =>
        Promise.all(
          FIREBASE_CDN_ASSETS.map(url =>
            fetch(url, { mode: 'no-cors' })
              .then(response => cache.put(url, response))
              .catch(() => null)
          )
        )
      )
    ])
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

  // SDK do Firebase (CDN gstatic.com): cache first, com atualização em
  // segundo plano. Garante que abrir o app offline (ou logo após instalar
  // como PWA, antes de qualquer visita online) não trave esperando um
  // arquivo que nunca vai chegar.
  if (FIREBASE_CDN_ASSETS.includes(url)) {
    event.respondWith(
      caches.match(url).then(cached => {
        const fetchPromise = fetch(request, { mode: 'no-cors' })
          .then(response => {
            caches.open(STATIC_CACHE).then(cache => cache.put(url, response.clone()));
            return response;
          })
          .catch(() => null);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // NUNCA intercepta outros recursos externos — deixa o browser buscar diretamente
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
    payload = { title: 'SLCampus', body: event.data ? event.data.text() : 'Você tem um lembrete de estudo.' };
  }

  const title = payload.title || 'SLCampus';
  const options = {
    body: payload.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: payload.tag || 'slc-reminder',
    renotify: !!payload.tag,
    requireInteraction: !!payload.requireInteraction,
    vibrate: payload.vibrate || [120, 60, 120],
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
        if (client.url && client.url.startsWith(self.location.origin) && 'focus' in client) {
          const nav = ('navigate' in client && client.url !== targetUrl) ? client.navigate(targetUrl).catch(() => null) : Promise.resolve();
          return nav.then(() => client.focus());
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

// ── pushsubscriptionchange: o navegador pode invalidar/trocar a assinatura
// push sozinho (rotação periódica de segurança do Chrome/Android, expirar
// por inatividade, etc.), sem que o usuário faça nada. Esse evento existe
// exatamente pra avisar disso — só que, até agora, nada aqui escutava ele.
// Sem esse listener, a assinatura antiga (guardada em pushSubscriptions no
// Firestore) simplesmente parava de funcionar, o servidor continuava
// mandando push pra ela sem saber que estava morta, e o usuário via as
// notificações pararem "do nada", sem nenhum jeito automático de voltar a
// funcionar (só clicando de novo em "Ativar alarmes" manualmente).
// Aqui a gente resolve gerando uma nova assinatura na hora (usando a MESMA
// chave VAPID da assinatura antiga, disponível em event.oldSubscription) e
// guarda ela pra sincronizar com o servidor assim que o app abrir de novo
// — tanto via postMessage (se alguma aba já estiver aberta) quanto via
// Cache Storage (funciona mesmo com o app fechado, sem depender de nenhuma
// aba escutando naquele momento).
self.addEventListener('pushsubscriptionchange', event => {
  const oldKey = event.oldSubscription?.options?.applicationServerKey;
  if (!oldKey) return; // sem a chave antiga não dá pra resubscrever igual

  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: oldKey
    }).then(async newSubscription => {
      const json = newSubscription.toJSON();

      // Fallback que sobrevive mesmo sem nenhuma aba aberta: guarda a nova
      // assinatura numa "resposta" dentro do Cache Storage. O app lê isso
      // na próxima vez que abrir (ver push-notifications.js: syncSubscription).
      try {
        const cache = await caches.open('slc-pending-push-subscription');
        await cache.put('./__pending-subscription', new Response(JSON.stringify(json)));
      } catch (_) { /* Cache Storage indisponível — segue só pelo postMessage */ }

      // Caminho rápido: se alguma aba já estiver aberta agora, avisa direto.
      const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clientsList.forEach(client => client.postMessage({ type: 'slc-push-subscription-renewed', subscription: json }));
    }).catch(() => null)
  );
});
