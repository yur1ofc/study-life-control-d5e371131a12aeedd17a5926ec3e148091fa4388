// scripts/generate-vapid-keys.js
//
// Gera um par de chaves VAPID (usadas pra assinar as notificações push dos
// alarmes de estudo) usando SÓ o módulo nativo "crypto" do Node — não
// precisa instalar nada pra rodar isso.
//
// Rode UMA VEZ, no seu computador (nunca em produção):
//   node scripts/generate-vapid-keys.js
//
// Depois copie as 3 linhas impressas pra Vercel → Settings → Environment
// Variables:
//   VAPID_PUBLIC_KEY   → vai pro front (pode ficar pública, é só isso mesmo)
//   VAPID_PRIVATE_KEY  → NUNCA exponha no front, fica só no servidor
//   VAPID_SUBJECT       → um "mailto:seuemail@..." (Google exige isso)
//
// Guarde a chave privada em lugar seguro — se perder, precisa gerar um
// par novo e todo mundo que já tinha ativado os alarmes vai precisar
// reativar (a assinatura antiga do navegador some).

const crypto = require('crypto');

function base64url(buffer) {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

const ecdh = crypto.createECDH('prime256v1');
ecdh.generateKeys();

let privateKey = ecdh.getPrivateKey();
if (privateKey.length < 32) {
  // getPrivateKey() às vezes devolve menos de 32 bytes quando o número
  // começa com zero — preenche à esquerda pra manter o tamanho fixo.
  privateKey = Buffer.concat([Buffer.alloc(32 - privateKey.length), privateKey]);
}
const publicKey = ecdh.getPublicKey(); // 65 bytes, ponto não-comprimido

console.log('\n✅ Par de chaves VAPID gerado!\n');
console.log('Copie estas 3 variáveis para Vercel → Settings → Environment Variables:\n');
console.log(`VAPID_PUBLIC_KEY=${base64url(publicKey)}`);
console.log(`VAPID_PRIVATE_KEY=${base64url(privateKey)}`);
console.log('VAPID_SUBJECT=mailto:seuemail@exemplo.com   ← troque pelo seu e-mail\n');
console.log('Depois de configurar, redeploy o projeto pro build injetar a chave pública no front.\n');
