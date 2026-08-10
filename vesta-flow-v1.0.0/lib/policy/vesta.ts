export type LeadLane='buyer'|'seller'|'renter'|'candidate-rental'|'needs-classification';
export type CadenceStatus='current'|'due'|'overdue'|'not-required'|'unknown';
export interface CadencePolicy {key:string;label:string;days:number|null;clearRequired:boolean;basis:string;}

const lower=(value:unknown)=>typeof value==='string'?value.trim().toLowerCase():'';
const has=(tags:string[],pattern:RegExp)=>tags.some(tag=>pattern.test(lower(tag)));

export function resolveLane(input:{stage:string;source:string;tags:string[]}){
 const stage=lower(input.stage),source=lower(input.source),tags=input.tags||[];
 const renterStage=stage==='renter';
 const seller=has(tags,/(^|\b)seller(s)?(\b|$)/);
 const explicitRental=has(tags,/(^|\b)(rent|rental|rentals|renter|renters|tenant|tenants|lease|leasing)(\b|$)/);
 const predictiveRenter=has(tags,/(likely|predicted|probable|propensity).*rent(er|al)?/);
 const rentalSource=/(^|\.)apartments\.com(?:\b|\/)/.test(source)||/\b(rent|rental|tenant|lease|apartments)\b/.test(source);
 if((renterStage||explicitRental)&&seller)return {lane:'needs-classification' as const,reason:'Confirmed rental signal conflicts with Seller tag',evidence:[renterStage?'stage:Renter':'tag:Rental','tag:Seller']};
 if(seller&&predictiveRenter)return {lane:'needs-classification' as const,reason:'Seller intent conflicts with predictive renter signal',evidence:['tag:Seller','tag:predictive-renter']};
 if(renterStage)return {lane:'renter' as const,reason:'Confirmed by FUB Renter stage',evidence:['stage:Renter']};
 if(explicitRental)return {lane:'renter' as const,reason:'Confirmed by explicit FUB rental tag',evidence:['tag:Rental']};
 if(seller)return {lane:'seller' as const,reason:'Confirmed by FUB Seller tag',evidence:['tag:Seller']};
 if(rentalSource||predictiveRenter)return {lane:'candidate-rental' as const,reason:rentalSource?'Rental source requires Renter-stage confirmation':'Predictive renter signal requires confirmation',evidence:[rentalSource?`source:${input.source}`:'tag:predictive-renter']};
 return {lane:'buyer' as const,reason:'FUB buyer default: no Seller tag and not Renter stage',evidence:[]};
}

export function cadencePolicy(input:{lane:LeadLane;stage:string;tags:string[];timeframeStatus?:string|null}):CadencePolicy{
 const stage=lower(input.stage),tags=input.tags||[],timeframe=lower(input.timeframeStatus);
 const none=(key:string,label:string,basis:string):CadencePolicy=>({key,label,days:null,clearRequired:false,basis});
 if(input.lane==='needs-classification'||input.lane==='candidate-rental')return none('classification-review','Classification review','Lane must be confirmed before cadence can be trusted.');
 if(input.lane==='renter')return none('renter','Renters','SOP frequency is N/A.');
 if(input.lane==='seller'){
  if(stage==='active listing')return none('seller-active-listing','Active Listing','SOP frequency is N/A.');
  if(stage==='listing agreement')return {key:'seller-listing-agreement',label:'Listing Agreement',days:1,clearRequired:false,basis:'Daily review; SOP says it does not need clearing.'};
  if(stage==='appointment set')return {key:'seller-appointment-set',label:'Seller Appointment Set',days:1,clearRequired:true,basis:'Daily until listing walkthrough is completed.'};
  if(stage==='nurture'){
   const values=[timeframe,...tags.map(lower)].join(' ');
   if(/0\s*[-–]\s*3/.test(values))return {key:'seller-0-3',label:'Seller 0–3 Months',days:3,clearRequired:true,basis:'Seller nurture timeframe.'};
   if(/3\s*[-–]\s*6/.test(values))return {key:'seller-3-6',label:'Seller 3–6 Months',days:14,clearRequired:true,basis:'Seller nurture timeframe.'};
   if(/6\s*[-–]\s*9/.test(values))return {key:'seller-6-9',label:'Seller 6–9 Months',days:21,clearRequired:true,basis:'Seller nurture timeframe.'};
   if(/9\s*[-–]\s*12|12\+/.test(values))return {key:'seller-9-12-plus',label:'Seller 9–12+ Months',days:30,clearRequired:true,basis:'Seller nurture timeframe.'};
   return none('seller-nurture-unmapped','Seller nurture needs timeframe','Nurture seller is missing an approved timeframe.');
  }
  if(['lead','attempted contact','spoke with'].includes(stage))return {key:'seller-new-contact',label:'Seller New Needs Contact',days:1,clearRequired:true,basis:'Daily new seller follow-up.'};
 }
 if(['lead','attempted contact','spoke with'].includes(stage))return {key:'buyer-new-contact',label:'Buyer New Needs Contact',days:1,clearRequired:true,basis:'Daily new buyer follow-up.'};
 if(stage==='under contract')return none('under-contract','Under Contract','SOP frequency is N/A.');
 if(['showing homes','submitting offers'].includes(stage))return {key:'buyer-active',label:'Active Buyer',days:2,clearRequired:true,basis:'Showing/offers cadence.'};
 if(['appointment set','appointment met'].includes(stage))return {key:'buyer-appointment',label:stage==='appointment set'?'Appointment Set':'Appointment Met',days:1,clearRequired:true,basis:'Daily appointment follow-up.'};
 if(stage==='closed')return {key:'past-client',label:'Past Client',days:90,clearRequired:true,basis:'Every three months.'};
 if(stage==='nurture'){
  if(has(tags,/longterm nurture once[\s/]week/))return {key:'nurture-weekly',label:'Nurture Weekly',days:7,clearRequired:true,basis:'Approved nurture tag.'};
  if(has(tags,/longterm nurture twice[\s/]month/))return {key:'nurture-twice-month',label:'Nurture Twice / Month',days:14,clearRequired:true,basis:'Approved nurture tag.'};
  if(has(tags,/longterm nurture monthly/))return {key:'nurture-monthly',label:'Nurture Monthly',days:30,clearRequired:true,basis:'Approved nurture tag.'};
  if(has(tags,/longterm nurture every other month/))return {key:'nurture-bi-monthly',label:'Nurture Every Other Month',days:60,clearRequired:true,basis:'Approved nurture tag.'};
  if(has(tags,/longterm nurture every 6 months/))return {key:'nurture-six-month',label:'Nurture Every 6 Months',days:180,clearRequired:true,basis:'Approved nurture tag.'};
  return none('buyer-nurture-unmapped','Buyer nurture needs cadence tag','Nurture buyer is missing an approved cadence tag.');
 }
 return none('unmapped','Unmapped SOP lane','No approved cadence mapping exists for this stage.');
}

export function cadenceState(policy:CadencePolicy,lastCommunicationAt:string|null,now=Date.now()){
 if(policy.days===null)return {status:policy.key.includes('unmapped')||policy.key.includes('classification')?'unknown' as const:'not-required' as const,dueAt:null,daysLate:null};
 if(!lastCommunicationAt)return {status:'overdue' as const,dueAt:null,daysLate:null};
 const last=new Date(lastCommunicationAt).getTime();if(!Number.isFinite(last))return {status:'unknown' as const,dueAt:null,daysLate:null};
 const due=last+policy.days*86400000,delta=Math.floor((now-due)/86400000);
 return {status:now<due?'current' as const:delta===0?'due' as const:'overdue' as const,dueAt:new Date(due).toISOString(),daysLate:Math.max(0,delta)};
}

export const HAND_RAISE_TYPES=['Inquiry','Seller Inquiry','Property Inquiry','General Inquiry','Incoming Call','Appointment Request'];
