# MELHORIAS-V2.md — O que foi adicionado

## Arquivos novos (basta colocar na raiz do projeto)

### 1. `grade-ia-import.js` — Importação de grade por IA
Substitui o fluxo "vá ao ChatGPT → gere JSON → cole aqui" por um modal
onde o usuário arrasta o **PDF ou imagem** do fluxograma direto no site.
A IA (Claude) lê o arquivo e extrai todas as disciplinas automaticamente.

**O que acontece:**
- O botão "Importar grade pronta" na tela de Grade Curricular vira "Importar com IA"
- Um botão novo aparece no setup inicial: "Importar PDF ou imagem com IA"
- Suporte a: PDF, PNG, JPG, WEBP
- Também aceita texto colado (para quem copia do site da faculdade)
- Faz merge inteligente: não duplica disciplinas existentes

**Custo:** zero. Usa o Google Gemini que tem **1.500 usos por dia grátis** sem cartão de crédito. Só precisa de uma conta Google e criar uma chave em aistudio.google.com/apikey.

---

### 2. `onboarding-simplificado.js` — Modo iniciante + checklist
Resolve o problema de novos usuários se sentirem perdidos.

**Modo iniciante (automático para novos usuários):**
- Oculta as seções avançadas do menu (Análise, Grade Curricular avançada, etc.)
- Mostra um badge "Modo iniciante · ver tudo" no topo do menu
- Clicar no badge libera o menu completo permanentemente

**Checklist de primeiros passos:**
- Card no topo do dashboard mostrando 5 passos simples
- Cada passo clicável leva direto para a seção certa
- Barra de progresso visual
- Some automaticamente quando todos os passos são concluídos
- Pode ser dispensado por 7 dias

---

### 3. `dashboard-prioritario.js` — Card "o que fazer agora"
Injeta um card de destaque no topo do dashboard que mostra **a ação mais
urgente** do momento, em ordem de prioridade:

1. Prova hoje ou amanhã → alerta vermelho com botão direto para foco
2. Tarefas em atraso → alerta amarelo
3. Prova na semana → sugestão de revisão
4. Sem matérias cadastradas → convite para configurar
5. Sem sessão hoje → sugestão de estudo

**Extras incluídos:**
- Atalhos de teclado: `Alt+F` foco, `Alt+T` tarefas, `Alt+D` dashboard, `Alt+M` mentor IA
- Botão flutuante "home" em telas avançadas (volta ao dashboard)
- Pode ser dispensado por sessão (botão ✕)

---

## Mudanças em arquivos existentes

### `index.html`
Adicionadas 3 linhas no final do body:
```html
<script src="grade-ia-import.js"></script>
<script src="onboarding-simplificado.js"></script>
<script src="dashboard-prioritario.js"></script>
```

### `env-config.js` e `env-config.example.js`
Adicionado campo `GEMINI_API_KEY` (vazio por padrão).
Para ativar a importação por IA:
1. Acesse https://aistudio.google.com/apikey
2. Crie uma chave gratuita (só conta Google, sem cartão)
3. Cole em `GEMINI_API_KEY` no env-config.js (local)
4. No Vercel: Settings → Environment Variables → `GEMINI_API_KEY`

### `ai-assistant.js`
- Corrigido para usar a chave `window.__ENV.ANTHROPIC_API_KEY`
- Atualizado o modelo para `claude-sonnet-4-6` (mais recente)
- Antes a chamada à API estava sem chave de autenticação (não funcionava)

---

## Como fazer deploy no Vercel (gratuito)

1. Faça push do projeto para um repositório no GitHub
2. Acesse vercel.com → "New Project" → importe o repositório
3. Sem configuração adicional (é HTML/JS puro, sem build)
4. Em Settings → Environment Variables, adicione:
   - `GEMINI_API_KEY` = sua chave do Google AI Studio (grátis)
5. Redeploy → pronto

**Custo total: R$ 0** (Vercel gratuito + Firebase gratuito + Google Gemini gratuito)
