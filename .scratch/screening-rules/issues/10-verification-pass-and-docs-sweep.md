# 10: Verification pass and docs sweep

**What to build:** A final end-to-end check of the feature in the browser, and a sweep that the docs match what shipped. Spec: `.scratch/screening-rules/spec.md` ("Testing Decisions"). Pattern: `.scratch/highlighted-questions/issues/06-verification-pass-and-docs-sweep.md`.

Walk the whole flow on a Job with a published form that has a question of each rule type: set one rule of each type with outcome reject and flag; apply as an applicant to hit reject, flag, both, and neither; skip an optional question and confirm nothing fires; see the card, row and sheet markers and reasons; edit a rule and confirm past Applications are unchanged; try to publish a form version that drops a ruled question and see it blocked; open the Settings tab as an interviewer; check a Job with no published form; check an old form version that still has the retired properties; check phone width and both themes. Confirm the public apply page and its routes expose no rules or flags.

**Blocked by:** 07, 08, 09.

**Status:** ready-for-agent (docs done, browser pass owner's)

- [ ] Every browser check above is done, with what was seen recorded in the Answer
- [x] `docs/db-schema.md`, `.claude/rules/api.md` and `.claude/rules/web.md` describe the columns, route, payloads, events, Settings tab, editor and markers as built (no leftover "proposed" wording)
- [x] `GLOSSARY.md` matches the UI wording (Screening rule, Application Event, Criterion)
- [x] `docs/feature-backlog.md` and `.scratch/candidate-matching/layers.md` reflect that Layer 1 shipped
- [x] `pnpm lint`, `pnpm check-types`, `pnpm --filter @repo/shared test` and `pnpm --filter api test` pass

## Answer

Docs half done; the browser pass is left for the owner.

**Done**
- `docs/db-schema.md`: the `jobs.screening_rules` note no longer says a stored rule goes stale after a new form version (publish is blocked, section 7); the number/date/URL rows no longer say Screening rules ignore those types. Columns, events (`auto_rejected`, `flagged`), `applications.flags` and the section 8 list were already as built.
- `.claude/rules/api.md` and `.claude/rules/web.md`: removed "no auto-reject rules" wording for number, date and URL questions. The route, payloads, events, Settings tab, editor and markers were already described as built, with no "proposed" wording.
- `GLOSSARY.md`: checked against the UI strings (Screening rules, Rating criteria, "Flagged by N screening rules"); no change needed.
- `docs/feature-backlog.md` and `.scratch/candidate-matching/layers.md`: Layer 1 marked as shipped (reject and flag), `findKnockout`/`rejectWhen` treated as retired; move-to-stage, `repeating_group`, `url` and regex rules stay future.
- Other stale wording fixed: the `CompanyJob.screeningRules` comment in `apps/web/lib/dal.ts`, the "matched an auto-reject rule" fallback in `candidate-detail.tsx`, the landing "Build the form" copy and the root `README.md` line.
- `pnpm lint`, `pnpm check-types`, shared tests (550) and api tests (439) pass; `tsc --noEmit` is clean in `apps/api` and `apps/web`.

**Left for the owner**
- Every browser check in "What to build" (and the first checkbox).
- The landing image `form-builder-auto-reject.webp` (used by `steps-section.tsx` and `README.md`) still shows the retired field-level reject controls; retake it.
