import {contactHistoryState} from './contact-history';
import {NEXT_ACTION_EVIDENCE} from '../next-action/evidence';
const at=(v:unknown,now:number)=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&Date.parse(v)<=now?Date.parse(v):null;
/** A concrete, current-owner plan may defer routine cadence, never a new inquiry.
 * Task update time records scheduling intent, not communication credit. */
export function scheduledTaskHold(lead:any,now=Date.now()){
 const due=typeof lead.nextTaskAt==='string'?Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(lead.nextTaskAt)?lead.nextTaskAt+'T00:00:00':lead.nextTaskAt):NaN;
 const planned=at(lead.nextTaskPlannedAt,now);
 if(!Number.isFinite(due)||due<=now||planned===null||!lead.nextTaskName||lead.nextTaskOwnerId!==lead.assignedUserId||!lead.assignedUserId||lead.overdueTaskCount>0||lead.contextConflict||contactHistoryState(lead,now)!=='prior-conversation')return null;
 const appointment=typeof lead.nextAppointmentAt==='string'?Date.parse(lead.nextAppointmentAt):NaN;
 if(Number.isFinite(appointment)&&appointment>=now&&appointment<=due)return null;
 const proof=lead.nextActionEvidence;
 const inquiry=proof?.contractVersion===NEXT_ACTION_EVIDENCE&&String(proof.inquiry?.personId)===String(lead.id)&&at(proof.cutoff,now)!==null?proof.inquiry?.at:null;
 const activity=[lead.handRaiseAt,lead.customerResponseAt,inquiry].map(v=>at(v,now)).filter((v):v is number=>v!==null);
 if(activity.some(v=>v>planned))return null;
 return {name:String(lead.nextTaskName),dueAt:lead.nextTaskAt as string,due,plannedAt:lead.nextTaskPlannedAt as string};
}
/** A missed historical response target remains a metric after outreach clears it. */
export function responseStillOutstanding(lead:any){
 const raise=Date.parse(lead.handRaiseAt||''),outreach=Date.parse(lead.brokerOutreachAt||'');
 if(Number.isFinite(raise)&&Number.isFinite(outreach)&&outreach>=raise&&outreach<=Date.now())return false;
 return !(lead.operationalClocks||[]).some((c:any)=>c.key==='first-contact-attempt'&&c.clearedAt&&Number.isFinite(Date.parse(c.clearedAt))&&Date.parse(c.clearedAt)<=Date.now());
}
