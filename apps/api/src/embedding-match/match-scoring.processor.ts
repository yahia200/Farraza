import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import type { NotScoredReason, ScoreTarget } from './embedding-match.js';
import { EmbeddingMatchService } from './embedding-match.service.js';
import { MATCH_SCORING_QUEUE } from './match-scoring.constants.js';

export type MatchScoringResult =
  | { outcome: 'scored' | 'disabled' | 'no_requirements' | 'no_cv' }
  | { outcome: 'not_scored'; reason: NotScoredReason };

// The Layer 3 worker (ADR-0007): a thin adapter from a BullMQ job to `EmbeddingMatchService.score`,
// which holds the logic. WorkerHost and @Processor:
// node_modules/@nestjs/bullmq/dist/hosts/worker-host.class.d.ts and
// dist/decorators/processor.decorator.d.ts.
//
// Idempotent: `score` replaces the Application's row and chunk vectors and only embeds Requirements
// that are missing, so a job a restart reruns from the start is safe.
//
// Retries. An embedder that is down makes `score` write `not_scored / embedder_failed` at once,
// which on a retried job would show the Application as not scored and then, on recovery, scored.
// So an attempt that has retries left asks `score` not to write that failure (`retryable`) and
// throws instead, which makes BullMQ retry with backoff (the queue's `attempts` and `backoff`
// options, `MatchScoringQueue.enqueue`) while the row stays `pending`. The last attempt lets
// `score` write `not_scored / embedder_failed` and the job completes normally. Every other failure
// (a database error) is thrown as is on every attempt.
//
// `job.attemptsMade` is "Number of attempts after the job has failed"
// (node_modules/bullmq/dist/esm/classes/job.d.ts), so while attempt n runs it is n - 1.
@Processor(MATCH_SCORING_QUEUE)
export class MatchScoringProcessor extends WorkerHost {
  constructor(private readonly scoring: EmbeddingMatchService) {
    super();
  }

  async process(job: Job<ScoreTarget>): Promise<MatchScoringResult> {
    const attempts = job.opts.attempts ?? 1;
    const lastAttempt = job.attemptsMade + 1 >= attempts;

    const result = await this.scoring.score(job.data, { retryable: !lastAttempt });
    switch (result.outcome) {
      case 'embedder_failed':
        throw new Error(
          `The embedder failed for application ${job.data.applicationId} (attempt ${job.attemptsMade + 1} of ${attempts})`,
        );
      case 'not_scored':
        return { outcome: 'not_scored', reason: result.reason };
      default:
        return { outcome: result.outcome };
    }
  }
}
