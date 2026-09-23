// SLCampus — integração Telegram: configuração dentro de Configurações +
// caixa de entrada como uma área própria. O token do bot nunca chega ao cliente.
(function(){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const currentUser=()=>window.firebase?.auth?.()?.currentUser;
  async function authFetch(url,options={}){const u=currentUser();if(!u)throw new Error('Faça login novamente.');const id=await u.getIdToken();return fetch(url,{...options,headers:{'Content-Type':'application/json',...(options.headers||{}),Authorization:`Bearer ${id}`}});}
  function appData(){return window.app?.data||{};}
  function setToast(msg,type='info'){window.showToast?.(msg,type);}

  function ensureConfigEntry(){
    const menu=document.querySelector('.config-menu-list');
    if(!menu||menu.querySelector('[data-config-telegram]'))return;
    const b=document.createElement('button');
    b.type='button'; b.className='config-menu-item slc-telegram-config-item'; b.dataset.configTelegram='1';
    b.innerHTML='<span class="config-menu-icon"><i class="fab fa-telegram-plane"></i></span><span class="config-menu-text"><span class="config-menu-label">Telegram</span><span class="config-menu-desc">Conexão e configurações do bot</span></span><i class="fas fa-chevron-right config-menu-arrow"></i>';
    b.addEventListener('click',openConfigModal); menu.appendChild(b);
  }

  function modalShell(){
    document.getElementById('slc-telegram-config-modal')?.remove();
    const m=document.createElement('div'); m.id='slc-telegram-config-modal'; m.className='slc-telegram-modal';
    m.innerHTML='<div class="slc-telegram-modal-backdrop" data-tg-close></div><section class="slc-telegram-modal-card" role="dialog" aria-modal="true" aria-label="Configurações do Telegram"><header><div><span class="slc-eyebrow">CONFIGURAÇÕES</span><h2><i class="fab fa-telegram-plane"></i> Telegram</h2></div><button type="button" class="btn-icon" data-tg-close aria-label="Fechar"><i class="fas fa-times"></i></button></header><div class="slc-telegram-modal-body" id="slc-tg-config-body"></div></section>';
    document.body.appendChild(m); m.querySelectorAll('[data-tg-close]').forEach(x=>x.addEventListener('click',()=>m.remove()));
    return m;
  }

  async function openConfigModal(){
    const m=modalShell(); const body=m.querySelector('#slc-tg-config-body');
    renderConfigBody(body);
  }

  function renderConfigBody(body){
    if(!body)return;
    const t=appData().user?.telegram; const connected=!!t?.chatId;
    body.innerHTML=`<div class="slc-tg-status ${connected?'connected':''}"><div class="slc-tg-status-icon"><i class="fas ${connected?'fa-circle-check':'fa-link'}"></i></div><div><strong>${connected?'Telegram conectado':'Telegram não conectado'}</strong><span>${connected?`@${esc(t.username||'usuário')} · conectado em ${new Date(t.linkedAt||Date.now()).toLocaleDateString('pt-BR')}`:'Conecte o bot para enviar aulas, tarefas, provas, notas, anotações e arquivos.'}</span></div></div>${connected?`<div class="slc-tg-reconnect"><button type="button" class="btn-link" id="tg-reconnect">Reconectar este Telegram</button><button type="button" class="btn-link danger" id="tg-disconnect">Desvincular</button></div>`:`<div class="slc-tg-connect-row"><button type="button" class="btn-primary" id="tg-generate"><i class="fas fa-link"></i> Conectar Telegram</button><span>O código expira em 15 minutos.</span></div>`}<div class="slc-tg-config-help"><strong>Como funciona</strong><p>Depois de conectado, você pode conversar normalmente com o bot. Comandos ainda funcionam, mas o bot também entende mensagens naturais como “tenho prova de cálculo sexta” ou “me lembra de fazer a lista de física amanhã”.</p></div><div id="tg-code-box" class="slc-tg-code-host"></div>`;
    body.querySelector('#tg-generate')?.addEventListener('click',generateCode);
    body.querySelector('#tg-reconnect')?.addEventListener('click',async()=>{if(await disconnect(true))renderConfigBody(body);});
    body.querySelector('#tg-disconnect')?.addEventListener('click',async()=>{if(await disconnect(false))renderConfigBody(body);});
  }

  async function generateCode(){
    const body=document.getElementById('slc-tg-config-body');
    try{
      const r=await authFetch('/api/telegram-link',{method:'POST',body:JSON.stringify({action:'create'})});
      const j=await r.json(); if(!r.ok)throw new Error(j.error||'Falha ao gerar código.');
      const box=body?.querySelector('#tg-code-box');
      if(box){
        box.innerHTML=`<div class="slc-tg-code"><div><span>Envie este comando para <b>@SLCampus_bot</b>:</span><code>/start ${esc(j.code)}</code><small>Expira em 15 minutos.</small></div><button type="button" class="btn-secondary btn-sm" id="tg-copy-code"><i class="fas fa-copy"></i> Copiar comando</button></div>`;
        box.querySelector('#tg-copy-code')?.addEventListener('click',()=>copyText(`/start ${j.code}`));
      }
      setToast('Código criado. Envie o comando ao bot.','success');
    }catch(e){setToast(e.message,'error');}
  }

  async function copyText(value){
    let ok=false;
    try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);ok=true;}}catch(_){/* iPad/Safari pode bloquear clipboard sem contexto seguro */}
    if(!ok){
      const ta=document.createElement('textarea');ta.value=value;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.left='-9999px';ta.style.top='0';document.body.appendChild(ta);ta.focus();ta.select();try{ok=document.execCommand('copy');}catch(_){ok=false}ta.remove();
    }
    setToast(ok?'Comando copiado.':'Não foi possível copiar automaticamente. Toque e segure o comando para copiar.','success');
    return ok;
  }

  async function disconnect(reconnect=false){
    if(!reconnect && !confirm('Desvincular o Telegram deste perfil?'))return false;
    try{const r=await authFetch('/api/telegram-link',{method:'POST',body:JSON.stringify({action:'disconnect'})});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Falha ao desvincular.');if(window.app?.data?.user)window.app.data.user.telegram=null;setToast(reconnect?'Telegram pronto para uma nova conexão.':'Telegram desvinculado.','success');return true;}catch(e){setToast(e.message,'error');return false;}
  }

  async function openFile(fileId){try{const u=currentUser();if(!u)throw new Error('Faça login novamente.');const id=await u.getIdToken();const r=await fetch(`/api/telegram-file?fileId=${encodeURIComponent(fileId)}`,{headers:{Authorization:`Bearer ${id}`}});if(!r.ok)throw new Error('Não foi possível abrir o arquivo.');const blob=await r.blob();const url=URL.createObjectURL(blob);window.open(url,'_blank','noopener');setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(e){setToast(e.message,'error');}}

  function renderInbox(){
    const c=document.getElementById('view-container');if(!c)return;
    const inbox=Array.isArray(appData().telegramInbox)?appData().telegramInbox:[]; const t=appData().user?.telegram;
    c.innerHTML=`<section class="slc-telegram-page"><div class="view-header"><div><span class="slc-eyebrow">CENTRAL TELEGRAM</span><h2><i class="fab fa-telegram-plane"></i> Telegram</h2><p>Mensagens, arquivos e ações recebidas pelo seu bot.</p></div><button type="button" class="btn-secondary" id="tg-open-config"><i class="fas fa-cog"></i> Configurar</button></div><div class="slc-telegram-page-grid"><div class="card"><div class="card-header"><h3><i class="fas fa-bolt"></i> Conexão</h3></div><div class="card-body"><div class="slc-tg-status ${t?.chatId?'connected':''}"><div class="slc-tg-status-icon"><i class="fas ${t?.chatId?'fa-circle-check':'fa-link'}"></i></div><div><strong>${t?.chatId?'Bot conectado':'Bot não conectado'}</strong><span>${t?.chatId?'Envie mensagens para @SLCampus_bot a qualquer momento.':'Abra Configurações → Telegram para conectar.'}</span></div></div></div></div><div class="card"><div class="card-header"><h3><i class="fas fa-inbox"></i> Caixa de entrada <span class="slc-tg-count">${inbox.length}</span></h3></div><div class="card-body slc-tg-inbox">${inbox.length?inbox.slice(0,50).map(x=>`<article class="slc-tg-inbox-item"><div class="slc-tg-inbox-icon"><i class="fas ${x.type==='photo'?'fa-image':x.type==='document'?'fa-file-pdf':'fa-message'}"></i></div><div><strong>${esc(x.fileName||x.materia||x.type||'Mensagem')}</strong><span>${esc(x.text||x.caption||'Arquivo recebido')}</span><small>${new Date(x.receivedAt||Date.now()).toLocaleString('pt-BR')}</small></div>${x.fileId?`<button type="button" class="btn-secondary btn-sm" data-tg-file="${esc(x.fileId)}"><i class="fas fa-eye"></i> Abrir</button>`:''}</article>`).join(''):'<div class="telegram-empty">Nenhuma mensagem ou arquivo recebido ainda.</div>'}</div></div></div><div class="card slc-tg-natural-card"><div class="card-header"><h3><i class="fas fa-wand-magic-sparkles"></i> Mensagem natural</h3></div><div class="card-body"><p>Você não precisa decorar comandos. O bot entende frases como:</p><div class="slc-tg-examples"><code>Tenho aula de Cálculo amanhã das 8 às 10 na sala 12</code><code>Me lembra de fazer a lista de Física sexta</code><code>Tenho prova de Geometria na próxima terça</code><code>Tirei 7,5 em Cálculo na P1 valendo 20%</code></div></div></div></section>`;
    c.querySelector('#tg-open-config')?.addEventListener('click',openConfigModal); c.querySelectorAll('[data-tg-file]').forEach(b=>b.addEventListener('click',()=>openFile(b.dataset.tgFile)));
  }

  function boot(){
    const run=()=>{ensureConfigEntry();}; run();
    const obs=new MutationObserver(run); const root=document.getElementById('view-container'); if(root)obs.observe(root,{childList:true,subtree:true}); document.addEventListener('app-ready',run);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.slctelegram={renderPanel:renderInbox,renderInbox,openConfigModal,generateCode,copyText};
})();
