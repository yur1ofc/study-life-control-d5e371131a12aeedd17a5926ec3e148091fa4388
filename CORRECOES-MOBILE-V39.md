SLCampus — correções mobile V39

Arquivos alterados:
- product-shell.js: remove ativação duplicada do menu Mais por click/pointerup/touchend, que podia executar navegação repetida e congelar a interface; impede abrir o menu duas vezes.
- scroll-motion.js / scroll-motion.css: barras horizontais de progresso deixam de ser sobrescritas por uma largura capturada na inicialização. O valor inline definido por cada tela continua sendo a fonte da verdade.
- views.js: identifica os botões rápidos do cabeçalho do Mentor IA para ocultá-los no celular, evitando duplicação com as sugestões do chat.
- style.css: ajustes de espaçamento da Grade Curricular e do menu Mais no celular.

Aplicação: substitua os arquivos correspondentes no repositório, faça commit/push e aguarde o deploy. Depois teste no celular com recarga completa. O ZIP não inclui credenciais nem altera dados do Firebase.
