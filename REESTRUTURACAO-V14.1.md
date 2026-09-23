# SLCampus v14.1 — correção de UX após teste visual

## Problemas corrigidos
- Estudar estava visualmente muito parecido com Início.
- Os CTAs da área de estudo ficavam apertados.
- Existiam duas implementações de barra inferior mobile (`slc-bottom-nav` e `slc-product-bottom-nav`), causando sobreposição.

## Solução
- `Estudar` agora é uma central de execução: iniciar sessão, revisões, materiais, Mentor, próximo estudo, histórico e ferramentas.
- `app.js` passa a reconhecer `estudar` diretamente no switch principal.
- Barra antiga `#slc-bottom-nav` é ocultada; somente `#slc-product-bottom-nav` fica ativa.
- Barra mobile recebeu espaçamento, safe-area, largura mínima e área de toque adequados.
- View container recebe espaço inferior para não ficar atrás da navegação.
- CSS do Estudar foi refeito para desktop, tablet e celular.
- Service worker passou de slc-v31 para slc-v32 para invalidar CSS/JS antigos.
