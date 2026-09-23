// Compatibility shim. The active AI gateway lives in api/_lib/ai-core.js.
// Kept so legacy local imports do not break while the project is migrated.
module.exports = require('./api/_lib/ai-core.js');
