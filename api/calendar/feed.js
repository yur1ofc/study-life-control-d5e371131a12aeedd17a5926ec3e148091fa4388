// api/calendar/feed.js — Vercel Function (feed .ics assinável)
//
// IMPORTANTE: essa rota era originalmente api/calendar/[token].js (rota
// dinâmica), mas a Vercel está com um bug de plataforma nesse período
// (meados de 2026) onde rotas de função com segmento dinâmico ([token])
// compilam certinho e aparecem em "Output"/"Invoke Function", mas devolvem
// 404 da própria Vercel quando acessadas por HTTP público. Rotas "retas"
// (sem colchetes), como esta e api/send-reminders.js, não têm esse
// problema. Por isso migramos pra uma rota fixa que lê o token via
// querystring (?token=...) em vez de via segmento de URL.
//
// Google Calendar / Apple Calendário / Outlook batem nessa URL sozinhos de
// tempos em tempos (o app do usuário nem precisa estar aberto) e recebem de
// volta um arquivo .ics com provas, tarefas, sessões de estudo, aulas e
// revisões espaçadas —
// sempre atualizado, porque calendar-feed.js (front) mantém o documento
// calendar_feeds/{token} em dia a cada save.
//
// Não precisa de service account/Admin SDK: o documento é público de
// propósito (veja o comentário em firestore.rules), então basta uma
// requisição REST simples e sem autenticação.
//
// Variável de ambiente necessária no Vercel:
//   FIREBASE_PROJECT_ID → a mesma já usada em api/gemini.js

const TOKEN_RE = /^[a-f0-9]{24,64}$/i;

// ── Decodificador mínimo do formato "Value" do Firestore REST ──────────────
function fsValue(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return parseInt(v.integerValue, 10);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fsValue);
  if ('mapValue' in v) return fsFields(v.mapValue.fields || {});
  return null;
}
function fsFields(fields) {
  const out = {};
  Object.keys(fields || {}).forEach(k => { out[k] = fsValue(fields[k]); });
  return out;
}

// ── Helpers de formatação ICS (RFC 5545) ────────────────────────────────────
function icsEscape(text) {
  return String(text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// Quebra linhas maiores que 75 octetos, como o padrão exige.
function foldLine(line) {
  if (line.length <= 75) return line;
  let out = line.slice(0, 75);
  let rest = line.slice(75);
  while (rest.length > 0) {
    out += '\r\n ' + rest.slice(0, 74);
    rest = rest.slice(74);
  }
  return out;
}

function dateOnly(yyyyMmDd) {
  return (yyyyMmDd || '').replace(/-/g, '');
}

function addDaysToDateOnly(yyyyMmDd, days) {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}${String(dt.getUTCMonth() + 1).padStart(2, '0')}${String(dt.getUTCDate()).padStart(2, '0')}`;
}

// Fuso horário usado nos eventos com hora (aulas e sessões de estudo).
// Vem do feed do próprio usuário (settings.timezone, detectado no
// navegador dele em calendar-feed.js — front). Isso é o que faz o
// horário sair certo pra qualquer usuário, não só pra quem mora no
// Brasil.
//
// DECISÃO DE DESIGN — por que TZID sem VTIMEZONE embutido:
// A abordagem anterior tentou embutir um VTIMEZONE com as regras de
// horário de verão do fuso. O problema é que essas regras mudam (o
// Brasil, por exemplo, aboliu o horário de verão em 2019) e qualquer
// tabela que a gente embuta no código fica desatualizada mais cedo ou
// mais tarde — recriando o mesmo tipo de bug, só que sazonal. Referenciar
// o TZID pelo nome IANA puro (ex: "America/Sao_Paulo", "Europe/Lisbon",
// "America/New_York") e deixar o Google Calendar / Apple Calendário /
// Outlook resolverem contra o banco de fusos deles (que eles mantêm
// atualizado) é mais simples e correto pra sempre — inclusive pra
// recorrência semanal das aulas atravessando trocas de horário de verão
// em países que ainda têm.
const DEFAULT_TZID = 'America/Sao_Paulo';

// Confirma que o navegador/runtime reconhece o nome do fuso (formato
// IANA válido) antes de colocar no .ics — string inválida ali quebraria
// o arquivo inteiro para o app de calendário do usuário.
function safeTzid(tz) {
  const candidate = String(tz || '').trim();
  if (!candidate) return DEFAULT_TZID;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate });
    return candidate;
  } catch (_) {
    return DEFAULT_TZID;
  }
}

// datetime-local ("2026-08-20T14:00") -> "20260820T140000" (hora de
// parede, sem conversão — o TZID declarado no DTSTART/DTEND é quem diz
// ao calendário que isso é horário de Brasília).
function wallClockDateTime(isoLocal, extraMinutes = 0) {
  const m = String(isoLocal).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  dt.setMinutes(dt.getMinutes() + extraMinutes);
  const p = n => String(n).padStart(2, '0');
  return `${dt.getFullYear()}${p(dt.getMonth() + 1)}${p(dt.getDate())}T${p(dt.getHours())}${p(dt.getMinutes())}00`;
}

// DTSTAMP tem que ser sempre UTC de verdade (com Z), diferente do
// DTSTART/DTEND dos eventos. feed.updatedAt já vem em ISO UTC
// (new Date().toISOString(), gerado no calendar-feed.js), então só
// formatamos sem reinterpretar os números como se fossem hora local.
function utcStamp(isoUtc) {
  const dt = isoUtc ? new Date(isoUtc) : new Date();
  const valid = !isNaN(dt.getTime()) ? dt : new Date();
  const p = n => String(n).padStart(2, '0');
  return `${valid.getUTCFullYear()}${p(valid.getUTCMonth() + 1)}${p(valid.getUTCDate())}T${p(valid.getUTCHours())}${p(valid.getUTCMinutes())}${p(valid.getUTCSeconds())}Z`;
}

const WEEKDAY_ICS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
// 2023-01-01 foi um domingo — usado só como âncora estável pro DTSTART das
// aulas recorrentes (RRULE cuida do resto). Não representa a aula "de
// verdade" ter começado nessa data.
function anchoredWeeklyDateTime(diaSemana, hhmm) {
  const dia = Number(diaSemana) || 0;
  const [hh, mm] = String(hhmm || '00:00').split(':').map(Number);
  const anchor = new Date(Date.UTC(2023, 0, 1 + dia, 0, 0));
  const p = n => String(n).padStart(2, '0');
  return `${anchor.getUTCFullYear()}${p(anchor.getUTCMonth() + 1)}${p(anchor.getUTCDate())}T${p(hh || 0)}${p(mm || 0)}00`;
}

function buildIcs(feed) {
  const tzid = safeTzid(feed.timezone);
  const lines = [];
  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push('PRODID:-//SLCampus//Feed de Calendario//PT');
  lines.push('CALSCALE:GREGORIAN');
  lines.push('METHOD:PUBLISH');
  lines.push('X-WR-CALNAME:SLCampus');
  lines.push('X-WR-CALDESC:Provas, tarefas, sessões de estudo, aulas e revisões');
  // Dica de intervalo de atualização pros clientes que respeitam (a maioria
  // busca de qualquer forma a cada 12–24h, mas não custa declarar).
  lines.push('REFRESH-INTERVAL;VALUE=DURATION:PT12H');
  lines.push('X-PUBLISHED-TTL:PT12H');
  lines.push(`X-WR-TIMEZONE:${tzid}`);

  (feed.exams || []).forEach(e => {
    if (!e.data) return;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:exam-${e.id}@study-life-control`);
    lines.push(`DTSTAMP:${utcStamp(feed.updatedAt)}`);
    lines.push(`DTSTART;VALUE=DATE:${dateOnly(e.data)}`);
    lines.push(`DTEND;VALUE=DATE:${addDaysToDateOnly(e.data, 1)}`);
    lines.push(foldLine(`SUMMARY:${icsEscape(`📝 Prova: ${e.titulo}${e.materia ? ` (${e.materia})` : ''}`)}`));
    const desc = [e.tipo && `Tipo: ${e.tipo}`, e.peso && `Peso: ${e.peso}`, e.importancia && `Importância: ${e.importancia}`].filter(Boolean).join(' · ');
    if (desc) lines.push(foldLine(`DESCRIPTION:${icsEscape(desc)}`));
    lines.push('BEGIN:VALARM');
    lines.push('ACTION:DISPLAY');
    lines.push(foldLine(`DESCRIPTION:${icsEscape(`Prova amanhã: ${e.titulo}`)}`));
    lines.push('TRIGGER:-P1D');
    lines.push('END:VALARM');
    lines.push('END:VEVENT');
  });

  (feed.tasks || []).forEach(t => {
    if (!t.dataLimite) return;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:task-${t.id}@study-life-control`);
    lines.push(`DTSTAMP:${utcStamp(feed.updatedAt)}`);
    lines.push(`DTSTART;VALUE=DATE:${dateOnly(t.dataLimite)}`);
    lines.push(`DTEND;VALUE=DATE:${addDaysToDateOnly(t.dataLimite, 1)}`);
    lines.push(foldLine(`SUMMARY:${icsEscape(`✅ Tarefa: ${t.titulo}${t.materia ? ` (${t.materia})` : ''}`)}`));
    const desc = [t.prioridade && `Prioridade: ${t.prioridade}`, t.estimativa && `Estimativa: ${t.estimativa} min`].filter(Boolean).join(' · ');
    if (desc) lines.push(foldLine(`DESCRIPTION:${icsEscape(desc)}`));
    lines.push('BEGIN:VALARM');
    lines.push('ACTION:DISPLAY');
    lines.push(foldLine(`DESCRIPTION:${icsEscape(`Tarefa vence: ${t.titulo}`)}`));
    lines.push('TRIGGER:-P1D');
    lines.push('END:VALARM');
    lines.push('END:VEVENT');
  });

  (feed.sessions || []).forEach(s => {
    const start = wallClockDateTime(s.data);
    if (!start) return;
    const end = wallClockDateTime(s.data, s.duracao || 60);
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:session-${s.id}@study-life-control`);
    lines.push(`DTSTAMP:${utcStamp(feed.updatedAt)}`);
    lines.push(`DTSTART;TZID=${tzid}:${start}`);
    lines.push(`DTEND;TZID=${tzid}:${end}`);
    lines.push(foldLine(`SUMMARY:${icsEscape(`📚 Estudo: ${s.materia}${s.topico ? ` — ${s.topico}` : ''}`)}`));
    if (s.tipo) lines.push(foldLine(`DESCRIPTION:${icsEscape(`Tipo: ${s.tipo}`)}`));
    lines.push('BEGIN:VALARM');
    lines.push('ACTION:DISPLAY');
    lines.push(foldLine(`DESCRIPTION:${icsEscape(`Sessão de estudo: ${s.materia}`)}`));
    lines.push('TRIGGER:-PT15M');
    lines.push('END:VALARM');
    lines.push('END:VEVENT');
  });

  (feed.reviews || []).forEach(r => {
    if (!r.data) return;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:review-${r.id}@study-life-control`);
    lines.push(`DTSTAMP:${utcStamp(feed.updatedAt)}`);
    lines.push(`DTSTART;VALUE=DATE:${dateOnly(r.data)}`);
    lines.push(`DTEND;VALUE=DATE:${addDaysToDateOnly(r.data, 1)}`);
    lines.push(foldLine(`SUMMARY:${icsEscape(`🔁 Revisão: ${r.materia}${r.topico ? ` — ${r.topico}` : ''}`)}`));
    if (r.tipo) lines.push(foldLine(`DESCRIPTION:${icsEscape(`Tipo: ${r.tipo}`)}`));
    lines.push('BEGIN:VALARM');
    lines.push('ACTION:DISPLAY');
    lines.push(foldLine(`DESCRIPTION:${icsEscape(`Revisão: ${r.materia}`)}`));
    lines.push('TRIGGER:-P1D');
    lines.push('END:VALARM');
    lines.push('END:VEVENT');
  });

  (feed.classSchedule || []).forEach(a => {
    if (!a.inicio || !a.fim || a.dia === null || a.dia === undefined) return;
    const start = anchoredWeeklyDateTime(a.dia, a.inicio);
    const end = anchoredWeeklyDateTime(a.dia, a.fim);
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:class-${a.id}@study-life-control`);
    lines.push(`DTSTAMP:${utcStamp(feed.updatedAt)}`);
    lines.push(`DTSTART;TZID=${tzid}:${start}`);
    lines.push(`DTEND;TZID=${tzid}:${end}`);
    lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${WEEKDAY_ICS[Number(a.dia) % 7]}`);
    lines.push(foldLine(`SUMMARY:${icsEscape(`🎓 Aula: ${a.materia}`)}`));
    lines.push('BEGIN:VALARM');
    lines.push('ACTION:DISPLAY');
    lines.push(foldLine(`DESCRIPTION:${icsEscape(`Aula: ${a.materia}`)}`));
    lines.push('TRIGGER:-PT15M');
    lines.push('END:VALARM');
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

module.exports = async function handler(req, res) {
  const token = String(req.query?.token || '').trim();

  if (!TOKEN_RE.test(token)) {
    return res.status(400).send('Token de calendário inválido.');
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    return res.status(503).send('FIREBASE_PROJECT_ID não configurada no servidor.');
  }

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/calendar_feeds/${token}`;
    const resp = await fetch(url);

    if (resp.status === 404) {
      return res.status(404).send('Esse link de calendário não existe (ou foi revogado). Gere um novo em Configurações → Calendário.');
    }
    if (!resp.ok) {
      return res.status(502).send('Não foi possível buscar o calendário agora. Tente novamente mais tarde.');
    }

    const doc = await resp.json();
    const feed = fsFields(doc.fields || {});
    const ics = buildIcs(feed);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="study-life-control.ics"');
    // Cache curto: os apps de calendário já espaçam as buscas sozinhos, isso
    // aqui é só pra não gerar o arquivo do zero em toda requisição repetida.
    res.setHeader('Cache-Control', 'public, max-age=900');
    return res.status(200).send(ics);
  } catch (err) {
    console.error('[calendar-feed]', err);
    return res.status(500).send('Erro interno ao gerar o calendário. Tente novamente mais tarde.');
  }
};
