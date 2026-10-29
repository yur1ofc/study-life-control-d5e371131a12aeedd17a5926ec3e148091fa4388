// Proxy autenticado para arquivos recebidos pelo Telegram. Não expõe o bot token ao cliente.
const admin=require('firebase-admin');
let app;
function init(){if(app)return app;const raw=process.env.FIREBASE_SERVICE_ACCOUNT_KEY;if(!raw)throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY não configurada.');const service=JSON.parse(Buffer.from(raw,'base64').toString('utf8'));app=admin.apps.length?admin.app():admin.initializeApp({credential:admin.credential.cert(service)});return app;}
function bearer(req){const h=req.headers.authorization||'';return h.startsWith('Bearer ')?h.slice(7):'';}

// Só estes tipos podem ser abertos inline no navegador. Qualquer outro
// (HTML, SVG, executável, etc.) é forçado a download como octet-stream.
const SAFE_INLINE_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
]);

function safeFileName(name) {
  return String(name || 'arquivo').replace(/[^\w. -]/g, '_').slice(0, 120) || 'arquivo';
}

module.exports=async function(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Método não permitido.'});
  try{
    const token=bearer(req);
    if(!token)return res.status(401).end();
    const decoded=await init().auth().verifyIdToken(token, true);
    const fileId=String(req.query.fileId||'');
    if(!fileId)return res.status(400).json({error:'fileId ausente.'});
    const snap=await admin.firestore().collection('users').doc(decoded.uid).get();
    const data=snap.data()||{};
    const allowed=(data.telegramInbox||[]).find(x=>x.fileId===fileId);
    if(!allowed)return res.status(403).json({error:'Arquivo não pertence a esta conta.'});
    const tg=process.env.TELEGRAM_BOT_TOKEN;
    if(!tg)return res.status(503).json({error:'Bot Telegram não configurado.'});
    const r=await fetch(`https://api.telegram.org/bot${tg}/getFile?file_id=${encodeURIComponent(fileId)}`);
    const j=await r.json();
    if(!j.ok)throw new Error(j.description||'Arquivo não encontrado no Telegram.');
    const file=await fetch(`https://api.telegram.org/file/bot${tg}/${j.result.file_path}`);
    if(!file.ok)throw new Error('Não foi possível baixar o arquivo do Telegram.');

    const declared=String(allowed.mimeType||'').toLowerCase().split(';')[0].trim();
    const mime=SAFE_INLINE_MIME.has(declared) ? declared : 'application/octet-stream';
    const disposition=SAFE_INLINE_MIME.has(declared) ? 'inline' : 'attachment';

    res.statusCode=200;
    res.setHeader('Content-Type', mime);
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");
    res.setHeader('Content-Disposition',`${disposition}; filename="${safeFileName(allowed.fileName)}"`);
    res.setHeader('Cache-Control','private, max-age=300');
    const buf=Buffer.from(await file.arrayBuffer());
    return res.end(buf);
  }catch(e){
    console.error('[telegram-file]',e);
    return res.status(500).json({error:'Falha ao abrir arquivo.'});
  }
};
