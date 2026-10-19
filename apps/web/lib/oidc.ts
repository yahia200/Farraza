import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { PASSWORD_SIGN_IN_REQUIRED } from '@repo/shared';
import { apiFetch, readApiError } from './api';

/**
 * "Sign in with Google" through the backend-for-frontend. The browser only
 * talks to this app: the Route Handlers in app/auth/oidc/[provider]/ call the
 * API's OIDC routes, which answer JSON `{ url, cookies }` instead of
 * redirecting (apps/api/src/auth/oidc.controller.ts). The handlers put those
 * cookies on the web origin (Set-Cookie carries no Domain, so a cookie binds to
 * whichever origin hands it to the browser) and send the browser to `url`.
 * Docs: node_modules/next/dist/docs/01-app/02-guides/backend-for-frontend.md
 * ("Webhooks and callback URLs"), 03-api-reference/03-file-conventions/route.md
 * ("Cookies": a Response with Set-Cookie).
 */

/** The login's transaction cookie (@nestjs/authentication default name). */
export const OIDC_TX_COOKIE = '__Host-oidc_tx';

/** What the API's OIDC routes answer (OidcRedirect in @nestjs/authentication). */
interface OidcRedirect {
  url: string;
  cookies: string[];
}

/** `?error=` codes the sign-in page explains (components/auth/google-sign-in-error.tsx). */
export type OidcErrorCode = 'google-account-exists' | 'google-refused' | 'google-failed' | 'too-many-attempts';

/**
 * Calls an API OIDC route with this browser's API cookies (session and
 * transaction) and, unless the API refuses, returns where to send the browser
 * and the cookies to set on the way.
 */
export async function callOidcApi(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: true; redirect: OidcRedirect } | { ok: false; error: OidcErrorCode }> {
  const response = await apiFetch(path, init, { forwardCookies: [OIDC_TX_COOKIE] });
  if (response.ok) {
    return { ok: true, redirect: (await response.json()) as OidcRedirect };
  }
  const body = (await readApiError(response)) as { errorCode?: string };
  if (response.status === 403 && body.errorCode === PASSWORD_SIGN_IN_REQUIRED) {
    return { ok: false, error: 'google-account-exists' };
  }
  if (response.status === 403) {
    return { ok: false, error: 'google-refused' };
  }
  if (response.status === 429) {
    return { ok: false, error: 'too-many-attempts' };
  }
  return { ok: false, error: 'google-failed' };
}

/** A redirect that also sets the API's cookies on this (the web) origin, verbatim. */
export function redirectWithCookies(url: URL, cookies: readonly string[]): NextResponse {
  const response = NextResponse.redirect(url);
  for (const cookie of cookies) {
    response.headers.append('Set-Cookie', cookie);
  }
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

/** Back to the sign-in page with a message, dropping the half-finished login's cookie. */
export function redirectToSignIn(request: NextRequest, error?: OidcErrorCode): NextResponse {
  const url = new URL('/sign-in', request.url);
  if (error) {
    url.searchParams.set('error', error);
  }
  const response = NextResponse.redirect(url);
  // `__Host-` cookies are only replaced (here: deleted) with Secure and Path=/.
  response.cookies.set(OIDC_TX_COOKIE, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
