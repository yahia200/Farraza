Status: ticketed (13 tickets in `.scratch/embedding-match/issues/`, which supersede the slice list at the bottom). Written after the grilling session of 2026-11-08.

# Embedding match (candidate matching, Layer 3)

Related: the design notes (`.scratch/candidate-matching/layers.md`, Layer 3), the measurements (`.scratch/candidate-matching/layer3-embeddings-notes.md`), ADR-0008 (the `Embedder` interface and `real[]` storage), ADR-0007 (background work), the Layer 2 spec (`.scratch/keyword-match/spec.md`, whose Requirement list and versions this layer reuses), ADR-0006 (CV text), and the glossary entries **Requirement**, **CV text**, **Edit limit** and **Application limit** (`GLOSSARY.md`).

## Problem Statement

Layer 2 can tell a reviewer that a CV contains a Requirement's keywords. It cannot rank. A manager with a few hundred Applications still opens them one by one, and a CV that says "relational database administration" never matches the keyword "Postgres".

## Solution

Each Requirement's sentence and each CV are turned into vectors by an embedding model. For every scored Application the system stores a similarity per Requirement and one overall number. The Settings and candidate views show the result as **Strong / Related / Weak** per Requirement on the sheet, and the candidate table gets a **Sort by score** option. It is advisory: it never rejects, moves, flags or clears anything, and it never replaces Layer 2's "Missing must-have" marker. It measures how on-topic a CV is; it cannot prove a Requirement is met (a MySQL CV scored close to a Postgres one in testing). Past a fixed number of Applications (the **Edit limit**) a Job's Requirements can no longer be edited, which bounds how often anything has to be re-scored.

## User Stories

1. As a reviewer, I want to sort a Job's candidates by score, so that the most on-topic CVs come first.
2. As a reviewer, I want each Requirement on the sheet to read Strong, Related or Weak, so that I see which parts of a CV are on-topic.
3. As a reviewer, I want Applications that could not be scored to say so and to sort last, so that a failed read or a down service never looks like a bad candidate.
4. As a reviewer, I want to see "Scoring…" while a score is being worked out, so that I know to look again.
5. As a reviewer, I want raw numbers hidden, so that I am not misled by false precision.
6. As a reviewer, I want Layer 2's "Missing must-have" marker to stay exactly as it is, so that the exact check is never overruled by an estimate.
7. As a manager, I want to write a Requirement as just a sentence, with no keywords, so that I do not have to guess synonyms.
8. As a manager, I want a keyword-less Requirement to read "not checked" in Layer 2 and never raise a marker, so that leaving keywords out is safe.
9. As a manager, I want the editor to tell me when a Requirement has no keywords, so that I know only Layer 3 will look at it.
10. As a manager, I want to describe the skill and not the level ("Experience with PostgreSQL", not "intermediate Postgres"), with help text saying so, because the score ranks by topic and not by depth.
11. As a manager, I want Requirements to become read-only once my Job has 100 Applications, with a plain explanation, so that I know why I cannot edit them.
12. As a manager, I want an unscored Job (no Requirements) to leave "Sort by score" disabled, so that I am not offered a meaningless sort.
13. As a maintainer, I want the embedding service behind one interface, so that moving from Ollama to another provider changes one file.
14. As a maintainer, I want the scoring maths to be pure functions in `@repo/shared`, so that tests need no database or model.
15. As a maintainer, I want a failed embedding call to retry and never fail a submit, so that an applicant is never blocked by this layer.
16. As an applicant, I want scores and bands to be invisible to me, as for every other layer.

## Implementation Decisions

Decided in the grilling session unless marked *(proposed)*. Table and route names are proposals to confirm against `apps/api/prisma-8.md` and `docs/db-schema.md`.

**Shared (`@repo/shared`, pure and tested)**

- Constants, all placeholders and named: chunk size about 400 tokens with 50 tokens of overlap (measured in characters, about 4 per token, because no tokenizer runs here), `CHUNKER_VERSION`, `NICE_TO_HAVE_WEIGHT` (0.1; must-have is 1.0), `SCORE_STRONG_MIN` (0.65), `SCORE_WEAK_MAX` (0.50), and `REQUIREMENT_QUERY_INSTRUCTION` (`Instruct: Given a job requirement, retrieve resume passages that satisfy it\nQuery:`; provisional wording). **The cutoffs are urgent to test on real CVs before any label ships** (see "Out of scope" and the backlog item).
- `chunkCvText(text)`: fixed-size overlapping windows, blank windows dropped. Section-aware chunking is later, and only if the evaluation shows windows score badly.
- `scoreApplication(requirementVectors, chunkVectors, requirements)`: a Requirement's score is the best dot product over the CV's chunks; the overall number is the weighted mean over all Requirements (must-have 1.0, nice-to-have `NICE_TO_HAVE_WEIGHT`). Refuses to compare vectors of different model or length (returns an error result, never a number).
- `bandOf(score)` returns `strong` (at or above `SCORE_STRONG_MIN`), `weak` (below `SCORE_WEAK_MAX`) or `related`. No band or threshold is stored.
- `requirementSchema.keywords` changes from `.min(1)` to allow an empty list (`requirements.ts`). Stored versions stay valid. `matchRequirements` returns `matched: null` ("not checked") for a Requirement with no keywords, and `missedMustHave` ignores it.
- `REQUIREMENT_EDIT_LIMIT = 100`, one constant for every Job. When tiers arrive it becomes a per-Job value (see the backlog).

**The embedder (`apps/api`)**

- An `Embedder` interface: `embed(texts: string[], kind: 'query' | 'document'): Promise<{ vectors: number[][]; model: string; dimensions: number }>`. The Ollama implementation posts to `/api/embed` with `truncate: false`, prefixes `kind: 'query'` inputs with `REQUIREMENT_QUERY_INSTRUCTION` (documents get none), skips blank strings before the call, and fails with a clear message on an unreachable host, a non-OK status, or `embeddings.length !== input.length`.
- Configuration *(proposed)*: optional `EMBEDDING_BASE_URL` and `EMBEDDING_MODEL` in `apps/api/src/config/env.schema.ts`. Unset means Layer 3 is off: no jobs are queued, no section is shown, nothing else changes. This lets the code ship before the production embedding service is chosen.

**Database** *(proposed names)*

- `requirement_embeddings`: Job, company, version, Requirement id, model, dimensions, `vector real[]`. UNIQUE (job, version, Requirement id); written with insert-or-ignore so two workers cannot clash.
- `cv_chunk_embeddings`: Application, company, Job, chunk index, `CHUNKER_VERSION`, model, dimensions, `vector real[]`. Chunk text is not stored; it is recomputed from the CV text row. Deleted with the Application.
- `application_match_scores`: one row per Application with company, Job, Requirements version, model, `status` (`pending`, `scored`, `not_scored`), `reason` (`cv_unreadable`, `embedder_failed`, `model_changed`), a per-Requirement score object, an overall `score` for `ORDER BY`, and a time. A readable CV gets a `pending` row in the submit transaction; an unreadable one gets `not_scored` at once; no CV writes no row (as in Layer 2, nothing is shown).
- Gate: the vector columns are declared `Real[]` (= `real[]`; `Float[]` would be `float8[]`), verified in ticket 01 (ADR-0008).
- Follow the tenancy and no-FK conventions in `docs/db-schema.md` §7 and update that doc.

**Scoring flow (API)**

- Submit commits first, then enqueues one scoring job per Application, with a stable `jobId` (`score-<applicationId>`); an enqueue failure is logged and never fails the submit.
- The job: ensure the current version's Requirement vectors exist (embed any missing ones as `query`), embed the CV chunks in one call as `document`, store them, score, write the result row. Idempotent, retried with backoff (like Re-check, a restart reruns it from the start).
- A failed embed ends as `not_scored / embedder_failed`, never a low score. A configured model different from the stored vectors' model ends as `not_scored / model_changed` until an ops re-embed.
- Re-check gains a second stage *(proposed)*: the same scoring work for Applications whose row is missing or behind the Job's current version. It reuses the per-Application scoring code; the submit-time job is its own queue because it is one job per Application, not one run per Job. Only meaningful before the Edit limit, plus after a model change.

**The Edit limit**

- `PUT .../requirements` refuses a change when the Job already has `REQUIREMENT_EDIT_LIMIT` or more Applications (every Application counts, rejected ones included) with a 409 and a plain message. The Job payload carries `requirementsLocked`. The Settings tab shows the list read-only with the reason. Jobs already past the limit lock on deploy. Layer 2's stories 7 and 8 (edit on any Job status, with Re-check) now apply only below the limit; add a short note to that spec.
- The Application limit (closing the apply page) and tiers are out of scope.

**Payloads and web**

- Candidate cards and rows carry `matchScore: number | null` (the overall number, used only for sorting, never displayed) and a `matchState`. The detail carries per-Requirement bands and the state. No CV text or passage is ever returned (glossary: CV text).
- The sheet's Requirements section shows each Requirement with its Layer 2 verdict and its band beside it, "Scoring…", or "Not scored" with the reason. "Sort by score" is a table sort option, disabled when the Job has no Requirements or nothing is scored; unscored Applications sort last. While the list is unpaginated the web sorts client-side, like `highlightSortValue`; pagination is a separate backlog item and will move this to the server.
- The two layers stay independent: separate rows, separate displays, no combined score yet.

## Testing Decisions

Test through public behaviour. `@repo/shared`: the chunker (windows, overlap, blanks), `scoreApplication` (best chunk, weights, mixed model or length refused), `bandOf` at the boundaries, the keyword-optional schema and "not checked". API: service specs with the in-memory fake repository and a fake `Embedder` (submit writes a `pending` or `not_scored` row and enqueues, scoring writes scores, a failed embed ends `not_scored`, a model change ends `model_changed`, two workers embedding the same Requirement do not clash, Requirements `PUT` is refused at the limit and allowed below it, no public route returns a score). The Ollama implementation is tested against a fake `fetch` (status check, count assertion, `truncate: false`, the prefix only on queries). A manual run against local Ollama checks the real thing. Web: the sheet states and the sort.

## Out of Scope

Tiers, the Application limit and gating Layer 3 behind a higher tier (backlog); candidate-list pagination (backlog); duplicating a locked Job (backlog); a matching description or the Job description as a match target; keywords added to the embedded text; section-aware chunking; a combined Layer 2 and 3 score; Layer 4; the production embedding service; the legal review of automated ranking.

## Open items

1. **URGENT, before any label ships:** test the strong and weak cutoffs and the instruction wording on 10 to 20 real CVs (plan in the notes file).
2. Which production embedder, and whether its model and vector length differ (a re-embed, ADR-0008).
3. That Prisma 8 accepts a `Float[]` column (ADR-0008 gate).
4. Whether the Ollama model's licence allows our use (`/api/show` returned none).
5. The placeholders: chunk size, overlap, weights and the edit limit of 100.
6. Confirm the two proposals marked *(proposed)*: optional environment variables with Layer 3 off when unset, and one queue for submit-time scoring beside the extended Re-check.

## Suggested slices

1. Gate: `Float[]` column emits and applies; mark ADR-0008 verified.
2. Shared: constants, chunker, scorer, bands, optional keywords and "not checked", with tests.
3. Layer 2 follow-through: optional keywords in the editor, API and sheet.
4. The Edit limit: API refusal, `requirementsLocked`, read-only Settings tab.
5. The `Embedder` interface, the Ollama implementation and the optional environment.
6. Database tables and repositories.
7. Scoring service, queue and the submit hook.
8. Payloads: card and detail fields.
9. Web: sheet section and "Sort by score".
10. Re-check second stage.
11. Ops re-embed for a model change.
12. Real-CV cutoff testing and a docs sweep.
