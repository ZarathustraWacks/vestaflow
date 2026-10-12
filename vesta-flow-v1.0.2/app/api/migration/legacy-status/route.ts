import {NextRequest,NextResponse} from 'next/server';
export const maxDuration=60;
/** Temporary preview-only, authenticated, read-only migration diagnostic. No records or secrets leave this route. */
export async function POST(request:NextRequest){
 if(process.env.VERCEL_ENV!=='preview'||process.env.VERCEL_GIT_COMMIT_REF!=='codex/flow-render-ledger-2026-10-12')return NextResponse.json({ok:false},{status:404});
 const key=process.env.VESTA_LEARNING_API_KEY;
 if(!key||request.headers.get('authorization')!==`Bearer ${key}`)return NextResponse.json({ok:false},{status:401});
 const endpoint=process.env.UPSTASH_REDIS_REST_URL,token=process.env.UPSTASH_REDIS_REST_TOKEN;
 if(!endpoint||!token)return NextResponse.json({ok:false,stage:'configuration',reason:'missing-legacy-connection'},{status:503});
 let stage='configuration';
 try{
  const url=new URL(endpoint);if(url.protocol!=='https:')throw Error('unsafe-protocol');
  async function redis(command:(string|number)[]){
   const response=await fetch(url,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(command),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw Error(`http-${response.status}`);
   const body=await response.json();if(body.error||!Object.hasOwn(body,'result'))throw Error('redis-command-rejected');return body.result;
  }
  stage='ping';if(await redis(['PING'])!=='PONG')throw Error('invalid-response');
  stage='history-count';const count=await redis(['LLEN',process.env.VESTA_FLOW_STORAGE_KEY||'vesta:flow:v1:events']);
  if(!Number.isSafeInteger(count)||count<0)throw Error('invalid-response');
  return NextResponse.json({ok:true,reachable:true,eventRows:count,usesDefaultEventKey:!process.env.VESTA_FLOW_STORAGE_KEY,legacyTypoOverridePresent:Boolean(process.env.ESTA_FLOW_STORAGE_KEY),usesDefaultDispatchPrefix:!process.env.VESTA_EMAIL_STORAGE_KEY,historyReconciled:false});
 }catch(error){
  const e=error as Error&{cause?:{code?:string}};const message=e.message||'';
  const reason=/^(http-\d{3}|unsafe-protocol|redis-command-rejected|invalid-response)$/.test(message)?message:['ENOTFOUND','EAI_AGAIN','ECONNREFUSED','ETIMEDOUT'].includes(e.cause?.code||'')?e.cause!.code:'connection-failed';
  return NextResponse.json({ok:false,stage,reason,historyReconciled:false},{status:503});
 }
}
