import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode, equalSecret, FUB_OAUTH_REDIRECT_URI, sealSession } from '@/lib/fub/oauth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const state = url.searchParams.get('state') || '';
  const expectedState = request.cookies.get('vesta_fub_oauth_state')?.value || '';
  const responseStatus = url.searchParams.get('response');
  const code = url.searchParams.get('code') || '';
  if (!state || !expectedState || !equalSecret(state, expectedState)) return NextResponse.json({ ok: false, error: 'Invalid FUB OAuth state' }, { status: 400 });
  if (responseStatus === 'denied' || !code) return NextResponse.json({ ok: false, error: 'FUB authorization was not approved' }, { status: 403 });
  try {
    const token = await exchangeCode(code, state);
    const session = sealSession({ accessToken: token.access_token, refreshToken: token.refresh_token || null, tokenType: token.token_type || 'Bearer', expiresAt: Date.now() + Number(token.expires_in || 3600) * 1000, redirectUri: FUB_OAUTH_REDIRECT_URI });
    const destination = new URL('/', url.origin);
    destination.searchParams.set('fub', 'connected');
    const result = NextResponse.redirect(destination);
    result.cookies.set('vesta_fub_oauth_state', '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
    result.cookies.set('vesta_fub_session', session, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
    return result;
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'FUB OAuth token exchange failed' }, { status: 502 });
  }
}
