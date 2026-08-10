import { createHash } from 'node:crypto';
import { fubRequest,paginate } from './client';

interface CompletionInput {leadId:string;decisionSnapshotId:string;actorUserId:number;actorName:string;recommendation:string;outcome:string;note?:string}
export interface FubCompletionSync {attempted:boolean;delivered:boolean;simulated:boolean;alreadySynced:boolean;resource:'note';resourceId:string|number|null;message:string}

const writebackEnabled=()=>String(process.env.VESTA_FUB_WRITEBACK_ENABLED||'').trim().toLowerCase()==='true';
export function completionWritebackStatus(mode:'demo'|'live'){const enabled=mode==='demo'||writebackEnabled();return {enabled,mode:mode==='demo'?'simulated':'fub-note',message:mode==='demo'?'Demo mode simulates the Follow Up Boss completion note.':enabled?'Done outcomes are synchronized to the Follow Up Boss contact timeline as notes.':'Set VESTA_FUB_WRITEBACK_ENABLED=true to enable Done synchronization to Follow Up Boss.'};}

export function buildCompletionNote(input:CompletionInput){
 const syncKey=createHash('sha256').update([input.leadId,input.decisionSnapshotId,input.actorUserId,input.outcome,input.note||''].join('|')).digest('hex').slice(0,24);
 const marker=`[Vesta Flow sync: ${syncKey}]`;
 const body=[`Outcome: ${input.outcome}`,`Broker: ${input.actorName}`,`Vesta recommendation: ${input.recommendation}`,input.note?`Broker note: ${input.note}`:null,'Recorded from Vesta Flow.',marker].filter(Boolean).join('\n');
 return {syncKey,marker,subject:'Vesta Flow · Done',body};
}

export async function syncCompletionToFub(input:CompletionInput,mode:'demo'|'live'):Promise<FubCompletionSync>{
 const note=buildCompletionNote(input);
 if(mode==='demo')return {attempted:false,delivered:true,simulated:true,alreadySynced:false,resource:'note',resourceId:null,message:'Demo mode simulated the Follow Up Boss completion note.'};
 if(!writebackEnabled())throw new Error('Follow Up Boss completion sync is disabled. Set VESTA_FUB_WRITEBACK_ENABLED=true in Vercel and redeploy.');
 const numericPersonId=Number(input.leadId);if(!Number.isInteger(numericPersonId)||numericPersonId<=0)throw new Error('The Follow Up Boss person ID is invalid, so no note was written.');
 const personId=encodeURIComponent(input.leadId);
 const existing=await paginate<any>(`/notes?personId=${personId}`,25);
 const matched=existing.items.find(item=>String(item?.body||'').includes(note.marker));
 if(matched)return {attempted:true,delivered:true,simulated:false,alreadySynced:true,resource:'note',resourceId:matched.id??null,message:'The completion was already present in Follow Up Boss.'};
 const response=await fubRequest<any>('/notes',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({personId:numericPersonId,subject:note.subject,body:note.body,isHtml:false})});
 return {attempted:true,delivered:true,simulated:false,alreadySynced:false,resource:'note',resourceId:response.data?.id??null,message:'Completion note synchronized to Follow Up Boss.'};
}
