/* SLCampus Core — Academic Context / Subject Resolver / Data Quality
 * One deterministic source of truth for current-semester scoping.
 * UMD: browser exposes window.SLCAcademicContext; Node exposes module.exports.
 */
(function(root,factory){
  if(typeof module==='object'&&module.exports) module.exports=factory();
  else { root.SLCAcademicContext=factory(); root.SLCampusCore=root.SLCAcademicContext; }
})(typeof self!=='undefined'?self:this,function(){
  'use strict';
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const clone=v=>{try{return JSON.parse(JSON.stringify(v));}catch(_){return v;}};
  const aliasTokens=v=>norm(v).split(/\s+/).filter(Boolean);
  const keysFor=(item,key)=>{
    const m=norm(item?.materia||item?.subject||item?.nomeMateria||'');
    if(key==='exams') return `${m}|${norm(item?.titulo)}|${String(item?.data||'')}`;
    if(key==='grades') return `${m}|${norm(item?.nome)}|${Number(item?.valor)}|${Number(item?.peso)}|${String(item?.data||'')}`;
    if(key==='tasks') return `${m}|${norm(item?.titulo)}|${String(item?.dataLimite||item?.data||'')}`;
    if(key==='sessions') return `${m}|${String(item?.data||item?.inicio||'')}|${Number(item?.duracaoReal??item?.duracaoMin??item?.duracao??0)}`;
    return '';
  };
  function aliasesForSubject(s){
    const out=new Set();
    [s?.nome,s?.codigo,s?.code,s?.sigla,s?.apelido,s?.alias].forEach(v=>{
      if(Array.isArray(v)) v.forEach(x=>{if(norm(x))out.add(norm(x));});
      else if(norm(v))out.add(norm(v));
    });
    return out;
  }
  function subjectList(data){
    const subjects=Array.isArray(data?.subjects)?data.subjects.filter(s=>s&&s.nome):[];
    if(subjects.length)return subjects;
    const curriculum=Array.isArray(data?.curriculum)?data.curriculum.filter(s=>s&&s.nome&&['cursando','matriculado','ativa','ativo','current'].includes(norm(s.status))):[];
    return curriculum;
  }
  function resolver(data,query){
    const q=norm(query); if(!q)return null;
    const subjects=subjectList(data);
    let exact=subjects.find(s=>aliasesForSubject(s).has(q));
    if(exact)return exact;
    const compact=q.replace(/\s+/g,'');
    exact=subjects.find(s=>Array.from(aliasesForSubject(s)).some(a=>a.replace(/\s+/g,'')===compact));
    if(exact)return exact;
    const scored=subjects.map(s=>{
      const aliases=Array.from(aliasesForSubject(s));
      let score=0;
      aliases.forEach(a=>{
        if(a===q)score=Math.max(score,100);
        else if(a.startsWith(q)||q.startsWith(a))score=Math.max(score,75);
        else if(a.includes(q)||q.includes(a))score=Math.max(score,55);
        const qt=aliasTokens(q), at=aliasTokens(a), common=qt.filter(t=>at.includes(t)).length;
        if(common)score=Math.max(score,20+common*10);
      });
      return {s,score};
    }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
    return scored[0]?.score>=55?scored[0].s:null;
  }
  function currentSubjects(data){return subjectList(data);}
  function currentNames(data){return new Set(currentSubjects(data).map(s=>norm(s.nome)).filter(Boolean));}
  function historicalKeys(data,key){
    const out=new Set();
    for(const a of (Array.isArray(data?.archivedSemesters)?data.archivedSemesters:[])){
      for(const item of (Array.isArray(a?.[key])?a[key]:[])){const k=keysFor(item,key);if(k)out.add(k);}
    }
    return out;
  }
  function items(data,key){
    const raw=Array.isArray(data?.[key])?data[key]:[];
    const subjects=currentNames(data), hasScope=subjects.size>0, historical=historicalKeys(data,key);
    return raw.filter(item=>{
      const materia=norm(item?.materia||item?.subject||'');
      if(['exams','grades','tasks','sessions'].includes(key)&&hasScope&&materia&&!subjects.has(materia)){
        // Allow aliases/codes that resolve to a current subject.
        if(!resolver(data,item?.materia)) return false;
      }
      const k=keysFor(item,key);
      // A current subject can legitimately repeat the same assessment title/date
      // from an older attempt. Never hide a current-semester record merely
      // because an archived attempt has the same fingerprint.
      if(['exams','grades','tasks','sessions'].includes(key) && hasScope && materia) return true;
      return !k || !historical.has(k);
    });
  }
  function current(data){return {
    subjects:currentSubjects(data),
    exams:items(data,'exams'), tasks:items(data,'tasks'), grades:items(data,'grades'),
    sessions:items(data,'sessions'), classSchedule:Array.isArray(data?.classSchedule)?data.classSchedule:[],
    reviews:Array.isArray(data?.reviews)?data.reviews:[], classDiaries:Array.isArray(data?.classDiaries)?data.classDiaries:[],
    materials:Array.isArray(data?.materials)?data.materials:[], attendance:data?.attendance||{}
  };}
  function dataQuality(data){
    const s=currentSubjects(data), checks=[
      ['Matérias atuais',s.length>0],['Grade horária',Array.isArray(data?.classSchedule)&&data.classSchedule.length>0],
      ['Avaliações',items(data,'exams').length>0],['Notas',items(data,'grades').length>0],
      ['Sessões de estudo',items(data,'sessions').length>0],['Diário de aula',Array.isArray(data?.classDiaries)&&data.classDiaries.length>0],
      ['Revisões',Array.isArray(data?.reviews)&&data.reviews.length>0],['Tarefas',items(data,'tasks').length>0],
      ['Histórico',Array.isArray(data?.archivedSemesters)&&data.archivedSemesters.length>0]
    ];
    const score=Math.round(checks.filter(x=>x[1]).length/checks.length*100);
    return {score,checks:checks.map(([label,ok])=>({label,ok})),level:score>=80?'alto':score>=55?'médio':'baixo'};
  }
  return {norm,clone,subjectList,currentSubjects,currentNames,resolveSubject:resolver,historicalKeys,items,current,dataQuality,keysFor};
});