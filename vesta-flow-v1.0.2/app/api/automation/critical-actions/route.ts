import { NextRequest,NextResponse } from 'next/server';
import { buildCriticalRun } from '@/lib/automation/engine';
import { dueRunKinds,localRunKey,type CriticalRunKind } from '@/lib/automation/critical';
import { automationStorageStatus,claimRun,completeRun,getRun,releaseClaim } from '@/lib/automation/store';
import { renderDigest,sendDigest } from '@/lib/automation/gmail';

export const maxDuration=300;
const configuredSecret=()=>process.env.VESTA_CRITICAL_ACTION_SECRET||process.env.CRON_SECRET||'';
const authorized=(request:NextRequest)=>{const secret=configuredSecret();return Boolean(secret&&request.headers.get('authorization')===`Bearer ${secret}`)};
const closures=()=>String(process.env.VESTA_BUSINESS_CLOSURES||'').split(',').map(x=>x.trim()).filter(Boolean);
const emailMode=()=>{const mode=(process.env.VESTA_EMAIL_MODE||'shadow').toLowerCase();return ['shadow','test','production'].includes(mode)?mode:'shadow'};

async function execute(request:NextRequest){
 if(!authorized(request))return NextResponse.json({ok:false,error:'Unauthorized.'},{status:401});
 const now=new Date(),manual=request.nextUrl.searchParams.get('kind') as CriticalRunKind|null,manualAllowed=process.env.VESTA_EMAIL_ALLOW_MANUAL==='true',kinds=manual&&manualAllowed?[manual]:dueRunKinds(now,closures());
 if(!kinds.length)return NextResponse.json({ok:true,due:false,now:now.toISOString(),message:'No Central-time critical-action dispatch is due.'});
 const mode=emailMode(),storage=automationStorageStatus(),results=[];
 if(mode!=='shadow'&&!storage.available)return NextResponse.json({ok:false,error:'Production/test email requires durable Upstash automation storage.'},{status:503});
 for(const kind of kinds){
  if(!['morning-reroutes','afternoon-critical'].includes(kind))continue;
  const runKey=localRunKey(kind,now),existing=storage.available?await getRun(runKey):null;if(existing){results.push({ok:true,duplicatePrevented:true,run:existing});continue}
  const claimed=storage.available?await claimRun(runKey):true;if(!claimed){results.push({ok:true,duplicatePrevented:true,runKey});continue}
  try{
   const built=await buildCriticalRun(kind,now);let delivery:any={delivered:false,mode,message:'Shadow mode: no email sent.'};
   if(mode!=='shadow'&&built.candidates.length)delivery={...await sendDigest(renderDigest(kind,built.candidates,mode,runKey)),mode};
   else if(mode!=='shadow')delivery={delivered:false,mode,message:'No eligible candidates; no email sent.'};
   const record=storage.available?await completeRun(runKey,kind,built.candidates,delivery):{runKey,kind,candidates:built.candidates,delivery};results.push({ok:true,built,record});
  }catch(error){if(storage.available)await releaseClaim(runKey).catch(()=>{});results.push({ok:false,runKey,error:error instanceof Error?error.message:'Critical-action run failed.'})}
 }
 const ok=results.every(result=>result.ok);return NextResponse.json({ok,due:true,mode,storage,results},{status:ok?200:500});
}
export async function GET(request:NextRequest){return execute(request)}
export async function POST(request:NextRequest){return execute(request)}
