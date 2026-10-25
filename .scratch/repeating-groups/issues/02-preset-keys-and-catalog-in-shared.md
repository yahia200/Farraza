# 02: Preset keys and the catalog in the shared package

**What to build:** Every Question can carry an optional Preset key, and the shared package validates it against an append-only catalog, so a future CV autofill can trust a tag. Spec: `.scratch/repeating-groups/spec.md`; decision record: ADR-0004. Use the glossary terms Preset and Preset key.

The Preset key sits on the shared base of all question types (null when a question was built by hand). The catalog maps each key to the question type it must have. It covers the Education keys (the group and its five sub-questions: school, degree, field of study, start year, end year) and the Experience keys (the group and its five sub-questions: job title, company, start date, end date, description), as dotted names such as `education` and `education.school`.

**Blocked by:** 01 (the catalog's group keys need the `repeating_group` type).

**Status:** resolved

- [x] A question with no Preset key and a question with a valid Preset key both validate; the key is optional and nullable on every question type, including sub-questions inside a group
- [x] Form validation refuses an unknown Preset key, with a clear message on the right path
- [x] Form validation refuses a Preset key on a question of the wrong type (for example a school key on a yes/no, or the group key on a short text)
- [x] Form validation refuses the same top-level Preset key twice in one form, and accepts two different ones
- [x] The same sub-question Preset key in two different groups is not an error (each group has its own scope); within one group a Preset key may appear only once
- [x] The catalog is documented in code as append-only: a key is never removed or re-typed, with the reason (an old published form must still load when its draft is edited)
- [x] The applicant-facing form keeps the Preset keys (they are harmless) and drops nothing else new
- [x] Tests at the shared package's public functions cover every criterion above; `pnpm --filter @repo/shared test` passes
- [x] The shared package is rebuilt and `pnpm lint` and `pnpm check-types` pass for the whole repo
- [x] The schema doc describes the Preset key property and the catalog rules

## Comments

Resolved on `feat/repeating-groups` (commits 60db1c6, 4faf356). Design choices: `presetKey` is `.nullish()` because stored forms lack it; the catalog lives in `packages/shared/src/preset-keys.ts`; unknown keys are caught by `z.enum(PRESET_KEYS)`; wrong-type and duplicate checks live in the form `superRefine` next to key uniqueness. The `preset-keys.test.ts` file pins the catalog as literals and tests the exported constant, not one of the four public functions.
