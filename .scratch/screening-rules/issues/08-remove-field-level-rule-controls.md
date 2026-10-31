# 08: Remove field-level rule controls

**What to build:** The "contract" step. The form builder no longer offers per-field reject rules, and the retired properties leave the field config. Spec: `.scratch/screening-rules/spec.md` ("Shared", "Web"); ADR-0005.

- Remove the per-field rule controls from the form builder.
- Remove `rejectWhen` and `rejectOptionIds` from the field `config` schemas in `@repo/shared`, along with the "no rules in groups" checks that guarded them.
- The parser strips the two retired properties from stored form versions instead of failing on them, so old versions still load and render.
- The public form already carries no rule properties; confirm it.

**Blocked by:** 04, 06.

**Status:** ready-for-agent

- [ ] The form builder shows no reject controls for any question type
- [ ] A stored form version containing `rejectWhen` / `rejectOptionIds` still parses, renders and accepts Applications; the properties are not echoed back
- [ ] New saves and publishes never write the retired properties
- [ ] Nothing in the repo references the retired properties except the stripping code and its tests
- [ ] Browser check: build a form, edit an older version's form, apply to a Job, all without errors
- [ ] `.claude/rules/web.md` and `.claude/rules/api.md` updated
- [ ] `pnpm lint`, `pnpm check-types`, `pnpm --filter @repo/shared test` and `pnpm --filter api test` pass
