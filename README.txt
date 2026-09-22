# SLCampus

Sistema web para organização acadêmica de universitários, com foco em rotina de estudos, tarefas, provas, grade curricular, aulas, materiais e apoio por IA.

## Stack
- HTML + CSS + JavaScript puro
- Firebase Authentication
- Cloud Firestore
- Deploy na Vercel

## Estrutura principall
- `index.html`: estrutura do app
- `style.css`: estilos
- `app.js`: classe principal e fluxos do produto
- `auth.js`: autenticação e roteamento inicial
- `database.js`: persistência no Firestore
- `firebase-config.js`: inicialização do Firebase
- `views.js`: renderização das telas
- `schedule.js`: grade horária
- `review-system.js`: revisões
- `daily-log.js`: registro diário
- `class-diary.js`: diário de aula
- `grade-calculator.js`: cálculo de notas
- `ai-assistant.js`: assistente acadêmico

## Antes de lançar
1. Atualize as regras do Firestore com `firestore.rules`
2. Adicione `manifest.json`, `robots.txt`, `sitemap.xml` e `favicon.svg` na raiz
3. No `index.html`, adicione no `<head>`:

```html
<meta name="theme-color" content="#2563eb">
<meta name="description" content="Sistema inteligente para universitários organizarem estudos, provas, tarefas e rotina acadêmica.">
<link rel="manifest" href="manifest.json">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
```

## Publicação
1. Commit no GitHub
2. Push para `main`
3. Redeploy na Vercel
4. Teste fluxo completo:
   - login com conta nova
   - setup inicial
   - criação/edição/exclusão de matéria
   - sessão, tarefa, prova, material e aula
   - exportação de backup
   - importação de grade

## Observação importante
Este pacote contém os arquivos críticos já fortalecidos para lançamento. O `app.js`, `views.js`, `index.html` e `style.css` ainda merecem uma refatoração maior em uma segunda rodada para separar responsabilidades e melhorar manutenção.

--- QUOTA GEMINI / PRODUÇÃO ---

As quotas de IA agora são controladas somente pelo servidor (Firebase Admin SDK + transações Firestore). O navegador não pode alterar ai_usage, mentor_usage, gemini_usage_global ou gemini_ai_logs.

Variáveis recomendadas no Vercel:
- GEMINI_API_KEY = chave do Google AI Studio
- FIREBASE_SERVICE_ACCOUNT_KEY = JSON da Service Account do Firebase em base64 (necessária para as quotas atômicas)
- GEMINI_TOTAL_DAILY_LIMIT = orçamento interno diário do SLCampus. Configure abaixo do RPD efetivo mostrado no AI Studio para os modelos usados; o valor padrão de código é conservador e não representa a quota oficial do Google.
- GEMINI_IMPORT_RESERVE = parcela do orçamento global reservada para importações. Com 8 importações/usuário e até 2 modelos por importação, o padrão é 16.
- GEMINI_USER_IMPORT_LIMIT = 8
- MENTOR_DAILY_LIMIT = 60
- MENTOR_DEGRADE_RATIO = 0.75
- GEMINI_ADMIN_EMAIL ou GEMINI_ADMIN_UID = conta que pode abrir /admin-ai.html
- GEMINI_TEST_EMAIL ou GEMINI_TEST_UID = conta temporariamente isenta do limite de 8 importações durante testes. REMOVER AO FINAL DOS TESTES.

O endpoint /api/gemini nunca faz mais de duas chamadas Gemini por importação. O navegador não repete automaticamente a importação, evitando multiplicar chamadas. Cada chamada real ao modelo recebe uma reserva atômica antes de ser enviada e um log de resultado depois.
