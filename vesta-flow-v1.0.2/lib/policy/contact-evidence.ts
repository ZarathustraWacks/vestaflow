/** Shared source evidence. Source CRM fields are preserved, never written. */
import {enrichLead} from '@/lib/spine/governance';
import {cadencePolicy,policyStage} from '@/lib/policy/vesta';
import {newestCommunicationDate} from '@/lib/policy/communication';
import {resolveCadenceCommunication} from '@/lib/fub/normalize';
import {communicationOutcome,mergeContactContext,contextCreatedAt as created} from '@/lib/policy/contact-context';
export {communicationOutcome} from '@/lib/policy/contact-context';
export function applyContactEvidence(lead:any,collections:{notes?:any[];calls?:any[];textMessages?:any[]},now=Date.now()){
 const matches=(row:any)=>String(row.personId??row.person?.id??'')===String(lead.id)&&Boolean(created(row,now));
 const outcomes=[...(collections.notes||[]),...(collections.calls||[])].filter(matches).map(note=>communicationOutcome(note,now)).filter(Boolean).sort((a:any,b:any)=>Date.parse(b.at)-Date.parse(a.at));
 const outcome=outcomes.reduce((current:any,item:any)=>mergeContactContext(current,item),lead.contactContext||null);
 const integrationAt=outcome?.latestCommunication?.at||outcome?.at||null;
 const calls=(collections.calls||[]).filter(matches),texts=(collections.textMessages||[]).filter(matches).filter(row=>!row.isAutomated&&!row.automationId&&!row.actionPlanId&&!row.campaignId&&!row.leadFlowRouteId&&!['failed','queued','undelivered','scheduled','draft'].includes(String(row.status||'').toLowerCase())&&!['failed','undelivered'].includes(String(row.deliveryStatus||'').toLowerCase()));
 // Reuse the established direction parser. Duration or activity alone is not
 // evidence of a connected conversation; inbound/outbound timestamps stay separate.
 const facts=[...calls.map(row=>resolveCadenceCommunication({lastCall:{...row,created:created(row,now)}})),...texts.map(row=>resolveCadenceCommunication({lastText:{...row,created:created(row,now)}}))];
 const outreach=newestCommunicationDate(lead.brokerOutreachAt,...facts.map(row=>row.brokerOutreachAt));
 const response=newestCommunicationDate(lead.customerResponseAt,...facts.map(row=>row.customerResponseAt));
 const documentedContactAt=newestCommunicationDate(lead.documentedContactAt,outcome?.documentedContactAt||(outcome?.contactEstablished?outcome.at:null));
 // A later inbound message is engagement only if an earlier recorded outbound
 // exists. Never mark an unanswered attempt as a successful conversation.
 const outboundTimes=[lead.brokerOutreachAt,...facts.map(row=>row.brokerOutreachAt)].filter(Boolean);
 const paired=response&&outboundTimes.some(at=>Date.parse(at!)<=Date.parse(response));
 const communication=newestCommunicationDate(lead.lastCommunicationAt,outreach,paired?response:null,integrationAt);
 return {...lead,brokerOutreachAt:outreach,customerResponseAt:response,documentedContactAt,integrationCommunicationAt:integrationAt,twoWayEngagementAt:newestCommunicationDate(lead.twoWayEngagementAt,paired?response:null),lastCommunicationAt:communication,lastCommunicationSource:communication===outreach?(facts.find(row=>row.brokerOutreachAt===outreach)?.source||lead.lastCommunicationSource||'outbound-call'):communication===integrationAt?'integration-outcome':communication===response&&paired?(facts.find(row=>row.customerResponseAt===response)?.customerResponseSource?.replace('inbound-','two-way-')||lead.lastCommunicationSource):lead.lastCommunicationSource,contactContext:outcome,contactEvidenceAt:new Date(now).toISOString()};
}
const INITIAL=new Set(['lead','attempted contact','spoke with','nurture']);
export function enrichContactContext(lead:any,tasks:any[]=[],appointments:any[]=[]){
 const crmStage=lead.crmStage||lead.stage,stage=policyStage(crmStage),outcome=lead.contactContext||lead.raw?.vestaContactContext||null;
 if(outcome){const integrationAt=outcome.latestCommunication?.at||outcome.at;const at=newestCommunicationDate(lead.lastCommunicationAt,integrationAt);lead={...lead,contactContext:outcome,integrationCommunicationAt:integrationAt,documentedContactAt:newestCommunicationDate(lead.documentedContactAt,outcome.documentedContactAt||(outcome.contactEstablished?outcome.at:null)),lastCommunicationAt:at,lastCommunicationSource:at===integrationAt?'integration-outcome':lead.lastCommunicationSource};}
 const approvedTag=cadencePolicy({lane:'buyer',stage:'Nurture',tags:lead.tags||[]}).days!==null;
 const longTerm=outcome?.kind==='long-term'||Boolean(outcome?.timeframe&&/[0-9]\s*[-–]\s*[0-9]|12\+/.test(outcome.timeframe));
 // Current advanced stages win over old intake notes. A named, approved nurture
 // tag or documented long-term outcome can resolve a stale initial FUB stage.
 const supportedLane=['buyer','seller'].includes(lead.leadLane);
 const nurture=supportedLane&&INITIAL.has(stage)&&(approvedTag||longTerm);
 const explicitSeller=(lead.tags||[]).some((tag:string)=>/\bseller\b/i.test(tag));
 const explicitBuyer=(lead.tags||[]).some((tag:string)=>/^buyer$/i.test(tag.trim()));
 const lane=supportedLane&&INITIAL.has(stage)&&outcome?.lane&&!((outcome.lane==='seller'&&explicitBuyer)||(outcome.lane==='buyer'&&explicitSeller))?outcome.lane:lead.leadLane;
 const effectiveStage=nurture?'Nurture':crmStage;
 const contextConflict=Boolean(outcome?.kind==='review'&&INITIAL.has(stage))||Boolean(outcome?.lane&&!supportedLane)||Boolean(outcome?.lane&&INITIAL.has(stage)&&((outcome.lane==='seller'&&explicitBuyer)||(outcome.lane==='buyer'&&explicitSeller)))||Boolean(INITIAL.has(stage)&&approvedTag&&outcome?.kind==='connected'&&/hot lead|interested/i.test(outcome.outcome));
 let result=lead;
 if(nurture||lane!==lead.leadLane||lead.contactEvidenceAt){
  result=enrichLead({...lead,stage:effectiveStage,leadLane:lane,...(lane!==lead.leadLane?{businessSegment:'buyer-seller',businessSegmentEvidence:[...(lead.businessSegmentEvidence||[]),`integration-outcome:${outcome.noteId}:${outcome.lane}`],businessSegmentReason:`${outcome.laneEvidence?.source||outcome.source} recorded ${outcome.lane} intent in note ${outcome.laneEvidence?.noteId||outcome.noteId}; CRM stage is preserved.`}:{}),timeframeStatus:lead.timeframeStatus||outcome?.timeframe||null},tasks,appointments);
  result={...result,stage:crmStage,cadenceStage:effectiveStage,crmStage:crmStage,contactContext:outcome,contactEvidenceAt:lead.contactEvidenceAt};
 }
 if(outcome&&Array.isArray(result.operationalClocks))result={...result,operationalClocks:result.operationalClocks.map((item:any)=>item.key==='first-contact-attempt'&&Date.parse(item.clearedAt)===Date.parse(outcome.at)&&item.status==='met'?{...item,status:'resolved',clearingAction:'A recorded communication outcome resolves the open lead obligation. Its note timestamp does not certify broker first-response latency.'}:item)};
 const intentAt=newestCommunicationDate(result.handRaiseAt,result.customerResponseAt),intentFresh=intentAt&&Date.now()-Date.parse(intentAt)<=7*86400000&&(!result.brokerOutreachAt||Date.parse(intentAt)>Date.parse(result.brokerOutreachAt));
 if(result.decision?.matchedRule==='cadence.active-overdue'&&!intentFresh)result={...result,decision:{...result.decision,urgency:'Today',label:'Follow the due cadence',rationale:'Follow-up is due under the approved plan. A system update or broker outreach is not evidence of fresh customer intent.',matchedRule:'context.cadence-due-no-new-intent'}};
 if(contextConflict)result={...result,contextConflict,decision:{...result.decision,type:'human-review',urgency:'Today',label:'Review conflicting intent and nurture plan',rationale:'Recorded communication intent conflicts with the current CRM classification or nurture plan. Confirm the latest evidence before changing the plan.',matchedRule:'context.intent-conflict'}};
 return result;
}
