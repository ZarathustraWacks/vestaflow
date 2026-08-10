import { randomUUID } from 'node:crypto';
import { NextRequest,NextResponse } from 'next/server';
import { getSpine } from '@/lib/fub/service';
import { buildManagementExceptions } from '@/lib/flow/engine';
import { appendFlowEvent,flowStorageStatus,listFlowEvents } from '@/lib/flow/store';
import type { FlowEvent,ManagementActionKind } from '@/lib/flow/types';

const decisions=new Set<ManagementActionKind>(['management.reroute','management.return','management.nurture','management.kill']);
const text=(value:unknown)=>typeof value==='string'?value.trim():'';

export async function GET(){
 try{const [spine,events]=await Promise.all([getSpine(),listFlowEvents()]);const assignedIds=new Set(spine.people.items.map(lead=>lead.assignedUserId).filter((id):id is number=>id!==null));const brokers=spine.users.items.filter(user=>user.isActive&&(assignedIds.has(user.id)||['agent','broker'].some(role=>String(user.role).toLowerCase().includes(role))));return NextResponse.json({ok:true,mode:spine.mode,exceptions:buildManagementExceptions(spine.people.items,events,brokers),brokers,storage:flowStorageStatus()})}catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Unable to load management exceptions.'},{status:500})}
}

export async function POST(request:NextRequest){
 try{
  const body=await request.json(),kind=body.kind as ManagementActionKind;if(!decisions.has(kind))return NextResponse.json({ok:false,error:'Invalid management decision.'},{status:400});
  const [spine,events]=await Promise.all([getSpine(),listFlowEvents()]);const pass=events.find(event=>event.id===String(body.passEventId)&&event.kind==='broker.pass');if(!pass)return NextResponse.json({ok:false,error:'The pass exception was not found.'},{status:404});
  if(events.some(event=>event.parentEventId===pass.id&&event.kind.startsWith('management.')))return NextResponse.json({ok:false,error:'Management has already resolved this pass.'},{status:409});
  const lead=spine.people.items.find(item=>String(item.id)===pass.leadId);if(!lead)return NextResponse.json({ok:false,error:'Lead not found.'},{status:404});
  const reason=text(body.reason),note=text(body.note);let targetUserId:number|null|undefined,targetUserName:string|undefined,returnAt:string|undefined;
  if(kind==='management.reroute'){const target=spine.users.items.find(user=>user.id===Number(body.targetUserId)&&user.isActive);if(!target)return NextResponse.json({ok:false,error:'Select an active broker for rerouting.'},{status:400});targetUserId=target.id;targetUserName=target.name;}
  if(kind==='management.return'){targetUserId=pass.actorUserId;targetUserName=pass.actorName;}
  if(kind==='management.nurture')returnAt=text(body.returnAt)||new Date(Date.now()+30*86400000).toISOString();
  if(kind==='management.kill'&&!reason)return NextResponse.json({ok:false,error:'A final disposition is required to kill a lead.'},{status:400});
  const event:FlowEvent={id:randomUUID(),kind,leadId:pass.leadId,decisionSnapshotId:lead.decisionSnapshotId,actorUserId:null,actorName:text(body.actorName)||'Management',createdAt:new Date().toISOString(),recommendation:lead.decision.label,priority:lead.decision.urgency,parentEventId:pass.id,...(reason?{reason}:{}),...(note?{note}:{}),...(targetUserId!==undefined?{targetUserId}:{}),...(targetUserName?{targetUserName}:{}),...(returnAt?{returnAt}:{}),metadata:{previousBroker:pass.actorName,writeback:'flow-ledger-only'}};
  await appendFlowEvent(event);return NextResponse.json({ok:true,event,storage:flowStorageStatus(),writeback:{followUpBoss:false,message:'V1 records the management disposition in the Vesta Flow ledger. Follow Up Boss writeback remains disabled until OAuth and field mappings are approved.'}});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Unable to resolve management exception.'},{status:500})}
}
