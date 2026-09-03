import type { NormalizedLead } from '@/lib/domain/types';
const base=()=>process.env.VESTA_RENDER_LEARNING_API_URL?.replace(/\/$/,'')||'';
const key=()=>process.env.VESTA_RENDER_LEARNING_API_KEY||'';
const timeout=()=>Math.max(250,Math.min(5000,Number(process.env.VESTA_RENDER_TIMEOUT_MS||1500)));
export type AdvisoryConsumer='learn'|'manager'|'flow';
const enabled=(consumer:AdvisoryConsumer)=>process.env[`VESTA_RENDER_${consumer.toUpperCase()}_ADVISORY_ENABLED`]==='true'||(consumer==='learn'&&process.env.VESTA_RENDER_LEARN_ENABLED==='true');
export async function getRenderAdvisory(consumer:AdvisoryConsumer,leads:NormalizedLead[]){
 if(!enabled(consumer)||!base()||!leads.length)return {enabled:false,available:false,mode:'existing-rules' as const,predictions:[]};
 try{const response=await fetch(`${base()}/v1/score`,{method:'POST',headers:{'content-type':'application/json',...(key()?{authorization:`Bearer ${key()}`}:{})},body:JSON.stringify({leads}),cache:'no-store',signal:AbortSignal.timeout(timeout())}),body=await response.json();if(!response.ok||!body.ok)throw new Error(body.error||`Render advisory ${response.status}`);return {enabled:true,available:true,mode:'render-advisory' as const,predictions:body.predictions||[],authoritative:false}}
 catch(error){return {enabled:true,available:false,mode:'existing-rules' as const,predictions:[],error:error instanceof Error?error.message:'Render advisory unavailable'}}
}
