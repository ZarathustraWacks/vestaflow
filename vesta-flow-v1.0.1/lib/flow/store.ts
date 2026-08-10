import type { FlowEvent,FlowStorageStatus } from './types';

const globalStore=globalThis as typeof globalThis&{__vestaFlowEvents?:FlowEvent[]};
const memory=()=>globalStore.__vestaFlowEvents??(globalStore.__vestaFlowEvents=[]);
const redisUrl=()=>process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/,'')||'';
const redisToken=()=>process.env.UPSTASH_REDIS_REST_TOKEN||'';
const storageKey=()=>process.env.VESTA_FLOW_STORAGE_KEY||'vesta:flow:v1:events';

async function redis(command:(string|number)[]){
 let response:Response;
 try{
  const url=new URL(redisUrl());
  if(!['https:','http:'].includes(url.protocol))throw new Error('invalid protocol');
  response=await fetch(url,{method:'POST',headers:{authorization:`Bearer ${redisToken()}`,'content-type':'application/json'},body:JSON.stringify(command),cache:'no-store',signal:AbortSignal.timeout(10000)});
 }catch{
  throw new Error('Vesta Flow action storage could not be reached. Check the Upstash Redis URL and token in Vercel.');
 }
 const body=await response.json().catch(()=>null) as {result?:unknown;error?:string}|null;
 if(!response.ok||body?.error)throw new Error(body?.error||`Flow storage failed (${response.status})`);
 return body?.result;
}

export function flowStorageStatus():FlowStorageStatus{
 const hasUrl=Boolean(redisUrl()),hasToken=Boolean(redisToken());
 if(hasUrl!==hasToken)return {mode:'degraded-redis',durable:false,available:false,message:'Action storage is only partially configured. Set both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel.'};
 return hasUrl?{mode:'durable-redis',durable:true,available:true,message:'Broker and management actions are stored in the configured Redis ledger.'}:{mode:'temporary-memory',durable:false,available:true,message:'Actions are temporary for this demonstration and may reset when the Vercel function restarts. Configure Redis before operational use.'};
}

export function degradedFlowStorageStatus():FlowStorageStatus{return {mode:'degraded-redis',durable:false,available:false,message:'Live intelligence is available, but action storage is offline. Broker actions are read-only until the Upstash Redis connection is restored.'};}

export async function listFlowEvents():Promise<FlowEvent[]>{
 const status=flowStorageStatus();
 if(!status.available)throw new Error(status.message);
 if(!status.durable)return [...memory()];
 const result=await redis(['LRANGE',storageKey(),0,4999]);
 if(!Array.isArray(result))return [];
 return result.map(value=>{try{return JSON.parse(String(value)) as FlowEvent}catch{return null}}).filter((value):value is FlowEvent=>Boolean(value));
}

export async function appendFlowEvent(event:FlowEvent):Promise<void>{
 const status=flowStorageStatus();
 if(!status.available)throw new Error(status.message);
 if(!status.durable){memory().unshift(Object.freeze({...event}));return;}
 await redis(['LPUSH',storageKey(),JSON.stringify(event)]);
}
