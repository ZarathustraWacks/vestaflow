import type { CriticalCandidate,CriticalRunKind } from './critical';
const redisUrl=()=>process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/,'')||'';
const redisToken=()=>process.env.UPSTASH_REDIS_REST_TOKEN||'';
const prefix=()=>process.env.VESTA_EMAIL_STORAGE_KEY||'vesta:critical-email:v1';
async function redis(command:(string|number)[]){
 if(!redisUrl()||!redisToken())throw new Error('Durable automation storage requires both Upstash Redis REST variables.');
 const response=await fetch(redisUrl(),{method:'POST',headers:{authorization:`Bearer ${redisToken()}`,'content-type':'application/json'},body:JSON.stringify(command),cache:'no-store',signal:AbortSignal.timeout(10000)});const body=await response.json().catch(()=>null) as any;if(!response.ok||body?.error)throw new Error(body?.error||`Automation storage failed (${response.status})`);return body?.result;
}
export function automationStorageStatus(){return {available:Boolean(redisUrl()&&redisToken()),durable:Boolean(redisUrl()&&redisToken())}}
export async function claimRun(runKey:string){return String(await redis(['SET',`${prefix()}:claim:${runKey}`,new Date().toISOString(),'NX','EX',900])||'')==='OK'}
export async function releaseClaim(runKey:string){await redis(['DEL',`${prefix()}:claim:${runKey}`])}
export async function completeRun(runKey:string,kind:CriticalRunKind,candidates:CriticalCandidate[],delivery:any){const record={runKey,kind,completedAt:new Date().toISOString(),candidateKeys:candidates.map(x=>x.key),candidates,delivery};await redis(['SET',`${prefix()}:run:${runKey}`,JSON.stringify(record)]);await redis(['SET',`${prefix()}:claim:${runKey}`,'complete']);return record}
export async function getRun(runKey:string){const value=await redis(['GET',`${prefix()}:run:${runKey}`]);return value?JSON.parse(String(value)):null}
