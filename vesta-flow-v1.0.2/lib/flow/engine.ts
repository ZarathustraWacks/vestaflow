import {flowRelationshipSignals,completionStillHeld,needsBuyerContact} from './relationships';
import {isOperationalLead} from '@/lib/operational-eligibility';
import type { FlowEvent,FlowItem,ManagementException } from './types';

const leadEvents=(events:FlowEvent[],leadId:string)=>events.filter(event=>event.leadId===leadId).sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());
const resolutionKinds=new Set(['management.reroute','management.return','management.nurture','management.kill']);

function latestOwnership(lead:any,events:FlowEvent[]){
 const ownership=events.find(event=>event.kind==='management.reroute'||event.kind==='management.return');
 return ownership?{id:ownership.targetUserId??lead.assignedUserId,name:ownership.targetUserName||lead.assignedUserName}:{id:lead.assignedUserId,name:lead.assignedUserName};
}

function priorityScore(lead:any,relationship=flowRelationshipSignals(lead)){
 const urgency=({Immediate:400,Today:300,'This week':200,Monitor:100} as Record<string,number>)[lead.decision?.urgency]||0;
 const risk=({Critical:80,High:60,Medium:30,Healthy:0} as Record<string,number>)[lead.riskLevel]||0;
 const operationalSla=lead.operationalResponseSlaStatus??lead.responseSlaStatus;
 const sla=operationalSla==='pending'?90:operationalSla==='breached'?75:0;
 const cadence=lead.cadenceStatus==='overdue'?50:lead.cadenceStatus==='due'?25:0;
 const confirmation=(lead.operationalClocks||[]).some((item:any)=>item.key==='appointment-confirmation'&&['pending','breached'].includes(item.status))?110:0;
 // Cadence is also an opportunity signal: recent customer activity, a near
 // appointment, or verified broker effort can make a lead worth working now.
 // These are additive boosts only; customer non-response never lowers a
 // broker score and system/routing gaps never become broker failures.
 const intentAt=lead.handRaiseAt||lead.customerResponseAt;
 const activityAt=intentAt?Date.parse(intentAt):NaN;
 const communicationAt=lead.lastCommunicationAt?Date.parse(lead.lastCommunicationAt):NaN;
 const activeMomentum=Number.isFinite(activityAt)&&(!Number.isFinite(communicationAt)||activityAt>communicationAt)&&Date.now()-activityAt<=7*86400000?35:0;
 const appointmentAt=lead.nextAppointmentAt?Date.parse(lead.nextAppointmentAt):NaN;
 const appointmentMomentum=Number.isFinite(appointmentAt)&&appointmentAt>=Date.now()&&appointmentAt-Date.now()<=48*3600000?80:0;
 const recentEffort=Number(lead.evidenceSummary?.behavior?.windows?.['7']?.calls||0)+Number(lead.evidenceSummary?.behavior?.windows?.['7']?.texts||0)>0?15:0;
 return (relationship.needsContactNow?1000:0)+(relationship.important?60:0)+urgency+risk+sla+cadence+confirmation+(100-Number(lead.governanceScore||0))+activeMomentum+appointmentMomentum+recentEffort;
}

function actionable(lead:any,now=Date.now(),relationship=flowRelationshipSignals(lead,now)){
 if(!relationship.queueEligible)return false;
 if(relationship.pastClient&&(relationship.dueTask||relationship.recentRequest||relationship.appointmentDue))return true;
 if(lead.contextConflict||relationship.needsContactNow||relationship.needsCadencePlan||relationship.cadenceConflict||relationship.importantPlan)return true;
 if(lead.decision?.urgency&&lead.decision.urgency!=='Monitor')return true;
 if(lead.overdueTaskCount>0||lead.taskRepairRecommended||['due','overdue'].includes(lead.cadenceStatus))return true;
 const next=lead.nextActionAt?Date.parse(lead.nextActionAt):0;
 return Boolean(next&&next<=now+24*60*60*1000);
}

function unresolvedPass(events:FlowEvent[]){
 const pass=events.find(event=>event.kind==='broker.pass');if(!pass)return null;
 const resolved=events.some(event=>resolutionKinds.has(event.kind)&&event.parentEventId===pass.id);
 return resolved?null:pass;
}

function suppressed(lead:any,events:FlowEvent[],now=Date.now()){
 const kill=events.find(event=>event.kind==='management.kill');if(kill)return true;
 const pass=unresolvedPass(events);if(pass)return true;
 const nurture=events.find(event=>event.kind==='management.nurture');if(nurture&&(!nurture.returnAt||new Date(nurture.returnAt).getTime()>now))return true;
 const latest=events[0];if(!latest)return false;
 if(latest.kind==='broker.complete'&&needsBuyerContact(lead)&&['Follow-up task created','Follow-up scheduled','Appointment confirmed'].includes(latest.outcome||''))return false;
 const relationship=flowRelationshipSignals(lead,now);
 if(relationship.pastClient&&relationship.dueTask&&latest.kind==='broker.complete')return false;
 // A broker's completed action may write a note back to FUB. That writeback
 // changes the contact's updated timestamp and therefore produces a new
 // intelligence snapshot, but it does not create a new item for the broker
 // to work. Keep a note-backed completion suppressed across that snapshot
 // boundary; completions without a note retain the original snapshot-bound
 // behavior so genuinely changed intelligence can re-enter the queue.
 if(latest.kind==='broker.complete'&&latest.note)return completionStillHeld(lead,latest,now);
 if(latest.decisionSnapshotId!==lead.decisionSnapshotId)return false;
 if(latest.kind==='broker.complete')return true;
 if(latest.kind==='broker.skip'&&latest.returnAt&&new Date(latest.returnAt).getTime()>now)return true;
 return false;
}

export function buildFlowQueue(leads:any[],events:FlowEvent[],brokerId:number|null):FlowItem[]{
 const items:FlowItem[]=[];
 for(const lead of leads.filter(isOperationalLead)){
 const history=leadEvents(events,String(lead.id)),owner=latestOwnership(lead,history),relationship=flowRelationshipSignals(lead);
  if(owner.id!==brokerId||suppressed(lead,history)||!actionable(lead,Date.now(),relationship))continue;
  const score=priorityScore(lead,relationship),skipCount=history.filter(event=>event.kind==='broker.skip'&&event.decisionSnapshotId===lead.decisionSnapshotId).length;
  const recommendation=lead.contextConflict?lead.decision?.label||'Review the recorded disposition':relationship.needsContactNow?'Contact buyer - contact not yet established':relationship.cadenceConflict?'Confirm one nurture cadence':relationship.needsCadencePlan?'Plan nurture follow-up':relationship.importantPlan?'Plan an Important contact follow-up':null;
  items.push({relationship,id:`${lead.id}:${lead.decisionSnapshotId}`,leadId:String(lead.id),lead,effectiveOwnerId:owner.id,effectiveOwnerName:owner.name,priorityScore:score,priorityLabel:lead.contextConflict?'Today':relationship.needsContactNow?'Immediate':recommendation?'Today':lead.decision?.urgency||'Monitor',recommendedAction:recommendation||lead.decision?.label||lead.recommendedAction,rationale:lead.contextConflict?lead.decision.rationale:recommendation?(relationship.needsContactNow?'No successful contact is established. An outreach attempt still clears its own response timer; subsequent attempts follow the approved cadence.':relationship.needsCadencePlan||relationship.cadenceConflict?'Confirm the intended cadence or schedule a follow-up. Flow does not assign a weekly or monthly tag automatically.':'The Important tag identifies a relationship to plan and prioritize.'):lead.decision?.rationale||lead.recommendedAction,consequence:lead.decision?.consequence||'The opportunity may continue aging.',skipCount,lastEvent:history[0]||null});
 }
 return items.sort((a,b)=>b.priorityScore-a.priorityScore||a.lead.governanceScore-b.lead.governanceScore).map((item,index)=>({...item,position:index+1}));
}

export function buildManagementExceptions(leads:any[],events:FlowEvent[],users:any[]):ManagementException[]{
 leads=leads.filter(isOperationalLead);
 const leadMap=new Map(leads.map(lead=>[String(lead.id),lead]));
 return events.filter(event=>event.kind==='broker.pass').filter(pass=>!events.some(event=>resolutionKinds.has(event.kind)&&event.parentEventId===pass.id)).map(pass=>{
  const lead=leadMap.get(pass.leadId);if(!lead)return null;
  const alternatives=users.filter(user=>user.isActive&&user.id!==pass.actorUserId&&['agent','broker'].some(role=>String(user.role).toLowerCase().includes(role)));
  const workload=(userId:number)=>leads.filter(item=>item.assignedUserId===userId&&item.riskLevel!=='Healthy').length;
  const recommended=alternatives.sort((a,b)=>workload(a.id)-workload(b.id)||String(a.name).localeCompare(String(b.name)))[0]||null;
  return {passEvent:pass,lead,previousBroker:pass.actorName,ageMinutes:Math.max(0,Math.floor((Date.now()-new Date(pass.createdAt).getTime())/60000)),recommendedBrokerId:recommended?.id??null,recommendedBrokerName:recommended?.name??null,recommendationReason:recommended?`Lowest visible non-healthy workload among active eligible brokers (${workload(recommended.id)}).`:'No alternative active broker is visible.',previousPasses:events.filter(event=>event.kind==='broker.pass'&&event.leadId===pass.leadId).length};
 }).filter((item):item is ManagementException=>Boolean(item)).sort((a,b)=>a.lead.governanceScore-b.lead.governanceScore||b.ageMinutes-a.ageMinutes);
}

export function eventHistory(events:FlowEvent[],leadId:string){return leadEvents(events,leadId);}
