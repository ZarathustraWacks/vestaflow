/** Fixed-destination, identifier-only handoff. Authorization remains in Flow. */
export const FLOW_MESSAGING_ORIGIN='https://vestaflow.vercel.app';
const id=(v:string|null)=>v!==null&&/^[1-9]\d*$/.test(v)&&Number.isSafeInteger(Number(v))?v:null;
export function parseMessagingHandoff(params:URLSearchParams){
 if(params.get('workspace')!=='appointment-messages')return null;
 const leadId=id(params.get('leadId')),brokerId=id(params.get('brokerId'));
 return leadId&&brokerId?{leadId,brokerId:Number(brokerId)}:null;
}
export function messagingHandoffUrl(leadId:string,brokerId:string|number){
 const params=new URLSearchParams({workspace:'appointment-messages',leadId,brokerId:String(brokerId)});
 if(!parseMessagingHandoff(params))return null;
 return FLOW_MESSAGING_ORIGIN+'/?'+params;
}
export function handoffContactId(contacts:{id:string|number}[],requested:string|undefined,prior?:string){
 if(requested)return contacts.some(c=>String(c.id)===requested)?requested:'';
 return prior&&contacts.some(c=>String(c.id)===prior)?prior:contacts.length?String(contacts[0].id):'';
}
