# V33 — correções pós-teste

## Corrigido
- Importação de PDF/grade não bloqueia mais no limite artificial de 90 KB.
- PDFs de texto são extraídos até 64 mil caracteres e divididos em blocos de ~10 mil caracteres quando necessário.
- Cada bloco é processado em JSON mode pelo Groq e os resultados são mesclados no servidor.
- A mesma rota `/api/gemini` continua compatível com Grade Curricular e Grade Horária.
- A migração de histórico não quebra contas novas quando `app.data` ainda não foi hidratado.
- Importação agora valida JSON no servidor antes de devolver ao navegador.

## Deploy
Substitua apenas os arquivos do ZIP no projeto e faça um novo deploy. Nenhuma variável de ambiente nova é necessária.
