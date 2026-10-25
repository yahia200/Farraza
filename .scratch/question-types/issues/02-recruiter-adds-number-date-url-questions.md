# 02: Recruiter adds number, date and URL questions

**What to build:** Recruiters can add a Number, Date or URL question from the "Add question" menu and set its limits, save and publish it. Spec: `.scratch/question-types/spec.md`. Use the glossary term Question (not "field") in UI copy.

The question card gets a config editor for each type: for Number, a minimum, a maximum and a "whole numbers only" switch; for Date, an earliest and a latest date; for URL, none. Interviewers see the cards read-only like every other card. The three types are not offered an auto-reject rule.

**Blocked by:** 01.

**Status:** resolved

- [x] The "Add question" menu lists Number, Date and URL with an icon each, beside the existing types
- [x] Adding one appends a valid question with sensible defaults and opens its card
- [x] The Number card edits min, max and the whole-numbers switch; the Date card edits earliest and latest; the URL card has no extra settings
- [x] A bad setting (min above max, earliest after latest) shows the shared validation's message next to that setting
- [x] Changing a question's type to or from the new types, if the builder allows type changes, keeps the card consistent
- [x] Label, help text and required work as on other cards; unsaved edits are backed up like other questions (`use-form-backup.ts`)
- [x] No auto-reject control appears on any of the three
- [x] The three types can be sub-questions in a group only if a Preset defines them (the builder still cannot add sub-questions)
- [x] The read-only builder as an interviewer shows the three cards
- [x] Checked in the browser pane (add each, set limits, trigger each error, save, reload, publish, interviewer view); no console errors
- [x] `pnpm lint` and `pnpm check-types` pass
- [x] `.claude/rules/web.md` is updated for the new builder pieces

## Comments

## Answer
Added Number, Date and Link (URL) to the builder: FIELD_TYPES/newField entries in field-types.ts (the menu derives from FIELD_TYPES), and limits-config-editor.tsx with NumberConfigEditor and DateConfigEditor mounted from question-card.tsx. No auto-reject control; the builder has no type switching; sub-questions only come from Presets (SubQuestionRow already renders any leaf type). Checked in the browser as owner and as interviewer: add each, set limits, both min/max errors show beside the setting, save, reload, publish, read-only view; no console errors. pnpm lint passes; tsc leaves only pre-existing errors and ticket 04 format-answer.ts.
