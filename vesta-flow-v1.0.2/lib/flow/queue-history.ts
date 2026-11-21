/** A complete per-process ledger view, advanced only by committed database positions. */
import {ledger} from '@/lib/render/flow-ledger';
import {listFlowEvents} from './store';
import type {FlowEvent} from './types';

type State={cursor:number;events:Map<string,FlowEvent>;pending?:Promise<FlowEvent[]>};
const states=new Map<string,State>();
export async function listFlowQueueEvents():Promise<FlowEvent[]>{
 const key=JSON.stringify([process.env.VESTA_LEARNING_API_URL,process.env.VESTA_FLOW_LEDGER_NAMESPACE,process.env.VESTA_LEARNING_API_KEY]);
 let state=states.get(key);if(!state){state={cursor:0,events:new Map()};states.set(key,state);}
 if(state.pending)return state.pending;
 const current=state;
 const pending=(async()=>{
  let cursor=current.cursor;const received:FlowEvent[]=[];
  for(;;){
   const page=await ledger<{durable:boolean;items:FlowEvent[];cursorMode?:string;cursor:number;nextAfter:number|null}>(`/events?after=${cursor}`);
   // Rolling deployment compatibility: the old service ignores `after`.
   // Read all its pages, never treat its first 500 events as complete history.
   if(page.cursorMode!=='after')return listFlowEvents();
   if(page.durable!==true||!Array.isArray(page.items)||!Number.isSafeInteger(page.cursor)||page.cursor<cursor||
      (page.items.length>0&&page.cursor<=cursor)||(page.items.length===0&&page.cursor!==cursor)||page.items.some(event=>!event?.id)||!(page.nextAfter===null||page.nextAfter===page.cursor&&page.cursor>cursor))throw new Error('Incomplete incremental Flow ledger response.');
   received.push(...page.items);cursor=page.cursor;
   if(page.nextAfter===null)break;
  }
  // Publish only a complete pass. A failed page cannot advance the cursor.
  for(const event of received){const old=current.events.get(event.id);if(old&&JSON.stringify(old)!==JSON.stringify(event))throw new Error('Conflicting immutable Flow receipt.');}
  for(const event of received)current.events.set(event.id,event);
  current.cursor=cursor;
  return [...current.events.values()].reverse();
 })();
 current.pending=pending;
 try{return await pending;}finally{if(current.pending===pending)delete current.pending;}
}
