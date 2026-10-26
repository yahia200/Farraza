# 03: Applicant answers number, date and URL questions

**What to build:** On the public apply page, an applicant can answer Number, Date and URL questions, at the top level and inside a Repeating group's Entry cards. Spec: `.scratch/question-types/spec.md`.

A number input that only takes numbers, a date input (the platform date picker, which yields `YYYY-MM-DD`), and a link input, each showing the shared validation's message next to the box and the allowed range or earliest/latest date as hint text. The group step renders them in an Entry card with no group-specific code (`question-step.tsx`, `group-step.tsx`, `apply-values.ts`).

**Blocked by:** 01.

**Status:** resolved

- [x] A Number question renders a numeric input; `0` is kept as an answer and not treated as blank; the min, max and whole-numbers rule show as hint text
- [x] A Date question renders a date input; the earliest and latest date show as hint text and limit the picker where the platform allows it
- [x] A URL question renders a link input; a value that is not an `http:` or `https:` address shows an error next to the box
- [x] Required and optional behave as on other steps (skip when optional, blocked when required and empty)
- [x] Inside an Entry card the three render and report errors next to the exact box, with the path `<groupKey>.<index>.<childKey>`
- [x] A server rejection of an answer sends the applicant back to the step with the error
- [x] The date check works in the browsers the owner chose in ticket 01 for Temporal support
- [x] Checked in the browser pane: apply with a valid value of each type, then a wrong value in each (below min, `2026-02-30` typed or pasted if the control allows it, `javascript:alert(1)` as a link), at top level and inside an Entry; no console errors
- [x] `pnpm lint` and `pnpm check-types` pass
- [x] `.claude/rules/web.md` is updated for the new apply-page inputs

## Comments

## Answer

Number, Date and URL steps render at the top level (`QuestionStep`) and inside Entry cards (`SubQuestionControl`). The form keeps the box text and `compactAnswers(answers, fields)` converts a Number to a JSON number (`0` kept); `limit-hint.ts` gives the hint lines. Checked in the browser (Chrome 152, native Temporal; the polyfill path was not exercised): below/above max, 2.5 with whole numbers, `0`, date before min, `javascript:alert(1)` and `ftp:` links, blank required and optional, a server rejection inside an Entry (form changed in the DB after load), no new console errors. `pnpm lint` passes; `tsc` only shows the PageProps errors and exhaustiveness errors in ticket 02/04 files (`field-types.ts`, `format-answer.ts`).
