# 🔐 Guia de Segurança — Study Life Control

## O que foi corrigido (4 fases)

| Fase | Problema | Solução |
|------|----------|---------|
| 1 | API Key exposta no código | Variáveis de ambiente via `window.__ENV` |
| 2 | Sem Content Security Policy | CSP completo no `vercel.json` |
| 3 | Firestore sem limite de payload | Rules com validação de tamanho e schema |
| 4 | Sem rate limiting + console exposto | `security.js` com proteções em camadas |

---

## ✅ Fase 1 — Configurar variáveis de ambiente no Vercel

### Passo a passo:

1. Acesse [vercel.com](https://vercel.com) → seu projeto → **Settings → Environment Variables**

2. Adicione cada variável com o valor do seu Firebase Console
   (`Firebase Console → Project Settings → Your apps → SDK setup`):

   | Nome da variável | Onde encontrar |
   |---|---|
   | `FIREBASE_API_KEY` | `apiKey` |
   | `FIREBASE_AUTH_DOMAIN` | `authDomain` |
   | `FIREBASE_PROJECT_ID` | `projectId` |
   | `FIREBASE_STORAGE_BUCKET` | `storageBucket` |
   | `FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
   | `FIREBASE_APP_ID` | `appId` |

3. Selecione os ambientes: ✅ Production ✅ Preview ✅ Development

4. Adicione no seu `package.json`:
   ```json
   {
     "scripts": {
       "build": "node inject-env.js",
       "vercel-build": "node inject-env.js"
     }
   }
   ```

5. **Revogar a API Key antiga** (importante!):
   - Firebase Console → Project Settings → Service accounts
   - Google Cloud Console → APIs & Services → Credentials → Delete a key antiga
   - Gere uma nova e configure no Vercel

### Para desenvolvimento local:

```bash
cp env-config.example.js env-config.js
# Edite env-config.js com suas credenciais reais
# O arquivo já está no .gitignore — não será commitado
```

---

## ✅ Fase 2 — Content Security Policy

O `vercel.json` agora inclui:

- **CSP** — permite scripts apenas de origens confiáveis (Firebase, Google Fonts, cdnjs)
- **HSTS** — força HTTPS por 2 anos com preload
- **Permissions-Policy** — bloqueia acesso a câmera, microfone, geolocalização e pagamentos
- **X-Frame-Options** — previne clickjacking
- **X-Content-Type-Options** — previne MIME sniffing

Não é necessário nenhuma configuração adicional — o Vercel aplica automaticamente no deploy.

---

## ✅ Fase 3 — Regras do Firestore

### Como fazer deploy das regras:

**Opção A — Firebase Console (mais fácil):**
1. Firebase Console → Firestore Database → Rules
2. Cole o conteúdo do arquivo `firestore.rules`
3. Clique em "Publish"

**Opção B — Firebase CLI:**
```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

### O que foi adicionado:

- Limite de **200 matérias** por catálogo comunitário
- Limite de tamanho em **todos os campos de texto** (120 chars)
- Limite de itens nos arrays do usuário (ex: máx 5.000 sessões)
- **Proteção padrão `deny`** — qualquer coleção não listada é bloqueada por padrão

---

## ✅ Fase 4 — security.js

O arquivo `security.js` é carregado no `<head>` e aplica automaticamente:

### Rate Limiting
| Operação | Limite |
|----------|--------|
| `saveData` (salvar campo) | 60/min |
| `saveAllData` (salvar tudo) | 10/min |
| Perguntas à IA | 40/min |
| `addItem` (adicionar item) | 120/min |

### Proteções adicionais
- **Anti-iframe**: detecta e bloqueia embed em iframes externos
- **Sanitização XSS**: funções `sanitizeString()` e `sanitizeData()` disponíveis globalmente
- **Console silenciado em produção**: `console.log/info/debug` desabilitados; `warn/error` limitados a 200 chars para não vazar dados

---

## 🔄 Checklist de deploy seguro

- [ ] API Keys removidas do código fonte
- [ ] Variáveis configuradas no Vercel
- [ ] API Key antiga revogada no Firebase/GCP
- [ ] `env-config.js` está no `.gitignore`
- [ ] Regras do Firestore publicadas
- [ ] Deploy feito e testado com login Google
- [ ] Verificar no DevTools → Network → Headers que o CSP está presente

