// perfil-adaptativo.js
// Ajusta a interface (menu lateral, principalmente) de acordo com o perfil
// escolhido no cadastro (faculdade / concurso / ensino_medio / geral).
// Itens como "Grade Curricular" e "Situação Acadêmica" só fazem sentido
// pra quem está na faculdade — pra outros perfis, eles ficam escondidos
// (os dados continuam existindo, só não aparecem no menu).
//
// Adicione no index.html DEPOIS de setup-wizard.js e ANTES de </body>:
//   <script src="perfil-adaptativo.js"></script>

(function () {
  'use strict';

  // Views que só existem/fazem sentido pra quem está na faculdade
  const VIEWS_SO_FACULDADE = ['grade-curricular', 'situacao-academica'];

  function getPerfil() {
    return window.app?.data?.user?.perfil || 'faculdade';
  }

  function injectStyle() {
    if (document.getElementById('slc-perfil-style')) return;
    const style = document.createElement('style');
    style.id = 'slc-perfil-style';
    style.textContent = `
      .slc-hide-faculdade-only { display: none !important; }
    `;
    document.head.appendChild(style);
  }

  function applyPerfilUI() {
    const perfil = getPerfil();
    injectStyle();

    VIEWS_SO_FACULDADE.forEach(view => {
      const item = document.querySelector(`.nav-item[data-view="${view}"]`);
      if (item) item.classList.toggle('slc-hide-faculdade-only', perfil !== 'faculdade');
    });

    // Botão "Finalizar Semestre" (ecossistema de repescagem/reprovação) só
    // faz sentido pra quem tem semestres de faculdade.
    document.querySelectorAll('.btn-finalizar-semestre-cta, #btn-finalizar-semestre').forEach(el => {
      el.classList.toggle('slc-hide-faculdade-only', perfil !== 'faculdade');
    });
  }

  function patchApp() {
    const app = window.app;
    if (!app || app.__perfilAdaptativoPatched) return;
    app.__perfilAdaptativoPatched = true;

    const _origLoadView = app.loadView?.bind(app);
    if (!_origLoadView) return;

    window.app.loadView = function (view) {
      const result = _origLoadView(view);
      setTimeout(applyPerfilUI, 150);
      return result;
    };

    setTimeout(applyPerfilUI, 400);
  }

  document.addEventListener('app-ready', () => setTimeout(patchApp, 400));
  if (window.app?.initialized) setTimeout(patchApp, 100);

  window.SLCPerfilAdaptativo = { applyPerfilUI, getPerfil };
})();
