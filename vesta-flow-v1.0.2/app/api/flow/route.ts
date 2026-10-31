import { NextRequest,NextResponse } from 'next/server';
import { getSpine } from '@/lib/fub/service';
import { buildFlowQueue } from '@/lib/flow/engine';
import { discoverBrokers } from '@/lib/flow/brokers';
import { degradedFlowStorageStatus,flowStorageStatus,listFlowEvents } from '@/lib/flow/store';
import type { FlowEvent } from '@/lib/flow/types';
import { completionWritebackStatus } from '@/lib/fub/writeback';
import { isOperationalLead } from '@/lib/operational-eligibility';

export async function GET(request:NextRequest){
 try{
  const spine=await getSpine();
  const brokers=discoverBrokers(spine.people.items,spine.users.items);
  let events:FlowEvent[]=[],storage=flowStorageStatus();
  try{events=await listFlowEvents()}catch{storage=degradedFlowStorageStatus()}
  const requested=request.nextUrl.searchParams.get('brokerId'),brokerId=requested!==null&&requested!==''?Number(requested):(brokers[0]?.id??null);
  const selectedBrokerId=Number.isFinite(brokerId as number)?brokerId:null;
  const queue=buildFlowQueue(spine.people.items,events,selectedBrokerId);
  const leadById=new Map(spine.people.items.map((lead:any)=>[String(lead.id),lead]));
  // The task list uses the same FUB/Render spine as cadence and Flow, giving
  // brokers a sortable personal view without creating a second source of truth.
  const tasks=spine.tasks.items
    .filter((task:any)=>!task.isCompleted&&(selectedBrokerId===null||task.assignedUserId===selectedBrokerId))
    .map((task:any)=>{const lead=leadById.get(String(task.personId));return {id:String(task.id),leadId:task.personId?String(task.personId):null,name:task.name,type:task.type,dueAt:task.dueAt,assignedUserId:task.assignedUserId,assignedUserName:task.assignedUserName||lead?.assignedUserName||'Unassigned',cadenceStatus:lead?.cadenceStatus||'unknown',cadenceLabel:lead?.cadenceLabel||'No cadence',cadenceDaysLate:lead?.cadenceDaysLate||0,priority:lead?.decision?.urgency||'Monitor',leadName:lead?.name||'Unknown contact',leadStage:lead?.stage||'Unknown',fubUrl:lead?`/2/people/view/${lead.id}`:null};})
    .sort((a:any,b:any)=>(Date.parse(a.dueAt||'')||Infinity)-(Date.parse(b.dueAt||'')||Infinity));
  const taskSummary={total:tasks.length,overdue:tasks.filter((task:any)=>task.dueAt&&Date.parse(task.dueAt)<Date.now()).length,dueToday:tasks.filter((task:any)=>{if(!task.dueAt)return false;const d=new Date(task.dueAt),n=new Date();return d.toDateString()===n.toDateString()}).length};
  const unresolvedOwners=spine.people.items.filter(lead=>lead.assignedUserId!==null&&!spine.users.items.some(user=>user.id===lead.assignedUserId)).length;
  const customers=spine.people.items.filter(isOperationalLead).map((lead:any)=>({id:lead.id,name:lead.name,stage:lead.stage,source:lead.source,leadLane:lead.leadLane,assignedUserId:lead.assignedUserId,assignedUserName:lead.assignedUserName,phones:lead.phones||[],emails:lead.emails||[],tags:lead.tags||[],cadenceLabel:lead.cadenceLabel,cadenceStatus:lead.cadenceStatus,cadenceDaysLate:lead.cadenceDaysLate,lastActivityAt:lead.lastActivityAt,lastCommunicationAt:lead.lastCommunicationAt,nextActionAt:lead.nextActionAt,nextActionSource:lead.nextActionSource,nextAppointmentAt:lead.nextAppointmentAt,governanceScore:lead.governanceScore,riskLevel:lead.riskLevel,decision:lead.decision,evidenceSummary:lead.evidenceSummary||null}));
  return NextResponse.json({ok:true,mode:spine.mode,brokerId,brokers,queue,total:queue.length,tasks,taskSummary,customers,storage,writeback:completionWritebackStatus(spine.mode),policy:spine.policy,diagnostics:{people:spine.people.items.length,users:spine.users.items.length,brokers:brokers.length,ownersRecoveredFromLeads:brokers.filter(broker=>broker.source==='lead-owner').length,unresolvedOwners}});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Unable to build Vesta Flow queue.'},{status:500})}
}
