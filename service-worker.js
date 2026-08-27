// security.js — Rate limiting, sanitização e proteção de dados sensíveis
// Carregue antes de app.js no index.html

(function () {
  'use strict';

  // ─── 1. Rate Limiting para operações de escrita no Firestore ─────────────
  //
  // Impede que um bug ou usuário malicioso dispare centenas de writes/segundo,
  // evitando custo inesperado e esgotamento de cota do Firebase gratuito.

  const RATE_LIMITS = {
    saveData:    { max: 60,  windowMs: 60_000  },  // 60 saves por minuto
    saveAllData: { max: 10,  windowMs: 60_000  },  // 10 saves completos por minuto
    aiAsk:       { max: 40,  windowMs: 60_000  },  // 40 perguntas à IA por minuto
    addItem:     { max: 120, windowMs: 60_000  },  // 120 itens adicionados por minuto
  };

  const _rateLimitCounters = {};

  function checkRateLimit(operation) {
    const rule = RATE_LIMITS[operation];
    if (!rule) return true;

    const now = Date.now();
    if (!_rateLimitCounters[operation]) {
      _rateLimitCounters[operation] = { count: 0, windowStart: now };
    }

    const c = _rateLimitCounters[operation];

    if (now - c.windowStart > rule.windowMs) {
      c.count = 0;
      c.windowStart = now;
    }

    c.count++;

    if (c.count > rule.max) {
      console.warn(`[SLC Security] Rate limit atingido para "${operation}": ${c.count}/${rule.max} em ${rule.windowMs / 1000}s`);
      if (window.showToast) {
        window.showToast('Muitas operações em pouco tempo. Aguarde um momento.', 'warning');
      }
      return false;
    }

    return true;
  }

  window.checkRateLimit = checkRateLimit;

  // ─── 2. Sanitização de inputs (previne XSS via innerHTML) ────────────────

  function sanitizeString(value) {
    if (typeof value !== 'string') return value;
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  // Sanitiza recursivamente um objeto antes de salvar no Firestore
  function sanitizeData(obj) {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') return sanitizeString(obj);
    if (Array.isArray(obj)) return obj.map(sanitizeData);
    if (typeof obj === 'object') {
      const clean = {};
      for (const [key, value] of Object.entries(obj)) {
        clean[key] = sanitizeData(value);
      }
      return clean;
    }
    return obj;
  }

  window.sanitizeData   = sanitizeData;
  window.sanitizeString = sanitizeString;

  // ─── 3. Patch no dbService para aplicar rate limiting automaticamente ────
  //
  // Aguarda o dbService ser criado e aplica os patches de forma transparente.

  function patchDbService() {
    if (!window.dbService) return;
    if (window.dbService.__securityPatched) return;

    const original = {
      saveData:    window.dbService.saveData.bind(window.dbService),
      saveAllData: window.dbService.saveAllData.bind(window.dbService),
      addItem:     window.dbService.addItem.bind(window.dbService),
    };

    window.dbService.saveData = function (field, data) {
      if (!checkRateLimit('saveData')) return Promise.resolve(false);
      return original.saveData(field, data);
    };

    window.dbService.saveAllData = function (dataOverride) {
      if (!checkRateLimit('saveAllData')) return Promise.resolve(false);
      return original.saveAllData(dataOverride);
    };

    window.dbService.addItem = function (collection, item) {
      if (!checkRateLimit('addItem')) return Promise.resolve(false);
      return original.addItem(collection, item);
    };

    window.dbService.__securityPatched = true;
    console.info('[SLC Security] dbService protegido com rate limiting.');
  }

  // ─── 4. Patch na IA para rate limiting de perguntas ─────────────────────

  function patchAIAssistant() {
    if (!window.aiAssistant) return;
    if (window.aiAssistant.__securityPatched) return;

    const originalAsk = window.aiAssistant.ask.bind(window.aiAssistant);
    const originalAskRich = window.aiAssistant.askRich
      ? window.aiAssistant.askRich.bind(window.aiAssistant)
      : null;

    window.aiAssistant.ask = function (pergunta) {
      if (!checkRateLimit('aiAsk')) {
        return Promise.resolve('Muitas perguntas em pouco tempo. Aguarde alguns segundos e tente novamente.');
      }
      return originalAsk(pergunta);
    };

    if (originalAskRich) {
      window.aiAssistant.askRich = function (pergunta) {
        if (!checkRateLimit('aiAsk')) {
          return Promise.resolve({
            text: 'Muitas perguntas em pouco tempo. Aguarde alguns segundos.',
            actions: [],
            memory: []
          });
        }
        return originalAskRich(pergunta);
      };
    }

    window.aiAssistant.__securityPatched = true;
    console.info('[SLC Security] aiAssistant protegido com rate limiting.');
  }

  // ─── 5. Proteção contra clickjacking via JS (complementa o X-Frame-Options) ──

  if (window.top !== window.self) {
    console.warn('[SLC Security] Tentativa de embed em iframe detectada. Redirecionando.');
    window.top.location = window.self.location;
  }

  // ─── 6. Proteção de console em produção ─────────────────────────────────
  //
  // Evita que usuários vejam dados sensíveis de outros usuários em erros de console
  // (ainda imprime warnings de segurança do próprio SLC).

  const isProduction = !['localhost', '127.0.0.1'].includes(location.hostname);

  if (isProduction) {
    const _warn  = console.warn.bind(console);
    const _error = console.error.bind(console);

    console.log   = () => {};
    console.info  = () => {};
    console.debug = () => {};

    // Mantém warn e error mas remove dados de usuário de mensagens longas
    console.warn = (...args) => {
      const msg = args.map(a => (typeof a === 'object' ? '[object]' : a)).join(' ');
      _warn('[SLC]', msg.slice(0, 200));
    };

    console.error = (...args) => {
      const msg = args.map(a => (typeof a === 'object' ? '[object]' : a)).join(' ');
      _error('[SLC]', msg.slice(0, 200));
    };
  }

  // ─── 7. Aplicar patches após carregamento dos módulos ───────────────────

  // Tenta aplicar imediatamente; se os módulos ainda não carregaram,
  // aguarda o evento DOMContentLoaded e tenta novamente com polling.
  function tryPatch() {
    patchDbService();
    patchAIAssistant();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      tryPatch();
      // Polling por até 5s para garantir que módulos carregados assincronamente sejam patcheados
      let attempts = 0;
      const interval = setInterval(() => {
        tryPatch();
        attempts++;
        if (attempts >= 10) clearInterval(interval);
      }, 500);
    });
  } else {
    tryPatch();
    let attempts = 0;
    const interval = setInterval(() => {
      tryPatch();
      attempts++;
      if (attempts >= 10) clearInterval(interval);
    }, 500);
  }

  console.info('[SLC Security] Módulo de segurança carregado.');
})();
