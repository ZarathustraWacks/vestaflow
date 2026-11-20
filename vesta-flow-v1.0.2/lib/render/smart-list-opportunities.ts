/** Saved Render evidence only: no FUB/vendor requests or operational mutations. */
import {SMART_LIST_CONTRACT,type SmartListSignal} from '@/lib/policy/smart-list-opportunities';
export const smartListOpportunitiesEnabled=()=>process.env.VESTA_SMART_LIST_OPPORTUNITIES_ENABLED==='true';
type Result={status:string;items:SmartListSignal[]};
const cache=new Map<string,{until:number;value:Result}>(),inflight=new Map<string,Promise<Result>>();
export async function readSmartListOpportunities(ownerId?:number,budgetMs=2500):Promise<Result>{
 if(!smartListOpportunitiesEnabled())return {status:'disabled',items:[]};
 if(ownerId!==undefined&&(!Number.isSafeInteger(ownerId)||ownerId<1))return {status:'invalid-owner',items:[]};
 const base=(process.env.VESTA_RENDER_LEARNING_API_URL||process.env.VESTA_LEARNING_API_URL||'').trim().replace(/\/$/,''),key=(process.env.VESTA_RENDER_LEARNING_API_KEY||process.env.VESTA_LEARNING_API_KEY||'').trim();
 try{const url=new URL(base);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||!key)return {status:'unconfigured',items:[]};}catch{return {status:'unconfigured',items:[]};}
 const scope=base+':'+(ownerId??'all'),cached=cache.get(scope);if(cached&&cached.until>Date.now())return cached.value;
 const running=inflight.get(scope);if(running)return running;
 const work=(async()=>{
  const items:SmartListSignal[]=[],seen=new Set<string>(),deadline=Date.now()+budgetMs;let after='';
  try{
   for(let page=0;page<40;page++){
    const remaining=deadline-Date.now();if(remaining<50)return {status:'partial',items};
    const params=new URLSearchParams({limit:'500'});if(ownerId!==undefined)params.set('ownerId',String(ownerId));if(after)params.set('after',after);
    const r=await fetch(base+'/v1/smart-list-signals/feed?'+params,{headers:{authorization:`Bearer ${key}`},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(remaining)});
    if(!r.ok)throw Error('optional-signal-unavailable');const b=await r.json();
    if(b.contractVersion!==SMART_LIST_CONTRACT||b.authoritative!==false||b.actualCredit!==0||b.changesCadence!==false||!Array.isArray(b.items)||b.items.length>500)throw Error('invalid-signal-contract');
    if(b.status!=='available')return {status:String(b.status||'unavailable'),items:[]};
    items.push(...b.items);if(b.next==null)return {status:'available',items};
    if(typeof b.next!=='string'||!/^[1-9][0-9]*:[1-9][0-9]*:[1-9][0-9]*$/.test(b.next)||seen.has(b.next))throw Error('invalid-signal-cursor');
    seen.add(b.next);after=b.next;
   }
   return {status:'partial',items};
  }catch{return {status:'unavailable',items:[]};}
 })();inflight.set(scope,work);
 try{const value=await work;if(cache.size>=100)cache.delete(cache.keys().next().value!);cache.set(scope,{until:Date.now()+30000,value});return value;}finally{inflight.delete(scope);}
}
