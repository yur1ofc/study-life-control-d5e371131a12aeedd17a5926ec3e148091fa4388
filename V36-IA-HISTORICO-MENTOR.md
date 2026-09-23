# V36 — histórico SIGAA + Mentor IA

Correções:
- Importação de histórico SIGAA ganhou parser determinístico de segurança quando a IA não respeita o schema.
- Identifica períodos `YYYY.N`, código, disciplina, carga horária, situação e período atual por `MATR/REC`.
- O histórico continua usando a IA primeiro; o parser só entra como fallback/reconciliação.
- A pergunta aberta “qual matéria devo estudar hoje/agora?” é encaminhada primeiro ao Mentor IA real (Groq), em vez de ser interceptada pela resposta determinística de trilha.
- Console do Mentor registra provider/model/requestId quando a resposta vem do backend.
- Service Worker atualizado para evitar cache da versão anterior do `ai-assistant.js`.
