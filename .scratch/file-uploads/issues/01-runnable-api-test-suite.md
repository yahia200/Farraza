# 01: Prefactor: make the API test suite runnable

**What to build:** `pnpm --filter api test` runs and passes, so every later ticket can add service-level tests. The leftover scaffolding specs that import a controller that no longer exists are removed. One small test of an existing service, written against in-memory fakes of its repository, sets the pattern the file-upload tests will follow. Parent spec: `.scratch/file-uploads/spec.md` (Testing Decisions, seam 2).

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] The broken scaffolding unit and e2e specs are deleted or replaced, and `pnpm --filter api test` exits green.
- [x] One service test uses a hand-written in-memory fake repository and asserts behaviour through the service's public methods only.
- [x] `CLAUDE.md`'s note that the API test command currently fails is updated to match.
- [x] Lint and type checks pass for the API.

## Comments

Resolved on integration branch `feat/file-uploads`: merge dc36af3 (feat e0940c8).

The scaffolding unit spec was already gone and `pnpm --filter api test` already passed; the only broken file was `apps/api/test/app.e2e-spec.ts`, which is deleted along with the e2e config. `jobs.service.spec.ts` sets the pattern: real `JobsService` and real policies, in-memory fake `JobsRepository`, service built by hand because vitest does not emit decorator metadata.
