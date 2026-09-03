/** Resolve routing-manager custody without hard-coding operational decisions. */
import type {NormalizedLead,NormalizedUser,RoutingCustody} from '@/lib/domain/types';

const values=(value:string|undefined)=>String(value||'').split(',').map(item=>item.trim()).filter(Boolean);
const normalized=(value:unknown)=>String(value||'').trim().toLowerCase().replace(/[–—]/g,'-').replace(/\s+/g,' ');

export function routingManagerConfig(){
 return {
  ids:new Set(values(process.env.VESTA_ROUTING_MANAGER_USER_IDS).map(Number).filter(Number.isFinite)),
  names:new Set(values(process.env.VESTA_ROUTING_MANAGER_NAMES||'Rae-Anne Sutschek').map(normalized)),
 };
}

export function isRoutingManagerUser(user:Pick<NormalizedUser,'id'|'name'>){
 const config=routingManagerConfig();
 return config.ids.has(user.id)||config.names.has(normalized(user.name));
}

export function classifyRoutingCustody(lead:Pick<NormalizedLead,'tags'|'businessSegment'|'businessSegmentReason'|'stage'>):{custody:RoutingCustody;reason:string}{
 const evidence=[lead.stage,lead.businessSegmentReason,...(lead.tags||[])].map(normalized).join(' | ');
 if(/duplicate|merge record|same person/.test(evidence))return {custody:'data-repair',reason:'Duplicate or merge evidence indicates administrative custody.'};
 if(lead.businessSegment==='needs-classification'||/classification|wrong (category|lane|type)/.test(evidence))return {custody:'data-repair',reason:'The record needs classification or CRM data repair.'};
 if(/routing|route to|awaiting (broker|agent|assignment)|assignment hold|unassigned/.test(evidence))return {custody:'awaiting-assignment',reason:'FUB evidence marks the record as waiting for broker assignment.'};
 if(/direct service|manager client|rae only|personal client|personally working/.test(evidence))return {custody:'direct-service',reason:'FUB evidence marks the routing manager as the servicing broker.'};
 return {custody:'unknown',reason:'The record is owned by a routing manager, but FUB does not explain whether this is routing custody or direct service.'};
}

export function applyRoutingContext(lead:NormalizedLead):NormalizedLead{
 const config=routingManagerConfig(),routingManagerOwner=(lead.assignedUserId!==null&&config.ids.has(lead.assignedUserId))||config.names.has(normalized(lead.assignedUserName));
 if(!routingManagerOwner)return {...lead,routingManagerOwner:false,routingCustody:null,routingCustodyReason:null};
 const classified=classifyRoutingCustody(lead);
 return {...lead,routingManagerOwner:true,routingCustody:classified.custody,routingCustodyReason:classified.reason};
}
