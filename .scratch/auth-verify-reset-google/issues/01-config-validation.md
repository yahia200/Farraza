# 01: Fail-fast environment validation

**What to build:** The API validates its environment at startup and refuses to boot, printing a readable list of problems, when any required variable is missing or malformed. No behaviour changes for a correctly configured app. This is the shared prefactor the auth features build on — each later ticket adds its own variables to the same schema.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] A Zod-based `validate` function is wired into `ConfigModule.forRoot`, parsing the whole environment non-strictly (unrelated variables pass through untouched) and coercing `PORT` to a number.
- [x] Validation covers the currently-used variables: `PORT`, `DATABASE_URL`, `APP_URL` (a URL), `INTERNAL_API_SECRET` (minimum length), the five `S3_*` variables, and optional `S3_FORCE_PATH_STYLE`.
- [x] A missing or malformed variable stops boot with a message naming each offending variable; a valid environment boots exactly as before.
- [x] `AuthenticationModule` reads its values through the injected `ConfigService` (async factory), ready for later tickets to extend.
- [x] `pnpm --filter api build`, lint, and type-check pass.

## Comments

**2026-10-19 (scope change, owner-approved):** this ticket also takes the spec's whole "DB" step, so 02 and 04 can run in parallel without both regenerating the Prisma contract. Add all three tables (`identities`, `email_tokens`, `oidc_states`) to `contract.prisma` exactly as the spec's "Schema changes" section describes, emit the contract, apply it with `prisma db update`, and commit the contract files and migration snapshots. Stores and repository methods stay in 02/04. The env schema draft (`apps/api/src/config/env.schema.ts`) and the shared schemas (`packages/shared/src/auth.ts`) were already written by the owner and committed as the integration branch's first commit; build on them.
