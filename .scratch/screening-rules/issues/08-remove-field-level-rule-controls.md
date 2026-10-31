# 08: Remove field-level rule controls

**What to build:** The "contract" step. The form builder no longer offers per-field reject rules, and the retired properties leave the field config. Spec: `.scratch/screening-rules/spec.md` ("Shared", "Web"); ADR-0005.

- Remove the per-field rule controls from the form builder.
- Remove `rejectWhen` and `rejectOptionIds` from the field `config` schemas in `@repo/shared`, along with the "no rules in groups" checks that guarded them.
- The parser strips the two retired properties from stored form versions instead of failing on them, so old versions still load and render.
- The public form already carries no rule properties; confirm it.

**Blocked by:** 04, 06.

**Status:** resolved

- [x] The form builder shows no reject controls for any question type
- [x] A stored form version containing `rejectWhen` / `rejectOptionIds` still parses, renders and accepts Applications; the properties are not echoed back
- [x] New saves and publishes never write the retired properties
- [x] Nothing in the repo references the retired properties except the stripping code and its tests (and the history docs: ADR, specs, tickets, feature backlog)
- [ ] Browser check: build a form, edit an older version's form, apply to a Job, all without errors
- [x] `.claude/rules/web.md` and `.claude/rules/api.md` updated
- [x] `pnpm lint`, `pnpm check-types`, `pnpm --filter @repo/shared test` and `pnpm --filter api test` pass

## Answer

Done on `worktree-agent-ab7c42d780eb0c1a5`.

- `@repo/shared`: `rejectOptionIds` and `rejectWhen` are gone from the `single_select` and `yes_no` config schemas, with the option-id check and the "no rules in groups" checks. Zod objects drop unknown keys, so `parseFormFields` strips both properties from any stored version (an unknown option id in one is no longer an error) and a save or publish can never write them. Tests: `form-fields.test.ts` ("retired reject rules").
- Public form: `PublicFormField` is now just `FormField`. `toPublicFields` is kept as the stripping code, because the API reads stored `fields` without parsing them (`as FormFields` in the repositories), so an old version would otherwise reach applicants as stored. Tests: `answers.test.ts`, and `applications.service.spec.ts` (a legacy form is served without the properties and still accepts an Application).
- Form builder: the yes/no Auto-reject select, the per-option Auto-reject checkboxes and the card's Auto-reject badge are removed.
- Not changed: the recruiter-facing read of a form version (`GET .../form`) still returns a legacy version as stored; the builder's save runs `parseFormFields`, which drops the properties.
- Browser check (build a form, edit an older version, apply to a Job) was **deferred**: the worktree has no `.env`; the orchestrator runs it from the main folder. That checkbox is left unticked.
