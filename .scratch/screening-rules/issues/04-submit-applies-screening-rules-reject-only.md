# 04: Submit applies Screening rules (reject only)

**What to build:** The apply path evaluates the Job's Screening rules instead of the old field-level knockout. Only reject outcomes act in this ticket, so behaviour for yes/no and single-select matches today; flags come in ticket 05. This is the "migrate callers, then delete" step: `findKnockout` is removed. Spec: `.scratch/screening-rules/spec.md` ("API").

- Submit calls `evaluateScreeningRules` with the Job's rules, the form version's fields, the answers and the submission date.
- Any fired reject sends the Application to the Rejected stage with the matching status, writes `applied` then `auto_rejected`, in the same transaction as today. The `auto_rejected` event's data carries the fired rules and their reasons.
- No fired reject: the Application is placed as today.
- The public routes never return rules or reasons.
- `findKnockout` and its tests are deleted. The field-level `rejectWhen` / `rejectOptionIds` no longer have any effect (their config removal is ticket 08).

**Blocked by:** 02.

**Status:** ready-for-agent

- [ ] A rule that fires with outcome reject sends the Application to Rejected, with `applied` and `auto_rejected` events and reasons in the event data
- [ ] A yes/no rule and a single-select in-set / not-in-set rule behave as the old field rules did
- [ ] A skipped optional question never fires a rule
- [ ] No rules, or no fired rule, places the Application as before
- [ ] Editing a rule afterwards leaves past Applications unchanged
- [ ] No public route returns rules or reasons (tested)
- [ ] `findKnockout` is gone and nothing references it
- [ ] Service specs in the `applications.service.spec.ts` style cover every case
- [ ] `.claude/rules/api.md` updated
- [ ] `pnpm lint`, `pnpm check-types`, `pnpm --filter @repo/shared test` and `pnpm --filter api test` pass
