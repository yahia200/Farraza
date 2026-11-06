# Background work runs on BullMQ over our own Postgres

Status: accepted (the Postgres backend is verified from the installed types only; see "Gates")

Re-checking Applications against a Job's Requirements (candidate matching, Layer 2) is the first work that must outlive a request, and Layers 3 and 4 will need the same. We use `@nestjs/bullmq` with `bullmq`'s PostgreSQL backend (`createPostgresBackend`), running the worker inside the API process and keeping the queue tables in BullMQ's own `bullmq` schema in the existing database. BullMQ creates and migrates that schema itself at boot, so it sits outside the Prisma contract.

Considered options:

- **A run row in our own tables with a hand-written chunked loop** — no new dependency, but we would rebuild persistence, retries, progress and resume-after-restart ourselves, and again for each later layer.
- **BullMQ on Redis (the Nest docs' default)** — mature, but a third service in `docker-compose.yml` and in production for one cheap CPU job.
- **BullMQ on the Postgres backend** — chosen. One library for retries, progress and one-run-per-Job (a stable `jobId`), with no new service. Its minimum is Postgres 13 (14 recommended); we run 17.
- **A bare fire-and-forget promise** — rejected: lost on a restart, with nothing to resume.

Consequences: the API now needs `pg` as a direct dependency (BullMQ lists it as an optional peer). Jobs only advance while the API process is running and has CPU, and we run a single Cloud Run instance; whether the service is set to always-allocated CPU is unconfirmed and must be checked before relying on a run finishing after its request returns. The queue tables are not in `contract.prisma`, so `docs/db-schema.md` notes the `bullmq` schema as an external one.

Gates before this is relied on: a real run of the Postgres backend (this ADR rests on the type definitions of `bullmq` 6.7.1 and `@nestjs/bullmq` 12.0.1, read in a scratch install), and a check that `prisma db update` and `prisma db verify` leave the extra schema alone. If either fails, fall back to the run-row option above and supersede this ADR.
