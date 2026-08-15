// firebase-config.js
// As credenciais são injetadas pelo Vercel via variáveis de ambiente.
// NUNCA commite valores reais aqui. Configure no painel do Vercel:
// Settings → Environment Variables → adicione cada FIREBASE_* abaixo.

const firebaseConfig = {
  apiKey:            window.__ENV?.FIREBASE_API_KEY             || '',
  authDomain:        window.__ENV?.FIREBASE_AUTH_DOMAIN         || '',
  projectId:         window.__ENV?.FIREBASE_PROJECT_ID          || '',
  storageBucket:     window.__ENV?.FIREBASE_STORAGE_BUCKET      || '',
  messagingSenderId: window.__ENV?.FIREBASE_MESSAGING_SENDER_ID || '',
  appId:             window.__ENV?.FIREBASE_APP_ID              || ''
};

// Avisa em desenvolvimento se alguma variável estiver faltando
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  const missing = Object.entries(firebaseConfig).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.warn('[SLC] Firebase: variáveis de ambiente faltando →', missing);
    console.warn('[SLC] Crie env-config.js com window.__ENV = { ... } para desenvolvimento local.');
  }
}

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db   = firebase.firestore();

const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

window.auth           = auth;
window.db             = db;
window.googleProvider = googleProvider;

auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch((error) => {
  console.warn('Não foi possível ativar persistência local de login:', error);
});
