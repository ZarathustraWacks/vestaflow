import type { NextRequest } from 'next/server';
import { openSession } from '@/lib/fub/oauth';

export function hasFubSession(request: NextRequest): boolean {
  const value = request.cookies.get('vesta_fub_session')?.value;
  return Boolean(value && openSession(value));
}
