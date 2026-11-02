import { NextRequest, NextResponse } from 'next/server';
import { getFubSession } from '@/lib/fub/session';

function describe(value: unknown, depth = 0): unknown {
  if (!value || typeof value !== 'object' || depth > 3) return typeof value;
  const record = value as Record<string, unknown>;
  const nested: Record<string, unknown> = {};
  for (const key of ['id', 'userId', 'user_id', 'userID', 'personId', 'ownerId', 'role', 'isOwner', 'email', 'name']) {
    if (key in record) nested[key] = record[key];
  }
  for (const key of ['user', 'data']) if (record[key] && typeof record[key] === 'object') nested[key] = describe(record[key], depth + 1);
  return nested;
}

export async function GET(request: NextRequest) {
  const session = getFubSession(request);
  if (!session) return NextResponse.json({ ok: false, error: 'No FUB session' }, { status: 401 });
  return NextResponse.json({ ok: true, hasAccessToken: Boolean(session.accessToken), identity: describe(session.fubUser) });
}
