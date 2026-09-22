# Checklist de deploy público - Study Life Control

## Firebase
- [ ] Firestore Rules publicadas usando o arquivo `firestore.rules`
- [ ] Authentication > Sign-in method > Google habilitado
- [ ] Authentication > Settings > Authorized domains contém:
  - [ ] `study-life-control.vercel.app`
  - [ ] seu domínio final personalizado
  - [ ] `localhost` para testes locais
- [ ] Firestore Database criado em modo produção

## Vercel
- [ ] Repositório conectado na Vercel
- [ ] Projeto configurado como site estático
- [ ] Deploy sem erro no build/output
- [ ] HTTPS ativo no domínio final
- [ ] Cache limpo após publicar nova versão

## Fluxo funcional
- [ ] Login com conta Google nova
- [ ] Setup inicial salva nome/curso/universidade
- [ ] Criar matéria
- [ ] Criar aula
- [ ] Recarregar a página e conferir persistência
- [ ] Sair da conta
- [ ] Entrar novamente e conferir dados
- [ ] Teste offline: abrir, desligar internet, navegar, religar internet

## Qualidade visual
- [ ] Banner de conexão aparece só quando necessário
- [ ] Mobile abre sidebar corretamente
- [ ] Dashboard não quebra em 360px de largura
- [ ] PWA pode ser instalada

## Calendário e alarmes (opcional, ver CALENDARIO-E-LEMBRETES.md)
- [ ] `firestore.rules` publicadas de novo (coleção `calendar_feeds` é nova)
- [ ] Configurações → Calendário gera o link e o `.ics` abre sem erro
- [ ] `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` configuradas
- [ ] `FIREBASE_SERVICE_ACCOUNT_KEY` configurada (base64 do JSON da service account)
- [ ] `CRON_SECRET` configurada
- [ ] Cron externo (cron-job.org ou similar) apontando pra `/api/send-reminders`


## Gemini — checklist obrigatório para produção

- [ ] Configurar `FIREBASE_SERVICE_ACCOUNT_KEY` no Vercel.
- [ ] Configurar `GEMINI_TOTAL_DAILY_LIMIT` com base no RPD efetivo exibido pelo Google AI Studio; este valor é um orçamento interno do SLCampus.
- [ ] Configurar `GEMINI_IMPORT_RESERVE` (recomendado: suficiente para o pior caso de 8 imports × 2 modelos = 16 chamadas).
- [ ] Configurar `GEMINI_ADMIN_EMAIL` ou `GEMINI_ADMIN_UID` para o painel `/admin-ai.html`.
- [ ] Durante testes, `GEMINI_TEST_EMAIL`/`GEMINI_TEST_UID` pode isentar uma única conta do limite de 8; remover depois.
- [ ] Publicar `firestore.rules` com os contadores de IA bloqueados para clientes.
- [ ] Conferir `/admin-ai.html` após o primeiro deploy.
