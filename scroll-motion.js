/*
 * SLCampus — motion system
 *
 * Goals:
 * - reveal content only when it actually enters the viewport;
 * - animate progress/chart bars only on entrance, not on initial page load;
 * - re-run automatically for dynamically rendered views;
 * - animate numeric stat changes quickly when the value really changes;
 * - never change application data or click handlers.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('slc-motion-ready');

  var revealObserver = null;
  var chartObserver = null;
  var observed = new WeakSet();
  var chartObserved = new WeakSet();
  var lastNumbers = new WeakMap();
  var numberTimers = new WeakMap();
  var mutationQueued = false;

  function isVisibleEnough(el) {
    var r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  }

  function reveal(el) {
    if (!el || el.classList.contains('slc-visible')) return;
    el.classList.add('slc-visible');
  }

  function revealDirection(el, index) {
    if (el.dataset.motionDirection) return;
    // Alternating directions is subtle; mobile CSS normalizes these to vertical.
    if (index % 3 === 1) el.dataset.motionDirection = 'left';
    else if (index % 3 === 2) el.dataset.motionDirection = 'right';
    else el.dataset.motionDirection = 'up';
  }

  function getRevealCandidates(scope) {
    var rootEl = scope && scope.querySelectorAll ? scope : document;
    var selectors = [
      '.card', '.dashboard-header', '.view-header', '.section-header',
      '.section-subtitle', '.stats-row', '.stat-item', '.stat-card',
      '.chart-card', '.consistency-chart', '.consistency-stats',
      '.item-list > li', '.task-card', '.habit-card', '.subject-card',
      '.calendar-card', '.schedule-card', '.feature-card', '.panel',
      '.modal-content', '.empty-state', '.info-card', '.quick-action',
      '.dashboard-grid > *', '.view-container > section', '.view-container > div'
    ];
    var nodes = [];
    var seen = new Set();
    selectors.forEach(function (selector) {
      try {
        rootEl.querySelectorAll(selector).forEach(function (el) {
          if (!seen.has(el)) {
            seen.add(el);
            nodes.push(el);
          }
        });
      } catch (_) {}
    });
    return nodes;
  }

  function setupReveal(scope) {
    var nodes = getRevealCandidates(scope);
    var localIndex = 0;
    nodes.forEach(function (el) {
      if (!el || el === document.body || el.id === 'loading-screen') return;
      if (el.closest && el.closest('#landing-screen') && !document.getElementById('main-dashboard')) return;
      if (el.classList.contains('slc-reveal')) return;

      el.classList.add('slc-reveal');
      revealDirection(el, localIndex++);

      // Cards in the same grid/row get a very small stagger.
      var parent = el.parentElement;
      if (parent && parent.children.length > 1 && parent.children.length <= 12) {
        parent.classList.add('slc-stagger');
      }

      if (reduceMotion || isVisibleEnough(el)) {
        // Visible content should feel instant, while newly arriving content below still animates.
        requestAnimationFrame(function () { reveal(el); });
      } else if (revealObserver) {
        revealObserver.observe(el);
        observed.add(el);
      }
    });
  }

  function captureProgress(el) {
    if (el.dataset.slcProgressReady === '1') return;
    var inline = el.style.width || '';
    var computed = window.getComputedStyle(el).width;
    var target = inline || computed;
    // If CSS returned pixels, keep the original percentage when available.
    if (inline) target = inline;
    else if (el.getAttribute('aria-valuenow') && el.getAttribute('aria-valuemax')) {
      var now = Number(el.getAttribute('aria-valuenow'));
      var max = Number(el.getAttribute('aria-valuemax')) || 100;
      target = Math.max(0, Math.min(100, now / max * 100)) + '%';
    } else {
      // Width is already rendered by the application; use it as a pixel target.
      target = computed;
    }
    el.style.setProperty('--slc-progress-target', target);
    el.dataset.slcProgressReady = '1';
    el.classList.add('slc-progress-motion');
  }

  function captureBar(el) {
    if (el.dataset.slcBarReady === '1') return;
    var inline = el.style.height || '';
    var computed = window.getComputedStyle(el).height;
    var target = inline || computed;
    el.style.setProperty('--slc-bar-target', target);
    el.dataset.slcBarReady = '1';
    el.classList.add('slc-bar-motion');
  }

  function setupCharts(scope) {
    var rootEl = scope && scope.querySelectorAll ? scope : document;
    var progress = rootEl.querySelectorAll('.progress-fill, .setup-progress-fill');
    progress.forEach(function (el) {
      captureProgress(el);
      if (chartObserved.has(el)) return;
      chartObserved.add(el);
      if (reduceMotion || isVisibleEnough(el)) {
        requestAnimationFrame(function () { el.classList.add('slc-chart-visible'); });
      } else if (chartObserver) {
        chartObserver.observe(el);
      }
    });

    var bars = rootEl.querySelectorAll('.chart-bar, .mini-chart-bar');
    bars.forEach(function (el) {
      captureBar(el);
      if (chartObserved.has(el)) return;
      chartObserved.add(el);
      if (reduceMotion || isVisibleEnough(el)) {
        requestAnimationFrame(function () { el.classList.add('slc-chart-visible'); });
      } else if (chartObserver) {
        chartObserver.observe(el);
      }
    });
  }

  function parseNumber(text) {
    if (!text) return null;
    var match = String(text).replace(/\s/g, '').match(/^([^\d-+]*)([-+]?\d+(?:[.,]\d+)?)(.*)$/);
    if (!match) return null;
    var value = Number(match[2].replace(',', '.'));
    if (!Number.isFinite(value)) return null;
    return { prefix: match[1], value: value, suffix: match[3], decimals: (match[2].split(/[.,]/)[1] || '').length };
  }

  function formatNumber(value, decimals) {
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function animateNumber(el, from, to, meta) {
    if (reduceMotion || from === to) return;
    var oldTimer = numberTimers.get(el);
    if (oldTimer) cancelAnimationFrame(oldTimer);

    var start = performance.now();
    var duration = 360;
    var diff = to - from;

    function ease(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function frame(now) {
      var progress = Math.min(1, (now - start) / duration);
      var value = from + diff * ease(progress);
      el.textContent = meta.prefix + formatNumber(value, meta.decimals) + meta.suffix;
      if (progress < 1) {
        var id = requestAnimationFrame(frame);
        numberTimers.set(el, id);
      } else {
        el.textContent = meta.prefix + formatNumber(to, meta.decimals) + meta.suffix;
        numberTimers.delete(el);
      }
    }
    numberTimers.set(el, requestAnimationFrame(frame));
  }

  function watchStats(scope) {
    var rootEl = scope && scope.querySelectorAll ? scope : document;
    rootEl.querySelectorAll('.stat-value, .stat-number, [data-animate-number]').forEach(function (el) {
      if (!el || el.dataset.slcNumberWatch === '1') return;
      el.dataset.slcNumberWatch = '1';
      var parsed = parseNumber(el.textContent);
      if (parsed) lastNumbers.set(el, parsed);
    });
  }

  function processNumberMutation(el) {
    if (!el || el.dataset.slcAnimatingNumber === '1') return;
    var next = parseNumber(el.textContent);
    var previous = lastNumbers.get(el);
    if (!next) return;
    if (previous && previous.value !== next.value) {
      // Restore old value first, then animate to the new one.
      el.dataset.slcAnimatingNumber = '1';
      el.textContent = previous.prefix + formatNumber(previous.value, previous.decimals) + previous.suffix;
      animateNumber(el, previous.value, next.value, next);
      setTimeout(function () { delete el.dataset.slcAnimatingNumber; }, 390);
    }
    lastNumbers.set(el, next);
  }

  function setupObservers() {
    if ('IntersectionObserver' in window) {
      revealObserver = new IntersectionObserver(function (entries, observer) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          reveal(entry.target);
          observer.unobserve(entry.target);
        });
      }, { root: null, rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

      chartObserver = new IntersectionObserver(function (entries, observer) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('slc-chart-visible');
          observer.unobserve(entry.target);
        });
      }, { root: null, rootMargin: '0px 0px -6% 0px', threshold: 0.08 });
    }
  }

  function refreshMotion(scope) {
    setupReveal(scope);
    setupCharts(scope);
    watchStats(scope);
  }

  function scheduleRefresh(target) {
    if (mutationQueued) return;
    mutationQueued = true;
    requestAnimationFrame(function () {
      mutationQueued = false;
      refreshMotion(target || document);
    });
  }

  function init() {
    setupObservers();
    refreshMotion(document);

    // Views are rendered dynamically into #view-container. This observer makes
    // the same entrance animation work on every section without editing every view.
    var appObserver = new MutationObserver(function (mutations) {
      var shouldRefresh = false;
      mutations.forEach(function (mutation) {
        if (mutation.type !== 'childList' || !mutation.addedNodes.length) return;
        shouldRefresh = true;
      });
      if (shouldRefresh) scheduleRefresh(document);
    });
    appObserver.observe(document.body, { childList: true, subtree: true });

    // Only watch number text inside stats. We intentionally do not observe the
    // entire DOM characterData to avoid overhead while typing in forms.
    var numberObserver = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        var el = mutation.target && mutation.target.closest ? mutation.target.closest('.stat-value, .stat-number, [data-animate-number]') : null;
        if (el) processNumberMutation(el);
      });
    });
    numberObserver.observe(document.body, { characterData: true, subtree: true, childList: true });

    // When a view is swapped, put keyboard/focus users at the top of the new
    // content without hijacking normal scrolling.
    document.addEventListener('click', function (event) {
      var nav = event.target.closest && event.target.closest('.nav-item[data-view]');
      if (!nav) return;
      setTimeout(function () {
        var container = document.getElementById('view-container');
        if (!container) return;
        container.classList.remove('slc-view-enter');
        void container.offsetWidth;
        container.classList.add('slc-view-enter');
      }, 40);
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
