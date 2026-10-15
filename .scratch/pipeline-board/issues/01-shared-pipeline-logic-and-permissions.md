# 01: Shared pipeline logic + permissions

**What to build:** The pure, tested domain logic the rest of the feature relies on, in `@repo/shared`. This is a prefactor: no user-facing change on its own, but it is the single test seam for the feature and everything else imports from it.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] `canMoveApplications(role)` added to `packages/shared/src/members.ts`: true for every role except `interviewer`, mirroring the API's `ApplicationPolicy`.
- [x] A new `packages/shared/src/pipeline.ts` exports `statusForStageKind(kind)` mapping `normal → active`, `hired → hired`, `rejected → rejected`.
- [x] `pipeline.ts` exports `applyMove(columns, applicationId, toStageId)`: returns new columns with the card moved to `toStageId` and its status recomputed via `statusForStageKind`; returns the input unchanged (no-op) when the card is already in `toStageId`.
- [x] `pipeline.ts` exports `buildActivityTimeline(events, notes)`: one chronologically ordered list, resolving each `note_added` event to its note body (events carry only `{ noteId }`); a `note_added` whose note is missing is handled without throwing.
- [x] New symbols are exported from `packages/shared/src/index.ts`.
- [x] `canMoveApplications` is tested in `members.test.ts` across all four roles; `statusForStageKind`, `applyMove` (cross-stage move, status recompute, same-column no-op), and `buildActivityTimeline` (ordering + note-body resolution incl. missing note) are tested in a new `pipeline.test.ts`.
- [x] `pnpm --filter @repo/shared test` and `pnpm --filter @repo/shared build` pass.

## Comments

Resolved on integration branch `feat/pipeline-board`: merge 47cee81 (feat b3ebdd5). Follow-up review fixes: merge 766f0b7.

Browser checks n/a (pure logic). 88 shared tests pass.
