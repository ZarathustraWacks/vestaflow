import { NextResponse } from 'next/server'; import { identity } from '@/lib/fub/service'; import { FubError } from '@/lib/fub/errors';
export async function GET(){try{return NextResponse.json(await identity());}catch(e){const x=e as FubError;return NextResponse.json({ok:false,error:x.message,status:x.status,details:x.details},{status:x.status||500});}}
