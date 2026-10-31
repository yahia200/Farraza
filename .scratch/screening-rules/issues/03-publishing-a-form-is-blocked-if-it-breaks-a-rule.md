# 03: Publishing a form is blocked if it breaks a rule

**What to build:** A manager cannot publish a form version that would leave a Screening rule pointing at nothing. Spec: `.scratch/screening-rules/spec.md` ("API"); ADR-0005 ("Consequences").

Publishing a version fails with field errors, and a clear message naming the rule, when the new version:

- drops a question a rule points to,
- changes that question's type, or
- removes an option a rule uses.

The manager removes or edits the rule first, then publishes. Saving a draft is not blocked; only publishing is.

**Blocked by:** 02.

**Status:** resolved

- [x] Each of the three cases above is refused on publish with errors that say which question and rule
- [x] Relabelling a question or option, adding questions, and reordering still publish
- [x] A Job with no rules publishes exactly as before
- [x] Removing the offending rule then publishing succeeds
- [x] Service specs on the in-memory fakes cover every case
- [x] `docs/db-schema.md` (§7 rules) and `.claude/rules/api.md` updated
- [x] `pnpm lint`, `pnpm check-types` and `pnpm --filter api test` pass
