---
title: "Highlighted-question sorting: send the raw typed answer once, parse in Next.js; no second sort-key field"
author: Yahia
date: 2026-10-28
branch: feat/ratings
cost: { minutes: 15, tokens: 35081 }
id: l-1882549e
scope: repo
status: active
src: agent
touches:
  - apps/web/components/dashboard/candidates/columns.tsx
  - ".scratch/highlighted-questions/spec.md"
  - packages/shared/src/dates.ts
---

## Decided
Sorting highlighted questions in the candidates table (apps/web/components/dashboard/candidates/columns.tsx) reverses the "Out of Scope" line in .scratch/highlighted-questions/spec.md. The owner rejected a separate `highlightSorts` payload next to the display `highlights` (the same value sent twice). The API sends the raw, typed answer once and Next.js does the formatting and sorting. Dates are safe to format in the web app: formatIsoDate in packages/shared/src/dates.ts uses a fixed en-US locale and Temporal.PlainDate, so server and browser match.

## Tried and ruled out
- `highlightSortKey` plus `highlightSorts: Record<key, number | string | null>` beside `highlights`: dropped because it duplicates the value in the payload.
- A bare raw value: a `string` can't tell a date from text, so a type tag per value was proposed (not yet confirmed by the owner).

## Watch out
Selects: the raw answer is an option id, and the label lives in the Application's own form version (pipeline.service.ts `cardsOf`), which the web app does not have. Resolving ids in the web app would show "Unknown option" for older versions, so the API must keep resolving select labels. The board card (candidate-card.tsx) shares `highlights`, so it must change with the table. Open questions at the time of writing: Q12 to Q15 (tagged shape, truncation at 200 characters, board scope).
