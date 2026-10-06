// Consolidated Telegram API. Keeps the original public routes while using one
// Vercel Serverless Function so the Hobby plan stays below the function limit.
const handlers = {
  file: require('./_lib/handlers/telegram-file'),
  link: require('./_lib/handlers/telegram-link'),
  webhook: require('./_lib/handlers/telegram-webhook')
};

module.exports = async function handler(req, res) {
  const mode = String(req.query?.mode || '').toLowerCase();
  const target = handlers[mode];
  if (!target) return res.status(404).json({ error: 'Telegram route not found.' });
  return target(req, res);
};
