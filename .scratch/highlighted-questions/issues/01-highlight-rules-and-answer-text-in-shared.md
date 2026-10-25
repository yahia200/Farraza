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
