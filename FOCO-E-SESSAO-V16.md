# SLCampus — Foco e Sessões v16

## O que mudou
- contador baseado em relógio real (`Date.now()`), não em quantidade de ticks do `setInterval`;
- estado persistido por usuário em `localStorage`;
- troca de aba, bloqueio da tela e recarregamento preservam o tempo transcorrido;
- ao atingir o fim do bloco, o foco entra em **tempo extra** e continua contando como estudo;
- descanso **nunca inicia automaticamente**;
- botão de descanso calcula uma recomendação proporcional ao tempo efetivamente estudado (heurística operacional: 5 min por 25 min, limite 5–20 min);
- ao fim do descanso, o foco também não inicia automaticamente;
- notificação ao terminar foco e ao terminar descanso quando a permissão do navegador está concedida;
- botão para concluir e registrar a sessão com `duracaoReal`;
- sessão programada vinculada é marcada como concluída apenas quando o usuário encerra o estudo, não simplesmente porque o contador chegou a zero;
- matéria vinda de ações como “Estudar próxima prova” é preservada ao abrir o Modo Foco;
- tempo extra continua entrando no cálculo de estudo real;
- revisão automática existente continua sendo chamada ao registrar uma sessão.

## Base de aprendizagem usada para o desenho
O SLCampus não promete que uma técnica fará “todo mundo tirar 10”. A arquitetura prioriza técnicas com evidência mais consistente: prática de recuperação, prática distribuída/espaçada e, quando fizer sentido, interleaving. Revisões de 2021 encontraram benefícios robustos de retrieval practice e de spaced retrieval practice. O desenho de pausas é tratado como ferramenta de autorregulação, não como regra universal: estudos recentes comparando pausas sistemáticas e autorreguladas não mostram uma única duração ótima para todos os alunos.
