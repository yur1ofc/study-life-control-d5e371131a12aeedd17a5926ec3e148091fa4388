// Consolidated notification API. Keeps both public routes behind one function.
const handlers = {
  health: require('./_lib/handlers/notification-health'),
  test: require('./_lib/handlers/push-test')
};

module.exports = async function handler(req, res) {
  const mode = String(req.query?.mode || '').toLowerCase();
  const target = handlers[mode];
  if (!target) return res.status(404).json({ error: 'Notification route not found.' });
  return target(req, res);
};
