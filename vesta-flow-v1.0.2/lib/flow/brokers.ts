interface LeadOwner {assignedUserId:number|null;assignedUserName?:string|null;assignedUserRole?:string|null}
interface SpineUser {id:number;name:string;role:string;isActive:boolean}

export interface FlowBroker {id:number;name:string;role:string;leadCount:number;source:'fub-user'|'lead-owner';isActive:boolean}

export function discoverBrokers(leads:LeadOwner[],users:SpineUser[]):FlowBroker[]{
 const assignedIds=new Set(leads.map(lead=>lead.assignedUserId).filter((id):id is number=>id!==null));
 const brokers=new Map<number,FlowBroker>();
 for(const user of users){
  const operationalRole=['agent','broker'].some(role=>String(user.role).toLowerCase().includes(role));
  if(user.isActive&&(assignedIds.has(user.id)||operationalRole))brokers.set(user.id,{id:user.id,name:user.name,role:user.role,leadCount:0,source:'fub-user',isActive:true});
 }
 for(const lead of leads){
  if(lead.assignedUserId===null)continue;
  const existing=brokers.get(lead.assignedUserId);
  if(existing){existing.leadCount+=1;continue;}
  brokers.set(lead.assignedUserId,{id:lead.assignedUserId,name:lead.assignedUserName||`Follow Up Boss user ${lead.assignedUserId}`,role:lead.assignedUserRole||'Assigned owner',leadCount:1,source:'lead-owner',isActive:true});
 }
 return [...brokers.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
