# 02: A Job stores and saves its rating Criteria

**What to build:** A manager can save a Job's Criteria through the API, and the Job payload reports the current choice. No UI yet. Spec: `.scratch/ratings/spec.md` ("Database", "API: Job criteria"). It mirrors `.scratch/highlighted-questions/issues/02-job-stores-and-saves-highlighted-questions.md`; read that ticket's Answer first, including its choices.

- **Column:** `jobs.rating_criteria`, `jsonb`, NOT NULL, DEFAULT `'[]'`, with a CHECK that it is an array. Edit `apps/api/src/prisma/contract.prisma`, run `pnpm --filter api exec prisma contract emit` and `prisma db update` (use `--dry-run` first), and commit `contract.json`, `contract.d.ts` and any new files under `apps/api/migrations/`.
- **Route:** `PUT companies/:companySlug/jobs/:jobSlug/rating-criteria` with `{ keys }` in the jobs module, authorized with `JobPolicy` `update`, any Job status (no published form is needed, unlike highlights, because the catalog is fixed). One unconditional `UPDATE` replacing the whole list, with a comment saying why it is the exception to conditional writes. It returns `{ keys }`.
- **Job payload:** `Job.ratingCriteria: string[]` in the API and the web `CompanyJob`.

**Blocked by:** 01.

**Status:** resolved

- [x] The column exists with its default and CHECK; existing jobs read as `[]`; contract files and snapshots are committed
- [x] A manager (owner, admin, recruiter) saves a valid list and gets it back, on a draft, open and closed Job
- [x] An interviewer gets 403
- [x] An unknown key, more than five, or duplicates are 400 with `errors` paths
- [x] Saving again replaces the list; an empty list clears it
- [x] Another company's job is 404
- [x] The Job payload carries `ratingCriteria`
- [x] Service specs on the in-memory fake repository for every case above
- [x] `docs/db-schema.md` updated: the `jobs` table (§3.5) and the no-FK list (§7)
- [x] `.claude/rules/api.md` updated for the jobs module
- [x] `pnpm lint` and `pnpm check-types` pass

## Comments

## Answer

Built test-first through `JobsService`'s public methods: the real service and the real `JobPolicy` on in-memory fakes, the `jobs.service.spec.ts` pattern. The seams are the ones in the spec's "Testing Decisions"; I proposed no new ones. The first test went red (`service.saveRatingCriteria is not a function`), then the minimum code. The remaining cases (other roles, any status, interviewer 403, replace and clear, other company's job 404, the empty default) went in as a second slice and passed at once, because they follow from the first slice (the fake mirrors the real full-list `UPDATE`, and `get` already 404s), as in the highlights ticket. They stay as the guard for those acceptance items.

### What shipped

- **Column:** `jobs.rating_criteria jsonb NOT NULL DEFAULT '[]'` with CHECK `jobs_rating_criteria_array` (`jsonb_typeof(rating_criteria) = 'array'`; the DB name has Prisma's hash appended: `jobs_rating_criteria_array_37b9d2a9`). **Dry run** (`prisma db update --dry-run`) planned exactly two additive operations and nothing else (so nothing from other worktrees was pending): `ALTER TABLE "public"."jobs" ADD COLUMN "rating_criteria" jsonb DEFAULT '[]'::jsonb NOT NULL` and `ALTER TABLE "public"."jobs" ADD CONSTRAINT "jobs_rating_criteria_array_37b9d2a9" CHECK (jsonb_typeof(rating_criteria) = 'array')`, with `plannedAdvanceRef` db to `fed4d280…`. I then ran `prisma db update`: 2 of 2 operations executed. Checked in the dev DB (`docker exec farraza-db-1 psql`): all 9 jobs read `[]`, and a rolled-back `UPDATE ... SET rating_criteria = '{}'` was refused by the CHECK.
- **Route:** `PUT /api/companies/:companySlug/jobs/:jobSlug/rating-criteria`, body `{ keys }` (`saveRatingCriteriaSchema`, ticket 01). `JobsService.saveRatingCriteria`: `JobPolicy` `update` (403 for an interviewer), `get` (404 for another company's job), `JobsRepository.replaceRatingCriteria` (one unconditional `UPDATE`, with the last-write-wins comment). It answers `{ keys }`. Any Job status works and no form is read.
- **Payload:** `Job.ratingCriteria: string[]` (every Job payload, via `toJob`), and the web `CompanyJob.ratingCriteria` plus `toCompanyJob` passing it through (otherwise the DAL strips it).

### Choices (owner may want to review)

1. **No service-level key check.** The ticket 01 Answer said the schema is the whole validation (unknown key, over five and repeats are 400s from the global pipe with `keys` / `keys.<index>` paths), so the service is authorize, get, replace. Rejected: re-checking the keys in the service (the same rule in two places). The 400 cases are tested by a small `describe('the save rating criteria request body')` that runs the real `StandardSchemaValidationPipe` with `toValidationException` and the route's schema, as the highlights ticket did. The caveat from that ticket still applies: it re-tests a little of the shared seam (trail learning `l-a459dab5`), so the owner may prefer to drop it.
2. **Response `{ keys }`**, not a bare array: same as the highlights route and the spec.
3. **Repository returns `Job | null`** and the service maps `null` to 404 (the row vanished between lookup and write), as `saveHighlightedQuestions` does. It updates by `id` alone; the service already scoped the job to the company.
4. **`toJob` cast:** `ratingCriteria: unknown` cast to `string[]`, the same reasoning and pattern as `highlightedQuestionKeys` (CHECKed to be an array, written only after the schema accepted catalog keys). Rejected: parsing on every read.
5. **No `FormsRepository` and no module change:** nothing to wire, so `jobs.module.ts` is untouched.
6. **Contract syntax** copied from the existing `highlightedQuestionKeys` line and `@@check` (`Jsonb @default(json` + backtick `[]` + backtick `) @map(...)`). `apps/api/prisma-8.md` does not document JSON columns or CHECKs (it covers the workflow), so the reference is the existing `contract.prisma`.

### Docs relied on

- `pnpm --filter api exec prisma contract emit --help` and `prisma db update --help` (`--dry-run`); the dry-run output is quoted above. Existing `contract.prisma` lines for `Jsonb`, `@default(json...)`, `@@check`.
- Nest `Put` and `Body({ schema })`: `apps/api/node_modules/@nestjs/common/decorators/http/request-mapping.decorator.d.ts` and `.../route-params.decorator.d.ts`; `apps/api/node_modules/@nestjs/common/pipes/standard-schema-validation.pipe.d.ts` for the pipe in the body describe. I followed the existing route and spec as written in highlighted-questions ticket 02 and did not re-open these `.d.ts` files this session, so these name the pattern's docs, not freshly verified ones.
- `next typegen` before `tsc --noEmit` in a fresh worktree: `apps/web/node_modules/next/dist/docs/01-app/03-api-reference/06-cli/next.md`.

### For the next tickets

- **Ticket 03 (rate):** `job.ratingCriteria` is on `JobWithStages` from `JobsService.get` (the pipeline service already calls `jobs.get`), and is what to pass to `checkRatingCriteria(dto.criteria ?? {}, job.ratingCriteria)`. Fake `JobWithStages` literals in specs need `ratingCriteria: []` (I added it to `pipeline.board.spec.ts`'s `FakeJobs`; any other spec that builds one needs it too).
- **Ticket 05 (picker, web):** call the `PUT` above from a Server Action returning `ActionFailure`; the answer is `{ keys }`; the saved list is `CompanyJob.ratingCriteria`. A 400 can only come from a stale page or a hand-made request (`RELOAD_MESSAGE` from ticket 01). Revalidate the job path like `saveHighlightedQuestions`. The stored order is the manager's pick order, as sent.
- The jobs module needed no new provider, so the pipeline module gets `ratingCriteria` through `JobsService.get` with no wiring.

### Checks

- `pnpm --filter api test`: 16 files, 354 tests pass (`jobs.service.spec.ts`: 26). `pnpm --filter @repo/shared test`: 17 files, 458 pass.
- `pnpm lint`: 0 errors (10 existing API warnings and 2 existing web warnings, none in files this ticket touches).
- `pnpm check-types` at the root runs only `@repo/shared`, so I also ran `pnpm --filter api exec tsc --noEmit -p tsconfig.json` (clean) and, after `pnpm --filter web exec next typegen`, `pnpm --filter web exec tsc --noEmit` (clean).
- **Dev DB changed:** yes, additive (the column and the CHECK; existing rows got `[]`).

### Files

- Modified `apps/api/src/prisma/contract.prisma`: `ratingCriteria` column on `Job` and its array CHECK.
- Modified `apps/api/src/prisma/contract.json`, `apps/api/src/prisma/contract.d.ts`: regenerated by `prisma contract emit`.
- Modified `apps/api/migrations/app/refs/db.json`: the `db` ref advanced to `fed4d280…` by `prisma db update`.
- Created `apps/api/migrations/snapshots/fed4d280…/` (`contract.json`, `contract.d.ts`): the snapshot `db update` writes.
- Modified `apps/api/src/jobs/job.ts`: `Job.ratingCriteria`.
- Created `apps/api/src/jobs/dto/save-rating-criteria.dto.ts`: re-exports the shared body schema and declares the DTO type.
- Modified `apps/api/src/jobs/jobs.controller.ts`: the `PUT :jobSlug/rating-criteria` route.
- Modified `apps/api/src/jobs/jobs.service.ts`: `saveRatingCriteria`.
- Modified `apps/api/src/jobs/jobs.repository.ts`: `replaceRatingCriteria` with the last-write-wins comment; `toJob` maps the column.
- Modified `apps/api/src/jobs/jobs.service.spec.ts`: fake repository method, seed field, the service cases and the request-body cases.
- Modified `apps/api/src/pipeline/pipeline.board.spec.ts`: `ratingCriteria: []` on the fake `JobWithStages`, so the API type-checks.
- Modified `apps/web/lib/dal.ts`: `CompanyJob.ratingCriteria`, passed through `toCompanyJob`.
- Modified `docs/db-schema.md`: §3.5 (column, CHECK, meaning) and §7 (no-FK list, the last-write-wins exception).
- Modified `.claude/rules/api.md`: the Job "Rating Criteria" domain-flow note and the exception under "Concurrency and error conventions".
- Modified `.scratch/ratings/issues/02-job-stores-and-saves-rating-criteria.md`: status, ticked boxes and this Answer.
