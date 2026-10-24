# 03: Recruiter adds the Education preset

**What to build:** A recruiter opens a job's form builder, picks **Education** from a new "Presets" group in the "Add question" menu, edits it a little, saves and publishes. Spec: `.scratch/repeating-groups/spec.md`; decision record: ADR-0004. Use the glossary terms Preset, Repeating group and Preset key.

Inserting copies the Preset into the form: the group, every sub-question and every option get fresh ids, and every question gets its Preset key from the catalog. The form keeps no link back to the Preset's definition. The preset definition lives in the web app beside where new questions are created. The Education contents are in the spec: group "Education", optional, up to 5 Entries; School, Degree (High school, Diploma, Bachelor's, Master's, Doctorate, Other), Field of study, Start year, End year.

Prefactor as part of this ticket: the builder card edits nested config through one path helper that is cast once; generalise it so a group card can edit its sub-questions in place without copying that cast.

**Blocked by:** 01, 02.

**Status:** resolved

- [ ] The "Add question" menu has a "Presets" group below the question types, containing Education; choosing it appends the group to the form and opens its card
- [ ] Once Education is on the form its menu item is greyed out; it becomes available again if the group is deleted
- [ ] The group counts as one question toward the form's question limit, and the menu's limit behaviour is unchanged
- [ ] The group card lists its sub-questions; the recruiter can edit the group's label, help text, `required` and `maxEntries`, and each sub-question's label, help text and `required`
- [ ] The recruiter cannot add, remove or reorder sub-questions, change their types, or edit the Degree options; there is no way to create a blank group
- [ ] An invalid setting (empty label, `maxEntries` out of range) shows its error next to the setting, using the shared package's messages; a group or sub-question with an error opens itself
- [ ] The group can be moved and deleted like any other question
- [ ] Interviewers (people who can't manage jobs) see the group read-only: the card opens and shows everything, controls cannot be changed, and move, delete and add are hidden
- [ ] Unsaved edits to the group are backed up and restored like other questions
- [ ] Save draft, publish, reload and reopen round-trips the group and its Preset keys unchanged; API errors with group paths land on the right control
- [ ] Checked in the browser pane: insert, edit, trigger an error, save, publish, reload, and view as an interviewer; the pane shows no console errors
- [ ] `pnpm lint` and `pnpm check-types` pass; the web architecture notes describe the Presets menu and the group card

## Comments

Resolved on `feat/repeating-groups` (commits 1ad5958, 4f52755, 88aa26a). Design choices: path helper is `at(prefix, rest)` in `field-types.ts`, cast once; Preset definitions live in `form-builder/presets.ts` as `build()` functions (fresh ids per insert); the group card reuses the `QuestionCard` shell with a `GroupEditor` body and collapsible sub-question rows. Browser-checked on a scratch database: insert, greyed-out, edit, error-opening, backup restore, save, publish, reload, interviewer read-only, no console errors. Not observed end to end: a server rejection with a group path (the client validates first); that mapping is reasoned from the existing `fields.${path}` code.
