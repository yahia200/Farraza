import { Inject, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { EMBEDDER, type Embedder } from '../embedding/embedder.js';
import type { ScoreTarget } from './embedding-match.js';
import {
  MATCH_SCORING_ATTEMPTS,
  MATCH_SCORING_BACKOFF_MS,
  MATCH_SCORING_QUEUE,
  matchScoringJobId,
} from './match-scoring.constants.js';

/**
 * The producer side of Layer 3's scoring queue (ADR-0007): everything a caller needs to ask for a
 * score without knowing about BullMQ. `ApplicationsService` calls it after a submit commits; the
 * Re-check second stage (ticket 11) can call it for Applications that need a new score.
 */
@Injectable()
export class MatchScoringQueue {
  constructor(
    @InjectQueue(MATCH_SCORING_QUEUE) private readonly queue: Queue<ScoreTarget>,
    /** Null when Layer 3 is off. */
    @Inject(EMBEDDER) private readonly embedder: Embedder | null,
  ) {}

  /** False when Layer 3 is off: callers then write no score row and queue nothing. */
  get enabled(): boolean {
    return this.embedder !== null;
  }

  /**
   * Queues one scoring job for the Application. The jobId is stable, so while a job for it is
   * waiting, delayed or active, a second call does nothing. Finished jobs are removed at once
   * (`removeOnComplete`, `removeOnFail`), so the same Application can be queued again later (a
   * rescore, ticket 11). Retried with exponential backoff; the worker is idempotent
   * (`MatchScoringProcessor`).
   */
  async enqueue(target: ScoreTarget): Promise<void> {
    await this.queue.add('score', target, {
      jobId: matchScoringJobId(target.applicationId),
      attempts: MATCH_SCORING_ATTEMPTS,
      backoff: { type: 'exponential', delay: MATCH_SCORING_BACKOFF_MS },
      removeOnComplete: true,
      removeOnFail: true,
    });
  }
}
