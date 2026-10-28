---
title: "/implement-spec: owner's uncommitted edits in the main folder block merges; stash only that path, merge, pop"
author: Yahia
date: 2026-10-28
branch: feat/ratings
cost: { minutes: 55, tokens: 183765 }
id: l-c4daaf78
scope: repo
status: active
src: agent
touches:
  - apps/api/src/pipeline/pipeline.repository.ts
  - ".scratch/ratings/issues/07-list-and-board-show-average-rating.md"
  - apps/web/components/dashboard/candidates/average-rating-label.tsx
  - apps/web/components/dashboard/candidates/candidate-card.tsx
  - apps/web/components/dashboard/candidates/columns.tsx
  - apps/web/lib/dal.ts
  - apps/api/src/pipeline/pipeline.board.spec.ts
  - apps/api/src/pipeline/pipeline.service.ts
  - apps/api/src/pipeline/pipeline.ts
  - ".scratch/ratings/issues/04-detail-carries-ratings-and-summary.md"
---

## Decided
- During the ratings run the owner kept editing files in the main folder (`apps/web/components/ui/dialog.tsx`, `alert-dialog.tsx`, `sheet.tsx`, then `apps/web/components/dashboard/candidates/columns.tsx`). The integration branch `feat/ratings` is checked out there, so `git merge` refuses whenever an incoming branch touches one of those files.
- For `columns.tsx` (ticket 07 adds a Rating column, the owner's edit removes the Status column) the owner chose: stash only that path, merge, `git stash pop`, resolve the doc-comment/import conflicts by keeping both. The owner's edit stays uncommitted on top of the merged file. Done by a merger subagent after saving a backup copy and a diff of the file to the scratchpad.
- Other tickets are told not to touch the owner's dirty files at all (they are listed in each implementer prompt), and the merger checks `git diff --name-only <integration>...<branch>` for overlap before merging.

## Tried and ruled out
- Committing the owner's `columns.tsx` edit to the integration branch first: offered, not chosen, because it would put the owner's unfinished product decision (dropping the Status column) into the feature branch history.
- Having the owner resolve it by hand and re-run the merge: offered, not chosen.

## Watch out
- The owner's dirty file list changes during a run (it was 3 files at the start, 5 by ticket 07). Re-run `git status --short` before each merge instead of trusting an earlier list.
- Removing the Status column leaves `ApplicationStatusBadge` unused in `candidate-card.tsx`, which shows up as a lint warning that is not a ratings regression.
- A merger subagent once returned the literal text "placeholder" as its report; always check `git log` and `git status` yourself after a merge.
