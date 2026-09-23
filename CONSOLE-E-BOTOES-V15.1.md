# V15.1 — correção do console e navegação Estudar

## Correções
- Removido o patch de `window.app.loadView.bind(...)` do product-shell.
- A camada de produto agora envolve `StudyLifeControl.prototype.loadView`, que existe antes da instância ser criada.
- A navegação possui fallback para o método de protótipo caso alguma camada legada substitua/remova temporariamente `app.loadView` na instância.
- Os botões `[data-slcnavigate]` continuam usando um único mecanismo de navegação.
- Navegação mobile e estado ativo são atualizados após cada troca de view.
- Cache do Service Worker atualizado para `slc-v34`.

## Console
As mensagens `contentscript.js` sobre `MaxListenersExceededWarning` e `ObjectMultiplex - orphaned data` são provenientes de uma extensão do navegador, não do código do SLCampus.

O aviso do Firebase sobre `enableIndexedDbPersistence()` é um aviso de API futura do SDK 10.8, não uma exceção que interrompe a aplicação. A persistência offline continua sendo usada deliberadamente nesta versão.
