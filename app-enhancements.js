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

    const DISMISS_KEY = 'slc_pwa_install_dismissed';
    const DISMISS_MS = 30 * 24 * 60 * 60 * 1000;

    function recentlyDismissed() {
      try {
        const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
        return at && Date.now() - at < DISMISS_MS;
      } catch (e) {
        return false;
      }
    }

    function cookieNoticeOpen() {
      const notice = el('cookie-notice');
      if (!notice) return false;
      if (!notice.hidden) return true;
      // Se o aviso ainda não foi aceito, considera "aberto" mesmo que o
      // script inline ainda não tenha removido o atributo hidden.
      try { return localStorage.getItem('slc_cookie_notice') !== 'ok'; } catch (e) { return false; }
    }

    function showCardIfAllowed() {
      if (!deferredInstallPrompt || recentlyDismissed() || cookieNoticeOpen()) return;
      card.hidden = false;
    }

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      showCardIfAllowed();
      // Se o aviso de cookies estiver aberto, espera o usuário dispensá-lo
      // para não sobrepor os botões do card de instalação no mobile.
      el('cookie-notice-accept')?.addEventListener('click', () => {
        setTimeout(showCardIfAllowed, 400);
      }, { once: true });
    });

    installBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice.catch(() => null);
      if (choice?.outcome === 'accepted') {
        window.showToast?.('App instalado com sucesso!', 'success');
        try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {}
      }
      deferredInstallPrompt = null;
      card.hidden = true;
    });

    closeBtn.addEventListener('click', () => {
      card.hidden = true;
      try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {}
    });

    window.addEventListener('appinstalled', () => {
      card.hidden = true;
      deferredInstallPrompt = null;
      try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {}
      window.showToast?.('SLCampus instalado no dispositivo!', 'success');
    });
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    // Se já existia um SW controlando esta aba ANTES deste registro, então
    // um "controllerchange" depois é uma atualização de verdade (nova
    // versão assumiu). Se não existia, é só o primeiro registro do site
    // neste dispositivo — nesse caso não precisa recarregar nada.
    const hadControllerBefore = !!navigator.serviceWorker.controller;
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadControllerBefore || refreshing) return;
      refreshing = true;
      // A sessão do Firebase fica salva no IndexedDB (fora do Cache
      // Storage que o service worker controla), então recarregar aqui
      // não desconecta a conta do usuário — só busca os arquivos novos.
      window.location.reload();
    });

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').then((reg) => {
        // Checa por atualização assim que registra...
        reg.update().catch(() => null);
        // ...toda vez que o app volta a ficar visível (cobre o caso do
        // usuário deixar a aba/PWA aberta em segundo plano por um tempo)...
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reg.update().catch(() => null);
        });
        // ...e periodicamente, para quem fica com o app aberto por horas.
        setInterval(() => reg.update().catch(() => null), 60 * 60 * 1000);
      }).catch((error) => {
        console.error('Falha ao registrar service worker:', error);
      });
    });
  }

  function setupGlobalErrorHandling() {
    // Throttle: evita uma rajada de toasts vermelhos quando vários erros
    // acontecem juntos (ex.: rede caindo dispara vários promises rejeitados).
    // O console.error continua sendo emitido SEMPRE — só o toast é limitado.
    let lastErrorToastAt = 0;
    const showErrorToast = (msg) => {
      const now = Date.now();
      if (now - lastErrorToastAt < 3000) return;
      lastErrorToastAt = now;
      window.showToast?.(msg, 'error');
    };

    window.addEventListener('error', (event) => {
      console.error('Erro global capturado:', event.error || event.message);
      showErrorToast('Ocorreu um erro inesperado. Tente atualizar a página.');
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('Promise rejeitada sem tratamento:', event.reason);
      showErrorToast('Falha ao processar uma ação. Revise sua conexão e tente de novo.');
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
