---
title: "Board card call/email actions must be siblings of the card Link, not inside it"
author: Yahia
date: 2026-10-28
branch: main
cost: { minutes: 20, tokens: 260876 }
id: l-af530caa
scope: repo
status: active
src: agent
touches:
  - apps/api/tsconfig.build.tsbuildinfo
  - apps/api/src/pipeline/pipeline.board.spec.ts
  - apps/api/src/pipeline/pipeline.repository.ts
  - apps/api/src/pipeline/pipeline.ts
  - apps/web/components/dashboard/candidates/candidate-card.tsx
  - apps/web/components/dashboard/candidates/columns.tsx
  - apps/web/components/dashboard/candidates/contact-actions.tsx
  - apps/web/lib/dal.ts
  - ".scratch/ratings/issues/01-rating-rules-in-shared.md"
  - ".scratch/ratings/issues/02-job-stores-and-saves-rating-criteria.md"
---

## Decided
In apps/web/components/dashboard/candidates/candidate-card.tsx the ContactActions (tel:/mailto: icons) sit beside the card's Link, absolutely positioned in the top-right corner (card is `relative`, name has `pr-14`). A click on them must not open the detail sheet.

## Tried and ruled out
Putting ContactActions inside the Link (in the name row): the click bubbles to the Link and opens the sheet, and it nests anchors, which is invalid HTML.

## Watch out
Anything interactive on the card (Move select, contact icons) must stay outside the Link, which is also the drag handle. Same rule as the existing Move select.
