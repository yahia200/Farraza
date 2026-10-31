# 10: Verification pass and docs sweep

**What to build:** A final end-to-end check of the feature in the browser, and a sweep that the docs match what shipped. Spec: `.scratch/screening-rules/spec.md` ("Testing Decisions"). Pattern: `.scratch/highlighted-questions/issues/06-verification-pass-and-docs-sweep.md`.

Walk the whole flow on a Job with a published form that has a question of each rule type: set one rule of each type with outcome reject and flag; apply as an applicant to hit reject, flag, both, and neither; skip an optional question and confirm nothing fires; see the card, row and sheet markers and reasons; edit a rule and confirm past Applications are unchanged; try to publish a form version that drops a ruled question and see it blocked; open the Settings tab as an interviewer; check a Job with no published form; check an old form version that still has the retired properties; check phone width and both themes. Confirm the public apply page and its routes expose no rules or flags.

**Blocked by:** 07, 08, 09.

**Status:** ready-for-agent

- [ ] Every browser check above is done, with what was seen recorded in the Answer
- [ ] `docs/db-schema.md`, `.claude/rules/api.md` and `.claude/rules/web.md` describe the columns, route, payloads, events, Settings tab, editor and markers as built (no leftover "proposed" wording)
- [ ] `GLOSSARY.md` matches the UI wording (Screening rule, Application Event, Criterion)
- [ ] `docs/feature-backlog.md` and `.scratch/candidate-matching/layers.md` reflect that Layer 1 shipped
- [ ] `pnpm lint`, `pnpm check-types`, `pnpm --filter @repo/shared test` and `pnpm --filter api test` pass
