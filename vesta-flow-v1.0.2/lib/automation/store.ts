import type { CriticalCandidate,CriticalRunKind } from './critical';
import {ledger,ledgerReady} from '@/lib/render/flow-ledger';
export function automationStorageStatus(){return {available:ledgerReady(),durable:ledgerReady()}}
export async function claimRun(runKey:string){return (await ledger<{token:string|null}>('/claims',{runKey})).token}
export async function beginDelivery(runKey:string,token:string){await ledger('/sending',{runKey,token})}
export async function releaseClaim(runKey:string,token:string){await ledger('/release',{runKey,token})}
export async function completeRun(runKey:string,token:string,kind:CriticalRunKind,candidates:CriticalCandidate[],delivery:any){
 const record={runKey,kind,completedAt:new Date().toISOString(),candidateKeys:candidates.map(x=>x.key),candidates,delivery};
 await ledger('/complete',{runKey,token,record});return record;
}
export async function getRun(runKey:string){return (await ledger<{run:unknown}>('/runs?runKey='+encodeURIComponent(runKey))).run}
