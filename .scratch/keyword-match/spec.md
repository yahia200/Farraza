Status: resolved (all 9 tickets in `.scratch/keyword-match/issues/` resolved; Layer 2 built and verified)

> **Changed by Layer 3 (embedding match, ticket 04): keywords are now optional.** A Requirement may have an empty keyword list. `matchRequirements` then returns `matched: null` ("not checked", no terms) for it, `missedMustHave` ignores it (never a miss, never a marker), and the sheet shows "Not checked". Results stored earlier read as before. The editor says a keyword-less Requirement is only looked at by Layer 3, and where this spec says "1 to 15 keywords", read "0 to 15". Re-check handles it with no special case. See `.scratch/candidate-matching/layer3-spec.md` (stories 7 to 10).

# Keyword match (candidate matching, Layer 2)

Related: the design notes (`.scratch/candidate-matching/layers.md`, Layer 2), the backlog item (`docs/feature-backlog.md`), ADR-0006 (CV text, `docs/adr/0006-cv-text-extracted-in-the-browser.md`), ADR-0007 (background work, `docs/adr/0007-background-work-on-bullmq-over-postgres.md`), the glossary entries **Requirement**, **CV text**, **Screening rule** and **Application Event** (`GLOSSARY.md`), the Screening rules spec (`.scratch/screening-rules/spec.md`, the Job-level-list pattern), and the CV autofill spec (`.scratch/cv-autofill/spec.md`, which stores the CV text this layer reads).

## Problem Statement

A reviewer opens hundreds of Applications one by one. The CV text is now stored with each Application, but nothing reads it. A manager cannot say "I want someone who has run Postgres" and have Applications that never mention it stand out.

## Solution

A manager lists **Requirements** for a Job on the Settings tab: a sentence, a tier (must-have or nice-to-have) and the keywords and synonyms that count as evidence. When an Application is submitted its CV text is checked against the Job's current Requirements and the result is stored. A Requirement matches when any one of its keywords appears. A missed must-have shows a marker on the board card, the table row and the sheet; the sheet lists every Requirement with matched or not matched and the terms found. Nothing is ever rejected or moved. Requirements are versioned, so each stored result says which version it was checked against; when the Job's Requirements change, a **Re-check** button brings the Applications that need it up to date in the background.

## User Stories

1. As a manager, I want to list Requirements for my Job with keywords and synonyms, so that Applications that never mention a must-have stand out.
2. As a manager, I want to mark each Requirement must-have or nice-to-have, so that only must-haves raise a marker.
3. As a manager, I want any one keyword to satisfy a Requirement, so that I can list "Postgres, PostgreSQL, psql" as one.
4. As a manager, I want matching to ignore case and respect whole words, so that "Go" does not match "Google".
5. As a manager, I want symbols in keywords to work ("C#", "Node.js", "C++"), so that common skills are not unmatchable.
6. As a manager, I want an empty list to be valid, so that I can switch Layer 2 off.
7. As a manager, I want to save Requirements on a draft, open or closed Job, so that I can prepare before publishing.
8. As a manager, I want editing Requirements to leave stored results alone until I ask, so that nothing changes behind my back. *Note (Layer 3, ticket 05): stories 7 and 8 ("any Job status", with Re-check) now apply only below the **Edit limit**. Once a Job holds 100 Applications its Requirements are read-only (`.scratch/candidate-matching/layer3-spec.md`, "The Edit limit"); Re-check still works.*
9. As a manager, I want a Re-check button that shows how many Applications it will touch and is disabled at zero, so that I never pay for work that is not needed.
10. As a manager, I want Re-check to skip rejected Applications and CVs that could not be read, so that it only does useful work.
11. As a manager, I want Re-check to run in the background and show progress, so that I can keep working.
12. As a manager, I want only one Re-check per Job at a time, so that a double click does nothing harmful.
13. As a manager, I want an edit made during a Re-check to be picked up by it, so that the run finishes on the latest Requirements.
14. As a reviewer, I want a separate marker when a must-have is missed, distinct from a Screening-rule flag, so that I know whether an answer or the CV caused it.
15. As a reviewer, I want the sheet to list each Requirement with matched or not matched and the terms found, so that I can see why.
16. As a reviewer, I want "CV could not be read" instead of any verdict when the CV was unreadable or failed, so that a failed read is never mistaken for a missing skill.
17. As a reviewer, I want nothing shown when an Application has no CV, so that the sheet is not cluttered.
18. As an applicant, I want Requirements and results to be invisible to me, so that I cannot game the form.
19. As a maintainer, I want the matcher to be a pure function in `@repo/shared`, so that tests need no database or PDF.
20. As a maintainer, I want Requirement versions to be immutable and results to reference them, so that no row copies Requirement text.

## Implementation Decisions

The behaviour is settled (grilling session, 2026-11-06); table and route names are proposals to confirm against `apps/api/prisma-8.md`, `docs/db-schema.md` and the existing contract.

**Shared (`@repo/shared`, pure and tested)**

- A Requirement is `{ id (uuid, stable across versions), text, tier: 'must_have' | 'nice_to_have', keywords: string[] }`. Caps (placeholders, easy to raise): at most 10 Requirements per Job, 15 keywords each, each keyword 1 to 40 characters after trimming, text at most 200 characters. There is no `questionKey` yet (Layers 3 and 4 add it).
- `matchRequirements(requirements, cvText)` returns, per Requirement id, `{ matched, terms }`. Matching is case-insensitive. A keyword is a literal string (no regex), and a match must not be preceded or followed by a letter or digit, so "C#", "Node.js" and "C++" work and "Go" does not match "Google". Only a trailing "s" and surrounding punctuation are normalised; other synonyms are the manager's to list. Negation is not detected ("no experience with Postgres" matches); this is a known, accepted limit.
- A helper derives `missedMustHave` from the results and tiers.

**Database**

- `job_requirement_versions`: Job, company, version number (increasing per Job), `requirements` jsonb (array, CHECK), created time. Immutable. The Job's current version is the highest number. No row is written for a save that changes nothing.
- `application_requirement_results`: one row per Application, with company, Job, the version it was checked against, `results` jsonb (per Requirement id: matched and terms), `missed_must_have` boolean and a checked-at time. Deleted with its Application. No row is written for an `unreadable`, `failed` or missing CV. Follow the tenancy and no-FK conventions in `docs/db-schema.md` §7; update that doc.
- The queue tables live in BullMQ's own `bullmq` schema (ADR-0007) and are not in the contract.
- Existing Applications have no result row; they count as needing a Re-check once the Job has a version.

**API (`apps/api`)**

- `PUT companies/:companySlug/jobs/:jobSlug/requirements` with `{ requirements }`, authorized like the Screening-rules `PUT`, any Job status. If the list differs from the current version, a new version is created in one transaction; otherwise nothing happens. The Job payload carries the current Requirements and version number.
- Submit: after the Application and its CV text row are written, in the same transaction, if the Job has a current version and the CV text is `readable`, run `matchRequirements` and write the result row. A missing, `unreadable` or `failed` CV writes none. This can never fail a submit.
- Re-check: `GET` returns the count of Applications that need it (non-rejected, CV text `readable`, no result or a result older than the current version), and a `POST` enqueues one BullMQ job per Job, with a stable `jobId` so a second click is a no-op while one is active. The processor works in chunks of about 50 (placeholder), reading the Job's current version at the start of each chunk, and reports progress. A status route returns idle, running with processed and total, or the last finished run.
- The board, list and detail payloads carry each Application's `missedMustHave`; the detail payload carries the per-Requirement results and a CV state (`readable`, `unreadable`, `failed`, `none`). CV text itself is never returned. The public routes return none of this (test it).
- No Application Events are written; the marker is derived from the latest stored result.
- Install `@nestjs/bullmq`, `bullmq` and `pg` in `apps/api` and read their installed `.d.ts` files before use (`CLAUDE.md`, working agreement).

**Web (`apps/web`)**

- The Job's Settings tab gains a Requirements section beside Screening rules and Rating criteria: a list editor (text, tier, keywords) with the caps, and the Re-check button with its count and progress polling.
- A marker for a missed must-have on the board card, the table row and the sheet, visibly distinct from the Screening-rule flag. The sheet gets a Requirements section: each Requirement with matched or not matched and its terms, and "CV could not be read" or nothing for the other CV states.
- No filter or sort on it in this slice.

## Testing Decisions

Test through public behaviour. `@repo/shared`: the matcher (case, whole word, symbols, plural "s", any-of, empty keywords rejected by the schema, caps) and the missed-must-have helper. API: service specs in the `jobs.service.spec.ts` style with the in-memory fake repository, for saving (new version, no-op save, empty list), submit (result written, none for unreadable, failed or missing CV, never fails the submit), the count of Applications needing a Re-check, the Re-check processor on a fake queue (skips rejected and unreadable, picks up a newer version mid-run, one active run per Job), and that no public route returns Requirements, results or markers. Web: the editor and the marker. The BullMQ Postgres backend itself is exercised by a manual run against the dev database, not a unit test.

## Out of Scope

Auto-extracted keywords, Postgres full-text search, negation handling, embeddings and LLM scoring (Layers 3 and 4), a `questionKey` on Requirements, a filter or sort on the marker, Application Events for Layer 2, moving or rejecting on a Requirement, re-running on rejected Applications, and the legal review of automated ranking (still open, see `layers.md`).

## Open items to resolve during the slices

1. Whether the Cloud Run API service has CPU always allocated (needed for a run to finish after its request returns; ADR-0007).
2. That `prisma db update` and `prisma db verify` leave BullMQ's `bullmq` schema alone (ADR-0007 gate).
3. That BullMQ's Postgres backend behaves as its types say, in a real run.
4. The placeholders: caps, chunk size (about 50) and the CV-text size seen in practice.

## Suggested slices

1. Queue infrastructure spike: install, wire BullMQ on Postgres, pass both gates (parallel with 2 and 3).
2. Shared schema and matcher, with tests.
3. Database and API: versions, the `PUT`, and the Job payload.
4. Submit writes the result row.
5. Payloads and markers on the card, row and sheet.
6. Settings tab Requirements editor.
7. Re-check: count, enqueue, processor, status.
8. Re-check button and progress.
9. Verification pass and docs sweep.
