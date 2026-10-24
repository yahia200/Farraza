# 04: Applicant answers Education entries

**What to build:** On the public apply page an applicant fills in as many Education Entries as they have and submits. Spec: `.scratch/repeating-groups/spec.md`; decision record: ADR-0004. Use the glossary terms Applicant, Repeating group and Entry.

A group is one step in the questionnaire, with a card per Entry inside it and "Add another" and "Remove" buttons. It is a custom control, like the CV and attachment steps, using the same technique of mirroring a value into a hidden input so the questionnaire can tell the step is answered. Do not make a step per Entry or per sub-question: the questionnaire's step list must match what it renders, and a changing list has caused render loops in this repo. Choice questions inside a card are plain controls (the questionnaire's letter shortcuts only work for top-level steps). A multiple-choice selection limit applies per Entry and must not use the page-wide locked-options state.

**Blocked by:** 03 (needs a published form with an Education group).

**Status:** resolved

- [ ] A required group starts with one empty card; an optional group starts with none and offers "Add"; "Add another" is disabled at the group's `maxEntries`
- [ ] The applicant can add, fill and remove cards; removing a card does not disturb the others' values
- [ ] An optional group can be skipped; a required group blocks Next until at least one Entry has an answer; a blank extra card does not block sending
- [ ] An Entry with some answers requires its required sub-questions; the error shows next to the exact input, inside the right card
- [ ] Single choice, multiple choice (including the selection limit, applied per Entry), short text, long text and yes/no work inside a card
- [ ] The step behaves like the others: back, next, skip when optional, progress, and no letter-shortcut or step-list errors in the console
- [ ] Submitting stores the Entries; the answers pass the shared package's parser unchanged (no client-only format)
- [ ] A server error with a group path sends the applicant back to the group's step and marks the right input in the right card
- [ ] Checked in the browser pane: apply with several Entries, try an incomplete Entry, try exceeding the maximum, submit, and force a server error; the pane shows no console errors
- [ ] `pnpm lint` and `pnpm check-types` pass; the web architecture notes describe the group step

## Comments

Resolved on `feat/repeating-groups` (commits d5d5c02, 31961a5). Design choices: one questionnaire step per group with a sr-only mirrored input (same as the CV and file steps); cards live in react-hook-form at `answers.<key>`; blank cards are kept as `{}` by `compactAnswers` so server error indexes match the on-screen cards; the per-Entry multiple-choice limit is computed in render, not in the page-wide locked-options state; Enter and letter shortcuts are stopped inside cards. Browser-checked on a scratch database including a forced server error with a group path and a phone viewport. Known gaps: focus after an error goes to the first input of the step, not the invalid card input; an optional single choice inside a card cannot be cleared (Remove the card). Sub-questions of yes/no, multiple-choice and long-text types were added by SQL in the scratch database because no shipped Preset has them yet.
