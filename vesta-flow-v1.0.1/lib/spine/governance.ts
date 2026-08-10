import { createHash } from 'node:crypto';
import { GovernanceSignal, NormalizedLead, NormalizedTask, NormalizedUser } from '@/lib/domain/types';
import { cadencePolicy, cadenceState } from '@/lib/policy/vesta';
import { decideLead } from '@/lib/spine/decision';

const DAY=86400000;
const timestamp=(value:string|null,endOfDate=false)=>{if(!value)return null;const dateOnly=/^\d{4}-\d{2}-\d{2}$/.test(value);const parsed=new Date(dateOnly&&endOfDate?`${value}T23:59:59.999`:value).getTime();return Number.isFinite(parsed)?parsed:null};
const ageDays=(d:string|null)=>{const parsed=timestamp(d);return parsed===null?99999:Math.max(0,Math.floor((Date.now()-parsed)/DAY))};

function responseSla(handRaiseAt:string|null,lastCommunicationAt:string|null,now=Date.now()):NormalizedLead['responseSlaStatus']{
 if(!handRaiseAt)return 'not-applicable';
 const raised=timestamp(handRaiseAt),contacted=timestamp(lastCommunicationAt);
 if(raised===null)return 'unknown';
 if(contacted!==null&&contacted>=raised)return contacted-raised<=60000?'met':'breached';
 return now-raised<=60000?'pending':'breached';
}

export function enrichLead(base:Omit<NormalizedLead,'ageBand'|'engagementBand'|'cadenceKey'|'cadenceLabel'|'cadenceStatus'|'cadenceDueAt'|'cadenceDaysLate'|'cadenceClearRequired'|'overdueTaskCount'|'responseSlaStatus'|'decisionSnapshotId'|'governanceScore'|'governanceSignals'|'riskLevel'|'riskReasons'|'recommendedAction'|'decision'>,tasks:NormalizedTask[]=[]):NormalizedLead{
 const created=ageDays(base.createdAt),activity=ageDays(base.lastActivityAt),comm=ageDays(base.lastCommunicationAt),now=Date.now();
 const openTasks=tasks.filter(t=>String(t.personId)===String(base.id)&&!t.isCompleted);
 const futureTasks=openTasks.map(t=>({due:t.dueAt,at:timestamp(t.dueAt,true)})).filter((t):t is {due:string;at:number}=>t.due!==null&&t.at!==null&&t.at>=now).sort((a,b)=>a.at-b.at);
 const overdueTaskCount=openTasks.filter(t=>{const due=timestamp(t.dueAt,true);return due!==null&&due<now}).length;
 const baseNextAt=timestamp(base.nextTaskAt,true),next=futureTasks[0]?.due||(baseNextAt!==null&&baseNextAt>=now?base.nextTaskAt:null);
 const ageBand=created<=7?'Fresh':created<=30?'Developing':created<=90?'Aged':created<=365?'Old':'Legacy';
 const engagementBand=activity===99999?'Unknown':activity<=7?'Active now':activity<=30?'Recently active':activity<=90?'Cooling':'Dormant';
 const policy=cadencePolicy({lane:base.leadLane,stage:base.stage,tags:base.tags,timeframeStatus:base.timeframeStatus});
 const cadence=cadenceState(policy,base.lastCommunicationAt,now),sla=responseSla(base.handRaiseAt,base.lastCommunicationAt,now);
 const classificationClear=!['candidate-rental','needs-classification'].includes(base.leadLane)&&!policy.key.includes('unmapped');
 const cadencePoints=cadence.status==='current'||cadence.status==='not-required'?25:cadence.status==='due'?12:0;
 const signals:GovernanceSignal[]=[
  {key:'owner',label:'Accountable owner',status:base.assignedUserId!==null?'pass':'fail',points:base.assignedUserId!==null?20:0,maxPoints:20,explanation:base.assignedUserId===null?'No assigned agent ID is visible in the CRM record.':`Assigned to ${base.assignedUserName}.`},
  {key:'cadence',label:'SOP cadence',status:cadence.status==='current'||cadence.status==='not-required'?'pass':cadence.status==='due'?'warn':cadence.status==='unknown'?'unknown':'fail',points:cadencePoints,maxPoints:25,explanation:`${policy.label}: ${policy.basis}${cadence.dueAt?` Due ${new Date(cadence.dueAt).toLocaleDateString('en-US')}.`:''}`},
  {key:'activity',label:'Engagement alignment',status:activity<=7&&comm>7?'fail':activity<=30?'pass':'warn',points:activity<=7&&comm>7?0:activity<=30?20:10,maxPoints:20,explanation:activity<=7&&comm>7?'Recent lead activity is not matched by recent communication.':activity===99999?'No activity date is exposed.':`Last activity was ${activity} day(s) ago.`},
  {key:'classification',label:'Disposition clarity',status:classificationClear?'pass':'fail',points:classificationClear?20:0,maxPoints:20,explanation:classificationClear?`${base.leadLane} lane · ${base.stage}.`:base.businessSegmentReason},
  {key:'task-hygiene',label:'One-off task hygiene',status:overdueTaskCount===0?'pass':'fail',points:overdueTaskCount===0?15:0,maxPoints:15,explanation:overdueTaskCount===0?'No overdue one-off tasks are visible.':`${overdueTaskCount} overdue one-off task(s) must be cleared.`},
 ];
 const score=signals.reduce((sum,signal)=>sum+signal.points,0),reasons=signals.filter(signal=>signal.status==='fail').map(signal=>signal.explanation);
 if(sla==='breached')reasons.unshift('A documented hand raise missed the one-minute response standard.');
 const riskLevel=reasons.length>=3||(base.assignedUserId===null&&ageBand==='Fresh')?'Critical':reasons.length>=2?'High':reasons.length===1||score<80?'Medium':'Healthy';
 const action=!classificationClear?'Review and confirm the lead lane in Follow Up Boss.':base.assignedUserId===null?'Assign an accountable agent now.':sla==='pending'||sla==='breached'?'Respond to the active hand raise now.':cadence.status==='overdue'||cadence.status==='due'?'Restore the approved Smart List cadence.':overdueTaskCount>0?'Clear the overdue one-off task and document the outcome.':riskLevel==='Healthy'?'Continue the current follow-up plan.':'Review the record and correct the highlighted governance gaps.';
 const draft={...base,nextTaskAt:next,ageBand,engagementBand,cadenceKey:policy.key,cadenceLabel:policy.label,cadenceStatus:cadence.status,cadenceDueAt:cadence.dueAt,cadenceDaysLate:cadence.daysLate,cadenceClearRequired:policy.clearRequired,overdueTaskCount,responseSlaStatus:sla,governanceScore:score,governanceSignals:signals,riskLevel,riskReasons:reasons,recommendedAction:action} as Omit<NormalizedLead,'decision'|'decisionSnapshotId'>;
 const decision=decideLead(draft),decisionSnapshotId=createHash('sha256').update(JSON.stringify({policy:'vesta-sop-2026-07-v1',id:base.id,updatedAt:base.updatedAt,lane:base.leadLane,stage:base.stage,cadence:cadence.status,sla,score,decision:decision.matchedRule})).digest('hex').slice(0,24);
 return {...draft,decision,decisionSnapshotId};
}

export function agentRollups(leads:NormalizedLead[],users:NormalizedUser[]){
 const map=new Map<number|null,{id:number|null;name:string;role:string;items:NormalizedLead[]}>();
 for(const lead of leads){const key=lead.assignedUserId,user=key!==null?users.find(item=>item.id===key):undefined,group=map.get(key)||{id:key,name:user?.name||lead.assignedUserName||'Unassigned',role:user?.role||lead.assignedUserRole||'Unknown',items:[]};group.items.push(lead);map.set(key,group)}
 return [...map.values()].map(group=>({id:group.id,name:group.name,role:group.role,leads:group.items.length,fresh:group.items.filter(item=>item.ageBand==='Fresh').length,critical:group.items.filter(item=>item.riskLevel==='Critical').length,noNext:group.items.filter(item=>item.cadenceStatus==='due'||item.cadenceStatus==='overdue').length,stale:group.items.filter(item=>item.engagementBand==='Dormant').length,averageScore:Math.round(group.items.reduce((sum,item)=>sum+item.governanceScore,0)/Math.max(1,group.items.length))})).sort((a,b)=>b.leads-a.leads);
}
