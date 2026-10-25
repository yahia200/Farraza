# 02: A Job stores and saves its Highlighted questions

**What to build:** A manager can save a Job's Highlighted questions through the API, and the Job payload reports the current choice. No UI yet. Spec: `.scratch/highlighted-questions/spec.md` ("Database", "API").

- **Column:** `jobs.highlighted_question_keys`, `jsonb`, NOT NULL, DEFAULT `'[]'`, with a CHECK that it is an array. Edit `apps/api/src/prisma/contract.prisma`, run `pnpm --filter api exec prisma contract emit` and `prisma db update`, and commit `contract.json`, `contract.d.ts` and any new files under `apps/api/migrations/`. Read `apps/api/prisma-8.md` first for how a JSON column and its default are written.
- **Route:** `PUT companies/:companySlug/jobs/:jobSlug/highlighted-questions` with `{ keys: string[] }`, in the jobs module following the controller / service / repository layering. It authorizes with `JobPolicy` `update`. It loads the latest published form with `FormsRepository.findLatestPublished`: no published form is a 409; keys the shared check refuses are a 400 `{ message, errors: [{ path, message }] }`. It replaces the whole list in one statement (a deliberate exception to conditional writes; say so in a comment) and returns the saved list.
- **Job payload:** `GET .../jobs/:jobSlug` (and the list, if it shares the type) gains `highlightedQuestionKeys: string[]`; the web `Job` type mirrors it.

**Blocked by:** 01.

**Status:** resolved

- [x] The column exists with its default and CHECK; existing jobs read as `[]`; contract files and snapshots are committed
- [x] A manager (owner, admin, recruiter) saves a valid list and gets it back
- [x] An interviewer gets 403
- [x] A job with no published form is 409
- [x] Keys not on the latest published form, over the cap, duplicated, or of an ineligible type are 400 with `errors` paths
- [x] Saving again replaces the previous list; an empty list clears it
- [x] Another company's job is 404, like the other job routes
- [x] The Job payload carries `highlightedQuestionKeys`
- [x] Service specs on the in-memory fake repository (pattern: `src/jobs/jobs.service.spec.ts`) for every case above (`pnpm --filter api test`)
- [x] `docs/db-schema.md` updated: the `jobs` table (§3.5) and the no-FK list and rules (§7)
- [x] `.claude/rules/api.md` updated for the jobs module
- [x] `pnpm lint` and `pnpm check-types` pass

## Comments

## Answer

I built it test-first (red, then green, one slice at a time) through `JobsService`'s public methods. The real service and the real `JobPolicy` run on in-memory fakes of `JobsRepository` and `FormsRepository`, as in `jobs.service.spec.ts`. The seams are the ones in the spec's "Testing Decisions", which the owner already approved, so I proposed no new ones. One extra seam is listed under choices (4).

### What shipped

- **Column:** `jobs.highlighted_question_keys jsonb NOT NULL DEFAULT '[]'`, with CHECK `jobs_highlighted_question_keys_array` (`jsonb_typeof(...) = 'array'`). The dry run planned exactly two additive statements: `ADD COLUMN ... DEFAULT '[]'::jsonb NOT NULL` and `ADD CONSTRAINT ... CHECK`. After `db update`, all 9 dev jobs read `[]`. A rolled-back `UPDATE ... = '{}'` was refused by the CHECK.
- **Route:** `PUT /api/companies/:companySlug/jobs/:jobSlug/highlighted-questions`, body `{ keys }` (`saveHighlightedQuestionsSchema`). It goes through `JobsService.saveHighlightedQuestions`, which runs these steps in order:
  1. `JobPolicy` `update`: 403 for an interviewer.
  2. `get`: 404 for another company's job.
  3. `FormsRepository.findLatestPublished`: 409 "Publish the application form first." when there is none.
  4. `checkHighlightKeys(keys, form.fields)`: 400 `{ message: 'Some questions can’t be shown in the list.', errors: [{ path: '<index>', message }] }`.
  5. `JobsRepository.replaceHighlightedQuestionKeys`, one unconditional `UPDATE`. The comment there says why it is the exception to conditional writes.
  It answers `{ keys }`.
- **Payload:** the API's `Job` type has `highlightedQuestionKeys: string[]`. `GET .../jobs` and `GET .../jobs/:jobSlug` share that type, so both carry it, and so do the open/close/PATCH answers. The web `CompanyJob` (`apps/web/lib/dal.ts`, the web's mirror of `Job`) has the field, and `toCompanyJob` passes it through. Without that, the DAL would strip it.

### Choices (owner may want to review)

1. **How `JobsService` gets `FormsRepository`.**
   - **Chosen:** list `FormsRepository` in `JobsModule`'s `providers`. `FormsModule` already imports `JobsModule` (`FormsService` uses `JobsService`), so importing `FormsModule` back would make a module cycle. The repository holds no state (it only wraps the global `PrismaService`), so a second instance costs nothing. A comment in `jobs.module.ts` says why.
   - **Rejected:**
     - `forwardRef()` between the two modules: it works, but it hides a real cycle.
     - Moving `FormsRepository` into a new shared module: more structure than one read needs.
     - A `findLatestPublishedFields` on `JobsRepository` (it already queries `FormVersion` for `hasPublishedForm`): the ticket names `FormsRepository.findLatestPublished`, and a copy of that query could drift from it.
   - Doc: `ModuleMetadata` (`providers`, `imports`, `exports`) in `apps/api/node_modules/@nestjs/common/interfaces/modules/module-metadata.interface.d.ts`. I wrote "providers are module-scoped, and a second listing makes a second instance" from memory of https://docs.nestjs.com/modules ("Shared modules"). I didn't open that page.
2. **Response shape `{ keys }`, not a bare `string[]`.** It is the same representation the PUT body sends, and it leaves room for more fields. Ticket 05's Server Action reads it. **Rejected:** a bare array, which is equally valid but asymmetric with the body.
3. **400 message:** "Some questions can’t be shown in the list.", in the style of the other services' `{ message, errors }` ("Some answers need attention."). The per-key messages come from `checkHighlightKeys` (ticket 01). The 409 copy is "Publish the application form first.", close to the spec's suggestion and to `open`'s "Publish the application form before opening this job.".
4. **Cap, repeats and non-UUIDs at the API level.** The acceptance list asks for these as 400s with `errors` paths. The service never sees such a body: the global `StandardSchemaValidationPipe` refuses it first. So the spec has a small `describe('the save request body')` that runs that pipe with the app's `toValidationException` and the route's schema. It checks `keys` for over the cap, `keys.1` for a repeat and `keys.0` for a non-UUID. That checks the 400 a client really gets. The schema's own rules stay tested in `@repo/shared`.
   - **Rejected:** having the service re-parse the body. That would put the same check in two places.
   - **Caveat:** that describe re-tests a little of the shared seam. The trail learning `l-a459dab5` warns against exactly that, so the owner may prefer to drop it.
   - Doc: `apps/api/node_modules/@nestjs/common/pipes/standard-schema-validation.pipe.d.ts` (`transform(value, metadata)`, `exceptionFactory`) and `interfaces/features/pipe-transform.interface.d.ts` (`ArgumentMetadata.schema`).
5. **Repository return type:** `replaceHighlightedQuestionKeys(id, keys): Promise<Job | null>`. It is `null` only if the job row disappeared between the lookup and the write, and the service maps that to 404 as `update` does. It updates by `id` alone, like the existing `update`, `open` and `close`; the service has already scoped the job to the company.
6. **Mapping the JSONB:** `toJob` takes `highlightedQuestionKeys: unknown` and casts it to `string[]`, the same pattern `toFormVersion` uses for `fields`. The emitted type is `CodecTypes['pg/jsonb@1']['output']` (`contract.d.ts`). The CHECK and the write-time validation are what make the cast safe. **Rejected:** parsing with the Zod schema on every read, which would cost work on every job list for data only this service writes.
7. **Discrepancy in the spec:** it says the CHECK follows "the pattern `form_versions.fields` already uses". That CHECK is not applied: `docs/db-schema.md` §8.2 lists it as "not applied", and the contract has no such `@@check`. So this column is the first JSONB column with a type CHECK. The contract syntax follows the existing `@@check(expression:, name:)` lines in `contract.prisma`, and Prisma appended its hash, giving `jobs_highlighted_question_keys_array_b35d15b3`.
8. **Tests that went green at once.** "Saving again replaces / an empty list clears" and "another company's job is 404" passed when written, because the behaviour already followed from the earlier slices (the fake mirrors the real full-list `UPDATE`, and `get` already 404s). I kept them as the guard for those acceptance items.

### Docs relied on

- Contract syntax (`Jsonb`, `@default(json\`[]\`)`, `@map`, `@@check`): the existing lines in `apps/api/src/prisma/contract.prisma` (`FormVersion.fields`, `Application.answers`, the `@@check`s). `apps/api/prisma-8.md` doesn't describe JSON columns or CHECKs; it covers the workflow (edit, `contract emit`) and the `.where().first()` query style.
- `pnpm --filter api exec prisma contract emit --help` and `prisma db update --help`. I used `--dry-run` first. `db update` advanced the `db` ref (`migrations/app/refs/db.json`) and wrote the snapshot, as the dry run's `plannedAdvanceRef` said. I also read `prisma migration --help`; nothing needed planning.
- ORM `.where({ id }).update({...})` returns the row or `null`: CLAUDE.md "Database (Prisma 8)", the same call as `JobsRepository.update`.
- Nest: `Put` in `apps/api/node_modules/@nestjs/common/decorators/http/request-mapping.decorator.d.ts`, and `Body(options)` with `{ schema }` in `.../decorators/http/route-params.decorator.d.ts`. The pipe docs are listed in choice 4, and `ModuleMetadata` in choice 1.
- Shared API (ticket 01's Answer): `checkHighlightKeys`, `saveHighlightedQuestionsSchema`, `SaveHighlightedQuestionsInput`.
- `next typegen` before `tsc --noEmit` in a fresh worktree: `apps/web/node_modules/next/dist/docs/01-app/03-api-reference/06-cli/next.md`.

### Checks

- `pnpm --filter api test`: 15 files, 330 tests pass (`jobs.service.spec.ts`: 17).
- `pnpm --filter @repo/shared test`: 15 files, 418 pass.
- `pnpm lint`: 0 errors. The warnings were already there; none are in files this ticket touches.
- `pnpm check-types`: ok.
- `tsc --noEmit` in `apps/api`: clean. In `apps/web` (after `next typegen`): clean.
- Prettier: only `jobs.service.spec.ts` was formatted. It was Prettier-clean at HEAD. The other jobs files and `dal.ts` were already not Prettier-clean at HEAD, so I left their formatting alone rather than add unrelated diff noise.
- **Dev DB changed:** yes. It gained the column and the CHECK. The change is additive, and existing rows got `[]`.

### Files

- Modified `apps/api/src/prisma/contract.prisma`: the `highlightedQuestionKeys` column on `Job` and its array CHECK.
- Modified `apps/api/src/prisma/contract.json`, `apps/api/src/prisma/contract.d.ts`: regenerated by `prisma contract emit`.
- Modified `apps/api/migrations/app/refs/db.json`: the `db` ref advanced to the new contract hash by `prisma db update`.
- Created `apps/api/migrations/snapshots/0c8d65e2…/contract.json`, `contract.d.ts`: the snapshot `prisma db update` writes for the applied contract.
- Modified `apps/api/src/jobs/job.ts`: `Job.highlightedQuestionKeys`.
- Created `apps/api/src/jobs/dto/save-highlighted-questions.dto.ts`: re-exports the shared body schema and declares the DTO type.
- Modified `apps/api/src/jobs/jobs.controller.ts`: the `PUT :jobSlug/highlighted-questions` route.
- Modified `apps/api/src/jobs/jobs.service.ts`: `saveHighlightedQuestions`, and `FormsRepository` injected.
- Modified `apps/api/src/jobs/jobs.repository.ts`: `replaceHighlightedQuestionKeys`, with the last-write-wins comment, and `toJob` maps the new column.
- Modified `apps/api/src/jobs/jobs.module.ts`: provides `FormsRepository`, with the comment on why it isn't imported.
- Modified `apps/api/src/jobs/jobs.service.spec.ts`: a `FormsRepository` fake, a test form, the `saveHighlightedQuestions` cases and the request-body cases.
- Modified `apps/web/lib/dal.ts`: `CompanyJob.highlightedQuestionKeys`, passed through `toCompanyJob`.
- Modified `docs/db-schema.md`: §3.5 (column, CHECK, meaning) and §7 (the keys have no FK, the save rules, stale keys, the last-write-wins exception).
- Modified `.claude/rules/api.md`: the Job domain-flow note on the route, payload and module wiring, and the exception under "Concurrency and error conventions".
- Modified `.scratch/highlighted-questions/issues/02-job-stores-and-saves-highlighted-questions.md`: this Answer.
