# V37 — histórico SIGAA sem consumo de IA + quota revisada

- Histórico SIGAA com PDF textual é processado primeiro pelo parser determinístico server-side.
- Importação de histórico válida não consome quota de Groq e não depende do Mentor/import quota.
- Falhas reais de uma chamada de IA devolvem a vaga de importação do usuário.
- Default do orçamento interno sobe para 200 chamadas/dia; reserva padrão para importações 40 e limite individual de importações 20. Variáveis de ambiente existentes continuam tendo prioridade.
- Aumento é apenas orçamento interno do SLCampus; não altera limites do provedor.
