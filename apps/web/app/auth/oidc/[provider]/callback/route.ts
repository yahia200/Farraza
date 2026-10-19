import { revalidatePath } from 'next/cache';
import type { NextRequest } from 'next/server';
import { callOidcApi, redirectToSignIn, redirectWithCookies } from '@/lib/oidc';

/**
 * Where Google sends the browser back: the redirect URI registered with Google
 * (`oidc.callbackUrl` in apps/api/src/auth/oidc.options.ts). Hands Google's
 * query and this browser's transaction cookie to the API, which finishes the
 * login, then sets the session cookie on this origin and lands the browser on
 * the API's path (/dashboard, which sends new accounts to /onboarding).
 * See lib/oidc.ts.
 */
export async function GET(request: NextRequest, ctx: RouteContext<'/auth/oidc/[provider]/callback'>) {
  const { provider } = await ctx.params;
  const result = await callOidcApi(
    `/api/auth/oidc/${encodeURIComponent(provider)}/callback${request.nextUrl.search}`,
  );
  if (!result.ok) {
    // The user pressed Cancel on Google's page: nothing to explain.
    const cancelled = request.nextUrl.searchParams.get('error') === 'access_denied';
    return redirectToSignIn(request, cancelled ? undefined : result.error);
  }

  // The API only returns relative paths here; still refuse anything off-origin
  // (open-redirect guard from the backend-for-frontend guide's callback example).
  const destination = new URL(result.redirect.url, request.url);
  if (destination.origin !== request.nextUrl.origin) {
    return redirectToSignIn(request, 'google-failed');
  }
  // A new session: drop data cached for the previous visitor ('use cache: private' DAL).
  revalidatePath('/', 'layout');
  return redirectWithCookies(destination, result.redirect.cookies);
}
