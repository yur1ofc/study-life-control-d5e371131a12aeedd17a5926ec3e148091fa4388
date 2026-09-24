// auth.js - autenticação e roteamento inicial
let currentUser = null;

function getEl(id) {
  return document.getElementById(id);
}

function setDisplay(id, value) {
  const el = getEl(id);
  if (el) el.style.display = value;
}

async function handleSignedInUser(user) {
  currentUser = user;
  setDisplay('login-screen', 'none');

  if (!window.app) {
    console.error('window.app ainda não existe');
    window.showToast?.('App ainda não inicializado. Recarregue a página.', 'error');
    return;
  }

  const data = await window.dbService.loadUserData(user.uid);
  const hasUserProfile = !!(data && data.user && (data.user.nome || data.user.curso || data.user.universidade));

  if (!hasUserProfile) {
    // O Firebase Auth pode disparar onAuthStateChanged mais de uma vez na
    // mesma sessão (refresh de token, reconexão após ficar offline, aba
    // voltando a ficar visível, etc.) — não só no login inicial. Se isso
    // acontecer enquanto a pessoa já está no meio do wizard de cadastro
    // (ex.: preenchendo as matérias no passo 4), chamar renderSetupForm()
    // de novo recria a tela do zero e descarta o progresso que ainda não
    // tinha sido salvo no rascunho, dando a impressão de que o site "pediu
    // de novo" pra cadastrar as matérias. Por isso só (re)renderizamos o
    // formulário de setup na PRIMEIRA vez que a tela aparece nesta sessão.
    const setupJaVisivel = getEl('setup-screen')?.style.display !== 'none';

    setDisplay('setup-screen', 'flex');
    setDisplay('main-dashboard', 'none');

    if (!setupJaVisivel && typeof window.app.renderSetupForm === 'function') {
      window.app.renderSetupForm();
    }
    document.dispatchEvent(new Event('app-ready'));
    return;
  }

  setDisplay('setup-screen', 'none');
  setDisplay('main-dashboard', 'block');
  await window.app.init();
}

function handleSignedOutUser() {
  currentUser = null;
  setDisplay('login-screen', 'flex');
  setDisplay('setup-screen', 'none');
  setDisplay('main-dashboard', 'none');
}

auth.onAuthStateChanged(async (user) => {
  try {
    window.showLoading?.();

    if (user) {
      await handleSignedInUser(user);
    } else {
      handleSignedOutUser();
    }
  } catch (error) {
    console.error('Erro na autenticação/inicialização:', error);
    window.showToast?.('Erro ao inicializar aplicação. Recarregue a página.', 'error');
  } finally {
    window.hideLoading?.();
  }
});

async function loginWithGoogle() {
  const btn = getEl('login-google');
  const errorEl = getEl('login-error-msg');

  // Estado: carregando
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
  }
  if (errorEl) errorEl.style.display = 'none';

  try {
    await auth.signInWithPopup(googleProvider);
  } catch (error) {
    console.error('Erro no login:', error);
    const code = error?.code || '';

    // Popup fechado pelo usuário — não é erro real, só reseta o botão
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fab fa-google"></i> Entrar com Google';
      }
      return;
    }

    // Não fazemos fallback para signInWithRedirect. Em um app hospedado no Vercel,
    // esse fallback leva o usuário ao authDomain do Firebase (historicamente
    // study-life-control.firebaseapp.com), o que dá a impressão de que o site
    // voltou para a marca antiga. O login por popup deve ser iniciado diretamente
    // pelo toque/clique do usuário. Se o navegador bloquear, orientamos a liberar
    // popups em vez de trocar de domínio silenciosamente.
    if (code === 'auth/popup-blocked') {
      const msg = 'O navegador bloqueou a janela do Google. Permita pop-ups para slcampus.vercel.app e toque em Entrar com Google novamente.';
      if (errorEl) { errorEl.textContent = msg; errorEl.style.display = 'block'; }
      else window.showToast?.(msg, 'warning');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fab fa-google"></i> Entrar com Google'; }
      return;
    }

    // Erro real — mostrar na tela
    const msgs = {
      'auth/network-request-failed': 'Sem conexão com a internet. Verifique sua rede.',
      'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.',
      'auth/user-disabled': 'Esta conta foi desativada.',
    };
    const friendlyMsg = msgs[code] || 'Não foi possível entrar. Tente novamente.';

    if (errorEl) {
      errorEl.textContent = friendlyMsg;
      errorEl.style.display = 'block';
    } else {
      window.showToast?.(friendlyMsg, 'error');
    }
  } finally {
    // Resetar botão se ainda na tela de login
    if (btn && getEl('login-screen')?.style.display !== 'none') {
      btn.disabled = false;
      btn.innerHTML = '<i class="fab fa-google"></i> Entrar com Google';
    }
  }
}

async function logout() {
  try {
    const uid = auth.currentUser?.uid;
    await auth.signOut();
    // O backup local é por UID e não é necessário após o logout.
    // Isso evita deixar dados acadêmicos no navegador de um dispositivo compartilhado.
    if (uid) {
      try { localStorage.removeItem(`slc-backup:${uid}`); } catch (_) {}
    }
    window.showToast?.('Desconectado com sucesso', 'success');
  } catch (error) {
    console.error('Erro no logout:', error);
    const message = error?.code === 'auth/network-request-failed'
      ? 'Verifique sua conexão e tente novamente.'
      : 'Não foi possível encerrar a sessão agora.';
    window.showToast?.('Erro ao sair: ' + message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  getEl('login-google')?.addEventListener('click', loginWithGoogle);
  getEl('logout-btn')?.addEventListener('click', logout);
});

window.authService = {
  getCurrentUser: () => currentUser,
  loginWithGoogle,
  logout
};
