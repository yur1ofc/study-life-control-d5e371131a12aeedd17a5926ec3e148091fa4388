# Disponibilidade inteligente (V38)

## O que mudou
- O site agora PERGUNTA antes de cobrar: "Dá pra estudar agora?" com botões
  Posso / Daqui a 30 min / Não posso (Telegram) ou janela no app (push).
- "Não posso" abre uma pergunta livre: "O que você vai fazer e até quando?"
  Aceita qualquer coisa: "trabalho até 18h", "academia por 1 hora",
  "toda segunda e quarta trabalho das 8 às 17".
- O que a pessoa responde vira bloco ocupado (único ou fixo por dia da semana).
  3 respostas iguais no mesmo dia da semana viram rotina fixa automaticamente.
- Horário de silêncio (padrão 07:00–22:30): nunca mais aviso às 5h.
- Aprende por horário/dia da semana (respostas + sessões concluídas, memória
  que esquece devagar). Se costuma não poder naquele horário, não pergunta.
- Puxa as rédeas sem encher: mais insistente quando está abaixo da meta, com
  prova perto ou sem estudar ontem; recua se a pessoa ignora várias perguntas;
  nunca passa de 3 perguntas por dia (4 se a prova for em até 2 dias).
- Todos os outros lembretes inteligentes (revisão, registro de aula, prova)
  também respeitam os compromissos informados e o horário de silêncio.

## Arquivos
- study-availability.js (cérebro, roda no navegador e no servidor)
- availability-ui.js (card em Configurações + janela da pergunta)
- api/send-reminders.js, api/telegram-webhook.js, api/telegram-link.js
- index.html, service-worker.js (cache v55), vercel.json (cron fallback 09h BRT)

## Para funcionar de verdade (IMPORTANTE)
1. Cron externo a cada 10–15 min chamando /api/send-reminders com o header
   Authorization: Bearer <CRON_SECRET> (cron-job.org). Sem isso o Vercel Hobby
   roda só 1x por dia e as perguntas não chegam na hora certa.
2. Reative o webhook do Telegram para aceitar os botões (uma vez):
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d "url=https://SEU-SITE/api/telegram-webhook" \
     -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>" \
     -d 'allowed_updates=["message","callback_query"]'
3. Faça o deploy.

## Comandos novos no Telegram
/ocupado trabalho até 18h  ·  /disponibilidade
