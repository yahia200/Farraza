# 04: Reviewer reads number, date and URL answers

**What to build:** On the candidate sheet, a member reads Number, Date and URL answers in a form that fits each type, at the top level and inside Repeating group Entry blocks. Spec: `.scratch/question-types/spec.md`.

The `format-answer` helper (`apps/web/components/dashboard/candidates/format-answer.ts`) handles all three. A number is shown as entered; a date is shown in a readable form (decide the format and its doc reference, and keep it independent of the viewer's timezone since a date carries none); a URL is shown as a link with `target="_blank"` and `rel="noopener noreferrer"`. Only `http:` and `https:` links are ever rendered as links, even if bad data reaches the sheet.

**Blocked by:** 01.

**Status:** resolved

- [x] A number answer shows as entered, including `0`
- [x] A date answer shows as a readable date, the same calendar day for every viewer regardless of timezone
- [x] A URL answer shows as a clickable link opening in a new tab with `rel="noopener noreferrer"`
- [x] A URL value whose scheme is not `http:` or `https:` is shown as plain text, never as a link
- [x] Blank sub-answers inside an Entry are still left out of its block
- [x] An application shows the question labels the applicant saw, as for other types
- [x] Existing question types render exactly as before
- [x] Checked in the browser pane with an application that has all three at the top level and inside an Entry; no console errors
- [x] `pnpm lint` and `pnpm check-types` pass
- [x] `.claude/rules/web.md` is updated for the candidate sheet

## Comments

## Answer

`formatAnswer` now handles `number` (`String(value)`, so `0` shows), `date` (`Temporal.PlainDate.from(...).toLocaleString('en-US', { dateStyle: 'long' })`, e.g. "February 5, 2026"; fixed locale and no `Date` conversion, so every viewer shows the same day) and `url` (a `LinkAnswer { href, text }` only when `new URL()` parses with an `http:` or `https:` protocol, otherwise plain text). `CandidateAnswer` renders it as `<a target="_blank" rel="noopener noreferrer">`; Entries reuse it. Checked in the browser with all three at top level and in an Entry (including `0`, a `javascript:` value as plain text, a blank sub-answer left out); no console errors.
