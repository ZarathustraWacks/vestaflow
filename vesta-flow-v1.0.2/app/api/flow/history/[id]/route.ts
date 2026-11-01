import { NextRequest,NextResponse } from 'next/server';
import { eventHistory } from '@/lib/flow/engine';
import { degradedFlowStorageStatus,listFlowEvents } from '@/lib/flow/store';
import { hasFubSession } from '@/lib/fub/session';
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){if(!hasFubSession(request))return NextResponse.json({ok:false,error:'FUB authorization required.'},{status:401});const {id}=await params;try{return NextResponse.json({ok:true,events:eventHistory(await listFlowEvents(),id)})}catch{return NextResponse.json({ok:true,events:[],storage:degradedFlowStorageStatus(),warning:'Action history is temporarily unavailable. Live lead intelligence remains available.'})}}
