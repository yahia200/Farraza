# 07: Submit queues scoring

**What to build:** A newly submitted Application is scored in the background without slowing or breaking the submit. The row starts as pending, a queued job scores it, and a failure retries. Spec: `.scratch/candidate-matching/layer3-spec.md` ("Scoring flow"); ADR-0007 (background work).

- In the submit transaction a readable CV gets a pending score row and an unreadable one gets a not-scored row at once; a missing CV writes none. With Layer 3 off (the embedder not configured) nothing is written and nothing is queued.
- After the commit, one job per Application is enqueued with a stable job id, so a second enqueue is a no-op. An enqueue failure is logged and never fails the submit.
- The worker calls the scoring service from ticket 06, retries with backoff, and is idempotent: a restart reruns it from the start safely (ADR-0007).
- An embedder that is down ends the Application as not scored (embedder failed) after retries, never as a low score.

**Blocked by:** 06 (an Application can be scored).

**Status:** ready-for-agent

- [ ] Service specs with a fake queue cover: pending row for a readable CV, immediate not-scored row for an unreadable one, no row for no CV, nothing when Layer 3 is off, and a refused enqueue leaving the submit successful
- [ ] The worker is tested for success, a retried failure that recovers, and a final failure ending as not scored
- [ ] A manual run against the real API, local Ollama and the dev database: submit an Application, watch it go pending then scored
- [ ] Applications submitted while Ollama is stopped end as not scored, and rescoring later is possible (ticket 11)
- [ ] `.claude/rules/api.md` describes the new queue beside Re-check
- [ ] `pnpm lint`, `pnpm check-types` and `pnpm --filter api test` pass
