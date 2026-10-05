// modal-scroll-fix.js — correção global de modais/folhas no celular (iOS/Android).
// Resolve: (1) a página de trás rolava em vez do modal; (2) a barra inferior
// ficava POR CIMA do modal e escondia o fim do conteúdo; (3) 100vh no iOS
// passa da área visível. Vale para todos os modais do app, atuais e futuros.
(function () {
  'use strict';
  var SEL = [
    '.modal', '.slc-telegram-modal', '.slc-overlay', '.exam-popup-overlay',
    '.semfin-overlay', '.hist-overlay', '.semarch-modal', '.catalog-modal-overlay', '.slc-resource-modal',
    '.learning-evidence-card', '[role="dialog"][aria-modal="true"]'
  ].join(',');
  var SCROLLERS = [
    '.modal-content', '.slc-telegram-modal-card', '.slc-overlay-card', '.exam-popup-card',
    '.slc-resource-modal .modal-content', '.semfin-modal', '.hist-modal', '.catalog-modal',
    '.learning-evidence-card', '[role="dialog"][aria-modal="true"]'
  ].join(',');

  var css = '' +
    // O elemento que contém os campos é o único que deve rolar. Isso evita que
    // o gesto seja capturado pelo overlay/página de trás no Safari do iPhone.
    SCROLLERS + '{overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;}' +
    '.modal{overflow:hidden;}' +
    '.modal-content{max-height:min(90dvh,900px);overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;}' +
    '.slc-overlay{overflow:hidden;}' +
    '.slc-overlay-card{max-height:calc(100dvh - 40px);overflow-y:auto;}' +
    '.exam-popup-overlay{overflow:hidden;}' +
    '.exam-popup-card{max-height:88dvh;overflow-y:auto;}' +
    '.semfin-overlay,.hist-overlay,.catalog-modal-overlay{overflow:hidden;}' +
    '.semfin-modal,.hist-modal,.catalog-modal{max-height:calc(100dvh - 28px);overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;}' +
    '.learning-evidence-card{overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;}' +
    '@media (max-width:768px){' +
      '.slc-telegram-modal-card{max-height:calc(100dvh - 16px)!important;padding-bottom:env(safe-area-inset-bottom,0px);}' +
      '.slc-telegram-modal-body{padding-bottom:calc(24px + env(safe-area-inset-bottom,0px))!important;}' +
    '}' +
    // com modal aberto, os modais ficam acima da barra inferior e do botão rápido
    'body.slc-modal-open .slc-telegram-modal,body.slc-modal-open .slc-overlay,body.slc-modal-open .exam-popup-overlay,' +
    'body.slc-modal-open .modal,body.slc-modal-open [role="dialog"][aria-modal="true"]{z-index:2147483500;}' +
    // e a barra inferior sai da frente (volta sozinha ao fechar)
    'body.slc-modal-open #slc-product-bottom-nav,body.slc-modal-open #slc-bottom-nav,body.slc-modal-open #slc-quick-add-btn{' +
      'opacity:0!important;pointer-events:none!important;transform:translateY(100%)!important;}' +
    // trava a página de fundo (técnica que funciona no Safari do iPhone)
    'html.slc-scroll-locked{overflow:hidden!important;overscroll-behavior:none;}' +
    'body.slc-scroll-locked{position:fixed!important;left:0;right:0;width:100%;overflow:hidden!important;}';
  var st = document.createElement('style'); st.id = 'slc-modal-scroll-fix'; st.textContent = css; document.head.appendChild(st);

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.pointerEvents === 'none' || Number(cs.opacity) === 0) return false;
    var r = el.getBoundingClientRect();
    return r.width > 40 && r.height > 40;
  }
  function anyOpen() {
    var els = document.querySelectorAll(SEL);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.id === 'slc-mobile-more' || el.hidden) continue;       // esse painel já tem o próprio controle
      if (el.closest && el.closest('[hidden]')) continue;
      if (isVisible(el)) return true;
    }
    return false;
  }

  var locked = false, savedY = 0;
  function lock() {
    if (locked) return; locked = true;
    savedY = window.scrollY || document.documentElement.scrollTop || 0;
    document.documentElement.classList.add('slc-scroll-locked');
    document.body.classList.add('slc-scroll-locked', 'slc-modal-open');
    document.body.style.top = (-savedY) + 'px';
  }
  function unlock() {
    if (!locked) return; locked = false;
    document.documentElement.classList.remove('slc-scroll-locked');
    document.body.classList.remove('slc-scroll-locked', 'slc-modal-open');
    document.body.style.top = '';
    window.scrollTo(0, savedY);
  }
  var queued = false;
  function check() { queued = false; if (anyOpen()) lock(); else unlock(); }
  function schedule() { if (queued) return; queued = true; requestAnimationFrame(check); }

  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'open'] });
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  document.addEventListener('visibilitychange', schedule);
  schedule();

  // Rede de segurança: procura o PRIMEIRO ancestral realmente rolável.
  // Antes, closest('.modal') encontrava o overlay antes do .modal-content e
  // acabava bloqueando o gesto no iPhone mesmo quando o conteúdo tinha rolagem.
  function findScrollable(target) {
    var el = target && target.nodeType === 1 ? target : target?.parentElement;
    while (el && el !== document.body) {
      var cs = getComputedStyle(el);
      var canScroll = (el.scrollHeight > el.clientHeight + 1) &&
        (/(auto|scroll|overlay)/.test(cs.overflowY) || el.matches('.modal-content,.slc-telegram-modal-card,.slc-overlay-card,.exam-popup-card,.semfin-modal,.hist-modal,.catalog-modal,.learning-evidence-card'));
      if (canScroll) return el;
      el = el.parentElement;
    }
    return null;
  }

  document.addEventListener('touchmove', function (e) {
    if (!locked) return;
    var scroller = findScrollable(e.target);
    if (scroller) return;
    e.preventDefault(); // fora do conteúdo rolável, o fundo nunca recebe o gesto.
  }, { passive: false });

  window.SLCModalScroll = { recheck: schedule };
})();
