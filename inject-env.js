// inject-env.js — Roda durante o build do Vercel.
// Lê as variáveis de ambiente e gera o env-config.js com window.__ENV.
// Versão com diagnóstico: nunca falha em silêncio.

const fs = require('fs');
const path = require('path');

console.log('[inject-env] ===== INÍCIO =====');
console.log('[inject-env] __dirname:', __dirname);
console.log('[inject-env] process.cwd():', process.cwd());
console.log('[inject-env] Node version:', process.version);

try {
  const keys = [
    'FIREBASE_API_KEY',
    'FIREBASE_AUTH_DOMAIN',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_STORAGE_BUCKET',
    'FIREBASE_MESSAGING_SENDER_ID',
    'FIREBASE_APP_ID'
  ];

  const optionalKeys = ['FIREBASE_MEASUREMENT_ID'];

  const missing = keys.filter(k => !process.env[k]);

  if (missing.length) {
    console.error('[inject-env] ERRO: variáveis faltando:', missing.join(', '));
    console.error('[inject-env] Configure em: Vercel → Settings → Environment Variables');
    process.exitCode = 1;
  } else {
    const envObj = {};
    keys.forEach(k => { envObj[k] = process.env[k]; });

    if (process.env.VAPID_PUBLIC_KEY) {
      envObj.VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
    }

    optionalKeys.forEach(k => {
      if (process.env[k]) {
        envObj[k] = process.env[k];
      } else {
        console.warn(`[inject-env] ${k} não configurada — recurso opcional relacionado ficará desativado.`);
      }
    });

    const content = `// Gerado automaticamente no build — NÃO EDITE e NÃO COMMITE este arquivo\nwindow.__ENV = ${JSON.stringify(envObj, null, 2)};\n`;

    // Escreve tanto em __dirname quanto em process.cwd(), caso sejam diferentes
    const targets = new Set([
      path.join(__dirname, 'env-config.js'),
      path.join(process.cwd(), 'env-config.js')
    ]);

    targets.forEach(targetPath => {
      fs.writeFileSync(targetPath, content, 'utf8');
      const exists = fs.existsSync(targetPath);
      const size = exists ? fs.statSync(targetPath).size : 0;
      console.log(`[inject-env] Escrito em: ${targetPath} | existe depois: ${exists} | tamanho: ${size} bytes`);
    });

    console.log('[inject-env] env-config.js gerado com sucesso!');
    keys.forEach(k => console.log(`  ${k}: ${process.env[k].slice(0, 8)}...`));

    if (!process.env.VAPID_PUBLIC_KEY) {
      console.warn('[inject-env] VAPID_PUBLIC_KEY não configurada — alarmes por push ficarão desativados (calendário .ics continua funcionando normalmente).');
    }
  }
} catch (err) {
  console.error('[inject-env] ERRO INESPERADO:', err.message);
  console.error(err.stack);
  process.exitCode = 1;
}

// Lista o diretório de saída pra conferência visual no log
try {
  const files = fs.readdirSync(__dirname).filter(f => !f.startsWith('.') && f !== 'node_modules');
  console.log('[inject-env] Arquivos em __dirname após execução:', files.join(', '));
} catch (e) {
  console.error('[inject-env] Não consegui listar __dirname:', e.message);
}

console.log('[inject-env] ===== FIM (exitCode:', process.exitCode || 0, ') =====');
