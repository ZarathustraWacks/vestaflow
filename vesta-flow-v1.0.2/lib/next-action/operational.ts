/** Operational admission is separate from preview, CRM truth and first-call metrics. */
import {planNextAction,type NextActionPolicy} from './engine';
import policyData from './policy.json';
import {NEXT_ACTION_EVIDENCE} from './evidence';
import {addCentralBusinessMinutes} from '../policy/business-time';
export const NEXT_ACTION_RECEIPT='vesta-next-action-receipt-v2';
export const operationalNextActionsEnabled=()=>process.env.NEXT_PUBLIC_VESTA_NEXT_ACTION_OPERATIONAL==='true';
const policy=policyData as NextActionPolicy,valid=(v:any,now:number)=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&Date.parse(v)<=now;
const future=(v:any,now:number)=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&Date.parse(v)>now?v:null;
let calendar:{minute:number;open:boolean;next:string}|undefined;
function office(now:number){const minute=Math.floor(now/60000);if(calendar?.minute===minute)return calendar;const next=addCentralBusinessMinutes(now,0);return calendar={minute,open:next===now,next:new Date(next??now).toISOString()};}
export function currentNextAction(lead:any,events:any[]=[],now=Date.now()){
 const owner=lead.assignedUserId,history=[...events,...(lead.flowActionReceipt?[lead.flowActionReceipt]:[])].filter(e=>String(e.leadId)===String(lead.id)&&(e.actorUserId===owner||String(e.kind).startsWith('management.'))&&valid(e.createdAt,now)).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
 const latest=history.find(e=>e.metadata?.nextAction?.contractVersion===NEXT_ACTION_RECEIPT&&e.metadata.nextAction.ownerId===owner),saved=latest?.metadata.nextAction;
 const inputEvidence=lead.nextActionEvidence,proof=inputEvidence?.contractVersion===NEXT_ACTION_EVIDENCE&&valid(inputEvidence.cutoff,now)?inputEvidence:null;
 const inquiry=proof?.inquiry&&String(proof.inquiry.personId)===String(lead.id)&&valid(proof.inquiry.at,now)?proof.inquiry:null;
 const at=[lead.handRaiseAt,inquiry?.at].filter(value=>valid(value,now)&&now-Date.parse(value)<=policy.activationLookbackDays*86400000).sort((a,b)=>Date.parse(b)-Date.parse(a))[0]||null;
 const imported=(lead.tags||[]).some((t:any)=>String(t).toLowerCase()==='import')||/import|migrat/i.test(String(lead.source||''));
 const initial=!at&&!imported&&lead.ageBand==='Fresh'&&['lead','attempted contact','buyer new and needs contact','buyer new needs contact'].includes(String(lead.cadenceStage||lead.stage||'').toLowerCase())&&valid(lead.createdAt,now)&&now-Date.parse(lead.createdAt)<=policy.activationLookbackDays*86400000?lead.createdAt:null;
 const opened=at&&(!saved?.episode?.openedAt||Date.parse(at)>Date.parse(saved.episode.openedAt))?at:saved?.episode?.openedAt||at||initial;
 const sameEpisode=!!saved&&saved.episode?.openedAt===opened;
 const step=sameEpisode?Number(saved.step)||0:0;
 const intent=sameEpisode&&['buyer','seller','renter'].includes(saved.confirmedIntent)?saved.confirmedIntent:null;
 // An explicit broker confirmation changes only the operating interpretation,
 // preserving the original FUB source, tags and classification on the lead.
 const interpretation=intent?{...lead,leadLane:intent,businessSegment:intent==='renter'?'rental':'buyer-seller',tags:(lead.tags||[]).filter((t:any)=>!['renter','rental','renters','rentals'].includes(String(t).toLowerCase()))}:lead;
 const calls=new Map<string,any>();for(const call of [...(sameEpisode?saved.verifiedCalls||[]:[]),...(proof?.calls||[])])if(call?.verified===true&&call.outbound===true&&call.ownerId===owner&&String(call.personId)===String(lead.id)&&valid(call.at,now)&&(!opened||Date.parse(call.at)>=Date.parse(opened)))calls.set(call.id,call);
 const verifiedCalls=[...calls.values()].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)||String(a.id).localeCompare(String(b.id))).slice(-32),hours=office(now);
 const complete=proof?.callHistoryComplete===true;
 const connectionProofAt=[...(sameEpisode?[saved?.connectionProofAt]:[]),...history.filter(e=>e.kind==='broker.complete'&&e.metadata?.fubSync?.delivered===true&&e.metadata.fubSync.simulated!==true&&['Connected conversation','Appointment scheduled','Appointment confirmed','Appointment completed'].includes(e.outcome)).map(e=>e.createdAt)].filter(v=>valid(v,now)&&(!opened||Date.parse(v)>=Date.parse(opened))).sort((a,b)=>Date.parse(b)-Date.parse(a))[0]||null;
 const contextEvents=connectionProofAt?[...history,{id:'retained-connection',kind:'broker.complete',leadId:String(lead.id),actorUserId:owner,createdAt:connectionProofAt,outcome:'Connected conversation',metadata:{fubSync:{delivered:true,simulated:false}}}]:history;
 const workingLead={...interpretation,handRaiseAt:at||lead.handRaiseAt,...(sameEpisode&&saved.agreedFollowUpAt?{agreedFollowUpAt:saved.agreedFollowUpAt}:{})};
 let plan=planNextAction(workingLead,policy,{now,events:contextEvents,calls:verifiedCalls,callsComplete:complete,officeOpen:hours.open,nextWorkingAt:hours.next,episodeOpenedAt:opened});
 if(intent==='renter'&&plan.state==='classification-review')plan={...plan,state:'excluded',label:'Continue in the confirmed rental workflow',reason:'The broker explicitly confirmed current rental intent; buyer outreach is not admitted.'};
 if(plan.state==='connecting'&&!hours.open&&verifiedCalls.length>0)plan={...plan,label:'Choose the next connection attempt time',dueAt:null,dueBasis:'The office reporting window is closed. Choose an explicit broker working time rather than automatically deferring the opportunity.'};
 const nextAt=sameEpisode&&future(saved.nextAt,now)&&(!at||Date.parse(at)<=Date.parse(latest.createdAt))?saved.nextAt:plan.state==='appointment-set'?null:plan.dueAt;
 const held=!!nextAt&&Date.parse(nextAt)>now;
 const admitted=!!opened||!!saved;
 const eligible=!['excluded','waiting'].includes(plan.state)&&!!owner;
 const episode={id:sameEpisode?saved.episode.id:inquiry&&inquiry.at===opened?'inquiry:'+inquiry.id:'time:'+String(opened||lead.createdAt||lead.id),openedAt:opened,origin:at?'inquiry':'incoming'};
 const actionId=['na2',policy.version,owner,lead.id,episode.id,opened?Date.parse(opened):'ordinary',step].join(':');
 return {contractVersion:NEXT_ACTION_RECEIPT,mode:'operational',admitted,actionId,ownerId:owner,leadId:String(lead.id),step,episode,plan:{...plan,mode:'operational' as const},nextAt,held,eligible:eligible&&!held,verifiedCalls,connectionProofAt,callsComplete:complete,confirmedIntent:intent,agreedFollowUpAt:sameEpisode?saved.agreedFollowUpAt:null};
}
export function nextActionTransition(lead:any,events:any[],outcome:string,input:{nextAttemptAt?:string;confirmedIntent?:string},now=Date.now()){
 const current=currentNextAction(lead,events,now);let selected=future(input.nextAttemptAt,now);
 if(input.nextAttemptAt&&!selected)throw Error('Choose a future next-action time.');
 const intent=input.confirmedIntent||current.confirmedIntent;
 if(input.confirmedIntent&&!['buyer','seller','renter'].includes(input.confirmedIntent))throw Error('Choose buyer, seller or renter intent.');
 if(current.plan.state==='classification-review'&&!input.confirmedIntent)throw Error('Confirm the current buying, selling or renting intent before completing this review.');
 const synthetic={id:'transition',leadId:String(lead.id),actorUserId:lead.assignedUserId,kind:'broker.complete',createdAt:new Date(now).toISOString(),outcome,metadata:{fubSync:{delivered:true,simulated:false},nextAction:{...current,step:current.step+1,confirmedIntent:intent}}};
 const after=currentNextAction(lead,[synthetic,...events],now);
 const calls=after.verifiedCalls.length;let automatic:string|null=null;
 if(after.plan.state==='connecting'&&after.callsComplete){if((calls===1||calls===3)&&office(now).open)automatic=new Date(now).toISOString();else if(calls===2&&office(now).open){const due=Date.parse(after.verifiedCalls.at(-1)!.at)+policy.initialDoubleTapGapMinutes*60000;if(office(due).open)automatic=new Date(due).toISOString();}}
 if(!selected)selected=future(lead.nextTaskAt,now)||future(lead.nextAppointmentAt,now);
 if((['connecting','appointment-path'].includes(after.plan.state)||['Follow-up scheduled','Client not ready','Connected conversation','Outbound text sent','Outbound email sent','Outbound call — no answer','Left voicemail'].includes(outcome))&&!selected&&!automatic&&after.plan.state!=='excluded'&&!future(lead.nextAppointmentAt,now))throw Error('Set the next follow-up time so this opportunity has a specific next action. No later-attempt spacing is defined yet.');
 if(!selected)selected=automatic||future(lead.nextTaskAt,now)||future(lead.nextAppointmentAt,now);
 const customerTiming=['Client not ready','Follow-up scheduled'].includes(outcome)?selected:current.agreedFollowUpAt;
 return {contractVersion:NEXT_ACTION_RECEIPT,policyVersion:policy.version,actionId:current.actionId,ownerId:current.ownerId,leadId:current.leadId,step:current.step+1,episode:current.episode,nextAt:selected,confirmedIntent:intent||null,agreedFollowUpAt:customerTiming||null,verifiedCalls:current.verifiedCalls,connectionProofAt:after.connectionProofAt,previousObjective:current.plan.objective,nextObjective:after.plan.objective,nextState:after.plan.state,nextLabel:after.plan.label,recordedAt:new Date(now).toISOString()};
}
export function applyOperationalNextAction(lead:any,events:any[]=[],now=Date.now()){
 const action=currentNextAction(lead,events,now),review=action.plan.state==='classification-review'||action.plan.state==='evidence-review'||action.plan.state==='manager-review'||action.plan.state==='connection-overdue';
 const urgency=action.held?'Monitor':action.plan.state==='connecting'&&!lead.brokerOutreachAt?'Immediate':action.eligible?'Today':lead.decision?.urgency||'Monitor';
 return {...lead,nextAction:action,legacyDecision:lead.legacyDecision||lead.decision,decision:action.eligible&&action.admitted?{...lead.decision,type:review?'human-review':'contact',label:action.plan.label,urgency,rationale:action.plan.reason,consequence:'Complete the current objective or record its specific next step.',matchedRule:'next-action.'+action.plan.state}:lead.decision};
}
