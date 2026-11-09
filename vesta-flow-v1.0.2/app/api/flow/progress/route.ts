import {NextRequest,NextResponse} from 'next/server';
import {getFubSession,isFubManager,sessionUserId} from '@/lib/fub/session';
import {listFlowEvents} from '@/lib/flow/store';
import {dailyGoal} from '@/lib/flow/daily-goal';

export async function GET(request:NextRequest){
 const session=getFubSession(request);
 if(!session)return NextResponse.json({ok:false},{status:401});
 const brokerId=isFubManager(session)?Number(request.nextUrl.searchParams.get('brokerId')):sessionUserId(session);
 if(!brokerId||!Number.isSafeInteger(brokerId))return NextResponse.json({ok:false},{status:400});
 const timeZone=request.nextUrl.searchParams.get('timeZone')||'America/Los_Angeles';
 try{new Intl.DateTimeFormat('en-CA',{timeZone})}catch{return NextResponse.json({ok:false},{status:400})}
 try{
  const events=await listFlowEvents();
  return NextResponse.json({ok:true,...dailyGoal(events,brokerId,timeZone)}, {headers:{'Cache-Control':'private, no-store'}});
 }catch{return NextResponse.json({ok:false,error:'Daily progress is temporarily unavailable.'},{status:503})}
}
