# V31 — atualização do Service Worker

O `service-worker.js` foi incluído nos arquivos alterados e o CACHE_VERSION foi incrementado para `slc-v46`.

Isso força o navegador a instalar uma nova versão do Service Worker no próximo check de atualização. Ao assumir o controle, o SW remove os caches antigos e recria o cache estático com os arquivos atuais.

A lógica de atualização já existente no `app-enhancements.js` chama `registration.update()` ao iniciar e quando o app volta a ficar visível.

Após publicar no Vercel, abra o SLCampus uma vez com internet no celular/PWA. A nova versão deverá assumir o controle e recarregar a página automaticamente.
