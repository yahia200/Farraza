# 01: Prefactor: make the API test suite runnable

**What to build:** `pnpm --filter api test` runs and passes, so every later ticket can add service-level tests. The leftover scaffolding specs that import a controller that no longer exists are removed. One small test of an existing service, written against in-memory fakes of its repository, sets the pattern the file-upload tests will follow. Parent spec: `.scratch/file-uploads/spec.md` (Testing Decisions, seam 2).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The broken scaffolding unit and e2e specs are deleted or replaced, and `pnpm --filter api test` exits green.
- [ ] One service test uses a hand-written in-memory fake repository and asserts behaviour through the service's public methods only.
- [ ] `CLAUDE.md`'s note that the API test command currently fails is updated to match.
- [ ] Lint and type checks pass for the API.
