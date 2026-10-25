# 05: Reviewer reads Education entries on the candidate sheet

**What to build:** A member opening a candidate sees the applicant's Education Entries as readable blocks. Spec: `.scratch/repeating-groups/spec.md`; decision record: ADR-0004. Use the glossary terms Application, Repeating group and Entry.

Each Entry shows as its own block of label and answer rows. The labels come from the form version the applicant saw (stored with the application), not the job's current form, so a later relabel never changes what an old application appears to say. Blank sub-answers are skipped, and choice answers show as their labels. The answer-formatting step used by the sheet currently returns text or a list of text for a single question; widen it so a group's answer can be shown without turning it into one string.

**Blocked by:** 04 (needs an Application with group answers).

**Status:** resolved

- [x] The Answers section shows a group as a heading (the question's label) followed by one block per Entry, in the order the applicant gave them
- [x] Each block shows the sub-question label and the answer for every answered sub-question; blank ones are skipped, and a multiple-choice answer lists its option labels
- [x] An application whose form version has since been relabelled or whose option was later renamed still shows the labels the applicant saw; an unknown option shows as "Unknown option", as today
- [x] An optional group the applicant skipped is not shown as an empty section (or shows the existing "no answer" treatment for unanswered questions)
- [x] Interviewers see the same blocks as recruiters
- [x] Existing question types render exactly as before
- [x] Checked in the browser pane against an application submitted in ticket 04: several Entries, a skipped optional group, and an interviewer's view; the pane shows no console errors
- [x] `pnpm lint` and `pnpm check-types` pass

## Comments

Resolved on `feat/repeating-groups` (commits b3d37e1, 434a4c6). Design choices: `formatAnswer` returns `string | string[] | GroupAnswer | null` (a tagged `{ entries }` object, never one string); a new `CandidateAnswer` component renders every answer; labels come from the form version stored with the application; a skipped group shows the existing "No answer". Browser-checked on a scratch database: several Entries, a skipped group, a relabelled form (old application keeps the old labels), unknown option ids, the interviewer view, a 375px sheet. The relabel and unknown-option cases used SQL-edited data. No web test was added (no runner by decision).
