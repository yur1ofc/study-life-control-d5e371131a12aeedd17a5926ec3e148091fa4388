# Auditoria de interações — SLCampus v15

## Correções aplicadas

- Removida a segunda barra mobile antiga (`#slc-bottom-nav`).
- Mantida uma única barra mobile (`#slc-product-bottom-nav`).
- Barra mobile agora só aparece quando o app está realmente disponível; não cobre login/onboarding.
- Barra mobile é recriada/removida ao redimensionar a janela e após `app-ready`.
- Cada item da barra mobile possui `type="button"`, `aria-label` e estado ativo sincronizado.
- Cache do Service Worker atualizado para `slc-v33`.
- Todos os 100+ arquivos JavaScript foram submetidos a `node --check` nesta versão; nenhuma falha de sintaxe.

## Auditoria estática

Foram procurados:
- `button`, `onclick`, `addEventListener`;
- `data-view`, `data-slcnavigate` e navegação mobile;
- IDs de botões e respectivos handlers;
- renderização dinâmica de botões em `views.js`, `script.js`, `launch-polish.js`, `product-shell.js` e módulos auxiliares.

A maior falha estrutural encontrada nesta rodada foi a existência simultânea das duas barras mobile. Elas podiam se sobrepor e interceptar cliques, produzindo a aparência de vários controles quebrados.

## Limitação

Não é possível afirmar que todos os fluxos Firebase/Gemini externos foram testados em produção neste ambiente. A validação final deve ser feita no Vercel com uma conta de teste, incluindo login, Firestore, Storage, notificações e Gemini.
