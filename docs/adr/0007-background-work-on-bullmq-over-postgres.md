# Background work runs on BullMQ over our own Postgres

Status: accepted (gates run, see "Gate results"; one open question for the owner)

Re-checking Applications against a Job's Requirements (candidate matching, Layer 2) is the first work that must outlive a request, and Layers 3 and 4 will need the same. We use `@nestjs/bullmq` with `bullmq`'s PostgreSQL backend (`createPostgresBackend`), running the worker inside the API process and keeping the queue tables in BullMQ's own `bullmq` schema in the existing database. BullMQ creates and migrates that schema itself at boot, so it sits outside the Prisma contract.

Considered options:

- **A run row in our own tables with a hand-written chunked loop** — no new dependency, but we would rebuild persistence, retries, progress and resume-after-restart ourselves, and again for each later layer.
- **BullMQ on Redis (the Nest docs' default)** — mature, but a third service in `docker-compose.yml` and in production for one cheap CPU job.
- **BullMQ on the Postgres backend** — chosen. One library for retries, progress and one-run-per-Job (a stable `jobId`), with no new service. Its minimum is Postgres 13 (14 recommended); we run 17.
- **A bare fire-and-forget promise** — rejected: lost on a restart, with nothing to resume.

Consequences: the API now needs `pg` as a direct dependency (BullMQ lists it as an optional peer). Jobs only advance while the API process is running and has CPU, and we run a single Cloud Run instance; whether the service is set to always-allocated CPU is unconfirmed and must be checked before relying on a run finishing after its request returns. The queue tables are not in `contract.prisma`, so `docs/db-schema.md` notes the `bullmq` schema as an external one.

Gates before this is relied on: a real run of the Postgres backend (this ADR rests on the type definitions of `bullmq` 6.7.1 and `@nestjs/bullmq` 12.0.1, read in a scratch install), and a check that `prisma db update` and `prisma db verify` leave the extra schema alone. If either fails, fall back to the run-row option above and supersede this ADR.

## Gate results (ticket 01 spike, 2026-11-07, Postgres 17, `bullmq` 6.7.0, `@nestjs/bullmq` 12.0.0, `pg` 8.23.1)

1. **Real run of the Postgres backend: passed.** A throwaway job (40 steps, 1 s each) was enqueued from a temporary route, ran in the API process and reported progress 10, 30, 70, 100 to `completed` with its return value. 15 tables appeared in the `bullmq` schema at boot.
2. **Survives an API restart: passed, with a caveat.** The API process was killed mid-job (state `active`, progress 10). After a restart the job was picked up again as stalled after roughly 30 s and **ran again from step 0** to `completed`. Processors must therefore be idempotent; the queue does not resume mid-function.
3. **`prisma db update` and `prisma db verify` leave the schema alone: passed.** On a fresh database (`db update`, boot the API so BullMQ migrates, then `db update`, `db verify` and `db verify --strict`) every command exited 0, including `--strict`, and the 15 `bullmq` tables were still there. Prisma only inspects the schemas the contract names. (On the shared dev database a second `db update` also asked to drop `job_requirement_versions`, a table created by another keyword-match branch against the same Postgres. That is unrelated to `bullmq`, and it was not confirmed.)

Findings that differ from the text above: `@nestjs/bullmq` has no `backendFactory` option, so the backend is selected process-wide with `setDefaultBackendFactory(createPostgresBackend)`; BullMQ's default only checks the schema, so the connection needs `migrate: true` to create it; installed versions are `bullmq` 6.7.0 and `@nestjs/bullmq` 12.0.0 (not 6.7.1 and 12.0.1).

## Open question for the owner

Is the Cloud Run API service set to CPU always allocated (no CPU throttling outside requests)? Not answered; the owner has not been asked yet. Without it a Re-check run only advances while a request is being served, so a run could stall after the request that started it returns. Resolve before relying on a run finishing in the background (spec open item 1).
