# Este arquivo existe para que o Vercel PARE de usar o .gitignore
# como filtro do que enviar no deploy (comportamento padrão do
# Vercel CLI quando não há .vercelignore).
#
# Sem este arquivo, o env-config.js (gerado durante o build por
# inject-env.js) era descartado no deploy porque está listado no
# .gitignore — mesmo tendo sido criado com sucesso no build.
#
# NÃO adicione env-config.js aqui.

node_modules/
.git/
.vercel/
*.log
.DS_Store
