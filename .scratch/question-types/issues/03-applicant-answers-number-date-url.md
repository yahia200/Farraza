# 03: Applicant answers number, date and URL questions

**What to build:** On the public apply page, an applicant can answer Number, Date and URL questions, at the top level and inside a Repeating group's Entry cards. Spec: `.scratch/question-types/spec.md`.

A number input that only takes numbers, a date input (the platform date picker, which yields `YYYY-MM-DD`), and a link input, each showing the shared validation's message next to the box and the allowed range or earliest/latest date as hint text. The group step renders them in an Entry card with no group-specific code (`question-step.tsx`, `group-step.tsx`, `apply-values.ts`).

**Blocked by:** 01.

**Status:** ready-for-agent

- [ ] A Number question renders a numeric input; `0` is kept as an answer and not treated as blank; the min, max and whole-numbers rule show as hint text
- [ ] A Date question renders a date input; the earliest and latest date show as hint text and limit the picker where the platform allows it
- [ ] A URL question renders a link input; a value that is not an `http:` or `https:` address shows an error next to the box
- [ ] Required and optional behave as on other steps (skip when optional, blocked when required and empty)
- [ ] Inside an Entry card the three render and report errors next to the exact box, with the path `<groupKey>.<index>.<childKey>`
- [ ] A server rejection of an answer sends the applicant back to the step with the error
- [ ] The date check works in the browsers the owner chose in ticket 01 for Temporal support
- [ ] Checked in the browser pane: apply with a valid value of each type, then a wrong value in each (below min, `2026-02-30` typed or pasted if the control allows it, `javascript:alert(1)` as a link), at top level and inside an Entry; no console errors
- [ ] `pnpm lint` and `pnpm check-types` pass
- [ ] `.claude/rules/web.md` is updated for the new apply-page inputs

## Comments
