import { Inject, Injectable, Logger } from '@nestjs/common';
import { EMBEDDER, type Embedder } from '../embedding/embedder.js';
import type { NotScoredReason } from './embedding-match.js';
import { EmbeddingMatchService } from './embedding-match.service.js';
import { ReembedRepository } from './reembed.repository.js';

/** What the command embeds once, before touching anything, to learn the configured model. */
export const REEMBED_PROBE_TEXT = 'model probe';

/** Applications per chunk (placeholder, easy to change). */
export const REEMBED_CHUNK_SIZE = 50;

export interface ReembedOptions {
  /** Count what would be re-embedded and write nothing. */
  dryRun?: boolean;
  chunkSize?: number;
}

export type ReembedReport =
  /** `EMBEDDER` is null: Layer 3 is off, nothing was read or written. */
  | { outcome: 'disabled' }
  | {
      outcome: 'done';
      /** The configured model every touched Application now uses. */
      model: string;
      dryRun: boolean;
      /** Applications on another model (or "model changed") when the run began. */
      found: number;
      /** Applications scored again (0 in a dry run). `scored + sum(notScored) + failed + unchanged`. */
      touched: number;
      scored: number;
      /** Never `embedder_failed`: see `failed`. */
      notScored: Record<Exclude<NotScoredReason, 'embedder_failed'>, number>;
      /**
       * The embedder failed for these. Their previous score row was kept (it names the old model,
       * so the next run finds them again), not overwritten by "not scored (embedder failed)".
       */
      failed: number;
      /** Scoring wrote nothing (no CV left, or the Job has no Requirements any more): still stale. */
      unchanged: number;
      requirementVectorsCleared: number;
      chunkVectorsCleared: number;
    };

/**
 * Brings Applications up to date after the embedding model changed (ADR-0008: "a model change
 * means 'not scored (model changed)' until a deliberate re-embed"). It is run by hand from the
 * command in `reembed.main.ts`; nothing in the API calls it.
 *
 * Idempotent and safe to rerun: an Application is stale while its score row names another model
 * (or says `model_changed`), and scoring it again replaces that row, so a finished run leaves
 * nothing stale and a second run finds nothing. A run that dies half way leaves the rest stale
 * for the next one. The Applications are walked by id with a cursor, so one that scoring cannot
 * update (its CV file is gone) cannot hold the run in a loop.
 */
@Injectable()
export class ReembedService {
  private readonly logger = new Logger(ReembedService.name);

  constructor(
    private readonly repository: ReembedRepository,
    private readonly scoring: EmbeddingMatchService,
    /** Null when Layer 3 is off. */
    @Inject(EMBEDDER) private readonly embedder: Embedder | null,
  ) {}

  async run(options: ReembedOptions = {}): Promise<ReembedReport> {
    if (!this.embedder) return { outcome: 'disabled' };
    const { dryRun = false, chunkSize = REEMBED_CHUNK_SIZE } = options;

    // The Embedder interface does not expose the configured model, only each result's, so one
    // cheap call finds it. It also proves the service is reachable before anything is cleared:
    // an unreachable embedder throws here and nothing has been touched.
    const { model } = await this.embedder.embed([REEMBED_PROBE_TEXT], 'document');

    const found = await this.repository.countStale(model);
    const report = {
      outcome: 'done' as const,
      model,
      dryRun,
      found,
      touched: 0,
      scored: 0,
      notScored: { cv_unreadable: 0, model_changed: 0 },
      failed: 0,
      unchanged: 0,
      requirementVectorsCleared: 0,
      chunkVectorsCleared: 0,
    };
    if (dryRun || found === 0) return report;

    const clearedJobs = new Set<string>();
    let after: string | null = null;
    for (;;) {
      const chunk = await this.repository.findStale(model, chunkSize, after);
      if (chunk.length === 0) break;

      for (const target of chunk) {
        const { companyId, jobId, applicationId } = target;
        // Once per Job: the Requirement vectors are shared by all its Applications, and scoring
        // embeds them again (as the new model's) the first time one is missing.
        if (!clearedJobs.has(jobId)) {
          report.requirementVectorsCleared += await this.repository.deleteStaleRequirementVectors(
            companyId,
            jobId,
            model,
          );
          clearedJobs.add(jobId);
        }
        report.chunkVectorsCleared += await this.repository.deleteStaleChunkVectors(
          companyId,
          jobId,
          applicationId,
          model,
        );

        // `retryable`: this command is the retry. If the embedder dies, `score` must leave the
        // Application's previous result alone instead of overwriting it with "embedder failed", so
        // a rerun still finds it stale (the same option the queue uses between attempts).
        const outcome = await this.scoring.score(target, { retryable: true });
        report.touched += 1;
        if (outcome.outcome === 'scored') report.scored += 1;
        else if (outcome.outcome === 'embedder_failed') {
          report.failed += 1;
          this.logger.warn(`Application ${applicationId} was not re-scored (the embedder failed)`);
        } else if (outcome.outcome === 'not_scored') {
          // Cannot be `embedder_failed` while `retryable` is set; the guard keeps the type honest.
          if (outcome.reason === 'embedder_failed') report.failed += 1;
          else report.notScored[outcome.reason] += 1;
        } else {
          report.unchanged += 1;
          this.logger.warn(`Application ${applicationId} was not re-scored (${outcome.outcome})`);
        }
      }
      after = chunk[chunk.length - 1]!.applicationId;
    }
    return report;
  }
}
