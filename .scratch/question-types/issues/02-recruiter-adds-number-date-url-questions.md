# 02: Recruiter adds number, date and URL questions

**What to build:** Recruiters can add a Number, Date or URL question from the "Add question" menu and set its limits, save and publish it. Spec: `.scratch/question-types/spec.md`. Use the glossary term Question (not "field") in UI copy.

The question card gets a config editor for each type: for Number, a minimum, a maximum and a "whole numbers only" switch; for Date, an earliest and a latest date; for URL, none. Interviewers see the cards read-only like every other card. The three types are not offered an auto-reject rule.

**Blocked by:** 01.

**Status:** ready-for-agent

- [ ] The "Add question" menu lists Number, Date and URL with an icon each, beside the existing types
- [ ] Adding one appends a valid question with sensible defaults and opens its card
- [ ] The Number card edits min, max and the whole-numbers switch; the Date card edits earliest and latest; the URL card has no extra settings
- [ ] A bad setting (min above max, earliest after latest) shows the shared validation's message next to that setting
- [ ] Changing a question's type to or from the new types, if the builder allows type changes, keeps the card consistent
- [ ] Label, help text and required work as on other cards; unsaved edits are backed up like other questions (`use-form-backup.ts`)
- [ ] No auto-reject control appears on any of the three
- [ ] The three types can be sub-questions in a group only if a Preset defines them (the builder still cannot add sub-questions)
- [ ] The read-only builder as an interviewer shows the three cards
- [ ] Checked in the browser pane (add each, set limits, trigger each error, save, reload, publish, interviewer view); no console errors
- [ ] `pnpm lint` and `pnpm check-types` pass
- [ ] `.claude/rules/web.md` is updated for the new builder pieces

## Comments
