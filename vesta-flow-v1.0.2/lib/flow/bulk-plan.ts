import {createHash} from 'node:crypto';
import {isOperationalLead} from '@/lib/operational-eligibility';
export const BULK_TYPES=['Follow Up','Call','Text','Email','Thank You'] as const;
export type BulkPlan={requestId:string;leadIds:string[];actorUserId:number;title:string;note:string;type:typeof BULK_TYPES[number];dueAt:string};
export function validateBulkPlan(body:any,now=Date.now()):BulkPlan{
 if(!body||typeof body!=='object')throw new Error('Invalid schedule.');
 if(typeof body.requestId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(body.requestId))throw new Error('Refresh the selection before starting a new schedule.');
 if(!Array.isArray(body.leadIds)||body.leadIds.length<1||body.leadIds.length>50||body.leadIds.some((id:any)=>!/^\d{1,10}$/.test(String(id))||Number(id)<=0))throw new Error('Select between 1 and 50 valid contacts.');
 const leadIds=[...new Set<string>(body.leadIds.map(String))];if(leadIds.length!==body.leadIds.length)throw new Error('A contact was selected more than once.');
 const actorUserId=Number(body.actorUserId);if(!Number.isSafeInteger(actorUserId)||actorUserId<=0)throw new Error('Choose an assigned broker.');
 const title=typeof body.title==='string'?body.title.trim():'',note=typeof body.note==='string'?body.note.trim():'';
 if((body.note!==undefined&&typeof body.note!=='string')||!title||title.length>100||note.length>160||/[\r\n]/.test(title+note))throw new Error('Use a task title up to 100 characters and a single-line planning note up to 160 characters.');
 if(!BULK_TYPES.includes(body.type))throw new Error('Choose a supported FUB task type.');
 if(typeof body.dueAt!=='string'||!/(?:Z|[+-]\d{2}:\d{2})$/.test(body.dueAt))throw new Error('Choose a follow-up date and time.');
 const due=Date.parse(body.dueAt);if(!Number.isFinite(due)||due<=now||due>now+2*366*86400000)throw new Error('Choose a future follow-up date within two years.');
 return {requestId:body.requestId,leadIds,actorUserId,title,note,type:body.type,dueAt:new Date(due).toISOString()};
}
export function bulkPlanHash(plan:BulkPlan){return createHash('sha256').update(JSON.stringify({...plan,leadIds:[...plan.leadIds].sort()})).digest('hex');}
export function bulkTaskReference(plan:BulkPlan,leadId:string){return createHash('sha256').update(`${plan.actorUserId}|${plan.requestId}|${leadId}`).digest('hex').slice(0,16);}
export function bulkTaskName(plan:BulkPlan,leadId:string){return `${plan.title}${plan.note?' - '+plan.note:''} [Vesta plan: ${bulkTaskReference(plan,leadId)}]`;}
export function assertBulkOwner(person:any,actorId:number){
 if(!person||String(person.id)===''||Number(person.assignedUserId??person.assignedTo?.id)!==actorId)throw new Error('The contact is no longer assigned to the selected broker. Refresh before scheduling.');
 if(!isOperationalLead(person))throw new Error('Inactive or campaign-holding contacts are not available for broker scheduling.');
}
export function verifyBulkTask(task:any,plan:BulkPlan,leadId:string){
 return Boolean(task&&task.id&&task.isCompleted!==true&&String(task.personId??task.person?.id)===leadId&&Number(task.assignedUserId??task.assignedTo?.id)===plan.actorUserId&&task.name===bulkTaskName(plan,leadId)&&Date.parse(task.dueDateTime||task.due||task.dueDate)===Date.parse(plan.dueAt));
}
