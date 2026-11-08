# 07: Submit queues scoring

**What to build:** A newly submitted Application is scored in the background without slowing or breaking the submit. The row starts as pending, a queued job scores it, and a failure retries. Spec: `.scratch/candidate-matching/layer3-spec.md` ("Scoring flow"); ADR-0007 (background work).

- In the submit transaction a readable CV gets a pending score row and an unreadable one gets a not-scored row at once; a missing CV writes none. With Layer 3 off (the embedder not configured) nothing is written and nothing is queued.
- After the commit, one job per Application is enqueued with a stable job id, so a second enqueue is a no-op. An enqueue failure is logged and never fails the submit.
- The worker calls the scoring service from ticket 06, retries with backoff, and is idempotent: a restart reruns it from the start safely (ADR-0007).
- An embedder that is down ends the Application as not scored (embedder failed) after retries, never as a low score.

**Blocked by:** 06 (an Application can be scored).

**Status:** resolved

- [x] Service specs with a fake queue cover: pending row for a readable CV, immediate not-scored row for an unreadable one, no row for no CV, nothing when Layer 3 is off, and a refused enqueue leaving the submit successful
- [x] The worker is tested for success, a retried failure that recovers, and a final failure ending as not scored
- [ ] A manual run against the real API, local Ollama and the dev database: submit an Application, watch it go pending then scored
- [ ] Applications submitted while Ollama is stopped end as not scored, and rescoring later is possible (ticket 11)
- [x] `.claude/rules/api.md` describes the new queue beside Re-check
- [x] `pnpm lint`, `pnpm check-types` and `pnpm --filter api test` pass

## Answer

Built test-first on branch `worktree-agent-abb01f82bde552f04` (subject `feat(api): queue scoring of a new Application after submit`).

**What exists.** Submit: `ApplicationsService.submit` builds `NewApplication.matchScore` (pending for a readable CV, `not_scored / cv_unreadable` for an unreadable one, null for no CV, no Requirements, or Layer 3 off); `ApplicationsRepository.submit` writes it in the submit transaction and now returns `{ status: 'created', applicationId }`; after the commit a pending row gets `MatchScoringQueue.enqueue` (jobId `score-<applicationId>`, 5 attempts, exponential backoff from 10 s); a refusal is logged and swallowed. Worker: `MatchScoringProcessor` over `EmbeddingMatchService.score`. `EmbeddingMatchModule` registers the `match-scoring` queue and is imported by `ApplicationsModule` and `AppModule`. New files in `apps/api/src/embedding-match/`: `match-scoring.constants.ts`, `.queue.ts`, `.processor.ts`, `.processor.spec.ts`.

**Decisions** (the agent's own; the owner may overrule)
1. The worker rethrows on `embedder_failed` for every attempt except the last, so BullMQ retries. `score(target, { retryable })` is the new option: with `retryable` an embedder failure writes nothing and returns `{ outcome: 'embedder_failed' }`, leaving the row `pending` (no flicker to not scored and back). On the last attempt (`attemptsMade + 1 >= opts.attempts`) `score` writes `not_scored / embedder_failed` and the job completes. Docs: `apps/api/node_modules/bullmq/dist/esm/classes/job.d.ts` (`attemptsMade` = failed attempts so far).
2. The pending row is written by `ApplicationsRepository`, not `EmbeddingMatchRepository`, because it must share the submit transaction.
3. No Requirements (none or empty list) writes no row and queues nothing, matching the order inside `score`. Layer 3 off (`MatchScoringQueue.enabled`, `EMBEDDER` null) writes and queues nothing.
4. `removeOnComplete` and `removeOnFail` are true (options in `apps/api/node_modules/bullmq/dist/esm/interfaces/base-job-options.d.ts`), so the stable jobId only dedupes while a job is waiting or active and a rescore (ticket 11) can queue the same Application again. The cost: no failed-job record in the queue; failures are in the log.
5. Attempts 5 and a 10 s base are placeholders (`match-scoring.constants.ts`), longer than Re-check's because the embedder is a separate service.
6. The `BullModule.forRootAsync` (Postgres backend) stays in `RecheckModule`; `EmbeddingMatchModule` only registers its queue and relies on that global root. Moving it to a shared module touches `recheck/` and is left for a follow-up.
7. An unexpected (non-embedder) error is thrown on every attempt; after the last the row stays `pending`. Ticket 11's second stage should treat a `pending` row as needing a score.

**Verified**: in `apps/api`, `npx vitest run` 582 passed (25 files), `npx tsc --noEmit` clean, `npx oxlint src/` only old warnings in unrelated files. Not verified: a Nest boot (DI wiring of `MatchScoringQueue`, the processor and the second queue) and the real Postgres backend; no `.env`, database or Ollama here.

**Needs the owner** (the two manual boxes stay unticked)
1. Apply the schema if not done (`pnpm --filter api exec prisma db update`), set `EMBEDDING_BASE_URL` and `EMBEDDING_MODEL` in `apps/api/.env`, start `docker compose up -d` and Ollama with the model, then `pnpm dev`. Confirm the API boots (the new queue registers without error).
2. Give a Job a Requirement, open it, submit an Application with a readable CV (100+ characters of text). In SQL: `select status, reason, score from application_match_scores order by updated_at desc limit 1;` shows `pending`, then `scored` within seconds.
3. Stop Ollama, submit another Application: the row stays `pending` for about 2.5 minutes (the log shows retry warnings), then `not_scored / embedder_failed`. Start Ollama again; rescoring is ticket 11.
4. The public submit is throttled at 5 per 10 minutes per visitor.
