import {NextRequest,NextResponse} from 'next/server';
import {getSpine} from '@/lib/fub/service';

export const maxDuration=300;

function authorized(request:NextRequest){
 const expected=process.env.VESTA_SHADOW_EXPORT_SECRET;
 return Boolean(expected)&&request.headers.get('authorization')===`Bearer ${expected}`;
}

export async function GET(request:NextRequest){
 if(!authorized(request))return NextResponse.json({ok:false,error:'Unauthorized.'},{status:401});
 try{
  const spine=await getSpine(),availability=Object.fromEntries(['people','users','tasks'].map(name=>{const collection=(spine as any)[name];return [name,{ok:collection?.ok!==false,pages:collection?.pages??null,partial:Boolean(collection?.partial),error:collection?.error??null}]}));
  return NextResponse.json({ok:true,exportedAt:new Date().toISOString(),featureSchema:'vesta-spine-11.0.8',policyVersion:'existing-raven-11.0.8',mode:spine.mode,availability,leads:spine.people.items});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Unable to export the shadow snapshot.'},{status:502})}
}
