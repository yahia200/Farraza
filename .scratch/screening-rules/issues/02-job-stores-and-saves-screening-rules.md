# 02: A Job stores and saves its Screening rules

**What to build:** A manager can save a Job's Screening rules through the API, and the Job payload reports them. No UI yet. Pattern: `.scratch/ratings/issues/02-job-stores-and-saves-rating-criteria.md` and `.scratch/highlighted-questions/issues/02-job-stores-and-saves-highlighted-questions.md`. Spec: `.scratch/screening-rules/spec.md` ("Database", "API").

- **Column:** `jobs.screening_rules`, `jsonb`, NOT NULL, DEFAULT `'[]'`, CHECK it is an array, no FK. Edit the contract, run `prisma contract emit` and `prisma db update`, and commit the emitted files and any snapshots. Existing test jobs are cleared; no data migration.
- **Route:** `PUT companies/:companySlug/jobs/:jobSlug/screening-rules` with `{ rules }`, in the jobs module. Authorizes with `JobPolicy` `update`, any Job status. Validates against the Job's latest published form; a Job with no published form accepts only an empty list. One unconditional replace (last-write-wins, with a comment saying so).
- **Job payload:** gains `screeningRules`; the web `Job` mirror type too.

**Blocked by:** 01.

**Status:** ready-for-agent

- [ ] The column exists with its default and CHECK; contract files and snapshots are committed
- [ ] A manager saves a valid list and gets it back; an interviewer gets 403
- [ ] Draft, open and closed Jobs can all save
- [ ] Rules the shared validator refuses (unknown question, wrong type, unknown option, over the cap) are 400 with `errors` paths
- [ ] A Job with no published form accepts `[]` and refuses a non-empty list
- [ ] Saving again replaces the previous list; another company's Job is 404
- [ ] The Job payload carries `screeningRules`
- [ ] Service specs on the in-memory fake repository (pattern: `jobs.service.spec.ts`) cover every case above
- [ ] `docs/db-schema.md` (jobs table, no-FK list in §7) and `.claude/rules/api.md` updated
- [ ] `pnpm lint`, `pnpm check-types` and `pnpm --filter api test` pass
