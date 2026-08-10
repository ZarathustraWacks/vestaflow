import { NextRequest,NextResponse } from 'next/server';
import { eventHistory } from '@/lib/flow/engine';
import { listFlowEvents } from '@/lib/flow/store';
export async function GET(_request:NextRequest,{params}:{params:Promise<{id:string}>}){try{const {id}=await params;return NextResponse.json({ok:true,events:eventHistory(await listFlowEvents(),id)})}catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Unable to load action history.'},{status:500})}}
