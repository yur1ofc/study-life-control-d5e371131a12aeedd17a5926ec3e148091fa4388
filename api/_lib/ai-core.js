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
      // PDFs are handled by api/gemini.js before reaching this converter.
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
    // Vision has no text fallback because the fallback model cannot inspect images.
    if(current===VISION_MODEL) break;
  }
  const status=last?.status||503;
  const raw=last?.data?.error?.message||'';
  return {ok:false,status,error:status===429?'A IA atingiu o limite temporário de requisições. Aguarde alguns segundos e tente novamente.':status===503?'A IA está temporariamente indisponível. Tente novamente em alguns segundos.':raw||`Erro HTTP ${status} da IA.`,code:status===429?'GROQ_429':status===504?'GROQ_504':'GROQ_ERROR'};
}

function dataUrlFromPart(part){
  const d=part?.inline_data||part?.inlineData;
  if(!d?.data) return null;
  const mime=String(d.mime_type||d.mimeType||'image/jpeg');
  return {mime,dataUrl:`data:${mime};base64,${d.data}`};
}

async function extractPdfText(contents){
  let pdfCount=0; const out=[];
  for(const c of (contents||[])){
    for(const part of (c?.parts||[])){
      const d=part?.inline_data||part?.inlineData;
      if(d?.data && /^application\/pdf$/i.test(String(d.mime_type||d.mimeType||''))){
        pdfCount++;
        const buffer=Buffer.from(String(d.data),'base64');
        if(buffer.length>12*1024*1024) throw new Error('PDF muito grande. Envie um arquivo de até 12 MB.');
        try{
          const pdfParse=require('pdf-parse');
          const parsed=await pdfParse(buffer);
          out.push(String(parsed.text||'').slice(0,24000));
        }catch(err){ throw new Error(`Não consegui extrair o texto do PDF: ${err.message||'arquivo incompatível'}`); }
      }
    }
  }
  return {pdfCount,text:out.join('\n\n--- NOVO PDF ---\n\n')};
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
  return {messages:normalized,hasImage,pdfCount:pdf.pdfCount};
}

module.exports={TEXT_MODEL,SMALL_TEXT_MODEL,VISION_MODEL,requestId,geminiContentsToGroq,buildMessagesFromGemini,callGroq};
