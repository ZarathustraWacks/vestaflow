import {contactHistoryState} from '../policy/contact-history';
/** The messaging view consumes Flow's already-authorized, unsuppressed queue.
 * It never reconstructs a queue from the customer roster. */
export const hasRecordedConversation=(lead:any)=>contactHistoryState(lead)==='prior-conversation';
export const messageHistoryLabel=(lead:any)=>({
 'prior-conversation':'Recorded customer conversation','needs-review':'Communication history needs review','no-conversation':'No recorded customer conversation'
})[contactHistoryState(lead)];
export function messagingEligible(lead:any){
 return Boolean(lead&&/^[1-9]\d*$/.test(String(lead.id))&&['buyer','seller'].includes(lead.leadLane)&&!/zenlist/i.test(lead.source||'')&&!/^(recruiting|vendors\/professionals|trash|deleted|archived|cold leads)$/i.test(String(lead.stage||'').trim())&&!lead.doNotContact&&!lead.raw?.doNotContact&&!lead.contextConflict);
}
export function messagingQueue(queue:any[],brokerId:number|null,now=Date.now()){
 if(brokerId===null)return [];
 const created=(lead:any)=>{const at=Date.parse(lead.createdAt||'');return Number.isFinite(at)&&at<=now?at:0};
 const historyRank={'no-conversation':0,'needs-review':1,'prior-conversation':2};
 const urgency:Record<string,number>={Immediate:4,Today:3,'This week':2,Monitor:1};
 const cadence:Record<string,number>={overdue:3,due:2,unknown:1};
 return queue.filter(item=>Number(item.effectiveOwnerId)===brokerId&&messagingEligible(item.lead))
  .filter(item=>item.lead.cadenceStatus!=='unknown'||item.relationship?.needsContactNow||item.relationship?.recentRequest||item.relationship?.dueTask)
  .filter(item=>item.lead.cadenceStatus!=='current'||item.relationship?.needsContactNow||item.relationship?.recentRequest||item.relationship?.dueTask)
  .filter(item=>!item.lead.nextActionAt||Date.parse(item.lead.nextActionAt)<=now||item.relationship?.needsContactNow||item.relationship?.recentRequest||item.relationship?.dueTask)
  .sort((a,b)=>created(b.lead)-created(a.lead)||historyRank[contactHistoryState(a.lead)]-historyRank[contactHistoryState(b.lead)]||(cadence[b.lead.cadenceStatus]||0)-(cadence[a.lead.cadenceStatus]||0)||(urgency[b.priorityLabel]||0)-(urgency[a.priorityLabel]||0)||Number(b.lead.cadenceDaysLate||0)-Number(a.lead.cadenceDaysLate||0)||b.priorityScore-a.priorityScore||Number(a.position||0)-Number(b.position||0))
  .map(item=>({...item.lead,id:String(item.leadId),messagePriority:item.priorityLabel,messageReason:messageHistoryLabel(item.lead)}));
}
