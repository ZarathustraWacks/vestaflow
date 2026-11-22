import {library,propose,normalize,type Context as LibraryContext,type Proposal,type Fact} from './engine';
export type ReviewSource={id:string;at:string;kind:string;text:string;brokerId?:string;connected?:boolean;outbound?:boolean;inbound?:boolean};
export type NurturePacket={personId:string;ownerId:string;brokerName:string;cadenceDue:boolean;coverageComplete:boolean;pendingReplyAt?:string;sources:ReviewSource[]};
export type Selection={techniqueId:string;approachId:string;phase:'opening'|'follow-up'|'alternate-angle';sourceId:string;values:Record<string,string>;reviewed:boolean;reviewedAt?:string};
export const PROPERTY_TECHNIQUES=new Set(['OUT-021','OUT-022','OUT-023','OUT-024','OUT-043']);
const stamp=(v:any)=>typeof v==='string'&&Number.isFinite(Date.parse(v))?v:'';
const clean=(v:any)=>String(v||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,1200);
export function nurturePacket(lead:any,collections:any,availability:any,cadenceDue:boolean):NurturePacket{
 const personId=String(lead.id),sources:ReviewSource[]=[];
 for(const key of ['notes','calls','textMessages','events'])for(const row of collections?.[key]||[]){
  if(!row?.id||(row.personId!=null&&String(row.personId)!==personId))continue;
  const at=stamp(row.sent||row.startedAt||row.created||row.createdAt);if(!at||Date.parse(at)>Date.now())continue;
  const brokerId=String(row.userId||row.createdById||''),outbound=/^outbound$/i.test(row.direction||row.type||'')||row.isIncoming===false;
  sources.push({id:`fub:${key}:${row.id}`,at,kind:key==='events'?String(row.type):key,text:clean(row.body||row.message||row.note||row.description||row.outcome||row.type),brokerId,
   // A duration or an attempted dial cannot establish a personal conversation.
   connected:key==='calls'&&/^(spoke with (customer|client)|connected|answered)$/i.test(String(row.outcome||''))&&Number(row.duration)>0,
   outbound,inbound:/^inbound$/i.test(row.direction||row.type||'')||row.isIncoming===true});
 }
 sources.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)||a.id.localeCompare(b.id));
 const texts=sources.filter(s=>s.kind==='textMessages'),latestText=texts[0];
 const pendingReplyAt=latestText&&latestText.inbound?latestText.at:undefined;
 const record={id:'fub:person:'+personId,at:stamp(lead.createdAt)||new Date().toISOString(),kind:'record',text:'Current FUB record; no specific customer intent inferred.'};
 const request=Date.parse(lead.handRaiseAt||''),outreach=Date.parse(lead.brokerOutreachAt||''),freshRequest=Number.isFinite(request)&&request<=Date.now()&&Date.now()-request<=7*86400000&&(!Number.isFinite(outreach)||request>outreach);
 const allowedNow=cadenceDue&&(!!pendingReplyAt||freshRequest||(lead.cadenceStatus!=='current'&&(!lead.nextActionAt||Date.parse(lead.nextActionAt)<=Date.now())));
 return {personId,pendingReplyAt,ownerId:String(lead.assignedUserId||''),brokerName:clean(lead.assignedUserName),cadenceDue:allowedNow,coverageComplete:!!availability&&['notes','calls','textMessages'].every(k=>availability[k]?.ok===true),sources:[...sources.slice(0,79),record]};
}
export function recommendedSelection(packet:NurturePacket):Selection{
 const incoming=packet.pendingReplyAt?packet.sources.find(s=>s.kind==='textMessages'&&s.at===packet.pendingReplyAt):undefined;
 if(incoming)return {reviewedAt:new Date().toISOString(),techniqueId:'OUT-041',approachId:'OUT-041-B',phase:'opening',sourceId:incoming.id,values:{inquiry_topic:'your message',inquiry_event_at:incoming.at},reviewed:true};
 const event=packet.sources.find(s=>['Viewed Property','Saved Property','Property Search','Saved Property Search'].includes(s.kind));
 const techniqueId=event?'OUT-042':'OUT-059',technique=library.techniques.find(t=>t.id===techniqueId)!;
 const source=event||packet.sources.find(s=>s.kind==='record')!;
 return {reviewedAt:new Date().toISOString(),techniqueId,approachId:techniqueId+'-A',phase:'opening',sourceId:source.id,values:Object.fromEntries(technique.requiredFacts.map(k=>[k,event?source.at:source.text])),reviewed:true};
}
export function requiredFields(selection:Selection,channel:'sms'|'email'){
 const t=library.techniques.find(t=>t.id===selection.techniqueId),m=library.messages.find(m=>m.approachId===selection.approachId&&m.phase===selection.phase&&m.channel===channel);
 return [...new Set([...(t?.requiredFacts||[]),...(m?.requiredSlots||[]).filter(k=>k!=='broker_name')])];
}
export function propertyTechniqueBlocked(selection:Selection,channel:'sms'|'email'){
 return PROPERTY_TECHNIQUES.has(selection.techniqueId)||requiredFields(selection,channel).some(k=>['property_address','comparison_address','resource_link','current_price','previous_price','listing_checked_date'].includes(k));
}
type DraftLike={leadId:string;body:string;at:string;nurture?:Proposal};
export function connectedProposal(input:{leadId:string;name:string;channel:'sms'|'email';packet:NurturePacket;selection?:Selection;waiting?:boolean;drafts:DraftLike[];history:{leadId:string;body:string;at:string}[];now?:Date}):Proposal|{status:'hold';reason:string;missing?:string[]}{
 if(!input.selection){
  const record=input.packet.sources.find(s=>s.kind==='record');
  const first:Selection=input.waiting&&record?{techniqueId:'OUT-060',approachId:'OUT-060-B',phase:'opening',reviewedAt:(input.now||new Date()).toISOString(),sourceId:record.id,values:{permitted_preference_review:record.text},reviewed:true}:recommendedSelection(input.packet),technique=library.techniques.find(t=>t.id===first.techniqueId)!;
  const options=technique.approaches.filter(a=>first.techniqueId==='OUT-060'?!a.id.endsWith('-A'):first.techniqueId==='OUT-041'?a.id.endsWith('-B'):first.techniqueId!=='OUT-042'||a.id.endsWith('-A')||a.id.endsWith('-C'));
  for(const a of options){const q=connectedProposal({...input,selection:{...first,reviewedAt:(input.now||new Date()).toISOString(),approachId:a.id}});if(q.status==='broker-review')return q;}
  return {status:'hold' as const,reason:'distinct-eligible-copy-exhausted-or-review-needed'};
 }
 const {packet}=input,now=input.now||new Date(),selection=input.selection||recommendedSelection(packet),source=packet.sources.find(x=>x.id===selection.sourceId),technique=library.techniques.find(x=>x.id===selection.techniqueId);
 if(input.waiting&&selection.techniqueId!=='OUT-060')return {status:'hold',reason:'customer-timing-requires-permission-path'};
 if(packet.personId!==input.leadId)return {status:'hold' as const,reason:'wrong-person-evidence'};
 if(propertyTechniqueBlocked(selection,input.channel))return {status:'hold' as const,reason:'property-insertion-disabled'};
 if(!selection.reviewed||!source||!technique||!technique.approaches.some(a=>a.id===selection.approachId))return {status:'hold' as const,reason:'review-the-scenario-and-evidence'};
 if(!selection.reviewedAt||!Number.isFinite(Date.parse(selection.reviewedAt))||Date.parse(selection.reviewedAt)>now.getTime()||now.getTime()-Date.parse(selection.reviewedAt)>24*3600000)return {status:'hold',reason:'scenario-review-expired'};
 if(Date.parse(source.at)>now.getTime())return {status:'hold' as const,reason:'future-source-time'};
 const latest=packet.sources.reduce((at,s)=>Date.parse(s.at)>Date.parse(at)?s.at:at,source.at);
 const facts:Record<string,Fact>={};
 for(const key of requiredFields(selection,input.channel)){
  const m=library.messages.find(m=>m.approachId===selection.approachId&&m.channel===input.channel&&m.phase===selection.phase);
  facts[key]={personId:input.leadId,sourceId:source.id,kind:m?.slotKinds[key]||'broker-reviewed',value:selection.values[key]||'',at:source.at,verified:true,customerSafe:true};
 }
 const prior=input.drafts.filter(d=>d.leadId===input.leadId&&d.nurture).map(d=>{
  const p=d.nurture!;
  // Only a matching real outbound FUB message establishes a send. Copy, Hold
  // and Done are not delivery receipts. Email follow-ups await email evidence.
  const sent=packet.sources.find(s=>s.kind==='textMessages'&&s.outbound&&s.brokerId===packet.ownerId&&Date.parse(s.at)>=Date.parse(d.at)&&normalize(s.text)===normalize(d.body));
  return {personId:d.leadId,contentId:p.contentId,techniqueId:p.techniqueId,approachId:p.approachId,phase:library.messages.find(m=>m.id===p.messageId)?.phase||'opening',channel:'sms',body:d.body,at:sent?.at||d.at,signalKey:p.signalKey,kind:sent?'sent' as const:'proposed' as const};
 });
 const extra=input.history.filter(h=>h.leadId===input.leadId).map(h=>({personId:h.leadId,contentId:'',techniqueId:'',approachId:'',phase:'',channel:'',body:h.body,at:h.at,signalKey:'',kind:'edited' as const}));
 const context:LibraryContext={personId:input.leadId,ownerId:packet.ownerId,senderBrokerId:packet.ownerId,firstName:input.name.trim().split(/\s+/)[0],brokerName:packet.brokerName,identityVerified:true,ownerVerified:!!packet.ownerId,
  sopVersion:'vesta-current-sop',channel:input.channel,channelPermitted:true,stageEligible:true,duplicateConflict:false,coverageComplete:packet.coverageComplete,cadenceDue:packet.cadenceDue,
  latestEvidenceAt:latest,evidenceCutoff:now.toISOString(),now:now.toISOString(),timeZone:'America/Chicago',pendingCustomerReply:!!packet.pendingReplyAt,pendingCustomerReplyAt:packet.pendingReplyAt,
  signals:[{code:technique.signalCode,personId:input.leadId,sourceIds:[source.id],observedAt:now.toISOString(),eventAt:source.at,validUntil:new Date(now.getTime()+3600000).toISOString(),status:'unknown',verified:true,reviewedApproachIds:[selection.approachId]}],facts,history:[...prior,...extra],
  conversations:packet.sources.filter(s=>s.connected&&s.brokerId===packet.ownerId).map(s=>({personId:input.leadId,sourceId:s.id,at:s.at,senderBrokerId:packet.ownerId,participants:[packet.ownerId],channel:'call',personal:true,connected:true,verified:true}))};
 return propose(context,{techniqueId:selection.techniqueId,approachId:selection.approachId,phase:selection.phase});
}
