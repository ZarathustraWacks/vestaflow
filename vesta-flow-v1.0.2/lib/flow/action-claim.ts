/** Fenced per-obligation delivery using the existing shared PostgreSQL ledger. */
import {createHash} from 'node:crypto';
import {ledger} from '@/lib/render/flow-ledger';
export const actionEventId=(actionId:string)=>'next-action:'+createHash('sha256').update(actionId).digest('hex');
export async function claimAction(actionId:string,draft:any){const runKey='broker:'+actionEventId(actionId),claim=await ledger<{ok:boolean;token:string|null;status:string;draft:any;recoveryToken:string|null}>('/claims',{runKey,draft});return {runKey,...claim};}
export async function markActionSending(runKey:string,token:string){await ledger('/sending',{runKey,token})}
export async function finishActionClaim(runKey:string,token:string,record:unknown){await ledger('/complete',{runKey,token,record})}
export async function releaseActionClaim(runKey:string,token:string){await ledger('/release',{runKey,token})}
