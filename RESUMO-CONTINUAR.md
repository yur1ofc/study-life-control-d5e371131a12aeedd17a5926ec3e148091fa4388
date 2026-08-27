# Resumo pra continuar em outro chat — Study Life Control

Cole este arquivo (ou o conteúdo dele) no começo de um novo chat, junto com
o ZIP mais recente do projeto, se o chat atual travar por limite de tokens.

## Contexto do projeto
App de organização acadêmica (Firebase + Vercel, sem framework, JS puro).
Deploy em: https://study-life-control.vercel.app
Repo: github.com/yur1ofc/study-life-control-...

## ✅ O que já foi RESOLVIDO nesta sessão

### 1. env-config.js não era gerado em produção (RESOLVIDO)
- Causa: não era o código — era propagação de deploy/alias no Vercel.
- `inject-env.js` foi reescrito com diagnóstico completo (imprime __dirname,
  process.cwd(), confirma se o arquivo foi escrito e lista os arquivos do
  diretório). Isso já está no repositório do usuário (ele já commitou).
- Confirmado funcionando: `https://study-life-control.vercel.app/env-config.js`
  responde certo, com as 6 chaves do Firebase + VAPID_PUBLIC_KEY.
- **Não precisa mexer mais nisso.**

### 2. Painel de tema aparecia em todas as abas de Configurações (RESOLVIDO,
   sessão anterior) — corrigido em `theme-engine.js`, só aparece quando
   aba === 'tema' agora.

### 3. Revisões espaçadas e aulas não apareciam no calendário/notificações
   (RESOLVIDO NESTA SESSÃO — ver detalhes abaixo)

## 🔧 O que foi corrigido agora (revisões + aulas no calendário/push)

**Diagnóstico:** o app tem 5 tipos de dado com data (exams, tasks, sessions,
classSchedule, reviews), mas só 3–4 deles alimentavam os dois sistemas de
aviso:
- `.ics` (calendário assinável): tinha exams/tasks/sessions/classSchedule,
  **faltava `reviews`** (revisão espaçada, gerada automaticamente por
  `review-system.js` toda vez que uma aula é registrada no Diário).
- Push de verdade (`api/send-reminders.js`, funciona com app fechado/celular
  bloqueado): tinha só exams/tasks/sessions, **faltava `reviews` E
  `classSchedule`** (aulas).

**Arquivos alterados** (todos já com `node --check` OK, prontos em
`/mnt/user-data/outputs/arquivos-atualizados/`):

1. `database.js` — `DEFAULT_APP_DATA().settings.studyReminders` ganhou
   `reviewsHoursBefore: 24` e `classMinutesBefore: 15`.
2. `calendar-feed.js` — `buildSnapshot()` agora inclui `reviews` no objeto
   publicado em `calendar_feeds/{token}`.
3. `api/calendar/feed.js` — `buildIcs()` agora gera VEVENT pra cada revisão
   (`🔁 Revisão: ...`, alarme 1 dia antes). Comentários/CALDESC atualizados.
4. `api/send-reminders.js` — maior mudança:
   - Nova função `nowPartsInTimezone(ms, tz)` (usa `Intl.DateTimeFormat`)
     pra descobrir dia da semana + minuto do dia "agora" no fuso do
     usuário — necessário porque aula é recorrente semanal, sem data
     absoluta salva.
   - `findDueReminders()` ganhou dois blocos novos: um pra `reviews` (igual
     ao de tasks, usando `dateOnlyToMs`) e um pra `classSchedule` (só
     dispara no dia certo da semana, dentro da janela antes do horário de
     início; chave de dedupe inclui a data do dia pra não travar pra
     sempre).
5. `views.js` — dois novos `<select>` na aba Configurações → Calendário:
   "Avisar revisão espaçada com quantas horas de antecedência?" e "Avisar
   aula com quantos minutos de antecedência?". Texto do toggle principal
   atualizado pra mencionar revisões e aulas.
6. `app.js` — o `forEach` que liga os `<select>` de preferência de lembrete
   ao `saveReminderPrefs` foi estendido de `['exams','tasks','sessions']`
   pra incluir `'reviews'` e `'class'` (usando o `map` já existente,
   só adicionei as duas entradas novas).

## ⚠️ O que FALTA fazer

1. **Usuário precisa baixar os 6 arquivos de
   `/mnt/user-data/outputs/arquivos-atualizados/` e substituir no repo
   local**, depois `git add`, `commit`, `push`. Ainda NÃO foi commitado/
   deployado — os arquivos só existem no ambiente sandbox deste chat até
   agora.
   - Arquivos: `database.js`, `calendar-feed.js`, `app.js`, `views.js`,
     `api/calendar/feed.js`, `api/send-reminders.js`
2. **Testar depois do deploy:**
   - Abrir Configurações → Calendário → confirmar que aparecem os 2 novos
     selects (revisão / aula) e que salvam sem erro (toast de sucesso).
   - Assinar o link `.ics` de novo (ou forçar refresh no app de calendário)
     e conferir se aparecem eventos "🔁 Revisão: ..." nos dias certos.
   - Testar o push manualmente: mais fácil é temporariamente reduzir
     `classMinutesBefore`/`reviewsHoursBefore` bem baixo E ter uma aula/
     revisão que caia dentro da janela, então chamar a rota
     `/api/send-reminders` manualmente (com o header
     `Authorization: Bearer <CRON_SECRET>`) e ver se `notificationsSent`
     subiu no JSON de resposta.
3. **Não testado/validado de verdade ainda:** a lógica de fuso horário do
   bloco de aulas em `nowPartsInTimezone` (usa `Intl.DateTimeFormat` com
   `timeZone`) — a lógica foi revisada com cuidado e o arquivo passa no
   `node --check`, mas não rodei um teste real comparando com horário de
   Brasília de verdade. Se o aviso de aula chegar na hora errada (adiantado
   ou atrasado), o primeiro lugar pra olhar é essa função.
4. **Pendência antiga, não resolvida ainda:** o card "Catálogo comunitário"
   em Configurações (busca/compartilha grade, vem de
   `curriculum-catalog.js`) tem o mesmo bug que o painel de tema tinha —
   aparece colado em toda aba de Configurações, não só na aba dele. O
   usuário foi perguntado se queria corrigir isso e ainda não respondeu.

## Coisas específicas do ambiente (pra não repetir investigação)

- Vercel: Build Command = `node inject-env.js`, Output Directory = `.`.
  Não mude essas duas configs — já foram confirmadas corretas.
- `.vercelignore` existe DE PROPÓSITO pra ignorar `.gitignore` como filtro
  de deploy (senão `env-config.js` gerado no build seria descartado por
  causa de uma entrada antiga). Não apagar esse arquivo.
- O projeto tem 3 funções serverless (`api/send-reminders.js`,
  `api/gemini.js`, `api/calendar/feed.js`), por isso o build roda o script
  de build 4x nos logs (1x geral + 1x por função) — é normal, não é bug.
- `api/calendar/feed.js` usa rota fixa com querystring (`?token=`) em vez
  de rota dinâmica (`[token].js`) por causa de um bug de plataforma da
  Vercel (meados de 2026) com rotas dinâmicas retornando 404 — está
  documentado no topo do próprio arquivo.
