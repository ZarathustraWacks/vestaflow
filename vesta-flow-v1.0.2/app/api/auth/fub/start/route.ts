import { NextResponse } from 'next/server';
import { clientId, createOAuthState, FUB_OAUTH_REDIRECT_URI } from '@/lib/fub/oauth';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const state = createOAuthState();
    const url = new URL('https://app.followupboss.com/oauth/authorize');
    url.searchParams.set('response_type', 'auth_code');
    url.searchParams.set('client_id', clientId());
    url.searchParams.set('redirect_uri', FUB_OAUTH_REDIRECT_URI);
    url.searchParams.set('state', state);
    // Let an already-authenticated FUB browser session continue through SSO.
    // Forcing prompt=login made Safari invoke Passwords AutoFill every time a
    // Flow session expired, leaving brokers at a credential prompt instead of
    // returning to their workspace.
    const response = NextResponse.redirect(url);
    response.cookies.set('vesta_fub_oauth_state', state, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 600 });
    // Never leave a token-only or otherwise stale session in place while a
    // new consent flow is running. The callback will replace it only after
    // it has resolved the current FUB user's identity.
    response.cookies.set('vesta_fub_session', '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
    return response;
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'FUB OAuth is not configured' }, { status: 503 });
  }
}
