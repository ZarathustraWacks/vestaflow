import { getConfig } from './config';
import { FubError } from './errors';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const API_ORIGIN = 'https://api.followupboss.com';

export interface FubResponse<T> {
  data: T;
  headers: Record<string, string>;
  status: number;
  url: string;
}

function buildHeaders(initHeaders?: HeadersInit): Headers {
  const config = getConfig();
  if (!config.apiKey) throw new FubError('FUB_API_KEY is not configured', 503);
  const headers = new Headers(initHeaders);
  headers.set('Authorization', `Basic ${Buffer.from(`${config.apiKey}:`).toString('base64')}`);
  headers.set('Accept', 'application/json');
  if (config.systemName) headers.set('X-System', config.systemName);
  if (config.systemKey) headers.set('X-System-Key', config.systemKey);
  return headers;
}

function resolveFubUrl(pathOrUrl: string): string {
  const config = getConfig();
  const url = pathOrUrl.startsWith('http')
    ? new URL(pathOrUrl)
    : new URL(pathOrUrl.startsWith('/') ? `${config.baseUrl}${pathOrUrl}` : `${config.baseUrl}/${pathOrUrl}`);
  if (url.origin !== API_ORIGIN) throw new FubError('Refused non-Follow-Up-Boss pagination URL', 500, { url: url.toString() });
  return url.toString();
}

export async function fubRequest<T>(pathOrUrl: string, init: RequestInit = {}, attempt = 0): Promise<FubResponse<T>> {
  const url = resolveFubUrl(pathOrUrl);
  const method=String(init.method||'GET').toUpperCase(),retrySafe=method==='GET'||method==='HEAD';
  let response: Response;
  try {
    response = await fetch(url, { ...init, headers: buildHeaders(init.headers), cache: 'no-store' });
  } catch (error) {
    if (retrySafe && attempt < 3) {
      await sleep(500 * 2 ** attempt);
      return fubRequest<T>(pathOrUrl, init, attempt + 1);
    }
    throw new FubError('Unable to reach Follow Up Boss', 502, error);
  }

  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => { responseHeaders[key] = value; });
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  if (response.ok) return { data: body as T, headers: responseHeaders, status: response.status, url };

  const retryAfter = Number(response.headers.get('retry-after') ?? 0);
  if (retrySafe && (response.status === 429 || response.status >= 500) && attempt < 3) {
    const delay = retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt + Math.floor(Math.random() * 200);
    await sleep(delay);
    return fubRequest<T>(pathOrUrl, init, attempt + 1);
  }
  const errorBody = typeof body === 'object' && body ? body as Record<string, unknown> : null;
  throw new FubError(
    String(errorBody?.errorMessage ?? errorBody?.message ?? body ?? `Follow Up Boss request failed (${response.status})`),
    response.status,
    body,
    retryAfter || undefined,
  );
}

type Metadata = { next?: string | null; nextLink?: string | null; total?: number; count?: number };
type PaginatedPayload<T> = { people?:T[]; users?:T[]; tasks?:T[]; calls?:T[]; textMessages?:T[]; events?:T[]; notes?:T[]; appointments?:T[]; appointmentTypes?:T[]; appointmentOutcomes?:T[]; smartLists?:T[]; smartlists?:T[]; customFields?:T[]; timeframes?:T[]; data?:T[]; _metadata?:Metadata };

function extractItems<T>(payload: PaginatedPayload<T>): T[] {
  return payload.people ?? payload.users ?? payload.tasks ?? payload.calls ?? payload.textMessages ?? payload.events ?? payload.notes ?? payload.appointments ?? payload.appointmentTypes ?? payload.appointmentOutcomes ?? payload.smartLists ?? payload.smartlists ?? payload.customFields ?? payload.timeframes ?? payload.data ?? [];
}

export async function paginate<T>(
  initialPath: string,
  maxPages?: number,
): Promise<{ items: T[]; pages: number; headers: Record<string, string>; metadata: Metadata; visited: string[] }> {
  const config = getConfig();
  const pageLimit = maxPages ?? config.maxPages;
  const initial = new URL(resolveFubUrl(initialPath));
  if (!initial.searchParams.has('limit')) initial.searchParams.set('limit', '100');

  const items: T[] = [];
  const visited: string[] = [];
  const seen = new Set<string>();
  let nextUrl: string | null = initial.toString();
  let pages = 0;
  let lastHeaders: Record<string, string> = {};
  let lastMetadata: Metadata = {};

  while (nextUrl && pages < pageLimit) {
    if (seen.has(nextUrl)) throw new FubError('Follow Up Boss returned a pagination loop', 502, { nextUrl });
    seen.add(nextUrl); visited.push(nextUrl);
    const response = await fubRequest<PaginatedPayload<T>>(nextUrl);
    pages += 1; lastHeaders = response.headers; lastMetadata = response.data._metadata ?? {};
    items.push(...extractItems(response.data));

    const directLink = lastMetadata.nextLink?.trim();
    if (directLink) {
      nextUrl = resolveFubUrl(directLink);
      continue;
    }
    const nextToken = lastMetadata.next?.trim();
    if (nextToken) {
      const tokenUrl = new URL(initial.toString());
      tokenUrl.searchParams.delete('offset');
      tokenUrl.searchParams.set('next', nextToken);
      nextUrl = tokenUrl.toString();
      continue;
    }
    nextUrl = null;
  }

  if(nextUrl)throw new FubError('Follow Up Boss pagination stopped before the collection was complete',502,{pageLimit,pages,nextUrl,total:lastMetadata.total});
  return { items, pages, headers: lastHeaders, metadata: lastMetadata, visited };
}
