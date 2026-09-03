import type { ManagementException } from '@/lib/flow/types';

export type CriticalRunKind='morning-reroutes'|'afternoon-critical';
export interface CriticalCandidate {key:string;leadId:string;leadName:string;ownerId?:number|null;ownerName:string;suggestedOwnerName?:string|null;source:string;segment:string;actionableAt:string;deadlineAt?:string;hoursOverdue:number;reason:string;recommendation:string;governanceScore:number;fubUrl:string;evidence:string[];origin:'existing-raven';}

const timezone=()=>process.env.VESTA_OPERATING_TIMEZONE||'America/Chicago';
const webBase=()=>process.env.FUB_WEB_BASE_URL?.replace(/\/$/,'')||'https://app.followupboss.com/2/people/view';
const formatter=(zone:string)=>new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function localParts(value:Date|string,zone=timezone()){
 const parts=Object.fromEntries(formatter(zone).formatToParts(typeof value==='string'?new Date(value):value).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 return {date:`${parts.year}-${parts.month}-${parts.day}`,weekday:parts.weekday,hour:Number(parts.hour),minute:Number(parts.minute)};
}
const ymd=(key:string)=>{const [year,month,day]=key.split('-').map(Number);return {year,month,day}};
export function previousBusinessDate(dateKey:string,closures:string[]=[]){
 const {year,month,day}=ymd(dateKey),blocked=new Set(closures);let cursor=new Date(Date.UTC(year,month-1,day,12));
 do{cursor=new Date(cursor.getTime()-86400000)}while([0,6].includes(cursor.getUTCDay())||blocked.has(cursor.toISOString().slice(0,10)));
 return cursor.toISOString().slice(0,10);
}
export function isBusinessDay(dateKey:string,closures:string[]=[]){const {year,month,day}=ymd(dateKey),weekday=new Date(Date.UTC(year,month-1,day,12)).getUTCDay();return ![0,6].includes(weekday)&&!closures.includes(dateKey)}
export function dueRunKinds(now=new Date(),closures:string[]=[]):CriticalRunKind[]{
 const local=localParts(now);if(!isBusinessDay(local.date,closures))return [];
 const minutes=local.hour*60+local.minute,kinds:CriticalRunKind[]=[];
 // Runs remain due after their target time. Durable run keys make retries safe and
 // let a delayed scheduler catch up instead of silently missing the day's digest.
 if(minutes>=9*60)kinds.push('morning-reroutes');
 if(minutes>=14*60+30)kinds.push('afternoon-critical');
 return kinds;
}
const inLocalWindow=(value:string,date:string,startHour:number,endHour:number)=>{const local=localParts(value);return local.date===date&&local.hour>=startHour&&local.hour<endHour};
const active=(lead:any)=>!['closed','trash','deleted','dead','invalid','do not contact'].some(value=>String(lead.stage||'').toLowerCase().includes(value));

export function morningCandidates(exceptions:ManagementException[],now=new Date(),closures:string[]=[]):CriticalCandidate[]{
 const previous=previousBusinessDate(localParts(now).date,closures);
 return exceptions.filter(item=>inLocalWindow(item.passEvent.createdAt,previous,12,17)&&active(item.lead)).map(item=>({key:`reroute:${item.passEvent.id}`,leadId:String(item.lead.id),leadName:item.lead.name,ownerId:item.passEvent.actorUserId,ownerName:item.previousBroker,suggestedOwnerName:item.recommendedBrokerName,source:item.lead.source,segment:item.lead.leadLane,actionableAt:item.passEvent.createdAt,hoursOverdue:Math.max(0,(now.getTime()-new Date(item.passEvent.createdAt).getTime())/3600000),reason:item.passEvent.reason||'Broker passed the lead.',recommendation:item.recommendedBrokerName?`Reroute to ${item.recommendedBrokerName}`:'Management review and reroute',governanceScore:item.lead.governanceScore,fubUrl:`${webBase()}/${item.lead.id}`,evidence:['Unresolved broker pass','No management disposition is recorded','Existing Vesta routing logic'],origin:'existing-raven'}));
}

export function afternoonCandidates(leads:any[],now=new Date()):CriticalCandidate[]{
 const today=localParts(now).date;
 return leads.flatMap(lead=>{
  const actionableAt=lead.handRaiseAt||lead.createdAt;if(!actionableAt||!inLocalWindow(actionableAt,today,9,13)||!active(lead))return [];
  const actionable=new Date(actionableAt),deadline=new Date(actionable.getTime()+4*3600000),hoursOverdue=(now.getTime()-deadline.getTime())/3600000;
  if(hoursOverdue<0)return [];
  const communicated=lead.lastCommunicationAt&&new Date(lead.lastCommunicationAt).getTime()>=actionable.getTime();if(communicated)return [];
  const critical=lead.decision?.urgency==='Immediate'||lead.riskLevel==='Critical'||lead.responseSlaStatus==='breached';if(!critical)return [];
  return [{key:`critical:${lead.id}:${actionable.toISOString()}`,leadId:String(lead.id),leadName:lead.name,ownerName:lead.assignedUserName,source:lead.source,segment:lead.leadLane,actionableAt:actionable.toISOString(),deadlineAt:deadline.toISOString(),hoursOverdue,recommendation:lead.decision?.label||lead.recommendedAction||'Contact immediately',reason:lead.decision?.rationale||'Critical lead has no visible qualifying contact.',governanceScore:lead.governanceScore,fubUrl:`${webBase()}/${lead.id}`,evidence:['Critical existing-spine decision','Four-hour threshold elapsed','No qualifying communication after actionable time'],origin:'existing-raven' as const}];
 });
}

export function stillUncontacted(candidate:CriticalCandidate,lead:any){const communication=lead?.lastCommunicationAt;return !communication||new Date(communication).getTime()<new Date(candidate.actionableAt).getTime()}
export function localRunKey(kind:CriticalRunKind,now=new Date(),policyVersion='critical-actions-v1'){return `${localParts(now).date}:${kind}:${policyVersion}`}
