# Calendário automático e alarmes de estudo

Duas features novas, pensadas pra não exigir nenhuma exportação manual do
usuário depois da configuração inicial.

## 1) Calendário assinável (.ics / webcal)

**O que o usuário vê:** em Configurações → Calendário, clica em "Gerar meu
link de calendário", copia a URL (ou clica em "Abrir no app de calendário")
e assina isso UMA VEZ no Google Agenda / Calendário da Apple / Outlook. A
partir daí, toda prova, tarefa, sessão de estudo e aula que ele cadastrar no
site aparece sozinha lá.

**Como funciona por baixo dos panos:**
- `calendar-feed.js` gera um token aleatório (fica em `settings.calendarToken`)
  e, a cada save (`slc-data-saved`), publica uma cópia enxuta e pública dos
  dados relevantes em `calendar_feeds/{token}` no Firestore.
- `api/calendar/[token].js` (Vercel Function) lê esse documento e devolve um
  `.ics` de verdade sempre que o app de calendário do usuário buscar a URL.

**Setup necessário:** nenhum além do que o projeto já tem. Só publique
`firestore.rules` de novo (tem uma coleção nova, `calendar_feeds`).

**Limitação conhecida:** os apps de calendário normalmente só buscam
atualizações a cada 12–24h — não é instantâneo. Isso é do protocolo
`webcal`/iCalendar, não dá pra forçar.

## 2) Alarmes de estudo por notificação push

**O que o usuário vê:** na mesma aba, ativa "Alarmes de estudo" e escolhe com
quanto tempo de antecedência quer ser avisado (provas, tarefas, sessões).
Recebe uma notificação real do sistema operacional, mesmo com o site
fechado.

**Como funciona por baixo dos panos:**
- `push-notifications.js` pede permissão e assina o navegador no Push API
  (guardado em `pushSubscriptions`, dentro do documento do usuário).
- `api/send-reminders.js` roda periodicamente (cron), varre todo mundo com
  alarme ativo, calcula o que vence dentro da janela configurada e manda o
  push via `web-push` + VAPID.
- `service-worker.js` recebe o push e mostra a notificação.

### Setup necessário (variáveis de ambiente no Vercel)

1. **Chaves VAPID** — rode localmente:
   ```
   node scripts/generate-vapid-keys.js
   ```
   Copie o resultado para `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e
   `VAPID_SUBJECT` (um `mailto:seu@email.com`).

2. **Service Account do Firebase** (necessária porque o cron precisa ler/
   atualizar o documento de TODOS os usuários, não só de quem está logado):
   - Firebase Console → ⚙️ Configurações do projeto → Contas de serviço →
     "Gerar nova chave privada" (baixa um `.json`).
   - Converta pra base64: `base64 -w0 sua-chave.json` (Linux) ou
     `base64 -i sua-chave.json` (macOS).
   - Cole o resultado em `FIREBASE_SERVICE_ACCOUNT_KEY`.
   - **Nunca** commite esse `.json` — o `.gitignore` já bloqueia os padrões
     comuns dele, mas confira antes de dar push.

3. **CRON_SECRET** — escolha qualquer string longa aleatória e salve como
   variável de ambiente. É o que impede qualquer pessoa de chamar
   `/api/send-reminders` na sua conta.

4. **Cron externo (recomendado)** — o plano Hobby da Vercel só roda cron 1x
   por dia (já configurado em `vercel.json` como fallback, às 09:00 UTC).
   Pra lembretes chegarem perto da hora certa (ex: "sua sessão começa em 15
   min"), cadastre gratuitamente em algo como
   [cron-job.org](https://cron-job.org) uma chamada `GET` a cada 10–15
   minutos para:
   ```
   https://seu-dominio.vercel.app/api/send-reminders
   ```
   com o header:
   ```
   Authorization: Bearer <o mesmo valor de CRON_SECRET>
   ```

### Limitações conhecidas

- **iPhone/iPad:** push só funciona depois de instalar o site na Tela de
  Início (Compartilhar → Adicionar à Tela de Início) — Safari em aba comum
  não recebe push do iOS.
- **Fuso horário:** o app não guarda o fuso horário do usuário, então os
  horários de aviso de provas/tarefas (que só têm data, sem hora) são
  calculados como meia-noite UTC. Na prática, o aviso pode chegar algumas
  horas antes/depois do esperado dependendo de onde o usuário mora. Sessões
  de estudo (que têm hora) são mais precisas.
- **Plano Hobby da Vercel:** funções têm 10s de limite de execução. Com
  poucos usuários isso não é problema; se o app crescer bastante, considere
  paginar a varredura em `api/send-reminders.js` ou migrar pro plano Pro.
