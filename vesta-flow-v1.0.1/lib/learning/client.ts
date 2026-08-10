import type { NormalizedLead } from '@/lib/domain/types';
import type { LeadIntelligenceScore,LearningStatus } from './types';
const base=()=>process.env.VESTA_LEARNING_API_URL?.replace(/\/$/,'')||'';
const key=()=>process.env.VESTA_LEARNING_API_KEY||'';
function toPayload(lead:NormalizedLead){
 const created=lead.createdAt?new Date(lead.createdAt).getTime():Date.now();
 return {...lead,ageDays:Math.max(0,Math.floor((Date.now()-created)/86400000)),eventCount:Number((lead.raw as any)?.eventCount||0),openTaskCount:lead.nextTaskAt?1:0,callCount:Number((lead.raw as any)?.callCount||0),textCount:Number((lead.raw as any)?.textCount||0),emailCount:Number((lead.raw as any)?.emailCount||0),propertyViewCount:Number((lead.raw as any)?.propertyViewCount||0)};
}
function fallback(lead:NormalizedLead):LeadIntelligenceScore{
 const recent=lead.engagementBand==='Active now', fresh=lead.ageBand==='Fresh', owner=lead.assignedUserName!=='Unassigned', cadenceCurrent=['current','not-required'].includes(lead.cadenceStatus);
 const appointment=Math.min(.9,Math.max(.03,(recent?.35:.08)+(fresh?.16:0)+(owner?.08:0)+(cadenceCurrent?.12:0)+(lead.governanceScore/100)*.18));
 const closing=Math.min(.65,appointment*.48);const attrition=Math.min(.95,Math.max(.05,1-(lead.governanceScore/100)*.65-(recent?.18:0)));
  return {score:Math.round((appointment*.45+closing*.35+(1-attrition)*.2)*100),confidence:0,mode:'heuristic',modelVersion:'vesta-local-heuristic-11.0.8',generatedAt:new Date().toISOString(),outcomes:{contact7d:Math.min(.95,appointment+.18),appointment30d:appointment,client90d:Math.min(.8,appointment*.7),closing180d:closing,attrition30d:attrition,reactivation30d:lead.ageBand==='Fresh'?.05:Math.min(.7,recent?.55:.12)},recommendedAction:!owner?'assign':recent&&!lead.lastCommunicationAt?'call':!cadenceCurrent?'nurture':attrition>.7?'broker-review':'continue',positiveEvidence:[recent?'Recent CRM activity':'Governance signals available',owner?'Assigned agent':'',cadenceCurrent?'Approved cadence is current':''].filter(Boolean),negativeEvidence:['Heuristic only; no trained model response',!owner?'No assigned agent':'',!cadenceCurrent?'Approved cadence is due or unresolved':'',attrition>.7?'High attrition risk':''].filter(Boolean)};
}
function normalizePrediction(p:any):LeadIntelligenceScore{
 const map:Record<string,LeadIntelligenceScore['recommendedAction']>={'Call today':'call','Schedule appointment':'call','Recovery nurture':'nurture','Maintain cadence':'continue'};
 return {score:Number(p.score||0),confidence:Math.round(Number(p.confidence||0)*100),mode:p.mode==='trained'?'transformer':'baseline',modelVersion:String(p.modelVersion||'unknown'),generatedAt:new Date().toISOString(),outcomes:p.outcomes,recommendedAction:map[p.recommendedAction]||'continue',positiveEvidence:p.positiveEvidence||[],negativeEvidence:p.negativeEvidence||[]};
}
export async function scoreLeads(leads:NormalizedLead[]):Promise<LeadIntelligenceScore[]>{
 if(!base())return leads.map(fallback);
 try{const predictions:any[]=[];for(let i=0;i<leads.length;i+=500){const batch=leads.slice(i,i+500);const r=await fetch(`${base()}/v1/score`,{method:'POST',headers:{'content-type':'application/json',...(key()?{'authorization':`Bearer ${key()}`}:{})},body:JSON.stringify({leads:batch.map(toPayload)}),signal:AbortSignal.timeout(30000),cache:'no-store'});if(!r.ok)throw new Error(`Learning API ${r.status}`);const j=await r.json();predictions.push(...(Array.isArray(j.predictions)?j.predictions:[]));}const byId=new Map(predictions.map((x:any)=>[String(x.leadId),normalizePrediction(x)]));return leads.map(l=>byId.get(String(l.id))||fallback(l))}catch{return leads.map(fallback)}
}
export async function learningStatus():Promise<LearningStatus>{if(!base())return {enabled:false,reachable:false,modelVersion:null,mode:'unavailable',message:'VESTA_LEARNING_API_URL is not configured.'};try{const r=await fetch(`${base()}/health`,{headers:key()?{'authorization':`Bearer ${key()}`}:{},signal:AbortSignal.timeout(5000),cache:'no-store'});if(!r.ok)throw new Error();const j=await r.json();return {enabled:true,reachable:true,modelVersion:j.champion?.name||null,mode:j.modelReady?'transformer':'baseline',message:j.modelReady?'Trained champion is online.':'Service online; fallback scoring active until a champion is promoted.'}}catch{return {enabled:true,reachable:false,modelVersion:null,mode:'unavailable',message:'Learning service is configured but unreachable.'}}}
