// Landing page: apresenta o SLCampus antes do login sem interferir no app autenticado.
(function () {
  'use strict';

  function el(id) { return document.getElementById(id); }

  function showLanding() {
    const landing = el('landing-screen');
    const login = el('login-screen');
    if (landing) landing.style.display = 'block';
    if (login) login.style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showLogin() {
    const landing = el('landing-screen');
    const login = el('login-screen');
    if (landing) landing.style.display = 'none';
    if (login) login.style.display = 'flex';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => el('login-google')?.focus(), 80);
  }

  function bind() {
    ['landing-login', 'landing-login-top', 'landing-login-bottom'].forEach(id => {
      el(id)?.addEventListener('click', showLogin);
    });
    el('back-to-landing')?.addEventListener('click', showLanding);
  }

  window.slcLanding = { showLanding, showLogin };
  document.addEventListener('DOMContentLoaded', bind);
})();
