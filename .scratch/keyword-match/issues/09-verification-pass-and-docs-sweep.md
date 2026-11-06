# 09: Verification pass and docs sweep

**What to build:** A final end-to-end check and the documentation updates. Spec: `.scratch/keyword-match/spec.md`.

- In the browser against the dev stack: save Requirements, submit an Application with a readable CV, see the marker and the sheet section, change a keyword, run Re-check, see the count fall to zero.
- Check an unreadable CV and an Application with no CV.
- Update `.claude/rules/api.md`, `.claude/rules/web.md`, `docs/db-schema.md`, `docs/feature-backlog.md` (mark Layer 2 built) and `.scratch/candidate-matching/layers.md`.
- Confirm the placeholders (caps, chunk size) against what was seen, and record any change.

**Blocked by:** 05, 08.

**Status:** open

- [ ] The flow above works end to end and is described in the PR
- [ ] No public route or Member payload exposes CV text, Requirements or results beyond the Member routes in the spec
- [ ] Every doc listed above is updated
- [ ] `pnpm lint`, `pnpm check-types` and both test suites pass
