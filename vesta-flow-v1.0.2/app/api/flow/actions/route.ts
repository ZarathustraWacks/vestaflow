import {listFlowQueueEvents} from '@/lib/flow/queue-history';
import {enqueueFlowContactRefresh} from '@/lib/render/flow-accelerator';
import { randomUUID } from 'node:crypto';
import { after,NextRequest,NextResponse } from 'next/server';
import {refreshOperationalLead} from '@/lib/fub/service';
import {applyOperationalNextAction,currentNextAction,nextActionTransition,operationalNextActionsEnabled} from '@/lib/next-action/operational';
import {completeObligation} from '@/lib/flow/complete-obligation';
import { getFlowSpine } from '@/lib/fub/service';
import { discoverBrokers } from '@/lib/flow/brokers';
import { appendFlowEvent,flowStorageStatus } from '@/lib/flow/store';
import { sendManagementAlert } from '@/lib/flow/alerts';
import type { BrokerActionKind,FlowEvent } from '@/lib/flow/types';
import {completionWritebackStatus} from '@/lib/fub/writeback';
import { syncCompletionToFub } from '@/lib/fub/writeback';
import { sendFlowTelemetry } from '@/lib/learning/telemetry';
import { getFubSession,isFubManager,sessionUserId } from '@/lib/fub/session';

const kinds=new Set<BrokerActionKind>(['broker.complete','broker.skip','broker.pass']);
const text=(value:unknown)=>typeof value==='string'?value.trim():'';

export async function POST(request:NextRequest){
 const session=getFubSession(request);if(!session)return NextResponse.json({ok:false,error:'FUB authorization required.'},{status:401});
 try{
  const body=await request.json(),kind=body.kind as BrokerActionKind;
  if(!kinds.has(kind))return NextResponse.json({ok:false,error:'Invalid broker action.'},{status:400});
  const ownId=sessionUserId(session),manager=isFubManager(session);
  const requestedBroker=manager?Number(body.actorUserId):ownId;
  const spine=await getFlowSpine({ownUserId:ownId,manager,brokerId:requestedBroker});
  const brokers=discoverBrokers(spine.people.items,spine.users.items);
  let events:FlowEvent[];
  try{events=await listFlowQueueEvents()}catch{return NextResponse.json({ok:false,code:'FLOW_STORAGE_UNAVAILABLE',error:'The live intelligence spine is connected, but action storage is unavailable. No action was recorded. Check the Render ledger connection and migration readiness in Vercel.'},{status:503})}
  let lead=spine.people.items.find((item:any)=>String(item.id)===String(body.leadId));if(!lead)return NextResponse.json({ok:false,error:'Lead not found.'},{status:404});
  if(!isFubManager(session)&&(!ownId||lead.assignedUserId!==ownId))return NextResponse.json({ok:false,error:'This contact is assigned to another broker.'},{status:403});
  const actorId=isFubManager(session)?Number(body.actorUserId):ownId,actor=brokers.find(user=>user.id===actorId);if(!actor)return NextResponse.json({ok:false,error:'Select a valid broker.'},{status:400});
  const outcome=text(body.outcome),reason=text(body.reason),note=text(body.note),returnAt=text(body.returnAt);
  if(kind==='broker.complete'&&!outcome)return NextResponse.json({ok:false,error:'A completion outcome is required.'},{status:400});
  if(kind==='broker.skip'&&(!reason||!returnAt||new Date(returnAt).getTime()<=Date.now()))return NextResponse.json({ok:false,error:'A skip reason and future return time are required.'},{status:400});
  if(kind==='broker.pass'&&!reason)return NextResponse.json({ok:false,error:'A pass reason is required.'},{status:400});
  const operational=kind==='broker.complete'&&operationalNextActionsEnabled()&&currentNextAction(lead,events).admitted;
  const expectedAction=text(body.actionId);
  const priorCompletion=kind==='broker.complete'?events.find(item=>item.kind==='broker.complete'&&item.leadId===String(lead.id)&&(operational?!!expectedAction&&(item.metadata as any)?.nextAction?.actionId===expectedAction&&item.actorUserId===actor.id:item.decisionSnapshotId===lead.decisionSnapshotId)):null;
  if(priorCompletion)return NextResponse.json({ok:true,event:priorCompletion,sync:(priorCompletion.metadata as any)?.fubSync??null,storage:flowStorageStatus(),alert:{configured:false,delivered:false,message:'The completion was already recorded.'},next:'load-next-item',duplicatePrevented:true});
  if(kind==='broker.complete'&&!completionWritebackStatus(spine.mode).enabled)return NextResponse.json({ok:false,error:'FUB completion synchronization is disabled; no action was recorded.'},{status:503});
  let transition:any=null;
  if(operational){
   if(!expectedAction)return NextResponse.json({ok:false,error:'Reload Flow to load the current next action before completing it.'},{status:409});
   if(spine.mode==='live')lead=await refreshOperationalLead(String(lead.id),spine.users.items,spine.tasks.items,lead,{fresh:true});
   if(!lead||lead.assignedUserId!==actor.id)return NextResponse.json({ok:false,error:'This contact has a different current owner. Reload Flow.'},{status:409});
   const current=currentNextAction(lead,events);
   if(current.actionId!==expectedAction||!current.eligible)return NextResponse.json({ok:false,error:'This next action changed or is on hold. Reload Flow before completing it.'},{status:409});
   try{transition=nextActionTransition(lead,events,outcome,{nextAttemptAt:text(body.nextAttemptAt),confirmedIntent:text(body.confirmedIntent)})}catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Review the next action.'},{status:400})}
  }
  if(operational)lead=applyOperationalNextAction(lead,events);
  let sync=null;
  if(kind==='broker.complete'&&!operational)try{sync=await syncCompletionToFub({leadId:String(lead.id),decisionSnapshotId:lead.decisionSnapshotId,actorUserId:actor.id,actorName:actor.name,recommendation:lead.decision.label,outcome,note,cadenceStatus:lead.cadenceStatus,cadenceLabel:lead.cadenceLabel},spine.mode)}catch(error){return NextResponse.json({ok:false,code:'FUB_SYNC_FAILED',error:`Done was not recorded because Follow Up Boss did not confirm the sync. ${error instanceof Error?error.message:'Try again.'}`},{status:502})}
  const choicesShown:string[]=Array.isArray(body.choicesShown)?body.choicesShown.slice(0,3).map((value:unknown)=>String(value)):[];
  const choicesShownDetails=choicesShown.map((choiceLeadId,index)=>{const choice=spine.people.items.find((item:any)=>String(item.id)===choiceLeadId);return {leadId:choiceLeadId,rank:index+1,action:choice?.decision?.label||choice?.recommendedAction||'Unknown'}});
  const reportedAction=kind==='broker.complete'?outcome:kind==='broker.skip'?'skip':kind==='broker.pass'?'pass':kind,verificationStatus=kind==='broker.complete'?(sync?'reported-note-readback':'unverified'):'reported';
  let event:FlowEvent={id:randomUUID(),kind,leadId:String(lead.id),decisionSnapshotId:lead.decisionSnapshotId,actorUserId:actor.id,actorName:actor.name,createdAt:new Date().toISOString(),recommendation:lead.decision.label,recommendationShown:lead.decision.label,selectedAction:reportedAction,reportedAction,verificationStatus,priority:lead.decision.urgency,...(outcome?{outcome}:{}),...(reason?{reason}:{}),...(note?{note}:{}),...(returnAt?{returnAt}:{}),metadata:{...(transition?{nextAction:transition}:{}),lane:lead.leadLane,cadenceStatus:lead.cadenceStatus,governanceScore:lead.governanceScore,learningScore:lead.learningScore?.score??null,policyVersion:lead.policyVersion,operationalClocks:lead.operationalClocks,choicesShown:choicesShownDetails,...(sync?{fubSync:sync}:{})}};
  try{if(operational){const result=await completeObligation(expectedAction,event,{leadId:String(lead.id),decisionSnapshotId:lead.decisionSnapshotId,actorUserId:actor.id,actorName:actor.name,recommendation:currentNextAction(lead,events).plan.label,outcome,note,cadenceStatus:lead.cadenceStatus,cadenceLabel:lead.cadenceLabel,nextAttemptAt:transition.nextAt,confirmedIntent:transition.confirmedIntent},spine.mode);event=result.event;sync=result.sync}else await appendFlowEvent(event)}catch(error){return NextResponse.json({ok:false,code:'FLOW_STORAGE_UNAVAILABLE',error:operational?`Completion is not confirmed in Flow. ${error instanceof Error?error.message:'Refresh before retrying.'}`:'The action could not be stored, so it was not applied. Restore the Render ledger connection and try again.'},{status:503})}
  if(kind==='broker.complete')after(()=>enqueueFlowContactRefresh(String(lead.id)).then(()=>{}));
  const priorSkips=events.filter(item=>item.kind==='broker.skip'&&item.leadId===event.leadId&&item.decisionSnapshotId===event.decisionSnapshotId).length,alertTrigger=kind==='broker.pass'?'broker-pass':kind==='broker.skip'&&(lead.decision.urgency==='Immediate'||priorSkips>=2)?(priorSkips>=2?'repeated-skip':'immediate-item-skipped'):null;
  const alert=alertTrigger?await sendManagementAlert(event,lead,alertTrigger):{configured:Boolean(process.env.VESTA_MANAGEMENT_ALERT_WEBHOOK),delivered:false,message:'No immediate management alert was required.'};
  const telemetry=await sendFlowTelemetry({decision_id:event.id,lead_id:event.leadId,snapshot_id:event.decisionSnapshotId,actor_id:String(actor.id),created_at:event.createdAt,choices:choicesShownDetails,recommendation_shown:lead.decision.label,selected_action:reportedAction,reported_action:reportedAction,verification_status:verificationStatus,selected_at:event.createdAt,outcome:{disposition:kind,outcome,reason,note,fubSync:sync,policyVersion:lead.policyVersion}});
  return NextResponse.json({ok:true,event,storage:flowStorageStatus(),sync,alert,telemetry,next:'load-next-item'});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Unable to record broker action.'},{status:500})}
}
