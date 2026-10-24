# Repeating groups are one generic question type, not a type per topic

Status: accepted

Applicants must be able to list several jobs and several degrees, and recruiters insert Education and Experience from built-in Presets. We add one new question type, `repeating_group`, whose answer is an array of Entries (each an object keyed by the sub-question's key) and whose sub-questions are ordinary leaf questions. Education and Experience are Presets that expand into one; they are not types of their own.

Considered options:

- **Presets that expand into plain flat questions** — no schema change, but one entry only: an applicant cannot list a second job. Rejected because several jobs is a must-have.
- **A composite type per topic (`education`, `experience`)** — nested answers too, but each type hard-codes its sub-fields, so the new `number`, `date` and `url` types (another ticket) would mean editing every composite type and migrating stored answers, and every future topic is new code in the validator, the apply step and the candidate sheet.
- **One generic `repeating_group`** — chosen. Sub-questions are the existing validators, so new leaf types become usable inside groups for free, and a new Preset is data, not a code path.

v1 limits, deliberately narrow so they can widen later without breaking stored data:

- Sub-questions are `short_text`, `long_text`, `single_select`, `multi_select` or `yes_no`: no `file`, no nested group, and no auto-reject rules inside a group (the schema refuses them).
- `required` on the group means at least one Entry; the config has `maxEntries` (1–10) and no minimum. Fully blank Entries are dropped on submit.
- The builder only offers Presets. Recruiters can edit labels, help text and `required` on a preset group and its sub-questions, plus `maxEntries`; they cannot add, remove or reorder sub-questions or edit option lists.
- On the apply page a group is one step with Entry cards inside it, not one step per Entry.

Every Question carries an optional `presetKey` (`education`, `education.school`, `notice_period`, and so on; null when built by hand) so CV autofill (ADR-0002) can recognise a Question after it is relabelled. Published form versions are immutable, so a tag not written at insert time can never be added to them. `@repo/shared` holds an append-only catalog mapping each key to the type it must have, and the schema refuses an unknown key or a mismatch; a top-level key can appear once per form. Autofill matches a single-select's options by the Preset's exact labels, which recruiters cannot edit.

Consequences: `AnswerValue` becomes recursive, so `checkValue`, `formatAnswer`, the apply step and the error paths (`<groupKey>.<index>.<childKey>`) all gain a second level. The Questionnaire's letter-shortcut choices only work for top-level steps, so choices inside a group are plain controls. Because the catalog is append-only, retiring a preset later means leaving its key in place.
