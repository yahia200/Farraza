# 01: Queue infrastructure spike (BullMQ on Postgres)

**What to build:** Install and wire `@nestjs/bullmq`, `bullmq` and `pg` in `apps/api` with the PostgreSQL backend (ADR-0007), and prove it works end to end with one trivial queue and processor. No feature code. Spec: `.scratch/keyword-match/spec.md` ("API", "Open items").

- Read the installed `.d.ts` files first (`createPostgresBackend`, the `backendFactory` queue option) and name the doc paths in the PR.
- The queue connects with the API's existing `DATABASE_URL`; the `bullmq` schema is created and migrated by BullMQ at boot.
- A throwaway job enqueued from a test route or script is processed, reports progress and survives an API restart.
- `prisma db update` and `prisma db verify` leave the `bullmq` schema alone. If either fails, stop and report: ADR-0007 falls back to a run-row design.
- Record the Cloud Run CPU-always-allocated answer from the owner in ADR-0007.

**Blocked by:** none.

**Status:** resolved

- [x] The three gates in ADR-0007 are checked and the result written into the ADR
- [x] The throwaway queue is removed or kept as the Re-check queue skeleton, not left as dead code
- [x] `docs/db-schema.md` notes the external `bullmq` schema
- [x] `.claude/rules/api.md` and the CLAUDE.md doc table list the new packages
- [x] `pnpm lint`, `pnpm check-types` and `pnpm --filter api test` pass

## Answer

Done (commit 131423c). All three ADR-0007 gates passed on a fresh database; results and the differences from the ADR's assumptions (`setDefaultBackendFactory`, `migrate: true`, an options type that only models Redis) are written into `docs/adr/0007-background-work-on-bullmq-over-postgres.md`. **Still open for the owner:** whether the Cloud Run API service has CPU always allocated.
