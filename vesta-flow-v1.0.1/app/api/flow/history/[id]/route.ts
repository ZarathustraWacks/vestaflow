import { NextRequest,NextResponse } from 'next/server';
import { eventHistory } from '@/lib/flow/engine';
import { degradedFlowStorageStatus,listFlowEvents } from '@/lib/flow/store';
export async function GET(_request:NextRequest,{params}:{params:Promise<{id:string}>}){const {id}=await params;try{return NextResponse.json({ok:true,events:eventHistory(await listFlowEvents(),id)})}catch{return NextResponse.json({ok:true,events:[],storage:degradedFlowStorageStatus(),warning:'Action history is temporarily unavailable. Live lead intelligence remains available.'})}}
