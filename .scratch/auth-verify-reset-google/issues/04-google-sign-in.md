# 04: Google sign-in

**What to build:** "Sign in with Google" on the sign-in and sign-up pages. A returning Google user lands in their dashboard; a brand-new Google user gets an account created (address verified, name from the Google profile) and is taken through onboarding. Google links to an existing account only when both Google and this system have verified the address, so nobody can take over an account by creating a Google account with someone's email. The web app stays a backend-for-frontend: the browser never calls the API, and the session cookie lands on the web origin.

**Blocked by:** 01 (extends the env schema). Independent of 02 and 03.

**Status:** ready-for-agent

- [ ] A new `identities` table links a `(provider, subject)` pair to a `User` (unique on the pair); a new `oidc_states` table backs a `PrismaOidcStateStore` registered as `oidcStates`, with atomic single-use consume and bounded growth. Contract emitted and applied; snapshots committed.
- [ ] An `OidcAccountResolver` decides the account for a Google identity: returning identity → that user; link flow → attach to the signed-in user (conflict if the identity already belongs to someone else); first visit with a Google-verified email and no local account → create a verified user with `name = profile.name ?? the email's local part` and link; first visit matching an existing account → link only if that account is also verified, otherwise refuse (403) and tell the user to sign in with their password and connect Google from their account; unverified Google email → refuse.
- [ ] The resolver is covered by a service-style unit spec against an in-memory `UsersRepository` fake (following `jobs.service.spec.ts`), exercising every branch above; the same fake also covers `CredentialsService.register` taking a name.
- [ ] The API's OIDC controller returns JSON `{ url, cookies }` for both the login start (optionally a link flow via `?link=true`) and the callback, rather than issuing an HTTP redirect, so cookies are handed back instead of set on the API origin. `oidc.callbackUrl` and the registered Google redirect URI are both the web origin; the `google()` preset reads `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (added to the env schema).
- [ ] The web app has two Route Handlers at the OIDC login and callback paths that forward the browser's cookies (including the transaction cookie) to the API, relay the returned cookies onto the web origin, and issue the browser redirect. "Sign in with Google" buttons on sign-in and sign-up link to the login handler.
- [ ] `enableCsrfProtection` is enabled with the web origin trusted; existing sign-in/sign-up/Server-Action flows continue to work.
- [ ] A returning Google user reaches the dashboard and a new Google user reaches onboarding, verified end-to-end.
- [ ] Build, lint, and type-check pass across the touched packages.

## Comments

**2026-10-19:** the `identities` and `oidc_states` tables are created by ticket 01 (scope change). This ticket writes the store and repository methods against them and doesn't touch `contract.prisma`. `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are already in the env schema.
