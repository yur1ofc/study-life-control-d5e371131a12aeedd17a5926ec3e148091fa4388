# V35 — correção da extração da grade curricular

Corrige um caso em que o PDF era aceito pelo endpoint, mas a IA retornava `disciplinas: []`.

Alterações:
- normalização do texto extraído de PDF;
- tratamento de quebras de linha/hifenização comuns em PDFs acadêmicos;
- segunda tentativa automática quando a primeira extração não encontra disciplinas;
- segunda tentativa usa prompt específico para fluxogramas/tabelas e GPT-OSS 120B com reasoning médio;
- preserva o endpoint `/api/gemini` por compatibilidade;
- inclui no meta do endpoint a quantidade de caracteres extraídos para diagnóstico.
