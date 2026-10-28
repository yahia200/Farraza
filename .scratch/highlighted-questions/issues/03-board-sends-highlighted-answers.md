# 03: The board sends the Highlighted answers

**What to build:** The board response carries the Job's Highlighted questions and, for each Application, the display-ready answer to each one, resolved against that Application's own form version. No UI yet. Spec: `.scratch/highlighted-questions/spec.md` ("API").

- `GET .../jobs/:jobSlug/applications` answers `{ columns, highlightedQuestions }`. `highlightedQuestions` is the stored keys filtered against the latest published form (a key that form no longer has, or that is no longer highlightable, is dropped), in form order, as `{ key, label }` with the latest text. Each card gains `highlights: Record<string, string | null>` keyed by Question key.
- Each Application's text comes from the same-key Question in **its own** form version, through the shared formatter's list variant (ticket 01); a version without that Question gives `null`. In `PipelineRepository.findCards`, read each row's `answers` and `formVersionId`, then fetch the distinct form versions once by id; do not `include('formVersion')` per row. Check `apps/api/prisma-8.md` for what the ORM supports before choosing the query. With nothing left after filtering, don't read answers at all and send `highlights: {}`.
- Same access check as today (interviewers included). Only Highlighted answers leave the API; the detail route is untouched.
- Web side, kept minimal: `getPipelineBoard` (`apps/web/lib/dal.ts`) returns the extra data, and `PipelineCard` / `ApplicationSummary` carry `highlights`. Nothing renders them yet.

**Blocked by:** 01, 02.

**Status:** resolved

- [x] With no Highlighted questions, `highlights` is `{}` on every card and answers are not read
- [x] With Highlighted questions, each card has only those keys, formatted as display text or `null`
- [x] An Application on an older form version shows its own applicant's option labels
- [x] An Application whose version lacks the Question gets `null`
- [x] A stored key the latest published form no longer has is absent from `highlightedQuestions` and from every card
- [x] `highlightedQuestions` is in form order with the latest labels
- [x] Long text is cut at 200 characters
- [x] Another company's job is 404; an interviewer can read the board
- [x] Service specs on the in-memory fake repository for every case above
- [x] The DAL and its types are updated; the existing table and board still render exactly as before
- [x] `.claude/rules/api.md` updated for the board payload
- [x] `pnpm lint` and `pnpm check-types` pass

## Comments

## Answer

I built it test-first through `PipelineService.board`, the public method. The real service runs on in-memory fakes of `PipelineRepository`, `FormsRepository` and `JobsService.get`, the pattern of `src/pipeline/pipeline.files.spec.ts`. This is the seam in the spec's "Testing Decisions", which the owner already approved, so I proposed no new one. The fake repository counts answer reads and records which version ids it was asked for. That is how a spec can say "answers are not read" and "each version is read once".

### What shipped

- `GET .../jobs/:jobSlug/applications` answers `{ job, columns, highlightedQuestions }`. `job` was already there and is unchanged.
- `highlightedQuestions`: the stored `highlightedQuestionKeys`, filtered through `highlightableQuestions(latest published form)`, in form order, as `{ key, label }` with the latest text. A key the latest form no longer has, or has on a Question that can't be highlighted, is dropped. With no stored keys, the form isn't loaded at all.
- Every card has `highlights: Record<questionKey, string | null>`. Each value comes from the Application's **own** version: that version's highlightable Question with the same key, formatted by `formatHighlightText` (ticket 01, which also cuts at 200 characters). It is `null` when that version has no such Question, or has it on a non-highlightable one.
- With nothing left after filtering, the board calls `findCards`, which `select`s only the card columns, so `answers` is not read. Every card then gets `highlights: {}`.
- Otherwise the board calls `findCardsWithAnswers` (the card columns plus `formVersionId` and `answers`), then `findFormFields(distinctIds)`: one `FormVersion.select('id', 'fields').where(v => v.id.in(ids))`.
- The access check is unchanged: membership guard plus `jobs.get`, no policy. So interviewers read it, and another company's job is 404. The detail route is untouched.
- Web: `ApplicationSummary` (and so `PipelineCard`, `CandidateRow` and `flattenBoard`'s rows) gains `highlights`. `HighlightedQuestion` and `PipelineBoardView` are new. `getPipelineBoard` returns `{ columns, highlightedQuestions }`. Nothing renders them.

### Choices (owner may want to review)

1. **How `PipelineService` gets the latest published form.**
   - **Chosen:** `FormsModule` now `exports: [FormsRepository]`, and `PipelineModule` imports `FormsModule`. This is Nest's shared-module mechanism. Here there is no cycle (`FormsModule` imports `JobsModule`, not `PipelineModule`), so the reason ticket 02 had to avoid it doesn't apply.
   - **Rejected:**
     - Listing `FormsRepository` in `PipelineModule`'s `providers` as ticket 02 did: it works, but it's a workaround for a cycle that doesn't exist here.
     - A latest-published query on `PipelineRepository`: a second copy of `findLatestPublished` that could drift from the first.
   - Doc: `ModuleMetadata.exports` / `imports` comments in `apps/api/node_modules/@nestjs/common/interfaces/modules/module-metadata.interface.d.ts` (l.14-33); https://docs.nestjs.com/modules ("Shared modules") from memory, not opened.
2. **Repository shape: three single-query methods.**
   - **Chosen:** `findCards` (no answers), `findCardsWithAnswers`, and `findFormFields(ids)`. The service dedupes the ids and does the formatting, so the "fetch each version once" rule and every formatting case are testable through the service.
   - **Rejected:**
     - `findCards(jobId, { withAnswers })`: one method whose return type depends on a flag.
     - Having the repository return cards with `highlights` already resolved: that puts business rules in the repository, where the in-memory fake would have to copy them, so the specs would test the fake.
   - New internal types are in `pipeline.ts`: `CardRow` (a card before highlights) and `CardRowWithAnswers` (plus `formVersionId`, `answers`; never sent to a client).
3. **`findCards` now selects only the card columns.** Before this change, it read every `applications` column, `answers` included, on every board load. Narrowing it is what makes "answers are not read" true at the database, not just in the fake.
   - **Kept as before:** the candidate is a plain `include('candidate')`, which reads the whole candidate row (a few small columns).
   - **Rejected:** `include('candidate', (c) => c.select('name'))`. The ORM types a refined include of this to-one relation as `{ name } | null` (`IncludeRefinementValue`, `orm-client.d.mts` l.984), while the plain include is non-null. Using it would add a null branch for a required FK, to save a few bytes.
4. **Skip the form lookup when no keys are stored.** Most Jobs have none, so their board load costs exactly what it did before: the narrower `findCards` and no extra query. A Job that has keys but no published form (not reachable today, because the save needs one) is handled the same way: `[]`.
5. **Mapping JSONB.** `answers as Answers` and `fields as FormFields` are casts, the same pattern as `findDetail` and `toFormVersion`. The data is validated when it is written.
6. **Web: page.tsx touched by one line.** `getPipelineBoard`'s return type changed, so the candidates page now destructures `{ columns }`. That is the narrowest edit that keeps it compiling; ticket 05 will use `highlightedQuestions` there. **Rejected:** keeping `getPipelineBoard` returning `PipelineColumn[]` and adding a second DAL function for the questions. That would mean two fetches of one response, or a second cached entry for the same request.

### Tests that went green at once

Slice 1 (no highlights: `{}`, answers not read) and slice 2 (only the Highlighted keys, formatted or `null`) went red, then green. Once slice 2's implementation resolved against each card's own version, the remaining cases passed when written:

- older version's labels
- a version lacking the Question
- a key that is non-highlightable in the old version
- each version read once
- stale keys
- a key that is non-highlightable in the latest form
- all keys stale (answers not read)
- form order and latest labels
- the 200-character cut
- 404
- an interviewer

To check that they can fail, I broke the service on purpose: resolving against the latest version instead of the card's own, and dropping the id dedupe. Exactly "own form version" and "reads each distinct form version once" failed, and both passed again after restoring.

### Queries checked against the dev DB

A read-only throwaway script (outside the repo) ran the three queries against the dev DB on a job with 10 Applications:

- `findCards` returned only `id, stageId, status, submittedAt, email, candidate`.
- `findCardsWithAnswers` added `formVersionId, answers`.
- `FormVersion.select('id','fields').where(v => v.id.in(ids))` returned one row per distinct id, and `fields` was an array.

The schema was not changed. I did not open the page in a browser: nothing renders yet, and ticket 05's implementer owns the dev ports.

### Docs relied on

- Prisma 8 ORM, `@prisma/orm-postgres` 8.0.0-rc.14. `apps/api/prisma-8.md` covers only the workflow, so I used the package's bundled guide, `apps/api/node_modules/@prisma/orm-postgres/skills/prisma-8/references/queries-postgres.md`:
  - "Workflow — ORM reads", l.28-63: `.select(...)` for projection, and the `.in([...])` operator.
  - "Workflow — Eager-loading relations", l.205-221: `.include` composes with `.select`.
- The types in `node_modules/.pnpm/@prisma+orm-family-sql@8.0._*/node_modules/@prisma/orm-family-sql/dist/orm-client.d.mts`:
  - `Collection.select` (l.999), whose result keeps the included relations.
  - `in(values: readonly T[])` (l.167).
  - The refined `include` overload (l.984).
- The query style `.where({...}).include(...).orderBy(...).all()` follows the existing `findCards` and CLAUDE.md "Database (Prisma 8)".
- Nest `ModuleMetadata`: see choice 1.
- Shared API, from ticket 01's Answer: `highlightableQuestions`, `formatHighlightText` (`packages/shared/src/highlights.ts`, `answer-text.ts`).
- `next typegen` before `tsc --noEmit` in a fresh worktree: `apps/web/node_modules/next/dist/docs/01-app/03-api-reference/06-cli/next.md`.

### Checks

- `pnpm --filter api test`: 16 files, 343 tests pass (`pipeline.board.spec.ts`: 13).
- `pnpm --filter @repo/shared test`: 15 files, 418 pass.
- `pnpm lint`: 0 errors. The warnings (api 10, web 2) were already there, none in files this ticket touches.
- `pnpm check-types`: ok.
- `tsc --noEmit` in `apps/api`: clean. In `apps/web` (after `next typegen`): clean.
- Prettier: I formatted only the new spec. The pipeline files, `forms.module.ts` and `dal.ts` were already not Prettier-clean at HEAD, so I left their formatting alone rather than add unrelated noise.

### Files

- Created `apps/api/src/pipeline/pipeline.board.spec.ts`: the board specs on in-memory fakes (no highlights, formatting, own version, missing Question, stale keys, form order, 200-character cut, one read per version, 404, interviewer).
- Modified `apps/api/src/pipeline/pipeline.ts`: `ApplicationCard.highlights`, plus the new `CardRow`, `CardRowWithAnswers` and `HighlightedQuestion` types.
- Modified `apps/api/src/pipeline/pipeline.service.ts`: `board` adds `highlightedQuestions` and each card's `highlights`, through two private helpers; `FormsRepository` is injected.
- Modified `apps/api/src/pipeline/pipeline.repository.ts`:
  - `findCards` selects the card columns only.
  - New `findCardsWithAnswers` and `findFormFields`.
  - A shared `toCardRow` mapper.
- Modified `apps/api/src/pipeline/pipeline.module.ts`: imports `FormsModule`.
- Modified `apps/api/src/forms/forms.module.ts`: exports `FormsRepository`.
- Modified `apps/api/src/pipeline/pipeline.files.spec.ts`: passes a stub `FormsRepository` for the service's new constructor argument.
- Modified `apps/web/lib/dal.ts`:
  - `ApplicationSummary.highlights`, and the new `HighlightedQuestion` and `PipelineBoardView` types.
  - `getPipelineBoard` returns `{ columns, highlightedQuestions }` and passes `highlights` through.
- Modified `apps/web/app/(dashboard)/dashboard/[companySlug]/jobs/[jobSlug]/candidates/page.tsx`: destructures `{ columns }` from the new return shape.
- Modified `.claude/rules/api.md`: the board payload under "Pipeline". `docs/db-schema.md` doesn't describe the board payload, so I left it unchanged.
- Modified `.scratch/highlighted-questions/issues/03-board-sends-highlighted-answers.md`: this Answer.
