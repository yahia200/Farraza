# 08: Verification pass and docs sweep

**What to build:** End-to-end check of the ratings feature in the running app and a final pass over the docs. Spec: `.scratch/ratings/spec.md` ("Testing Decisions", "Docs").

- **Browser check** (dev server): manager picks Criteria; two accounts (one interviewer) rate the same Application; change a rating and see it in the Application's history; clear a Criterion score; drop a Criterion and see its old scores marked; table shows and sorts by Average rating with an unrated candidate last; the board card matches; a Rejected Application can still be rated; a Rating survives when its author is removed from the company and shows the right name or "Former member"; the public apply page and its payload carry nothing about ratings. Record what was checked and what was not.
- **Docs sweep:** `docs/db-schema.md` (`jobs`, `ratings`, event type and data shape, no-FK list, rules), `.claude/rules/api.md`, `.claude/rules/web.md`, the `GLOSSARY.md` entries against what shipped (Rating, Criterion, Average rating, Application Event), and the CLAUDE.md docs table only if a new dependency was added (none expected).
- Run `pnpm lint`, `pnpm check-types`, `pnpm --filter api test` and `pnpm --filter @repo/shared test`.

**Blocked by:** 05, 06, 07.

**Status:** ready-for-agent

- [ ] Every browser check above is done or listed as not done, with the reason
- [ ] Docs match the shipped behaviour; any differences from the spec are written in the spec's follow-up notes
- [ ] All four commands pass

## Comments

## Answer
