# SLCampus v14 — reestruturação do produto

Fluxo principal reformulado:

Login → Onboarding → Início → Estudar → Mentor → Biblioteca → Tarefas/Provas → Perfil → Configurações → Mobile

## Alterações
- Nova camada visual `product-shell.js` sem remover os módulos existentes.
- Sidebar reorganizada por intenção: Início, Estudar, Mentor, Organizar, Aprender, Acompanhar e Conta.
- Nova tela Estudar como central de ações, com foco, Mentor, Biblioteca, revisões, próxima avaliação e caminho rápido.
- Nova tela Perfil com resumo da conta e atalhos.
- Títulos de página padronizados.
- Navegação mobile fixa com Início, Estudar, Foco, Mentor e Perfil.
- Mobile com área de conteúdo maior, navegação inferior, safe-area e cards responsivos.
- Login simplificado visualmente.
- Onboarding preservado e envolvido por shell visual consistente.
- Service Worker atualizado para cachear `product-shell.js` e versão `slc-v32`.
- Todos os JS passaram por `node --check`.

## Observação
Esta é uma reestruturação de UX/camada de navegação. Firebase/Vercel, push, Gemini, Storage e dados reais ainda devem ser testados em produção antes de considerar a versão final.
