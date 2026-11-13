import {contactHistoryState} from '@/lib/policy/contact-history';
/** Flow-only relationship views. Does not change shared SOP or response clocks. */
import {cadencePolicy,policyStage} from '@/lib/policy/vesta';
const DAY=86400000;
const at=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value))?Date.parse(value):null;
const tags=(lead:any):string[]=>(lead.tags||[]).map((tag:any)=>typeof tag==='string'?tag.trim().toLowerCase():String(tag?.name||'').trim().toLowerCase());
export const isImportantContact=(lead:any)=>tags(lead).includes('important');
export const isPastClient=(lead:any)=>policyStage(lead.cadenceStage||lead.stage)==='closed';
export function contactEstablished(lead:any){return contactHistoryState(lead)==='prior-conversation';}

export function needsBuyerContact(lead:any){
 if(lead.leadLane!=='buyer'||contactHistoryState(lead)!=='no-conversation')return false;
 return ['lead','attempted contact','buyer new and needs contact','buyer new needs contact'].includes(policyStage(lead.cadenceStage||lead.stage))||lead.cadenceKey==='buyer-new-contact'||tags(lead).some(t=>/^buyer new(?: and)? needs contact$/.test(t));
}
export function nurturePlanNeeded(lead:any){return policyStage(lead.cadenceStage||lead.stage)==='nurture'&&(String(lead.cadenceKey||'').includes('unmapped')||lead.cadenceStatus==='unknown');}
export function nurtureCadenceConflict(lead:any){
 if(policyStage(lead.cadenceStage||lead.stage)!=='nurture')return false;
 const patterns=[/longterm nurture once[\s/]week/,/longterm nurture twice[\s/]month/,/longterm nurture monthly/,/longterm nurture every other month/,/longterm nurture every 6 months/];
 return patterns.filter(pattern=>tags(lead).some(t=>pattern.test(t))).length>1;
}
export function flowRelationshipSignals(lead:any,now=Date.now()){
 const needsContact=needsBuyerContact(lead),important=isImportantContact(lead),pastClient=isPastClient(lead),needsCadencePlan=nurturePlanNeeded(lead),cadenceConflict=nurtureCadenceConflict(lead);
 const outreach=at(lead.brokerOutreachAt),nextTask=at(lead.nextTaskAt),appointment=at(lead.nextAppointmentAt),raise=at(lead.handRaiseAt),communication=at(lead.lastCommunicationAt);
 const dueTask=Number(lead.overdueTaskCount||0)>0||(nextTask!==null&&nextTask<=now);
 const recentRequest=raise!==null&&raise<=now&&now-raise<=7*DAY&&(communication===null||raise>communication);
 const appointmentDue=appointment!==null&&appointment>=now&&appointment<=now+2*DAY;
 const needsContactNow=needsContact&&(outreach===null||['due','overdue','unknown'].includes(lead.cadenceStatus));
 const planned=nextTask!==null&&nextTask>now+DAY;
 const importantPlan=important&&!pastClient&&!planned&&lead.cadenceStatus!=='current'&&!contactEstablished(lead);
 return {needsContact,needsContactNow,important,pastClient,needsCadencePlan,cadenceConflict,dueTask,recentRequest,appointmentDue,importantPlan,
  queueEligible:!pastClient||dueTask||recentRequest||appointmentDue,
  reason:needsContactNow?'Buyer new / needs contact':cadenceConflict?'Review conflicting nurture cadence tags':needsCadencePlan?'Nurture follow-up needs a plan':important?'Important relationship':pastClient?'Scheduled past-client follow-up':null};
}
export function completionStillHeld(lead:any,event:any,now=Date.now()){
 const completed=at(event.createdAt);if(completed===null)return false;
 const raise=at(lead.handRaiseAt);if(raise!==null&&raise>completed&&raise<=now)return false;
 const policy=cadencePolicy({lane:lead.leadLane||'buyer',stage:lead.cadenceStage||lead.stage||'',tags:lead.tags||[],timeframeStatus:lead.timeframeStatus});
 // A completion note is not a permanent opt-out. Reopen at the next approved
 // interval. Unknown Nurture remains a planning reminder after a short review hold.
 const days=policy.days??1;
 return now<completed+days*DAY;
}
