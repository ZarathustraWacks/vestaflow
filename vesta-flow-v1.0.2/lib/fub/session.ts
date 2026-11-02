import type { NextRequest } from 'next/server';
import { openSession } from '@/lib/fub/oauth';
export type FubSession = { accessToken?: string; fubUser?: { id?: number|string; userId?: number|string; user_id?: number|string; userID?: number|string; personId?: number|string; ownerId?: number|string; name?: string; email?: string; role?: string; isOwner?: boolean; isActive?: boolean; user?: unknown; data?: unknown } };
export function getFubSession(request: NextRequest): FubSession | null { const value=request.cookies.get('vesta_fub_session')?.value; if(!value)return null; return openSession(value) as FubSession|null; }

export function hasFubSession(request: NextRequest): boolean {
  return Boolean(getFubSession(request));
}
function identityCandidates(value: unknown, depth = 0): Array<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || depth > 3) return [];
  const record = value as Record<string, unknown>;
  const nested = [record.user, record.data].flatMap((item) => identityCandidates(item, depth + 1));
  return [record, ...nested];
}
export function isFubManager(session:FubSession|null):boolean {
  return identityCandidates(session?.fubUser).some((user) => {
    const role = String(user.role || '').toLowerCase();
    // FUB's administrative identities have appeared as Owner, Admin, or
    // Manager. A plain Broker/Agent must remain limited to assigned leads.
    return user.isOwner === true || role.includes('owner') || role.includes('admin') || role.includes('manager');
  });
}
export function sessionUserId(session:FubSession|null):number|null {
  for (const user of identityCandidates(session?.fubUser)) {
    const value = Number(user.id ?? user.userId ?? user.user_id ?? user.userID ?? user.personId ?? user.ownerId);
    if (Number.isInteger(value) && value > 0) return value;
  }
  return null;
}
