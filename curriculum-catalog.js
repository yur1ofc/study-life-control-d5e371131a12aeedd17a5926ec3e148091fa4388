// calendar-feed.js
// Feed de calendário assinável (.ics / webcal) — sincronização automática.
//
// Como funciona, em resumo:
//   1) Na primeira vez que o usuário abre "Configurações → Calendário", a
//      gente gera um token aleatório e comprido e grava em
//      settings.calendarToken (dentro do próprio documento do usuário).
//   2) A partir daí, TODA vez que algo é salvo no app (evento
//      'slc-data-saved', disparado pelo database.js), a gente republica uma
//      cópia enxuta (só datas/títulos, sem nome nem e-mail) das
//      provas/tarefas/sessões/aulas no documento público
//      calendar_feeds/{token} — sem o usuário precisar fazer nada.
//   3) O usuário cola a URL `/api/calendar/feed?token={token}` (ou a versão
//      `webcal://`) UMA ÚNICA VEZ no Google Calendar/Apple Calendário/Outlook,
//      como "assinar calendário por URL". O app de calendário dele busca esse
//      link sozinho de tempos em tempos (normalmente a cada 12–24h) e
//      sempre mostra o que estiver salvo no site, sem exportar/importar
//      nada de novo manualmente.
//
// O endpoint que transforma esse documento em .ics de verdade fica em
// api/calendar/feed.js (roda no servidor, Vercel Function). Era uma rota
// dinâmica (api/calendar/[token].js) antes, mas foi trocada pra rota fixa
// com querystring por causa de um bug de roteamento da Vercel com rotas
// dinâmicas (ver comentário no topo de api/calendar/feed.js).

(function () {
  'use strict';

  const FEED_COLLECTION = 'calendar_feeds';
  const SYNC_DEBOUNCE_MS = 3000;
  let syncTimer = null;

  function randomToken() {
    // 32 bytes aleatórios -> 64 chars hex. Bem mais do que os >=24 exigidos
    // pela regra do Firestore (calendar_feeds) — inviável de adivinhar.
    const bytes = new Uint8Array(32);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }

  function getSettings() {
    return window.app?.data?.settings || null;
  }

  function hasToken() {
    return !!getSettings()?.calendarToken;
  }

  // Fuso IANA do navegador de quem está usando (ex: "America/Sao_Paulo",
  // "Europe/Lisbon", "America/New_York"...). É isso que faz o horário das
  // aulas ir certo pra qualquer usuário, não só pra quem mora no Brasil —
  // cada um leva o fuso que o próprio navegador dele já sabe.
  function browserTimezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch (_) {
      return null;
    }
  }

  // Garante que settings.timezone exista, detectando do navegador na
  // primeira vez (silencioso — não interrompe o usuário com pergunta
  // nenhuma). Se o usuário já escolheu manualmente um fuso diferente nas
  // configurações, aquele valor tem prioridade e nunca é sobrescrito aqui.
  async function ensureTimezone() {
    const settings = getSettings();
    if (!settings || settings.timezone) return settings?.timezone || null;
    const detected = browserTimezone();
    if (!detected) return null;
    settings.timezone = detected;
    await window.dbService?.saveData('settings', settings);
    return detected;
  }

  // Cria o token se ainda não existir e devolve ele. Só é chamado quando o
  // usuário efetivamente abre a aba de calendário — não criamos um feed
  // "de graça" pra quem nunca pediu.
  async function getOrCreateToken() {
    const settings = getSettings();
    if (!settings) return null;
    if (settings.calendarToken) return settings.calendarToken;

    const token = randomToken();
    settings.calendarToken = token;
    const ok = await window.dbService.saveData('settings', settings);
    if (!ok) return null;

    await publishNow();
    return token;
  }

  // Some com o link antigo (apaga o documento público) e cria outro do zero.
  // Útil se o usuário achar que compartilhou a URL sem querer.
  async function regenerateToken() {
    const settings = getSettings();
    const oldToken = settings?.calendarToken;

    const newToken = randomToken();
    settings.calendarToken = newToken;
    const ok = await window.dbService.saveData('settings', settings);
    if (!ok) return null;

    await publishNow();

    if (oldToken && window.db) {
      window.db.collection(FEED_COLLECTION).doc(oldToken).delete().catch(() => {});
    }
    return newToken;
  }

  function feedUrls(token) {
    if (!token) return null;
    const base = `${window.location.origin}/api/calendar/feed?token=${token}`;
    return {
      https: base,
      // webcal:// faz o SO abrir direto no app de calendário padrão ao
      // clicar no link (funciona no Apple Calendário e na maioria dos
      // Android); em navegadores desktop pode não fazer nada sozinho —
      // por isso sempre oferecemos as duas versões na UI.
      webcal: base.replace(/^https?:\/\//, 'webcal://')
    };
  }

  // Monta a "foto" pública e enxuta que vai para calendar_feeds/{token}.
  // Só o necessário pra montar o .ics — nada de nome, e-mail ou universidade.
  function buildSnapshot() {
    const data = window.app?.data || {};

    const exams = (data.exams || []).slice(0, 500).map(e => ({
      id: e.id, titulo: e.titulo || 'Prova', materia: e.materia || '',
      tipo: e.tipo || '', data: e.data || '', peso: e.peso || null,
      importancia: e.importancia || '', concluida: !!e.concluida
    }));

    const tasks = (data.tasks || []).filter(t => t.dataLimite).slice(0, 2000).map(t => ({
      id: t.id, titulo: t.titulo || 'Tarefa', materia: t.materia || '',
      prioridade: t.prioridade || '', dataLimite: t.dataLimite,
      estimativa: t.estimativa || null, concluida: !!t.concluida
    }));

    const sessions = (data.sessions || []).filter(s => s.data).slice(0, 500).map(s => ({
      id: s.id, materia: s.materia || '', tipo: s.tipo || '',
      duracao: s.duracao || 60, topico: s.topico || '', data: s.data,
      concluida: !!s.concluida
    }));

    const classSchedule = (data.classSchedule || []).slice(0, 200).map(a => ({
      id: a.id, materia: a.materia || '', dia: a.dia, inicio: a.inicio, fim: a.fim
    }));

    // Revisões espaçadas geradas pelo review-system.js (1/3/7/15/30 dias
    // após a aula, + revisão pré-prova). Antes não entravam no feed — o
    // usuário nunca via essas datas fora do app.
    const reviews = (data.reviews || []).filter(r => r.data).slice(0, 1000).map(r => ({
      id: r.id, materia: r.materia || '', topico: r.topico || '',
      data: r.data, tipo: r.tipo || '', concluida: !!r.concluida
    }));

    // Fuso do usuário (auto-detectado ou escolhido manualmente nas
    // configurações). Fallback só existe pra nunca gerar um .ics sem TZID;
    // na prática ensureTimezone() já preenche isso antes daqui.
    const timezone = getSettings()?.timezone || browserTimezone() || 'America/Sao_Paulo';

    return { exams, tasks, sessions, classSchedule, reviews, timezone };
  }

  async function publishNow() {
    if (!window.db || !window.auth?.currentUser) return false;
    const token = getSettings()?.calendarToken;
    if (!token) return false;

    await ensureTimezone();
    const snapshot = buildSnapshot();
    try {
      await window.db.collection(FEED_COLLECTION).doc(token).set({
        uid: window.auth.currentUser.uid,
        updatedAt: new Date().toISOString(),
        ...snapshot
      });
      return true;
    } catch (error) {
      console.warn('[calendar-feed] Não foi possível sincronizar o feed:', error);
      return false;
    }
  }

  // Só reagenda a sincronização se o usuário já tiver um feed ativo — assim
  // quem nunca abriu "Configurações → Calendário" não gera escrita nenhuma
  // no Firestore por causa disso.
  function scheduleSyncIfActive() {
    if (!hasToken()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(publishNow, SYNC_DEBOUNCE_MS);
  }

  document.addEventListener('slc-data-saved', scheduleSyncIfActive);
  document.addEventListener('app-ready', scheduleSyncIfActive);
  // Detecta e salva o fuso do navegador cedo (mesmo antes de o usuário
  // gerar um link de calendário), pra tela de configurações já mostrar o
  // valor certo assim que ele abrir a aba "Calendário" pela 1ª vez.
  document.addEventListener('app-ready', () => { ensureTimezone(); });

  // Chamado pela UI de configurações quando o usuário escolhe manualmente
  // um fuso diferente do detectado (ex: detecção errada, morador de
  // fronteira, dispositivo compartilhado). Já republica o feed na hora.
  async function setTimezone(tz) {
    const settings = getSettings();
    if (!settings || !tz) return false;
    settings.timezone = tz;
    const ok = await window.dbService?.saveData('settings', settings);
    if (ok) await publishNow();
    return !!ok;
  }

  window.calendarFeed = {
    getOrCreateToken,
    regenerateToken,
    feedUrls,
    getToken: () => getSettings()?.calendarToken || null,
    getTimezone: () => getSettings()?.timezone || browserTimezone() || 'America/Sao_Paulo',
    detectedTimezone: browserTimezone,
    setTimezone,
    publishNow
  };
})();
