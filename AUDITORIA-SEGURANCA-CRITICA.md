# SLCampus — Auditoria crítica e correções aplicadas

## Escopo

Revisão concentrada nas áreas críticas indicadas no contexto do projeto: Firestore Rules, Storage Rules, autenticação/dados, APIs, Service Worker, Academic Context e gateway de IA.

## Correções aplicadas

### 🔴 Firestore — wildcard permissivo em `users/{userId}`
**Arquivo:** `firestore.rules`

**Problema:** havia um `match /users/{userId}/{document=**}` com `allow write: if isOwner(userId)`. Como regras sobrepostas são combinadas permissivamente, esse wildcard tornava inúteis parte das validações específicas da subcoleção `resources`.

**Correção:** o wildcard foi removido. A subcoleção `resources` agora possui regras próprias para leitura, criação, atualização e exclusão, com validação de campos e limites. Atualizações também não podem alterar `createdAt` nem adicionar campos arbitrários.

### 🟠 Firestore — schema de recursos pouco restritivo
**Arquivo:** `firestore.rules`

**Problema:** recursos podiam receber campos extras e alterar campos de controle sem uma lista explícita de campos alteráveis.

**Correção:** `create` e `update` agora validam tipos/tamanhos; `update` usa `diff(...).affectedKeys().hasOnly(...)` e mantém `createdAt` imutável.

### 🟠 IA — ordem de providers inconsistente com a arquitetura documentada
**Arquivo:** `api/_lib/ai-core.js`

**Problema:** o fallback padrão era `gemini,groq`, enquanto o contexto atual do projeto declara Groq como provider principal e Gemini como legado/fallback.

**Correção:** o padrão passou para `groq,gemini`. A variável `SLC_AI_PROVIDER_ORDER` continua podendo sobrescrever a ordem no ambiente de produção.

### 🟠 Service Worker — cache estático incompleto
**Arquivo:** `service-worker.js`

**Problema:** `resource-library.js`, `account-security.js` e o SDK local de Storage não estavam completamente refletidos na lista estática.

**Correção:** esses recursos foram adicionados ao cache estático.

### 🟠 Service Worker — atualização da aplicação
**Arquivo:** `service-worker.js`

**Problema:** uma nova versão do app poderia ficar presa no cache antigo em dispositivos/PWAs que permanecessem abertos.

**Correção:** versão do cache elevada para `slc-v53-security-hardening`. O projeto já possui `skipWaiting()`, `clients.claim()` e `controllerchange` em `app-enhancements.js`, que recarrega a página quando um novo Service Worker assume o controle de uma aba que já tinha um controlador.

### 🟡 Scheduler — diagnóstico incorreto de saúde
**Arquivo:** `api/notification-health.js`

**Problema:** o cron roda uma vez por dia, mas a saúde era considerada boa somente se a última execução tivesse ocorrido nos 15 minutos anteriores. Isso produzia falso negativo durante quase todo o dia.

**Correção:** a saúde agora considera uma execução bem-sucedida (`ok` ou `completed_with_errors`) dentro de uma janela de 26 horas.

### 🟡 APIs — vazamento desnecessário de mensagens internas
**Arquivos:**
- `api/calendar/feed.js`
- `api/admin-ai-usage.js`
- `api/push-test.js`
- `api/telegram-link.js`
- `api/telegram-file.js`
- `api/send-reminders.js`

**Problema:** algumas respostas HTTP devolviam `err.message` diretamente ao cliente.

**Correção:** mensagens internas agora são registradas no servidor e respostas públicas usam mensagens genéricas. O `runId` continua disponível onde é útil para correlação operacional.

### 🟢 Autenticação — mensagem de logout
**Arquivo:** `auth.js`

**Problema:** o logout podia exibir diretamente a mensagem interna do Firebase.

**Correção:** mensagens técnicas não são mais exibidas diretamente; somente uma mensagem amigável e específica para falha de rede é mostrada.

## Itens revisados e mantidos

- `storage.rules`: acesso continua restrito ao UID autenticado e PDF limitado a 25 MB.
- `api/delete-account.js`: mantém verificação de token revogado + `auth_time` recente antes da exclusão.
- `api/telegram-webhook.js`: mantém `x-telegram-bot-api-secret-token` e limite de payload.
- `api/mentor-chat.js` e `api/gemini.js`: chaves de IA continuam somente no servidor e os endpoints exigem token Firebase.
- `calendar_feeds`: continua público por desenho; o token de 32 bytes é um segredo de compartilhamento. Não foi transformado em feed autenticado porque isso quebraria Google/Apple/Outlook.
- `shared/academic-context.js`: permanece como fonte usada pelo frontend. Existe uma cópia legada em `Shared/academic-context.js`, mas ela não é carregada pelo `index.html`; não foi apagada para evitar alteração estrutural desnecessária.
- `database.js`: as gravações do documento principal continuam protegidas por UID e limites de crescimento; a migração de arrays grandes para subcoleções permanece recomendada para evitar atingir o limite de ~1 MiB do Firestore.

## Verificações executadas

- Todos os arquivos JavaScript do projeto passaram em `node --check`.
- `package.json`, `vercel.json` e `manifest.json` foram validados como JSON.
- Não foram encontrados `eval()` ou `new Function()` no levantamento anterior.
- Não foram encontrados IDs HTML duplicados no levantamento anterior.

## Observação de deploy

A correção do Service Worker só entra em produção depois de um novo deploy. Após o deploy, a nova versão `slc-v53-security-hardening` substitui os caches anteriores e o mecanismo de `controllerchange` força a recarga da aplicação quando o novo SW assumir o controle.
