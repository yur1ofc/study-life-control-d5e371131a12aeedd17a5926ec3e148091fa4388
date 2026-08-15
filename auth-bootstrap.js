// auth-bootstrap.js
// Liga o botão "Entrar com Google" e decide qual tela mostrar
// (login / setup / dashboard) de acordo com o estado de autenticação
// do Firebase. Sem este arquivo, o clique no botão de login não fazia
// nada e app.init() nunca era chamado em lugar nenhum do código.

(function () {
  function el(id) { return document.getElementById(id); }

  function showScreen(which) {
    const login = el('login-screen');
    const setup = el('setup-screen');
    const dashboard = el('main-dashboard');
    if (login) login.style.display = which === 'login' ? 'flex' : 'none';
    if (setup) setup.style.display = which === 'setup' ? 'block' : 'none';
    if (dashboard) dashboard.style.display = which === 'dashboard' ? 'block' : 'none';
  }

  function showLoginError(message) {
    const box = el('login-error-msg');
    if (!box) return;
    box.textContent = message;
    box.style.display = 'block';
  }

  function hideLoginError() {
    const box = el('login-error-msg');
    if (box) box.style.display = 'none';
  }

  function bindLoginButton() {
    const btn = el('login-google');
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = '1';

    btn.addEventListener('click', async () => {
      hideLoginError();
      btn.disabled = true;
      try {
        await window.auth.signInWithPopup(window.googleProvider);
        // onAuthStateChanged (abaixo) cuida da troca de tela.
      } catch (error) {
        console.error('[SLC] Erro no login com Google:', error);
        let msg = 'Não foi possível entrar. Tente novamente.';
        if (error && error.code === 'auth/popup-closed-by-user') {
          msg = 'Login cancelado.';
        } else if (error && error.code === 'auth/popup-blocked') {
          msg = 'O navegador bloqueou o popup de login. Permita popups para este site e tente de novo.';
        } else if (error && error.code === 'auth/unauthorized-domain') {
          msg = 'Este domínio não está autorizado no Firebase (Authentication → Settings → Authorized domains).';
        } else if (error && error.message === 'Firebase não configurado.') {
          msg = 'Firebase não está configurado. Verifique as variáveis de ambiente.';
        }
        showLoginError(msg);
      } finally {
        btn.disabled = false;
      }
    });
  }

  async function handleAuthenticatedUser(user) {
    try {
      const data = await window.dbService.loadUserData(user.uid);
      const hasCompletedSetup = !!(data && data.user);

      if (hasCompletedSetup) {
        showScreen('dashboard');
        if (window.app && !window.app.initialized) {
          await window.app.init();
        }
      } else {
        showScreen('setup');
      }
    } catch (error) {
      console.error('[SLC] Erro ao carregar dados do usuário após login:', error);
      // Mesmo com erro, não deixa o usuário preso na tela de login.
      showScreen('setup');
    }
  }

  function init() {
    bindLoginButton();

    if (!window.auth || typeof window.auth.onAuthStateChanged !== 'function') {
      console.error('[SLC] auth-bootstrap: window.auth indisponível.');
      return;
    }

    window.auth.onAuthStateChanged((user) => {
      if (user) {
        handleAuthenticatedUser(user);
      } else {
        showScreen('login');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
