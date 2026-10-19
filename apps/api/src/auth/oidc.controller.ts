import { Controller, Get, Param, Query } from '@nestjs/common';
import { OidcService, Public, type OidcRedirect } from '@nestjs/authentication';

/**
 * "Sign in with Google", behind the web app (backend-for-frontend). Unlike the
 * guide's controller (docs/nestjs/auth.md, "Add "Sign in with Google""), these
 * routes answer JSON `{ url, cookies }` instead of redirecting: the browser
 * never talks to the API, so the web app's Route Handlers
 * (apps/web/app/auth/oidc/[provider]/…) call these, put `cookies` on the web
 * origin and redirect the browser to `url` themselves. OidcService also sets
 * the same cookies on this response; the web server ignores them.
 *
 * Both are GETs (safe methods), so the CSRF check in main.ts lets them through.
 */
@Public()
@Controller('auth/oidc')
export class OidcController {
  constructor(private readonly oidcService: OidcService) {}

  /**
   * Starts a login: `url` is the provider's authorization URL, `cookies` the
   * login's transaction cookie. With `?link=true`, connects the provider to the
   * signed-in user instead (401 without a session, 403 from another site).
   */
  @Get(':provider/login')
  login(
    @Param('provider') provider: string,
    @Query('redirectTo') redirectTo?: string,
    @Query('link') link?: string,
  ): Promise<OidcRedirect> {
    return this.oidcService.start(provider, { redirectTo, link: link === 'true' });
  }

  /**
   * Finishes a login with the provider's callback query: `url` is the relative
   * path to land on, `cookies` the session cookie (sign-in only) and the
   * cleared transaction cookie.
   */
  @Get(':provider/callback')
  callback(
    @Param('provider') provider: string,
    @Query() query: Record<string, string>,
  ): Promise<OidcRedirect> {
    return this.oidcService.finish(provider, query);
  }
}
