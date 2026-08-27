# Mentor IA — atualização (Diário + Mapa de Aprendizado + IA real)

> **Correção importante (26/08):** o `api/mentor-chat.js` estava salvo na
> RAIZ do projeto (`mentor-chat.js`), não dentro da pasta `api/`. A Vercel só
> reconhece Serverless Functions dentro de `api/`, então `/api/mentor-chat`
> nunca existiu de verdade em produção — toda pergunta aberta ao Mentor IA
> estava caindo direto no modo por regras, sem tentar o Gemini. Já corrigido
> nesta pasta (o arquivo agora está em `api/mentor-chat.js`).
>
> Também foi adicionada uma **cota GLOBAL única, compartilhada entre o chat
> do Mentor IA e o import de grade por PDF** (`api/_lib/gemini-shared-quota.js`),
> com uma fatia sempre reservada pro import — a ação mais importante pra
> usuário novo. Ver `GEMINI_TOTAL_DAILY_LIMIT` e `GEMINI_IMPORT_RESERVE`
> abaixo.

## Arquivos nesta pasta (substituem os do seu repo)

- `ai-assistant.js` — todo o mentor (regras antigas continuam intactas + patch novo no final)
- `app.js` — só adicionei a saudação proativa ao abrir a aba do Mentor
- `views.js` — só atualizei a mensagem de boas-vindas e 2 botões de sugestão novos
- `firestore.rules` — adicionei a coleção `mentor_usage` (contador de uso do chat)
- `api/mentor-chat.js` — **arquivo novo**, endpoint dedicado ao chat do Mentor IA

O `api/gemini.js` (import de grade) **não foi alterado** — continua igual, com o
próprio limite de 8/dia, sem disputar cota com o chat do mentor.

## O que mudou, na prática

1. **Diário de Aula**: pergunte "o que eu vi hoje?" ou "revisar aula de hoje" —
   o mentor puxa o que você registrou hoje (conteúdo, dúvidas, o que não
   entendeu) e sugere perguntas de revisão. Se não tiver nada registrado
   ainda, ele pergunta "o que você viu hoje?" e usa sua próxima resposta livre
   para revisar na hora, sem precisar ter preenchido o Diário.
2. **Mapa de Aprendizado**: pergunte "o que estudar?" — ele monta uma ordem
   por **tópico** (não só por matéria), considerando dificuldade, confiança
   baixa, tempo sem revisar, dúvidas recentes no diário e provas próximas.
3. **IA de verdade**: qualquer pergunta que fuja dos comandos conhecidos é
   mandada para o Gemini (via `/api/mentor-chat`), junto com um resumo
   completo e atualizado dos seus dados reais (matérias, mapa de
   aprendizado, diário, provas, tarefas, revisões). Sem login ou com a IA
   indisponível, ele volta pras respostas por regra de sempre — nunca fica
   mudo.
4. **Saudação proativa**: ao abrir a aba, se fizer sentido (diário vazio à
   tarde, revisão pendente hoje, prova muito próxima), ele já avisa sozinho.

## Passo a passo para colocar no ar

1. Substitua os 4 arquivos no seu repositório local pelos desta pasta
   (`ai-assistant.js`, `app.js`, `views.js`, `firestore.rules`) e **adicione**
   o arquivo novo `api/mentor-chat.js` dentro da pasta `api/` do projeto.
2. No Firebase Console → Firestore → Rules, publique o `firestore.rules`
   atualizado (ou rode `firebase deploy --only firestore:rules` se usa CLI).
   Sem isso, o contador de uso do chat vai falhar silenciosamente (o chat
   ainda funciona, só não teria limite diário).
3. (Opcional) No Vercel → seu projeto → Settings → Environment Variables,
   adicione `MENTOR_DAILY_LIMIT` com o número de mensagens de chat por
   usuário/dia que você quiser (padrão se não configurar: **60**). Não
   precisa criar nenhuma variável nova de API key — `api/mentor-chat.js`
   reaproveita `GEMINI_API_KEY`, `FIREBASE_API_KEY` e `FIREBASE_PROJECT_ID`
   que você já tem configuradas para o `api/gemini.js`.
   Também dá pra ajustar, no mesmo lugar:
   - `GEMINI_TOTAL_DAILY_LIMIT` — teto de chamadas ao Gemini por dia,
     somando import + chat de TODOS os usuários do site (padrão: 1200).
   - `GEMINI_IMPORT_RESERVE` — quantas dessas chamadas ficam SEMPRE
     garantidas pro import de grade, mesmo que o chat já tenha estourado o
     resto (padrão: 150). **Pra garantir mais sobra pra usuários novos
     importarem a grade, aumente esse número (ou diminua o
     `GEMINI_TOTAL_DAILY_LIMIT`)** — o chat nunca consegue tocar nessa
     fatia, é reservada por design, não por sorte.
   - `MENTOR_DEGRADE_RATIO` — a partir de que % da cota que sobra pro chat
     (depois de tirar a reserva do import) a função já passa a economizar
     por chamada (padrão: 0.75).
4. `git add`, `commit`, `push` — o deploy do Vercel sobe automaticamente
   (o projeto já tem `node inject-env.js` como build command, não mexi nisso).

## Como testar depois do deploy

- Abra o Mentor IA logado. Se fizer sentido (diário vazio à tarde, revisão
  pendente, prova próxima), deve aparecer um aviso automático como primeira
  mensagem.
- Clique no botão **"Revisar aula de hoje"**:
  - Se você já registrou algo no Diário hoje, deve aparecer o conteúdo +
    perguntas de revisão.
  - Se não registrou nada, o mentor deve perguntar "o que você viu hoje?" —
    responda em texto livre (ex: "vi integral por partes em cálculo") e
    confira se ele te dá uma revisão coerente sobre isso.
- Clique no botão **"Trilha de estudo"** (precisa ter pelo menos 1 tópico
  cadastrado no Mapa de Aprendizado para ver a versão por tópico; sem isso,
  ele cai na sugestão por matéria de sempre).
- Digite uma pergunta bem aberta que não é nenhum dos comandos prontos, tipo
  "me ajuda a entender por que eu sempre procrastino antes de prova" — isso
  deve escalar pra chamada de IA real (vai demorar um pouco mais que as
  respostas por regra, que são instantâneas).
- Force o limite diário do chat (ou reduza `MENTOR_DAILY_LIMIT` temporariamente
  pra 1 e teste com 2 mensagens seguidas) para confirmar que a mensagem de
  limite atingido aparece certinha e que o mentor não trava — ele deve
  continuar respondendo com as regras rápidas mesmo sem IA disponível.

## Coisas que eu NÃO testei de verdade (fiquem de olho)

- Não rodei a chamada real ao Gemini (não tenho acesso à sua `GEMINI_API_KEY`
  nem ao Firebase do projeto neste ambiente) — só validei sintaxe
  (`node --check`, sem erros) e a lógica manualmente lendo o código. O
  primeiro teste de verdade em produção é importante.
- O formato de resposta do Gemini (`data.candidates[0].content.parts[0].text`)
  segue exatamente o mesmo padrão que `grade-ia-import.js` já usa hoje com
  sucesso — deve funcionar igual, mas vale confirmar no primeiro teste.
