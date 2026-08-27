// api/_lib/gemini-shared-quota.js
// Cota GLOBAL do Gemini, compartilhada por api/gemini.js (import de grade por
// PDF/imagem) e api/mentor-chat.js (chat do Mentor IA) — porque as duas usam
// a MESMA GEMINI_API_KEY e disputam a mesma cota do plano grátis do Google.
//
// A ideia central: a importação de grade é a ação mais importante pra
// usuário NOVO (é o primeiro contato com o app, no onboarding). O chat é
// "bônus" — já tem um fallback local por regras que funciona sem IA nenhuma.
// Então em vez de dois limites soltos e adivinhados, existe UM teto total do
// site (GEMINI_TOTAL_DAILY_LIMIT) e uma FATIA RESERVADA só pro import
// (GEMINI_IMPORT_RESERVE), que o chat matematicamente não consegue consumir
// — não importa quantas pessoas estejam conversando com o mentor ao mesmo
// tempo, sempre sobra espaço pra quem está cadastrando a grade.
//
// Variáveis de ambiente (Vercel → Settings → Environment Variables):
//   GEMINI_TOTAL_DAILY_LIMIT → teto de chamadas ao Gemini por dia, somando
//                              import + chat de TODOS os usuários do site
//                              (padrão: 1200 — conservador pro plano grátis)
//   GEMINI_IMPORT_RESERVE    → quantas dessas chamadas ficam reservadas só
//                              pra importação de grade, mesmo que o chat
//                              já tenha estourado o resto (padrão: 150)
//
// Para diminuir o quanto o CHAT pode consumir (deixando mais sobra pro
// import), diminua GEMINI_TOTAL_DAILY_LIMIT e/ou aumente GEMINI_IMPORT_RESERVE
// no Vercel — não precisa mexer em código.
//
// Contador: um único documento Firestore "gemini_usage_global/counter", com
// "date" e "count" do dia (UTC). Best-effort (não é uma trava perfeitamente
// atômica sob concorrência altíssima), mas suficiente pra evitar estourar a
// cota grátis por uma margem grande — mesmo padrão dos outros contadores do
// projeto (ai_usage, mentor_usage).

const TOTAL_DAILY_LIMIT = parseInt(process.env.GEMINI_TOTAL_DAILY_LIMIT || '1200', 10);
const IMPORT_RESERVE = Math.min(
  TOTAL_DAILY_LIMIT,
  parseInt(process.env.GEMINI_IMPORT_RESERVE || '150', 10)
);

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function docUrl(projectId) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/gemini_usage_global/counter`;
}

// Só LÊ o contador de hoje (sem incrementar). Usado pra decidir se ainda dá
// pra chamar o Gemini antes de gastar a chamada de verdade.
async function readSharedCount(idToken, projectId) {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` };
  const resp = await fetch(docUrl(projectId), { headers });
  const today = todayKey();

  if (resp.status === 200) {
    const doc = await resp.json();
    const fields = doc.fields || {};
    const storedDate = fields.date?.stringValue;
    return storedDate === today ? parseInt(fields.count?.integerValue || '0', 10) : 0;
  }
  if (resp.status === 404) return 0;
  // Firestore recusou (regra não publicada, etc.) — devolve null pra quem
  // chamou saber que não deu pra confirmar a cota (e decidir não bloquear).
  return null;
}

// Incrementa o contador de hoje em +1. Best-effort: nunca derruba a
// requisição principal por causa de falha aqui.
async function incrementSharedCount(idToken, projectId, currentCount) {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` };
  const today = todayKey();
  await fetch(`${docUrl(projectId)}?updateMask.fieldPaths=date&updateMask.fieldPaths=count`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ fields: { date: { stringValue: today }, count: { integerValue: String(currentCount + 1) } } })
  }).catch(() => {});
}

module.exports = { TOTAL_DAILY_LIMIT, IMPORT_RESERVE, todayKey, readSharedCount, incrementSharedCount };
