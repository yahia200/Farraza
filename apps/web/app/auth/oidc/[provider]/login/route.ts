import type { NextRequest } from 'next/server';
import { callOidcApi, redirectToSignIn, redirectWithCookies } from '@/lib/oidc';

/**
 * "Sign in with Google" links here (a plain <a>, never next/link, whose
 * prefetch would start a login). Asks the API to start the login, sets its
 * transaction cookie on this origin and sends the browser to Google.
 * `?link=true` connects Google to the signed-in user instead; `?redirectTo=`
 * (a relative path) is where to land afterwards. See lib/oidc.ts.
 */
export async function GET(request: NextRequest, ctx: RouteContext<'/auth/oidc/[provider]/login'>) {
  const { provider } = await ctx.params;
  const query = new URLSearchParams();
  for (const name of ['link', 'redirectTo']) {
    const value = request.nextUrl.searchParams.get(name);
    if (value !== null) {
      query.set(name, value);
    }
  }

  // The API refuses a link flow started from another site's page by reading
  // Sec-Fetch-Site, which only the browser's request to us carries.
  const headers = new Headers();
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite) {
    headers.set('sec-fetch-site', fetchSite);
  }

  const result = await callOidcApi(
    `/api/auth/oidc/${encodeURIComponent(provider)}/login?${query}`,
    { headers },
  );
  if (!result.ok) {
    return redirectToSignIn(request, result.error);
  }

  const destination = new URL(result.redirect.url);
  if (destination.protocol !== 'https:') {
    return redirectToSignIn(request, 'google-failed');
  }
  return redirectWithCookies(destination, result.redirect.cookies);
}
