// SLCampus AI Core — gateway multi-provider (Gemini + Groq).
// As chaves ficam somente no servidor. O frontend continua usando os endpoints
// antigos (/api/mentor-chat e /api/gemini), então a troca de provedor é transparente.
const quota = require('./gemini-admin-quota');

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const TEXT_MODEL = process.env.SLC_AI_TEXT_MODEL || 'openai/gpt-oss-120b';
const SMALL_TEXT_MODEL = process.env.SLC_AI_FALLBACK_MODEL || 'openai/gpt-oss-20b';
const VISION_MODEL = process.env.SLC_AI_VISION_MODEL || 'qwen/qwen3.8-27b';
const GEMINI_MODEL = process.env.SLC_AI_GEMINI_MODEL || 'gemini-3.5-flash-lite';
const GEMINI_VISION_MODEL = process.env.SLC_AI_GEMINI_VISION_MODEL || GEMINI_MODEL;
const MAX_RETRIES = 0;
const TIMEOUT_MS = Number(process.env.SLC_AI_TIMEOUT_MS || 20000);
const PDF_MAX_TEXT_CHARS = 64000;
const CHUNK_CHARS = 10000;

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function requestId(prefix='ai'){ return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,9)}`; }
function isRetryable(status, data){
  const msg=String(data?.error?.message||data?.error?.status||'').toLowerCase();
  return [408,429,500,502,503,504].includes(status) || /overload|temporar|unavailable|timeout|rate.?limit|capacity|resource.?exhausted/.test(msg);
}
function jsonText(data){ return data?.choices?.[0]?.message?.content || ''; }
function geminiText(data){
  return (data?.candidates||[]).flatMap(c=>c?.content?.parts||[]).map(p=>p?.text||'').join('');
}
const providerCooldowns={gemini:0,groq:0};
function setProviderCooldown(provider,ms){providerCooldowns[provider]=Date.now()+Math.max(0,Math.min(15*60*1000,ms||0));}
function providerIsCoolingDown(provider){return providerCooldowns[provider]>Date.now();}
function providerCooldownRemaining(provider){return Math.max(0,providerCooldowns[provider]-Date.now());}

function providerOrder(){
  const raw=String(process.env.SLC_AI_PROVIDER_ORDER||'gemini,groq').toLowerCase();
  const list=raw.split(',').map(x=>x.trim()).filter(x=>x==='gemini'||x==='groq');
  return [...new Set(list.length?list:['gemini','groq'])];
}

function geminiContentsToGroq(contents){
  return (contents||[]).map((c)=>{
    const role=c?.role==='model'?'assistant':'user';
    const parts=Array.isArray(c?.parts)?c.parts:[];
    const textParts=[];
    const media=[];
    for(const part of parts){
      if(part?.text) textParts.push(String(part.text));
      const d=part?.inline_data || part?.inlineData;
      if(d?.data && /^image\//i.test(String(d.mime_type||d.mimeType||''))){
        const mime=String(d.mime_type||d.mimeType||'image/jpeg');
        media.push({type:'image_url',image_url:{url:`data:${mime};base64,${d.data}`}});
      }
    }
    if(media.length) return {role,content:[{type:'text',text:textParts.join('\n')},...media]};
    return {role,content:textParts.join('\n')};
  }).filter(m=>m.content && (typeof m.content==='string'?m.content.trim():m.content.length));
}

function geminiContentsFromMessages(messages){
  return (messages||[]).map(m=>{
    const role=m?.role==='assistant'?'model':'user';
    if(Array.isArray(m?.content)){
      const parts=[];
      for(const item of m.content){
        if(item?.type==='text' && item.text) parts.push({text:String(item.text)});
        if(item?.type==='image_url' && item.image_url?.url){
          const match=String(item.image_url.url).match(/^data:([^;]+);base64,(.+)$/s);
          if(match) parts.push({inlineData:{mimeType:match[1],data:match[2]}});
        }
      }
      return {role,parts};
    }
    return {role,parts:[{text:String(m?.content||'')}]} ;
  }).filter(x=>x.parts?.length);
}

function geminiPayload({messages,systemInstruction='',json=false,maxTokens=1400,model=GEMINI_MODEL,reasoningEffort='medium'}){
  const generationConfig={
    temperature:0.35,
    maxOutputTokens:maxTokens
  };
  if(json) generationConfig.responseMimeType='application/json';
  const contents=geminiContentsFromMessages(messages);
  const payload={contents,generationConfig};
  if(systemInstruction) payload.systemInstruction={parts:[{text:String(systemInstruction)}]};
  return payload;
}

async function callGemini({messages,systemInstruction='',json=false,model=GEMINI_MODEL,operation='mentor',uid,email,requestId:rid,maxTokens=1400,reasoningEffort='medium'}){
  const key=process.env.GEMINI_API_KEY;
  if(!key) return {ok:false,status:503,error:'GEMINI_API_KEY não configurada no Vercel.',code:'GEMINI_NOT_CONFIGURED',provider:'gemini',retryable:true};
  const current=model || GEMINI_MODEL;
  const reservation=await quota.reserveGlobalCall({uid,email,operation,model:current,requestId:rid,provider:'gemini'});
  if(reservation.blocked){
    return {ok:false,status:503,blocked:true,provider:'gemini',code:reservation.reason==='provider-limit'?'GEMINI_LOCAL_LIMIT':operation==='import'?'GLOBAL_AI_LIMIT':'GLOBAL_CHAT_LIMIT',error:reservation.reason==='provider-limit'?'Limite interno diário reservado para o Gemini atingido.':'Limite interno diário de IA atingido temporariamente.',providerLimit:reservation.providerLimit};
  }
  const started=Date.now();
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  let status=503,data={},outcome='error';
  try{
    const payload=geminiPayload({messages,systemInstruction,json,maxTokens,model:current,reasoningEffort});
    const response=await fetch(`${GEMINI_URL}/${encodeURIComponent(current)}:generateContent?key=${encodeURIComponent(key)}`,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal
    });
    status=response.status;
    const retryAfterHeader=response.headers.get('retry-after');
    const retryAfterMs=retryAfterHeader && /^\d+(?:\.\d+)?$/.test(retryAfterHeader) ? Number(retryAfterHeader)*1000 : 0;
    data=await response.json().catch(()=>({}));
    if(retryAfterMs) data.__retryAfterMs=retryAfterMs;
    outcome=response.ok?'success':(isRetryable(status,data)?'transient-error':'error');
    if(response.ok){
      const text=geminiText(data);
      providerCooldowns.gemini=0;
      return {ok:true,status,provider:'gemini',modelUsed:current,data,text,usage:data?.usageMetadata||{},attempts:1};
    }
  }catch(err){
    status=err?.name==='AbortError'?504:503;
    data={error:{message:err?.name==='AbortError'?`A IA demorou mais de ${Math.round(TIMEOUT_MS/1000)}s para responder.`:(err?.message||'Falha de rede ao chamar o Gemini.')}};
  }finally{
    clearTimeout(timer);
    await quota.finishCall(reservation.logId,{status:outcome,httpStatus:status,success:outcome==='success',latencyMs:Date.now()-started,errorMessage:data?.error?.message||'',retryable:isRetryable(status,data),provider:'gemini',model:current});
  }
  const raw=data?.error?.message||data?.error?.status||'';
  const retryAfterMs=Number(data?.__retryAfterMs||0);
  return {ok:false,status,provider:'gemini',modelUsed:current,data,retryable:isRetryable(status,data),retryAfterMs,error:status===429?'O Gemini está no limite temporário de uso.':status===503?'O Gemini está temporariamente sobrecarregado.':raw||`Erro HTTP ${status} do Gemini.`,code:status===429?'GEMINI_429':status===504?'GEMINI_504':'GEMINI_ERROR'};
}

async function callGroq({messages,systemInstruction='',json=false,model=TEXT_MODEL,operation='mentor',uid,email,requestId:rid,maxTokens=1400,reasoningEffort='medium'}){
  const key=process.env.GROQ_API_KEY;
  if(!key) return {ok:false,status:503,error:'GROQ_API_KEY não configurada no Vercel.',code:'GROQ_NOT_CONFIGURED',provider:'groq',retryable:true};
  const models = model===VISION_MODEL ? [VISION_MODEL] : [model, SMALL_TEXT_MODEL].filter((v,i,a)=>v && a.indexOf(v)===i);
  let last=null;
  for(let mi=0;mi<models.length;mi++){
    const current=models[mi];
    for(let attempt=0;attempt<=MAX_RETRIES;attempt++){
      const reservation=await quota.reserveGlobalCall({uid,email,operation,model:current,requestId:rid,provider:'groq'});
      if(reservation.blocked){
        return {ok:false,status:503,blocked:true,provider:'groq',code:reservation.reason==='provider-limit'?'GROQ_LOCAL_LIMIT':operation==='import'?'GLOBAL_AI_LIMIT':'GLOBAL_CHAT_LIMIT',error:reservation.reason==='provider-limit'?'Limite interno diário reservado para o Groq atingido.':'Limite interno diário de IA atingido temporariamente.',providerLimit:reservation.providerLimit};
      }
      const started=Date.now();
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
      let status=503,data={},outcome='error';
      try{
        const payload={model:current,messages,temperature:current===VISION_MODEL?0.2:0.35,max_completion_tokens:maxTokens,stream:false};
        if(systemInstruction) payload.messages=[{role:'system',content:systemInstruction},...messages];
        if(json) payload.response_format={type:'json_object'};
        if(current.startsWith('openai/gpt-oss-')) payload.reasoning_effort=reasoningEffort;
        if(current===VISION_MODEL) payload.reasoning_effort='none';
        const response=await fetch(GROQ_URL,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},body:JSON.stringify(payload),signal:controller.signal});
        status=response.status;
        const retryAfterHeader=response.headers.get('retry-after');
        const retryAfterMs=retryAfterHeader && /^\d+(?:\.\d+)?$/.test(retryAfterHeader) ? Number(retryAfterHeader)*1000 : 0;
        data=await response.json().catch(()=>({}));
        if(retryAfterMs) data.__retryAfterMs=retryAfterMs;
        outcome=response.ok?'success':(isRetryable(status,data)?'transient-error':'error');
        if(response.ok){providerCooldowns.groq=0;return {ok:true,status,provider:'groq',modelUsed:current,data,text:jsonText(data),usage:data.usage||{},attempts:mi+attempt+1};}
        last={ok:false,status,data,model:current,transient:isRetryable(status,data)};
      }catch(err){
        status=err?.name==='AbortError'?504:503;
        data={error:{message:err?.name==='AbortError'?`A IA demorou mais de ${Math.round(TIMEOUT_MS/1000)}s para responder.`:(err?.message||'Falha de rede ao chamar o Groq.')}};
        last={ok:false,status,data,model:current,transient:true};
      }finally{
        clearTimeout(timer);
        await quota.finishCall(reservation.logId,{status:outcome,httpStatus:status,success:outcome==='success',latencyMs:Date.now()-started,errorMessage:data?.error?.message||'',retryable:isRetryable(status,data),provider:'groq',model:current});
      }
      if(!last?.transient) break;
    }
    if(current===VISION_MODEL) break;
  }
  const status=last?.status||503;
  const raw=last?.data?.error?.message||'';
  return {ok:false,status,provider:'groq',retryAfterMs:Number(last?.data?.__retryAfterMs||0),error:status===429?'O Groq atingiu o limite temporário de requisições.':status===503?'O Groq está temporariamente indisponível.':raw||`Erro HTTP ${status} da IA.`,code:status===429?'GROQ_429':status===504?'GROQ_504':'GROQ_ERROR',retryable:isRetryable(status,last?.data||{})};
}

async function callAI({messages,systemInstruction='',json=false,operation='mentor',uid,email,requestId:rid,maxTokens=1400,reasoningEffort='medium',model,geminiModel}){
  const order=providerOrder();
  let last=null;
  for(const provider of order){
    if(providerIsCoolingDown(provider)) continue;
    const result=provider==='gemini'
      ? await callGemini({messages,systemInstruction,json,operation,uid,email,requestId:rid,maxTokens,reasoningEffort,model:geminiModel||GEMINI_MODEL})
      : await callGroq({messages,systemInstruction,json,operation,uid,email,requestId:rid,maxTokens,reasoningEffort,model:model||TEXT_MODEL});
    if(result.ok) return result;
    last=result;
    if(result.code==='GEMINI_NOT_CONFIGURED' || result.code==='GROQ_NOT_CONFIGURED'){
      setProviderCooldown(provider,10*60*1000);
    }else if(result.code==='GEMINI_LOCAL_LIMIT' || result.code==='GROQ_LOCAL_LIMIT'){
      setProviderCooldown(provider,10*60*1000);
    }else if(result.retryable || [408,429,500,502,503,504].includes(result.status)){
      setProviderCooldown(provider,result.retryAfterMs||30*1000);
    }
  }
  const remaining=order.filter(providerIsCoolingDown);
  if(last && !last.retryAfterMs && remaining.length===order.length) last.retryAfterMs=Math.max(...remaining.map(providerCooldownRemaining));
  return last||{ok:false,status:503,error:'Nenhum provedor de IA está disponível.',code:'AI_NO_PROVIDER'};
}

function sniffMimeFromBase64(data, declared=''){
  const raw=String(data||'').replace(/\s/g,'');
  const declaredMime=String(declared||'').toLowerCase().split(';')[0].trim();
  try{
    const b=Buffer.from(raw,'base64');
    if(!b.length) return null;
    const head=b.subarray(0,16).toString('ascii');
    if(head.startsWith('%PDF-')) return 'application/pdf';
    if(b[0]===0x89&&b[1]===0x50&&b[2]===0x4e&&b[3]===0x47) return 'image/png';
    if(b[0]===0xff&&b[1]===0xd8&&b[2]===0xff) return 'image/jpeg';
    if(b.subarray(0,4).toString('ascii')==='RIFF'&&b.subarray(8,12).toString('ascii')==='WEBP') return 'image/webp';
  }catch(_){}
  return declaredMime||null;
}

function dataUrlFromPart(part){
  const d=part?.inline_data||part?.inlineData;
  if(!d?.data) return null;
  const detected=sniffMimeFromBase64(d.data,d.mime_type||d.mimeType||'');
  if(!detected || !/^image\/(png|jpeg|webp)$/i.test(detected)) return null;
  const raw=String(d.data).replace(/\s/g,'');
  try{ if(!Buffer.from(raw,'base64').length) return null; }catch(_){ return null; }
  return {mime:detected,dataUrl:`data:${detected};base64,${raw}`};
}

function normalizeExtractedPdfText(text){
  return String(text||'')
    .replace(/\r/g,'')
    .replace(/[\u00ad]/g,'')
    .replace(/-\n(?=\S)/g,'')
    .replace(/[ \t]+\n/g,'\n')
    .replace(/\n{3,}/g,'\n\n')
    .trim();
}

function splitIntoChunks(text, size=CHUNK_CHARS){
  const source=normalizeExtractedPdfText(text);
  if(!source) return [];
  const chunks=[];
  let start=0;
  while(start<source.length){
    let end=Math.min(source.length,start+size);
    if(end<source.length){
      const candidates=[source.lastIndexOf('\n\n',end),source.lastIndexOf('\n',end),source.lastIndexOf(' ',end)];
      const cut=candidates.find(v=>v>start+Math.floor(size*0.65));
      if(cut>0) end=cut;
    }
    chunks.push(source.slice(start,end).trim());
    start=end;
  }
  return chunks;
}

async function extractPdfText(contents){
  let pdfCount=0; const out=[]; let total=0;
  for(const c of (contents||[])){
    for(const part of (c?.parts||[])){
      const d=part?.inline_data||part?.inlineData;
      const detected=sniffMimeFromBase64(d?.data,d?.mime_type||d?.mimeType||'');
      if(d?.data && detected==='application/pdf'){
        pdfCount++;
        const buffer=Buffer.from(String(d.data),'base64');
        if(buffer.length>12*1024*1024) throw new Error('PDF muito grande. Envie um arquivo de até 12 MB.');
        try{
          const pdfParse=require('pdf-parse');
          const parsed=await pdfParse(buffer);
          const remaining=Math.max(0,PDF_MAX_TEXT_CHARS-total);
          const text=String(parsed.text||'').slice(0,remaining);
          if(text) out.push(text);
          total+=text.length;
          if(total>=PDF_MAX_TEXT_CHARS) break;
        }catch(err){ throw new Error(`Não consegui extrair o texto do PDF: ${err.message||'arquivo incompatível'}`); }
      }
    }
    if(total>=PDF_MAX_TEXT_CHARS) break;
  }
  const text=normalizeExtractedPdfText(out.join('\n\n--- NOVO PDF ---\n\n'));
  return {pdfCount,text,pdfChunks:splitIntoChunks(text)};
}

async function buildMessagesFromGemini(contents){
  const pdf=await extractPdfText(contents);
  const normalized=[];
  let hasImage=false;
  for(const c of (contents||[])){
    const role=c?.role==='model'?'assistant':'user';
    const parts=Array.isArray(c?.parts)?c.parts:[];
    const text=[]; const media=[];
    for(const part of parts){
      if(part?.text) text.push(String(part.text));
      const img=dataUrlFromPart(part);
      if(img){ hasImage=true; media.push({type:'image_url',image_url:{url:img.dataUrl}}); }
    }
    if(text.length || media.length) normalized.push({role,content:media.length?[{type:'text',text:text.join('\n')},...media]:text.join('\n')});
  }
  if(pdf.text){
    normalized.push({role:'user',content:`CONTEÚDO EXTRAÍDO DE PDF(S):\n${pdf.text}\n\nUse somente os dados presentes no conteúdo acima para a importação. Se algo não estiver legível ou presente, não invente.`});
  }
  return {messages:normalized,hasImage,pdfCount:pdf.pdfCount,pdfChunks:pdf.pdfChunks};
}



// Parser determinístico de histórico SIGAA. Serve como rede de segurança para
// PDFs cujo texto foi extraído corretamente, mas cuja resposta da IA não respeitou
// o schema. Não inventa dados: só aceita registros com período, código e situação.
function parseSigaaHistoryText(text){
  const source=normalizeExtractedPdfText(text);
  const statusRe='APR(?:N)?|CANC|DISP|MATR|REC|REP(?:F|MF|N|NF)?|TRANC|TRANS|INCORP|CUMP';
  const statusMap=new Set(['APR','APRN','CANC','DISP','MATR','REC','REP','REPF','REPMF','REPN','REPNF','TRANC','TRANS','INCORP','CUMP']);
  const rows=[];
  const cleanName=(value)=>String(value||'')
    .replace(/\s+/g,' ').replace(/^[-–—:]+|[-–—:]+$/g,'').trim()
    .replace(/\s+(?:Dr|Dra|Prof|Profa|MSc|Esp|Me|Ma)\.?(?:\s+[^\d]+)?$/i,'').trim();
  const toNum=(v)=>v==='--'?null:Number(String(v||'').replace(',','.'));
  const pushRow=(period,codigo,nome,nums,status)=>{
    period=String(period||'').trim(); codigo=String(codigo||'').replace(/\s+/g,'').toUpperCase();
    status=String(status||'').toUpperCase(); nome=cleanName(nome);
    if(!/^\d{4}\.\d$/.test(period)||!codigo||!statusMap.has(status)||!nome) return;
    if(/^ENADE$/i.test(nome)||/^(Histórico|Nome|Ano\/Período|Componentes|Página|Legenda)\b/i.test(nome)) return;
    const vals=(nums||[]).map(toNum);
    let notaFinal=null, frequencia=null;
    for(let i=vals.length-1;i>=0;i--){ if(vals[i]!==null){notaFinal=vals[i];break;} }
    if(/^(MATR|REC|TRANC|CANC)$/i.test(status)) notaFinal=null;
    if(vals.length>=4 && vals[3]!==null && vals[3]>=0 && vals[3]<=100) frequencia=vals[3];
    rows.push({periodo:period,codigo,nome,cargaHoraria:vals.length?Number(vals[0])||0:0,creditos:0,notaFinal,status,frequencia});
  };

  // SIGAA's extracted PDF text can place a complete row on one line.
  // Accept the row whenever period, component code, numeric columns and status are present,
  // even if the teacher/name spacing differs between PDF versions.
  const lineRows=source.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const headerRe=/^(\d{4}\.\d)\s+(.+)$/;
  const fullRowRe=new RegExp('^(\\d{4}\\.\\d)\\s+(.*?)\\s+([A-Z]{2,5}\\s?\\d{3,5})\\s+(.*?)(?:\\s+)(\\d{2,3})\\s+(\\d+)\\s+(\\d+)\\s+([\\d,.-]+|--)\\s+([\\d,.-]+|--)\\s+([\\d,.-]+|--)\\s+('+statusRe+')\\s*$','i');
  const tailRe=new RegExp('(?:^|\\s)([A-Z]{2,5}\\s?\\d{3,5})\\s+(\\d{2,3})\\s+(\\d+)\\s+(\\d+)\\s+([\\d,.-]+|--)\\s+([\\d,.-]+|--)\\s+([\\d,.-]+|--)\\s+('+statusRe+')\\s*$','i');
  let pendingPeriod='', pendingName='';
  for(const line of lineRows){
    if(/^(Componentes Curriculares Obrigatórios Pendentes|Componentes Extra Curriculares|Legenda\b)/i.test(line)) { pendingPeriod=''; pendingName=''; break; }
    const full=line.match(fullRowRe);
    if(full){
      const nums=[full[5],full[6],full[7],full[8],full[9],full[10]];
      pushRow(full[1],full[3],full[2],nums,full[11]);
      pendingPeriod=''; pendingName=''; continue;
    }
    const h=line.match(headerRe);
    if(h && !/^(Histórico|Nome:|Ano\/Período|Componentes|Página)/i.test(line)){
      pendingPeriod=h[1]; pendingName=h[2].trim();
      // A header can itself contain a course code and the trailing result columns.
      const tail=line.match(tailRe);
      if(tail){
        const namePart=line.slice(line.indexOf(h[1])+h[1].length, line.indexOf(tail[1])).trim();
        pushRow(h[1],tail[1],namePart,[tail[2],tail[3],tail[4],tail[5],tail[6],tail[7]],tail[8]);
        pendingPeriod=''; pendingName='';
      }
      continue;
    }
    if(pendingPeriod){
      const tail=line.match(tailRe);
      if(tail){
        const codeIndex=line.search(new RegExp(tail[1].replace(/([.*+?^${}()|[\]\\])/g,'\\$1'),'i'));
        const namePart=codeIndex>0 ? line.slice(0,codeIndex).trim() : pendingName;
        pushRow(pendingPeriod,tail[1],namePart || pendingName,[tail[2],tail[3],tail[4],tail[5],tail[6],tail[7]],tail[8]);
        pendingPeriod=''; pendingName=''; continue;
      }
      // If the line is just part of the discipline name, retain it for the next result line.
      if(!/^(Dr|Dra|Prof|Profa|MSc|Esp|Me|Ma)\.?\s/i.test(line) && !/^\d{2,3}\s+\d+\s+\d+/.test(line)) pendingName=`${pendingName} ${line}`.trim();
    }
  }

  // Fallback for PDFs where pdf-parse collapses line breaks into large blocks.
  if(!rows.length){
    const blockRe=/(^|\n)(\d{4}\.\d)\s+([\s\S]*?)(?=\n\d{4}\.\d\s+|\nPágina\s+\d+\s+de\s+\d+|\nComponentes Curriculares Obrigatórios Pendentes|\nComponentes Extra Curriculares|\nLegenda\b|$)/g;
    let match;
    while((match=blockRe.exec(source))){
      const periodo=match[2]; const block=match[3].replace(/\s+/g,' ').trim();
      if(!block || /^(ENADE\b|SISU\b)/i.test(block)) continue;
      const codeMatch=block.match(/\b([A-Z]{2,5}\s?\d{3,5})\b/); if(!codeMatch) continue;
      const statusMatch=block.match(new RegExp('\\b('+statusRe+')\\b\\s*$','i')); if(!statusMatch) continue;
      const before=block.slice(0,codeMatch.index).trim();
      const teacherAt=before.search(/\s+(?:Dr|Dra|Prof|Profa|MSc|Esp|Me|Ma)\.?\s+/i);
      const nome=cleanName(teacherAt>0?before.slice(0,teacherAt):before);
      const tail=block.slice(codeMatch.index+codeMatch[0].length,statusMatch.index);
      const nums=[...tail.matchAll(/(?:^|\s)(\d+(?:[.,]\d+)?|--)(?=\s|$)/g)].map(m=>m[1]);
      pushRow(periodo,codeMatch[1],nome,nums,statusMatch[1]);
    }
  }

  const periods={};
  for(const row of rows){
    if(!periods[row.periodo]) periods[row.periodo]=[];
    if(!periods[row.periodo].some(x=>x.codigo===row.codigo)) periods[row.periodo].push(row);
  }
  const periodos=Object.keys(periods).sort().map(periodo=>({periodo,disciplinas:periods[periodo]})).filter(p=>p.disciplinas.length);
  const atual=[...periodos].reverse().find(p=>p.disciplinas.some(d=>String(d.status||d.situacao||'').toUpperCase()==='MATR'||String(d.status||d.situacao||'').toUpperCase()==='REC'))?.periodo||'';
  return {periodos,periodoAtualDetectado:atual,equivalencias:[]};
}

function parseJsonResponse(text){
  const clean=String(text||'').replace(/```json|```/gi,'').trim();
  try{return JSON.parse(clean);}catch(_){
    const first=clean.indexOf('{'), last=clean.lastIndexOf('}');
    if(first>=0&&last>first){try{return JSON.parse(clean.slice(first,last+1));}catch(__){}}
    return null;
  }
}

function mergeJsonObjects(objects){
  const out={};
  for(const obj of objects){
    if(!obj || typeof obj!=='object') continue;
    for(const [key,value] of Object.entries(obj)){
      if(Array.isArray(value)){
        if(!Array.isArray(out[key])) out[key]=[];
        out[key].push(...value);
      }else if((out[key]===undefined || out[key]===null || out[key]==='') && value!==undefined && value!==null && value!=='') out[key]=value;
    }
  }
  for(const [key,value] of Object.entries(out)){
    if(!Array.isArray(value)) continue;
    const seen=new Set();
    out[key]=value.filter(item=>{
      if(item===null || item===undefined) return false;
      const norm=item&&typeof item==='object' ? Object.fromEntries(Object.entries(item).map(([k,v])=>[k,typeof v==='string'?v.trim():v])) : item;
      const signature=JSON.stringify(norm);
      if(seen.has(signature)) return false;
      seen.add(signature); return true;
    });
  }
  return out;
}

module.exports={TEXT_MODEL,SMALL_TEXT_MODEL,VISION_MODEL,GEMINI_MODEL,GEMINI_VISION_MODEL,requestId,geminiContentsToGroq,buildMessagesFromGemini,callAI,callGemini,callGroq,splitIntoChunks,parseJsonResponse,mergeJsonObjects,CHUNK_CHARS,sniffMimeFromBase64,normalizeExtractedPdfText,parseSigaaHistoryText};
