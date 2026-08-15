# Checklist de deploy público - Study Life Control

## Firebase
- [ ] Firestore Rules publicadas usando o arquivo `firestore.rules`
- [ ] Authentication > Sign-in method > Google habilitado
- [ ] Authentication > Settings > Authorized domains contém:
  - [ ] `study-life-control.vercel.app`
  - [ ] seu domínio final personalizado
  - [ ] `localhost` para testes locais
- [ ] Firestore Database criado em modo produção

## Vercel
- [ ] Repositório conectado na Vercel
- [ ] Projeto configurado como site estático
- [ ] Deploy sem erro no build/output
- [ ] HTTPS ativo no domínio final
- [ ] Cache limpo após publicar nova versão

## Fluxo funcional
- [ ] Login com conta Google nova
- [ ] Setup inicial salva nome/curso/universidade
- [ ] Criar matéria
- [ ] Criar aula
- [ ] Recarregar a página e conferir persistência
- [ ] Sair da conta
- [ ] Entrar novamente e conferir dados
- [ ] Teste offline: abrir, desligar internet, navegar, religar internet

## Qualidade visual
- [ ] Banner de conexão aparece só quando necessário
- [ ] Mobile abre sidebar corretamente
- [ ] Dashboard não quebra em 360px de largura
- [ ] PWA pode ser instalada
