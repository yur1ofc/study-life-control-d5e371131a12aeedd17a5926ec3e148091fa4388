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
        origem: 'Study Life Control',
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

  document.addEventListener('app-ready', buildExportButton);
  document.addEventListener('DOMContentLoaded', () => {
    // Caso app-ready já tenha disparado antes deste script carregar
    if (window.app?.initialized) buildExportButton();
  });
})();
