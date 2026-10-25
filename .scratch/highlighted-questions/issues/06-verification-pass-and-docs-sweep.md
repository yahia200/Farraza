# 06: Verification pass and docs sweep

**What to build:** A final end-to-end check of the feature in the browser, and a sweep that the docs match what shipped. Spec: `.scratch/highlighted-questions/spec.md` ("Testing Decisions", "Docs").

Walk the whole flow on a Job with a published form that has at least one question of each highlightable type, one Repeating group and one file question, and Applications submitted before and after a form change: pick one, then three (the fourth is blocked); see the table columns and card blocks; reload; open as an interviewer; publish a new version that removes a Highlighted question and relabels an option; check an Application from the older version; check a Job with no published form; check phone width.

**Blocked by:** 04, 05.

**Status:** needs-triage

- [ ] Every browser check above is done, with what was seen recorded in the Answer
- [ ] The stale key disappears from both views after the new version is published, and the old Application keeps its applicant's option labels
- [ ] `docs/db-schema.md`, `.claude/rules/api.md` and `.claude/rules/web.md` describe the column, route, payload, picker, columns and card as built (no leftover "proposed" or ticket-only wording)
- [ ] `GLOSSARY.md` still matches the UI wording (Highlighted question; no "column" for a Stage)
- [ ] The spec's Further Notes assumption (Question keys persist across versions) is confirmed in `form-builder.tsx` and noted
- [ ] `pnpm lint`, `pnpm check-types`, `pnpm --filter @repo/shared test` and `pnpm --filter api test` pass

## Comments

## Answer
