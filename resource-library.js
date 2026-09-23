// resource-library.js — Biblioteca de estudos SLCampus
// Recursos privados por padrão. PDFs são enviados ao Firebase Storage;
// vídeos do YouTube e sites ficam como links externos.
// Não baixa/republica conteúdo de terceiros.
(function () {
  'use strict';

  const COLLECTION = 'resources';
  const MAX_PDF_BYTES = 25 * 1024 * 1024;

  function uid() { return window.auth?.currentUser?.uid || null; }
  function esc(v) {
    const d = document.createElement('div'); d.textContent = v == null ? '' : String(v);
    return d.innerHTML;
  }
  function db() { return window.db || window.firebase?.firestore?.(); }
  function storage() { return window.firebase?.storage?.(); }

  function normalizeYouTube(url) {
    try {
      const u = new URL(url);
      let id = '';
      if (u.hostname.includes('youtu.be')) id = u.pathname.replace(/^\/+/, '').split('/')[0];
      if (u.hostname.includes('youtube.com')) {
        if (u.pathname === '/watch') id = u.searchParams.get('v') || '';
        if (u.pathname.startsWith('/shorts/')) id = u.pathname.split('/')[2] || '';
        if (u.pathname.startsWith('/embed/')) id = u.pathname.split('/')[2] || '';
      }
      return /^[\w-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    } catch (_) { return null; }
  }

  function typeIcon(type) {
    return ({pdf:'fa-file-pdf', video:'fa-youtube', ebook:'fa-book-open', link:'fa-link', site:'fa-globe'}[type] || 'fa-file');
  }

  function typeLabel(type) {
    return ({pdf:'PDF', video:'Vídeo', ebook:'E-book', link:'Link', site:'Site'}[type] || 'Recurso');
  }

  async function list() {
    const id = uid(); const firestore = db();
    if (!id || !firestore) return [];
    const snap = await firestore.collection('users').doc(id).collection(COLLECTION)
      .orderBy('createdAt', 'desc').limit(200).get();
    return snap.docs.map(d => ({id:d.id, ...d.data()}));
  }

  async function add(data, file) {
    const id = uid(); const firestore = db();
    if (!id || !firestore) throw new Error('Você precisa estar conectado.');
    if (!data.titulo?.trim()) throw new Error('Informe um título.');
    if (data.tipo === 'pdf') {
      if (!file) throw new Error('Selecione um PDF.');
      if (file.type !== 'application/pdf') throw new Error('O arquivo precisa ser PDF.');
      if (file.size > MAX_PDF_BYTES) throw new Error('PDF acima de 25 MB.');
    } else if (data.tipo === 'video') {
      if (!normalizeYouTube(data.url || '')) throw new Error('Informe uma URL válida do YouTube.');
    } else if (!data.url?.trim()) {
      throw new Error('Informe o link do recurso.');
    }

    const ref = firestore.collection('users').doc(id).collection(COLLECTION).doc();
    const now = firebase.firestore.FieldValue.serverTimestamp();
    let url = data.url?.trim() || '';
    let storagePath = '';

    if (data.tipo === 'pdf') {
      const st = storage();
      if (!st) throw new Error('Armazenamento de arquivos indisponível.');
      const safe = file.name.replace(/[^\w.\- ]/g, '_').slice(0, 120);
      storagePath = `users/${id}/resources/${ref.id}/${safe}`;
      const snap = await st.ref(storagePath).put(file, {contentType:'application/pdf'});
      url = await snap.ref.getDownloadURL();
    }

    await ref.set({
      titulo: data.titulo.trim().slice(0, 180),
      tipo: data.tipo,
      materia: (data.materia || '').trim().slice(0, 120),
      descricao: (data.descricao || '').trim().slice(0, 800),
      url,
      storagePath,
      tags: (data.tags || '').split(',').map(x=>x.trim()).filter(Boolean).slice(0,10),
      favorito: false,
      createdAt: now,
      updatedAt: now
    });
    return ref.id;
  }

  async function remove(item) {
    const id = uid(); const firestore = db();
    if (!id || !firestore) throw new Error('Sessão expirada.');
    if (item.storagePath && storage()) {
      try { await storage().ref(item.storagePath).delete(); } catch (e) { console.warn('[Biblioteca] arquivo:', e); }
    }
    await firestore.collection('users').doc(id).collection(COLLECTION).doc(item.id).delete();
  }

  async function toggleFavorite(item) {
    const id = uid(); if (!id) return;
    await db().collection('users').doc(id).collection(COLLECTION).doc(item.id)
      .update({favorito: !item.favorito, updatedAt: firebase.firestore.FieldValue.serverTimestamp()});
  }

  function renderCard(item) {
    const link = item.tipo === 'video' ? normalizeYouTube(item.url) : item.url;
    return `<article class="resource-card">
      <div class="resource-card-icon type-${esc(item.tipo)}"><i class="fas ${typeIcon(item.tipo)}"></i></div>
      <div class="resource-card-main">
        <div class="resource-card-top">
          <span class="resource-type">${typeLabel(item.tipo)}</span>
          <button class="resource-star" data-resource-fav="${esc(item.id)}" title="Favoritar"><i class="fas fa-star ${item.favorito?'active':''}"></i></button>
        </div>
        <h3>${esc(item.titulo)}</h3>
        ${item.materia ? `<span class="resource-subject"><i class="fas fa-book"></i> ${esc(item.materia)}</span>` : ''}
        ${item.descricao ? `<p>${esc(item.descricao)}</p>` : ''}
        <div class="resource-actions">
          ${link ? `<a class="btn-primary btn-resource-open" href="${esc(link)}" target="_blank" rel="noopener noreferrer"><i class="fas fa-arrow-up-right-from-square"></i> Abrir</a>` : ''}
          <button class="btn-secondary" data-resource-delete="${esc(item.id)}"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    </article>`;
  }

  async function renderView() {
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div class="view-header resource-header">
      <div><h2><i class="fas fa-layer-group"></i> Biblioteca</h2><p>Seus PDFs, vídeos, e-books e links de estudo em um só lugar.</p></div>
      <button class="btn-primary" id="resource-add-btn"><i class="fas fa-plus"></i> Adicionar recurso</button>
    </div>
    <div class="resource-legal-note"><i class="fas fa-shield-alt"></i>
      <span>Use apenas arquivos e materiais que você tem direito de armazenar ou compartilhar. Links do YouTube permanecem no YouTube; o SLCampus não copia vídeos de terceiros.</span>
    </div>
    <div class="resource-toolbar">
      <div class="resource-search"><i class="fas fa-search"></i><input id="resource-search" placeholder="Buscar por título, matéria ou tag..."></div>
      <select id="resource-filter"><option value="">Todos</option><option value="pdf">PDF</option><option value="video">Vídeos</option><option value="ebook">E-books</option><option value="link">Links</option><option value="site">Sites</option></select>
    </div>
    <div id="resource-grid" class="resource-grid"><div class="resource-empty"><i class="fas fa-spinner fa-spin"></i><p>Carregando sua biblioteca...</p></div></div>`;

    const container = document.getElementById('view-container');
    container.innerHTML = ''; container.appendChild(wrap);
    const items = await list().catch(e => { console.error(e); return []; });

    const grid = wrap.querySelector('#resource-grid');
    const search = wrap.querySelector('#resource-search');
    const filter = wrap.querySelector('#resource-filter');
    const draw = () => {
      const q=(search.value||'').toLowerCase().trim(), f=filter.value;
      const visible=items.filter(x=>(!f||x.tipo===f) && (!q||[x.titulo,x.materia,x.descricao,...(x.tags||[])].join(' ').toLowerCase().includes(q)));
      grid.innerHTML=visible.length ? visible.map(renderCard).join('') :
        `<div class="resource-empty"><i class="fas fa-folder-open"></i><h3>${items.length?'Nenhum recurso encontrado':'Sua biblioteca ainda está vazia'}</h3><p>${items.length?'Tente outro filtro ou termo de busca.':'Adicione seu primeiro PDF, vídeo, e-book ou link de estudo.'}</p></div>`;
      grid.querySelectorAll('[data-resource-delete]').forEach(btn=>btn.onclick=async()=> {
        const item=items.find(x=>x.id===btn.dataset.resourceDelete); if(!item) return;
        if (!window.SLCConfirm?.show) { if(!confirm('Excluir este recurso?')) return; } else if(!(await window.SLCConfirm.show('Excluir este recurso?'))) return;
        await remove(item); const i=items.indexOf(item); if(i>=0)items.splice(i,1); draw();
      });
      grid.querySelectorAll('[data-resource-fav]').forEach(btn=>btn.onclick=async()=>{
        const item=items.find(x=>x.id===btn.dataset.resourceFav); if(!item)return;
        await toggleFavorite(item); item.favorito=!item.favorito; draw();
      });
    };
    search.oninput=filter.onchange=draw;

    wrap.querySelector('#resource-add-btn').onclick=()=>openAddModal(draw,items);
    draw();
  }

  function openAddModal(redraw, items) {
    document.getElementById('resource-modal')?.remove();
    const modal=document.createElement('div'); modal.id='resource-modal'; modal.className='modal slc-resource-modal';
    modal.innerHTML=`<div class="modal-content">
      <div class="modal-header"><h2><i class="fas fa-plus"></i> Novo recurso</h2><button class="modal-close" aria-label="Fechar">&times;</button></div>
      <form id="resource-form" class="modal-form">
        <div class="resource-type-picker">
          ${[['pdf','fa-file-pdf','PDF'],['video','fa-youtube','Vídeo'],['ebook','fa-book-open','E-book'],['link','fa-link','Link'],['site','fa-globe','Site']].map((x,i)=>`<button type="button" class="resource-type-btn ${i===0?'active':''}" data-type="${x[0]}"><i class="fas ${x[1]}"></i>${x[2]}</button>`).join('')}
        </div>
        <input type="hidden" id="resource-type" value="pdf">
        <div class="form-group"><label>Título</label><input required id="resource-title" maxlength="180" placeholder="Ex.: Cálculo I — Derivadas"></div>
        <div class="form-group"><label>Matéria (opcional)</label><input id="resource-subject" maxlength="120" placeholder="Ex.: Cálculo I"></div>
        <div class="form-group"><label>Descrição (opcional)</label><textarea id="resource-description" maxlength="800" rows="3" placeholder="Para que este material serve?"></textarea></div>
        <div class="form-group resource-url-field"><label>Link</label><input id="resource-url" type="url" placeholder="https://..."></div>
        <div class="form-group resource-file-field"><label>Arquivo PDF</label><input id="resource-file" type="file" accept="application/pdf"><small>Armazenamento privado, até 25 MB por arquivo.</small></div>
        <div class="form-group"><label>Tags</label><input id="resource-tags" maxlength="300" placeholder="derivadas, revisão, prova"></div>
        <div class="resource-rights"><i class="fas fa-scale-balanced"></i> Você declara que tem autorização para armazenar este arquivo ou que ele é de sua propriedade/domínio público/licenciado.</div>
        <div class="modal-actions"><button type="button" class="btn-secondary modal-close">Cancelar</button><button class="btn-primary" type="submit"><i class="fas fa-cloud-arrow-up"></i> Salvar recurso</button></div>
      </form>
    </div>`;
    document.body.appendChild(modal);
    modal.querySelectorAll('.modal-close').forEach(b=>b.onclick=()=>modal.remove());
    const type=modal.querySelector('#resource-type');
    modal.querySelectorAll('[data-type]').forEach(b=>b.onclick=()=>{
      modal.querySelectorAll('[data-type]').forEach(x=>x.classList.remove('active'));b.classList.add('active');type.value=b.dataset.type;
      const pdf=b.dataset.type==='pdf'; modal.querySelector('.resource-file-field').style.display=pdf?'block':'none'; modal.querySelector('.resource-url-field').style.display=pdf?'none':'block';
    });
    modal.querySelector('#resource-form').onsubmit=async e=>{
      e.preventDefault(); const submit=e.submitter; submit.disabled=true; submit.innerHTML='<i class="fas fa-spinner fa-spin"></i> Salvando...';
      try {
        const t=type.value, data={tipo:t,titulo:modal.querySelector('#resource-title').value,materia:modal.querySelector('#resource-subject').value,descricao:modal.querySelector('#resource-description').value,url:modal.querySelector('#resource-url').value,tags:modal.querySelector('#resource-tags').value};
        await add(data,modal.querySelector('#resource-file').files[0]);
        const fresh=await list(); items.splice(0,items.length,...fresh); modal.remove(); redraw(); window.showToast?.('Recurso adicionado à Biblioteca.','success');
      } catch(err) { window.showToast?.(err.message||'Não foi possível salvar.','error'); submit.disabled=false; submit.innerHTML='<i class="fas fa-cloud-arrow-up"></i> Salvar recurso'; }
    };
    modal.style.display='flex';
  }

  window.ResourceLibrary={renderView,list,add,remove};
})();
