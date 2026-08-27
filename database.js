# Como usar

1. Coloque `curriculum-catalog.js` na raiz do projeto.
2. Adicione esta linha **antes do fechamento do `</body>`** no `index.html`:

```html
<script src="curriculum-catalog.js"></script>
```

O que isso adiciona:
- importação de grade por faculdade + curso
- catálogo comunitário salvo no Firestore
- compartilhamento da grade atual para fortalecer o catálogo
- importação por texto colado de PDF/site/fluxograma
- importação automática no setup quando já existir catálogo para o curso

Observação:
- esse arquivo foi feito para rodar **por cima** do projeto atual, sem quebrar o que já funciona.
- ele usa a coleção `community_catalogs` e `community_catalog_submissions` no Firestore.
