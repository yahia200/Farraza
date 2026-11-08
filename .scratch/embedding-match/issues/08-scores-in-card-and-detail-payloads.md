# 08: Scores in the card and detail payloads

**What to build:** The API tells the web app what it needs to show and sort scores, and nothing more. Cards and rows carry the overall number and a state; the detail carries a band per Requirement and the state. CV text and passages never leave the server. Spec: `.scratch/candidate-matching/layer3-spec.md` ("Payloads and web"); glossary: **CV text**.

- Each card and table row carries the overall score (used only for sorting, never displayed) and a state: scoring, scored, or not scored with its reason. An Application with no score row reads as no state.
- The detail carries, per Requirement of the version it was scored against, its band (strong, related or weak, from the shared `bandOf`) and the state. Bands are computed on read from the stored scores; no threshold is stored.
- Read the scores for a whole board or list in one query, never one per card, as the ratings and markers already do.
- Members only, interviewers included, like the other read payloads. The public routes return none of it, and a spec pins that.

**Blocked by:** 06 (an Application can be scored).

**Status:** resolved

- [x] Card, row and detail payloads carry the new fields and are covered by service specs, including an Application with no row and one not scored
- [x] The detail never contains CV text, a chunk, or a raw per-Requirement score; the card carries only the overall number
- [x] One extra query serves a whole board, checked in a spec with a counting fake
- [x] A spec shows no public route returns a score, a band or a state
- [x] `docs/db-schema.md` and `.claude/rules/api.md` describe the new payload fields
- [x] `pnpm lint`, `pnpm check-types` and `pnpm --filter api test` pass

## Answer

Built on branch `worktree-agent-adb151c73da385ba7` (subject `feat(pipeline): add embedding match to card and detail payloads`). Service specs were written before the code; the red run was not observed because dependencies were still installing, so specs and code went green together.

**Shape** (`apps/api/src/pipeline/pipeline.ts`)
- Card: `matchScore: number | null` (the overall number, only when `scored`) and `matchState: MatchState | null`. `MatchState` is `{ status: 'scoring' }`, `{ status: 'scored' }` or `{ status: 'not_scored', reason }`. A stored `pending` row reads `scoring`. No row reads `matchScore: null, matchState: null`.
- Detail: `embeddingMatch: { version, state, requirements: [{ id, text, tier, band }] } | null`. Text and tier are those of the version the row was scored against (looked up like `requirementCheck`). `band` comes from `bandOf` on read and is null unless `scored` (and for a Requirement with no stored score). The detail does not carry the overall number, any raw score, vector, chunk or CV text.

**Decisions** (the ticket left them open; the owner may overrule)
1. The pipeline repository reads `application_match_scores` itself (`findMatchScores`, `findEmbeddingMatch`), as it already does for `application_requirement_results`, so `PipelineModule` does not import `EmbeddingMatchModule` (ticket 07 wires that).
2. Board: ONE `findMatchScores(companyId, jobId)` in the same `Promise.all` as the ratings and marker, selecting only `applicationId, status, reason, score`. Skipped with no Applications.
3. The detail does not gate on `cvState`; a `not_scored / cv_unreadable` row is shown as stored.
4. `pending` is named `scoring` in the payload, matching the spec wording.

**Verified**: `pnpm --filter api test` 581 passed (24 files); `npx tsc --noEmit` clean in `apps/api` and `apps/web`; `pnpm lint` 0 errors (two old web warnings); `pnpm check-types` passes. The real SQL was run against the scratch database `layer3_gate_01` through the built repository: `findMatchScores` returned both existing rows (and none for another company), `findDetail` returned the row with its Requirements.

**Docs**: `docs/db-schema.md` §3.27 and `.claude/rules/api.md` ("Embedding match on the board and detail"). Web types only (`MatchStateView`, `EmbeddingMatchDetailView` in `apps/web/lib/dal.ts`); the UI is tickets 09 and 10.
