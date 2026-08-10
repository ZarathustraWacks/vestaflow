import { NextRequest,NextResponse } from 'next/server';
import { getSpine } from '@/lib/fub/service';
import { buildFlowQueue } from '@/lib/flow/engine';
import { flowStorageStatus,listFlowEvents } from '@/lib/flow/store';

export async function GET(request:NextRequest){
 try{
  const [spine,events]=await Promise.all([getSpine(),listFlowEvents()]);
  const assignedIds=new Set(spine.people.items.map(lead=>lead.assignedUserId).filter((id):id is number=>id!==null));
  const brokers=spine.users.items.filter(user=>user.isActive&&(assignedIds.has(user.id)||['agent','broker'].some(role=>String(user.role).toLowerCase().includes(role)))).map(user=>({id:user.id,name:user.name,role:user.role,leadCount:spine.people.items.filter(lead=>lead.assignedUserId===user.id).length}));
  const requested=request.nextUrl.searchParams.get('brokerId'),brokerId=requested!==null&&requested!==''?Number(requested):(brokers[0]?.id??null);
  const queue=buildFlowQueue(spine.people.items,events,Number.isFinite(brokerId as number)?brokerId:null);
  return NextResponse.json({ok:true,mode:spine.mode,brokerId,brokers,queue,total:queue.length,storage:flowStorageStatus(),policy:spine.policy});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Unable to build Vesta Flow queue.'},{status:500})}
}
