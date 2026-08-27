// export-data.js
// Botão "Exportar dados" na barra lateral — baixa um backup em JSON com
// tudo que o usuário tem salvo (matérias, tarefas, provas, sessões etc.).
// Não depende de nenhum serviço externo: é só window.app.data -> arquivo.

(function () {
  'use strict';

  function buildExportButton() {
    const footer = document.querySelector('.sidebar-footer');
    if (!footer || document.getElementById('export-data-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'export-data-btn';
    btn.className = 'btn-whats-now';
    btn.style.cssText = 'margin-top:6px;';
    btn.innerHTML = '<i class="fas fa-download"></i> Exportar meus dados';
    btn.title = 'Baixa um backup em JSON com tudo que você cadastrou';
    btn.addEventListener('click', exportData);

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      footer.insertBefore(btn, logoutBtn);
    } else {
      footer.appendChild(btn);
    }
  }

  function exportData() {
    const app = window.app;
    if (!app || !app.data) {
      window.showToast?.('Nada para exportar ainda — seus dados ainda não carregaram.', 'error');
      return;
    }

    try {
      const payload = {
        exportadoEm: new Date().toISOString(),
        origem: 'SLCampus',
        dados: app.data
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const nomeArquivo = `study-life-control-backup-${new Date().toISOString().slice(0, 10)}.json`;

      const a = document.createElement('a');
      a.href = url;
      a.download = nomeArquivo;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      window.showToast?.('Backup baixado com sucesso!', 'success');
    } catch (error) {
      console.error('[export-data] Erro ao exportar:', error);
      window.showToast?.('Não foi possível exportar os dados. Tente novamente.', 'error');
    }
  }

  // O botão "Exportar meus dados" não é mais injetado na barra lateral:
  // ele duplicava o botão "Exportar todos os dados (JSON)" que já existe em
  // Configurações > Dados (app.exportarDados()). exportData() fica disponível
  // aqui só como utilitário interno, sem criar um botão duplicado.
  window.__exportDataUtil = exportData;
})();
