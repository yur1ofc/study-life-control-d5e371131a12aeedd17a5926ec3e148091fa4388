(function () {
  let deferredInstallPrompt = null;
  let networkBannerTimer = null;
  let networkWasOffline = !navigator.onLine;

  function el(id) {
    return document.getElementById(id);
  }

  function setLoadingMessage(text) {
    const target = el('loading-text');
    if (target) target.textContent = text;
  }

  function updateNetworkBanner(forceState = null) {
    const banner = el('network-banner');
    const text = el('network-banner-text');
    if (!banner || !text) return;

    const isOnline = forceState == null ? navigator.onLine : forceState === 'online';

    if (networkBannerTimer) {
      clearTimeout(networkBannerTimer);
      networkBannerTimer = null;
    }

    if (!isOnline) {
      networkWasOffline = true;
      text.textContent = 'Você está offline. O app continua funcionando com dados locais quando possível.';
      banner.hidden = false;
      return;
    }

    if (networkWasOffline) {
      text.textContent = 'Conexão restabelecida. Tudo pronto para sincronizar.';
      banner.hidden = false;
      networkBannerTimer = setTimeout(() => {
        if (navigator.onLine) banner.hidden = true;
      }, 2200);
      networkWasOffline = false;
      return;
    }

    banner.hidden = true;
  }

  function setupInstallPrompt() {
    const card = el('pwa-install-card');
    const installBtn = el('pwa-install-btn');
    const closeBtn = el('pwa-install-close');
    if (!card || !installBtn || !closeBtn) return;

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      card.hidden = false;
    });

    installBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice.catch(() => null);
      if (choice?.outcome === 'accepted') {
        window.showToast?.('App instalado com sucesso!', 'success');
      }
      deferredInstallPrompt = null;
      card.hidden = true;
    });

    closeBtn.addEventListener('click', () => {
      card.hidden = true;
    });

    window.addEventListener('appinstalled', () => {
      card.hidden = true;
      deferredInstallPrompt = null;
      window.showToast?.('SLCampus instalado no dispositivo!', 'success');
    });
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch((error) => {
        console.error('Falha ao registrar service worker:', error);
      });
    });
  }

  function setupGlobalErrorHandling() {
    window.addEventListener('error', (event) => {
      console.error('Erro global capturado:', event.error || event.message);
      window.showToast?.('Ocorreu um erro inesperado. Tente atualizar a página.', 'error');
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('Promise rejeitada sem tratamento:', event.reason);
      window.showToast?.('Falha ao processar uma ação. Revise sua conexão e tente de novo.', 'error');
    });
  }

  let scrollLockY = 0;

  function closeSidebar() {
    document.body.classList.remove('sidebar-open');
    const overlay = el('mobile-nav-overlay');
    if (overlay) overlay.hidden = true;

    // Destrava o scroll do fundo (ver openSidebar)
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    window.scrollTo(0, scrollLockY);
  }

  function openSidebar() {
    // Trava o scroll do fundo enquanto o menu está aberto — sem isso, arrastar
    // o dedo dentro do menu também rola a página por trás dele. Usa a técnica
    // de "position:fixed" em vez de só overflow:hidden porque é a única forma
    // confiável de bloquear o bounce/scroll em iOS Safari, e funciona igual em
    // Android e desktop também (independe de marca/modelo de aparelho).
    scrollLockY = window.scrollY || window.pageYOffset || 0;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollLockY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';

    document.body.classList.add('sidebar-open');
    const overlay = el('mobile-nav-overlay');
    if (overlay) overlay.hidden = false;
  }

  window.SLCSidebar = { open: openSidebar, close: closeSidebar };

  function setupMobileSidebar() {
    const toggle = el('mobile-nav-toggle');
    const overlay = el('mobile-nav-overlay');
    if (!toggle || !overlay) return;

    toggle.addEventListener('click', () => {
      if (document.body.classList.contains('sidebar-open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });

    overlay.addEventListener('click', closeSidebar);

    document.addEventListener('click', (event) => {
      const item = event.target.closest('.nav-item');
      if (item && window.innerWidth <= 980) {
        setTimeout(closeSidebar, 120);
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 980) closeSidebar();
    });
  }

  function setupOfflineEvents() {
    updateNetworkBanner(navigator.onLine ? 'online' : 'offline');
    window.addEventListener('online', () => updateNetworkBanner('online'));
    window.addEventListener('offline', () => updateNetworkBanner('offline'));
  }

  function improveRefreshButton() {
    const refresh = el('refresh-data');
    if (!refresh || refresh.dataset.enhanced) return;
    refresh.dataset.enhanced = '1';
    refresh.addEventListener('click', () => {
      setLoadingMessage('Sincronizando seus dados...');
      setTimeout(() => setLoadingMessage('Carregando seu painel acadêmico...'), 1200);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    setLoadingMessage('Carregando seu painel acadêmico...');
    registerServiceWorker();
    setupInstallPrompt();
    setupGlobalErrorHandling();
    setupMobileSidebar();
    setupOfflineEvents();
    improveRefreshButton();
  });

  document.addEventListener('app-ready', () => {
    improveRefreshButton();
  });
})();
