// grade-structure-modal.js
// Implementa app.addGradeStructureItem() e app.saveGradeStructure(),
// chamados pelo modal #modal-grade-structure no index.html. Essas duas
// funções não existiam em lugar nenhum do código — clicar nos botões
// do modal gerava um erro no console e não fazia nada.
//
// Observação: no index.html atual, nada abre esse modal ainda (não há
// nenhum botão com display='block' para #modal-grade-structure). Esta
// função de abertura (abrirModalEstruturaNotas) está pronta para ser
// chamada de algum botão futuro na tela de Notas.

(function () {
  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  ready(() => {
    document.addEventListener('app-ready', patch);
    if (window.app?.initialized) patch();
  });

  function patch() {
    if (!window.app || window.app.__gradeStructurePatched) return;
    window.app.__gradeStructurePatched = true;

    const proto = Object.getPrototypeOf(window.app);

    proto.abrirModalEstruturaNotas = function (materiaNome) {
      this._materiaEstruturaAtual = materiaNome;
      const materia = (this.data.subjects || []).find(s => s.nome === materiaNome);
      this._estruturaTemp = (materia?.estruturaNotas || []).map(item => ({ ...item }));
      const materiaLabel = document.getElementById('grade-structure-materia');
      if (materiaLabel) materiaLabel.textContent = materiaNome || '';
      this.renderGradeStructureItems();
      const modal = document.getElementById('modal-grade-structure');
      if (modal) modal.style.display = 'flex';
    };

    proto.renderGradeStructureItems = function () {
      const container = document.getElementById('grade-structure-items');
      if (!container) return;
      const items = this._estruturaTemp || [];

      container.innerHTML = items.map((item, i) => `
        <div class="grade-structure-item" style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
          <input type="text" value="${escapeHtml(item.nome || '')}" placeholder="Nome (ex: Prova 1)" data-idx="${i}" data-field="nome" style="flex:2;">
          <input type="number" value="${item.peso ?? ''}" placeholder="Peso (%)" data-idx="${i}" data-field="peso" style="flex:1;">
          <button type="button" class="btn-remove" data-idx="${i}" aria-label="Remover"><i class="fas fa-times"></i></button>
        </div>
      `).join('') || '<p style="color:#94a3b8;">Nenhuma avaliação adicionada ainda.</p>';

      container.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', (e) => {
          const idx = Number(e.target.dataset.idx);
          const field = e.target.dataset.field;
          if (!this._estruturaTemp[idx]) return;
          this._estruturaTemp[idx][field] = field === 'peso' ? Number(e.target.value) : e.target.value;
        });
      });
      container.querySelectorAll('.btn-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = Number(e.currentTarget.dataset.idx);
          this._estruturaTemp.splice(idx, 1);
          this.renderGradeStructureItems();
        });
      });
    };

    proto.addGradeStructureItem = function () {
      if (!this._estruturaTemp) this._estruturaTemp = [];
      this._estruturaTemp.push({ nome: '', peso: 0 });
      this.renderGradeStructureItems();
    };

    proto.saveGradeStructure = async function () {
      const materiaNome = this._materiaEstruturaAtual;
      if (!materiaNome) return;

      const estrutura = (this._estruturaTemp || []).filter(i => i.nome && i.nome.trim());
      const somaPesos = estrutura.reduce((s, i) => s + (Number(i.peso) || 0), 0);

      if (estrutura.length && Math.round(somaPesos) !== 100 && window.showToast) {
        showToast(`A soma dos pesos é ${somaPesos}%. O ideal é somar 100%.`, 'warning');
      }

      try {
        const ok = await window.gradeCalculator?.configurarEstruturaNotas(materiaNome, estrutura);
        if (ok === false) throw new Error('save-failed');
        if (window.showToast) showToast('Estrutura de notas salva!');
        const modal = document.getElementById('modal-grade-structure');
        if (modal) modal.style.display = 'none';
        this.loadView?.(this.currentView);
      } catch (error) {
        console.error('[SLC] Erro ao salvar estrutura de notas:', error);
        if (window.showToast) showToast('Erro ao salvar estrutura de notas', 'error');
      }
    };
  }
})();
