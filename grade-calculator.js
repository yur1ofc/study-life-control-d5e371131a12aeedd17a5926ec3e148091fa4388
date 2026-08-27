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

const missingFirebaseKeys = Object.entries(firebaseConfig).filter(([, v]) => !v).map(([k]) => k);

if (missingFirebaseKeys.length) {
  // Isso acontece quando window.__ENV não foi carregado (env-config.js ausente
  // em produção, ou build do Vercel não rodou "node inject-env.js"). Em vez de
  // deixar o Firebase estourar um erro confuso ("auth/invalid-api-key") e
  // quebrar todos os scripts seguintes com "auth is not defined", mostramos
  // um aviso claro na tela e criamos objetos "vazios" para não travar o resto.
  console.error('[SLC] Firebase NÃO inicializado — variáveis de ambiente ausentes:', missingFirebaseKeys.join(', '));
  console.error('[SLC] Configure as variáveis em Vercel → Settings → Environment Variables e garanta que o Build Command rode "node inject-env.js" (veja vercel.json).');

  document.addEventListener('DOMContentLoaded', () => {
    const banner = document.createElement('div');
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#b91c1c;color:#fff;padding:14px 18px;font:600 14px/1.4 system-ui,sans-serif;text-align:center;';
    banner.textContent = 'Erro de configuração: as credenciais do Firebase não foram carregadas. Verifique as variáveis de ambiente no Vercel e o build (env-config.js). Detalhes no console (F12).';
    document.body.prepend(banner);
  });

  const noop = () => {};
  const brokenAuth = {
    onAuthStateChanged: (cb) => { try { cb(null); } catch (_) {} return noop; },
    signInWithPopup: () => Promise.reject(new Error('Firebase não configurado.')),
    signOut: () => Promise.resolve(),
    setPersistence: () => Promise.resolve(),
    currentUser: null
  };
  const brokenDb = new Proxy({}, { get: () => () => brokenDb });

  window.auth = brokenAuth;
  window.db = brokenDb;
  window.googleProvider = {};
} else {
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
}
