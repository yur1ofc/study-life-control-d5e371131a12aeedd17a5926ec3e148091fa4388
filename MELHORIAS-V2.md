# O que aconteceu com os arquivos

Quase **todo** o projeto estava com o conteúdo trocado de arquivo — não só o `improvements.js`
que foi parar no lugar do `inject-env.js`. No zip que você mandou, dezenas de arquivos tinham por
dentro o código de outro arquivo (cada um geralmente com o comentário `// nome-do-arquivo-certo.js`
bem no topo, o que ajudou a rastrear tudo).

Eu abri cada arquivo, li o cabeçalho/conteúdo real, e recoloquei cada código no arquivo com o nome
certo. Resultado: **53 de 56 arquivos foram recuperados corretamente** (validei todos os `.json` e
`.xml/.svg`, e rodei `node --check` em todos os `.js` — nenhum erro de sintaxe).

## Os 3 arquivos que eu NÃO consegui recuperar

O conteúdo original de:
- `app-enhancements.js`
- `onboarding-simplificado.js`
- `tutorial.js`

**não estava em nenhum lugar do zip** — parece que foi perdido de vez (sobrescrito) durante a
bagunça, não só movido de lugar. Deixei esses 3 arquivos com um comentário de aviso no lugar do
conteúdo, pra você não usar sem perceber.

Como recuperar esses 3:
- Se você usa Git/GitHub para esse projeto: `git log` / `git checkout` numa versão anterior desses
  3 arquivos específicos.
- Se não usa Git: procure um backup local mais antigo, ou no histórico de "Versões" do Vercel
  (Deployments antigos) — dá pra baixar o código-fonte de um deploy anterior que estava funcionando.

## Bônus

Achei um pedacinho de documentação (instruções de uso do `curriculum-catalog.js`) que não pertencia
a nenhum arquivo do projeto — salvei separado como `CURRICULUM-CATALOG-USO.md`, caso seja útil.

## Recomendação

Depois de conferir, eu apagaria os arquivos `download`, `download (1)` e o
`study-life-control-atualizacao-grade-ia.zip` da raiz do projeto — são sobras/duplicatas que não
fazem parte do site.
