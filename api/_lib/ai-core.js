// SLCampus AI Core — provider-agnostic server-side gateway.
// Primary text model: OpenAI GPT-OSS 120B on Groq.
// Vision/document model: Qwen 3.8 27B on Groq.
// API key is server-only (GROQ_API_KEY).
const quota = require('./gemini-admin-quota');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const TEXT_MODEL = process.env.SLC_AI_TEXT_MODEL || 'openai/gpt-oss-120b';
const SMALL_TEXT_MODEL = process.env.SLC_AI_FALLBACK_MODEL || 'openai/gpt-oss-20b';
const VISION_MODEL = process.env.SLC_AI_VISION_MODEL || 'qwen/qwen3.8-27b';
const MAX_RETRIES = 1;
const TIMEOUT_MS = Number(process.env.SLC_AI_TIMEOUT_MS || 20000);
const PDF_MAX_TEXT_CHARS = 64000;
const CHUNK_CHARS = 10000;

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function requestId(prefix='ai'){ return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,9)}`; }
function isRetryable(status, data){
  const msg=String(data?.error?.message||'').toLowerCase();
  return [408,429,500,502,503,504].includes(status) || /overload|temporar|unavailable|timeout|rate.?limit|capacity/.test(msg);
}
function jsonText(data){ return data?.choices?.[0]?.message?.content || ''; }

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

async function callGroq({messages, systemInstruction='', json=false, model=TEXT_MODEL, operation='mentor', uid, email, requestId:rid, maxTokens=1400, reasoningEffort='medium'}){
  const key=process.env.GROQ_API_KEY;
  if(!key) return {ok:false,status:503,error:'GROQ_API_KEY não configurada no Vercel.',code:'GROQ_NOT_CONFIGURED'};
  const models = model===VISION_MODEL ? [VISION_MODEL] : [model, SMALL_TEXT_MODEL].filter((v,i,a)=>v && a.indexOf(v)===i);
  let last=null;
  for(let mi=0;mi<models.length;mi++){
    const current=models[mi];
    for(let attempt=0;attempt<=MAX_RETRIES;attempt++){
      if(attempt>0) await sleep(Math.min(2500,1000*attempt));
      const reservation=await quota.reserveGlobalCall({uid,email,operation,model:current,requestId:rid});
      if(reservation.blocked){
        return {ok:false,status:503,blocked:true,code:operation==='import'?'GLOBAL_AI_LIMIT':'GLOBAL_CHAT_LIMIT',error:'Limite interno diário de IA atingido temporariamente.'};
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
        status=response.status; data=await response.json().catch(()=>({}));
        outcome=response.ok?'success':(isRetryable(status,data)?'transient-error':'error');
        if(response.ok) return {ok:true,status,modelUsed:current,data,text:jsonText(data),usage:data.usage||{},attempts:mi+attempt+1};
        last={ok:false,status,data,model:current,transient:isRetryable(status,data)};
      }catch(err){
        status=err?.name==='AbortError'?504:503;
        data={error:{message:err?.name==='AbortError'?`A IA demorou mais de ${Math.round(TIMEOUT_MS/1000)}s para responder.`:(err?.message||'Falha de rede ao chamar a IA.')}};
        last={ok:false,status,data,model:current,transient:true};
      }finally{
        clearTimeout(timer);
        await quota.finishCall(reservation.logId,{status:outcome,httpStatus:status,success:outcome==='success',latencyMs:Date.now()-started,errorMessage:data?.error?.message||'',retryable:isRetryable(status,data),provider:'groq'});
      }
      if(!last?.transient) break;
    }
    if(current===VISION_MODEL) break;
  }
  const status=last?.status||503;
  const raw=last?.data?.error?.message||'';
  return {ok:false,status,error:status===429?'A IA atingiu o limite temporário de requisições. Aguarde alguns segundos e tente novamente.':status===503?'A IA está temporariamente indisponível. Tente novamente em alguns segundos.':raw||`Erro HTTP ${status} da IA.`,code:status===429?'GROQ_429':status===504?'GROQ_504':'GROQ_ERROR'};
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
  const blockRe=/(^|\n)(\d{4}\.\d)\s+([\s\S]*?)(?=\n\d{4}\.\d\s+|\nPágina\s+\d+\s+de\s+\d+|\nComponentes Curriculares Obrigatórios Pendentes|\nComponentes Extra Curriculares|\nLegenda\b|$)/g;
  const periods={};
  let match;
  while((match=blockRe.exec(source))){
    const periodo=match[2];
    const block=match[3].replace(/\s+/g,' ').trim();
    if(!block || /^(ENADE\b|SISU\b)/i.test(block)) continue;
    const codeMatch=block.match(/\b([A-Z]{2,5}\s?\d{3,5})\b/);
    if(!codeMatch) continue;
    const codigo=codeMatch[1].replace(/\s+/g,'').toUpperCase();
    // O SIGAA coloca docente antes do código. O nome da disciplina vem antes
    // do primeiro docente; se não houver docente, usamos o trecho antes do código.
    let before=block.slice(0,codeMatch.index).trim();
    const teacherAt=before.search(/\s+(?:Dr|Dra|Prof|Profa|MSc|Esp|Me|Ma)\.?\s+/i);
    if(teacherAt>0) before=before.slice(0,teacherAt).trim();
    before=before.replace(/\s+e\s*$/i,'').trim();
    if(!before) continue;
    // Remove cabeçalhos que eventualmente ficaram no mesmo bloco.
    before=before.replace(/^(?:Histórico Escolar.*?|Componentes Curriculares Cursados\/Cursando\s*)/i,'').trim();
    const statusMatch=block.match(new RegExp('\\b('+statusRe+')\\b\\s*$','i'));
    const situacao=statusMatch?statusMatch[1].toUpperCase():'';
    if(!situacao) continue;
    const tail=statusMatch?block.slice(codeMatch.index+codeMatch[0].length,statusMatch.index):'';
    const nums=[...tail.matchAll(/(?:^|\s)(\d+(?:[.,]\d+)?|--)(?=\s|$)/g)].map(m=>m[1]);
    const cleanNum=v=>v==='--'?null:Number(String(v).replace(',','.'));
    // Depois do código, o SIGAA costuma trazer CH, hora-aula, turma, frequência,
    // média e nota mínima. A média final é o penúltimo valor numérico antes da situação.
    const numeric=nums.map(cleanNum).filter(v=>v!==null || nums.length);
    let frequencia=null, notaFinal=null;
    if(nums.length>=2){
      const vals=nums.map(cleanNum);
      // frequência é o valor que costuma aparecer antes da média; notas vêm no fim.
      for(let i=vals.length-1;i>=0;i--){ if(vals[i]!==null){ notaFinal=vals[i]; break; } }
      if(vals.length>=4 && vals[3]!==null && vals[3]>=0 && vals[3]<=100) frequencia=vals[3];
      // Em registros MATR/sem nota, o bloco termina em -- --, portanto nota deve ser null.
      if(/^(MATR|REC|TRANC|CANC)$/i.test(situacao)) notaFinal=null;
    }
    const row={codigo,nome:before.replace(/\s+/g,' ').trim(),cargaHoraria:nums.length?cleanNum(nums[0])||0:0,notaFinal,situacao,frequencia};
    if(!periods[periodo]) periods[periodo]=[];
    if(!periods[periodo].some(x=>x.codigo===row.codigo)) periods[periodo].push(row);
  }
  const periodos=Object.keys(periods).sort().map(periodo=>({periodo,disciplinas:periods[periodo]})).filter(p=>p.disciplinas.length);
  const atual=[...periodos].reverse().find(p=>p.disciplinas.some(d=>d.situacao==='MATR'||d.situacao==='REC'))?.periodo||'';
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

module.exports={TEXT_MODEL,SMALL_TEXT_MODEL,VISION_MODEL,requestId,geminiContentsToGroq,buildMessagesFromGemini,callGroq,splitIntoChunks,parseJsonResponse,mergeJsonObjects,CHUNK_CHARS,sniffMimeFromBase64,normalizeExtractedPdfText,parseSigaaHistoryText};
