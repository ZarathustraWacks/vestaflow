import { NextResponse } from 'next/server';
import { debugSample } from '@/lib/fub/service';
import { FubError } from '@/lib/fub/errors';
export async function GET() {
  try { return NextResponse.json(await debugSample()); }
  catch (error) {
    if (error instanceof FubError) return NextResponse.json({ ok: false, error: error.message, status: error.status, details: error.details }, { status: error.status >= 400 && error.status < 600 ? error.status : 500 });
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
