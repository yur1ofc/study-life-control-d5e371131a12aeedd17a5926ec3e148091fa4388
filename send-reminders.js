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

// Datas e horários salvos pelo app (exams.data, tasks.dataLimite,
// sessions.data) não guardam fuso horário — vêm de campos <input
// type="date"> / type="datetime-local">, que só têm os dígitos da hora
// LOCAL do navegador de quem preencheu. Assumimos horário de Brasília
// (UTC-3, fixo, já que o Brasil não tem mais horário de verão desde
// 2019). Se algum dia o app atender fora do Brasil, isso precisa virar
// um fuso por usuário salvo no cadastro.
const FUSO_BRASIL = '-03:00';

function dateOnlyToMs(yyyyMmDd) {
  if (!yyyyMmDd) return null;
  const t = Date.parse(`${yyyyMmDd}T00:00:00${FUSO_BRASIL}`);
  return Number.isNaN(t) ? null : t;
}

function localDateTimeToMs(isoLocal) {
  if (!isoLocal) return null;
  const t = Date.parse(isoLocal.length === 16 ? `${isoLocal}:00${FUSO_BRASIL}` : isoLocal);
  return Number.isNaN(t) ? null : t;
}

// Provas, tarefas e trabalhos (tratados como "exams") não usam mais um
// único "X horas antes" configurável — mandam vários avisos fixos,
// ficando mais frequentes perto da data. Cada checkpoint tem uma janela
// de 24h pra disparar (dá folga pro cron não perder o horário certo) e
// é marcado individualmente em sentReminders, então nunca repete.
const CHECKPOINTS_DIAS = [7, 5, 3, 1, 0];
const JANELA_CHECKPOINT_MS = 24 * 3600000;

function labelDias(dias) {
  if (dias === 0) return 'é hoje';
  if (dias === 1) return 'é amanhã';
  return `em ${dias} dias`;
}

function checkpointsDevidos(itemMs, prefixo, id, tipoLabel, corpo, now, already) {
  const due = [];
  for (const dias of CHECKPOINTS_DIAS) {
    const key = `${prefixo}:${id}:${dias}d`;
    if (already.has(key)) continue;
    const triggerMs = itemMs - dias * 86400000;
    if (now >= triggerMs && now < triggerMs + JANELA_CHECKPOINT_MS) {
      due.push({ key, title: `${tipoLabel} ${labelDias(dias)}`, body: corpo });
    }
  }
  return due;
}

// Descobre quais itens de um usuário "vencem" dentro da janela de aviso e
// ainda não foram notificados.
function findDueReminders(data, now) {
  const prefs = data?.settings?.studyReminders || {};
  const already = new Set(data.sentReminders || []);
  const due = [];

  (data.exams || []).forEach(e => {
    if (e.concluida) return;
    const examMs = dateOnlyToMs(e.data);
    if (examMs == null) return;
    const corpo = `${e.titulo}${e.materia ? ` — ${e.materia}` : ''}`;
    due.push(...checkpointsDevidos(examMs, 'exam', e.id, '📝 Prova/trabalho', corpo, now, already));
  });

  (data.tasks || []).forEach(t => {
    if (t.concluida) return;
    const taskMs = dateOnlyToMs(t.dataLimite);
    if (taskMs == null) return;
    const corpo = `${t.titulo}${t.materia ? ` — ${t.materia}` : ''}`;
    due.push(...checkpointsDevidos(taskMs, 'task', t.id, '✅ Tarefa', corpo, now, already));
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
