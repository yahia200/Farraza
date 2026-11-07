# 09: Verification pass and docs sweep

**What to build:** A final end-to-end check and the documentation updates. Spec: `.scratch/keyword-match/spec.md`.

- In the browser against the dev stack: save Requirements, submit an Application with a readable CV, see the marker and the sheet section, change a keyword, run Re-check, see the count fall to zero.
- Check an unreadable CV and an Application with no CV.
- Update `.claude/rules/api.md`, `.claude/rules/web.md`, `docs/db-schema.md`, `docs/feature-backlog.md` (mark Layer 2 built) and `.scratch/candidate-matching/layers.md`.
- Confirm the placeholders (caps, chunk size) against what was seen, and record any change.

**Blocked by:** 05, 08.

**Status:** resolved

- [x] The flow above works end to end and is described in the PR
- [x] No public route or Member payload exposes CV text, Requirements or results beyond the Member routes in the spec
- [x] Every doc listed above is updated
- [x] `pnpm lint`, `pnpm check-types` and both test suites pass

## Result and the owner's open question (2026-11-07)

Verified in a browser against the real API; proof in `.scratch/keyword-match/screenshots/`. Two bugs and one low-contrast control were fixed (see the fix commit).

**For the owner to answer (not answered here):** Is the Cloud Run API service set to "CPU always allocated" (no CPU throttling outside requests)? If not, a Re-check run can stall once the request that started it returns, because the worker lives in the API process (ADR-0007). Until you confirm, treat a Re-check as reliable only while the API is busy serving requests.
