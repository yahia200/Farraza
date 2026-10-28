# Highlighted questions: review fixes

The code review ran against `82ee95d...3e40c15` on `feat/highlighted-questions`. This note covers the seven findings it asked to fix: what was done, the options weighed, and the docs relied on. Each fix is its own commit on the review-fix branch. The owner's calls were left alone: the `FormsRepository` wiring between `JobsModule` and `PipelineModule`, whether `isHighlightable` is exported, the `w-0 min-w-full` table wrapper and the picker's `collisionPadding`.

Test seams: the ones the task set, which are the repo's usual seams. That is the service through its public methods against an in-memory fake repository (`apps/api/src/pipeline/pipeline.board.spec.ts`, `apps/api/src/jobs/jobs.service.spec.ts`), and the shared pure functions (`packages/shared/src/answer-text.test.ts`). Findings 1, 5 and 6 went red, then green. Findings 2, 3, 4 and 7 are refactors, docs or markup with no test seam: tsc and lint cover them. No browser check was done.

## 1. `findFormFields` read form versions by id only (HARD)

- **Done:** `PipelineRepository.findFormFields(companyId, jobId, versionIds)` now filters `.where({ companyId, jobId })` and then `.where((v) => v.id.in(versionIds))`. It reads through a new private `formVersions` getter, like `applications`, `events`, `notes` and `files`. `PipelineService.board` passes `membership.company.id` and `job.id` down through `cardsOf`.
- **Test:** the fake repository stores each version's company and job and applies the same filter. A new spec seeds Applications that point at a version of another job and a version of another company: both cards read `null`.
- **Options:** (a) chain an object `where` with the lambda `where`, which is chosen; (b) a single lambda with `.and(...)`. (a) follows the existing pattern in `applications.repository.ts` (`.where({ companyId, jobId, status }).where((f) => f.id.in(ids))`).
- **Docs:** chained `where` calls are ANDed: `node_modules/.pnpm/@prisma+orm-family-sql@8.0._*/node_modules/@prisma/orm-family-sql/dist/orm-client.d.mts`, the `where` JSDoc ("Chained AND"). The rule is in `.claude/rules/api.md`, "Tenant isolation".
- **Not changed (worth a look):** `findCards(jobId)` and `findCardsWithAnswers(jobId)` also filter by `jobId` alone. The `jobId` comes from the company-scoped job lookup, so this is not a leak. It is still the same rule, and those two methods were outside this finding.

## 2. `PickerQuestion` duplicated `HighlightedQuestion`, and the projection was written twice

- **Done:** the picker takes `HighlightedQuestion[]` (a type-only import from `@/lib/dal`, as `candidate-card.tsx` already does from a client component), and `PickerQuestion` is gone. `lib/dal.ts` exports `toHighlightedQuestion({ key, label })`. `getPipelineBoard` and the candidates page both `.map(toHighlightedQuestion)`.
- **Options:** (a) delete the DAL's projection and keep the page's; (b) delete the page's; (c) one helper used by both, which is chosen. Each call has its own reason. The page's call stops whole Question objects, auto-reject rules included, from being serialised to the client picker, so it has to stay. The DAL's call follows the DAL's "expose only what the UI needs" habit for API payloads (it projects every column too). (c) keeps both behaviours and writes the projection once.

## 3. The reload message was written twice

- **Done:** `packages/shared/src/highlights.ts` exports `HIGHLIGHT_RELOAD_MESSAGE` (it was the private `RELOAD`). `apps/web/app/actions/jobs.ts` imports it for its fallback.
- **Options:** (a) export from shared, which is chosen: the action already imports `saveHighlightedQuestionsSchema` from `@repo/shared`. A `'use server'` file may import plain values; only its own exports must be async functions. (b) drop the `??` fallback. A failed Zod parse always has an issue, but `issues[0]` is typed `| undefined`, so the fallback would need a non-null assertion. (c) a web-only constant, which leaves the duplicate in place.
- The name follows `PASSWORD_SIGN_IN_REQUIRED_MESSAGE` in `packages/shared/src/oidc.ts`. The same text also appears in `packages/shared/src/files.ts` (`createUploadSchema`). That is out of this finding's scope and was left alone.

## 4. `docs/db-schema.md` §7: the column without an FK sat outside the list

- **Done:** `jobs.highlighted_question_keys` is now inside the parenthesised list. The sentence after it explains that the column holds Question keys in a JSONB array, checked when written.

## 5. A whitespace-only text answer showed blank instead of "—"

- **Done:** `formatHighlightText` returns `null` when `isBlankAnswer(line)` (`answers.ts`: spaces, line breaks or empty), not only for `''`. Text with words in it is still returned as written (not trimmed).
- **The sheet variant `formatAnswerText` is unchanged, on purpose.** The sheet must keep showing exactly what it showed before, and the sheet calls it directly (`apps/web/components/dashboard/candidates/format-answer.ts`, `formatLeaf`). Making blank text `null` there would turn a top-level spaces-only answer into "No answer" on the sheet. That change might be right, but it is a separate decision for the owner. A new test pins the current sheet behaviour (`''` and `'   '` come back as stored). The JSDoc of both functions now says which one handles blank text.
- **Tests:** `answer-text.test.ts`: blank text (`''`, spaces, `' \n\t '`, a blank URL) is `null` in the list, `'  Cairo '` stays as written in the list, and blank text stays as stored in the sheet variant.
- **Docs:** `String.prototype.trim` (used by `isBlankAnswer`) strips whitespace and line terminators: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/trim

## 6. 400 `errors[].path` shapes differed on `PUT .../highlighted-questions`

- **Before:** the validation pipe reported `keys` (over the cap) or `keys.<index>` (a repeat or a non-UUID), while the service's `checkHighlightKeys` errors were a bare `<index>`.
- **Consumers read:** the web action calls `failureFromResponse(response, [], ...)`. With no field names, `fromValidationErrors` (`apps/web/lib/action-failure.ts`) turns every error into `formError` by message, so the path is never read. The form-save route (`saveFormSchema`) checks only the list's length in the body schema (path `fields`), and its per-question paths come from `parseFormFields` in the service relative to the list. So it never has per-item paths from two sources, and the web builder prefixes them itself (`fields.${path}`).
- **Options:**
  - (a) Prefix the service's errors with `keys.` (chosen). One line in `JobsService`, and every path on the route then points into the request body, as the pipe's do. The shared `checkHighlightKeys` keeps its `<index>` convention, which is what the spec asks of it ("`<index>` paths like the other validators"). No consumer changes.
  - (b) Move the UUID and repeat checks out of the body schema into the service (body `keys: z.array(z.unknown()).max(...)`, like `saveFormSchema`), so every per-item path is `<index>`. This mirrors the form route more closely, but it changes the shared schema, the web action's re-validation and the shared tests, and moves validation out of the pipe. More invasive.
  - (c) Strip the `keys.` prefix in the exception factory. That is global and would change every route.
  - (d) Leave it and document it.
- **Tests:** `jobs.service.spec.ts` now expects `keys.0`, `keys.2` and `keys.1` from the service. The pipe's own expectations (`keys`, `keys.1`, `keys.0`) are unchanged.
- **Docs updated:** `.claude/rules/api.md`, the Highlighted questions route (`path: 'keys.<index>'`, and why). The shared-package paragraph still says `checkHighlightKeys` gives `<index>`, which is still true.

## 7. The column header tooltip trigger could not take keyboard focus

- **Done:** `TooltipTrigger render={<span tabIndex={0} />}` in `columns.tsx`, plus `rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30` (the Checkbox's focus ring). Focus opens the tooltip, so a cut-off Question can be read in full from the keyboard. The comment and the note in `.claude/rules/web.md` now say so.
- **Options:** (a) `tabIndex` on the `render` element, which is chosen; (b) `tabIndex` as a prop on `TooltipTrigger`, which Base UI would merge onto the element just the same; (c) go back to the default `<button>`, which would announce a control that does nothing. (a) matches Base UI's own example of putting element attributes on the `render` element (`<Menu.Item render={<a href=... />}>`).
- **Docs:** `apps/web/node_modules/@base-ui/react/docs/react/handbook/composition.md`, "Changing the default rendered element". `apps/web/node_modules/@base-ui/react/docs/react/components/tooltip.md` covers tooltips for "sighted mouse and keyboard users" (Usage guidelines, "Alternatives to tooltips") and lists the `trigger-focus` open reason. In `apps/web/node_modules/@base-ui/react/tooltip/trigger/TooltipTrigger.mjs`, the trigger wires `useFocus` but adds no `tabIndex`.
- **Not checked in the browser.** It was checked with tsc and ESLint only.

## Files touched

- `apps/api/src/pipeline/pipeline.repository.ts`: `findFormFields` takes and filters by `companyId` and `jobId`, and reads through a new `formVersions` getter (1).
- `apps/api/src/pipeline/pipeline.service.ts`: passes the company and job ids to `findFormFields` (1).
- `apps/api/src/pipeline/pipeline.board.spec.ts`: the fake stores each version's owner and filters like the SQL; new isolation test (1).
- `apps/web/lib/dal.ts`: new `toHighlightedQuestion`, used by `getPipelineBoard` (2).
- `apps/web/app/(dashboard)/dashboard/[companySlug]/jobs/[jobSlug]/candidates/page.tsx`: uses `toHighlightedQuestion` for the picker's Questions (2).
- `apps/web/components/dashboard/candidates/highlighted-questions-picker.tsx`: `PickerQuestion` removed; takes `HighlightedQuestion[]` (2).
- `packages/shared/src/highlights.ts`: `RELOAD` exported as `HIGHLIGHT_RELOAD_MESSAGE` (3).
- `apps/web/app/actions/jobs.ts`: the fallback uses `HIGHLIGHT_RELOAD_MESSAGE` (3).
- `docs/db-schema.md`: §7, `jobs.highlighted_question_keys` moved into the no-FK list (4).
- `packages/shared/src/answer-text.ts`: `formatHighlightText` makes blank text `null` via `isBlankAnswer`; both JSDocs updated (5).
- `packages/shared/src/answer-text.test.ts`: blank-text tests for both variants (5).
- `apps/api/src/jobs/jobs.service.ts`: prefixes the shared check's error paths with `keys.` (6).
- `apps/api/src/jobs/jobs.service.spec.ts`: expects `keys.<index>` from the service (6).
- `.claude/rules/api.md`: the `findFormFields` signature and filter (1), blank text in `formatHighlightText` (5), the route's `keys.<index>` paths (6).
- `apps/web/components/dashboard/candidates/columns.tsx`: header trigger `tabIndex={0}`, a focus ring, and the comment (7).
- `.claude/rules/web.md`: the column header note now says the header is keyboard-focusable (7).
- `.scratch/highlighted-questions/review-fixes.md`: this note.
