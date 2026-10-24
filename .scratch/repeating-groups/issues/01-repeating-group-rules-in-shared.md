# 01: Repeating group rules in the shared package

**What to build:** Form validation accepts a new `repeating_group` question type, and answer parsing understands its Entries, so the API and the web app can both trust the same rules. Spec: `.scratch/repeating-groups/spec.md`; decision record: ADR-0004. Use the glossary terms Question, Repeating group and Entry.

A group's config lists its sub-questions and a `maxEntries`. Sub-questions are the existing leaf question types (short text, long text, single choice, multiple choice, yes/no). A group's answer is an array of Entries, each an object keyed by the sub-question's key.

Prefactor first: pull the per-question answer check out of the answer parser so a group's sub-answers go through exactly the same check as a top-level answer. Do not write a second validator.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [ ] Form validation accepts a group whose sub-questions are valid leaf questions, and the group counts as one question toward the form's question limit
- [ ] Form validation refuses, with a clear message on the right path: a file question or a nested group inside a group, a non-empty auto-reject rule on a sub-question, a duplicate sub-question key (including a clash with a top-level key), `maxEntries` outside 1 to 10, and an invalid sub-question (for example fewer than two options)
- [ ] Answer parsing accepts Entries and trims text inside them; `false` counts as an answer inside an Entry
- [ ] Fully blank Entries are dropped; a required group with no Entries left fails with the usual "needs an answer" message; an optional group with none is simply absent from the answers
- [ ] An Entry with any answer must satisfy its sub-questions' own `required` flags
- [ ] Answer parsing refuses: more Entries than `maxEntries`, an answer that is not an array, an Entry that is not an object, an unknown key inside an Entry, an invalid choice, and a multiple-choice selection over its limit inside an Entry
- [ ] Group answer errors use the path `<groupKey>.<index>.<childKey>`, where the index is the Entry's position in the submitted array
- [ ] Auto-reject evaluation ignores groups; the applicant-facing form still contains the group and all its sub-questions
- [ ] The answer value type is recursive and every place that handles answers still type-checks (`pnpm check-types`)
- [ ] Tests at the shared package's public functions cover every criterion above, written like the existing form-field and answer tests; `pnpm --filter @repo/shared test` passes
- [ ] The shared package is rebuilt and `pnpm lint` and `pnpm check-types` pass for the whole repo
- [ ] The schema doc's question types table, answer shape section and the rules across properties describe the group

## Comments

Resolved on `feat/repeating-groups` (commits 39c22ca..ca7f6c3). Design choices: sub-questions live at `config.fields`; a group needs at least one sub-question; auto-reject rules on sub-questions are refused by a check, not by separate schemas; `maxEntries` counts Entries after blank ones are dropped. See `docs/db-schema.md` for the rules.
