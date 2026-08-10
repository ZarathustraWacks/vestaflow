import { NextResponse } from 'next/server';
import { getPolicyCatalog } from '@/lib/fub/service';
import { FubError } from '@/lib/fub/errors';
export async function GET(){try{return NextResponse.json(await getPolicyCatalog())}catch(error){const item=error as FubError;return NextResponse.json({ok:false,error:item.message,status:item.status,details:item.details},{status:item.status||500})}}
