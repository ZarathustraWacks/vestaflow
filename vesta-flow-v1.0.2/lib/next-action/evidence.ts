/** Typed timeline evidence. This never gives outreach or conversation credit. */
export const NEXT_ACTION_EVIDENCE='vesta-next-action-evidence-v1';
const kinds=new Set(['inquiry','seller inquiry','property inquiry','general inquiry','incoming call','appointment request']);
const id=(v:any)=>/^[1-9][0-9]*$/.test(String(v??''))?String(v):null;
const timestamp=(row:any,fields:string[],now:number)=>{for(const field of fields)if(row[field]!=null){const value=row[field];return typeof value==='string'&&/(Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value))&&Date.parse(value)<=now?value:null;}return null;};
const personId=(row:any)=>id(row.personId||row.contactId||row.person?.id);
export function collectNextActionEvidence(person:any,events:any[],calls:any[],now:number,complete=false){
 const cutoff=now-7*86400000;let inquiry:any=null;
 for(const row of events){const pid=personId(row),eid=id(row.id),type=String(row.type||row.eventType||row.name||'').trim(),at=timestamp(row,['occurredAt','eventCreated','createdAt','created','date'],now);if(pid!==String(person.id)||!eid||!kinds.has(type.toLowerCase())||!at||Date.parse(at)<cutoff)continue;if(!inquiry||Date.parse(at)>Date.parse(inquiry.at))inquiry={id:eid,personId:pid,at,type,source:String(typeof row.source==='object'?row.source?.name:row.source||row.system||'FUB timeline').slice(0,120)};}
 const unique=new Map<string,any>();
 for(const row of calls){const incoming=String(row.isIncoming).toLowerCase(),direction=String(row.direction||row.callDirection||'').toLowerCase(),pid=personId(row),cid=id(row.id),owner=id(row.userId||row.createdById||row.user?.id),at=timestamp(row,['startedAt','occurredAt','eventCreated','createdAt','created','date'],now);if(pid!==String(person.id)||!cid||owner!==String(person.assignedUserId)||!at||Date.parse(at)<cutoff||['true','1','yes'].includes(incoming)||['incoming','inbound','in','received'].includes(direction))continue;if(!['false','0','no'].includes(incoming)&&!['outgoing','outbound','out','sent'].includes(direction))continue;unique.set(cid,{id:cid,personId:pid,ownerId:Number(owner),at,outbound:true,verified:true});}
 const previous=person.nextActionEvidence||person.vestaNextActionEvidence;
 if(!inquiry&&previous?.contractVersion===NEXT_ACTION_EVIDENCE&&previous.inquiry&&Date.parse(previous.inquiry.at)<=now)inquiry=previous.inquiry;
 return {contractVersion:NEXT_ACTION_EVIDENCE,source:'targeted-fub-read',cutoff:new Date(now).toISOString(),inquiry,calls:[...unique.values()].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)||a.id.localeCompare(b.id)).slice(-32),callHistoryComplete:complete,callWindowDays:7,perOwnerLimit:32,communicationCredit:0};
}
