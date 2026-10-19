# 02: Email verification

**What to build:** A person who signs up receives an email with a link that proves they own the address; opening the page the link points at marks their address verified. A signed-in user whose address isn't verified sees a reminder in the dashboard with a working "resend", and an expired or lost link can be re-requested. No feature is gated on verification yet. This ticket stands up the shared mail and email-token infrastructure that password reset later reuses.

**Blocked by:** 01 (extends the env schema it introduced).

**Status:** ready-for-agent

- [ ] A new `email_tokens` table (Prisma 8 contract) backs a `PrismaEmailTokenStore` registered as the `emailTokens` source, with atomic single-use consume so a link works exactly once, and bounded growth (expired rows pruned on save). Contract emitted and applied; snapshots committed.
- [ ] Mail is sent through `MailModule` (async factory): `SmtpTransport` when `SMTP_URL` is set, otherwise the log transport in development; HTML templates render via `FileTemplateEngine`, and the templates directory is added to `nest-cli.json` assets. `MAIL_FROM` and optional `SMTP_URL` are added to the env schema.
- [ ] Signing up creates the account, signs the user in, sends a verification link, and still redirects to onboarding (existing behaviour unchanged).
- [ ] `POST /api/auth/email/verify` (public) accepts a token and marks the address verified only while it is still the user's address; an invalid, used, expired, or stale-address token returns 400.
- [ ] `POST /api/auth/email/verification` (signed-in) resends to the current address, returns 202, returns 409 if already verified, and is rate-limited to 5 per 10 minutes per visitor.
- [ ] The web app has a verify-email page that POSTs the token from its URL on load and shows success/failure, a resend affordance for signed-in unverified users, and a dashboard reminder banner for unverified users.
- [ ] A `verifyEmail` shared Zod schema in `@repo/shared` is used by both the API DTO and the web action.
- [ ] Build, lint, and type-check pass across the touched packages.

## Comments

**2026-10-19:** the `email_tokens` table is created by ticket 01 (scope change). This ticket writes the store against it and doesn't touch `contract.prisma`. The `verifyEmailSchema` shared schema already exists.
