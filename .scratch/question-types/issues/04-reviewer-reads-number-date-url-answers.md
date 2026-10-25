# 04: Reviewer reads number, date and URL answers

**What to build:** On the candidate sheet, a member reads Number, Date and URL answers in a form that fits each type, at the top level and inside Repeating group Entry blocks. Spec: `.scratch/question-types/spec.md`.

The `format-answer` helper (`apps/web/components/dashboard/candidates/format-answer.ts`) handles all three. A number is shown as entered; a date is shown in a readable form (decide the format and its doc reference, and keep it independent of the viewer's timezone since a date carries none); a URL is shown as a link with `target="_blank"` and `rel="noopener noreferrer"`. Only `http:` and `https:` links are ever rendered as links, even if bad data reaches the sheet.

**Blocked by:** 01.

**Status:** ready-for-agent

- [ ] A number answer shows as entered, including `0`
- [ ] A date answer shows as a readable date, the same calendar day for every viewer regardless of timezone
- [ ] A URL answer shows as a clickable link opening in a new tab with `rel="noopener noreferrer"`
- [ ] A URL value whose scheme is not `http:` or `https:` is shown as plain text, never as a link
- [ ] Blank sub-answers inside an Entry are still left out of its block
- [ ] An application shows the question labels the applicant saw, as for other types
- [ ] Existing question types render exactly as before
- [ ] Checked in the browser pane with an application that has all three at the top level and inside an Entry; no console errors
- [ ] `pnpm lint` and `pnpm check-types` pass
- [ ] `.claude/rules/web.md` is updated for the candidate sheet

## Comments
