---
title: Running the auth contract suite here needs a uuid user adapter and its own vitest config
author: Yahia
date: 2026-10-29
branch: main
cost: { minutes: 9, tokens: 117081 }
id: l-b85e38ff
scope: repo
status: active
src: agent
touches:
  - apps/api/src/auth/prisma-refresh-token.store.ts
  - apps/api/src/auth/prisma-mfa.store.ts
  - apps/api/src/auth/auth.module.ts
  - docs/db-schema.md
  - apps/api/.tmp-contract/contract.spec.ts
  - apps/api/vitest.config.ts
---

## Decided
- To re-verify `PrismaRefreshTokenStore` / `PrismaMfaStore`, run `authenticationStoreContract({ contracts: ['refreshTokens','mfa'], concurrent: true })` from `@nestjs/authentication/testing` against dev Postgres. It passed 12/12 on 2026-10-29. Keep it uncommitted, as the owner chose.

## Tried and ruled out
- Running it under `apps/api/vitest.config.ts`: that config forces a dummy `DATABASE_URL` on purpose, so it can never reach the dev database. Use a separate throwaway config without the `env` override.
- Passing the suite's ids straight in: it uses `user-<uuid>` strings, but our `user_id` columns are `uuid` with an FK to `users`. The inserts fail until an adapter maps each suite id to a real temporary `users` row (and back, for `RefreshTokenRecord.userId`).

## Watch out
- The adapter must share one insert promise per suite user id. Creating the mapping before the insert finished made the parallel `recordMfaFailure` case fail with an FK violation, which looks like a store bug but is not.
- Delete the temporary users afterwards (cascade removes their tokens and MFA rows); `revoked_refresh_families` has no FK, so delete those family ids too.
