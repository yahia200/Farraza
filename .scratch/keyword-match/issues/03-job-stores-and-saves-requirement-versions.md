# 03: Job stores and saves Requirement versions

**What to build:** The `job_requirement_versions` table and the `PUT` that creates a new immutable version when the list changes. Spec: `.scratch/keyword-match/spec.md` ("Database", "API").

- Contract change in `contract.prisma`, `prisma contract emit`, `prisma db update`; commit the emitted files and snapshots; update `docs/db-schema.md`.
- `PUT companies/:companySlug/jobs/:jobSlug/requirements` with `{ requirements }`, authorized like the Screening-rules `PUT`, any Job status, validated by the shared schema.
- A changed list creates the next version in one transaction; an identical list creates nothing; an empty list is a valid version.
- The Job payload carries the current Requirements and version number.

**Blocked by:** 02.

**Status:** open

- [ ] A changed save creates version N+1; an unchanged save creates none
- [ ] An empty list creates a version with no Requirements
- [ ] Older versions are never modified
- [ ] Requirement ids stay stable when the manager edits an existing one
- [ ] No public route returns Requirements (tested)
- [ ] Service specs in the `jobs.service.spec.ts` style cover every case
- [ ] `.claude/rules/api.md` updated
- [ ] `pnpm lint`, `pnpm check-types` and both test suites pass
