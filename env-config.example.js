// env-config.example.js
// RENOMEIE para env-config.js para desenvolvimento local.
// NUNCA commite o env-config.js real — ele já está no .gitignore.
// No Vercel, configure as mesmas variáveis em: Settings → Environment Variables

window.__ENV = {
  FIREBASE_API_KEY:             'AIzaSy...',           // Cole sua API Key aqui
  FIREBASE_AUTH_DOMAIN:         'seu-projeto.firebaseapp.com',
  FIREBASE_PROJECT_ID:          'seu-projeto',
  FIREBASE_STORAGE_BUCKET:      'seu-projeto.appspot.com',
  FIREBASE_MESSAGING_SENDER_ID: '000000000000',
  FIREBASE_APP_ID:              '1:000000000000:web:xxxx'
};

// A chave do Gemini (importação/atualização de grade com IA) NÃO vai aqui.
// Ela é usada só no servidor: Vercel → Settings → Environment Variables → GEMINI_API_KEY
// (gratuita em https://aistudio.google.com/apikey). Veja api/gemini.js.
