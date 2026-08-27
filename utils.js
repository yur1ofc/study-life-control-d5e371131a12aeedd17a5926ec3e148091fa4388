# Como validar em produção

## 1. Firebase Auth
No console do Firebase:
1. Authentication > Sign-in method > Google > Enable.
2. Authentication > Settings > Authorized domains.
3. Adicione `study-life-control.vercel.app` e seu domínio final.

## 2. Publicar as regras
1. Firestore Database > Rules.
2. Cole o conteúdo de `firestore.rules`.
3. Clique em Publish.

## 3. Teste com conta nova
Use uma conta Google que nunca entrou no app.

### Esperado
- Ao entrar, deve abrir a tela de setup.
- Após preencher e iniciar jornada, deve abrir o dashboard.
- Ao criar matéria e aula, os dados devem permanecer após F5.
- Logout deve voltar para a tela de login.
- Novo login deve restaurar os dados.

## 4. Teste de rede
- Abra o site online.
- Desligue a internet: o banner offline deve aparecer.
- Ligue a internet: a mensagem de conexão restabelecida deve aparecer por alguns segundos e sumir.

## 5. Se o Google login falhar
Verifique:
- domínio autorizado no Firebase
- popup bloqueado no navegador
- projeto Firebase correto no arquivo `firebase-config.js`
