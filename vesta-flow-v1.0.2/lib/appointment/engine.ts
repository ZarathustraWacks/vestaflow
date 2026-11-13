import {contactHistoryState} from '../policy/contact-history';
import {paths,outcomes} from './catalog';
import {MESSAGE_POLICY_VERSION,messageLanguage,recordedTopic,coachingSources} from './playbook';
export type Context={leadId:string;name:string;stage:string;source:string;lane:string;consent:boolean;dnc:boolean;sourceDnc:boolean;pathId:string;outcomeId:string;condition:string;conditionCleared:boolean;managerReason:string;identityVerified:boolean;channel:'sms'|'email';snapshotId:string;cadencePlanningRequired?:boolean;messagePolicyVersion?:string;topicPathId?:string};
export type Draft={id:string;leadId:string;snapshotId:string;body:string;revision:number;contextKey:string;approvedKey:string|null;pathId:string;outcomeId:string;at:string;mode:'review-only';status:'draft'|'approved'|'held'|'simulated-delivery'|'simulated-failure'};
export type History={id:string;leadId:string;body:string;at:string;decisionId:string;kind:'proposed'|'edited'|'simulated-delivery'|'simulated-failure'};
export type Result={id:string;decisionId:string;kind:'customer_response'|'appointment_set';at:string;appointmentId?:string;verification:'simulated'};
export type TrainingCandidate={id:string;decisionId:string;leadId:string;revision:number;snapshotId:string;draftContextKey:string;originalBody:string;editedBody:string;reason:string;context:Context;at:string;reviewStatus:'pending';trainingEligible:false;sent:false};
export type Workspace={version:1;history:History[];drafts:Draft[];results:Result[];held:TrainingCandidate[]};
export const emptyWorkspace=():Workspace=>({version:1,history:[],drafts:[],results:[],held:[]});
export const contextFor=(lead:any):Context=>{
 const recorded=lead?.contactContext||{},raw=lead?.raw||{},stage=String(lead?.cadenceStage||lead?.stage||''),future=recorded.kind==='long-term',condition=recorded.condition||'';
 const channel=(!lead?.phones?.length&&lead?.emails?.length)||raw.doNotText?'email':'sms';
 const appointment=/^appointment (set|met)$/i.test(stage),requestAt=Math.max(0,...[lead?.handRaiseAt,lead?.customerResponseAt].map(value=>Date.parse(value||'')).filter(Number.isFinite)),outreachAt=Date.parse(lead?.brokerOutreachAt||''),freshRequest=Number.isFinite(requestAt)&&requestAt<=Date.now()&&Date.now()-requestAt<=7*86400000&&(!Number.isFinite(outreachAt)||requestAt>outreachAt),planMissing=lead?.cadenceStatus==='unknown'&&/^nurture$/i.test(stage)&&!freshRequest;
 const outcomeId=appointment?'appointment-set':condition||future?'not-ready':recorded.kind==='review'?'wrong':recorded.kind==='connected'||contactHistoryState(lead)==='prior-conversation'?'reply':'no-response';
 const topicPathId=recordedTopic(recorded),pathId=lead?.contextConflict?'hygiene':appointment?'appointment':condition?'conditional':future?'timing':/^closed$/i.test(stage)?'relationship':topicPathId||(/^nurture$/i.test(stage)?'timing':lead?.leadLane==='seller'?'seller':'new');
 return {messagePolicyVersion:MESSAGE_POLICY_VERSION,...(topicPathId?{topicPathId}:{}),...(planMissing?{cadencePlanningRequired:true}:{}),leadId:String(lead?.id||''),name:lead?.name||'',stage:lead?.stage||'',source:lead?.source||'',lane:lead?.leadLane||'buyer',consent:false,dnc:Boolean(raw.doNotContact||lead?.doNotContact||(channel==='sms'?raw.doNotText:raw.doNotEmail)),sourceDnc:Boolean(raw.doNotContact||lead?.doNotContact||(channel==='sms'?raw.doNotText:raw.doNotEmail)),pathId,outcomeId,condition,conditionCleared:false,managerReason:'',identityVerified:false,channel,snapshotId:String(lead?.decisionSnapshotId||'unverified')};
};
export const normalize=(text:string)=>text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export const contextKey=(c:Context)=>JSON.stringify(c);
export const draftDisposition=(draft:Draft|undefined,c:Context)=>!draft?'prepare':draft.contextKey===contextKey(c)?'reuse':draft.status==='held'?'keep-held':draft.revision>1?'keep-edits':'prepare';
const validTime=(value:string)=>Number.isFinite(Date.parse(value));
export function restore(value:unknown):Workspace{
 const w=value as Workspace;
 if(!w||w.version!==1||!Array.isArray(w.history)||!Array.isArray(w.drafts)||!Array.isArray(w.results)||(w.held!==undefined&&!Array.isArray(w.held))||w.history.length>20000||w.drafts.length>20000||w.results.length>20000||(w.held?.length||0)>20000)throw new Error('Draft history is unavailable or exceeds the review limit. Export it and review before continuing.');
 if(w.history.some(r=>!r||typeof r.id!=='string'||typeof r.body!=='string'||typeof r.leadId!=='string'||!validTime(r.at))||w.drafts.some(d=>!d||typeof d.id!=='string'||typeof d.body!=='string'||typeof d.contextKey!=='string'||!Number.isSafeInteger(d.revision)||!validTime(d.at))||w.results.some(r=>!r||typeof r.id!=='string'||typeof r.decisionId!=='string'||!validTime(r.at)))throw new Error('Stored draft history needs review; it was not silently reset.');
 if((w.held||[]).some(h=>!h||typeof h.id!=='string'||typeof h.decisionId!=='string'||typeof h.leadId!=='string'||typeof h.editedBody!=='string'||typeof h.reason!=='string'||!validTime(h.at)||h.trainingEligible!==false||h.sent!==false||h.reviewStatus!=='pending'))throw new Error('Stored model-review history needs review.');
 return {...w,held:w.held||[]};
}
export function gate(c:Context){
 if(!c.leadId)return 'Select a contact first.';
 if(c.dnc||c.sourceDnc||c.outcomeId==='stop')return 'Do not contact: outreach is stopped.';
 if(/^(recruiting|trash|deleted|archived|cold leads)$/i.test(c.stage.trim()))return 'This stage is excluded from customer appointment outreach.';
 if(/zenlist/i.test(c.source))return 'Reconcile the Zenlist-source duplicate to its original FUB record first.';
 if(c.cadencePlanningRequired)return 'Confirm a nurture follow-up plan in FUB before preparing more outreach.';
 if(['wrong'].includes(c.outcomeId)||['preference','hygiene'].includes(c.pathId))return 'Broker review is required before customer outreach.';
 if(!c.identityVerified)return 'Confirm the selected FUB record is the intended contact.';
 if(!c.consent)return 'Confirm permission for the selected contact channel.';
 if(!paths.some(p=>p.id===c.pathId)||!outcomes.some(o=>o.id===c.outcomeId))return 'Select a supported path and outcome.';
 if(['appointment-set','slot'].includes(c.outcomeId))return c.outcomeId==='appointment-set'?'Verify the actual appointment record; do not generate another appointment push.':'Confirm availability and the appointment details with the broker before replying.';
 return null;
}
export function step(c:Context){
 const path=paths.find(p=>p.id===c.pathId),outcome=outcomes.find(o=>o.id===c.outcomeId);
 if(c.dnc||c.sourceDnc||c.outcomeId==='stop')return 'Stop outreach';
 if(gate(c))return 'Review required';
 if(c.outcomeId==='not-ready'||(c.condition&&!c.conditionCleared)||path?.wait&&c.outcomeId==='no-response')return 'Permission / wait';
 return outcome?.next==='availability'?'Preferred appointment window':outcome?.next==='qualify'?'Clarify the need':'Offer a consultation';
}
export function messagePlan(c:Context){
 const blocked=preparationGate(c),waiting=step({...c,identityVerified:true,consent:true})==='Permission / wait';
 if(blocked)return {goal:c.dnc||c.sourceDnc||c.outcomeId==='stop'?'Stop outreach':'Review before outreach',route:[blocked],focus:'',waiting:false};
 const language=messageLanguage(c.pathId,c.topicPathId);
 return {goal:waiting?'Agree a check-in':c.outcomeId==='reply'?'Understand the next need':['ready','request'].includes(c.outcomeId)?'Request an appointment window':'Earn a reply and offer a short call',focus:language.focus,waiting,
  route:waiting?['Permission for a later check-in','Customer confirms readiness','Useful planning conversation','Preferred window','Broker verifies appointment']:c.outcomeId==='reply'?['Clarify one need','Offer a focused planning conversation','Preferred window','Broker verifies appointment']:['Useful planning conversation','Preferred window','Broker verifies appointment']};
}
const permission=[
 'Would you like to choose when we check in again, or reach out when you are ready?',
 'Would a later check-in be useful, or would you prefer to keep the next step in your hands?',
 'Is there a time you would prefer me to check back, or should I wait to hear from you?',
 'Would you prefer to pause here and get in touch when a planning conversation would help?'];
const uniqueId=(id:string,w:Workspace)=>{if(!id||w.drafts.some(d=>d.id===id)||w.history.some(h=>h.id===id)||w.results.some(r=>r.id===id)||(w.held||[]).some(r=>r.id===id))throw new Error('A unique event ID is required.');};
// Preparing wording is separate from authorizing outreach. Keep the original
// unconfirmed consent and identity fields in the draft's actual context.
export const preparationGate=(c:Context)=>gate({...c,identityVerified:true,consent:true});
export const prepare=(w:Workspace,c:Context,id:string,now=new Date())=>buildDraft(w,c,id,now,true);
export const assemble=(w:Workspace,c:Context,id:string,now=new Date())=>buildDraft(w,c,id,now,false);
function buildDraft(w:Workspace,c:Context,id:string,now:Date,preparation:boolean):Workspace{
 restore(w);uniqueId(id,w);const blocked=preparation?preparationGate(c):gate(c);if(blocked)throw new Error(blocked);
 if(w.history.length>=20000||w.drafts.length>=20000)throw new Error('Review history is full; export and reconcile it before generating more drafts.');
 const language=messageLanguage(c.pathId,c.topicPathId),plan=messagePlan(c);
 const invitations=[`Would a five-minute call about ${language.focus} be useful?`,`Would you be open to a short conversation about ${language.focus}?`,`Could we find five minutes to work through ${language.focus}?`,`Would you like to arrange a quick planning call about ${language.focus}?`];
 const availability=[`What day and time window would work for a short call about ${language.focus}? I will check availability before confirming.`,`When would you prefer to talk through ${language.focus}? I will verify the time before anything is booked.`,`Could you share a preferred window for a conversation about ${language.focus}? I will check the calendar first.`,`What time window would suit you for a planning call about ${language.focus}? We can confirm the details once availability is checked.`];
 const clarify=[language.question,`Before we plan a call, ${language.question.charAt(0).toLowerCase()+language.question.slice(1)}`,`To make a planning conversation useful, ${language.question.charAt(0).toLowerCase()+language.question.slice(1)}`,`So we can focus on the right next step, ${language.question.charAt(0).toLowerCase()+language.question.slice(1)}`];
 const ask=plan.waiting?permission:['ready','request'].includes(c.outcomeId)?availability:c.outcomeId==='reply'?clarify:invitations;
 // Every full text is checked against every saved proposal/edit, not a random
 // seed or cosmetic nonce. Finite supply exhausts into review, never repetition.
 const used=new Set(w.history.map(h=>normalize(h.body)));
 let body='';const candidates:string[]=[];
 // Time-of-day greetings are deliberately avoided: the broker chooses when to send.
 const greetings=['Hi','Hello','Hi there','Hello there','A quick note','Checking in'];
 for(const opening of greetings)for(const idea of language.values)for(const question of ask){
  const name=c.name.trim().split(/\s+/)[0]?.replace(/[\r\n<>]/g,'').slice(0,60),salutation=`${opening}${name?`, ${name}`:''}`;
  const introduction=c.outcomeId==='no-response'?"I'm with Vesta Preferred. ":'';
  const candidate=c.channel==='email'?`${salutation},\n\n${introduction}${idea}\n\n${question}\n\nVesta Preferred`:`${salutation} — ${introduction}${idea} ${question}`;
  candidates.push(candidate);
 }
 const start=(w.drafts.length*29)%candidates.length;
 for(let i=0;i<candidates.length;i++){const candidate=candidates[(start+i)%candidates.length];if(!used.has(normalize(candidate))){body=candidate;break}}
 if(!body)throw new Error('Distinct approved wording is exhausted for this path. Review new language instead of repeating a draft.');
 const draft:Draft={id,leadId:c.leadId,snapshotId:c.snapshotId,body,revision:1,contextKey:contextKey(c),approvedKey:null,pathId:c.pathId,outcomeId:c.outcomeId,at:now.toISOString(),mode:'review-only',status:'draft'};
 return {...w,drafts:[...w.drafts,draft],history:[...w.history,{id:'proposed:'+id,leadId:c.leadId,body,at:draft.at,decisionId:id,kind:'proposed'}]};
}
export function edit(w:Workspace,id:string,body:string,eventId:string,now=new Date()):Workspace{
 restore(w);uniqueId(eventId,w);const d=w.drafts.find(x=>x.id===id);
 if(!d||!['draft','approved'].includes(d.status))throw new Error('Only a draft can be edited.');
 if(body.length>1800)throw new Error('Keep the proposed message under 1,800 characters.');
 if(w.history.length>=20000)throw new Error('Review history is full; export and reconcile it first.');
 return {...w,drafts:w.drafts.map(x=>x.id===id?{...x,body,revision:x.revision+1,approvedKey:null,status:'draft'}:x),history:[...w.history,{id:eventId,leadId:d.leadId,body,at:now.toISOString(),decisionId:id,kind:'edited'}]};
}
export const reviewDraft=(w:Workspace,c:Context,id:string)=>review(w,c,id,true);
export const approve=(w:Workspace,c:Context,id:string)=>review(w,c,id,false);
function review(w:Workspace,c:Context,id:string,preparation:boolean):Workspace{
 restore(w);const blocked=preparation?preparationGate(c):gate(c);if(blocked)throw new Error(blocked);const d=w.drafts.find(x=>x.id===id);
 if(!d||d.contextKey!==contextKey(c)||d.leadId!==c.leadId||w.drafts.filter(x=>x.leadId===c.leadId).at(-1)?.id!==id||!['draft','approved'].includes(d.status))throw new Error('Contact context or draft changed; generate and review a fresh draft.');
 if(!d.body.trim())throw new Error('The proposed message is empty.');
 if(w.history.some(h=>h.decisionId!==id&&normalize(h.body)===normalize(d.body)))throw new Error('This wording was already proposed. Edit it or generate a distinct version.');
 return {...w,drafts:w.drafts.map(x=>x.id===id?{...x,status:'approved',approvedKey:contextKey(c)+'|'+x.revision+'|'+x.body}:x)};
}
export function simulate(w:Workspace,c:Context,id:string,success:boolean,eventId:string,now=new Date()):Workspace{
 uniqueId(eventId,w);const checked=approve(w,c,id),d=checked.drafts.find(x=>x.id===id)!;
 if(w.drafts.find(x=>x.id===id)?.status!=='approved'||d.approvedKey!==w.drafts.find(x=>x.id===id)?.approvedKey)throw new Error('Review and approve the current edited message first.');
 if(Date.parse(d.at)>now.getTime())throw new Error('Delivery cannot precede its draft.');
 return {...checked,drafts:checked.drafts.map(x=>x.id===id?{...x,status:success?'simulated-delivery':'simulated-failure'}:x),history:[...w.history,{id:eventId,leadId:c.leadId,body:d.body,at:now.toISOString(),decisionId:id,kind:success?'simulated-delivery':'simulated-failure'}]};
}
export function recordResult(w:Workspace,decisionId:string,kind:Result['kind'],eventId:string,appointmentId='',now=new Date()):Workspace{
 restore(w);uniqueId(eventId,w);const d=w.drafts.find(x=>x.id===decisionId),delivery=w.history.find(x=>x.decisionId===decisionId&&x.kind==='simulated-delivery');
 if(!d||d.status!=='simulated-delivery'||!delivery||Date.parse(delivery.at)>now.getTime())throw new Error('A result must follow a successful simulated delivery and reference its exact draft.');
 if(kind==='appointment_set'&&!appointmentId.trim())throw new Error('Provide a synthetic appointment evidence reference for the test.');
 if(w.results.some(x=>x.decisionId===decisionId&&x.kind===kind))throw new Error('This result is already recorded for this draft.');
 return {...w,results:[...w.results,{id:eventId,decisionId,kind,at:now.toISOString(),...(kind==='appointment_set'?{appointmentId:appointmentId.trim()}:{}),verification:'simulated'}]};
}
export function hold(w:Workspace,c:Context,id:string,reason:string,eventId:string,now=new Date()):Workspace{
 const checked=restore(w);uniqueId(eventId,checked);const d=checked.drafts.find(x=>x.id===id);
 if(!d||d.leadId!==c.leadId||!['draft','approved'].includes(d.status)||!d.body.trim())throw new Error('Choose an unsent draft for this contact.');
 if(!reason.trim())throw new Error('Add a reason so a reviewer can learn from this held draft.');
 if(Date.parse(d.at)>now.getTime())throw new Error('A held example cannot precede its draft.');
 if(checked.held.length>=20000)throw new Error('Model-review history is full; export and review it first.');
 const original=checked.history.find(h=>h.decisionId===id&&h.kind==='proposed');
 const candidate:TrainingCandidate={id:eventId,decisionId:id,leadId:d.leadId,revision:d.revision,snapshotId:d.snapshotId,draftContextKey:d.contextKey,originalBody:original?.body||d.body,editedBody:d.body,reason:reason.trim().slice(0,2000),context:{...c},at:now.toISOString(),reviewStatus:'pending',trainingEligible:false,sent:false};
 return {...checked,drafts:checked.drafts.map(x=>x.id===id?{...x,status:'held',approvedKey:null}:x),held:[...checked.held,candidate]};
}
export function exportReview(w:Workspace,c:Context){return {contract:'vesta-appointment-message-v1',messagePolicyVersion:MESSAGE_POLICY_VERSION,coachingSources,appointmentPlan:messagePlan(c),mode:'simulation',productionWrites:false,dispatchEnabled:false,trainingEligible:false,brokerCredit:false,timerEffect:'none',appointmentSetVerified:false,historyScope:'this browser only; cross-device delivery deduplication not configured',context:c,trainingCandidates:w.held||[],
 decisions:w.drafts.map(d=>({decision_id:d.id,lead_id:d.leadId,actor_id:'automation:test',selected_action:'appointment-message-review',created_at:d.at,status:d.status,revision:d.revision,body:d.body,verification_status:'simulated',snapshot_id:d.snapshotId})),
 outcomes:w.results.map(r=>({lead_id:w.drafts.find(d=>d.id===r.decisionId)?.leadId,decision_id:r.decisionId,outcome_type:r.kind,occurred_at:r.at,evidence_external_id:r.id,evidence_source:'appointment-workspace-simulated',payload:{simulation:true,trainingEligible:false,appointmentId:r.appointmentId||null}})),history:w.history};}
export function dispatch(){throw new Error('Live message delivery is not configured. This workspace only prepares and tests reviewed messages.');}
