/** Explicit per-contact task creation. Planning is never outreach or a Done event. */
import {fubRequest} from './client';
import {ledger} from '@/lib/render/flow-ledger';
import {assertBulkOwner,bulkPlanHash,bulkTaskName,bulkTaskReference,verifyBulkTask,type BulkPlan} from '@/lib/flow/bulk-plan';
export async function scheduleBulkContact(plan:BulkPlan,leadId:string){
 if(!plan.leadIds.includes(leadId))throw new Error('Contact is outside the reviewed selection.');
 const person=(await fubRequest<any>(`/people/${encodeURIComponent(leadId)}`)).data;
 assertBulkOwner(person,plan.actorUserId);
 const runKey=`flow-plan:${plan.actorUserId}:${plan.requestId}:${leadId}`,fingerprint=bulkPlanHash(plan);
 const prior=(await ledger<{run:any}>(`/runs?runKey=${encodeURIComponent(runKey)}`)).run;
 if(prior){if(prior.fingerprint!==fingerprint)throw new Error('This schedule changed after it started. Open a new schedule.');return {...prior,alreadyCreated:true};}
 // Check exact source marker before acquiring a new dispatch claim. This also
 // recovers a confirmed resource after a lost acknowledgement without a new POST.
 const reference=bulkTaskReference(plan,leadId),lookup=(await fubRequest<any>(`/tasks?personId=${leadId}&name=${encodeURIComponent(`[Vesta plan: ${reference}]`)}&limit=100`)).data;
 if(!Array.isArray(lookup.tasks)||lookup._metadata?.next||lookup._metadata?.nextLink||Number(lookup._metadata?.total||0)>lookup.tasks.length)throw new Error('FUB task visibility is incomplete; no new task was created.');
 const matches=lookup.tasks.filter((task:any)=>verifyBulkTask(task,plan,leadId));
 if(matches.length>1)throw new Error('Multiple tasks share this schedule reference. Review the contact in FUB.');
 const record=(task:any,alreadyCreated=false)=>({ok:true,leadId,leadName:person.name||`Contact ${leadId}`,fingerprint,alreadyCreated,verified:true,task:{id:String(task.id),leadId,name:task.name,type:task.type||plan.type,dueAt:plan.dueAt,assignedUserId:plan.actorUserId,assignedUserName:typeof person.assignedTo==='string'?person.assignedTo:String(person.assignedTo?.name||''),leadName:person.name||`Contact ${leadId}`,leadStage:person.stage||'Unknown',cadenceStatus:'unknown',cadenceLabel:'Scheduled follow-up',cadenceDaysLate:0,priority:'Monitor',fubUrl:`/2/people/view/${leadId}`},message:'FUB task verified. No outreach, stage change or cadence-tag change recorded.'});
 if(matches.length===1)return record(matches[0],true);
 const claim=await ledger<{token:string|null}>('/claims',{runKey});if(!claim.token)throw new Error('This contact is already processing or needs source review. Retry this same schedule after checking FUB; do not start a duplicate schedule.');
 await ledger('/sending',{runKey,token:claim.token});
 // POST is deliberately issued once. A timeout is not permission to resend.
 const created=(await fubRequest<any>('/tasks',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({personId:Number(leadId),assignedUserId:plan.actorUserId,name:bulkTaskName(plan,leadId),type:plan.type,dueDateTime:plan.dueAt,isCompleted:false})})).data;
 if(!created?.id)throw new Error('FUB did not return a task ID. Check the contact before retrying this schedule.');
 const confirmed=(await fubRequest<any>(`/tasks/${encodeURIComponent(String(created.id))}`)).data;
 if(!verifyBulkTask(confirmed,plan,leadId))throw new Error('FUB task readback did not match the reviewed schedule. Check the contact before retrying.');
 const receipt=record(confirmed);
 try{await ledger('/complete',{runKey,token:claim.token,record:receipt});return {...receipt,receiptStored:true};}
 catch{return {...receipt,receiptStored:false,message:'The FUB task is verified, but its Flow receipt could not be finalized. Keep this result; a retry checks the same source reference.'};}
}
