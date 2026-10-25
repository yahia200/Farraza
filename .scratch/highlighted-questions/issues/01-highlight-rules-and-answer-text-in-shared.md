# 01: Highlight rules and answer text in the shared package

**What to build:** `@repo/shared` gains the pure rules for Highlighted questions and the one place that turns a single-answer Question's answer into text. Nothing user-visible changes yet except that the candidate sheet now uses the shared formatter. Spec: `.scratch/highlighted-questions/spec.md` ("Concept and rules").

- **Rules:** `HIGHLIGHT_LIMIT = 3`; a predicate for "can this Question be highlighted" (top-level `short_text`, `long_text`, `single_select`, `multi_select`, `yes_no`, `number`, `date`, `url`; never `repeating_group`, a sub-question of a group, or `file`); a function listing a form's highlightable Questions in form order; a Zod schema for the stored list (at most 3, unique, UUIDs; the request body that wraps it is a `z.strictObject`); and a pure function that checks a key list against a form's fields and returns the valid keys or `{ path, message }` errors.
- **Answer text:** move the text formatting for single-answer Questions out of `apps/web/components/dashboard/candidates/format-answer.ts` (`formatLeaf`) and `formatIsoDate` out of `apps/web/lib/format.ts` into `@repo/shared`, next to `dates.ts`. Add the list's variant: a multi-select joined by `, `, a link as plain trimmed text, `null` for no answer, cut at a shared 200-character constant with `…` appended (count characters, not UTF-16 units). The web `formatAnswer` calls the shared function and keeps only its sheet extras (`LinkAnswer`, groups, files). Decide the exported signatures and record them, with the doc reference, in the ticket's Answer.

**Blocked by:** none.

**Status:** needs-triage

- [ ] `HIGHLIGHT_LIMIT` and the highlightable predicate are exported and cover all ten question types, a group's sub-question included
- [ ] The highlightable list for a form is in form order
- [ ] The key-list schema refuses more than 3, duplicates and non-UUIDs
- [ ] The key check refuses a key not on the form, and a key whose Question is a group, a sub-question or a file, with a path per bad key
- [ ] The shared text formatter covers each single-answer type: a choice becomes its label and an unknown id is `Unknown option`; `Yes`/`No`; `0` stays `0`; a date reads like `February 5, 2026`; a multi-select; a link; no answer is `null`
- [ ] The list variant joins a multi-select with `, `, and cuts at 200 characters with `…` without splitting a surrogate pair
- [ ] The candidate sheet shows exactly what it showed before (same labels, same date format, same link handling)
- [ ] Tests in `packages/shared/src/` for every item above (`pnpm --filter @repo/shared test`); the `@repo/shared` build is rerun so the API sees the new exports
- [ ] `pnpm lint` and `pnpm check-types` pass
- [ ] Docs referenced for every library call; `Temporal` stays unpolyfilled in `@repo/shared`

## Comments

## Answer

Built test-first (red, then green, one slice at a time) through the public functions only. The seams tested are the ones the spec's "Testing Decisions" list, which the owner already approved, so I did not propose new ones.

### Exported names and signatures

From `packages/shared/src/highlights.ts`:

- `HIGHLIGHT_LIMIT = 3`.
- `highlightableQuestions(fields: readonly FormField[]): LeafFormField[]`: a form's top-level Questions whose type is one of the eight single-answer types, in form order. File Questions, Repeating groups and a group's sub-questions are left out. The picker (ticket 04) and the board (ticket 03, latest published form) both call this one function.
- `isHighlightable(fields: readonly FormField[], key: string): boolean`: the predicate.
  - **Chosen:** it takes the form and a key, not a single field. A sub-question is a `LeafFormField` with nothing on it to mark it as inside a group, so `isHighlightable(field)` would answer `true` for a `short_text` sub-question. The acceptance criterion says the predicate must refuse that.
  - **Rejected:** `isHighlightable(field)` plus a "top-level only" rule written in a comment, because the rule would rest on callers remembering it. Also rejected: a third export `findHighlightable(fields, key)`. The API can write `highlightableQuestions(version.fields).find((q) => q.key === key)`, so a third function adds surface with no new behaviour.
- Types are an **allowlist** (`HIGHLIGHTABLE_TYPES`), not "everything except `file` and `repeating_group`". A Question type added later is then not highlightable until someone decides how it reads on one line.
- `highlightedQuestionKeysSchema`: `z.array(z.uuid()).max(HIGHLIGHT_LIMIT)` with a `superRefine` that reports each repeat at its own index (path `[index]`).
  - Messages: over the cap is "Choose up to 3 questions." (path `[]`). A non-UUID or a repeat is the generic "Something went wrong. Reload the page and try again.", because keys come from the picker, not from typing (`files.ts` uses the same wording).
  - Order carries no meaning: the list is always shown in form order.
- `checkHighlightKeys(keys: readonly string[], fields: readonly FormField[]): HighlightKeysResult`, where `HighlightKeysResult = { ok: true; keys: string[] } | { ok: false; errors: FieldError[] }`.
  - It reports one error per bad key, with path `String(index)`, the same `<index>` convention as `parseFormFields`.
  - A key that isn't on the form (top level or inside a group) gets "This question isn't on the published form. Reload the page and try again."
  - A key that is on the form but can't be highlighted (group, sub-question, file) gets "This question can't be shown in the list."
  - It returns the keys **unchanged** (same order).
  - **Rejected:** taking `unknown` and running the schema inside it, the way `parseAnswers` does. The Nest pipe already applies the body schema before the service runs, so the check only does what the schema can't: compare against the form. The schema and the check are tested as separate seams.
  - **Rejected:** returning the keys sorted into form order. The board re-sorts on every read, so the stored order never shows anywhere.

From `packages/shared/src/jobs.ts` (request bodies live here, per `.claude/rules/api.md` "`@repo/shared`"):

- `saveHighlightedQuestionsSchema = z.strictObject({ keys: highlightedQuestionKeysSchema })` and `SaveHighlightedQuestionsInput`. Ticket 02's DTO can re-export them.

From `packages/shared/src/answer-text.ts`:

- `formatAnswerText(field: LeafFormField, value: AnswerValue | undefined): string | string[] | null` is the shared text rules, moved unchanged from the web `formatLeaf`:
  - text as stored; `Yes`/`No`; `String(number)`, so `0` is `"0"`; the long date; a single choice's label; a multi-select's labels as an array; `Unknown option` for an id the version doesn't have; `null` for no answer or a value of the wrong shape.
  - A URL comes back as the stored string. Whether to make it a link is the caller's choice: the sheet does, the list doesn't.
- `formatHighlightText(field: LeafFormField, value: AnswerValue | undefined): string | null` is the list variant.
  - It takes the same text, joins a multi-select with `", "`, trims a link, and returns `null` when there is no answer. An empty join also returns `null`, so the web shows "—" instead of an empty cell.
  - It cuts text longer than `HIGHLIGHT_MAX_CHARACTERS` (200) to its first 200 characters and appends `…`. Text of exactly 200 characters is unchanged.
  - **Chosen:** characters are Unicode code points (`Array.from(text)`), so a surrogate pair is never split.
  - **Rejected:** grapheme clusters (`Intl.Segmenter`). The spec asks only that a surrogate pair isn't split, and segmenting is slower on every card. The cost: a multi-code-point emoji (a ZWJ family, a flag) that sits exactly at the cut can still be split between its code points. **Owner may want to review this.**
- `HIGHLIGHT_MAX_CHARACTERS = 200`. I named it apart from `HIGHLIGHT_LIMIT` (3) so the two numbers can't be confused.

From `packages/shared/src/dates.ts` (exported by name from `index.ts`, so `parseIsoDate` and the others stay internal):

- `formatIsoDate(value: string): string`, moved unchanged from `apps/web/lib/format.ts`. It still uses plain `Temporal` with no polyfill.

Web:

- `formatLeaf` in `format-answer.ts` keeps only the sheet's extra: a string URL becomes `formatUrl(value)` (a `LinkAnswer` for http/https, otherwise the raw text). Everything else goes through `formatAnswerText`.
- `limit-hint.ts` now imports `formatIsoDate` from `@repo/shared`.
- I checked that the sheet's output is the same: a throwaway script compared the HEAD `formatLeaf` with the new one over 8 types × 22 values (undefined, null, blanks, 0, NaN, Infinity, booleans, arrays, invalid dates, http/https/javascript:/ftp links, untrimmed links). Result: 176 cases, 0 mismatches. I did not open the sheet in a browser.

### Docs relied on

- Zod 4.4.3: `packages/shared/node_modules/zod/v4/classic/schemas.d.ts` (`uuid` l.189, `array` l.447, `.max` l.441, `superRefine` l.39, `strictObject` l.491). The online pages https://zod.dev/api#arrays and https://zod.dev/api#refinements are from memory; I didn't open them. The `.d.ts` is what I checked.
- `Temporal.PlainDate.from` / `toLocaleString`: `packages/shared/node_modules/typescript/lib/lib.esnext.temporal.d.ts` (TypeScript 6.0.3: `overflow` l.100, `toLocaleString` l.171); https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/PlainDate/toLocaleString. Node 26.12.1 has native Temporal, so the tests run unpolyfilled.
- Counting code points: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/Symbol.iterator (`Array.from` uses the string iterator).
- `next typegen`, to generate the route types (`PageProps` etc.) that a fresh worktree lacks before `tsc --noEmit` in `apps/web`: `apps/web/node_modules/next/dist/docs/01-app/03-api-reference/06-cli/next.md`.

### Checks

- `pnpm --filter @repo/shared build`: ok.
- `pnpm --filter @repo/shared test`: 15 files, 418 tests pass.
- `pnpm lint`: 0 errors. The warnings were already there, in files this ticket doesn't touch.
- `pnpm check-types`: ok. Turbo only runs it in `@repo/shared`, because `api` and `web` have no `check-types` script. I also ran `tsc --noEmit` in `apps/api` and in `apps/web` (after `next typegen`): both clean.

### Files

- Created `packages/shared/src/highlights.ts`: `HIGHLIGHT_LIMIT`, the highlightable list and predicate, the key-list schema and `checkHighlightKeys`.
- Created `packages/shared/src/highlights.test.ts`: tests for the predicate (all ten types, a sub-question, an unknown key), form order, the schema (cap, repeats, non-UUIDs, the strict body) and the key check.
- Created `packages/shared/src/answer-text.ts`: `formatAnswerText`, `formatHighlightText` and `HIGHLIGHT_MAX_CHARACTERS`.
- Created `packages/shared/src/answer-text.test.ts`: one case per type for both formatters, plus the 200-character cut and the surrogate pair.
- Modified `packages/shared/src/dates.ts`: received `formatIsoDate`, moved from the web app.
- Modified `packages/shared/src/jobs.ts`: added `saveHighlightedQuestionsSchema` / `SaveHighlightedQuestionsInput`, the request body for ticket 02.
- Modified `packages/shared/src/index.ts`: exports the two new modules and `formatIsoDate`.
- Modified `apps/web/components/dashboard/candidates/format-answer.ts`: `formatLeaf` calls the shared formatter and keeps only the `LinkAnswer` extra.
- Modified `apps/web/lib/format.ts`: removed `formatIsoDate`, which now lives in `@repo/shared`.
- Modified `apps/web/components/apply/limit-hint.ts`: imports `formatIsoDate` from `@repo/shared` instead of `@/lib/format`.
- Modified `.scratch/highlighted-questions/issues/01-highlight-rules-and-answer-text-in-shared.md`: this Answer.
