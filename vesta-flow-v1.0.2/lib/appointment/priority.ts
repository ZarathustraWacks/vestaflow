/** The messaging view consumes Flow's already-authorized, unsuppressed queue.
 * It never reconstructs a queue from the customer roster. */
export function hasRecordedConversation(lead:any){
 const date=(v:any)=>typeof v==='string'&&Number.isFinite(Date.parse(v));
 return Boolean(date(lead.twoWayEngagementAt)||date(lead.documentedContactAt)||lead.contactContext?.contactEstablished===true||lead.contacted===true||lead.raw?.contacted===true||/^(spoke with(?: customer)?|appointment set|appointment met|showing homes|submitting offers|under contract|closed)$/i.test(String(lead.cadenceStage||lead.stage||'').trim()));
}
export function messagingEligible(lead:any){
 return Boolean(lead&&/^[1-9]\d*$/.test(String(lead.id))&&['buyer','seller'].includes(lead.leadLane)&&!/zenlist/i.test(lead.source||'')&&!/^(recruiting|vendors\/professionals|trash|deleted|archived|cold leads)$/i.test(String(lead.stage||'').trim())&&!lead.doNotContact&&!lead.raw?.doNotContact&&!lead.contextConflict);
}
export function messagingQueue(queue:any[],brokerId:number|null,now=Date.now()){
 if(brokerId===null)return [];
 const urgency:Record<string,number>={Immediate:4,Today:3,'This week':2,Monitor:1};
 const cadence:Record<string,number>={overdue:3,due:2,unknown:1};
 return queue.filter(item=>Number(item.effectiveOwnerId)===brokerId&&messagingEligible(item.lead))
  .filter(item=>item.lead.cadenceStatus!=='current'||item.relationship?.needsContactNow||item.relationship?.recentRequest||item.relationship?.dueTask)
  .filter(item=>!item.lead.nextActionAt||Date.parse(item.lead.nextActionAt)<=now||item.relationship?.needsContactNow||item.relationship?.recentRequest||item.relationship?.dueTask)
  .sort((a,b)=>Number(hasRecordedConversation(a.lead))-Number(hasRecordedConversation(b.lead))||(cadence[b.lead.cadenceStatus]||0)-(cadence[a.lead.cadenceStatus]||0)||(urgency[b.priorityLabel]||0)-(urgency[a.priorityLabel]||0)||Number(b.lead.cadenceDaysLate||0)-Number(a.lead.cadenceDaysLate||0)||b.priorityScore-a.priorityScore||Number(a.position||0)-Number(b.position||0))
  .map(item=>({...item.lead,id:String(item.leadId),messagePriority:item.priorityLabel,messageReason:!hasRecordedConversation(item.lead)?'No recorded customer conversation':item.lead.cadenceLabel||'Cadence follow-up due'}));
}
