import type { Requirement } from '@repo/shared';
import type { Job } from 'bullmq';
import { beforeEach, describe, expect, it } from 'vitest';
import { EmbedderError, type EmbedKind, type Embedder, type EmbedResult } from '../embedding/embedder.js';
import type { CvTextRow, MatchScoreInput, RequirementVector, ChunkVector, CurrentRequirements, ScoreTarget } from './embedding-match.js';
import type { EmbeddingMatchRepository } from './embedding-match.repository.js';
import { EmbeddingMatchService } from './embedding-match.service.js';
import { MatchScoringProcessor } from './match-scoring.processor.js';

// The worker is a thin adapter over EmbeddingMatchService.score (which has its own specs), so these
// specs pin what the adapter adds: when a failure is retried and when it is written. They use the
// real service over an in-memory repository and a fake Embedder, and a plain object for the BullMQ
// job (the fields the processor reads: data, attemptsMade, opts.attempts). The queue itself and the
// Postgres backend are covered by a manual run. The other outcomes (no CV, an unreadable or empty
// CV, a Job with no Requirements, a model change, Layer 3 off) are deliberately left to
// embedding-match.service.spec.ts: the processor passes them through unchanged and never retries them.

type PublicApi<T> = { [K in keyof T]: T[K] };

const COMPANY = '11111111-1111-4111-8111-111111111111';
const JOB = '22222222-2222-4222-8222-222222222222';
const APPLICATION = 'application-1';
const POSTGRES = '33333333-3333-4333-8333-333333333331';
const postgres: Requirement = { id: POSTGRES, text: 'Experience with PostgreSQL', tier: 'must_have', keywords: [] };
const CV = 'Ten years of postgres administration, replication and tuning. '.repeat(3);
const target: ScoreTarget = { companyId: COMPANY, jobId: JOB, applicationId: APPLICATION };

class InMemoryRepository implements PublicApi<EmbeddingMatchRepository> {
  /** The Application's score row. Starts as the `pending` row the submit transaction writes. */
  row: { status: string; reason?: string } | null = { status: 'pending' };
  readonly saves: MatchScoreInput[] = [];
  private readonly requirementVectors: RequirementVector[] = [];
  private chunkVectors: ChunkVector[] = [];

  async findCvText(): Promise<CvTextRow | null> {
    return { status: 'readable', text: CV };
  }
  async findCurrentRequirements(): Promise<CurrentRequirements | null> {
    return { version: 1, requirements: [postgres] };
  }
  async findRequirementVectors() {
    return [...this.requirementVectors];
  }
  async saveRequirementVectors(_c: string, _j: string, _v: number, rows: RequirementVector[]) {
    for (const row of rows) {
      if (!this.requirementVectors.some((r) => r.requirementId === row.requirementId)) {
        this.requirementVectors.push(row);
      }
    }
  }
  async replaceChunkVectors(_c: string, _j: string, _a: string, rows: ChunkVector[]) {
    this.chunkVectors = rows;
  }
  async findChunkVectors() {
    return this.chunkVectors;
  }
  async saveScore(input: MatchScoreInput) {
    this.saves.push(input);
    this.row = input.status === 'scored' ? { status: 'scored' } : { status: 'not_scored', reason: input.reason };
  }
  async deletePendingScore() {
    if (this.row?.status !== 'pending') return 0;
    this.row = null;
    return 1;
  }
}

/** Embeds everything as the same vector, so a CV always scores 1; can be told to be down. */
class FakeEmbedder implements Embedder {
  down = false;
  calls = 0;
  async embed(texts: string[], _kind: EmbedKind): Promise<EmbedResult> {
    this.calls++;
    if (this.down) throw new EmbedderError('connection refused');
    return { vectors: texts.map(() => [1, 0, 0]), model: 'fake-model', dimensions: 3 };
  }
}

/** The fields of a BullMQ job the processor reads, as they stand while attempt `attemptsMade + 1` runs. */
const jobAt = (attemptsMade: number, attempts = 3) =>
  ({ data: target, attemptsMade, opts: { attempts } }) as unknown as Job<ScoreTarget>;

describe('MatchScoringProcessor', () => {
  let repository: InMemoryRepository;
  let embedder: FakeEmbedder;
  let processor: MatchScoringProcessor;

  beforeEach(() => {
    repository = new InMemoryRepository();
    embedder = new FakeEmbedder();
    const service = new EmbeddingMatchService(repository as unknown as EmbeddingMatchRepository, embedder);
    processor = new MatchScoringProcessor(service);
  });

  it('scores the Application, replacing its pending row', async () => {
    await expect(processor.process(jobAt(0))).resolves.toEqual({ outcome: 'scored' });

    expect(repository.row).toEqual({ status: 'scored' });
  });

  it('fails an attempt while the embedder is down and leaves the row pending, so the queue retries', async () => {
    embedder.down = true;

    await expect(processor.process(jobAt(0))).rejects.toThrow(/embedder/i);

    expect(repository.row).toEqual({ status: 'pending' });
    expect(repository.saves).toEqual([]);
  });

  it('recovers when the embedder comes back on a retry, never having shown not scored', async () => {
    embedder.down = true;
    await expect(processor.process(jobAt(0))).rejects.toThrow();
    await expect(processor.process(jobAt(1))).rejects.toThrow();

    embedder.down = false;
    await expect(processor.process(jobAt(2, 5))).resolves.toEqual({ outcome: 'scored' });

    expect(repository.saves.map((save) => save.status)).toEqual(['scored']);
    expect(repository.row).toEqual({ status: 'scored' });
  });

  it('ends the Application as not scored (embedder failed) on the final attempt, without failing the job', async () => {
    embedder.down = true;

    await expect(processor.process(jobAt(2, 3))).resolves.toEqual({
      outcome: 'not_scored',
      reason: 'embedder_failed',
    });

    expect(repository.row).toEqual({ status: 'not_scored', reason: 'embedder_failed' });
  });

  it('treats a job with no attempts option as a single attempt', async () => {
    embedder.down = true;
    const job = { data: target, attemptsMade: 0, opts: {} } as unknown as Job<ScoreTarget>;

    await expect(processor.process(job)).resolves.toMatchObject({ reason: 'embedder_failed' });

    expect(repository.row).toEqual({ status: 'not_scored', reason: 'embedder_failed' });
  });

  it('is safe to run again after the Application was already scored', async () => {
    await processor.process(jobAt(0));
    await processor.process(jobAt(0));

    expect(repository.saves.map((save) => save.status)).toEqual(['scored', 'scored']);
    expect(repository.row).toEqual({ status: 'scored' });
  });
});
