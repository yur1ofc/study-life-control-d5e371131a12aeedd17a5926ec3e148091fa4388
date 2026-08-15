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
//   3) O usuário cola a URL `/api/calendar/{token}` (ou a versão `webcal://`)
//      UMA ÚNICA VEZ no Google Calendar/Apple Calendário/Outlook, como
//      "assinar calendário por URL". O app de calendário dele busca esse
//      link sozinho de tempos em tempos (normalmente a cada 12–24h) e
//      sempre mostra o que estiver salvo no site, sem exportar/importar
//      nada de novo manualmente.
//
// O endpoint que transforma esse documento em .ics de verdade fica em
// api/calendar/[token].js (roda no servidor, Vercel Function).

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
    const base = `${window.location.origin}/api/calendar/${token}`;
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

    return { exams, tasks, sessions, classSchedule };
  }

  async function publishNow() {
    if (!window.db || !window.auth?.currentUser) return false;
    const token = getSettings()?.calendarToken;
    if (!token) return false;

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

  window.calendarFeed = {
    getOrCreateToken,
    regenerateToken,
    feedUrls,
    getToken: () => getSettings()?.calendarToken || null,
    publishNow
  };
})();
