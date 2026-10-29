---
title: Refresh-token and MFA stores ship with no committed tests; the production storage guard is why they exist
author: Yahia
date: 2026-10-29
branch: main
cost: { minutes: 11, tokens: 114559 }
id: l-edb8abda
scope: repo
status: active
src: agent
touches:
  - ".scratch/auth-token-stores/spec.md"
  - apps/api/src/auth/prisma-session.store.ts
  - apps/api/src/auth/prisma-email-token.store.ts
  - apps/api/src/auth/auth.module.ts
  - apps/api/src/app.module.ts
---

## Decided
- `PrismaRefreshTokenStore` and `PrismaMfaStore` (spec: `.scratch/auth-token-stores/spec.md`) exist because `@nestjs/authentication` refuses to boot in production while a contract a configured feature uses has no registered source. `SessionAuth` (a SessionCookieProvider) and `passwordReset` both need `sessions`, `refreshTokens` and `mfa`; only sessions, emailTokens and oidcStates had Prisma stores. `accessToken` and `mfa` stay unconfigured in `app.module.ts`: stores only, no endpoints or UI.
- The owner chose no committed tests. Verification is a one-off run of `authenticationStoreContract({ concurrent: true })` from `@nestjs/authentication/testing` against dev Postgres, as an uncommitted script in the scratchpad, plus check-types and lint. The default `pnpm test` stays DB-free.
- Raw SQL (`db.raw.sql`) only for `saveTotp` (GREATEST in the upsert), `revokeRefreshTokenFamily` and `revokeUserRefreshTokens` (insert-select). Everything else uses ORM conditional writes, as in `prisma-session.store.ts`.

## Tried and ruled out
- `allowInMemoryStorage: true`: loses refresh families and MFA lockout counters on restart and breaks with more than one instance.
- Committing the contract suite as a `test:db` script: the owner declined it, so do not add it unasked.
- A hand-written in-memory fake like the repository specs: the SQL is what is under test, so a fake would only test the fake.
- Wrapping `recordMfaFailure` in a transaction: it hides the new row from parallel callers until commit, which breaks the contract's "record first, count second" visibility rule.

## Watch out
- Nothing in the repo guards the atomic-write rules after delivery. If the package's store contracts change on upgrade, rerun its contract suite by hand.
- `revokeRefreshTokenFamily` is the only place the database clock is used (a 1-year fallback expiry when the family has no stored token), because the method receives no timestamp.
