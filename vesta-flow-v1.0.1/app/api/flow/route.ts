import { NextRequest,NextResponse } from 'next/server';
import { getSpine } from '@/lib/fub/service';
import { buildFlowQueue } from '@/lib/flow/engine';
import { discoverBrokers } from '@/lib/flow/brokers';
import { degradedFlowStorageStatus,flowStorageStatus,listFlowEvents } from '@/lib/flow/store';
import type { FlowEvent } from '@/lib/flow/types';

export async function GET(request:NextRequest){
 try{
  const spine=await getSpine();
  const brokers=discoverBrokers(spine.people.items,spine.users.items);
  let events:FlowEvent[]=[],storage=flowStorageStatus();
  try{events=await listFlowEvents()}catch{storage=degradedFlowStorageStatus()}
  const requested=request.nextUrl.searchParams.get('brokerId'),brokerId=requested!==null&&requested!==''?Number(requested):(brokers[0]?.id??null);
  const queue=buildFlowQueue(spine.people.items,events,Number.isFinite(brokerId as number)?brokerId:null);
  const unresolvedOwners=spine.people.items.filter(lead=>lead.assignedUserId!==null&&!spine.users.items.some(user=>user.id===lead.assignedUserId)).length;
  return NextResponse.json({ok:true,mode:spine.mode,brokerId,brokers,queue,total:queue.length,storage,policy:spine.policy,diagnostics:{people:spine.people.items.length,users:spine.users.items.length,brokers:brokers.length,ownersRecoveredFromLeads:brokers.filter(broker=>broker.source==='lead-owner').length,unresolvedOwners}});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Unable to build Vesta Flow queue.'},{status:500})}
}
