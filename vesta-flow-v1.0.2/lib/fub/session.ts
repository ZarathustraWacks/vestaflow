import type { NextRequest } from 'next/server';
import { openSession } from '@/lib/fub/oauth';
export type FubSession = { accessToken?: string; fubUser?: { id?: number|string; name?: string; email?: string; role?: string; isOwner?: boolean; isActive?: boolean } };
export function getFubSession(request: NextRequest): FubSession | null { const value=request.cookies.get('vesta_fub_session')?.value; if(!value)return null; return openSession(value) as FubSession|null; }

export function hasFubSession(request: NextRequest): boolean {
  return Boolean(getFubSession(request));
}
export function isFubManager(session:FubSession|null):boolean { const user=session?.fubUser; return Boolean(user&&(user.isOwner===true||String(user.role||'').toLowerCase()==='broker')); }
export function sessionUserId(session:FubSession|null):number|null { const value=Number(session?.fubUser?.id); return Number.isInteger(value)&&value>0?value:null; }
