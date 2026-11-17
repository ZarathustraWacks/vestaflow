import {restore,contextFor,contextKey,type Context,type Workspace} from './engine';
// The baseline excludes publication IDs, but retains customer intent and safety
// fields. A new publication alone must not erase a broker's choices.
export const evidenceKey=(c:Context)=>{const {snapshotId,...fields}=c;return JSON.stringify(fields)};
export function rememberEditor(w:Workspace,c:Context,baseline:Context,holdReason=''):Workspace{
 restore(w);if(c.leadId!==baseline.leadId)throw new Error('Editor contact does not match current evidence.');
 return {...w,selectedLeadId:c.leadId,editors:{...w.editors,[c.leadId]:{context:{...c,consent:false,identityVerified:false},baseKey:evidenceKey(baseline),holdReason:holdReason.slice(0,2000)}}};
}
export function resumeEditor(w:Workspace,lead:any){
 const baseline=contextFor(lead),stored=w.editors?.[baseline.leadId];
 if(!stored||stored.baseKey!==evidenceKey(baseline))return {context:baseline,holdReason:stored?.holdReason||'',choicesChanged:Boolean(stored)};
 const c=stored.context,raw=lead?.raw||{};const channel:Context['channel']=c.channel==='email'?'email':'sms';
 const dnc=Boolean(raw.doNotContact||lead?.doNotContact||(channel==='sms'?raw.doNotText:raw.doNotEmail));
 return {context:{...baseline,pathId:c.pathId,outcomeId:c.outcomeId,condition:c.condition,conditionCleared:c.conditionCleared,managerReason:c.managerReason,topicPathId:c.topicPathId,channel,dnc,sourceDnc:dnc,consent:false,identityVerified:false},holdReason:stored.holdReason,choicesChanged:false};
}
export function saveWorkingText(w:Workspace,id:string,body:string,now=new Date()):Workspace{
 restore(w);const d=w.drafts.find(x=>x.id===id);
 if(!d||!['draft','approved'].includes(d.status))throw new Error('Choose an editable draft first.');
 if(body.length>1800)throw new Error('Keep the proposed message under 1,800 characters.');
 if(body===d.body)return w;
 const key='working:'+id,entry={id:key,leadId:d.leadId,body,at:now.toISOString(),decisionId:id,kind:'edited' as const};
 // One working revision per draft, not one history record per keystroke.
 if(!w.history.some(h=>h.id===key)&&w.history.length>=20000)throw new Error('Review history is full; export it before continuing.');
 return {...w,drafts:w.drafts.map(x=>x.id===id?{...x,body,revision:x.revision+1,approvedKey:null,status:'draft'}:x),history:w.history.some(h=>h.id===key)?w.history.map(h=>h.id===key?entry:h):[...w.history,entry]};
}
export function persistWorkspace(storage:Pick<Storage,'getItem'|'setItem'>,key:string,expected:string|null,next:Workspace){
 if(storage.getItem(key)!==expected)throw new Error('Another tab changed these saved drafts. Your text is still here. Export it before reloading.');
 const encoded=JSON.stringify(restore(next));storage.setItem(key,encoded);return encoded;
}
