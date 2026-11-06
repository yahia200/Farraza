# 07: Re-check: count, enqueue and processor

**What to build:** The API side of Re-check on the queue from ticket 01. Spec: `.scratch/keyword-match/spec.md` ("API").

- `GET` returns how many Applications need a Re-check: non-rejected, CV text `readable`, and no result or a result older than the Job's current version.
- `POST` enqueues one job per Job with a stable `jobId`; a second `POST` while one is active is a no-op.
- The processor works in chunks of about 50, reading the Job's current version at the start of each chunk, upserting each result, and reporting progress. Writing a result is idempotent, so a retried chunk is safe.
- A status route returns idle, running with processed and total, or the last finished run.

**Blocked by:** 01, 04.

**Status:** open

- [ ] Rejected Applications and unreadable, failed or missing CVs are never counted or processed
- [ ] An edit saved mid-run is picked up by the next chunk and the run ends with everything on the latest version
- [ ] After a run the count is zero until the Requirements change again
- [ ] Authorization matches the Requirements `PUT`; a tenant cannot touch another tenant's Job
- [ ] Specs use a fake queue, plus one manual run against the dev database recorded in the PR
- [ ] `.claude/rules/api.md` updated
- [ ] `pnpm lint`, `pnpm check-types` and both test suites pass
