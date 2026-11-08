# 01: Float[] column gate (Prisma 8)

**What to build:** Prove that Prisma 8 can store a vector as a plain `real[]` column, before any Layer 3 table depends on it. A throwaway column is emitted into the contract, applied to the dev database, written and read back, then removed. The result decides whether ADR-0008 stands or falls back to `jsonb`. Spec: `.scratch/candidate-matching/layer3-spec.md` ("Database"); ADR-0008 ("Gate before this is relied on").

- Read the Prisma 8 contract reference for scalar lists first (`apps/api/node_modules/@prisma/orm-postgres/skills/prisma-8/references/contract.md`, the note on scalar lists) and name the doc path in the commit message. The reference shows `String[]`; this ticket confirms `Float[]` specifically.
- Check the column type that lands in Postgres, whether a 1,024-element vector round-trips exactly through the ORM (`db.orm`), and that `prisma db update` and `prisma db verify` (also `--strict`) both pass.
- If Prisma refuses `Float[]` or loses precision, stop and report: ADR-0008's storage part is superseded by `jsonb`, and every later ticket uses that.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A `Float[]` column emits, applies, and round-trips a 1,024-element vector without loss
- [ ] `prisma db update`, `prisma db verify` and `prisma db verify --strict` pass with it
- [ ] The throwaway column is removed again, or kept only if ticket 06 will use it unchanged
- [ ] ADR-0008 records the result (verified, or superseded with the `jsonb` fallback)
- [ ] `pnpm lint`, `pnpm check-types` and `pnpm --filter api test` pass
