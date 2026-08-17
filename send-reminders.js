// api/send-reminders.js — Vercel Function, feita pra rodar de tempos em
// tempos (cron) e não sob demanda de um usuário.
//
// O que faz, a cada execução:
//   1) Busca todo usuário com settings.studyReminders.enabled == true.
//   2) Pra cada um, olha provas/tarefas/sessões e calcula se alguma "vence"
//      dentro da janela de aviso configurada (ex: 24h antes da prova).
//   3) Manda um push de verdade (via web-push + VAPID) pros dispositivos
//      salvos em pushSubscriptions.
//   4) Marca o que já foi avisado em sentReminders, pra não repetir no
//      próximo run.
//
// Isso PRECISA de acesso de administrador ao Firestore (ler/atualizar o
// documento de QUALQUER usuário, não só o de quem está logado) — por isso,
// diferente de api/gemini.js e api/calendar/[token].js, aqui a gente usa o
// firebase-admin com uma Service Account. Essa chave é secreta e só existe
// como variável de ambiente no Vercel — nunca commitada (veja .gitignore).
//
// ── Variáveis de ambiente necessárias no Vercel ─────────────────────────────
//   FIREBASE_SERVICE_ACCOUNT_KEY → JSON da service account, em base64.
//     Como conseguir: Firebase Console → ⚙️ Configurações do projeto →
//     Contas de serviço → "Gerar nova chave privada" (baixa um .json).
//     Depois rode isso pra converter:
//       base64 -w0 sua-chave.json          (Linux)
//       base64 -i sua-chave.json           (macOS)
//     e cole o resultado como valor da variável.
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
//     → gerados com scripts/generate-vapid-keys.js
//   CRON_SECRET → qualquer string longa aleatória, escolhida por você.
//     Precisa bater com o header "Authorization: Bearer <CRON_SECRET>" de
//     quem chama essa rota (o cron do Vercel manda isso sozinho quando
//     CRON_SECRET está configurada; um cron EXTERNO, tipo cron-job.org,
//     precisa ser configurado manualmente pra mandar esse header).
//
// ── Por que um cron externo, além do cron do Vercel? ────────────────────────
// No plano Hobby da Vercel, cron job só roda 1x por dia — o suficiente pra
// um lembrete "prova amanhã", mas fraco demais pra "sua sessão de estudo
// começa em 15 minutos". Recomendado: cadastre esta URL de graça em
// https://cron-job.org (ou similar) pra rodar a cada 10–15 minutos, mandando
// o header Authorization acima. Mantenha também a entrada em vercel.json
// como um fallback diário caso o cron externo falhe.

const DEDUPE_LIMIT = 500;

let firebaseAdminApp = null;
function getDb() {
  const admin = require('firebase-admin');
  if (!firebaseAdminApp) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY não configurada no servidor.');
    const serviceAccount = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    firebaseAdminApp = admin.apps.length ? admin.app() : admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
  return admin.firestore();
}

function setupWebPush() {
  const webpush = require('web-push');
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    throw new Error('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT não configuradas no servidor.');
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  return webpush;
}

// Datas "só dia" (exams.data / tasks.dataLimite) são tratadas como meia-noite
// UTC — uma simplificação (o app não guarda fuso horário do usuário), então
// o aviso pode chegar algumas horas mais cedo/tarde dependendo do fuso de
// quem está usando. Documentado em CALENDARIO-E-LEMBRETES.md.
function dateOnlyToMs(yyyyMmDd) {
  if (!yyyyMmDd) return null;
  const t = Date.parse(`${yyyyMmDd}T00:00:00Z`);
  return Number.isNaN(t) ? null : t;
}

function localDateTimeToMs(isoLocal) {
  if (!isoLocal) return null;
  const t = Date.parse(isoLocal.length === 16 ? `${isoLocal}:00Z` : isoLocal);
  return Number.isNaN(t) ? null : t;
}

// Devolve o dia da semana (0=domingo...6=sábado, mesma convenção usada em
// classSchedule/DIA_MAP no front) e o minuto do dia "agora", já convertidos
// pro fuso horário do usuário (data.settings.timezone). Necessário porque
// aulas são recorrentes semanais, sem uma data absoluta salva — diferente
// de prova/tarefa/sessão/revisão, que têm um campo de data real.
const WEEKDAY_FROM_SHORT = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
function nowPartsInTimezone(ms, tz) {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz || 'America/Sao_Paulo',
      weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    });
    const parts = {};
    dtf.formatToParts(new Date(ms)).forEach(p => { parts[p.type] = p.value; });
    let hour = Number(parts.hour);
    if (hour === 24) hour = 0; // Intl às vezes devolve "24" em vez de "00" com hour12:false
    return {
      weekday: WEEKDAY_FROM_SHORT[parts.weekday] ?? new Date(ms).getUTCDay(),
      minutesOfDay: hour * 60 + Number(parts.minute),
      dateStr: `${parts.year}-${parts.month}-${parts.day}`
    };
  } catch (_) {
    const d = new Date(ms);
    return { weekday: d.getUTCDay(), minutesOfDay: d.getUTCHours() * 60 + d.getUTCMinutes(), dateStr: d.toISOString().slice(0, 10) };
  }
}

// Descobre quais itens de um usuário "vencem" dentro da janela de aviso e
// ainda não foram notificados.
function findDueReminders(data, now) {
  const prefs = data?.settings?.studyReminders || {};
  const already = new Set(data.sentReminders || []);
  const due = [];

  const examsHoursBefore = Number(prefs.examsHoursBefore ?? 24);
  (data.exams || []).forEach(e => {
    if (e.concluida) return;
    const key = `exam:${e.id}`;
    if (already.has(key)) return;
    const examMs = dateOnlyToMs(e.data);
    if (examMs == null) return;
    const triggerMs = examMs - examsHoursBefore * 3600000;
    if (now >= triggerMs && now < examMs) {
      due.push({ key, title: '📝 Prova chegando', body: `${e.titulo}${e.materia ? ` — ${e.materia}` : ''}` });
    }
  });

  const tasksHoursBefore = Number(prefs.tasksHoursBefore ?? 24);
  (data.tasks || []).forEach(t => {
    if (t.concluida) return;
    const key = `task:${t.id}`;
    if (already.has(key)) return;
    const taskMs = dateOnlyToMs(t.dataLimite);
    if (taskMs == null) return;
    const triggerMs = taskMs - tasksHoursBefore * 3600000;
    if (now >= triggerMs && now < taskMs) {
      due.push({ key, title: '✅ Tarefa vencendo', body: `${t.titulo}${t.materia ? ` — ${t.materia}` : ''}` });
    }
  });

  const sessionsMinutesBefore = Number(prefs.sessionsMinutesBefore ?? 15);
  (data.sessions || []).forEach(s => {
    if (s.concluida) return;
    const key = `session:${s.id}`;
    if (already.has(key)) return;
    const sessionMs = localDateTimeToMs(s.data);
    if (sessionMs == null) return;
    const triggerMs = sessionMs - sessionsMinutesBefore * 60000;
    if (now >= triggerMs && now < sessionMs) {
      due.push({ key, title: '📚 Sessão de estudo já já', body: `${s.materia}${s.topico ? ` — ${s.topico}` : ''}` });
    }
  });

  // Revisões espaçadas (review-system.js) — mesma lógica de prova/tarefa,
  // já que r.data é uma data fixa (YYYY-MM-DD), não recorrente.
  const reviewsHoursBefore = Number(prefs.reviewsHoursBefore ?? 24);
  (data.reviews || []).forEach(r => {
    if (r.concluida) return;
    const key = `review:${r.id}`;
    if (already.has(key)) return;
    const reviewMs = dateOnlyToMs(r.data);
    if (reviewMs == null) return;
    const triggerMs = reviewMs - reviewsHoursBefore * 3600000;
    if (now >= triggerMs && now < reviewMs) {
      due.push({ key, title: '🔁 Revisão chegando', body: `${r.materia}${r.topico ? ` — ${r.topico}` : ''}` });
    }
  });

  // Aulas da grade horária — recorrentes semanais, sem data absoluta salva.
  // Só dispara no próprio dia da aula, dentro da janela de aviso, usando o
  // fuso horário do usuário (o mesmo já usado no .ics, settings.timezone).
  const classMinutesBefore = Number(prefs.classMinutesBefore ?? 15);
  const tz = data?.settings?.timezone || 'America/Sao_Paulo';
  const nowParts = nowPartsInTimezone(now, tz);
  (data.classSchedule || []).forEach(a => {
    if (a.dia === null || a.dia === undefined || !a.inicio) return;
    if (Number(a.dia) !== nowParts.weekday) return;
    const [hh, mm] = String(a.inicio).split(':').map(Number);
    const classMinutes = (hh || 0) * 60 + (mm || 0);
    const triggerMinutes = classMinutes - classMinutesBefore;
    if (nowParts.minutesOfDay < triggerMinutes || nowParts.minutesOfDay >= classMinutes) return;
    // Chave inclui a data do dia (no fuso do usuário) pra não deduplicar
    // pra sempre — na semana que vem é uma ocorrência nova, precisa avisar
    // de novo. sentReminders é uma lista limitada (DEDUPE_LIMIT), então
    // chaves de semanas antigas somem sozinhas com o tempo.
    const key = `class:${a.id}:${nowParts.dateStr}`;
    if (already.has(key)) return;
    due.push({ key, title: '🎓 Aula já já', body: `${a.materia}${a.sala ? ` — ${a.sala}` : ''}` });
  });

  return due;
}

module.exports = async function handler(req, res) {
  const expected = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization || '';
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return res.status(401).json({ error: 'Não autorizado.' });
  }

  let db, webpush;
  try {
    db = getDb();
    webpush = setupWebPush();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  const now = Date.now();
  const summary = { usersChecked: 0, notificationsSent: 0, subscriptionsRemoved: 0, errors: [] };

  try {
    const snapshot = await db.collection('users')
      .where('settings.studyReminders.enabled', '==', true)
      .get();

    for (const doc of snapshot.docs) {
      summary.usersChecked++;
      const data = doc.data();
      const subscriptions = Array.isArray(data.pushSubscriptions) ? data.pushSubscriptions : [];
      if (!subscriptions.length) continue;

      const due = findDueReminders(data, now);
      if (!due.length) continue;

      const stillValidSubs = [];
      const sentKeys = [];

      for (const subscription of subscriptions) {
        let subOk = true;
        for (const item of due) {
          try {
            await webpush.sendNotification(subscription, JSON.stringify({
              title: item.title,
              body: item.body,
              url: './',
              tag: item.key
            }));
            summary.notificationsSent++;
          } catch (err) {
            if (err.statusCode === 404 || err.statusCode === 410) {
              subOk = false; // assinatura expirada/revogada — descarta
            } else {
              summary.errors.push(`push ${doc.id}: ${err.message}`);
            }
          }
        }
        if (subOk) stillValidSubs.push(subscription);
        else summary.subscriptionsRemoved++;
      }

      due.forEach(item => sentKeys.push(item.key));
      const mergedSent = [...(data.sentReminders || []), ...sentKeys].slice(-DEDUPE_LIMIT);

      await doc.ref.update({
        sentReminders: mergedSent,
        pushSubscriptions: stillValidSubs
      });
    }

    return res.status(200).json(summary);
  } catch (err) {
    return res.status(500).json({ error: err.message, ...summary });
  }
};
