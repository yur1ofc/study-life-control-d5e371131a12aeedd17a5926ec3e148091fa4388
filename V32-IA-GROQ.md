# V32 — AI Core / Groq

- Mentor e importação deixam de chamar o Google Gemini.
- Texto: `openai/gpt-oss-120b`; fallback textual: `openai/gpt-oss-20b`.
- Imagens: `qwen/qwen3.8-27b`.
- PDFs: texto extraído no servidor com `pdf-parse` e enviado ao modelo textual.
- Chave: `GROQ_API_KEY` somente no Vercel.
- `/api/mentor-chat` e `/api/gemini` são mantidos como endpoints compatíveis para não quebrar o front-end.
- Retry curto para 429/5xx, timeout e limites internos server-side.
- Service Worker atualizado para `slc-v47-ai-groq`.
