import type { FlowEvent,FlowStorageStatus } from './types';
import {ledger,ledgerReady} from '@/lib/render/flow-ledger';

export function flowStorageStatus():FlowStorageStatus{
 return ledgerReady()?{mode:'durable-postgres',durable:true,available:true,message:'Actions are stored in the Render PostgreSQL ledger.'}:degradedFlowStorageStatus();
}
export function degradedFlowStorageStatus():FlowStorageStatus{return {mode:'degraded-postgres',durable:false,available:false,message:'Action history is unavailable or migration review is pending. Broker actions remain read-only.'};}
export async function listFlowEvents():Promise<FlowEvent[]>{
 const events:FlowEvent[]=[];let before:number|null=null;
 do{
  const page:{items:FlowEvent[];nextBefore:number|null;durable:boolean}=await ledger<{items:FlowEvent[];nextBefore:number|null;durable:boolean}>(`/events${before===null?'':`?before=${before}`}`);
  if(!page.durable||!Array.isArray(page.items)||!(page.nextBefore===null||(Number.isSafeInteger(page.nextBefore)&&page.nextBefore>0&&(before===null||page.nextBefore<before))))throw new Error('Incomplete Flow ledger response.');
  events.push(...page.items);before=page.nextBefore;
 }while(before!==null);
 return events;
}
export async function appendFlowEvent(event:FlowEvent):Promise<void>{await ledger('/events',{events:[event]})}
