# Spec: Email verification, password reset, and Google sign-in

Status: ready-for-agent

Built on `@nestjs/authentication` + `@nestjs/mail` (both already installed), following `docs/nestjs/auth.md`. One branch, sequenced: shared schemas → config validation → DB → stores/repository → mail → email verification → password reset → Google OIDC → web surface → CSRF.

## Problem Statement

Today a person can only sign up and sign in with an email and password. Three gaps hurt them:

- **No proof of address.** Anyone can type any email into sign-up, so the system can't trust that the address on an account belongs to the person using it. This also leaves the door open to account pre-hijacking when a third-party sign-in is added later.
- **No way back in after a forgotten password.** A user who forgets their password is permanently locked out of their company's hiring pipeline, with no self-service recovery.
- **No Google sign-in.** Users expect "Sign in with Google"; without it, every user must invent and remember yet another password.

## Solution

From the user's perspective:

- **Email verification.** When someone signs up, the system emails them a link that proves they own the address. They can open it to mark their address verified, and can ask for a fresh link if the old one expired or never arrived. An unverified user keeps full access for now (no feature is gated on verification yet) but sees a reminder to verify.
- **Password reset.** A user who forgot their password asks for a reset link by entering their email, receives a link (if that address has an account), and chooses a new password on the page it opens. Setting a new password signs them in and signs out every other session.
- **Google sign-in.** A user can sign up or sign in with Google from the sign-in and sign-up pages. A returning Google user lands in their dashboard; a brand-new Google user is taken through onboarding like any new account.

The web app stays a strict backend-for-frontend: the browser never calls the API directly, and the session cookie continues to live on the web origin.

## User Stories

1. As a new user, I want a verification email when I sign up, so that I can prove the address is mine.
2. As a new user, I want to stay signed in and land on onboarding right after signing up, so that verifying my email is not a blocker to getting started.
3. As a user who verified their address, I want the system to record that, so that I can later link Google to the same account safely.
4. As a user whose verification link expired, I want to request a new one, so that I can still verify without creating a new account.
5. As a signed-in unverified user, I want a visible reminder with a resend button, so that I'm nudged to verify without being locked out.
6. As a user, I want a verification link that only works once and expires, so that a leaked or forwarded link can't be reused indefinitely.
7. As a user who changed my email, I want an old verification link to verify nothing, so that it can't confirm an address I no longer use.
8. As a security-conscious user, I want the verification page to POST the token (not have it consumed by a GET), so that mail scanners and link previews don't burn my link before I click.
9. As a user who forgot my password, I want to request a reset by entering my email, so that I can regain access on my own.
10. As a user, I want the "forgot password" page to say "check your email" regardless of whether the address has an account, so that the system never reveals who has an account.
11. As a user, I want the reset link to go only to the address stored on the account, so that a lookalike address typed into the form can't redirect my link.
12. As a user resetting my password, I want to be signed in automatically after choosing a new one, so that I don't have to sign in again immediately.
13. As a user resetting my password, I want all my other sessions ended, so that anyone who knew my old password is signed out.
14. As a user, I want a reset link that works once and expires within an hour, so that an old link can't be replayed.
15. As a user, I want any password change (by reset or otherwise) to invalidate reset links issued before it, so that stale links can't undo my new password.
16. As a user whose new password breaks the rules, I want the error without my link being consumed, so that I can try again with a valid password.
17. As a user resetting a password on an account someone else registered with my address, I want the reset to take over that account and mark the address verified, so that I reclaim it.
18. As a user, I want to sign in with Google from the sign-in page, so that I don't need a password.
19. As a user, I want to sign up with Google from the sign-up page, so that I can create an account in one click.
20. As a returning Google user, I want to land in my dashboard, so that I continue where I left off.
21. As a brand-new Google user, I want an account created and to be taken through onboarding, so that I can set up my first company.
22. As a user, I want Google sign-in to link to my existing account only when both Google and this system have verified the address, so that nobody can hijack my account by creating a Google account with my email.
23. As a user whose local account is unverified, I want Google sign-in to refuse to merge and tell me to sign in with my password first, so that a stranger who pre-registered my address can't share my account.
24. As an abuse target, I want the "resend verification" and "forgot password" endpoints rate-limited per visitor, so that they can't be used to flood my inbox.
25. As an operator, I want the API to refuse to boot when a required environment variable is missing or malformed, so that misconfiguration fails fast and legibly.
26. As an operator, I want verification/reset tokens and in-flight Google logins persisted in Postgres like sessions, so that they survive within the running system and behave correctly on a single instance.
27. As a developer, I want the OIDC browser redirects proxied through the web app, so that the session cookie lands on the web origin and the dashboard sees the signed-in user.
28. As a developer, I want cross-site request forgery protection enabled, so that sign-in and the Google link flow can't be driven from another site's page.
29. As a developer, I want the new request bodies validated by shared Zod schemas, so that the API and the web forms enforce the same rules.

## Implementation Decisions

### Scope boundaries settled during design

- **No feature is gated on a verified email in this change.** The `emailVerified` flag is tracked, surfaced, and used by Google account-linking, but no route requires it yet. Gating (e.g. company creation) is a later one-line decorator decision.
- **Google "Connect from account settings" (link flow) endpoints are built, but no account-settings UI is.** Sign-in/sign-up buttons only.
- **Config validation covers all env vars, not just new ones** (fail-fast at boot).

### Shared schemas (`@repo/shared`)

- New `z.strictObject` schemas beside the existing auth schemas: `forgotPasswordSchema` (email), `resetPasswordSchema` (token + password under the sign-up password rules), `verifyEmailSchema` (token). Exported with inferred input types. The web forms and the API DTOs both import them.

### Configuration

- A Zod `validate` function wired into `ConfigModule.forRoot`, parsing the whole environment (non-strict: unrelated vars pass through), coercing `PORT`, and throwing a readable list on failure.
- Required: `PORT`, `DATABASE_URL`, `APP_URL`, `INTERNAL_API_SECRET`, the five `S3_*` vars, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Optional: `S3_FORCE_PATH_STYLE`, `SMTP_URL`, `MAIL_FROM` (with a default sender).
- `AuthenticationModule` and `MailModule` both move to `forRootAsync` reading values via `ConfigService`.

### Schema changes (Prisma 8 contract)

Three new tables, snake_case columns mapped to camelCase, following the existing contract style:

- **`identities`** — the `(provider, subject)` link to a `User`. Columns: id, userId (FK → users, `onDelete: Cascade`), provider, subject, createdAt. Unique on `(provider, subject)`; index on userId. Accounts are linked by `(provider, subject)`, never by email.
- **`email_tokens`** — backs the package's `EmailTokenStore` (both email-verification and password-reset tokens). Columns: id (SHA-256 of the token, primary key), purpose (text + CHECK: `email-verification` | `password-reset`), userId, email, fingerprint (nullable; SHA-256 of the password hash at send time, for resets), createdAt, expiresAt. Indexed to support bounded cleanup and per-user/per-purpose deletion.
- **`oidc_states`** — backs the package's `OidcStateStore` (in-flight logins). Columns: state (primary key), provider, nonce (nullable), codeVerifier, redirectTo (nullable), link info (nullable: userId + sessionId for the "connect" flow), createdAt, expiresAt.

The `users` table already has `emailVerified` (default false) and a nullable `passwordHash`; no change there. Contract regenerated (`prisma contract emit`) and applied (`prisma db update`), with snapshots committed.

### Storage sources

- `PrismaEmailTokenStore` registers `emailTokens`; `PrismaOidcStateStore` registers `oidcStates` — mirroring `PrismaSessionStore`. Single-use consume is one atomic delete-and-return so a link/callback works exactly once under concurrency; saves prune expired rows and enforce a cap to stay bounded. No `allowInMemoryStorage`.

### Users repository

New methods on the existing repository returning plain domain types (never raw ORM rows):

- `markEmailVerified(userId, email)` — one conditional update (`WHERE id = ? AND email = ?`) so a link to a changed address verifies nothing.
- `findByIdentity(provider, subject)` and `linkIdentity(userId, provider, subject)` — for the OIDC resolver.
- `findCredentials(email)` already returns the stored hash for the password-reset handler's `findUser`.

### Mail

- `MailModule.forRootAsync`: `SmtpTransport` when `SMTP_URL` is set, else `LogMailTransport` (dev prints the email with links to the log). `FileTemplateEngine` renders HTML templates from a templates directory; the directory is added to `nest-cli.json` assets (with `watchAssets`) because the TypeScript compiler doesn't copy HTML.
- Two `Mailable` classes and two templates: a verification email and a password-reset email.

### Email verification

- An `EmailVerificationHandler` registers under `emailVerification`: `send()` delivers the link via the mailer; `markVerified()` delegates to the repository's conditional update. The handler's default `isVerified()` already reads `User.emailVerified`.
- Options: `emailVerification.url` points at the web verify page.
- Sign-up sends the verification link after creating the account and signing the user in; the existing redirect to onboarding is unchanged.
- Endpoints: `POST /auth/email/verify` (public; takes a token; 400 on invalid/expired) and `POST /auth/email/verification` (signed-in resend; 202; 409 if already verified).

### Password reset

- A `PasswordResetHandler` registers under `passwordReset`: `findUser()` returns id + stored address + stored hash (the link goes to the stored address, never the typed one); `send()` delivers the link; `updatePassword()` stores the new hash.
- Options: `passwordReset.url` points at the web reset page.
- Endpoints: `POST /auth/password/forgot` (public; 202; returns before the lookup so timing and response are identical whether or not the address exists) and `POST /auth/password/reset` (public; token + new password; signs the user in on success; 400 on invalid/expired/bad-password). Reset ends the account's other sessions and marks the address verified.

### Google OIDC (backend-for-frontend integration)

- `OidcAccountResolver` (`AccountLinker`) registers under `oidc` and decides which local account a Google identity maps to:
  - Returning identity → that user.
  - Link flow (`linkTo` set) → attach to the signed-in user, refusing (conflict) if the identity already belongs to someone else.
  - First visit, Google-verified email, no local account → create a `User` with `emailVerified: true` and `name = profile.name ?? the email's local part` (the `users.name` column is NOT NULL and `profile.name` is optional), then link.
  - First visit, email matches an existing account → link only if that account is also `emailVerified`; otherwise refuse (403) and tell the user to sign in with their password and connect Google from their account. Refuse (403, `null`) when Google hasn't verified the email.
- Options: `oidc.callbackUrl` and the Google redirect URI are both the **web** origin (`${APP_URL}/auth/oidc/:provider/callback`); the `google()` preset takes the client id/secret.
- **The API's OIDC controller returns JSON `{ url, cookies }` rather than issuing an HTTP redirect**, so the session and transaction cookies are handed back instead of being set on the API origin. The login route starts the flow (optionally a link flow with `?link=true`); the callback route finishes it.
- **The web app adds two Route Handlers** at the OIDC login and callback paths that forward the browser's cookies (including the transaction cookie) to the API, relay the returned `cookies[]` onto the web origin (the same mechanism as the existing session-cookie relay), and issue the browser redirect. This preserves the invariant that the browser never calls the API and that the session cookie lives on the web origin. The clean/subtle reason this works: Set-Cookie carries no Domain, so cookies bind to whichever origin returns them.

### CSRF

- `enableCsrfProtection` is enabled with the web origin as a trusted origin. Server Actions (server-to-server, no `Origin`/`Sec-Fetch-Site`) are unaffected; OIDC login/callback are GETs (safe method). This backs the link flow's "can't be started from another site" guarantee and login-CSRF defence.

### Web surface

- Server Actions for forgot/reset/verify/resend beside the existing auth actions, re-validating with the shared schemas and relaying cookies.
- Pages: a forgot-password page, a reset-password page (reads `?token=`, redirects to dashboard on success), a verify-email page (POSTs `?token=` on mount, shows success/failure, resend for signed-in users).
- A "verify your email" reminder in the dashboard shell for unverified users, with a resend button.
- "Sign in with Google" buttons on sign-in and sign-up, linking to the web OIDC login Route Handler.

## Testing Decisions

- **What a good test is here:** it drives a unit through its public surface and asserts observable outcomes (what account a Google identity resolves to, whether linking is refused), never internal calls or private state. It uses a hand-written in-memory fake of the repository, not a database, matching the existing service-spec style.
- **Primary module under test — the OIDC account resolver (`AccountLinker`).** This is the only piece of genuine decision logic the feature adds (the verification and reset flows are the package's own services). Cover: returning identity signs in the linked user; a first-visit Google-verified email with no local account creates a user with the name fallback and links it; an email matching a verified local account links, while one matching an unverified local account is refused; an unverified Google email is refused; the link flow attaches to the signed-in user and conflicts when the identity already belongs to someone else.
- **Secondary (same fake) — `CredentialsService.register`** now that it takes a name: duplicate email conflicts, a new account is created unverified.
- **Prior art:** `apps/api/src/jobs/jobs.service.spec.ts` and `apps/api/src/applications/applications.service.spec.ts` (real service + real policies + in-memory repository fake; dummy `DATABASE_URL` from `vitest.config.ts`).
- **Package-owned stores** (`PrismaEmailTokenStore`, `PrismaOidcStateStore`): their contract is the package's, verifiable with `authenticationStoreContract()` from `@nestjs/authentication/testing` against a throwaway Postgres if we choose; not hand-written behavioural tests. Optional, not required for this spec to be done.
- No API e2e tests (the repo has none).

## Out of Scope

- Gating any route/feature on a verified email.
- Account-settings UI to connect/disconnect Google (the link-flow endpoints exist; the UI doesn't).
- Other OIDC providers (GitHub, Microsoft), magic-link sign-in, MFA/TOTP, bearer tokens / refresh tokens for a mobile app, API keys, and "manage/sign-out-everywhere" session UI — all available in the package, none in this change.
- A config-validation rollout beyond what this change needs (it validates all vars, but no broader refactor).
- Cleaning up the hardcoded `192.168.1.100` dev origins in `main.ts`/`app.module.ts` (left as-is).
- Real SMTP provider setup (dev uses the log transport; prod is a config/ops task).

## Further Notes

- Google Cloud setup is an operator task: create an OAuth client of type "Web application" and register the redirect URI `${APP_URL}/auth/oidc/google/callback` (dev and prod), then set `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`.
- New env vars must be added to `apps/api/.env` and documented in `CLAUDE.md`'s env paragraph.
- An ADR is warranted for the OIDC backend-for-frontend integration (API returns `{ url, cookies }`; web Route Handlers relay) — it's hard to reverse, surprising without context, and the result of a real trade-off against sending the browser straight to the API.
- Glossary terms worth recording: **identity** (a `(provider, subject)` link to a User), **account linking**, **account pre-hijacking**.
- `@repo/shared` must be rebuilt after the schema additions so the API's `dist/` sees them (or rely on `pnpm dev`'s watch).
