# 10: Sort by score

**What to build:** The candidate table gets a "Sort by score" option that puts the most on-topic CVs first. Spec: `.scratch/candidate-matching/layer3-spec.md` (stories 1, 3 and 12).

- The option sorts by the overall score, highest first. Applications that are not scored, or have no score, sort last; ties keep the table's existing order.
- It is disabled, with a short reason, when the Job has no Requirements or nothing is scored yet.
- While the list is unpaginated the web app sorts what it already has, the way the highlighted-question sort does (`highlightSortValue` in `@repo/shared`). Candidate-list pagination is a separate backlog item and will move this sort to the server; leave a note where that will matter.
- The raw score is used for ordering only and is never displayed.

**Blocked by:** 08 (scores in the payloads).

**Status:** resolved

- [x] The sort orders scored Applications by score, puts unscored ones last, and is stable for ties (pure-function tests)
- [ ] The option is disabled with no Requirements and with nothing scored, checked in a browser
- [x] Sorting does not change the board; it applies to the table only
- [x] `apps/web` lint and type checks pass (`pnpm lint`, `pnpm check-types`)

## Answer

Built on branch `worktree-agent-af1245478cc695126` (subject `feat(web): sort the candidate table by score`). The browser checkbox stays unticked (no browser was allowed in this run; the steps are under "Needs the owner"), and every other box is ticked.

**What it is**
- `@repo/shared` `match-sort.ts` (tests first, `match-sort.test.ts`): `matchSortValue(row)` (the number only when `matchState.status` is `scored`, else `undefined`), `compareMatchSort(a, b)` (highest first, no score last, equal values `0`) and `matchSortAvailability(requirementCount, rows)` (`{ enabled: true }` or `{ enabled: false, reason }`, no Requirements first, then nothing scored).
- The table (`candidates-table.tsx`) gets a "Sort by score" `Toggle` beside the stage filter, disabled with the reason written next to it (`aria-describedby`). The page passes `job.requirements.length`. The board is untouched.
- The sort goes through a hidden `matchScore` column (`columns.tsx`) that has `matchSortValue` as its accessor and `compareMatchSort` as its `sortFn`. The toggle sets the sorting to `[{ matchScore }, { submittedAt, desc }]`; off sets back to `[{ submittedAt, desc }]`. A tie falls to the Applied date (newest first, the table's existing order), then the row's original index, so ties stay stable. Clicking another header replaces the sorting, and the toggle reads off by itself.
- Hiding needs `columnVisibilityFeature`, so `DataTable` now renders `getVisibleCells()` and counts `getVisibleLeafColumns()` when the table has them (falls back to the all-column calls, so the members and jobs tables are unchanged).
- The pagination note is in the `CandidatesTable` doc comment and the header of `match-sort.ts`.

**Decisions** (the owner may overrule)
1. Hidden sort column plus `columnVisibilityFeature` (and the small `DataTable` change), over pre-sorting `data` and clearing the table's sorting: the pre-sort approach has to track "which sort is active" by hand and the header sorts would fight it.
2. `compareMatchSort` as the column's `sortFn` and `desc: false` ("best first" is the column's own order), over the Rating column's `sortUndefined: 'last'` plus `desc: true`: it makes the ordering a pure, tested function.
3. A `Toggle` with the reason as visible text, not a tooltip: a disabled button takes no hover or focus.
4. Availability looks at all loaded rows, not the stage-filtered ones.

**Verified**: `pnpm --filter @repo/shared test` 789 passed; `pnpm lint` 0 errors (two old warnings in files this ticket does not touch); `pnpm check-types` and `npx tsc --noEmit` in `apps/web` clean. A throwaway Node script (deleted) built the real TanStack table (features and columns as in the app, store reactivity bindings) and checked: default order newest first `fbdcea`; with the score sort `ecafbd` (0.9, then the two 0.5 ties newest first, then 0.1, then the two unscored newest first); `getVisibleLeafColumns` leaves `matchScore` out.

**Needs the owner** (browser, local stack: docker compose, API and web dev servers, Ollama; a Job with at least two Requirements and a few scored Applications)
1. Open the Job's Candidates tab in the table view. With the Job having no Requirements: "Sort by score" is greyed with "Add Requirements in Settings to sort by score." beside it.
2. With Requirements but no Application scored yet (before the worker finishes, or with Ollama stopped): greyed with "No candidate has a score yet."
3. With scored Applications: the toggle is enabled; pressing it puts the highest first, unscored (Scoring, could not be scored) last, and ties newest first. No number appears anywhere in the table or in the page source.
4. Click the Candidate or Applied header while the toggle is on: the toggle turns off and that header sorts. Turn it on again: the order returns.
5. Switch to the board (`?view=board`): the toggle is not there and the card order is unchanged.
6. At 375px the toggle and the reason wrap under the stage filter with no horizontal scroll.
