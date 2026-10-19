# Google sign-in goes through the web app: the API returns `{ url, cookies }`

Status: accepted

The web app is a backend-for-frontend: the browser never calls the API, and the session cookie (`__Host-sid`) lives on the web app's host, where the DAL reads it. A redirect-based OIDC login breaks both unless it is routed through the web app, because a `Set-Cookie` without a `Domain` attribute is host-only: the cookie binds to whichever host returned it ([RFC 6265 §5.3, step 6](https://www.rfc-editor.org/rfc/rfc6265#section-5.3)). So the API's OIDC routes (`apps/api/src/auth/oidc.controller.ts`) answer JSON `{ url, cookies }` from `OidcService.start()`/`finish()` instead of redirecting, and two web Route Handlers (`apps/web/app/auth/oidc/[provider]/login` and `/callback`, helpers in `apps/web/lib/oidc.ts`) call them server-to-server, append each returned cookie to their own response, and redirect the browser themselves. Google's redirect URI is the web callback, `${APP_URL}/auth/oidc/google/callback` (`oidc.callbackUrl` in `apps/api/src/auth/oidc.options.ts`).

Considered options:

- **Send the browser straight to the API** (the package guide's controller: `docs/nestjs/auth.md`, "Add "Sign in with Google""), with the redirect URI on the API — rejected. The transaction and session cookies would land on the API's host, so the web app would never see the session. Getting it across means either a shared parent domain (`Domain=.example.com`, which the `__Host-` prefix forbids, and which ties deployment to one registrable domain) or a second hand-off from the API to the web app (a one-time code, i.e. another token flow to secure). It would also make the API a browser-facing origin again, with CORS and CSRF to reason about for every route.
- **Proxy `/auth/oidc/*` to the API with a Next.js rewrite**, keeping the guide's redirecting controller. This also keeps cookies on the web host, but the browser's request would reach the API without what `apiFetch` (`apps/web/lib/api.ts`) adds: the visitor's address and the internal secret that `TrustedClientThrottlerGuard` needs to rate-limit per visitor, and the allow-list that forwards only the API's own cookies (`forwardCookies`). Refusals (403 `password_sign_in_required`, 429) would also reach the browser as raw API errors instead of a `/sign-in?error=` page.
- **API returns `{ url, cookies }`, web Route Handlers relay** — chosen. It reuses the existing relay path (`apiFetch` plus copying `Set-Cookie`, as `relaySessionCookie` already does for password sign-in), keeps rate limiting and error mapping on the server, and needs no shared domain.

Consequences:

- The OIDC routes on the API are not usable from a browser on their own; a new provider needs only an options entry, but any new OIDC flow needs a matching web Route Handler.
- The login handler forwards the browser's `Sec-Fetch-Site` header so the API's CSRF check (`enableCsrfProtection` in `apps/api/src/main.ts`, with `APP_URL` trusted) can still refuse a link flow started from another site. Both OIDC routes are GETs, so the check otherwise lets them through.
- The callback handler checks that the API's landing path is same-origin before redirecting (open-redirect guard), and the login handler only follows an `https:` provider URL.
- `/auth` is now a top-level web route, so `auth` is a reserved company slug (`RESERVED_COMPANY_SLUGS` in `@repo/shared`).
- In development the web app (`:3000`) and the API (`:3001`) share the host `localhost`, and cookies are not isolated by port ([RFC 6265 §8.5](https://www.rfc-editor.org/rfc/rfc6265#section-8.5)). A cookie wrongly set by the API would still reach the web app locally, so a mistake here only shows up once the two run on different hosts.
