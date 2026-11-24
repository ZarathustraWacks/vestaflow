/** Presentation only: describe the existing policy without creating a timer or channel. */
import {cadencePolicy,type LeadLane} from './vesta';
type CadenceLead={cadenceKey?:string;cadenceLabel?:string;leadLane?:LeadLane;stage?:string;cadenceStage?:string;tags?:string[];timeframeStatus?:string|null;doNotCall?:boolean};
const actions:Record<string,string>={
 'buyer-new-contact':'Follow up to establish contact — daily',
 'seller-new-contact':'Follow up on selling plans — daily',
 'buyer-active':'Follow up on the search or offer — every 2 days',
 'buyer-appointment':'Follow up on the appointment — daily',
 'seller-appointment-set':'Confirm or prepare the listing walkthrough — daily',
 'seller-listing-agreement':'Review listing preparation — daily',
 'nurture-weekly':'Nurture follow-up — weekly (7 days)',
 'nurture-twice-month':'Nurture follow-up — twice monthly (14-day interval)',
 'nurture-monthly':'Nurture follow-up — monthly (30 days)',
 'nurture-bi-monthly':'Call for nurture follow-up — every other month (60 days)',
 'nurture-six-month':'Nurture follow-up — every 6 months (180 days)',
 'past-client':'Past-client check-in — every 3 months (90 days)',
 'seller-0-3':'Follow up on selling plans — every 3 days',
 'seller-3-6':'Follow up on selling plans — every 14 days',
 'seller-6-9':'Follow up on selling plans — every 21 days',
 'seller-9-12-plus':'Follow up on selling plans — monthly (30 days)',
};
export function dueCadenceAction(lead:CadenceLead):string{
 const key=lead.cadenceKey||cadencePolicy({lane:lead.leadLane||'needs-classification',stage:lead.cadenceStage||lead.stage||'',tags:lead.tags||[],timeframeStatus:lead.timeframeStatus}).key;
 if(key==='nurture-bi-monthly'&&lead.doNotCall)return 'Review call restriction before the 60-day nurture follow-up';
 if(key==='buyer-appointment'&&String(lead.cadenceStage||lead.stage).toLowerCase()==='appointment met')return 'Follow up on the meeting and agree the next step — daily';
 return actions[key]||'Confirm the follow-up cadence and next action';
}
