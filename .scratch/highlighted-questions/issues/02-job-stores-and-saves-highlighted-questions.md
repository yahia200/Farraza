# 02: A Job stores and saves its Highlighted questions

**What to build:** A manager can save a Job's Highlighted questions through the API, and the Job payload reports the current choice. No UI yet. Spec: `.scratch/highlighted-questions/spec.md` ("Database", "API").

- **Column:** `jobs.highlighted_question_keys`, `jsonb`, NOT NULL, DEFAULT `'[]'`, with a CHECK that it is an array. Edit `apps/api/src/prisma/contract.prisma`, run `pnpm --filter api exec prisma contract emit` and `prisma db update`, and commit `contract.json`, `contract.d.ts` and any new files under `apps/api/migrations/`. Read `apps/api/prisma-8.md` first for how a JSON column and its default are written.
- **Route:** `PUT companies/:companySlug/jobs/:jobSlug/highlighted-questions` with `{ keys: string[] }`, in the jobs module following the controller / service / repository layering. It authorizes with `JobPolicy` `update`. It loads the latest published form with `FormsRepository.findLatestPublished`: no published form is a 409; keys the shared check refuses are a 400 `{ message, errors: [{ path, message }] }`. It replaces the whole list in one statement (a deliberate exception to conditional writes; say so in a comment) and returns the saved list.
- **Job payload:** `GET .../jobs/:jobSlug` (and the list, if it shares the type) gains `highlightedQuestionKeys: string[]`; the web `Job` type mirrors it.

**Blocked by:** 01.

**Status:** needs-triage

- [ ] The column exists with its default and CHECK; existing jobs read as `[]`; contract files and snapshots are committed
- [ ] A manager (owner, admin, recruiter) saves a valid list and gets it back
- [ ] An interviewer gets 403
- [ ] A job with no published form is 409
- [ ] Keys not on the latest published form, over the cap, duplicated, or of an ineligible type are 400 with `errors` paths
- [ ] Saving again replaces the previous list; an empty list clears it
- [ ] Another company's job is 404, like the other job routes
- [ ] The Job payload carries `highlightedQuestionKeys`
- [ ] Service specs on the in-memory fake repository (pattern: `src/jobs/jobs.service.spec.ts`) for every case above (`pnpm --filter api test`)
- [ ] `docs/db-schema.md` updated: the `jobs` table (§3.5) and the no-FK list and rules (§7)
- [ ] `.claude/rules/api.md` updated for the jobs module
- [ ] `pnpm lint` and `pnpm check-types` pass

## Comments

## Answer
