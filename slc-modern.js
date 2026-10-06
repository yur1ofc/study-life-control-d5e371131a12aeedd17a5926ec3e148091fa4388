/* SLCampus Modern UI — interações leves, rápidas e seguras */
(function(){
'use strict';
const reduceMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lastValues=new WeakMap(),rafMap=new WeakMap();
function parse(t){const s=String(t||'').replace(/\s+/g,' ').trim();if(!s||s.includes('/')||s.includes(':'))return null;const m=s.match(/^(\D*)(-?\d+(?:[.,]\d+)?)(\D*)$/);if(!m)return null;const v=Number(m[2].replace(',','.'));if(!Number.isFinite(v)||Math.abs(v)>1e9)return null;return{p:m[1],v,s:m[3],d:(m[2].split(/[.,]/)[1]||'').length,c:m[2].includes(',')};}
function fmt(v,m){const x=m.d?v.toFixed(m.d):String(Math.round(v));return m.p+(m.c?x.replace('.',','):x)+m.s;}
function count(el,text,fromZero){const m=parse(text);if(!m)return;let start=fromZero?0:(lastValues.get(el)??0);lastValues.set(el,m.v);if(Math.abs(start-m.v)<.0001){el.textContent=text;return}if(reduceMotion){el.textContent=text;return}if(rafMap.has(el))cancelAnimationFrame(rafMap.get(el));const begin=performance.now();el.dataset.slcAnimating='1';const run=now=>{const p=Math.min(1,(now-begin)/300),e=1-Math.pow(1-p,3);el.textContent=fmt(start+(m.v-start)*e,m);if(p<1)rafMap.set(el,requestAnimationFrame(run));else{el.textContent=text;delete el.dataset.slcAnimating;}};rafMap.set(el,requestAnimationFrame(run));}
const selectors='.stat-value,.big-number,.grade-summary-value,.slc-study-stats strong,.xp-value,[data-count]';
function scan(root=document,initial=true){root.querySelectorAll(selectors).forEach(el=>{if(el.dataset.slcCountBound)return;el.dataset.slcCountBound='1';const t=el.textContent.trim();if(parse(t))count(el,t,initial);});}
function charts(root=document){root.querySelectorAll('.chart-bars,.chart-bar-container,.bar-chart,.chart-container').forEach(el=>{if(el.dataset.slcChartSeen)return;el.dataset.slcChartSeen='1';el.classList.add('slc-chart-animate');});}
function viewEnter(){const v=document.getElementById('view-container');if(!v)return;if(!reduceMotion){v.classList.remove('slc-view-enter');void v.offsetWidth;v.classList.add('slc-view-enter');setTimeout(()=>v.classList.remove('slc-view-enter'),360)}requestAnimationFrame(()=>{scan(v,true);charts(v);v.querySelectorAll('.card').forEach((c,i)=>{if(i>9)return;c.classList.remove('slc-pop-in');c.style.animationDelay=Math.min(i,7)*22+'ms';c.classList.add('slc-pop-in');});});}
function ripples(){document.addEventListener('pointerdown',e=>{const b=e.target.closest('button,.btn-primary,.btn-secondary,.btn-danger,.btn-small,.timer-btn,.btn-icon,.nav-item,[role="button"]');if(!b||b.disabled||b.dataset.noRipple==='1'||reduceMotion)return;const r=b.getBoundingClientRect(),size=Math.max(r.width,r.height)*1.15,x=e.clientX-r.left-size/2,y=e.clientY-r.top-size/2,s=document.createElement('span');s.className='slc-ripple';Object.assign(s.style,{width:size+'px',height:size+'px',left:x+'px',top:y+'px'});b.appendChild(s);setTimeout(()=>s.remove(),520)},{passive:true});}
function observers(){
  let last=document.body.getAttribute('data-view')||'';
  const bodyObserver=new MutationObserver(()=>{
    const now=document.body.getAttribute('data-view')||'';
    if(now!==last){last=now;viewEnter();}
  });
  bodyObserver.observe(document.body,{attributes:true,attributeFilter:['data-view']});
  const v=document.getElementById('view-container');
  if(v){
    const o=new MutationObserver(()=>{
      clearTimeout(o._t);
      o._t=setTimeout(()=>{scan(v,false);charts(v);},35);
    });
    o.observe(v,{childList:true,subtree:true,characterData:true});
  }
}
function numberObserver(){new MutationObserver(ms=>ms.forEach(m=>{const el=m.target.nodeType===1?m.target:m.target.parentElement;if(!el||!el.matches||!el.matches(selectors)||el.dataset.slcAnimating==='1')return;const t=el.textContent.trim(),p=parse(t),old=lastValues.get(el);if(p&&old!=null&&Math.abs(old-p.v)>.0001)count(el,t,false);})).observe(document.body,{subtree:true,characterData:true,childList:true});}
function mobileTables(){document.querySelectorAll('table').forEach(t=>{const p=t.parentElement;if(!p)return;const cs=getComputedStyle(p);if(cs.overflowX==='visible'||cs.overflowX==='clip'){p.style.overflowX='auto';p.style.maxWidth='100%';p.style.webkitOverflowScrolling='touch';}});}
function init(){ripples();observers();numberObserver();scan(document,true);charts(document);mobileTables();window.addEventListener('resize',()=>{clearTimeout(window.__slcResize);window.__slcResize=setTimeout(mobileTables,120)},{passive:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
