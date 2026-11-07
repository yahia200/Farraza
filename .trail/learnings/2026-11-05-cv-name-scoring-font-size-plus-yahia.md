---
title: "CV name scoring: font size plus a family-name bold bonus, layout stays browser-only"
author: Yahia
date: 2026-11-05
branch: main
cost: { minutes: 13, tokens: 171387 }
id: l-059187ae
scope: repo
status: active
src: agent
touches:
  - packages/shared/src/cv-layout.ts
  - packages/shared/src/cv-name.ts
  - packages/shared/src/cv-contacts.ts
  - packages/shared/src/index.ts
  - packages/shared/src/cv-text.ts
  - apps/web/lib/cv-reader.ts
  - apps/web/components/apply/use-cv-autofill.ts
---

## Decided
- The name finder (packages/shared/src/cv-name.ts) scores candidate lines instead of taking the first plausible one. Features: position, relative font size, bold, all-caps, email-local-part match, job-title word. The owner picked font size plus a bold bonus from unpdf's `fontFamily`, using `extractTextItems` (documented in unpdf's README).
- Layout (cv-layout.ts) is browser-only: `readCv` in apps/web/lib/cv-reader.ts returns `{ cv, layout? }` and only `cv` goes to the submit, because `cvTextSchema` is a strictObject. Nothing about layout is stored or sent.
- An email match is only a score feature and is `null` for non-Latin names, so an Arabic name is never penalised. Deriving a name from the email alone was not built.
- The owner writes the weights in `scoreNameFeatures` (placeholder scores by position only). The owner will add sample CVs under .scratch/cv-samples/ to verify.

## Tried and ruled out
- Matching bold by font name alone: unpdf's `fontFamily` is pdf.js's CSS family and is often generic (`sans-serif`) for both regular and bold, so it can silently never fire.
- Comparing pdf.js internal font ids to detect emphasis: more robust but bypasses unpdf's documented API and needs more code. Not chosen.
- Font size only: simplest, but drops the bold signal where names are real.

## Watch out
- Nothing was run before the limit hit: no tests, type-check or lint. Bold detection and the exact-text match between layout lines and CV text lines are unverified on real PDFs.
- `extractTextItems` reads every page (no page option); the 30-page cap in cv-reader.ts bounds it.
