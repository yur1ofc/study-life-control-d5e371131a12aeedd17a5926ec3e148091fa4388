# V34 — Correção definitiva da importação de arquivos

- PDF é identificado pelos bytes `%PDF-`, mesmo se o navegador informar MIME incorreto.
- PDF nunca é enviado como imagem ao Groq.
- Imagens são normalizadas para PNG/JPEG/WEBP válidos; imagens grandes/formatos problemáticos são convertidos para JPEG antes do upload.
- Backend valida a assinatura básica da mídia antes de enviar ao modelo de visão.
- Mantém o endpoint `/api/gemini` por compatibilidade, mas usa Groq.
