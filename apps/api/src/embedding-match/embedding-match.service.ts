import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  CHUNKER_VERSION,
  chunkCvText,
  scoreApplication,
  type EmbeddedVector,
  type Requirement,
} from '@repo/shared';
import { EMBEDDER, EmbedderError, type EmbedKind, type Embedder } from '../embedding/embedder.js';
import type {
  ChunkVector,
  NotScoredReason,
  RequirementVector,
  ScoreOptions,
  ScoreOutcome,
  ScoreTarget,
} from './embedding-match.js';
import { EmbeddingMatchRepository } from './embedding-match.repository.js';

/**
 * Scores one Application against its Job's current Requirements (Layer 3, ADR-0008,
 * `.scratch/candidate-matching/layer3-spec.md` "Scoring flow"). Nothing here queues or retries:
 * a caller (the submit hook and the queue, ticket 07) calls `score` and decides what to do with
 * the outcome. Idempotent: scoring the same Application again replaces its row and its chunk
 * vectors, and Requirement vectors are only ever embedded when missing.
 */
@Injectable()
export class EmbeddingMatchService {
  private readonly logger = new Logger(EmbeddingMatchService.name);

  constructor(
    private readonly repository: EmbeddingMatchRepository,
    /** Null when Layer 3 is off (`EMBEDDING_BASE_URL` and `EMBEDDING_MODEL` unset). */
    @Inject(EMBEDDER) private readonly embedder: Embedder | null,
  ) {}

  async score(target: ScoreTarget, options: ScoreOptions = {}): Promise<ScoreOutcome> {
    const { companyId, jobId, applicationId } = target;
    if (!this.embedder) return { outcome: 'disabled' };

    const current = await this.repository.findCurrentRequirements(companyId, jobId);
    if (!current || current.requirements.length === 0) return { outcome: 'no_requirements' };

    const cv = await this.repository.findCvText(companyId, jobId, applicationId);
    if (!cv) return { outcome: 'no_cv' };

    const requirementsVersion = current.version;
    const notScored = async (reason: NotScoredReason, model: string | null): Promise<ScoreOutcome> => {
      await this.repository.saveScore({
        status: 'not_scored',
        reason,
        model,
        companyId,
        jobId,
        applicationId,
        requirementsVersion,
      });
      return { outcome: 'not_scored', reason };
    };

    // `failed` ("the browser could not read it") is as unusable as `unreadable`.
    if (cv.status !== 'readable') return notScored('cv_unreadable', null);
    const chunks = chunkCvText(cv.text);
    if (chunks.length === 0) return notScored('cv_unreadable', null);

    let requirementVectors: RequirementVector[];
    let chunkVectors: ChunkVector[];
    try {
      requirementVectors = await this.ensureRequirementVectors(
        companyId,
        jobId,
        requirementsVersion,
        current.requirements,
        this.embedder,
      );
      const embedded = await this.embedChecked(this.embedder, chunks, 'document');
      chunkVectors = embedded.vectors.map((vector, chunkIndex) => ({
        chunkIndex,
        chunkerVersion: CHUNKER_VERSION,
        model: embedded.model,
        dimensions: embedded.dimensions,
        vector,
      }));
    } catch (error) {
      if (!(error instanceof EmbedderError)) throw error;
      this.logger.warn(`Embedding failed for application ${applicationId}: ${error.message}`);
      if (options.retryable) return { outcome: 'embedder_failed' };
      return notScored('embedder_failed', null);
    }

    // Kept even if the scoring below refuses (a model change): the CV's vectors are valid for the
    // model that made them, and a later re-embed of the Requirements can use them.
    await this.repository.replaceChunkVectors(companyId, jobId, applicationId, chunkVectors);

    const byRequirement: Record<string, EmbeddedVector> = {};
    for (const row of requirementVectors) byRequirement[row.requirementId] = row;
    const scored = scoreApplication(
      byRequirement,
      chunkVectors,
      current.requirements.map(({ id, tier }) => ({ id, tier })),
    );

    if (!scored.ok) {
      const model = chunkVectors[0]!.model;
      switch (scored.reason) {
        case 'model_mismatch':
        case 'length_mismatch':
          return notScored('model_changed', model);
        case 'no_chunks':
          return notScored('cv_unreadable', null);
        case 'missing_requirement_vector':
          // ensureRequirementVectors returned a vector for every Requirement, so this is a bug.
          throw new Error(`No vector for a Requirement of job ${jobId} version ${requirementsVersion}`);
      }
    }
    // A non-empty list always yields a number; `overall: null` is only for an empty one.
    if (scored.overall === null) return { outcome: 'no_requirements' };

    await this.repository.saveScore({
      status: 'scored',
      model: chunkVectors[0]!.model,
      scores: scored.requirements,
      overall: scored.overall,
      companyId,
      jobId,
      applicationId,
      requirementsVersion,
    });
    return { outcome: 'scored', overall: scored.overall };
  }

  /**
   * The stored vectors of every Requirement of the version. Missing ones are embedded as queries
   * in one call and written insert-or-ignore, then everything is read back: if another worker
   * stored the same Requirement first, its row is the one used, so both runs score against the
   * same vectors and neither fails.
   */
  private async ensureRequirementVectors(
    companyId: string,
    jobId: string,
    version: number,
    requirements: Requirement[],
    embedder: Embedder,
  ): Promise<RequirementVector[]> {
    const stored = await this.repository.findRequirementVectors(companyId, jobId, version);
    const have = new Set(stored.map((row) => row.requirementId));
    const missing = requirements.filter((requirement) => !have.has(requirement.id));
    if (missing.length === 0) return stored;

    const embedded = await this.embedChecked(
      embedder,
      missing.map((requirement) => requirement.text),
      'query',
    );
    await this.repository.saveRequirementVectors(
      companyId,
      jobId,
      version,
      missing.map((requirement, index) => ({
        requirementId: requirement.id,
        model: embedded.model,
        dimensions: embedded.dimensions,
        vector: embedded.vectors[index]!,
      })),
    );
    return this.repository.findRequirementVectors(companyId, jobId, version);
  }

  /**
   * Embeds `texts` and checks what the database cannot: one vector per text, each as long as the
   * declared `dimensions` (ADR-0008, gate result: a wrong-length `real[]` is accepted by Postgres).
   * Callers must pass non-blank texts only: the Embedder skips blanks (ticket 03).
   */
  private async embedChecked(embedder: Embedder, texts: string[], kind: EmbedKind) {
    const result = await embedder.embed(texts, kind);
    if (result.vectors.length !== texts.length) {
      throw new EmbedderError(`Expected ${texts.length} vectors, got ${result.vectors.length}`);
    }
    if (result.vectors.some((vector) => vector.length !== result.dimensions)) {
      throw new EmbedderError(`A vector is not ${result.dimensions} long`);
    }
    return result;
  }
}
