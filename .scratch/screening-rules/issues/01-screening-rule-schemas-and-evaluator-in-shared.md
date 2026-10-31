# 01: Screening rule schemas and evaluator in shared

**What to build:** The pure logic for Screening rules in `@repo/shared`, usable by the API and the web app. This is the "expand" step: the new code sits beside `findKnockout` and the field-level `rejectWhen` / `rejectOptionIds`, which stay until tickets 04 and 08. Spec: `.scratch/screening-rules/spec.md` ("Implementation Decisions", "Shared"); ADR-0005.

- **Rule shape:** `{ id (uuid), questionKey (uuid), outcome: 'reject' | 'flag', condition }`, where `condition` is a discriminated union on the question type:
  - `single_select`: in-set, not-in-set.
  - `multi_select`: any-of, none-of-required, all-of.
  - `number`: min, max, range.
  - `date`: before or after, fixed or relative to the submission date (`Temporal.PlainDate`, as `dates.ts` does).
  - `short_text` / `long_text`: words any-of, all-of, none-of. Whole-word, case-insensitive; no regex.
  - `yes_no`: the answer to match.
- **Caps:** at most 20 rules per Job, at most 20 words per word rule, each at most 60 characters.
- **Validator:** checks a rule list against a Job's current form fields (type match, unknown option ids, unknown question keys) and returns `<path>` errors like the other shared validators.
- **Evaluator:** `evaluateScreeningRules(rules, fields, answers, submittedOn)` returns every fired rule with a generated reason (for example "Years of experience was 2, minimum 5"). A blank or skipped answer never fires a rule. It does not apply outcomes; the caller does.
- **Request schema:** the body schema for the save route (`{ rules }`), for ticket 02.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] Every condition above parses, and malformed ones are refused with `<path>` errors
- [x] The evaluator fires correctly per type and condition, including boundaries (min equals the answer, range ends) and relative dates
- [x] A blank answer never fires; several rules on one question each evaluate; every fired rule is returned with its reason
- [x] Word matching is whole-word and case-insensitive ("sql" does not match "mysql")
- [x] Caps are enforced; the form validator catches wrong type, unknown option and unknown question
- [x] `findKnockout` and the legacy rule properties still exist and their tests still pass
- [x] `pnpm --filter @repo/shared test`, `pnpm lint` and `pnpm check-types` pass

## Answer

Merged in bdcc1d6 (`packages/shared/src/screening-rules.ts`, `saveScreeningRulesSchema` in `jobs.ts`). `findKnockout` was left in place by this ticket and removed in ticket 04. Orchestrator re-ran the shared tests, type-check, lint and build after each later merge; the final run on ada25f1 passed (550 shared tests).
