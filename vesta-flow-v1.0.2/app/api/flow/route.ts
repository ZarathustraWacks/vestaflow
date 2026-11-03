import { NextRequest,NextResponse } from 'next/server';
import { getFlowSpine,refreshOperationalLead } from '@/lib/fub/service';
import { buildFlowQueue } from '@/lib/flow/engine';
import { discoverBrokers } from '@/lib/flow/brokers';
import { degradedFlowStorageStatus,flowStorageStatus,listFlowEvents } from '@/lib/flow/store';
import type { FlowEvent } from '@/lib/flow/types';
import { completionWritebackStatus } from '@/lib/fub/writeback';
import { isOperationalLead } from '@/lib/operational-eligibility';
import { getFubSession, isFubManager, sessionUserId } from '@/lib/fub/session';

export async function GET(request:NextRequest){
 const session=getFubSession(request); if(!session)return NextResponse.json({ok:false,error:'FUB authorization required.'},{status:401});
 const manager=isFubManager(session),ownId=sessionUserId(session); if(!manager&&!ownId)return NextResponse.json({ok:false,error:'FUB user identity is unavailable; sign in again.'},{status:403});
 try{
  // Flow should consume Render's published manager delivery. The full FUB
  // spine remains the transparent fallback inside getFlowSpine, but the
  // normal request must not rebuild tens of thousands of contacts.
  const spine=await getFlowSpine({ownUserId:ownId,manager});
  const brokers=discoverBrokers(spine.people.items,spine.users.items);
  let events:FlowEvent[]=[],storage=flowStorageStatus();
  try{events=await listFlowEvents(1)}catch{storage=degradedFlowStorageStatus()}
  const requested=request.nextUrl.searchParams.get('brokerId'),requestedId=requested!==null&&requested!==''?Number(requested):null;
  const brokerId=manager?(requestedId!==null&&Number.isFinite(requestedId)?requestedId:(brokers[0]?.id??null)):ownId;
  const selectedBrokerId=Number.isFinite(brokerId as number)?brokerId:null;
  const refreshId=request.nextUrl.searchParams.get('refreshLeadId');
  let people:any[]=spine.people.items;
  if(refreshId&&spine.mode==='live'){
   try{
    const refreshed=await refreshOperationalLead(refreshId,spine.users.items,spine.tasks.items);
    if(refreshed)people=people.map((lead:any)=>String(lead.id)===String(refreshId)?refreshed:lead);
   }catch(error){console.warn('[flow] selected-contact refresh unavailable',error instanceof Error?error.message:error)}
  }
  // Render's compact delivery omits full note bodies. Re-read only the
  // visible top candidates so broker-authored cadence notes reset the clock
  // without turning every Flow request into a full FUB crawl.
  let queue=buildFlowQueue(people,events,selectedBrokerId);
  if(spine.mode==='live'&&queue.length){
   // The queue must render before optional note enrichment. A slow FUB notes
   // call must never consume the whole broker request budget.
   const bounded=(item:any)=>Promise.race([
    refreshOperationalLead(item.leadId,spine.users.items,spine.tasks.items).catch(()=>null),
    new Promise<null>(resolve=>setTimeout(()=>resolve(null),2500)),
   ]);
   const refreshed=(await Promise.all(queue.slice(0,3).map(bounded))).filter(Boolean) as any[];
   if(refreshed.length){const byId=new Map(refreshed.map(item=>[String(item.id),item]));people=people.map((lead:any)=>byId.get(String(lead.id))||lead);queue=buildFlowQueue(people,events,selectedBrokerId);}
  }
  const leadById=new Map<string,any>(people.map((lead:any):[string,any]=>[String(lead.id),lead]));
  // The task list uses the same FUB/Render spine as cadence and Flow, giving
  // brokers a sortable personal view without creating a second source of truth.
  const tasks=spine.tasks.items
    .filter((task:any)=>!task.isCompleted&&(selectedBrokerId===null||task.assignedUserId===selectedBrokerId))
    .map((task:any)=>{const lead=leadById.get(String(task.personId));return {id:String(task.id),leadId:task.personId?String(task.personId):null,name:task.name,type:task.type,dueAt:task.dueAt,assignedUserId:task.assignedUserId,assignedUserName:task.assignedUserName||lead?.assignedUserName||'Unassigned',cadenceStatus:lead?.cadenceStatus||'unknown',cadenceLabel:lead?.cadenceLabel||'No cadence',cadenceDaysLate:lead?.cadenceDaysLate||0,priority:lead?.decision?.urgency||'Monitor',leadName:lead?.name||'Unknown contact',leadStage:lead?.stage||'Unknown',fubUrl:lead?`/2/people/view/${lead.id}`:null};})
    .sort((a:any,b:any)=>(Date.parse(a.dueAt||'')||Infinity)-(Date.parse(b.dueAt||'')||Infinity));
  const taskSummary={total:tasks.length,overdue:tasks.filter((task:any)=>task.dueAt&&Date.parse(task.dueAt)<Date.now()).length,dueToday:tasks.filter((task:any)=>{if(!task.dueAt)return false;const d=new Date(task.dueAt),n=new Date();return d.toDateString()===n.toDateString()}).length};
  const unresolvedOwners=people.filter((lead:any)=>lead.assignedUserId!==null&&!spine.users.items.some((user:any)=>user.id===lead.assignedUserId)).length;
  const customers=people.filter(isOperationalLead).map((lead:any)=>({id:lead.id,name:lead.name,stage:lead.stage,source:lead.source,leadLane:lead.leadLane,assignedUserId:lead.assignedUserId,assignedUserName:lead.assignedUserName,phones:lead.phones||[],emails:lead.emails||[],tags:lead.tags||[],cadenceLabel:lead.cadenceLabel,cadenceStatus:lead.cadenceStatus,cadenceDaysLate:lead.cadenceDaysLate,lastActivityAt:lead.lastActivityAt,lastCommunicationAt:lead.lastCommunicationAt,nextActionAt:lead.nextActionAt,nextActionSource:lead.nextActionSource,nextAppointmentAt:lead.nextAppointmentAt,governanceScore:lead.governanceScore,riskLevel:lead.riskLevel,decision:lead.decision,evidenceSummary:lead.evidenceSummary||null}));
  return NextResponse.json({ok:true,mode:spine.mode,brokerId,brokers,queue,total:queue.length,tasks,taskSummary,customers,storage,writeback:completionWritebackStatus(spine.mode),policy:spine.policy,diagnostics:{people:people.length,users:spine.users.items.length,brokers:brokers.length,ownersRecoveredFromLeads:brokers.filter(broker=>broker.source==='lead-owner').length,unresolvedOwners}});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Unable to build Vesta Flow queue.'},{status:500})}
}
