# 07: Re-check: count, enqueue and processor

**What to build:** The API side of Re-check on the queue from ticket 01. Spec: `.scratch/keyword-match/spec.md` ("API").

- `GET` returns how many Applications need a Re-check: non-rejected, CV text `readable`, and no result or a result older than the Job's current version.
- `POST` enqueues one job per Job with a stable `jobId`; a second `POST` while one is active is a no-op.
- The processor works in chunks of about 50, reading the Job's current version at the start of each chunk, upserting each result, and reporting progress. Writing a result is idempotent, so a retried chunk is safe.
- A status route returns idle, running with processed and total, or the last finished run.

**Blocked by:** 01, 04.

**Status:** resolved

- [x] Rejected Applications and unreadable, failed or missing CVs are never counted or processed
- [x] An edit saved mid-run is picked up by the next chunk and the run ends with everything on the latest version
- [x] After a run the count is zero until the Requirements change again
- [x] Authorization matches the Requirements `PUT`; a tenant cannot touch another tenant's Job
- [x] Specs use a fake queue, plus one manual run against the dev database recorded in the PR
- [x] `.claude/rules/api.md` updated
- [x] `pnpm lint`, `pnpm check-types` and both test suites pass

## Answer

Built on `feat/keyword-match` (commits f4292b0, b569586). Routes: `GET/POST .../jobs/:jobSlug/recheck`, `GET .../recheck/status`.

Manual run against the dev database (real BullMQ Postgres backend, the real `RecheckService`, called through a Nest application context, not over HTTP), 2026-11-07: seeded a temporary company with 304 Applications (300 readable CVs; 1 rejected, 1 unreadable, 1 failed, 1 with no CV). The count read 0 with no Requirements version and 300 after saving version 1. `start` answered `running 0/300`; a second `start` was a no-op. Progress went 50, 100, 150 and so on. A version 2 saved after the first 50 made `total` grow from 300 to 400, and all 300 result rows ended at version 2. The run ended `idle, lastRun {processed: 400, failed: false}` and the count was 0. The seed data was deleted afterwards.

Known limit found in the browser pass (ticket 09): a run interrupted by an API restart did not resume within about a minute; clicking Re-check again finished it. See ADR-0007 and `.claude/rules/api.md`.
