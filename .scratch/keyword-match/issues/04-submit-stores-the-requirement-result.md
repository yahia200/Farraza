# 04: Submit stores the Requirement result

**What to build:** The `application_requirement_results` table, written at submit. Spec: `.scratch/keyword-match/spec.md` ("Database", "API").

- A new row per Application with company, Job, the version checked, per-Requirement results, `missed_must_have` and a checked-at time; deleted with the Application.
- Written in the same transaction as the Application and its CV text row, only when the Job has a current version and the CV text is `readable`.
- An `unreadable`, `failed` or missing CV writes no row. A result can never fail a submit.

**Blocked by:** 02, 03.

**Status:** open

- [ ] A readable CV with a current version stores a result with the right version reference
- [ ] A Job with no version, or an unreadable, failed or missing CV, stores nothing
- [ ] The submit still succeeds when the matcher has nothing to do
- [ ] `docs/db-schema.md` updated for the table and its conventions
- [ ] Service specs in the `applications.service.spec.ts` style cover every case
- [ ] `pnpm lint`, `pnpm check-types` and both test suites pass
