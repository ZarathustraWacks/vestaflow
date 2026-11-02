import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const FUB_OAUTH_REDIRECT_URI = process.env.FUB_OAUTH_REDIRECT_URI?.trim() || 'https://vestaflow.vercel.app/api/auth/fub/callback';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function clientId(): string { return required('FUB_OAUTH_CLIENT_ID'); }
export function clientSecret(): string { return required('FUB_OAUTH_CLIENT_SECRET'); }
export type FubOAuthUser = { id?: number|string; name?: string; email?: string; role?: string; isOwner?: boolean; isActive?: boolean };

function sessionKey(): Buffer {
  return createHash('sha256').update(required('FUB_OAUTH_SESSION_SECRET')).digest();
}

export function createOAuthState(): string { return randomBytes(32).toString('base64url'); }

export function equalSecret(left: string, right: string): boolean {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function sealSession(value: Record<string, unknown>): string {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', sessionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.');
}

export function openSession(value: string): Record<string, unknown> | null {
  try {
    const [ivText, tagText, ciphertextText] = value.split('.');
    if (!ivText || !tagText || !ciphertextText) return null;
    const decipher = createDecipheriv('aes-256-gcm', sessionKey(), Buffer.from(ivText, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextText, 'base64url')), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(plaintext);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch { return null; }
}

export async function exchangeCode(code: string, state: string) {
  const credentials = Buffer.from(`${clientId()}:${clientSecret()}`).toString('base64');
  const response = await fetch('https://app.followupboss.com/oauth/token', {
    method: 'POST',
    headers: { authorization: `Basic ${credentials}`, 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: FUB_OAUTH_REDIRECT_URI, state }),
    cache: 'no-store', signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.access_token) throw new Error(String(body?.error_description || body?.message || 'FUB OAuth token exchange failed'));
  return body as { access_token: string; refresh_token?: string; expires_in?: number; token_type?: string };
}

export async function fetchOAuthUser(accessToken: string): Promise<FubOAuthUser> {
  const headers:Record<string,string>={ authorization: `Bearer ${accessToken}`, accept: 'application/json' };
  if(process.env.FUB_SYSTEM_NAME)headers['X-System']=process.env.FUB_SYSTEM_NAME;
  if(process.env.FUB_SYSTEM_KEY)headers['X-System-Key']=process.env.FUB_SYSTEM_KEY;
  const response = await fetch('https://api.followupboss.com/v1/me', { headers, cache: 'no-store', signal: AbortSignal.timeout(15_000) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body) throw new Error(String(body?.message || body?.errorMessage || 'Unable to resolve the FUB user identity'));
  return body as FubOAuthUser;
}
