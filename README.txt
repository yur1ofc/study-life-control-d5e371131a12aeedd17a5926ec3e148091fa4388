# Study Life Control

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
