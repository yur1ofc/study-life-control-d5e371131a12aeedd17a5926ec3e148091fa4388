// auto-notification-prompt.js
// Pede permissão de notificação automaticamente na primeira vez que o site
// abre em um aparelho/navegador que ainda não decidiu nada (Notification.permission
// === 'default'). Em vez de chamar Notification.requestPermission() direto no
// load (o que vários navegadores ignoram/bloqueiam sem gesto do usuário e é uma
// péssima primeira impressão), mostra uma faixa leve pedindo um clique — esse
// clique já conta como o gesto que o navegador exige, e a permissão nativa some
// junto.
//
// Reaparece em qualquer navegador/dispositivo novo onde ainda não foi decidido
// (permitido ou negado). Se a pessoa clicar em "Agora não", não repete no mesmo
// dia nesse aparelho, mas volta a perguntar no dia seguinte até que ela decida.

(function () {
  'use strict';

  const DISMISS_KEY_PREFIX = 'slc-notif-prompt-dismissed-';

  function todayKey() {
    const d = new Date();
    return `${DISMISS_KEY_PREFIX}${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  function wasDismissedToday() {
    try { return localStorage.getItem(todayKey()) === '1'; } catch (_) { return false; }
  }

  function dismissForToday() {
    try { localStorage.setItem(todayKey(), '1'); } catch (_) { /* ignore */ }
  }

  function buildBanner() {
    const banner = document.createElement('div');
    banner.id = 'auto-notif-banner';
    banner.className = 'auto-notif-banner';
    banner.innerHTML = `
      <div class="auto-notif-banner-icon"><i class="fas fa-bell"></i></div>
      <div class="auto-notif-banner-text">
        <strong>Ativar alarmes de provas e lembretes?</strong>
        <span>Avisamos antes de provas, trabalhos, sessões, revisões e aulas — mesmo com o app fechado.</span>
      </div>
      <div class="auto-notif-banner-actions">
        <button type="button" class="auto-notif-btn secondary" id="auto-notif-dismiss">Agora não</button>
        <button type="button" class="auto-notif-btn primary" id="auto-notif-accept">Ativar</button>
      </div>
    `;
    return banner;
  }

  function removeBanner(banner) {
    banner?.classList.remove('is-visible');
    setTimeout(() => banner?.remove(), 200);
  }

  async function showPrompt() {
    if (document.getElementById('auto-notif-banner')) return;
    const banner = buildBanner();
    document.body.appendChild(banner);
    requestAnimationFrame(() => banner.classList.add('is-visible'));

    document.getElementById('auto-notif-dismiss')?.addEventListener('click', () => {
      dismissForToday();
      removeBanner(banner);
    });

    document.getElementById('auto-notif-accept')?.addEventListener('click', async () => {
      const btn = document.getElementById('auto-notif-accept');
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
      try {
        await window.pushNotifications.enable();
        window.showToast?.('Notificações ativadas! Você vai receber os alarmes de estudo.', 'success');
      } catch (error) {
        // Se a permissão foi negada, não adianta insistir hoje.
        dismissForToday();
        window.showToast?.(error?.message || 'Não foi possível ativar as notificações.', 'error');
      } finally {
        removeBanner(banner);
      }
    });
  }

  function maybePrompt() {
    if (!window.pushNotifications?.isSupported?.()) return;
    if (window.pushNotifications.permissionStatus() !== 'default') return;
    if (wasDismissedToday()) return;
    setTimeout(showPrompt, 1500);
  }

  document.addEventListener('app-ready', maybePrompt);
})();
