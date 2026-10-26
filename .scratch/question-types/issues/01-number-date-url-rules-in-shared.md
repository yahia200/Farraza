# 01: Number, date and URL rules in the shared package

**What to build:** Form validation accepts three new question types, `number`, `date` and `url`, and answer parsing understands their answers, so the API and the web app can both trust the same rules. Spec: `.scratch/question-types/spec.md`; decision record: ADR-0004. Use the glossary terms Question, Repeating group and Entry.

All three are leaf types: they go into `leafFieldSchema`, so they work inside a Repeating group through the same `checkLeafRules` and the same per-question answer check, with no group-specific code. None has auto-reject rules.

**Stop and ask the owner before writing code** about the two open points in the spec's Temporal section: (1) browser support for Temporal (read the MDN compatibility table for `Temporal.PlainDate` and put the options to the owner: Temporal on the server only, a polyfill in the web app, or accepting the gap), and (2) how to type Temporal, since TypeScript 6.0.3 has no Temporal lib. Record both decisions and their doc references under "## Comments".

**Blocked by:** None (can start immediately, after the two decisions above).

**Status:** resolved

- [x] `engines.node` in the root `package.json` and the Node version in `CLAUDE.md` are `>=26`
- [x] `number` config is `{ min, max, integerOnly }`; the schema refuses `min` above `max` with a message on the right path
- [x] `date` config is `{ min, max }` as ISO `YYYY-MM-DD` dates; the schema refuses a non-date and `min` after `max`
- [x] `url` has no config
- [x] The three types are accepted as sub-questions inside a Repeating group, and an auto-reject rule is not possible on them
- [x] Number answers: accepted, `0` accepted, trimmed input not applicable; refused when below `min`, above `max`, not whole under `integerOnly`, not a number, or not finite
- [x] Date answers: accepted only if `Temporal.PlainDate.from(value, { overflow: 'reject' })` accepts it and it round-trips to the same text (`2026-02-30` and `2026-2-5` both refused); refused before `min` or after `max`
- [x] URL answers: trimmed, at most 2,048 characters, accepted only for `http:` or `https:` (`javascript:`, `ftp:` and a missing scheme refused)
- [x] An optional blank answer is skipped for each type; a required one fails with the usual "needs an answer" message; errors inside an Entry use `<groupKey>.<index>.<childKey>`; `0` counts as an answer when blank Entries are dropped
- [x] `findKnockout` ignores the three types and `toPublicFields` passes them through whole
- [x] `PresetQuestionType` in `preset-keys.ts` lists the three new names, and the compile-time check in `form-fields.ts` still passes
- [x] Tests at the shared package's public functions cover every criterion above, written like the existing form-field and answer tests; `pnpm --filter @repo/shared test` passes
- [x] The shared package is rebuilt and `pnpm lint` and `pnpm check-types` pass for the whole repo
- [x] `docs/db-schema.md` (question types table, answer shapes, rules across properties) and `.claude/rules/api.md` ("seven field types" becomes ten) describe the three types

## Answer

`number`, `date` and `url` are leaf question types in `@repo/shared`. Form rules are in `form-fields.ts` (`number` and `date` refuse `min` above `max` on `config.min`; `date` limits must be real ISO dates), answer rules are in `answers.ts`, and the Temporal date helpers are in the new `dates.ts` (`Temporal.PlainDate.from(..., { overflow: 'reject' })` plus a round trip). `PresetQuestionType` lists the new names; the four Preset keys are untouched (ticket 05). Tests: `question-types.test.ts` (plus one message updated in `form-fields.test.ts`). Node is `>=26` in `package.json` and `CLAUDE.md`. Typing: `"esnext.temporal"` in `packages/shared/tsconfig.json` `lib`, and shared's TypeScript moved from `^5.9.0` to `^6.0.2` because 5.9 has no Temporal lib. `docs/db-schema.md` and `.claude/rules/api.md` updated. The web app's `format-answer.ts` and `form-builder/field-types.ts` now fail to type-check on the new types, for the web tickets to fix.

## Comments

### Owner decisions (2026-10-25)

- **Browser support:** MDN marks `Temporal` "Limited availability / not Baseline" (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal; the per-browser version table could not be read when this was decided, so re-check it). Decision: **load a Temporal polyfill in `apps/web` only** (`temporal-polyfill` or `@js-temporal/polyfill`; the implementer of the first web ticket picks one, reads its README and records the choice). `@repo/shared` uses plain `Temporal` and never imports a polyfill. Node >= 26 supplies it natively on the server.
- **Typing:** TypeScript 6.0.3 does ship `lib.esnext.temporal.d.ts` (`apps/api/node_modules/typescript/lib/`), contrary to the spec. Decision: add `"esnext.temporal"` to the `lib` of `packages/shared` (and any package that type-checks its source) instead of local declarations. Docs: https://www.typescriptlang.org/tsconfig/#lib
