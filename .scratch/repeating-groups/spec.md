Status: ready-for-agent

# Repeating groups and presets for application forms

Related: ADR-0004 (`docs/adr/0004-repeating-group-as-generic-question-type.md`), ADR-0002 (CV as a built-in slot, and the planned CV autofill), and the glossary terms Question, Repeating group, Entry, Preset and Preset key.

## Problem Statement

Recruiters keep rebuilding the same questions on every job's form, and the two they rebuild most, education and work experience, can't be built at all. A form is a flat list of single-answer Questions, so an applicant can give one school or one job but not the several they actually have. A recruiter who wants a work history either asks one big free-text question and gets unstructured prose back, or leaves the history to the CV. Recruiters also have no way to mark a Question as "this asks for a school", which blocks the planned CV autofill from ever knowing where to put a parsed value.

## Solution

Recruiters can add a Preset from a new "Presets" group in the "Add question" menu. The first two Presets are **Education** and **Experience**, each a **Repeating group**: the applicant fills in as many Entries as they have (up to a limit the recruiter sets), each Entry answering the same few sub-questions (school, degree, and so on). On the apply page a Repeating group is one step with a card per Entry and "Add another" and "Remove" buttons. On the candidate sheet each Entry shows as a block of label and answer rows.

Every Question that came from a Preset carries a **Preset key** that survives relabelling, so a future CV autofill can recognise a school or a job title wherever the recruiter has placed it. Presets are built in only; recruiters can't save their own yet.

## User Stories

1. As a recruiter, I want to add an Education Preset to a job's form, so that I don't build school, degree and year questions by hand every time.
2. As a recruiter, I want to add a Work experience Preset to a job's form, so that applicants describe their work history in a consistent structure.
3. As a recruiter, I want the Presets in the same "Add question" menu as the question types, so that I find them without learning a new part of the builder.
4. As a recruiter, I want a Preset that is already on the form to be greyed out in the menu, so that I can't add the same Preset twice by accident.
5. As a recruiter, I want an inserted Preset to start as optional, so that applicants without a degree or without work experience aren't blocked from applying.
6. As a recruiter, I want to make a Repeating group required, so that every applicant must give at least one Entry when the role needs it.
7. As a recruiter, I want to set the maximum number of Entries (1 to 10), so that I can ask for "your last three jobs" and no more.
8. As a recruiter, I want to rename the group and its sub-questions, so that "School" can say "University" for my company.
9. As a recruiter, I want to edit the group's and each sub-question's help text, so that I can tell applicants how to format a date.
10. As a recruiter, I want to mark an individual sub-question as optional or required, so that I decide whether, for example, a field of study is needed.
11. As a recruiter, I want the sub-questions' order and types to stay fixed, so that an inserted Preset stays recognisable and can't be broken by a mis-edit.
12. As a recruiter, I want the degree choices to stay fixed, so that candidates' degrees are comparable across applications.
13. As a recruiter, I want a Repeating group to count as one question toward the form's question limit, so that adding Education doesn't eat five slots.
14. As a recruiter, I want to move and delete a Repeating group like any other question, so that the form stays easy to arrange.
15. As a recruiter, I want a Repeating group saved, backed up and published like any other question, so that nothing about my workflow changes.
16. As a recruiter, I want unsaved edits to a Repeating group backed up like other questions, so that I don't lose work if the tab closes.
17. As a recruiter, I want a clear error next to the setting that is wrong (an invalid Entry limit, an empty label), so that I can fix it without guessing.
18. As a recruiter, I want a published form to stay unchanged when I later edit the draft, so that applicants who already applied are still shown what they answered.
19. As an interviewer, I want to see a form's Repeating groups in the builder read-only, so that I understand what applicants were asked without being able to change it.
20. As an applicant, I want to add several jobs on one step, so that I can describe my whole work history.
21. As an applicant, I want to add several degrees on one step, so that I can list everything I studied.
22. As an applicant, I want an "Add another" button that opens a fresh card, so that adding an Entry is obvious.
23. As an applicant, I want to remove an Entry I added by mistake, so that I don't have to reload the form.
24. As an applicant, I want a required group to start with one empty card, so that I can see what it is asking and start typing.
25. As an applicant, I want an optional group to start with no cards and an "Add" button, so that I can skip it without clearing anything.
26. As an applicant, I want to leave an extra card blank and still submit, so that a stray "Add another" doesn't produce an error.
27. As an applicant, I want an error next to the exact box that is wrong inside a card, so that I know which job or degree needs attention.
28. As an applicant, I want to be sent back to the step with an error when the server rejects my answers, so that I can fix it and resend.
29. As an applicant, I want to choose one or several options inside an Entry, so that I can pick my degree level or tick several choices where a Preset allows it.
30. As an applicant, I want a multiple-choice limit inside a card to apply to that card only, so that my second Entry isn't blocked by my first.
31. As an applicant, I want a group's step to behave like the other steps (back, next, skip when optional, progress), so that the form feels consistent.
32. As an applicant, I want to be stopped from adding more Entries than the recruiter allows, so that I know the limit before I hit an error.
33. As a candidate-reviewing member, I want each Entry shown as its own block of label and answer rows on the candidate sheet, so that I can read a work history at a glance.
34. As a candidate-reviewing member, I want blank sub-answers left out of an Entry's block, so that the sheet isn't full of empty rows.
35. As a candidate-reviewing member, I want choice answers shown as their labels, so that I read "Bachelor's" and not an id.
36. As a candidate-reviewing member, I want an application to show the sub-question labels the applicant actually saw, so that a later relabel doesn't change what an old application appears to say.
37. As a recruiter, I want no auto-reject rule inside a group, so that I'm not misled into thinking a rule there would work.
38. As a maintainer, I want one Preset key on every Question that came from a Preset, so that features like CV autofill can recognise a school or notice period after the recruiter relabels it.
39. As a maintainer, I want the shared schema to refuse an unknown Preset key or a key on the wrong question type, so that autofill can trust a tag.
40. As a maintainer, I want a Preset to appear at most once per form, so that autofill never has to guess which Education group to fill.
41. As a maintainer, I want the Preset key catalog to be append-only, so that an old published form can still be loaded and edited after a Preset is retired.
42. As a maintainer, I want to add a future Preset (a group or a single question) by adding a catalog entry and a definition, so that new Presets don't need new validation or apply-page code.
43. As a maintainer, I want Repeating groups to reuse the existing leaf-question validation, so that a new leaf type added later works inside groups with no group-specific code.
44. As a maintainer, I want the applicant-facing form payload to carry groups without any recruiter-only data, so that nothing private leaks to applicants.
45. As a maintainer, I want all the rules in the shared package, so that the builder, apply page and API agree because they run the same checks.

## Implementation Decisions

**New question type and answer shape**

- A new question type, `repeating_group`, joins the existing six. It has the usual base properties (key, label, help text, `required`) plus a config of sub-questions and `maxEntries`.
- The answer to a group is an array of Entries. Each Entry is an object keyed by the sub-question's key. Array order is display order. Entries have no ids of their own.
- The answer value type becomes recursive: a group's answer is a list of maps from sub-question key to a leaf answer.
- Sub-questions are the existing leaf question types: short text, long text, single choice, multiple choice and yes/no. File uploads, nested groups and auto-reject rules are not allowed inside a group, and the schema refuses an auto-reject rule on a sub-question rather than ignoring it.
- Sub-question keys are unique across the whole form, like top-level keys.
- A group's `required` means at least one Entry. There is no minimum-entries setting. `maxEntries` is a whole number from 1 to 10.
- A group counts as one question toward the form's existing question limit.

**Answer validation**

- Each sub-answer in an Entry is checked by the same per-question check the top level uses, so every leaf rule (length, option membership, selection limit, yes/no) applies inside Entries unchanged.
- Entries that are completely blank are dropped. If the group is required and no Entry is left, the error is the usual "This question needs an answer".
- An Entry with any answer must satisfy its sub-questions' own `required` flags. Unknown keys inside an Entry are rejected, as unknown top-level keys are today. More Entries than `maxEntries` is an error.
- Errors from group answers use the path `<groupKey>.<index>.<childKey>`, so the apply form can attach each error to the right input. The index is the Entry's position in the submitted array.
- Auto-reject evaluation ignores groups.
- The applicant-facing view of the form passes groups through. Because sub-questions can't carry auto-reject rules, there is nothing in them to strip.

**Preset key**

- Every Question has an optional Preset key (null when built by hand). It sits on the shared base of all question types.
- Keys are dotted names: the group is `education`, its sub-questions are `education.school`, `education.degree`, `education.field_of_study`, `education.start_year` and `education.end_year`. The Experience group is `experience` with `experience.job_title`, `experience.company`, `experience.start_date`, `experience.end_date` and `experience.description`.
- The shared package holds a catalog that maps each Preset key to the question type it must have. The form schema refuses an unknown key and a key on the wrong type.
- The catalog is append-only: a key is never removed and never changed to another type.
- A top-level Preset key can appear at most once per form. Sub-question keys are unique within their group by construction.
- Relabelling a Question does not clear its Preset key (accepted trade-off: autofill only pre-fills values that the applicant reviews before sending).
- For single-choice questions, a future autofill matches options by the Preset's exact option labels. Options carry no keys of their own, since recruiters can't edit a Preset's options.

**Presets**

- Presets are built in. There is no recruiter-saved template feature in this work.
- The shared package holds only the catalog (key to type). The full Preset definitions (labels, help text, limits, options, defaults) live in the web app next to where new questions are created.
- Inserting a Preset copies it: the group and every sub-question and option get fresh unique ids, and the form keeps no link to the Preset's current definition.
- **Education**: group label "Education", optional, up to 5 Entries. Sub-questions: School (short text, 150, required), Degree (single choice: High school, Diploma, Bachelor's, Master's, Doctorate, Other; required), Field of study (short text, 150, optional), Start year (short text, 30, optional), End year (short text, 30, optional, help text that an expected year is fine).
- **Experience**: group label "Work experience", optional, up to 5 Entries. Sub-questions: Job title (short text, 100, required), Company (short text, 100, required), Start date (short text, 30, required, help text like "e.g. Sep 2021"), End date (short text, 30, optional, help text that blank means a current job), What you did there (long text, 1500, optional). There is no "currently work here" question, because the form has no conditional logic.
- Dates and years are free text until the new `date` type exists (separate ticket).

**Builder**

- A "Presets" group is added to the existing "Add question" menu, below the question types. A Preset already on the form is shown greyed out.
- There is no "blank group" option in v1.
- On an inserted Preset the recruiter can edit the group's label, help text, `required` and `maxEntries`, and each sub-question's label, help text and `required`. They cannot add, remove or reorder sub-questions, change types, or edit option lists.
- The group is shown as one question card like the others. Its sub-questions are listed inside it and edited in place. The card opens on error, animates and obeys the read-only rules for people who can't manage jobs, as the other cards do.
- The group saves, publishes and is backed up with the rest of the form. Existing handling of API errors by path (relative to the field list) applies to the new paths.

**Apply page**

- A group is one step in the questionnaire with a card per Entry inside it and "Add another" and "Remove" buttons. It is not one step per Entry or per sub-question, because the questionnaire's step list must match what it renders and a changing list has caused render loops here before.
- A required group starts with one empty card. An optional group starts with none and offers "Add". "Add another" is disabled at `maxEntries`.
- The step is a custom control, like the CV and attachment steps, with the same technique of mirroring a value into a hidden input so the questionnaire can tell the step is answered.
- Choice questions inside an Entry are plain controls (the questionnaire's letter shortcuts only work for top-level steps). A multiple-choice selection limit applies per Entry and is not tracked in the page-wide locked-options state.
- Entries are submitted as part of the answers. Unanswered optional groups are left out. Server errors with a group path send the applicant back to the group's step and mark the right input in the right card.

**Candidate sheet**

- A group answer renders as one block per Entry, with a label and value row per sub-question, using the sub-question labels from the form version the applicant saw. Blank sub-answers are skipped. Choice answers show as labels.

**Data and docs**

- Both the form's questions and the applications' answers are JSONB, so no table or column changes are expected. Confirm against the schema contract before starting.
- Update the schema doc: the question types table and answer shapes, the Preset key and the catalog rules, and the "Later features" line about structured experience. Update the shared-package and web architecture notes in the repo's rule files.

## Testing Decisions

- A good test here checks external behaviour through the public functions, never internals. Given a list of questions and some submitted answers, it asserts what the function returns (accepted answers, or the list of path-and-message errors), not how it got there.
- **One automated seam: the public functions of the shared package** (`parseFormFields`, `parseAnswers`, `toPublicFields`, `findKnockout`). All the rules live there, they are pure and need no database, and the API and the web app both call them.
- Behaviours to cover at that seam:
  - Form validation: a valid group; duplicate sub-question keys (also against top-level keys); a sub-question of a disallowed type (file, nested group); an auto-reject rule on a sub-question; `maxEntries` out of range; an unknown Preset key; a Preset key on the wrong type; a duplicate top-level Preset key; sub-questions that are themselves invalid (for example fewer than two options).
  - Answer validation: Entries accepted with trimmed text; blank Entries dropped; required group with no Entries; required sub-question missing in a partly filled Entry; too many Entries; wrong shape (not an array, Entry not an object); unknown key inside an Entry; invalid choice and over-limit multi-selection inside an Entry; error paths in the `<groupKey>.<index>.<childKey>` form; `false` counts as an answer inside an Entry.
  - A group never triggers an auto-reject, and the applicant-facing form still contains the group and its sub-questions.
- Prior art: the existing tests for form validation and answer parsing in the shared package (the "parseAnswers", "file questions" and "findKnockout" groups of tests), written the same way: build a small field list, call the function, assert on the result.
- The web pieces (builder, apply step, candidate sheet) have no test runner in this repo and none is added here. They are verified in the browser instead: insert both Presets, edit labels and limits, save, publish, apply with several Entries, trigger an error inside an Entry, check the candidate sheet, and check the read-only builder as an interviewer. Record what was checked.

## Out of Scope

- The new `number`, `date` and `url` question types (a separate ticket). Presets use free text for dates and years until then.
- CV parsing and autofill themselves. This work only records Preset keys so autofill can be built later.
- Single-question Presets (for example notice period). The Preset key design allows them later, and none ship now.
- Recruiters building a blank group, adding or removing sub-questions, or saving their own Presets.
- File uploads, nested groups, multi-level conditions and auto-reject rules inside a group, and conditional logic of any kind.
- Keys on individual options.
- Candidate list columns, filters or search over group answers.
- Fixing the request-size ceiling (recorded as a known gap in the schema doc).
- A test setup for the web app.

## Further Notes

- The ADR (0004) records why this is one generic group and not a type per topic, and the v1 limits. The glossary now defines Question, Repeating group, Entry, Preset and Preset key. Use those words in the UI copy and tickets, and avoid "section", "template" and "field" for these.
- Published form versions are immutable, so a Preset key that isn't written at insert time can never be added to an existing version. That is the reason for tagging every Preset question now, though nothing reads the tag yet.
- A group's answers are bounded by the Preset sizes and `maxEntries` (about 20,000 characters for ten Experience Entries), well under the API's 100kb request limit.
