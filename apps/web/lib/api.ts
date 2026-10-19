import 'server-only';
import { cookies, headers } from 'next/headers';
import type { FieldError } from '@repo/shared';
import { fromValidationErrors, type ActionFailure } from './action-failure';

/**
 * Talks to the NestJS API from the Next.js server (the "backend for frontend").
 * The browser never calls the API directly, so API_URL stays server-only.
 * See node_modules/next/dist/docs/01-app/02-guides/backend-for-frontend.md
 */

/** The API's session cookie (@nestjs/authentication default: `__Host-sid`). */
export const SESSION_COOKIE = '__Host-sid';

/**
 * The API's error body. Validation failures (400) add `errors`, one per
 * invalid field: see apps/api/src/common/validation-errors.ts.
 */
export interface ApiErrorBody {
  statusCode?: number;
  message: string | string[];
  error?: string;
  errors?: FieldError[];
}

export function apiUrl(path: string): string {
  const base = process.env.API_URL;
  if (!base) {
    throw new Error('API_URL is not set. Add it to apps/web/.env.local.');
  }
  return new URL(path, base).toString();
}

/**
 * Calls the API with the browser's session cookie attached, if there is one.
 * `cache: 'no-store'` because every response here depends on who is asking.
 *
 * It also tells the API who the visitor is, so rate limits count each visitor
 * rather than this server: their address in `x-client-ip`, plus the shared
 * INTERNAL_API_SECRET that makes the API trust it
 * (apps/api/src/common/trusted-client-throttler.guard.ts).
 * The address comes from X-Forwarded-For, which Vercel overwrites with the
 * real client address (https://vercel.com/docs/headers/request-headers) and
 * `next dev` fills from the connection. Elsewhere, only trust it behind a proxy
 * that sets it.
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {},
  /** Other API cookies to forward besides the session, e.g. the OIDC transaction cookie (lib/oidc.ts). */
  { forwardCookies = [] }: { forwardCookies?: readonly string[] } = {},
): Promise<Response> {
  const cookieStore = await cookies();
  const clientIp = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim();
  const secret = process.env.INTERNAL_API_SECRET;
  const requestHeaders = new Headers(init.headers);
  // Only the API's own cookies go to the API, never the web app's (like sidebar_state).
  const cookieHeader = [SESSION_COOKIE, ...forwardCookies]
    .map((name) => cookieStore.get(name))
    .filter((cookie) => cookie !== undefined)
    .map(({ name, value }) => `${name}=${value}`)
    .join('; ');
  if (cookieHeader) {
    requestHeaders.set('cookie', cookieHeader);
  }
  if (clientIp && secret) {
    requestHeaders.set('x-client-ip', clientIp);
    requestHeaders.set('x-internal-secret', secret);
  }
  if (init.body && !requestHeaders.has('content-type')) {
    requestHeaders.set('content-type', 'application/json');
  }
  return fetch(apiUrl(path), { ...init, headers: requestHeaders, cache: 'no-store' });
}

export async function readApiError(response: Response): Promise<ApiErrorBody> {
  try {
    return (await response.json()) as ApiErrorBody;
  } catch {
    return { statusCode: response.status, message: response.statusText };
  }
}

/**
 * Turns a failed API response into errors for a form with `fields`.
 * `byStatus` handles statuses that mean something specific to one action
 * (for example 409 on sign-up); everything else gets the shared handling.
 */
export async function failureFromResponse<F extends string>(
  response: Response,
  fields: readonly F[],
  byStatus: Partial<Record<number, (message: string) => ActionFailure<F>>> = {},
): Promise<ActionFailure<F>> {
  const body = await readApiError(response);
  const message = Array.isArray(body.message) ? body.message.join(' ') : body.message;

  const specific = byStatus[response.status];
  if (specific) {
    return specific(message);
  }
  switch (response.status) {
    case 400:
      return fromValidationErrors(body.errors, fields) ?? { formError: message };
    case 429: // ThrottlerGuard
      return { formError: 'Too many attempts. Wait a minute and try again.' };
    default:
      return { formError: 'Something went wrong. Please try again.' };
  }
}

/**
 * Copies the API's `Set-Cookie` for the session onto the response to the
 * browser, so the cookie lives on the web app's origin.
 * Only works in a Server Function or Route Handler (cookies().set rule):
 * node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md
 */
export async function relaySessionCookie(response: Response): Promise<void> {
  const header = response.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
  if (!header) {
    return;
  }

  const [pair, ...attributes] = header.split(';').map((part) => part.trim());
  const value = decodeURIComponent(pair!.slice(SESSION_COOKIE.length + 1));
  const maxAgeAttr = attributes.find((attr) => attr.toLowerCase().startsWith('max-age='));
  const maxAge = maxAgeAttr ? Number(maxAgeAttr.split('=')[1]) : undefined;

  await setSessionCookie(value, maxAge !== undefined && maxAge > 0 ? maxAge : 0);
}

/** Removes the session cookie from the browser (Max-Age=0). */
export async function clearSessionCookie(): Promise<void> {
  await setSessionCookie('', 0);
}

async function setSessionCookie(value: string, maxAge: number): Promise<void> {
  // `__Host-` cookies must be Secure, Path=/ and have no Domain, or browsers
  // drop them, deletions included, so set every attribute explicitly.
  (await cookies()).set(SESSION_COOKIE, value, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
}
