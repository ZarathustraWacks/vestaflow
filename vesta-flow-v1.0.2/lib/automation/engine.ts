import { getSpine } from '@/lib/fub/service';
import { fubRequest } from '@/lib/fub/client';
import { normalizePersonBase } from '@/lib/fub/normalize';
import { buildManagementExceptions } from '@/lib/flow/engine';
import { discoverBrokers } from '@/lib/flow/brokers';
import { listFlowEvents } from '@/lib/flow/store';
import { afternoonCandidates,morningCandidates,stillUncontacted,type CriticalCandidate,type CriticalRunKind } from './critical';
import type { NormalizedUser } from '@/lib/domain/types';

async function mapLimit<T,R>(items:T[],limit:number,fn:(item:T)=>Promise<R>){const out:R[]=[];let index=0;async function worker(){while(index<items.length){const current=index++;out[current]=await fn(items[current])}}await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));return out}

async function recheck(candidates:CriticalCandidate[],kind:CriticalRunKind,spine:any){
 if(spine.mode==='demo')return {eligible:candidates,suppressed:[] as any[]};
 const users=new Map<number,NormalizedUser>(spine.users.items.map((user:NormalizedUser)=>[user.id,user])),suppressed:any[]=[];
 const checked=await mapLimit< CriticalCandidate,CriticalCandidate|null>(candidates,5,async candidate=>{try{const response=await fubRequest<any>(`/people/${encodeURIComponent(candidate.leadId)}`),lead=normalizePersonBase(response.data,users);if(kind==='afternoon-critical'&&!stillUncontacted(candidate,lead)){suppressed.push({key:candidate.key,reason:'Qualifying communication appeared during final FUB recheck.'});return null}if(kind==='morning-reroutes'&&candidate.ownerId!==null&&candidate.ownerId!==undefined&&lead.assignedUserId!==candidate.ownerId){suppressed.push({key:candidate.key,reason:`FUB owner changed to ${lead.assignedUserName}.`});return null}return {...candidate,ownerId:lead.assignedUserId,ownerName:lead.assignedUserName,evidence:[...candidate.evidence,'Final live FUB person recheck passed']}}catch(error){suppressed.push({key:candidate.key,reason:`Final FUB recheck failed: ${error instanceof Error?error.message:'Unavailable'}`});return null}});
 return {eligible:checked.filter((item):item is CriticalCandidate=>Boolean(item)),suppressed};
}

export async function buildCriticalRun(kind:CriticalRunKind,now=new Date()){
 const [spine,events]=await Promise.all([getSpine(),listFlowEvents()]),brokers=discoverBrokers(spine.people.items,spine.users.items);
 const initial=kind==='morning-reroutes'?morningCandidates(buildManagementExceptions(spine.people.items,events,brokers),now):afternoonCandidates(spine.people.items,now);
 const checked=await recheck(initial,kind,spine);
 return {kind,mode:spine.mode,generatedAt:now.toISOString(),initialCount:initial.length,candidates:checked.eligible,suppressed:checked.suppressed,source:'existing-vesta-fub-spine',renderRequired:false};
}
