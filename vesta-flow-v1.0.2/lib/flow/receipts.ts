/** Confirmed actions are contact-scoped overlays, not replacement queue snapshots. */
import {applyOperationalNextAction,operationalNextActionsEnabled} from '@/lib/next-action/operational';
import {flowActionSuppressed,buildFlowQueue} from './engine';
import type {FlowEvent,FlowItem} from './types';
import {dailyGoal} from './daily-goal';
export type ActionReceipt={event:FlowEvent;lead:any};
export function mergeDailyProgress(response:any,receipts:Iterable<ActionReceipt>,brokerId:number){
 const events=[...receipts].map(item=>item.event);
 const local=dailyGoal(events,brokerId,response.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone);
 if(Array.isArray(response.eventIds))return new Set([...response.eventIds,...(local.day===response.day?local.eventIds:[])]).size;
 return Math.max(Number(response.completed)||0,local.completed);
}
export function confirmedActionReceipt(response:any,brokerId:number|null,leadId:string,live=true):FlowEvent|null{
 const event=response?.event,sync=response?.sync;
 if(response?.ok!==true||response?.storage?.durable!==true||response?.storage?.available!==true||!event?.id||
    String(event.leadId)!==String(leadId)||event.actorUserId!==brokerId||!Number.isFinite(Date.parse(event.createdAt))||
    !['broker.complete','broker.skip','broker.pass'].includes(event.kind))return null;
 const persistedSync=event.metadata?.fubSync;
 if(event.kind==='broker.complete'&&(sync?.delivered!==true||persistedSync?.delivered!==true||live&&(sync.simulated===true||persistedSync.simulated===true)))return null;
 return event;
}
export function reconcileActionReceipts(data:any,receipts:Iterable<ActionReceipt>){
 if(!data)return data;
 const relevant=new Map<string,ActionReceipt>();
 for(const receipt of receipts)if(receipt.event.actorUserId===data.brokerId){const id=String(receipt.event.leadId),old=relevant.get(id);if(!old||Date.parse(old.event.createdAt)<=Date.parse(receipt.event.createdAt))relevant.set(id,receipt);}
 const held=new Map<string,boolean>();
 const queue=(data.queue||[]).map((item:FlowItem)=>{
  const receipt=relevant.get(String(item.leadId));
  if(!operationalNextActionsEnabled()||!receipt||item.effectiveOwnerId!==receipt.event.actorUserId||item.lastEvent&&Date.parse(item.lastEvent.createdAt)>Date.parse(receipt.event.createdAt))return item;
  const events=[receipt.event,...(item.lastEvent&&item.lastEvent.id!==receipt.event.id?[item.lastEvent]:[])];
  const next=buildFlowQueue([{...item.lead,flowActionReceipt:receipt.event}],events,data.brokerId)[0];
  return next||item;
 }).filter((item:FlowItem)=>{
  const receipt=relevant.get(String(item.leadId));if(!receipt||item.effectiveOwnerId!==receipt.event.actorUserId)return true;
  const events=[receipt.event,...(item.lastEvent&&item.lastEvent.id!==receipt.event.id?[item.lastEvent]:[])].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
  const hide=flowActionSuppressed(item.lead,events);held.set(String(item.leadId),hide);return !hide;
 }).map((item:FlowItem,index:number)=>({...item,position:index+1}));
 const customers=(data.customers||[]).map((customer:any)=>{
  const receipt=relevant.get(String(customer.id));if(!receipt||customer.assignedUserId!==receipt.event.actorUserId)return customer;
  if(customer.flowActionVersion&&Date.parse(customer.flowActionVersion.createdAt)>Date.parse(receipt.event.createdAt))return customer;
  // The customer projection includes clock inputs, so a real new hand raise
  // can reopen work. Never manufacture a FUB communication timestamp.
  const hide=held.get(String(customer.id))??flowActionSuppressed({...receipt.lead,...customer},[receipt.event]);
  return {...(operationalNextActionsEnabled()?applyOperationalNextAction({...customer,flowActionReceipt:receipt.event},[receipt.event]):customer),flowActionHeld:hide,flowActionReceipt:receipt.event,flowAction:{id:receipt.event.id,kind:receipt.event.kind,createdAt:receipt.event.createdAt}};
 });
 return {...data,queue,total:queue.length,customers};
}
