// SLCampus — diagnóstico e teste das notificações push.
(function(){
  'use strict';
  async function authHeaders(){const u=window.firebase?.auth?.()?.currentUser;if(!u)throw new Error('Faça login novamente.');return {Authorization:`Bearer ${await u.getIdToken()}`};}
  async function health(){
    const box=document.getElementById('slc-notification-health');if(!box)return;
    try{const r=await fetch('/api/notification-health',{headers:await authHeaders()});const j=await r.json();if(!r.ok)throw new Error(j.error||'Falha');const age=j.minutesSinceRun==null?'nunca':`${j.minutesSinceRun} min atrás`;const status=j.lastRunAt&&j.minutesSinceRun<=15?'ok':j.lastRunAt&&j.minutesSinceRun<=60?'warn':'bad';box.innerHTML=`<div class="slc-notif-health ${status}"><i class="fas ${status==='ok'?'fa-circle-check':status==='warn'?'fa-triangle-exclamation':'fa-circle-xmark'}"></i><div><strong>Agendador: ${status==='ok'?'funcionando':status==='warn'?'atrasado':'sem execução recente'}</strong><span>Última execução: ${age} · ${j.subscriptions||0} dispositivo(s) registrado(s)</span></div></div>`;}catch(e){box.innerHTML=`<div class="slc-notif-health bad"><i class="fas fa-circle-xmark"></i><div><strong>Não foi possível verificar o servidor</strong><span>${e.message}</span></div></div>`;}
  }
  function inject(){
    const host=document.getElementById('config-push-enabled')?.closest('.config-item');if(!host||document.getElementById('slc-notification-tools'))return;
    const wrap=document.createElement('div');wrap.id='slc-notification-tools';wrap.innerHTML=`<div id="slc-notification-health"></div><div class="slc-notif-tools"><button class="btn-secondary" id="slc-test-push"><i class="fas fa-paper-plane"></i> Enviar teste agora</button><button class="btn-secondary" id="slc-refresh-push-health"><i class="fas fa-rotate"></i> Verificar servidor</button></div><p class="slc-notif-explain">O SLCampus agora recupera assinaturas que forem renovadas pelo navegador e não marca um lembrete como entregue quando houve falha temporária. Se o agendador parar, esta área mostra o problema.</p>`;
    host.parentNode?.insertBefore(wrap,host.nextSibling);document.getElementById('slc-test-push').addEventListener('click',async()=>{try{await window.pushNotifications?.testNotification();window.showToast?.('Teste enviado.','success');}catch(e){window.showToast?.(e.message,'error');}});document.getElementById('slc-refresh-push-health').addEventListener('click',health);health();
  }
  function boot(){inject();const obs=new MutationObserver(inject);const root=document.getElementById('view-container');if(root)obs.observe(root,{childList:true,subtree:true});document.addEventListener('app-ready',inject);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
