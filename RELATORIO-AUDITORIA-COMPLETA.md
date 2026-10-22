# SLCampus — relatório de correções da auditoria

> **Nota sobre a base recebida:** o arquivo `RELATORIO-AUDITORIA-COMPLETA.md` citado no prompt não existia no ZIP de entrada. Este documento foi criado durante a rodada para registrar o que foi aplicado e o que continua pendente, usando a lista de auditoria fornecida como referência. Não foi possível comparar com o relatório anterior ausente.

## Resumo

- **Validação estática:** `node --check` passou em 98 arquivos JavaScript do repositório; JSON válido em `vercel.json`, `manifest.json` e `package.json`.
- **Testes de navegador/deploy:** não executados nesta sessão. As regras do Firestore precisam ser publicadas no Console para entrar em vigor.
- **Sem dependências novas** e sem mudanças de modelo do Firestore.

## Fase 1 — críticos

| Achado | Estado | O que foi feito / observação |
|---|---|---|
| 1.1 Leitura pública de `calendar_feeds` | ✅ Código corrigido / 📋 deploy pendente | `allow read: if true` virou `allow get: if true`; comentário esclarece que `list` cai no catch-all negado. Publicar `firestore.rules` no Firebase Console. |
| 1.2 Seletor `content-area` inexistente | ✅ Corrigido | Os cinco pontos dos quatro módulos passaram a usar `view-container`; grep não encontrou `content-area` nos JS/HTML. |
| 1.3 Tela branca após falha de `loadUserData` | ✅ Corrigido | O `catch` de autenticação chama `handleSignedOutUser()` antes do toast. |
| 1.4 Navegação Mais → Perfil | ✅ Corrigido | Adicionado `case 'perfil'` em `app.js` e fallback global para o renderer de perfil do `product-shell.js`. |
| 1.5 Conflito de gravação entre abas/dispositivos | ⚠️ Parcial | `saveData` agora lê o snapshot dentro da transação e recusa gravar array local quando o servidor aparenta ter versão mais recente/maior. A comparação é conservadora e não substitui uma estratégia de sincronização por item; migração de arrays para subcoleções continua pendente. |
| 1.6 Datas UTC em “Meu Dia”/briefing/diário | ⚠️ Parcial | Corrigidos os usos auditados em `ux-improvements.js`, os comparadores de diário em `ai-assistant.js` e a data padrão do histórico de semestres. Outros usos de `toISOString()` que representam timestamps completos foram mantidos intencionalmente. |
| 1.7 Escape XSS nos sinks listados | ⚠️ Parcial | Aplicado escape em vários templates de dashboard/relatórios/importadores, cor de matéria validada em `views.js`, e histórico/briefing agora usam `textContent`/`createTextNode`. Ainda é recomendada uma nova varredura manual de todos os sinks e atributos dinâmicos; não se declara cobertura XSS total. |

## Fase 2 — altos

| Achado | Estado | O que foi feito / observação |
|---|---|---|
| 2.1 Service Worker não cachear `/api/*` | ✅ Corrigido | Bypass para métodos diferentes de GET e caminhos `/api/`; cache atualizado para `slc-v64-audit-fixes`. |
| 2.2 Limpeza de chaves sem UID no logout | ✅ Corrigido | Logout remove `slc-ia-history` e `slc-briefing` além do backup escopado por UID. |
| 2.3 `shared/` vs `Shared/` | ✅ Corrigido | Removido o módulo órfão do HTML/precache e corrigidos os imports de backend para `Shared/`, respeitando o nome real da pasta no Linux. |
| 2.4 Feedback widget | ⚠️ Parcial | `feedback-widget.js` incluído antes de `ux-improvements.js`; listener morto de `btn-relatar-problema` removido. O botão de feedback e a experiência devem ser confirmados no navegador autenticado. Rules da coleção `feedback` foram mantidas. |
| 2.5 Bootstrap após setup | ✅ Corrigido | Serviços compartilhados extraídos para `bootstrapServices()` e chamados tanto em `init()` quanto em `ensurePostSetupReady()`. |
| 2.6 `app-ready` duplicado | ✅ Código corrigido | Introduzido `fireAppReady()` idempotente e trocados os três dispatches conhecidos. A auditoria completa de todos os listeners para efeitos duplicados ainda requer teste de fluxo no navegador. |
| 2.7 Confirmação dupla em exclusões | ✅ Corrigido | Métodos de exclusão aceitam `jaConfirmado`; o modal customizado passa esse argumento. Removido o patch de `window.confirm` que não fazia diferença. Nome de matéria no modal é escapado. |
| 2.8 Feedback de persistência | ⚠️ Parcial | Adicionado toast de falha ao concluir sessão/tarefa e retorno verificado na criação automática de tarefa. Falhas de submit de aula e toasts genéricos em `database.js` ainda precisam de revisão para evitar duplicação. |
| 2.9 Dedupe remove itens iguais com IDs diferentes | ✅ Corrigido | `id` deixou de ser ignorado na assinatura de deduplicação. |
| 2.10 Visual/acessibilidade | ⚠️ Parcial | `launch-polish.css` movido para o head; tema-color alinhado ao manifest; cores do login em tema claro corrigidas onde o seletor foi encontrado; grid responsivo, foco visível, movimento reduzido, alvos mobile, modais com botão acessível, toast com `aria-live`, badge de notificações com teclado e banner offline duplicado removido. `slc-modern.css` não foi linkado para evitar conflitos de cascata; regras seguras foram portadas. A grade horária mobile ainda precisa de validação visual. |
| 2.11 `env-config.js` | ✅ Código / 📋 Git pendente | Já consta no `.gitignore`; comentário reforçado como arquivo gerado. Executar `git rm --cached env-config.js` no repositório Git real, se ainda estiver rastreado. |

## Fase 3 — médios e polish

| Achado | Estado | O que foi feito / observação |
|---|---|---|
| 3.1.1 Verificação de token revogado | ✅ Corrigido | `api/gemini.js`, `api/mentor-chat.js` e autenticação administrativa usam Firebase Admin `verifyIdToken(token, true)`. Requer `FIREBASE_SERVICE_ACCOUNT_KEY` corretamente configurada na Vercel. |
| 3.1.2 Detalhes internos do health endpoint | ✅ Corrigido | Resposta em modo usuário não inclui `lastRunSummary`/`lastRunError`; modo cron mantém diagnóstico operacional. |
| 3.1.3 Código Telegram e tentativas | ⚠️ Parcial | Código passou a ter mais entropia; links existentes têm contador de tentativas inválidas e são removidos ao atingir cinco. Testar fluxo real com Telegram antes de deploy. |
| 3.1.4 Limites do Mentor IA | ✅ Código corrigido | Corpo limitado a 120 KB e `systemInstruction` a 8.000 caracteres. |
| 3.1.5 Dispatch de rotas de API | ✅ Corrigido | Os três dispatchers usam `hasOwnProperty` e validam que o alvo é função. |
| 3.1.6 Exclusão de presença | ✅ Corrigido | Cascata de exclusão tenta remover `user_presence/{uid}`. |
| 3.1.7 `security.js` sem uso | 📋 Pendente | Não foi removido nem conectado às bordas nesta rodada; requer decisão consciente para evitar falsa sensação de proteção. |
| 3.1.8 Comentário de SDK local | ✅ Corrigido | Comentário agora informa que o SDK vem de `gstatic.com`. |
| 3.1.9 Rate limit externo de IA | 📋 Pendente | Não implementado conforme instrução. Recomenda-se KV/Upstash ou serviço equivalente com limites por UID/IP. |
| 3.1.10 CSP sem `unsafe-inline` | 📋 Pendente longo prazo | Mantido por compatibilidade com handlers inline existentes. Migrar para `addEventListener` e nonce antes de remover. |
| 3.2.1–3.2.7 Bugs médios | ⚠️ Parcial | Há correções pontuais, mas guardas, alertas inline do wizard, limites de intervalos e todos os retornos silenciosos de persistência ainda precisam de revisão adicional. O wizard agora mostra erros inline e bloqueia duplo clique em Avançar. |
| 3.2.8–3.2.11 Código morto/duplicatas/timers | 📋 Pendente | Não removidos em lote para reduzir risco de regressão sem testes de execução. Métodos de `grade-calculator.js` foram preservados. |
| 3.2.12 Throttle de erro global | 📋 Pendente | Toasts globais ainda podem se repetir em rajadas; aplicar throttle mantendo `console.error`. |
| 3.3.1–3.3.2 Tema e CSS | ✅ Corrigido | `theme-color` alinhado ao `manifest.json`; `launch-polish.css` no head. |
| 3.3.3 Imagem OG PNG | 📋 Pendente design | Preparar `og:image` PNG 1200×630; SVG atual foi mantido. |
| 3.3.4 Ícones grandes | ⚠️ Parcial | Favicon apontado para `favicon.svg`, que foi inspecionado. Recompressão dos PNGs permanece pendente. |
| 3.3.5 Cores inline do login | ⚠️ Parcial | Algumas cores de baixo contraste do login ainda precisam de revisão contextual para não alterar avisos e textos de outras telas. |
| 3.3.6 Grade horária mobile | 📋 Pendente | Aumentar fonte/padding e validar overflow horizontal em dispositivo real. |
| 3.3.7 Z-index | ⚠️ Parcial | Tokens adicionados e aplicados ao modal principal e bottom-nav; demais z-indexes extremos não foram reescritos em massa. |
| 3.3.8 Duplicata `getContrastColor` | 📋 Pendente | Não removida sem teste de chamadas/escopo. |
| 3.3.9 CSS morto | 📋 Pendente | Não removido sem grep amplo de todos os consumidores e validação visual. |
| 3.3.10 Conflitos de `slc-modern.css` | N/A | A folha não foi carregada; regras pontuais foram portadas para `style.css`. |

## Verificação executada

- `node --check`: **98 arquivos `.js`, 0 erros**.
- JSON: `vercel.json`, `manifest.json` e `package.json` parseados com sucesso.
- Greps: `content-area` = 0 em HTML/JS; `allow read: if true` = 0; `toISOString().slice(0,10)` = 0 em `ux-improvements.js`; sinks `innerHTML` com `item.content`/`resp.replace` = 0; `case 'perfil'` presente; `feedback-widget.js` presente no HTML; `/api/` bypass presente no Service Worker.
- A pasta `Shared/` é a canônica; imports que usavam `shared/` foram corrigidos.
- Não foi executado teste E2E em browser, teste de Firebase real nem deploy.

## Ações manuais antes/depois do deploy

1. Publicar `firestore.rules` no Firebase Console.
2. Confirmar na Vercel as variáveis de ambiente necessárias, especialmente `FIREBASE_SERVICE_ACCOUNT_KEY`, `FIREBASE_API_KEY`, provedores de IA e segredos do Telegram.
3. Se `env-config.js` estiver rastreado no Git, removê-lo do índice com `git rm --cached env-config.js` (não apagar a cópia local usada no desenvolvimento).
4. Gerar e configurar `og:image` PNG 1200×630 e recomprimir os ícones PNG.
5. Implementar rate limit externo de IA (KV/Upstash) e planejar a remoção futura de `unsafe-inline` na CSP.
6. Testar em browser: boot, login, falha de load, wizard, dashboard, Mais → Perfil, exclusão com uma confirmação, modo offline/banner único, feedback e vinculação Telegram.
7. Concluir os itens marcados ⚠️/📋 acima antes de considerar a auditoria totalmente encerrada.
