import type { FlowEvent,FlowStorageStatus } from './types';

const globalStore=globalThis as typeof globalThis&{__vestaFlowEvents?:FlowEvent[]};
const memory=()=>globalStore.__vestaFlowEvents??(globalStore.__vestaFlowEvents=[]);
const redisUrl=()=>process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/,'')||'';
const redisToken=()=>process.env.UPSTASH_REDIS_REST_TOKEN||'';
const storageKey=()=>process.env.VESTA_FLOW_STORAGE_KEY||'vesta:flow:v1:events';

async function redis(command:(string|number)[]){
 const response=await fetch(redisUrl(),{method:'POST',headers:{authorization:`Bearer ${redisToken()}`,'content-type':'application/json'},body:JSON.stringify(command),cache:'no-store',signal:AbortSignal.timeout(10000)});
 const body=await response.json().catch(()=>null) as {result?:unknown;error?:string}|null;
 if(!response.ok||body?.error)throw new Error(body?.error||`Flow storage failed (${response.status})`);
 return body?.result;
}

export function flowStorageStatus():FlowStorageStatus{
 const durable=Boolean(redisUrl()&&redisToken());
 return durable?{mode:'durable-redis',durable:true,message:'Broker and management actions are stored in the configured Redis ledger.'}:{mode:'temporary-memory',durable:false,message:'Actions are temporary for this demonstration and may reset when the Vercel function restarts. Configure Redis before operational use.'};
}

export async function listFlowEvents():Promise<FlowEvent[]>{
 if(!flowStorageStatus().durable)return [...memory()];
 const result=await redis(['LRANGE',storageKey(),0,4999]);
 if(!Array.isArray(result))return [];
 return result.map(value=>{try{return JSON.parse(String(value)) as FlowEvent}catch{return null}}).filter((value):value is FlowEvent=>Boolean(value));
}

export async function appendFlowEvent(event:FlowEvent):Promise<void>{
 if(!flowStorageStatus().durable){memory().unshift(Object.freeze({...event}));return;}
 await redis(['LPUSH',storageKey(),JSON.stringify(event)]);
}
