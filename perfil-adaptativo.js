// Personalização da experiência por perfil de estudo.
(function () {
  'use strict';

  const FACULDADE_ONLY = ['grade-curricular'];

  function getPerfil() {
    const raw = window.app?.data?.user?.perfil || 'faculdade';
    return ['faculdade','concurso','ensino_medio','geral'].includes(raw) ? raw : 'faculdade';
  }

  function injectStyle() {
    if (document.getElementById('slc-perfil-style')) return;
    const style = document.createElement('style');
    style.id = 'slc-perfil-style';
    style.textContent = `
      .slc-hide-faculdade-only,.slc-profile-hidden{display:none!important}
      body[data-slc-profile="concurso"] .nav-group-header[data-group="academico"]{color:var(--accent-secondary)}
      body[data-slc-profile="ensino_medio"] .nav-group-header[data-group="academico"]{color:var(--accent-success)}
    `;
    document.head.appendChild(style);
  }

  function applyPerfilUI() {
    injectStyle();
    const perfil = getPerfil();
    document.body.dataset.slcProfile = perfil;
    FACULDADE_ONLY.forEach(view => document.querySelector(`.nav-item[data-view="${view}"]`)?.classList.toggle('slc-hide-faculdade-only', perfil !== 'faculdade'));
    document.querySelectorAll('.btn-finalizar-semestre-cta,#btn-finalizar-semestre').forEach(el => el.classList.toggle('slc-hide-faculdade-only', perfil !== 'faculdade'));
    window.SLCProfileExperience?.apply?.();
  }

  function patchApp() {
    const app = window.app;
    if (!app || app.__perfilAdaptativoPatched) return;
    app.__perfilAdaptativoPatched = true;
    const original = app.loadView?.bind(app);
    if (!original) return;
    app.loadView = function (view) {
      const result = original(view);
      setTimeout(applyPerfilUI, 120);
      return result;
    };
    setTimeout(applyPerfilUI, 250);
  }

  document.addEventListener('app-ready', () => setTimeout(patchApp, 250));
  if (window.app?.initialized) setTimeout(patchApp, 100);
  window.SLCPerfilAdaptativo = { applyPerfilUI, getPerfil };
})();
