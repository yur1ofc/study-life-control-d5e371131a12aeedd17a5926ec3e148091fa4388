# Configuração do painel administrativo — SLCampus

O painel já existia no projeto (`admin-ai.html`) e foi ampliado para usuários/presença.

## 1. Variável obrigatória na Vercel

Em **Vercel → Project → Settings → Environment Variables**, crie:

`SLC_ADMIN_EMAILS`

Valor, por exemplo:

`seuemail@gmail.com`

Para liberar mais de uma conta, use vírgulas:

`admin1@gmail.com,admin2@gmail.com`

A conta precisa entrar pelo Google/Firebase e ter o e-mail verificado.

Também é aceito, opcionalmente:

`SLC_ADMIN_UIDS`

com um ou mais UIDs do Firebase separados por vírgula.

## 2. Segurança

- O navegador nunca decide quem é administrador.
- A API valida o token Firebase no servidor.
- O servidor compara o UID/e-mail com a allowlist da Vercel.
- O servidor exige `email_verified=true`.
- Dados de usuários e presença não são lidos diretamente pelo navegador via Firestore.
- A coleção `user_presence` está bloqueada nas Firestore Rules para acesso de cliente.
- A resposta das APIs administrativas usa `Cache-Control: no-store`.
- `admin` e `admin-ai.html` estão fora de indexação por mecanismos de busca.
- Descobrir a URL não concede acesso: sem o token de uma conta autorizada, a API responde 401/403.

## 3. Acesso

Após publicar, abra:

`/admin`

A página usa o mesmo login Google do SLCampus. Uma conta não autorizada pode até carregar a interface estática, mas não consegue carregar nenhum dado administrativo.

## 4. Presença

Usuários autenticados enviam um heartbeat a cada 30 segundos. Um usuário é considerado "ativo agora" enquanto o último heartbeat estiver dentro de 90 segundos. Se a pessoa fechar o navegador sem fazer logout, a presença expira automaticamente.
