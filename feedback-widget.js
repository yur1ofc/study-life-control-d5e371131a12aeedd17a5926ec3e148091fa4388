// feedback-widget.js
// Formulário "Sugestão / Bug / Elogio" — salva a mensagem na coleção
// "feedback" do Firestore (regra correspondente em firestore.rules).
// Não depende de nenhum serviço de e-mail externo.
// Para ver os feedbacks: Firebase Console → Firestore Database → feedback.
//
// Não cria um botão flutuante próprio — expõe window.openFeedbackModal(),
// chamado a partir do menu "+" (quick add) que já existe em
// ux-improvements.js, pra não empilhar mais um botão fixo na tela.

(function () {
  'use strict';

  const TYPES = [
    { id: 'bug', label: '🐞 Bug', color: '#ef4444' },
    { id: 'sugestao', label: '💡 Sugestão', color: '#3b82f6' },
    { id: 'elogio', label: '❤️ Elogio', color: '#16a34a' }
  ];

  let selectedType = 'sugestao';

  function openModal() {
    document.getElementById('feedback-modal')?.remove();
    selectedType = 'sugestao';

    const modal = document.createElement('div');
    modal.id = 'feedback-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:1rem;';

    modal.innerHTML = `
      <div style="background:var(--bg-secondary,#fff);color:var(--text-primary,#1e293b);border-radius:16px;width:100%;max-width:420px;padding:1.5rem;box-shadow:0 20px 50px rgba(0,0,0,.3);">
        <h3 style="margin:0 0 4px;font-size:1.05rem;">O que você quer nos dizer?</h3>
        <p style="margin:0 0 14px;font-size:.8rem;color:var(--text-tertiary,#64748b);">Sua mensagem vai direto pra quem cuida do site.</p>
        <div id="fb-type-group" style="display:flex;gap:8px;margin-bottom:14px;">
          ${TYPES.map(t => `<button type="button" class="fb-type-btn" data-type="${t.id}" style="flex:1;padding:.5rem;border-radius:8px;border:1.5px solid ${t.id === selectedType ? t.color : 'var(--border,#e2e8f0)'};background:${t.id === selectedType ? t.color + '22' : 'transparent'};color:var(--text-primary,#1e293b);cursor:pointer;font-size:.8rem;">${t.label}</button>`).join('')}
        </div>
        <textarea id="fb-text" rows="4" placeholder="Conte com detalhes..." style="width:100%;box-sizing:border-box;border:1px solid var(--border,#e2e8f0);border-radius:8px;padding:.65rem;font-size:.85rem;font-family:inherit;resize:vertical;outline:none;background:var(--bg-primary,#f8fafc);color:inherit;"></textarea>
        <div id="fb-status" style="display:none;margin-top:10px;font-size:.8rem;"></div>
        <div style="display:flex;gap:8px;margin-top:14px;">
          <button id="fb-cancel" style="flex:1;padding:.6rem;border-radius:8px;border:1px solid var(--border,#e2e8f0);background:transparent;color:inherit;cursor:pointer;">Cancelar</button>
          <button id="fb-send" style="flex:2;padding:.6rem;border-radius:8px;border:none;background:#4f46e5;color:#fff;font-weight:600;cursor:pointer;">Enviar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    modal.querySelectorAll('.fb-type-btn').forEach(b => {
      b.addEventListener('click', () => {
        selectedType = b.dataset.type;
        modal.querySelectorAll('.fb-type-btn').forEach(x => {
          const t = TYPES.find(tt => tt.id === x.dataset.type);
          const on = x.dataset.type === selectedType;
          x.style.border = `1.5px solid ${on ? t.color : 'var(--border,#e2e8f0)'}`;
          x.style.background = on ? t.color + '22' : 'transparent';
        });
      });
    });

    document.getElementById('fb-cancel').addEventListener('click', () => modal.remove());
    document.getElementById('fb-send').addEventListener('click', sendFeedback);
  }

  async function sendFeedback() {
    const modal = document.getElementById('feedback-modal');
    const textEl = document.getElementById('fb-text');
    const statusEl = document.getElementById('fb-status');
    const sendBtn = document.getElementById('fb-send');
    const mensagem = textEl.value.trim();

    if (!mensagem) {
      textEl.focus();
      return;
    }

    const user = window.authService?.getCurrentUser?.() || window.auth?.currentUser;
    if (!user) {
      statusEl.style.display = 'block';
      statusEl.style.color = '#ef4444';
      statusEl.textContent = 'Você precisa estar logado para enviar.';
      return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = 'Enviando...';

    try {
      await window.db.collection('feedback').add({
        tipo: selectedType,
        mensagem: mensagem.slice(0, 2000),
        uid: user.uid,
        pagina: window.app?.currentView || location.hash || '',
        criadoEm: new Date().toISOString()
      });

      statusEl.style.display = 'block';
      statusEl.style.color = '#16a34a';
      statusEl.textContent = 'Obrigado! Sua mensagem foi enviada. 🙌';
      window.showToast?.('Feedback enviado, obrigado!', 'success');

      setTimeout(() => modal?.remove(), 1400);
    } catch (error) {
      console.error('[feedback-widget] Erro ao enviar:', error);
      statusEl.style.display = 'block';
      statusEl.style.color = '#ef4444';
      statusEl.textContent = 'Não foi possível enviar agora. Tente de novo em instantes.';
      sendBtn.disabled = false;
      sendBtn.textContent = 'Enviar';
    }
  }

  window.openFeedbackModal = openModal;
})();
