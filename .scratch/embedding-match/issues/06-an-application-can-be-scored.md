# 06: An Application can be scored

**What to build:** The core of Layer 3 on the server. Given an Application with readable CV text, a scoring service embeds what is missing, stores the vectors, and writes the Application's scores. Failures end as "not scored" with a reason, never a low score. Nothing is queued yet; the service is called directly by specs and by one manual run. Spec: `.scratch/candidate-matching/layer3-spec.md` ("Database", "Scoring flow"); ADR-0008.

- Three tables, following the tenancy and no-foreign-key conventions in `docs/db-schema.md` (section 7), whose names are proposals to confirm: Requirement vectors (per Job, version and Requirement id, unique, written insert-or-ignore so two workers cannot clash), CV chunk vectors (per Application and chunk index, with the chunker version, deleted with the Application; chunk text is not stored, it is recomputed from the CV text), and one match-score row per Application (status pending, scored or not scored; a reason; the Requirements version; the model; a per-Requirement score; the overall number).
- Every vector is stored with its model id and length. The service ensures the current version's Requirement vectors exist (embedding any missing ones as queries), embeds the CV chunks in one call as documents, and scores with the shared logic.
- An unreadable CV, a failed embed, and a configured model that differs from the stored vectors' model end as not scored with the reasons CV unreadable, embedder failed and model changed. A missing CV writes no row. A Job with no Requirements writes nothing to score.
- Update `docs/db-schema.md` and the contract emit (`pnpm --filter api exec prisma contract emit`, then `prisma db update`).

**Blocked by:** 01 (Float[] column gate), 02 (scoring maths), 03 (embedder).

**Status:** resolved

- [x] Service specs with the in-memory fake repository and a fake embedder cover: a scored Application, an unreadable CV, a failed embed, a model change, a Job with no Requirements, and a missing CV
- [x] Two scoring runs for the same Job and version do not duplicate Requirement vectors and do not fail
- [x] Scoring the same Application twice replaces its row and does not duplicate chunk vectors
- [x] One manual run against local Ollama and the dev database produces a scored row with a sensible overall number
- [x] `docs/db-schema.md` documents the three tables, and the contract is re-emitted and committed
- [x] `pnpm lint`, `pnpm check-types` and `pnpm --filter api test` pass

## Answer

Built test-first on branch `worktree-agent-a94de2e3e6ee7d6e8` (commit: see `git log`, subject `feat(api): score an Application with the embedding match`).

**What exists** (`apps/api/src/embedding-match/`): `EmbeddingMatchService.score({ companyId, jobId, applicationId })`, `EmbeddingMatchRepository`, domain types, `EmbeddingMatchModule` (not imported by `AppModule` yet: ticket 07 does that), and 17 service specs (fake repository that keeps UNIQUE and insert-or-ignore semantics, fake `Embedder` with hand-worked 3-d vectors). Three tables in the contract: `requirement_embeddings`, `cv_chunk_embeddings`, `application_match_scores` (`docs/db-schema.md` 3.25 to 3.27, 4.7, section 7). Vector columns are `Real[]`.

**Decisions** (the agent's own; the owner may overrule)
1. Table names are the spec's proposals, unchanged. Enums `MatchScoreStatus` and `MatchScoreReason`; `score` is `Float?` (double) beside a `scores` jsonb. The index on `(job_id, requirements_version)` needed an explicit `map:` name, because the default is over Prisma's 54-byte limit (`CONTRACT.SOURCE_LOAD_FAILED`).
2. Foreign keys: company, job and (for chunks and scores) application are FKs with ON DELETE CASCADE, like `application_requirement_results`. `version` and `requirement_id` have no FK (a JSONB list and an immutable version row), as in `docs/db-schema.md` section 7.
3. Insert-or-ignore is `createAndCount(rows, { onConflict: 'skip', conflictOn: [...] })` (documented in `@prisma/orm-family-sql` `orm-client.d.mts`, `CreateConflictOptions`), and after writing the service reads every Requirement vector back, so a run that lost the race scores with the winner's vectors.
4. Outcomes the ticket did not name: `disabled` (embedder null), `no_requirements` and `no_cv` write nothing. The Requirements check comes before the CV check, so a Job with no Requirements never gets an `cv_unreadable` row.
5. A CV text with status `failed` ("not read") is `not_scored / cv_unreadable`, like `unreadable`; there is no separate reason.
6. `embedder_failed` is returned, not thrown: only `EmbedderError` is caught (plus a wrong vector count or a vector not `dimensions` long, which the service turns into one). Any other error propagates so the future queue retries it. Ticket 07 decides whether `embedder_failed` should also rethrow for a retry.
7. A model or length change is detected by `scoreApplication` (`model_mismatch`/`length_mismatch`) after the CV is embedded; the stored `model` of that row is the embedder's current model, and the chunk vectors are still stored.
8. `findCurrentRequirements` is repeated in `EmbeddingMatchRepository` (it is five lines, and `RecheckRepository` lives in a module that pulls in BullMQ).
9. The length is checked in the service on write only; stored rows are not re-checked on read (`scoreApplication` refuses mixed lengths anyway).

**Verified**: `pnpm --filter api test` 564 passed (24 files); `npx tsc --noEmit` in `apps/api` clean; `pnpm check-types` and root `pnpm lint` pass (only old warnings). `prisma db update` against the scratch database created the three tables; `prisma db verify --strict` exits 0.

**Manual run** (throwaway `.mjs` over the built `dist/`, deleted; scratch database `layer3_gate_01`, Ollama `qwen3-embedding:0.6b`): one Job with "Experience with PostgreSQL" (must) and "Experience with React" (nice), a Postgres-DBA CV and a watercolour-painter CV. Scored concurrently and then again: both `scored`, 2 requirement rows, 2 chunk rows, 2 score rows (nothing duplicated, nothing failed). DBA overall 0.651 (PostgreSQL 0.675, React 0.411); painter overall 0.249 (0.240 and 0.332). Stored vectors 1,024 long; the stored PostgreSQL vector equalled a fresh embedding in all 1,024 elements after `Math.fround`. Changing the stored model and scoring again gave `not_scored / model_changed` and the row passed the CHECKs.

**Open / needs the owner**: apply the schema to the dev database yourself (`pnpm --filter api exec prisma db update`). The cutoffs and weights are still placeholders (ticket 12): in the run the DBA's React score was 0.41 ("related") for a CV that never mentions React, which shows why they need testing on real CVs.
