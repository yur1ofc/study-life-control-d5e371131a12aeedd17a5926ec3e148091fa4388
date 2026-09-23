// account-security.js — exclusão definitiva de conta com reautenticação
(function(){
  'use strict';
  function show(message,onConfirm){
    if(window.SLCConfirm?.show) return window.SLCConfirm.show(message).then(ok=>{if(ok)onConfirm();});
    if(confirm(message)) onConfirm();
  }
  async function deleteAccount(){
    const user=window.auth?.currentUser;
    if(!user) throw new Error('Sessão expirada.');
    // Para Google, exige reautenticação recente antes da operação destrutiva.
    const provider=new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({prompt:'select_account'});
    await user.reauthenticateWithPopup(provider);
    const token=await user.getIdToken(true);
    const res=await fetch('/api/delete-account.js',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({})});
    const data=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error||'Falha ao excluir a conta.');
    await user.delete().catch(()=>{});
    window.showToast?.('Conta excluída.','success');
    setTimeout(()=>location.reload(),500);
  }
  async function requestDeletion(btn){
    const typed=prompt('Para confirmar, digite EXCLUIR.');
    if(typed!=='EXCLUIR') { window.showToast?.('Exclusão cancelada.','info'); return; }
    show('Esta ação é permanente: sua conta, dados, materiais e arquivos privados serão excluídos. Não será possível desfazer.',async()=>{
      btn.disabled=true;
      try{await deleteAccount();}catch(e){console.error(e);window.showToast?.(e.message||'Não foi possível excluir a conta.','error');btn.disabled=false;}
    });
  }
  window.AccountSecurity={deleteAccount};
  document.addEventListener('click',e=>{
    const btn=e.target.closest('#btn-delete-account');
    if(btn){ e.preventDefault(); requestDeletion(btn); }
  });
})();
