// Consolidated account/focus API. Keeps both existing public routes intact.
const handlers = {
  delete: require('./_lib/handlers/delete-account'),
  focus: require('./_lib/handlers/focus-schedule')
};

module.exports = async function handler(req, res) {
  const mode = String(req.query?.mode || '').toLowerCase();
  const target = Object.prototype.hasOwnProperty.call(handlers, mode) ? handlers[mode] : null;
  if (typeof target !== 'function') return res.status(404).json({ error: 'Account route not found.' });
  return target(req, res);
};
