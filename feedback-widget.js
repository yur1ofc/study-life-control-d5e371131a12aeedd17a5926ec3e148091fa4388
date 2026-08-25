// feedback-widget.js
// Formulário "Sugestão / Bug / Elogio" — salva a mensagem na coleção
// "feedback" do Firestore (regra correspondente em firestore.rules).
// Não depende de nenhum serviço de e-mail externo.
// Para ver os feedbacks: Firebase Console → Firestore Database → feedback.
// (a leitura é bloqueada nas regras — só dá pra ver ali, direto com sua
// conta de dono do projeto; o app nunca lê essa coleção de volta)
//
// Tem um botão fixo próprio (canto inferior esquerdo, espelhando o "+" de
// quick-add que fica no canto direito) e, uma única vez por usuário, depois
// de um uso real do app, mostra um convite discreto pra aumentar a chance
// de a pessoa realmente mandar feedback.

(function () {
  'use strict';

  const TYPES = [
    { id: 'bug', label: '🐞 Bug', color: '#ef4444' },
    { id: 'sugestao', label: '💡 Sugestão', color: '#3b82f6' },
    { id: 'elogio', label: '❤️ Elogio', color: '#16a34a' }
  ];

  let selectedType = 'sugestao';

  const SENT_KEY = 'slc_feedback_sent_v1';
  const NUDGE_SHOWN_KEY = 'slc_feedback_nudge_shown_v1';
  const NUDGE_MIN_ACOES = 3; // sessões/tarefas/provas concluídas antes de convidar

  function openModal(origem) {
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
    modal.dataset.origem = origem || 'botao';
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
        origem: modal?.dataset.origem || 'botao',
        criadoEm: new Date().toISOString()
      });

      try { localStorage.setItem(SENT_KEY, '1'); } catch (_) {}
      removeNudge();

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

  /* ─── Botão fixo dedicado (canto inferior esquerdo) ────────────────── */
  function isDashboardVisible() {
    const dash = document.getElementById('main-dashboard');
    const login = document.getElementById('login-screen');
    const setup = document.getElementById('setup-screen');
    const dashVisible = !!dash && getComputedStyle(dash).display !== 'none';
    const loginVisible = !!login && getComputedStyle(login).display !== 'none';
    const setupVisible = !!setup && getComputedStyle(setup).display !== 'none';
    return dashVisible && !loginVisible && !setupVisible;
  }

  function injectFeedbackButton() {
    if (document.getElementById('slc-feedback-btn')) return;
    if (!isDashboardVisible()) return;

    const btn = document.createElement('button');
    btn.id = 'slc-feedback-btn';
    btn.innerHTML = '<i class="fas fa-comment-dots"></i><span>Feedback</span>';
    btn.setAttribute('title', 'Mandar sugestão, bug ou elogio');
    btn.style.cssText = `
      position:fixed;bottom:20px;left:20px;z-index:997;
      display:flex;align-items:center;gap:7px;
      padding:10px 16px 10px 14px;border-radius:999px;border:none;
      background:var(--bg-secondary);color:var(--text-primary);
      border:1.5px solid var(--border);
      font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;
      box-shadow:0 8px 20px rgba(0,0,0,.18);
      transition:transform .2s,box-shadow .2s,border-color .2s;
    `;
    btn.querySelector('i').style.cssText = 'color:#4f46e5;font-size:15px;';
    btn.onmouseover = () => { btn.style.transform = 'scale(1.05)'; btn.style.borderColor = '#4f46e5'; };
    btn.onmouseout  = () => { btn.style.transform = 'scale(1)'; btn.style.borderColor = 'var(--border)'; };
    btn.onclick = () => { removeNudge(); openModal('botao_fixo'); };
    document.body.appendChild(btn);
  }

  /* ─── Convite contextual (uma vez só, depois de uso real) ──────────── */
  function contarAcoesConcluidas() {
    const d = window.app?.data;
    if (!d) return 0;
    const sessoes = (d.sessions || []).filter(s => s.concluida).length;
    const tarefas = (d.tasks || []).filter(t => t.concluida).length;
    const provas  = (d.exams || []).filter(e => e.concluida).length;
    return sessoes + tarefas + provas;
  }

  function removeNudge() {
    document.getElementById('slc-feedback-nudge')?.remove();
  }

  function talvezMostrarNudge() {
    try {
      if (localStorage.getItem(SENT_KEY) === '1') return;
      if (localStorage.getItem(NUDGE_SHOWN_KEY) === '1') return;
    } catch (_) { return; }
    if (!isDashboardVisible()) return;
    if (document.getElementById('slc-feedback-nudge')) return;
    if (contarAcoesConcluidas() < NUDGE_MIN_ACOES) return;

    try { localStorage.setItem(NUDGE_SHOWN_KEY, '1'); } catch (_) {}

    const nudge = document.createElement('div');
    nudge.id = 'slc-feedback-nudge';
    nudge.style.cssText = `
      position:fixed;bottom:70px;left:20px;z-index:998;max-width:250px;
      background:var(--bg-secondary);border:1px solid var(--border);
      border-radius:12px;padding:12px 14px;box-shadow:0 10px 26px rgba(0,0,0,.22);
      font-size:12.5px;color:var(--text-primary);
      animation:slcFadeUp .25s ease;
    `;
    nudge.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:6px;margin-bottom:6px;">
        <strong style="font-size:12.5px;">Como está sendo usar o SLC? 👋</strong>
        <span id="slc-nudge-close" style="cursor:pointer;color:var(--text-tertiary);line-height:1;">✕</span>
      </div>
      <p style="margin:0 0 10px;color:var(--text-secondary);">Meio minuto pra contar o que tá bom ou o que falta ajuda muito.</p>
      <button id="slc-nudge-cta" style="width:100%;padding:7px;border:none;border-radius:8px;background:#4f46e5;color:#fff;font-weight:600;font-size:12.5px;cursor:pointer;">Dar feedback</button>
    `;
    document.body.appendChild(nudge);

    if (!document.getElementById('slc-fadeup-style')) {
      const style = document.createElement('style');
      style.id = 'slc-fadeup-style';
      style.textContent = '@keyframes slcFadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}';
      document.head.appendChild(style);
    }

    document.getElementById('slc-nudge-close').onclick = removeNudge;
    document.getElementById('slc-nudge-cta').onclick = () => { removeNudge(); openModal('nudge'); };
    setTimeout(removeNudge, 15000);
  }

  window.openFeedbackModal = openModal;
  window.SLCFeedback = { injectFeedbackButton, talvezMostrarNudge };
})();
