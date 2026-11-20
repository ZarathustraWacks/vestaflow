/** Broader FUB evidence adds attention; Vesta owns all SOP/action decisions. */
export const SMART_LIST_CONTRACT='vesta-smart-list-opportunities-v1';
export type SmartListSignal={personId:string;ownerId:string;listId:string;label:string;signal:string;observedAt:string;expiresAt:string;vestaId?:string|null;usage:string;actualCredit:number;changesCadence:boolean;comparisonFlags?:string[]};
export type SmartListEvidence={contractVersion:string;items:SmartListSignal[]};
const signals=new Set(['inbound-buyer','inbound-seller','no-contact-nurture','recent-activity','important','nurture-weekly','nurture-monthly','nurture-twice-monthly','nurture-every-other-month','nurture-every-six-months','past-client','appointment-set','appointment-met','contact-stage']);
const id=(v:unknown)=>/^[1-9][0-9]*$/.test(String(v??''));
export function currentSmartListSignals(lead:any,now=Date.now()):SmartListSignal[]{
 const evidence=lead.smartListEvidence as SmartListEvidence|undefined;
 if(evidence?.contractVersion!==SMART_LIST_CONTRACT||!Array.isArray(evidence.items)||!id(lead.id)||!id(lead.assignedUserId))return [];
 if(['trash','deleted','archived','cold leads','recruiting','renter','renters','vendors/professionals'].includes(String(lead.stage||'').trim().toLowerCase())||[true,1,'true','1'].includes(lead.raw?.doNotContact))return [];
 const unique=new Map<string,SmartListSignal>();
 for(const item of evidence.items){
  if(!item||typeof item!=='object')continue;
  const observed=Date.parse(item.observedAt),expires=Date.parse(item.expiresAt);
  if(String(item.personId)!==String(lead.id)||String(item.ownerId)!==String(lead.assignedUserId)||!id(item.listId)||item.vestaId!=null&&String(item.vestaId)!==String(lead.id)||item.usage!=='additive-opportunity'||item.actualCredit!==0||item.changesCadence!==false||!signals.has(item.signal)||!Number.isFinite(observed)||!Number.isFinite(expires)||observed>now||expires<=now||expires<=observed)continue;
  unique.set(item.listId,item);
 }
 return [...unique.values()];
}
export function smartListAttention(lead:any,now=Date.now()){
 const items=currentSmartListSignals(lead,now),labels=[...new Set(items.map(item=>item.label))];
 const points=items.reduce((max,item)=>Math.max(max,['inbound-buyer','inbound-seller','recent-activity'].includes(item.signal)?40:item.signal==='important'?30:item.signal==='no-contact-nurture'?20:10),0);
 return {items,labels,points,available:items.length>0,reason:labels.length?`FUB Smart List: ${labels.join(', ')}. Review within Vesta’s current plan.`:''};
}
export function attachSmartListEvidence<T extends {id:number|string;assignedUserId:number|null}>(leads:T[],items:SmartListSignal[]):T[]{
 const byId=new Map<string,SmartListSignal[]>();for(const item of items){if(!item||typeof item!=='object')continue;const k=String(item.personId);byId.set(k,[...(byId.get(k)||[]),item]);}
 return leads.map(lead=>({...lead,smartListEvidence:{contractVersion:SMART_LIST_CONTRACT,items:byId.get(String(lead.id))||[]}}));
}
