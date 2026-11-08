# 01: Float[] column gate (Prisma 8)

**What to build:** Prove that Prisma 8 can store a vector as a plain `real[]` column, before any Layer 3 table depends on it. A throwaway column is emitted into the contract, applied to the dev database, written and read back, then removed. The result decides whether ADR-0008 stands or falls back to `jsonb`. Spec: `.scratch/candidate-matching/layer3-spec.md` ("Database"); ADR-0008 ("Gate before this is relied on").

- Read the Prisma 8 contract reference for scalar lists first (`apps/api/node_modules/@prisma/orm-postgres/skills/prisma-8/references/contract.md`, the note on scalar lists) and name the doc path in the commit message. The reference shows `String[]`; this ticket confirms `Float[]` specifically.
- Check the column type that lands in Postgres, whether a 1,024-element vector round-trips exactly through the ORM (`db.orm`), and that `prisma db update` and `prisma db verify` (also `--strict`) both pass.
- If Prisma refuses `Float[]` or loses precision, stop and report: ADR-0008's storage part is superseded by `jsonb`, and every later ticket uses that.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] A `Float[]` column emits, applies, and round-trips a 1,024-element vector without loss (`Float[]` is `float8[]`: bit-exact; `Real[]` is `float4[]`, the `real[]` of ADR-0008: exact at single precision, see the Answer)
- [x] `prisma db update`, `prisma db verify` and `prisma db verify --strict` pass with it
- [x] The throwaway column is removed again, or kept only if ticket 06 will use it unchanged
- [x] ADR-0008 records the result (verified, or superseded with the `jsonb` fallback)
- [x] `pnpm lint`, `pnpm check-types` and `pnpm --filter api test` pass

## Answer

Gate PASSED. Commit: see `git log` for the `docs(db)` commit that touches this file.

- Decision: the column type is spelled **`Real[]`** in the contract. `Float[]` lowers to `float8[]` (double precision); `Real[]` lowers to `float4[]` = `real[]`, which is what ADR-0008 decides. Tickets 06 and later declare `vector Real[]`. Backed by the emitted DDL of `prisma db update --dry-run` and `apps/api/node_modules/@prisma/orm-postgres/skills/prisma-8/references/contract.md` (scalar lists).
- Evidence (scratch database, since dropped or to be dropped, see open items): `information_schema` showed `_float8` and `_float4`; `db.orm` write and read of 1,024 elements: `float8[]` 0 of 1,024 mismatches; `float4[]` reads back the shortest decimal (max difference from the input 3.6e-9) and is bit-identical after `Math.fround`; `prisma db update`, `db verify`, `db verify --strict` all exit 0; NULL elements are refused by a generated CHECK; empty arrays are accepted.
- The throwaway model was removed; `contract.prisma`, `contract.json`, `contract.d.ts`, `migrations/app/refs/db.json` and `migrations/snapshots/` are at the base state (storage hash `3bbe7e5e...`).
- Open items: (1) the scratch database `layer3_gate_01` could not be dropped by the agent because a pre-tool hook blocks the literal `DROP DATABASE`; the owner runs `docker exec farraza-db-1 psql -U hiring -d postgres -c "DROP DATABASE layer3_gate_01"`. (2) The wrong-length vector is not rejected by the database; tickets 03 and 06 check `dimensions`. (3) A test comparing stored vectors should compare through `Math.fround`.
