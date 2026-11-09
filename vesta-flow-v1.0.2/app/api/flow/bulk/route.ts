import {after,NextRequest,NextResponse} from 'next/server';
import {fubRequest} from '@/lib/fub/client';
import {getFubSession,isFubManager,sessionUserId} from '@/lib/fub/session';
import {normalizeUser} from '@/lib/fub/normalize';
import {completionWritebackStatus} from '@/lib/fub/writeback';
import {ledgerReady} from '@/lib/render/flow-ledger';
import {validateBulkPlan,assertBulkOwner} from '@/lib/flow/bulk-plan';
import {scheduleBulkContact} from '@/lib/fub/bulk-tasks';
import {enqueueFlowContactRefresh} from '@/lib/render/flow-accelerator';
export const maxDuration=60;
export async function POST(request:NextRequest){
 const session=getFubSession(request);if(!session)return NextResponse.json({ok:false,error:'FUB authorization required.'},{status:401});
 const own=sessionUserId(session),manager=isFubManager(session);if(!manager&&!own)return NextResponse.json({ok:false,error:'Your FUB identity is unavailable.'},{status:403});
 const origin=request.headers.get('origin');if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({ok:false,error:'Schedule must be submitted from this Flow workspace.'},{status:403});
 try{
  const raw=await request.text();if(Buffer.byteLength(raw)>32768)return NextResponse.json({ok:false,error:'The schedule is too large.'},{status:413});
  const body=JSON.parse(raw),plan=validateBulkPlan(body);
  if(!manager&&plan.actorUserId!==own)return NextResponse.json({ok:false,error:'You may schedule only your own assigned contacts.'},{status:403});
  const actor=normalizeUser((await fubRequest<any>(`/users/${plan.actorUserId}`)).data);
  if(!actor.isActive)return NextResponse.json({ok:false,error:'The selected broker is not active in FUB.'},{status:403});
  if(body.phase==='preview'){
   const response=(await fubRequest<any>(`/people?id=${plan.leadIds.join(',')}&fields=id,name,stage,assignedUserId,assignedTo&limit=100`)).data;
   if(!Array.isArray(response.people)||response._metadata?.next||response._metadata?.nextLink)return NextResponse.json({ok:false,error:'FUB could not confirm the complete selection.'},{status:502});
   const people=new Map<string,any>(response.people.map((person:any):[string,any]=>[String(person.id),person]));
   const contacts=plan.leadIds.map(id=>{const person=people.get(id);if(!person)throw new Error('A selected contact is no longer visible in FUB.');assertBulkOwner(person,plan.actorUserId);return {id,name:person.name||`Contact ${id}`,stage:person.stage,owner:actor.name};});
   return NextResponse.json({ok:true,plan,contacts,writeAllowed:completionWritebackStatus('live').enabled&&ledgerReady(),message:'Creates one FUB task per selected contact. Planning notes are part of the task name; no communication, tags or stages are changed.'});
  }
  if(body.phase!=='execute'||body.confirmed!==true)return NextResponse.json({ok:false,error:'Review and confirm the selected contacts before scheduling.'},{status:400});
  if(!completionWritebackStatus('live').enabled||!ledgerReady())return NextResponse.json({ok:false,error:'Live FUB writes and durable Flow storage must be available before scheduling.'},{status:503});
  const leadId=String(body.leadId||'');if(!plan.leadIds.includes(leadId))return NextResponse.json({ok:false,error:'Contact is outside the reviewed selection.'},{status:400});
  const receipt=await scheduleBulkContact(plan,leadId);
  after(()=>enqueueFlowContactRefresh(leadId).then(()=>{}));
  return NextResponse.json({ok:true,receipt});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Unable to confirm the FUB schedule.'},{status:400});}
}
