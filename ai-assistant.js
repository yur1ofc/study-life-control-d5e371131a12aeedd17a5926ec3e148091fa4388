// ⚠️ ARQUIVO PERDIDO — ai-assistant.js ⚠️
//
// O conteúdo que estava aqui era, na verdade, uma cópia de
// scripts/generate-vapid-keys.js (código Node, com require('crypto')) —
// por isso o chat do Mentor IA quebrava no navegador com
// "Uncaught ReferenceError: require is not defined".
//
// Vasculhei TODO o zip que você mandou (incluindo os arquivos duplicados
// tipo "feed (1).js", "gemini (2).js" etc.) e o código de verdade deste
// arquivo — o que monta `window.aiAssistant` com os métodos `.ask()`,
// `.updateContext()` e `.getProactiveGreeting()`, chamado por app.js e
// por api/mentor-chat.js — NÃO estava em nenhum lugar. Foi perdido de vez,
// igual aconteceu antes com app-enhancements.js, onboarding-simplificado.js
// e tutorial.js (ver LEIA-ISSO-RELATORIO-DA-BAGUNCA.md).
//
// NÃO SUBA ESTE ARQUIVO ASSIM PRO GITHUB — ele não faz nada. Antes de subir,
// recupere o ai-assistant.js de verdade por uma dessas vias:
//   1) git log --follow -- ai-assistant.js   (se o projeto tem git local)
//   2) Vercel → Deployments → um deploy antigo (de antes do chat quebrar)
//      → baixar o "Source" e pegar o ai-assistant.js de lá
//   3) Repositório no GitHub (github.com/yur1ofc/study-life-control),
//      olhando o arquivo direto por lá — pode ser que só esta pasta local
//      esteja com o arquivo trocado, e o GitHub já esteja certo
