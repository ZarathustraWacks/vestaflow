/** Normalize variable FUB payload shapes and preserve classification evidence. */
import { NormalizedAppointment, NormalizedLead, NormalizedTask, NormalizedUser } from '@/lib/domain/types';
import { resolveLane } from '@/lib/policy/vesta';
const arr=(v:unknown):any[]=>Array.isArray(v)?v:[];
const dt=(v:unknown)=>typeof v==='string'&&v.trim()?v:null;
const num=(v:unknown)=>typeof v==='number'?v:(typeof v==='string'&&v.trim()&&!Number.isNaN(Number(v))?Number(v):null);
const text=(v:unknown)=>typeof v==='string'?v.trim():'';
const bool=(v:unknown)=>v===true||v===1||(typeof v==='string'&&['true','1','yes'].includes(v.trim().toLowerCase()));
type CommunicationSource='fub-last-communication'|'fub-contacted'|'outbound-call'|'outbound-email'|'outbound-text'|'email'|'text'|'two-way-call'|'two-way-email'|'two-way-text'|null;
type CustomerResponseSource='inbound-call'|'inbound-email'|'inbound-text'|null;
const objectDate=(value:unknown):string|null=>{
  if(typeof value==='string'&&value.trim()&&Number.isFinite(new Date(value).getTime()))return value;
  if(!value||typeof value!=='object')return null;
  const item=value as Record<string,unknown>;
  for(const key of ['startedAt','sentAt','created','createdAt','occurredAt','timestamp','date','updatedAt']){
    const candidate=item[key];
    if(typeof candidate==='string'&&candidate.trim()&&Number.isFinite(new Date(candidate).getTime()))return candidate;
  }
  return null;
};
const validDate=objectDate;
const directionOf=(item:Record<string,unknown>)=>text(item.direction??item.callDirection??item.messageDirection??item.type).toLowerCase();
const isOutbound=(item:Record<string,unknown>)=>item.isIncoming===false||item.isIncoming===0||item.isIncoming==='false'||item.incoming===false||item.incoming===0||item.incoming==='false'||item.isOutgoing===true||item.isOutgoing===1||item.isOutgoing==='true'||item.outgoing===true||item.outgoing===1||item.outgoing==='true'||['outgoing','outbound','sent','out','outgoing call','outbound call'].includes(directionOf(item));
const isInbound=(item:Record<string,unknown>)=>item.isIncoming===true||item.isIncoming===1||item.isIncoming==='true'||item.incoming===true||item.incoming===1||item.incoming==='true'||item.isOutgoing===false||item.isOutgoing===0||item.isOutgoing==='false'||item.outgoing===false||item.outgoing===0||item.outgoing==='false'||['incoming','inbound','received','in','incoming call','inbound call'].includes(directionOf(item));
const explicitlyOutboundObjectDate=(value:unknown):string|null=>{
  if(!value||typeof value!=='object')return null;
  const item=value as Record<string,unknown>;
  return isOutbound(item)&&!isInbound(item)?objectDate(item):null;
};
const explicitlyInboundObjectDate=(value:unknown):string|null=>{
  if(!value||typeof value!=='object')return null;
  const item=value as Record<string,unknown>;
  return isInbound(item)?objectDate(item):null;
};
const newest=<T extends string>(candidates:{source:T;at:string|null}[])=>candidates.filter(candidate=>candidate.at&&Number.isFinite(Date.parse(candidate.at))).sort((a,b)=>Date.parse(b.at!)-Date.parse(a.at!))[0]||null;

/**
 * Keep broker effort and customer engagement on separate clocks.
 * Outreach resets cadence without requiring a reply. A later customer reply
 * can restart cadence too, while remaining separate from broker action credit.
 */
export function resolveCadenceCommunication(p:any):{at:string|null;source:CommunicationSource;brokerOutreachAt:string|null;customerResponseAt:string|null;customerResponseSource:CustomerResponseSource;twoWayEngagementAt:string|null}{
  const outreach=newest([
    {source:'outbound-call',at:objectDate(p.lastOutgoingCall??p.lastOutboundCallAt??p.communication?.lastOutgoingCall??p.communication?.lastOutboundCallAt)},
    {source:'outbound-email',at:objectDate(p.lastEmailSentAt??p.lastOutboundEmailAt??p.lastSentEmail??p.emailLastSentAt??p.communication?.lastEmailSentAt)},
    {source:'outbound-text',at:objectDate(p.lastTextSentAt??p.lastOutboundTextAt??p.lastSentText??p.textLastSentAt??p.lastSmsSentAt??p.communication?.lastTextSentAt)},
    {source:'email',at:explicitlyOutboundObjectDate(p.lastEmail??p.communication?.lastEmail)},
    {source:'text',at:explicitlyOutboundObjectDate(p.lastText??p.communication?.lastText)},
    {source:'outbound-call',at:explicitlyOutboundObjectDate(p.lastCall??p.communication?.lastCall)},
  ] as {source:Exclude<CommunicationSource,null>;at:string|null}[]);
  const response=newest([
    {source:'inbound-call',at:objectDate(p.lastIncomingCall??p.lastInboundCallAt??p.lastReceivedCall??p.callLastReceivedAt??p.communication?.lastIncomingCall??p.communication?.lastInboundCallAt)},
    {source:'inbound-email',at:objectDate(p.lastEmailReceivedAt??p.lastInboundEmailAt??p.lastReceivedEmail??p.emailLastReceivedAt??p.communication?.lastEmailReceivedAt)},
    {source:'inbound-text',at:objectDate(p.lastTextReceivedAt??p.lastInboundTextAt??p.lastReceivedText??p.textLastReceivedAt??p.lastSmsReceivedAt??p.communication?.lastTextReceivedAt)},
    {source:'inbound-call',at:explicitlyInboundObjectDate(p.lastCall??p.communication?.lastCall)},
    {source:'inbound-email',at:explicitlyInboundObjectDate(p.lastEmail??p.communication?.lastEmail)},
    {source:'inbound-text',at:explicitlyInboundObjectDate(p.lastText??p.communication?.lastText)},
  ] as {source:Exclude<CustomerResponseSource,null>;at:string|null}[]);
  const paired=Boolean(outreach?.at&&response?.at&&Date.parse(response.at)>=Date.parse(outreach.at));
  // Retain a legacy aggregate only when explicit effort is absent and the
  // aggregate is not the known customer-response timestamp. Consumers can
  // identify this weaker evidence by its fub-last-communication source.
  const aggregate=objectDate(p.lastCommunication??p.lastCommunicationAt);
  const responseTime=response?.at?Date.parse(response.at):null;
  const legacy=newest([{source:'fub-last-communication' as const,at:aggregate},{source:'fub-contacted' as const,at:objectDate(p.contacted)}].filter(row=>row.at!==null&&(responseTime===null||Date.parse(row.at)!==responseTime)));
  const effective=paired?{source:response!.source.replace('inbound-','two-way-') as CommunicationSource,at:response!.at}:outreach||legacy;
  return {at:effective?.at||null,source:effective?.source||null,brokerOutreachAt:outreach?.at||null,customerResponseAt:response?.at||null,customerResponseSource:response?.source||null,twoWayEngagementAt:paired?response!.at:null};
}
/**
 * Compatibility wrapper for cadence: outreach alone or a later customer reply.
 */
export function resolveLastCommunication(p:any):{at:string|null;source:CommunicationSource}{
  const resolved=resolveCadenceCommunication(p);
  return {at:resolved.at,source:resolved.source};
}
const DEFAULT_RENTAL_MARKERS=['rent','rental','rentals','renter','renters','tenant','tenants','lease','leasing','apartment','apartments'];
// Account-specific markers extend the safe defaults. They must not replace them,
// otherwise an older Vercel value can silently disable a newly supported source.
const rentalMarkers=()=>new Set([...DEFAULT_RENTAL_MARKERS,...(process.env.VESTA_RENTAL_MARKERS||'').split(',')].map(x=>x.trim().toLowerCase()).filter(Boolean));
const tokens=(value:unknown)=>text(value).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
/**
 * Classify operating lanes from explicit evidence. Predictive tags never
 * silently override observed intent, and contradictory rental/seller evidence
 * is deliberately routed to human review.
 */
export function classifyBusinessSegment(p:any):{segment:'buyer-seller'|'rental'|'needs-classification';reason:string;evidence:string[]}{
  const source=text(p.source).toLowerCase();
  const candidates:{field:string;value:unknown}[]=[];
  arr(p.tags).forEach((tag,i)=>candidates.push({field:`tags[${i}]`,value:typeof tag==='string'?tag:tag?.name??tag?.value??tag?.tag??tag?.label}));
  for(const field of ['source','stage','leadType','type','transactionType','inquiryType','assignedPondName','pondName'])candidates.push({field,value:p[field]});
  if(typeof p.assignedPond==='string')candidates.push({field:'assignedPond',value:p.assignedPond});
  else if(p.assignedPond)candidates.push({field:'assignedPond',value:p.assignedPond.name??p.assignedPond.label});
  for(const [field,value] of Object.entries(p))if(/^custom/i.test(field)&&/(type|segment|category|rental|rent|lease|tenant)/i.test(field))candidates.push({field,value});
  if(p.customFields&&typeof p.customFields==='object')for(const [field,value] of Object.entries(p.customFields))if(/(type|segment|category|rental|rent|lease|tenant)/i.test(field))candidates.push({field:`customFields.${field}`,value});
  const rental=rentalMarkers(),buyers=new Set(['buyer','buyers']),sellers=new Set(['seller','sellers','listing']);const rentalEvidence:string[]=[],buyerEvidence:string[]=[],sellerEvidence:string[]=[],predictiveRental:string[]=[],predictiveBuyer:string[]=[],predictiveSeller:string[]=[];
  if(/(^|\.)apartments\.com(?:\b|\/)/i.test(source)||source==='apartments.com')rentalEvidence.push('source:apartments.com');
  for(const candidate of candidates){const value=text(candidate.value).toLowerCase(),predictive=/(^|\b)(likely|predicted|probable|propensity)(\b|$)/.test(value);for(const token of tokens(value)){const item=`${candidate.field}:${token}`;if(rental.has(token))(predictive?predictiveRental:rentalEvidence).push(item);if(buyers.has(token))(predictive?predictiveBuyer:buyerEvidence).push(item);if(sellers.has(token))(predictive?predictiveSeller:sellerEvidence).push(item)}}
  const evidence=[...rentalEvidence,...buyerEvidence,...sellerEvidence,...predictiveRental,...predictiveBuyer,...predictiveSeller];
  // FUB commonly applies a generic Buyer tag to rental inquiries. That pairing
  // is not a conflict. Seller intent versus any rental signal is contradictory.
  const conflict=(sellerEvidence.length&&(rentalEvidence.length||predictiveRental.length))||(rentalEvidence.length&&predictiveSeller.length);
  if(conflict)return {segment:'needs-classification',reason:'conflicting-transaction-signals',evidence};
  if(rentalEvidence.length)return {segment:'rental',reason:rentalEvidence[0],evidence};
  if(buyerEvidence.length||sellerEvidence.length)return {segment:'buyer-seller',reason:(sellerEvidence[0]||buyerEvidence[0]),evidence};
  if(predictiveRental.length||predictiveBuyer.length||predictiveSeller.length)return {segment:'needs-classification',reason:'predictive-signal-only',evidence};
  return {segment:'buyer-seller',reason:'no-rental-marker',evidence:[]};
}

export function normalizeUser(u:any):NormalizedUser{
  return {id:Number(u.id),name:text(u.name)||[u.firstName,u.lastName].filter(Boolean).join(' ')||`User ${u.id}`,email:text(u.email),role:text(u.role)||'Unknown',isActive:u.status?text(u.status).toLowerCase()==='active':u.isActive!==false,isOwner:bool(u.isOwner),raw:u};
}

function resolveAssignment(p:any,userMap?:Map<number,NormalizedUser>){
  const id=num(p.assignedUserId ?? p.assignedTo?.id ?? p.assignedUser?.id);
  const direct = typeof p.assignedTo==='string' ? p.assignedTo : text(p.assignedTo?.name)||text(p.assignedUser?.name)||text(p.assignedToName);
  const user=id!==null?userMap?.get(id):undefined;
  return {id,name:user?.name||direct||'Unassigned',role:user?.role||null};
}

export function normalizePersonBase(p:any,userMap?:Map<number,NormalizedUser>):Omit<NormalizedLead,'ageBand'|'engagementBand'|'cadenceKey'|'cadenceLabel'|'cadenceStatus'|'cadenceDueAt'|'cadenceDaysLate'|'cadenceClearRequired'|'overdueTaskCount'|'responseSlaStatus'|'decisionSnapshotId'|'governanceScore'|'governanceSignals'|'riskLevel'|'riskReasons'|'recommendedAction'|'decision'>{
  const name=text(p.name)||[p.firstName,p.lastName].filter(Boolean).join(' ')||`Lead ${p.id}`;
  const assigned=resolveAssignment(p,userMap);
  const tags=arr(p.tags).map(x=>typeof x==='string'?x:text(x?.name??x?.value??x?.tag??x?.label)).filter(Boolean),stage=text(p.stage)||'Unknown',source=text(p.source)||'Unknown';const lane=resolveLane({stage,source,tags});
  const businessSegment=lane.lane==='renter'?'rental':lane.lane==='candidate-rental'||lane.lane==='needs-classification'?'needs-classification':'buyer-seller';
  const communication=resolveCadenceCommunication(p);
  const embeddedAppointment=p.nextAppointment??p.appointment??null;
  return {id:p.id,name,stage,source,businessSegment,businessSegmentReason:lane.reason,businessSegmentEvidence:lane.evidence,leadLane:lane.lane,timeframeId:num(p.timeframeId),timeframeStatus:text(p.timeframeStatus)||text(p.timeframe?.name)||null,assignedUserId:assigned.id,assignedUserName:assigned.name,assignedUserRole:assigned.role,createdAt:dt(p.created),updatedAt:dt(p.updated),lastActivityAt:dt(p.lastActivity),lastCommunicationAt:communication.at,lastCommunicationSource:communication.source,brokerOutreachAt:communication.brokerOutreachAt,customerResponseAt:communication.customerResponseAt,twoWayEngagementAt:communication.twoWayEngagementAt,nextTaskAt:dt(p.nextTask?.dueDateTime||p.nextTask?.dueDate||p.nextTask?.due||p.nextTaskAt),nextAppointmentAt:validDate(embeddedAppointment?.start??embeddedAppointment?.startAt??p.nextAppointmentAt),nextActionAt:null,nextActionSource:null,taskRepairRecommended:false,handRaiseAt:dt(p.lastInquiry||p.lastInquiryAt),emails:arr(p.emails).map(x=>text(x?.value||x?.email||x)).filter(Boolean),phones:arr(p.phones).map(x=>text(x?.value||x?.phone||x)).filter(Boolean),tags,price:num(p.price),collaborators:arr(p.collaborators).map(x=>text(x?.name||x)).filter(Boolean),raw:p};
}
export const normalizeTask=(t:any,userMap?:Map<number,NormalizedUser>):NormalizedTask=>{const uid=num(t.assignedUserId??t.assignedTo?.id);return {id:t.id,personId:t.personId??t.person?.id??null,assignedUserId:uid,assignedUserName:(uid!==null?userMap?.get(uid)?.name:undefined)||(typeof t.assignedTo==='string'?text(t.assignedTo):text(t.assignedTo?.name))||undefined,name:text(t.name)||'Task',type:text(t.type)||'Follow Up',dueAt:dt(t.dueDateTime||t.due||t.dueDate),isCompleted:bool(t.isCompleted),raw:t};};
export const normalizeAppointment=(a:any):NormalizedAppointment=>{
  const ids=[a.personId,a.person?.id,a.contactId,...arr(a.invitees).map(item=>item?.personId),...arr(a.people).map(item=>item?.personId??item?.id)].filter(value=>value!==null&&value!==undefined&&String(value).trim());
  const status=text(a.status||a.state).toLowerCase(),isCancelled=bool(a.isCancelled??a.cancelled)||['cancelled','canceled','deleted'].includes(status);
  return {id:a.id??`appointment-${validDate(a.start??a.startAt)??'unknown'}`,personIds:[...new Set(ids)],title:text(a.title||a.name||a.type)||'Appointment',startAt:validDate(a.start??a.startAt??a.startTime??a.date),endAt:validDate(a.end??a.endAt??a.endTime),status:status||'scheduled',isCancelled,raw:a};
};
