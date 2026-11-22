/** Review-only library. No storage, vendor calls, cadence changes or sending. */
import data from './catalog.json';
export type ConditionStatus='unknown'|'waiting'|'approaching'|'met'|'changed'|'withdrawn'|'contradicted';
export type Fact={personId:string;sourceId:string;kind:string;value:string;at:string;verified:boolean;customerSafe:boolean;validUntil?:string};
export type Signal={code:string;personId:string;sourceIds:string[];observedAt:string;eventAt:string;validUntil:string;status:ConditionStatus;verified:boolean;reviewedApproachIds:string[]};
export type Conversation={personId:string;sourceId:string;at:string;senderBrokerId:string;participants:string[];channel:'call'|'text'|'email'|'chat';personal:boolean;connected:boolean;verified:boolean};
export type Prior={personId:string;contentId:string;techniqueId:string;approachId:string;phase:string;channel:string;body:string;at:string;signalKey:string;kind:'proposed'|'edited'|'held'|'sent'};
export type Context={personId:string;ownerId:string;senderBrokerId:string;firstName:string;brokerName:string;identityVerified:boolean;ownerVerified:boolean;sopVersion:string;channel:'sms'|'email';channelPermitted:boolean;stageEligible:boolean;duplicateConflict:boolean;coverageComplete:boolean;cadenceDue:boolean;pauseUntil?:string;latestEvidenceAt:string;evidenceCutoff:string;pendingCustomerReply:boolean;pendingCustomerReplyAt?:string;signals:Signal[];facts:Record<string,Fact>;conversations:Conversation[];history:Prior[];now:string;timeZone:string};
export type Message={id:string;contentId:string;techniqueId:string;approachId:string;signalCode:string;phase:string;channel:string;subject:string;core:string;template:string;requiredSlots:string[];slotKinds:Record<string,string>};
export type Technique={id:string;signalCode:string;title:string;family:string;focus:string;value:string;requiredFacts:string[];evidenceRule:string;priority:number;approaches:{id:string;label:string;messages:string[];appointmentPurpose:string;onReply:Record<string,string>}[]};
export const library=data as unknown as {version:string;liveConnected:false;counts:{techniques:number;approaches:number;contentUnits:number;channelDrafts:number};techniques:Technique[];messages:Message[]};
export const normalize=(v:string)=>v.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const time=(v:string|undefined)=>v?Date.parse(v):NaN;
const clean=(v:string)=>v.replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim();
const safe=(v:string)=>!!v&&v.length<=800&&!/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)&&!/[{}]/.test(v);
const validFact=(f:Fact|undefined,c:Context,kind?:string)=>!!f&&f.personId===c.personId&&f.verified===true&&f.customerSafe===true&&!!f.sourceId&&safe(f.value)&&Number.isFinite(time(f.at))&&time(f.at)<=time(c.now)&&(!f.validUntil||time(f.validUntil)>time(c.now))&&(!kind||f.kind===kind);
export function historyHook(c:Context,choice=0){
 const now=time(c.now);if(!Number.isFinite(now))return {text:'',sourceIds:[] as string[]};
 const rows=c.conversations.filter(x=>x.personId===c.personId&&x.verified&&x.personal&&x.connected&&x.sourceId&&x.senderBrokerId===c.senderBrokerId&&x.participants.includes(c.senderBrokerId)&&Number.isFinite(time(x.at))&&time(x.at)<=now).sort((a,b)=>time(b.at)-time(a.at));
 const x=rows[0];if(!x)return {text:'',sourceIds:[] as string[]};
 let month:string;try{month=new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:c.timeZone}).format(new Date(x.at));}catch{return {text:'',sourceIds:[] as string[]};}
 const options=x.channel==='call'?[`I am picking up our conversation from ${month}. `,`We spoke in ${month}. `,`I wanted to return to our ${month} conversation. `]:[`I am picking up our messages from ${month}. `,`We exchanged messages in ${month}. `,`I wanted to return to our ${month} message exchange. `];
 return {text:options[((choice%options.length)+options.length)%options.length],sourceIds:[x.sourceId]};
}
export function contextHold(c:Context){
 if(!Number.isFinite(time(c.now)))return 'invalid-review-time';
 if(!c.personId||!c.identityVerified)return 'identity-unverified';
 if(c.duplicateConflict)return 'canonical-record-conflict';
 if(!c.ownerVerified||!c.ownerId||c.senderBrokerId!==c.ownerId)return 'owner-or-sender-unverified';
 if(!c.channelPermitted)return 'channel-not-permitted';
 if(!c.stageEligible)return 'excluded-stage';
 if(!safe(c.sopVersion))return 'sop-version-unavailable';
 if(!c.coverageComplete)return 'communication-coverage-incomplete';
 if(!Number.isFinite(time(c.latestEvidenceAt))||!Number.isFinite(time(c.evidenceCutoff))||time(c.latestEvidenceAt)>time(c.evidenceCutoff)||time(c.evidenceCutoff)>time(c.now))return 'context-changed-or-invalid';
 if(c.pauseUntil&&(!Number.isFinite(time(c.pauseUntil))||time(c.pauseUntil)>time(c.now)))return 'customer-pause';
 if(c.pendingCustomerReply&&(!Number.isFinite(time(c.pendingCustomerReplyAt))||time(c.pendingCustomerReplyAt)>time(c.evidenceCutoff)))return 'pending-reply-evidence-unavailable';
 if(!c.cadenceDue)return 'existing-cadence-not-due';
 if(!safe(c.firstName)||!safe(c.brokerName))return 'invalid-name';
 return null;
}
function signalValid(s:Signal,c:Context){return s.personId===c.personId&&s.verified===true&&Array.isArray(s.sourceIds)&&s.sourceIds.length>0&&s.sourceIds.every(x=>typeof x==='string'&&x.length>0)&&Number.isFinite(time(s.observedAt))&&time(s.observedAt)<=time(c.evidenceCutoff)&&Number.isFinite(time(s.eventAt))&&time(s.eventAt)<=time(c.now)&&time(s.validUntil)>time(c.now)&&['unknown','waiting','approaching','met','changed'].includes(s.status);}
export type Proposal={status:'broker-review';version:string;personId:string;ownerId:string;sopVersion:string;messageId:string;contentId:string;approachId:string;techniqueId:string;signalCode:string;signalKey:string;body:string;subject:string;evidenceIds:string[];evidenceCutoff:string;evidenceFingerprint:string;reason:string;appointmentPurpose:string;onReply:Record<string,string>;sent:false};
export function propose(c:Context,options:{phase?:'opening'|'follow-up'|'alternate-angle';techniqueId?:string;approachId?:string;hookChoice?:number}={}):Proposal|{status:'hold';reason:string;missing?:string[]}{
 const blocked=contextHold(c);if(blocked)return {status:'hold',reason:blocked};
 const phase=options.phase||'opening',history=c.history.filter(h=>h.personId===c.personId);
 const usedContent=new Set(history.map(x=>x.contentId)),usedBodies=new Set(history.map(x=>normalize(x.body)));
 const candidates=library.techniques.filter(t=>!options.techniqueId||t.id===options.techniqueId).sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id));
 const missing=new Set<string>();let eligible=0;
 for(const t of candidates){
  if(c.pendingCustomerReply&&t.id!=='OUT-041')continue;
  const signals=c.signals.filter(s=>s.code===t.signalCode&&signalValid(s,c)&&(!c.pendingCustomerReply||s.eventAt===c.pendingCustomerReplyAt)).sort((a,b)=>time(b.observedAt)-time(a.observedAt));
  for(const s of signals){
   const absent=t.requiredFacts.filter(k=>!validFact(c.facts[k],c));if(absent.length){absent.forEach(x=>missing.add(x));continue;}
   for(const a of t.approaches){
    if(options.approachId&&a.id!==options.approachId)continue;
    // The trusted adapter or broker must explicitly review the approach against
    // the source's selection rule. A list label is insufficient authorization.
    if(!s.reviewedApproachIds.includes(a.id))continue;
    const m=library.messages.find(x=>x.approachId===a.id&&x.phase===phase&&x.channel===c.channel)!;eligible++;
    if(usedContent.has(m.contentId))continue;
    const signalKey=[c.personId,t.signalCode,...s.sourceIds.slice().sort()].join(':');
    const prior=history.filter(x=>x.techniqueId===t.id&&x.kind==='sent').sort((a,b)=>time(b.at)-time(a.at));
    if(phase==='opening'&&prior.some(x=>x.signalKey===signalKey))continue;
    // Following up requires an actual earlier send, not a generated or held draft.
    if(phase!=='opening'&&!prior.some(x=>x.approachId===a.id&&x.signalKey===signalKey&&time(x.at)<time(c.now)))continue;
    const absentSlots=m.requiredSlots.filter(k=>k!=='broker_name'&&!validFact(c.facts[k],c,m.slotKinds[k]));if(absentSlots.length){absentSlots.forEach(x=>missing.add(x));continue;}
    const hook=historyHook(c,options.hookChoice||0),bindings:Record<string,string>={first_name:clean(c.firstName),broker_name:clean(c.brokerName),history_hook:hook.text};
    for(const k of m.requiredSlots){if(k!=='broker_name')bindings[k]=clean(c.facts[k].value);}
    if(bindings.resource_link){try{const u=new URL(bindings.resource_link);if(u.protocol!=='https:'||u.username||u.password)continue;}catch{continue;}}
    const body=m.template.replace(/\{\{(\w+)\}\}/g,(_,k)=>bindings[k]??'{{'+k+'}}');
    if(/\{\{/.test(body)||usedBodies.has(normalize(body)))continue;
    const evidenceIds=[...new Set([...s.sourceIds,...t.requiredFacts.map(k=>c.facts[k].sourceId),...m.requiredSlots.filter(k=>k!=='broker_name').map(k=>c.facts[k].sourceId),...hook.sourceIds])];
    const evidenceFingerprint=JSON.stringify({signal:s,facts:[...new Set([...t.requiredFacts,...m.requiredSlots.filter(k=>k!=='broker_name')])].sort().map(k=>[k,c.facts[k]]),hook});
    return {status:'broker-review',version:library.version,personId:c.personId,ownerId:c.ownerId,sopVersion:c.sopVersion,messageId:m.id,contentId:m.contentId,approachId:a.id,techniqueId:t.id,signalCode:t.signalCode,signalKey,body,subject:m.subject,evidenceIds,evidenceCutoff:c.evidenceCutoff,evidenceFingerprint,reason:t.title+'; '+s.status+'; approach explicitly reviewed against source rule',appointmentPurpose:a.appointmentPurpose,onReply:a.onReply,sent:false};
   }
  }
 }
 return {status:'hold',reason:missing.size?'required-evidence-missing':c.pendingCustomerReply?'answer-pending-customer-reply':eligible?'distinct-eligible-copy-exhausted-or-followup-not-earned':'no-reviewed-applicable-signal',...(missing.size?{missing:[...missing].sort()}: {})};
}
/** Call again with current evidence before using a previously edited draft. */
export function recheck(p:Proposal,c:Context){const blocked=contextHold(c);if(blocked)return {ok:false,reason:blocked};if(p.version!==library.version||p.personId!==c.personId||p.ownerId!==c.ownerId||p.sopVersion!==c.sopVersion||p.evidenceCutoff!==c.evidenceCutoff)return {ok:false,reason:'draft-context-changed'};const phase=library.messages.find(m=>m.id===p.messageId)?.phase as 'opening'|'follow-up'|'alternate-angle'|undefined;const q=propose(c,{phase,techniqueId:p.techniqueId,approachId:p.approachId});return q.status==='broker-review'&&q.contentId===p.contentId&&q.evidenceFingerprint===p.evidenceFingerprint?{ok:true,reason:'broker-review-still-required'}:{ok:false,reason:q.status==='hold'?q.reason:'proposal-no-longer-applicable'};}
