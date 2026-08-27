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

