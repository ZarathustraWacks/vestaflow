import {NextRequest,NextResponse} from 'next/server';
import {getFlowSpine,getLeadIntelligence,getUsers} from '@/lib/fub/service';
import {fubRequest} from '@/lib/fub/client';
import {shouldUseDemo} from '@/lib/fub/config';
import {getFubSession,isFubManager,sessionUserId} from '@/lib/fub/session';
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const session=getFubSession(request);if(!session)return NextResponse.json({ok:false,error:'FUB authorization required.'},{status:401});
 try{const {id}=await params;if(!/^\d+$/.test(id))return NextResponse.json({ok:false,error:'Invalid contact.'},{status:400});
  if(shouldUseDemo()){const spine=await getFlowSpine(),lead=spine.people.items.find((item:any)=>String(item.id)===id);if(!lead)return NextResponse.json({ok:false,error:'Lead not found.'},{status:404});if(!isFubManager(session)&&lead.assignedUserId!==sessionUserId(session))return NextResponse.json({ok:false,error:'This contact is assigned to another broker.'},{status:403});return NextResponse.json(await getLeadIntelligence(id));}
  const person=(await fubRequest<any>('/people/'+id)).data;
  if(!isFubManager(session)&&Number(person.assignedUserId)!==sessionUserId(session))return NextResponse.json({ok:false,error:'This contact is assigned to another broker.'},{status:403});
  const users=await getUsers();return NextResponse.json(await getLeadIntelligence(id,{person,users:users.items}));
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Contact evidence unavailable.'},{status:502})}
}
