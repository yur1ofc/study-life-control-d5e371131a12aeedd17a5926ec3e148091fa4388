# SLCampus V29 — Deploy e segurança

## O que esta versão corrige

- Contexto acadêmico centralizado em `shared/academic-context.js`.
- Resolver único de matérias por nome/código/sigla/alias.
- Telegram usa o mesmo escopo de semestre atual/histórico.
- `addItem`, `updateItem` e `removeItem` do cliente usam transações Firestore.
- Escritas do Telegram por array usam transações.
- Telegram webhook agora falha fechado sem `TELEGRAM_WEBHOOK_SECRET`.
- Limite de body do webhook.
- Código de vinculação Telegram usa `crypto`, não `Math.random()`.
- Exclusão de conta remove `calendar_feeds` e `telegramLinks` associados ao UID.
- Logout remove o backup acadêmico local daquele UID.
- Rules limitam mais arrays que poderiam crescer indefinidamente.
- CSP ganhou `frame-ancestors`, `manifest-src` e `worker-src`.
- App Check Web opcional com reCAPTCHA Enterprise.
- Service Worker atualizado para `slc-v45`.

## 1. Vercel — variáveis de ambiente

Mantenha as existentes e confirme:

Obrigatórias do frontend:
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`

Servidor:
- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`  ← NOVA/OBRIGATÓRIA para vincular Telegram
- `CRON_SECRET`
- `APP_PUBLIC_URL=https://slcampus.vercel.app`

Push:
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

IA:
- variáveis Gemini que já existiam no projeto.

App Check (opcional no primeiro deploy):
- `FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY`

Não coloque nenhuma chave privada no GitHub.

### Como criar os dois segredos novos

Use um gerador de senha aleatória forte e gere:
- `TELEGRAM_WEBHOOK_SECRET`: 32+ caracteres usando somente A-Z, a-z, 0-9, `_` e `-`.
- `CRON_SECRET`: 32+ caracteres aleatórios.

No Vercel:
Project → Settings → Environment Variables → Production.

Depois faça novo Deploy.

## 2. Telegram

Depois que `TELEGRAM_WEBHOOK_SECRET` estiver no Vercel:

1. Faça deploy.
2. Abra Configurações → Telegram no SLCampus.
3. Desvincule/revincule se necessário.
4. O endpoint `telegram-link` configura o webhook com `secret_token`.
5. Teste `/start` e uma mensagem natural.

Se o webhook estiver configurado manualmente, ele precisa usar o mesmo segredo.

Não compartilhe o token do bot nem o webhook secret.

## 3. Firebase Firestore Rules

Firebase Console → Firestore Database → Rules.

Substitua pelas regras do arquivo:
`firestore.rules`

Clique em Publish.

As regras continuam permitindo que cada usuário acesse somente seu próprio documento, enquanto os contadores internos de IA permanecem bloqueados ao cliente.

## 4. Firebase Storage Rules

Firebase Console → Storage → Rules.

Publique:
`storage.rules`

Arquivos privados continuam restritos ao UID dono e PDFs continuam limitados ao tamanho/tipo definidos pelo projeto.

## 5. App Check

O código V29 já suporta App Check no navegador.

Para ativar:

1. Google Cloud Console → projeto do Firebase.
2. Crie uma chave Web reCAPTCHA Enterprise baseada em pontuação.
3. Restrinja a chave ao domínio de produção `slcampus.vercel.app` (e aos domínios reais adicionais que você usar).
4. Firebase Console → Security → App Check.
5. Registre o app Web com essa chave.
6. Coloque a chave pública em:
   `FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY`
   no Vercel.
7. Faça deploy.
8. Primeiro observe as métricas.
9. Só depois ative Enforcement para os serviços que você realmente usa.

Não ative Enforcement antes de confirmar que os usuários legítimos estão recebendo tokens.

## 6. Lembretes em horários livres

Importante: no Vercel Hobby o Cron não pode executar várias vezes ao dia; o mínimo é uma execução diária e a precisão é horária. Portanto, o V29 mantém o cron diário como fallback.

Para lembretes de intervalo/almoço/sessão com precisão de minutos:

- use Vercel Pro com Cron frequente; OU
- use um cron externo que chame:
  `https://slcampus.vercel.app/api/send-reminders`
  a cada 10–15 minutos.

O cron externo precisa enviar:
`Authorization: Bearer SEU_CRON_SECRET`

Não abra `/api/send-reminders` sem esse header.

## 7. Exclusão de conta

O endpoint de exclusão agora remove:
- `users/{uid}` e subcoleções;
- arquivos Storage em `users/{uid}/`;
- `calendar_feeds` cujo `uid` corresponde à conta;
- `telegramLinks` cujo `uid` corresponde à conta;
- Firebase Authentication.

O feed de calendário é público por design e funciona como um link secreto; por isso a exclusão do documento do feed é necessária.

## 8. O que ainda deve ser monitorado

A V29 reduz o risco de concorrência, mas o documento principal ainda concentra muitos arrays.

Quando o uso crescer, a próxima migração estrutural deve ser:
`users/{uid}/semesters/{semesterId}/...`

Isso reduz o crescimento do documento principal e torna o histórico verdadeiramente separado.

Também vale monitorar o tamanho dos documentos no Firestore antes de crescer o beta.

## 9. Checklist pós-deploy

- Login Google
- carregar dados
- adicionar/editar/remover tarefa
- adicionar nota
- iniciar/finalizar sessão
- Telegram `/agenda`
- Telegram consulta de próxima prova
- Telegram registrar aula
- Telegram registrar estudo
- Telegram duplicidade
- Push
- Telegram notification
- calendário `.ics`
- logout e novo login
- exclusão de conta em conta de teste
- Storage de PDF
- Mentor IA
- regras Firestore publicadas
- regras Storage publicadas
- Vercel envs Production atualizadas
- Vercel Logs sem erros

