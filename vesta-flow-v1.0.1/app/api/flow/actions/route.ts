import { randomUUID } from 'node:crypto';
import { NextRequest,NextResponse } from 'next/server';
import { getSpine } from '@/lib/fub/service';
import { discoverBrokers } from '@/lib/flow/brokers';
import { appendFlowEvent,flowStorageStatus,listFlowEvents } from '@/lib/flow/store';
import { sendManagementAlert } from '@/lib/flow/alerts';
import type { BrokerActionKind,FlowEvent } from '@/lib/flow/types';

const kinds=new Set<BrokerActionKind>(['broker.complete','broker.skip','broker.pass']);
const text=(value:unknown)=>typeof value==='string'?value.trim():'';

export async function POST(request:NextRequest){
 try{
  const body=await request.json(),kind=body.kind as BrokerActionKind;
  if(!kinds.has(kind))return NextResponse.json({ok:false,error:'Invalid broker action.'},{status:400});
  const spine=await getSpine();
  const brokers=discoverBrokers(spine.people.items,spine.users.items);
  let events:FlowEvent[];
  try{events=await listFlowEvents()}catch{return NextResponse.json({ok:false,code:'FLOW_STORAGE_UNAVAILABLE',error:'The live intelligence spine is connected, but action storage is unavailable. No action was recorded. Check the Upstash Redis environment variables in Vercel.'},{status:503})}
  const lead=spine.people.items.find(item=>String(item.id)===String(body.leadId));if(!lead)return NextResponse.json({ok:false,error:'Lead not found.'},{status:404});
  const actorId=Number(body.actorUserId),actor=brokers.find(user=>user.id===actorId);if(!actor)return NextResponse.json({ok:false,error:'Select a valid broker.'},{status:400});
  const outcome=text(body.outcome),reason=text(body.reason),note=text(body.note),returnAt=text(body.returnAt);
  if(kind==='broker.complete'&&!outcome)return NextResponse.json({ok:false,error:'A completion outcome is required.'},{status:400});
  if(kind==='broker.skip'&&(!reason||!returnAt||new Date(returnAt).getTime()<=Date.now()))return NextResponse.json({ok:false,error:'A skip reason and future return time are required.'},{status:400});
  if(kind==='broker.pass'&&!reason)return NextResponse.json({ok:false,error:'A pass reason is required.'},{status:400});
  const event:FlowEvent={id:randomUUID(),kind,leadId:String(lead.id),decisionSnapshotId:lead.decisionSnapshotId,actorUserId:actor.id,actorName:actor.name,createdAt:new Date().toISOString(),recommendation:lead.decision.label,priority:lead.decision.urgency,...(outcome?{outcome}:{}),...(reason?{reason}:{}),...(note?{note}:{}),...(returnAt?{returnAt}:{}),metadata:{lane:lead.leadLane,cadenceStatus:lead.cadenceStatus,governanceScore:lead.governanceScore,learningScore:lead.learningScore?.score??null}};
  try{await appendFlowEvent(event)}catch{return NextResponse.json({ok:false,code:'FLOW_STORAGE_UNAVAILABLE',error:'The action could not be stored, so it was not applied. Restore the Upstash Redis connection and try again.'},{status:503})}
  const priorSkips=events.filter(item=>item.kind==='broker.skip'&&item.leadId===event.leadId&&item.decisionSnapshotId===event.decisionSnapshotId).length,alertTrigger=kind==='broker.pass'?'broker-pass':kind==='broker.skip'&&(lead.decision.urgency==='Immediate'||priorSkips>=2)?(priorSkips>=2?'repeated-skip':'immediate-item-skipped'):null;
  const alert=alertTrigger?await sendManagementAlert(event,lead,alertTrigger):{configured:Boolean(process.env.VESTA_MANAGEMENT_ALERT_WEBHOOK),delivered:false,message:'No immediate management alert was required.'};
  return NextResponse.json({ok:true,event,storage:flowStorageStatus(),alert,next:'load-next-item'});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Unable to record broker action.'},{status:500})}
}
