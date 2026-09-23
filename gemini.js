// Compatibility shim. The active import endpoint lives in api/gemini.js.
// Kept only for legacy tooling; Vercel serves /api/gemini.js.
module.exports = require('./api/gemini.js');
