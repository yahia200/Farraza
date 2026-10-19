import type { ConfigService } from '@nestjs/config';
import { google, type AuthenticationModuleOptions } from '@nestjs/authentication';

/**
 * The `oidc` options of AuthenticationModule (app.module.ts). Goes with the
 * AccountLinker resolver: the module refuses to start with one and not the other.
 */
export function oidcOptions(config: ConfigService): AuthenticationModuleOptions['oidc'] {
  return {
    // The WEB app's callback Route Handler (apps/web/app/auth/oidc/[provider]/callback),
    // not the API's: Google sends the browser there, and the web app relays the
    // callback to the API. Register exactly this URL (with `google` for
    // `:provider`) as the OAuth client's redirect URI in Google Cloud.
    callbackUrl: `${config.getOrThrow<string>('APP_URL')}/auth/oidc/:provider/callback`,
    // /dashboard sends a user without a company (a new account) to /onboarding.
    redirectAfterLogin: '/dashboard',
    providers: {
      google: google({
        clientId: config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
        clientSecret: config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      }),
    },
  };
}
