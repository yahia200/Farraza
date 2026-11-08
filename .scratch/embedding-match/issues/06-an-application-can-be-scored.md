# 06: An Application can be scored

**What to build:** The core of Layer 3 on the server. Given an Application with readable CV text, a scoring service embeds what is missing, stores the vectors, and writes the Application's scores. Failures end as "not scored" with a reason, never a low score. Nothing is queued yet; the service is called directly by specs and by one manual run. Spec: `.scratch/candidate-matching/layer3-spec.md` ("Database", "Scoring flow"); ADR-0008.

- Three tables, following the tenancy and no-foreign-key conventions in `docs/db-schema.md` (section 7), whose names are proposals to confirm: Requirement vectors (per Job, version and Requirement id, unique, written insert-or-ignore so two workers cannot clash), CV chunk vectors (per Application and chunk index, with the chunker version, deleted with the Application; chunk text is not stored, it is recomputed from the CV text), and one match-score row per Application (status pending, scored or not scored; a reason; the Requirements version; the model; a per-Requirement score; the overall number).
- Every vector is stored with its model id and length. The service ensures the current version's Requirement vectors exist (embedding any missing ones as queries), embeds the CV chunks in one call as documents, and scores with the shared logic.
- An unreadable CV, a failed embed, and a configured model that differs from the stored vectors' model end as not scored with the reasons CV unreadable, embedder failed and model changed. A missing CV writes no row. A Job with no Requirements writes nothing to score.
- Update `docs/db-schema.md` and the contract emit (`pnpm --filter api exec prisma contract emit`, then `prisma db update`).

**Blocked by:** 01 (Float[] column gate), 02 (scoring maths), 03 (embedder).

**Status:** ready-for-agent

- [ ] Service specs with the in-memory fake repository and a fake embedder cover: a scored Application, an unreadable CV, a failed embed, a model change, a Job with no Requirements, and a missing CV
- [ ] Two scoring runs for the same Job and version do not duplicate Requirement vectors and do not fail
- [ ] Scoring the same Application twice replaces its row and does not duplicate chunk vectors
- [ ] One manual run against local Ollama and the dev database produces a scored row with a sensible overall number
- [ ] `docs/db-schema.md` documents the three tables, and the contract is re-emitted and committed
- [ ] `pnpm lint`, `pnpm check-types` and `pnpm --filter api test` pass
