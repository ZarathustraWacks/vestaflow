import { cached } from '@/lib/cache/memory';
import { demoLeads, demoTasks, demoUsers } from '@/lib/demo/data';
import { shouldUseDemo, getConfig } from './config';
import { fubRequest, paginate } from './client';
import { normalizePersonBase, normalizeTask, normalizeUser } from './normalize';
import { enrichLead, agentRollups } from '@/lib/spine/governance';
import { buildTimeline } from '@/lib/spine/timeline';
import { NormalizedTask, NormalizedUser, NormalizedLead } from '@/lib/domain/types';
import { scoreLeads } from '@/lib/learning/client';
import { auditAppointments } from '@/lib/policy/appointments';
import { listingProcess } from '@/lib/integrations/listing';
import { decisionSnapshot, POLICY_VERSION } from '@/lib/audit/snapshot';
import { HAND_RAISE_TYPES } from '@/lib/policy/vesta';

export async function identity(){if(shouldUseDemo())return {mode:'demo' as const,identity:{name:'Demo Brokerage',user:'Demo Broker'}};const r=await fubRequest<unknown>('/identity');return {mode:'live' as const,identity:r.data,rate:r.headers};}
async function rawUsers(){const c=getConfig();const x=await cached('fub:users:v6',c.cacheTtl,async()=>{const r=await paginate<any>('/users');return {items:r.items.map(normalizeUser),pages:r.pages,rate:r.headers,metadata:r.metadata,visited:r.visited}});return {...x.value,cache:x.cache};}
async function rawTasks(){const c=getConfig();const x=await cached('fub:tasks:v6',c.cacheTtl,async()=>{const r=await paginate<any>('/tasks?isCompleted=false');return {raw:r.items,pages:r.pages,rate:r.headers,metadata:r.metadata,visited:r.visited}});return {...x.value,cache:x.cache};}
async function metadataCollection(key:string,path:string){const c=getConfig();const result=await cached(`fub:policy:${key}:v1`,c.cacheTtl,async()=>{const response=await paginate<any>(path);return {items:response.items,pages:response.pages,metadata:response.metadata,visited:response.visited}});return {...result.value,cache:result.cache};}
export async function getPolicyCatalog(){
 if(shouldUseDemo())return {ok:true,mode:'demo' as const,policyVersion:POLICY_VERSION,smartLists:{items:[],pages:0,cache:'miss'},customFields:{items:[],pages:0,cache:'miss'},timeframes:{items:[{id:1,name:'0-3 Months'},{id:2,name:'3-6 Months'},{id:3,name:'6-9 Months'},{id:4,name:'9-12 Months'},{id:5,name:'12+ Months'}],pages:1,cache:'miss'},appointmentTypes:{items:[],pages:0,cache:'miss'},appointmentOutcomes:{items:[],pages:0,cache:'miss'}};
 const names=[['smartLists','/smartLists?all=true&fub2=true'],['customFields','/customFields'],['timeframes','/timeframes'],['appointmentTypes','/appointmentTypes'],['appointmentOutcomes','/appointmentOutcomes']] as const;
 const results=await Promise.all(names.map(async([key,path])=>{try{return [key,{ok:true,...await metadataCollection(key,path)}] as const}catch(error){return [key,{ok:false,items:[],pages:0,cache:'miss',error:error instanceof Error?error.message:'Unavailable'}] as const}}));
 return {ok:true,mode:'live' as const,policyVersion:POLICY_VERSION,requiredMappings:{buyerStages:['Lead','Attempted Contact','Spoke With','Showing Homes','Submitting Offers','Appointment Set','Appointment Met','Under Contract','Closed','Nurture'],sellerStages:['Lead','Attempted Contact','Spoke With','Appointment Set','Listing Agreement','Active Listing','Nurture'],renterStage:'Renter',sellerTag:'Seller',sellerTimeframes:['0-3 Months','3-6 Months','6-9 Months','9-12 Months','12+ Months']},...Object.fromEntries(results)};
}
export async function getUsers(){if(shouldUseDemo())return {mode:'demo' as const,items:demoUsers,pages:1,cache:'miss' as const,metadata:{},visited:[]};return {mode:'live' as const,...await rawUsers()};}
export async function getTasks(){if(shouldUseDemo())return {mode:'demo' as const,items:demoTasks,pages:1,cache:'miss' as const,metadata:{},visited:[]};const [u,t]=await Promise.all([rawUsers(),rawTasks()]);const map=new Map(u.items.map(x=>[x.id,x]));return {mode:'live' as const,items:t.raw.map(x=>normalizeTask(x,map)),pages:t.pages,cache:t.cache,metadata:t.metadata,visited:t.visited};}
async function attachLearning(items:NormalizedLead[]){const scores=await scoreLeads(items);return items.map((lead,i)=>({...lead,learningScore:scores[i]}));}
export async function getPeople(){
 if(shouldUseDemo()){const items=demoLeads.map(x=>enrichLead({...x,assignedUserRole:null,price:null,collaborators:[]},demoTasks));return {mode:'demo' as const,items:await attachLearning(items),pages:1,cache:'miss' as const,metadata:{},visited:[]};}
 const c=getConfig();const [u,t]=await Promise.all([rawUsers(),rawTasks()]);const userMap=new Map(u.items.map(x=>[x.id,x]));const tasks=t.raw.map(x=>normalizeTask(x,userMap));
 const x=await cached('fub:people:raw:v7',c.cacheTtl,async()=>{const r=await paginate<any>('/people?fields=allFields&includeTrash=true');return {raw:r.items,pages:r.pages,rate:r.headers,metadata:r.metadata,visited:r.visited}});
 const enriched=x.value.raw.map(p=>enrichLead(normalizePersonBase(p,userMap),tasks));
 return {mode:'live' as const,items:await attachLearning(enriched),pages:x.value.pages,rate:x.value.rate,metadata:x.value.metadata,visited:x.value.visited,cache:x.cache};
}
export async function getSpine(){const [people,users,tasks,policy]=await Promise.all([getPeople(),getUsers(),getTasks(),getPolicyCatalog()]);return {ok:true,mode:people.mode,people,users,tasks,policy,agents:agentRollups(people.items,users.items)};}
async function safeCollection(path:string){try{const r=await paginate<any>(path);return {ok:true,items:r.items,metadata:r.metadata,pages:r.pages};}catch(error){return {ok:false,items:[],error:error instanceof Error?error.message:'Unavailable'};}}
export async function getLeadIntelligence(id:string){
 const spine=await getSpine();const lead=spine.people.items.find(x=>String(x.id)===String(id));if(!lead)throw new Error('Lead not found');
 const leadTasks=spine.tasks.items.filter(x=>String(x.personId)===String(id));
 if(spine.mode==='demo'){const collections={calls:[{id:1,created:new Date(Date.now()-2*86400000).toISOString(),type:'Outbound call',outcome:'Voicemail'}],textMessages:[{id:2,created:new Date(Date.now()-86400000).toISOString(),type:'Text',message:'Following up on your home search.'}],events:[{id:3,created:new Date().toISOString(),type:'Viewed property',description:'Viewed 3 West Loop listings'}],notes:[],appointments:[]};return {ok:true,mode:'demo',lead,tasks:leadTasks,collections,timeline:buildTimeline(lead,leadTasks,collections),appointmentAudit:auditAppointments(collections.appointments),listingProcess:listingProcess(lead.raw),decisionSnapshot:decisionSnapshot(lead)};}
 const personId=encodeURIComponent(id);const [person,allTasks,calls,textMessages,events,notes,appointments]=await Promise.all([fubRequest<any>(`/people/${personId}`),safeCollection(`/tasks?personId=${personId}`),safeCollection(`/calls?personId=${personId}`),safeCollection(`/textMessages?personId=${personId}`),safeCollection(`/events?personId=${personId}`),safeCollection(`/notes?personId=${personId}`),safeCollection(`/appointments?personId=${personId}`)]);
 const userMap=new Map(spine.users.items.map(x=>[x.id,x]));const detailTasks=allTasks.ok?allTasks.items.map(x=>normalizeTask(x,userMap)):leadTasks;
 const handRaiseNames=new Set(HAND_RAISE_TYPES.map(value=>value.toLowerCase())),eventTime=(item:any)=>item?.created||item?.createdAt||item?.occurredAt||item?.date||null;
 const handRaiseAt=events.items.filter((item:any)=>handRaiseNames.has(String(item?.type||item?.eventType||item?.name||'').trim().toLowerCase())).map(eventTime).filter(Boolean).sort((a:string,b:string)=>new Date(b).getTime()-new Date(a).getTime())[0]||null;
 const freshLead=enrichLead({...normalizePersonBase(person.data,userMap),handRaiseAt},detailTasks);
 const enriched={...freshLead,learningScore:lead.learningScore};const collections={calls:calls.items,textMessages:textMessages.items,events:events.items,notes:notes.items,appointments:appointments.items};return {ok:true,mode:'live',lead:enriched,tasks:detailTasks,collections,timeline:buildTimeline(enriched,detailTasks,collections),rawPerson:person.data,availability:{tasks:allTasks,calls,textMessages,events,notes,appointments},appointmentAudit:auditAppointments(appointments.items),listingProcess:listingProcess(person.data),decisionSnapshot:decisionSnapshot(enriched)};
}
export async function debugSample(){if(shouldUseDemo())return {mode:'demo',note:'Add FUB_API_KEY and set FUB_DEMO_MODE=false for a live sample.'};const [identityResult,peopleResult,usersResult]=await Promise.all([fubRequest<unknown>('/identity'),fubRequest<Record<string,unknown>>('/people?limit=2&fields=allFields'),fubRequest<Record<string,unknown>>('/users?limit=10')]);return {mode:'live',identity:identityResult.data,peopleSample:peopleResult.data,usersSample:usersResult.data,safeHeaders:{rateLimit:peopleResult.headers['x-ratelimit-limit']??null,rateRemaining:peopleResult.headers['x-ratelimit-remaining']??null,rateWindow:peopleResult.headers['x-ratelimit-window']??null}};}
