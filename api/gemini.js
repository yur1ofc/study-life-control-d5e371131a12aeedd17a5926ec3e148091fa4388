// SLCampus — endpoint de importação mantido por compatibilidade.
// O AI Core decide automaticamente entre Gemini e Groq.
const quota=require('./_lib/gemini-admin-quota');
const AI=require('./_lib/ai-core');
const ALLOWED_ORIGINS=['https://slcampus.vercel.app','https://study-life-control.vercel.app'];
function origin(req){const o=req.headers.origin||'';if(ALLOWED_ORIGINS.includes(o))return o;if(/^https:\/\/(?:slcampus|study-life-control)(-[a-z0-9-]+)?\.vercel\.app$/.test(o))return o;if(/^http:\/\/(?:localhost|127\.0\.0\.1)(:\d+)?$/.test(o))return o;return ALLOWED_ORIGINS[0];}
async function verifyFirebaseToken(idToken){const apiKey=process.env.FIREBASE_API_KEY;if(!apiKey)throw new Error('FIREBASE_API_KEY não configurada no servidor.');const r=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken})});const d=await r.json().catch(()=>({}));const u=d?.users?.[0];if(!r.ok||!u?.localId)throw new Error('unauthorized');return {uid:u.localId,email:String(u.email||'').toLowerCase()};}
module.exports=async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin',origin(req));res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
  if(req.method==='OPTIONS')return res.status(200).end();if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const auth=req.headers.authorization||'';const token=auth.startsWith('Bearer ')?auth.slice(7):'';if(!token)return res.status(401).json({error:'É preciso estar logado para usar a IA.'});
  let user;try{user=await verifyFirebaseToken(token);}catch{return res.status(401).json({error:'Sessão inválida ou expirada. Recarregue a página e faça login novamente.'});}
  let body;try{body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});}catch{return res.status(400).json({error:'JSON inválido.'});}
  if(!Array.isArray(body.contents)||!body.contents.length)return res.status(400).json({error:'Requisição inválida: falta "contents".'});
  const rid=AI.requestId('imp');
  try{
    // Primeiro extraímos o arquivo. Histórico SIGAA estruturado não precisa gastar
    // uma chamada de LLM: o parser determinístico é mais confiável e também evita
    // que testes/reimportações sejam bloqueados pelo orçamento diário da IA.
    const built=await AI.buildMessagesFromGemini(body.contents);
    if(!built.messages.length)return res.status(400).json({error:'Nenhum conteúdo utilizável foi encontrado no arquivo.'});
    const requestPromptText=(body.contents||[]).flatMap(c=>Array.isArray(c?.parts)?c.parts:[]).map(p=>p?.text||'').join('\n');
    const looksLikeHistory=/hist[oó]rico escolar|Componentes Curriculares Cursados\/Cursando|periodoAtualDetectado|situa[cç][oõ]es devem usar as siglas do SIGAA/i.test(requestPromptText);
    const looksLikeGrade=/grade curricular|fluxograma|\"faculdade\"[\s\S]*\"disciplinas\"|\"cargaHoraria\"/i.test(requestPromptText);

    if(looksLikeHistory && !built.hasImage && built.pdfChunks?.length){
      const deterministic=AI.parseSigaaHistoryText(built.pdfChunks.join('\n\n'));
      if(deterministic.periodos.length){
        return res.status(200).json({
          candidates:[{content:{role:'model',parts:[{text:JSON.stringify(deterministic)}]}}],
          meta:{provider:'local-sigaa-parser',model:'deterministic',requestId:rid,pdfCount:built.pdfCount,chunks:built.pdfChunks.length,extractedTextChars:String(built.pdfChunks.join('')).length}
        });
      }
    }

    // Só depois da extração/fallback local reservamos uma chamada de IA.
    let usage;try{
      usage=await quota.reserveUserOperation({uid:user.uid,email:user.email,operation:'import',requestId:rid});
      if(usage.blocked)return res.status(429).json({error:`Limite de ${quota.USER_IMPORT_LIMIT} importações por dia atingido. Tente novamente amanhã.`,code:'LOCAL_USER_LIMIT'});
    }catch(err){console.error('[api/gemini] quota:',err);return res.status(503).json({error:'O controle de uso da IA está temporariamente indisponível.',code:'QUOTA_STORE_UNAVAILABLE'});}

    const failImport=async(status,payload)=>{try{await quota.releaseUserOperation({uid:user.uid,operation:'import'});}catch(e){console.warn('[api/gemini] falha ao devolver quota:',e.message);}return res.status(status).json(payload);};
    let results=[];let providersUsed=new Set();
    const model=built.hasImage?AI.VISION_MODEL:AI.TEXT_MODEL;
    const prompt=built.hasImage?'Extraia e organize os dados visíveis nas imagens para a finalidade solicitada pelo usuário. Retorne JSON válido e não invente dados.':'Extraia e organize fielmente os dados do conteúdo fornecido para a finalidade solicitada pelo usuário. Retorne JSON válido e não invente dados.';
    const chunks=built.pdfChunks?.length ? built.pdfChunks : null;
    try{
      if(chunks && chunks.length>1 && !built.hasImage){
        for(let i=0;i<chunks.length;i++){
          const chunkMessages=[
            ...(built.messages.filter(m=>m.content && typeof m.content==='string' && !m.content.startsWith('CONTEÚDO EXTRAÍDO DE PDF(S):'))),
            {role:'user',content:`BLOCO ${i+1} DE ${chunks.length} DO PDF:\n${chunks[i]}\n\nExtraia somente os dados que realmente aparecem neste bloco. Preserve exatamente a estrutura JSON solicitada no conteúdo/prompt. Não invente dados.`}
          ];
          const result=await AI.callAI({messages:chunkMessages,systemInstruction:prompt,operation:'import',uid:user.uid,email:user.email,requestId:`${rid}_b${i+1}`,maxTokens:3500,reasoningEffort:'low',model,json:true});
          if(!result.ok) return failImport(result.status||503,{error:result.error,code:result.code,provider:result.provider||'none',requestId:rid,chunk:i+1});
          const parsed=AI.parseJsonResponse(result.text);
          if(!parsed)return failImport(502,{error:`A IA retornou um JSON inválido no bloco ${i+1}.`,code:'AI_BAD_JSON',provider:result.provider||'none',requestId:rid});
          results.push(parsed);providersUsed.add(result.provider||'unknown');
        }
      }else{
        const result=await AI.callAI({messages:built.messages,systemInstruction:prompt,operation:'import',uid:user.uid,email:user.email,requestId:rid,maxTokens:6000,reasoningEffort:'low',model,json:true});
        if(!result.ok)return failImport(result.status||503,{error:result.error,code:result.code,provider:result.provider||'none',requestId:rid});
        let parsed=AI.parseJsonResponse(result.text);

        // A importação de grade não deve depender de uma segunda tentativa manual.
        // Mesmo com response_format=json, alguns modelos podem devolver um objeto
        // válido porém sem a chave/estrutura esperada. Fazemos a correção no servidor
        // dentro da mesma operação do usuário.
        const gradeNeedsRepair=looksLikeGrade && (!parsed || !Array.isArray(parsed.disciplinas) || !parsed.disciplinas.length);
        if(gradeNeedsRepair){
          const gradeRepairPrompt=`Você está corrigindo uma importação de grade curricular.
Retorne SOMENTE um objeto JSON válido neste formato exato:
{\"faculdade\":\"\",\"curso\":\"\",\"disciplinas\":[{\"nome\":\"\",\"codigo\":\"\",\"semestre\":0,\"cargaHoraria\":0,\"creditos\":0,\"prerequisitos\":[],\"tipo\":\"obrigatoria\"}]}

Extraia todas as disciplinas realmente presentes no conteúdo. Não invente disciplinas.
Se semestre, código, carga horária ou créditos não estiverem disponíveis, use 0 ou string vazia.
O conteúdo pode vir de PDF, tabela, fluxograma ou texto com quebras de linha desorganizadas.

Conteúdo original:
${built.messages.map(m=>typeof m.content==='string'?m.content:'').join('\n\n')}`;
          const repairMessages=[...built.messages,{role:'user',content:gradeRepairPrompt}];
          const repaired=await AI.callAI({messages:repairMessages,systemInstruction:'Extraia dados acadêmicos com máxima fidelidade. Retorne apenas JSON válido.',operation:'import',uid:user.uid,email:user.email,requestId:`${rid}_grade_repair`,maxTokens:7000,reasoningEffort:'medium',model:AI.TEXT_MODEL,json:true});
          if(repaired.ok){
            const repairedParsed=AI.parseJsonResponse(repaired.text);
            if(repairedParsed?.disciplinas?.length){
              parsed=repairedParsed;
              providersUsed.add(repaired.provider||'unknown');
            }
          }
        }

        if(!parsed)return failImport(502,{error:'Não foi possível estruturar a grade automaticamente. Tente novamente com o mesmo arquivo.',code:'AI_BAD_JSON',provider:result.provider||'none',requestId:rid});
        if(looksLikeGrade && (!Array.isArray(parsed.disciplinas)||!parsed.disciplinas.length)){
          return failImport(422,{error:'Não foi possível identificar as disciplinas da grade neste arquivo. Tente usar o PDF original da grade/fluxograma.',code:'GRADE_NO_DISCIPLINES',provider:result.provider||'none',requestId:rid});
        }
        results=[parsed];providersUsed.add(result.provider||'unknown');
      }

      let merged=AI.mergeJsonObjects(results);
      if(!built.hasImage && looksLikeHistory && built.pdfChunks?.length){
        const deterministic=AI.parseSigaaHistoryText(built.pdfChunks.join('\n\n'));
        const aiHasHistory=Array.isArray(merged?.periodos) && merged.periodos.some(p=>Array.isArray(p?.disciplinas)&&p.disciplinas.length);
        if(!aiHasHistory && deterministic.periodos.length){merged={...merged,...deterministic};}
        else if(deterministic.periodos.length){
          const byPeriod=new Map((merged.periodos||[]).map(p=>[String(p.periodo),p]));
          deterministic.periodos.forEach(dp=>{if(!byPeriod.has(dp.periodo)||!(byPeriod.get(dp.periodo)?.disciplinas||[]).length)byPeriod.set(dp.periodo,dp);});
          merged={...merged,periodos:[...byPeriod.values()].sort((a,b)=>String(a.periodo).localeCompare(String(b.periodo)))};
          if(!merged.periodoAtualDetectado)merged.periodoAtualDetectado=deterministic.periodoAtualDetectado;
        }
      }
      if(looksLikeGrade && !built.hasImage && (!Array.isArray(merged.disciplinas)||merged.disciplinas.length===0) && built.pdfChunks?.length){
        const rawPdfText=String(built.pdfChunks.join('\n\n')).slice(0,56000);
        const rescuePrompt=`Extraia a grade curricular do texto abaixo. Retorne SOMENTE JSON válido no formato:
{\"faculdade\":\"\",\"curso\":\"\",\"disciplinas\":[{\"nome\":\"\",\"codigo\":\"\",\"semestre\":0,\"cargaHoraria\":0,\"creditos\":0,\"prerequisitos\":[],\"tipo\":\"obrigatoria\"}]}

Extraia somente disciplinas que realmente aparecem. Não invente dados.

TEXTO:
${rawPdfText}`;
        const rescue=await AI.callAI({messages:[{role:'user',content:rescuePrompt}],systemInstruction:'Faça extração estruturada de grade acadêmica. Retorne apenas JSON válido.',operation:'import',uid:user.uid,email:user.email,requestId:`${rid}_rescue`,maxTokens:7000,reasoningEffort:'medium',model:AI.TEXT_MODEL,json:true});
        if(rescue.ok){
          const rescued=AI.parseJsonResponse(rescue.text);
          if(rescued?.disciplinas?.length){merged=AI.mergeJsonObjects([merged,rescued]);providersUsed.add(rescue.provider||'unknown');}
        }
      }
      return res.status(200).json({candidates:[{content:{role:'model',parts:[{text:JSON.stringify(merged)}]}}],meta:{provider:[...providersUsed].join(','),model,requestId:rid,pdfCount:built.pdfCount,chunks:results.length,extractedTextChars:String(built.pdfChunks?.join('')||'').length}});
    }catch(err){
      // Uma tentativa que falhou não deve gastar permanentemente a vaga diária do usuário.
      try{await quota.releaseUserOperation({uid:user.uid,operation:'import'});}catch(releaseErr){console.warn('[api/gemini] falha ao devolver quota:',releaseErr.message);}
      throw err;
    }
  }catch(err){console.error('[api/gemini] internal:',err);return res.status(err?.status||500).json({error:err.message||'Erro interno na IA.',code:err.code||'AI_INTERNAL_ERROR',requestId:rid});}
};
