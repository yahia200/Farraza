# 02: A Job stores and saves its rating Criteria

**What to build:** A manager can save a Job's Criteria through the API, and the Job payload reports the current choice. No UI yet. Spec: `.scratch/ratings/spec.md` ("Database", "API: Job criteria"). It mirrors `.scratch/highlighted-questions/issues/02-job-stores-and-saves-highlighted-questions.md`; read that ticket's Answer first, including its choices.

- **Column:** `jobs.rating_criteria`, `jsonb`, NOT NULL, DEFAULT `'[]'`, with a CHECK that it is an array. Edit `apps/api/src/prisma/contract.prisma`, run `pnpm --filter api exec prisma contract emit` and `prisma db update` (use `--dry-run` first), and commit `contract.json`, `contract.d.ts` and any new files under `apps/api/migrations/`.
- **Route:** `PUT companies/:companySlug/jobs/:jobSlug/rating-criteria` with `{ keys }` in the jobs module, authorized with `JobPolicy` `update`, any Job status (no published form is needed, unlike highlights, because the catalog is fixed). One unconditional `UPDATE` replacing the whole list, with a comment saying why it is the exception to conditional writes. It returns `{ keys }`.
- **Job payload:** `Job.ratingCriteria: string[]` in the API and the web `CompanyJob`.

**Blocked by:** 01.

**Status:** ready-for-agent

- [ ] The column exists with its default and CHECK; existing jobs read as `[]`; contract files and snapshots are committed
- [ ] A manager (owner, admin, recruiter) saves a valid list and gets it back, on a draft, open and closed Job
- [ ] An interviewer gets 403
- [ ] An unknown key, more than five, or duplicates are 400 with `errors` paths
- [ ] Saving again replaces the list; an empty list clears it
- [ ] Another company's job is 404
- [ ] The Job payload carries `ratingCriteria`
- [ ] Service specs on the in-memory fake repository for every case above
- [ ] `docs/db-schema.md` updated: the `jobs` table (§3.5) and the no-FK list (§7)
- [ ] `.claude/rules/api.md` updated for the jobs module
- [ ] `pnpm lint` and `pnpm check-types` pass

## Comments

## Answer
