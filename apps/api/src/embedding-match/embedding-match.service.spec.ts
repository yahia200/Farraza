import type { Requirement } from '@repo/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { EmbedderError, type EmbedKind, type Embedder, type EmbedResult } from '../embedding/embedder.js';
import type {
  ChunkVector,
  CurrentRequirements,
  CvTextRow,
  MatchScoreInput,
  RequirementVector,
} from './embedding-match.js';
import type { EmbeddingMatchRepository } from './embedding-match.repository.js';
import { EmbeddingMatchService } from './embedding-match.service.js';

// Same pattern as recheck.service.spec.ts: the real service, the repository replaced by an
// in-memory fake that keeps the two database rules the service relies on (UNIQUE keys, and
// insert-or-ignore for Requirement vectors), and a fake Embedder with hand-picked 3-dimensional
// vectors so every expected number below is worked out by hand. The SQL and the real columns
// are covered by a manual run against Postgres, not by a spec.

type PublicApi<T> = { [K in keyof T]: T[K] };

const COMPANY = '11111111-1111-4111-8111-111111111111';
const JOB = '22222222-2222-4222-8222-222222222222';
const OTHER_JOB = '22222222-2222-4222-8222-999999999999';
const POSTGRES = '33333333-3333-4333-8333-333333333331';
const PYTHON = '33333333-3333-4333-8333-333333333332';

const postgres: Requirement = { id: POSTGRES, text: 'Experience with PostgreSQL', tier: 'must_have', keywords: [] };
const python: Requirement = { id: PYTHON, text: 'Experience with Python', tier: 'nice_to_have', keywords: [] };

// A CV needs 100 characters to be readable in the real flow; the fake does not care.
const POSTGRES_CV = 'Ten years of postgres administration, replication and tuning. '.repeat(3);
const OTHER_CV = 'Ten years of watercolour painting, portraits and landscapes. '.repeat(3);

interface FakeApplication {
  id: string;
  jobId: string;
  cv: CvTextRow | null;
}

class InMemoryEmbeddingMatchRepository implements PublicApi<EmbeddingMatchRepository> {
  readonly applications: FakeApplication[] = [];
  readonly requirementVectors: (RequirementVector & { jobId: string; version: number })[] = [];
  readonly chunkVectors: (ChunkVector & { applicationId: string })[] = [];
  readonly scores = new Map<string, MatchScoreInput>();
  /** Applications whose row is the `pending` one the submit transaction writes. */
  readonly pending = new Set<string>();
  private readonly versions = new Map<string, CurrentRequirements[]>();

  seedVersion(jobId: string, requirements: Requirement[]): number {
    const list = this.versions.get(jobId) ?? [];
    const version = list.length + 1;
    list.push({ version, requirements });
    this.versions.set(jobId, list);
    return version;
  }

  seedApplication(id: string, jobId: string, cv: CvTextRow | null): void {
    this.applications.push({ id, jobId, cv });
  }

  async findCvText(_companyId: string, jobId: string, applicationId: string) {
    const found = this.applications.find((a) => a.id === applicationId && a.jobId === jobId);
    return found?.cv ? { ...found.cv } : null;
  }

  async findCurrentRequirements(_companyId: string, jobId: string) {
    const list = this.versions.get(jobId) ?? [];
    const latest = list[list.length - 1];
    return latest ? structuredClone(latest) : null;
  }

  async findRequirementVectors(_companyId: string, jobId: string, version: number) {
    return this.requirementVectors
      .filter((r) => r.jobId === jobId && r.version === version)
      .map(({ jobId: _j, version: _v, ...row }) => structuredClone(row));
  }

  /** Insert-or-ignore on UNIQUE (job, version, requirement): a second writer loses silently. */
  async saveRequirementVectors(_companyId: string, jobId: string, version: number, rows: RequirementVector[]) {
    for (const row of rows) {
      const exists = this.requirementVectors.some(
        (r) => r.jobId === jobId && r.version === version && r.requirementId === row.requirementId,
      );
      if (!exists) this.requirementVectors.push({ ...structuredClone(row), jobId, version });
    }
  }

  async replaceChunkVectors(_companyId: string, _jobId: string, applicationId: string, rows: ChunkVector[]) {
    for (let i = this.chunkVectors.length - 1; i >= 0; i--) {
      if (this.chunkVectors[i]!.applicationId === applicationId) this.chunkVectors.splice(i, 1);
    }
    for (const row of rows) this.chunkVectors.push({ ...structuredClone(row), applicationId });
  }

  async findChunkVectors(_companyId: string, _jobId: string, applicationId: string) {
    return this.chunkVectors
      .filter((c) => c.applicationId === applicationId)
      .map(({ applicationId: _a, ...row }) => structuredClone(row));
  }

  /** One row per Application (UNIQUE application_id): a later save replaces the earlier one. */
  async saveScore(input: MatchScoreInput) {
    this.pending.delete(input.applicationId);
    this.scores.set(input.applicationId, structuredClone(input));
  }

  /** Deletes the row only while it is `pending`: a scored or not-scored row is never touched. */
  async deletePendingScore(_companyId: string, _jobId: string, applicationId: string) {
    return this.pending.delete(applicationId) ? 1 : 0;
  }

  scoreOf(applicationId: string) {
    return this.scores.get(applicationId);
  }

  chunkCount(applicationId: string) {
    return this.chunkVectors.filter((c) => c.applicationId === applicationId).length;
  }
}

/**
 * Requirement sentences map to fixed unit vectors; a CV chunk is the "postgres" direction when it
 * mentions postgres and the "painting" direction otherwise. Dot products are therefore known:
 * postgres query . postgres chunk = 0.8, python query . any chunk = 0, python query . painting chunk = 1.
 */
const QUERY_VECTORS: Record<string, number[]> = {
  [postgres.text]: [1, 0, 0],
  [python.text]: [0, 0, 1],
};
const POSTGRES_CHUNK = [0.8, 0.6, 0];
const PAINTING_CHUNK = [0, 0, 1];

class FakeEmbedder implements Embedder {
  readonly calls: { texts: string[]; kind: EmbedKind }[] = [];
  model = 'fake-model';
  failWith: Error | null = null;
  /** When set, the vectors come back this long while `dimensions` still says 3. */
  vectorLength: number | null = null;
  /** Lets a spec interleave two concurrent runs. */
  beforeAnswer: (() => Promise<void>) | null = null;

  async embed(texts: string[], kind: EmbedKind): Promise<EmbedResult> {
    this.calls.push({ texts: [...texts], kind });
    await this.beforeAnswer?.();
    if (this.failWith) throw this.failWith;
    const vectors = texts.map((text) =>
      kind === 'query' ? QUERY_VECTORS[text]! : text.includes('postgres') ? POSTGRES_CHUNK : PAINTING_CHUNK,
    );
    const length = this.vectorLength;
    const resized = length === null ? vectors : vectors.map((v) => v.slice(0, length));
    return { vectors: resized, model: this.model, dimensions: 3 };
  }

  callsOfKind(kind: EmbedKind) {
    return this.calls.filter((c) => c.kind === kind);
  }
}

describe('EmbeddingMatchService.score', () => {
  let repository: InMemoryEmbeddingMatchRepository;
  let embedder: FakeEmbedder;
  let service: EmbeddingMatchService;
  const target = (applicationId: string, jobId = JOB) => ({ companyId: COMPANY, jobId, applicationId });

  beforeEach(() => {
    repository = new InMemoryEmbeddingMatchRepository();
    embedder = new FakeEmbedder();
    service = new EmbeddingMatchService(repository as unknown as EmbeddingMatchRepository, embedder);
  });

  it('scores an Application: Requirement vectors, chunk vectors and a score row are stored', async () => {
    const version = repository.seedVersion(JOB, [postgres, python]);
    repository.seedApplication('a1', JOB, { status: 'readable', text: POSTGRES_CV });

    const outcome = await service.score(target('a1'));

    // Must-have postgres: best chunk 0.8, weight 1. Nice-to-have python: 0, weight 0.1.
    // Overall = (1 * 0.8 + 0.1 * 0) / 1.1.
    expect(outcome.outcome).toBe('scored');
    const row = repository.scoreOf('a1');
    expect(row).toMatchObject({
      status: 'scored',
      companyId: COMPANY,
      jobId: JOB,
      applicationId: 'a1',
      requirementsVersion: version,
      model: 'fake-model',
    });
    if (row?.status !== 'scored') throw new Error('expected a scored row');
    expect(row.scores[POSTGRES]).toBeCloseTo(0.8, 6);
    expect(row.scores[PYTHON]).toBeCloseTo(0, 6);
    expect(row.overall).toBeCloseTo(0.727273, 5);
    expect(outcome).toEqual({ outcome: 'scored', overall: row.overall });

    // Requirements embed as queries and the CV as documents, one call each.
    expect(embedder.callsOfKind('query')).toEqual([
      { texts: [postgres.text, python.text], kind: 'query' },
    ]);
    expect(embedder.callsOfKind('document')).toHaveLength(1);
    expect(repository.requirementVectors.map((r) => r.requirementId).sort()).toEqual([POSTGRES, PYTHON].sort());
    expect(repository.requirementVectors.every((r) => r.model === 'fake-model' && r.dimensions === 3)).toBe(true);
    expect(repository.chunkCount('a1')).toBe(1);
  });

  it('stores the chunker version and an index per chunk, and no chunk text', async () => {
    repository.seedVersion(JOB, [postgres]);
    // 3,000 characters: windows start at 0 and 1,400 (1,600 characters, 200 overlap), so two chunks.
    repository.seedApplication('a1', JOB, { status: 'readable', text: 'postgres '.repeat(334).slice(0, 3000) });

    await service.score(target('a1'));

    const chunks = await repository.findChunkVectors(COMPANY, JOB, 'a1');
    expect(chunks.map((c) => c.chunkIndex)).toEqual([0, 1]);
    expect(chunks.every((c) => c.chunkerVersion === 1 && c.model === 'fake-model' && c.dimensions === 3)).toBe(true);
    expect(chunks.every((c) => !('text' in c))).toBe(true);
  });

  it.each(['unreadable', 'failed'] as const)(
    'ends a %s CV as not scored (CV unreadable) without calling the embedder',
    async (status) => {
      const version = repository.seedVersion(JOB, [postgres]);
      repository.seedApplication('a1', JOB, { status, text: '' });

      const outcome = await service.score(target('a1'));

      expect(outcome).toEqual({ outcome: 'not_scored', reason: 'cv_unreadable' });
      expect(repository.scoreOf('a1')).toEqual({
        status: 'not_scored',
        reason: 'cv_unreadable',
        model: null,
        companyId: COMPANY,
        jobId: JOB,
        applicationId: 'a1',
        requirementsVersion: version,
      });
      expect(embedder.calls).toEqual([]);
    },
  );

  it('ends a failed embed of the CV as not scored (embedder failed), never a low score', async () => {
    repository.seedVersion(JOB, [postgres]);
    repository.seedApplication('a1', JOB, { status: 'readable', text: POSTGRES_CV });
    embedder.failWith = new EmbedderError('the embedding service is unreachable');

    const outcome = await service.score(target('a1'));

    expect(outcome).toEqual({ outcome: 'not_scored', reason: 'embedder_failed' });
    expect(repository.scoreOf('a1')).toMatchObject({ status: 'not_scored', reason: 'embedder_failed', model: null });
    expect(repository.chunkCount('a1')).toBe(0);
  });

  it('ends a vector of the wrong length as not scored (embedder failed)', async () => {
    repository.seedVersion(JOB, [postgres]);
    repository.seedApplication('a1', JOB, { status: 'readable', text: POSTGRES_CV });
    embedder.vectorLength = 2; // the result still claims dimensions: 3

    const outcome = await service.score(target('a1'));

    expect(outcome).toEqual({ outcome: 'not_scored', reason: 'embedder_failed' });
    expect(repository.requirementVectors).toEqual([]);
    expect(repository.chunkCount('a1')).toBe(0);
  });

  it('does not swallow an error that is not the embedder failing', async () => {
    repository.seedVersion(JOB, [postgres]);
    repository.seedApplication('a1', JOB, { status: 'readable', text: POSTGRES_CV });
    embedder.failWith = new TypeError('a bug, not an outage');

    await expect(service.score(target('a1'))).rejects.toThrow('a bug, not an outage');
    expect(repository.scoreOf('a1')).toBeUndefined();
  });

  it('ends as not scored (model changed) when the stored Requirement vectors came from another model', async () => {
    const version = repository.seedVersion(JOB, [postgres, python]);
    repository.seedApplication('a1', JOB, { status: 'readable', text: POSTGRES_CV });
    await service.score(target('a1')); // vectors stored by 'fake-model'
    embedder.model = 'newer-model';
    repository.seedApplication('a2', JOB, { status: 'readable', text: POSTGRES_CV });

    const outcome = await service.score(target('a2'));

    expect(outcome).toEqual({ outcome: 'not_scored', reason: 'model_changed' });
    expect(repository.scoreOf('a2')).toMatchObject({
      status: 'not_scored',
      reason: 'model_changed',
      requirementsVersion: version,
      model: 'newer-model',
    });
    // The stored Requirement vectors are left alone: replacing them is a deliberate re-embed.
    expect(repository.requirementVectors.every((r) => r.model === 'fake-model')).toBe(true);
  });

  it('writes nothing for a Job with no Requirements, or an empty current list', async () => {
    repository.seedApplication('a1', JOB, { status: 'readable', text: POSTGRES_CV });
    expect(await service.score(target('a1'))).toEqual({ outcome: 'no_requirements' });

    repository.seedVersion(JOB, []);
    expect(await service.score(target('a1'))).toEqual({ outcome: 'no_requirements' });

    expect(repository.scoreOf('a1')).toBeUndefined();
    expect(repository.requirementVectors).toEqual([]);
    expect(repository.chunkCount('a1')).toBe(0);
    expect(embedder.calls).toEqual([]);
  });

  it('clears the pending row when the Job has no Requirements, or an empty current list', async () => {
    repository.seedApplication('a1', JOB, { status: 'readable', text: POSTGRES_CV });
    repository.pending.add('a1');
    expect(await service.score(target('a1'))).toEqual({ outcome: 'no_requirements' });
    expect(repository.pending.has('a1')).toBe(false);

    // The Requirements were emptied after the submit: a version with an empty list.
    repository.pending.add('a1');
    repository.seedVersion(JOB, []);
    expect(await service.score(target('a1'))).toEqual({ outcome: 'no_requirements' });
    expect(repository.pending.has('a1')).toBe(false);
    expect(repository.scores.size).toBe(0);
  });

  it('leaves a scored or not-scored row alone when the Requirements were emptied', async () => {
    const version = repository.seedVersion(JOB, [postgres]);
    repository.seedApplication('a1', JOB, { status: 'readable', text: POSTGRES_CV });
    repository.seedApplication('a2', JOB, { status: 'unreadable', text: '' });
    await service.score(target('a1'));
    await service.score(target('a2'));
    const before = JSON.stringify([...repository.scores.entries()]);
    expect(repository.scoreOf('a1')).toMatchObject({ status: 'scored', requirementsVersion: version });

    repository.seedVersion(JOB, []);
    expect(await service.score(target('a1'))).toEqual({ outcome: 'no_requirements' });
    expect(await service.score(target('a2'))).toEqual({ outcome: 'no_requirements' });

    expect(JSON.stringify([...repository.scores.entries()])).toBe(before);
  });

  it('writes no row for an Application without a CV', async () => {
    repository.seedVersion(JOB, [postgres]);
    repository.seedApplication('a1', JOB, null);

    expect(await service.score(target('a1'))).toEqual({ outcome: 'no_cv' });

    expect(repository.scores.size).toBe(0);
    expect(embedder.calls).toEqual([]);
  });

  it('does nothing when Layer 3 is off (no embedder configured)', async () => {
    repository.seedVersion(JOB, [postgres]);
    repository.seedApplication('a1', JOB, { status: 'readable', text: POSTGRES_CV });
    service = new EmbeddingMatchService(repository as unknown as EmbeddingMatchRepository, null);

    expect(await service.score(target('a1'))).toEqual({ outcome: 'disabled' });

    expect(repository.scores.size).toBe(0);
  });

  it('does not find an Application through another Job', async () => {
    repository.seedVersion(OTHER_JOB, [postgres]);
    repository.seedApplication('a1', JOB, { status: 'readable', text: POSTGRES_CV });

    expect(await service.score(target('a1', OTHER_JOB))).toEqual({ outcome: 'no_cv' });
  });

  describe('Requirement vectors', () => {
    it('are embedded once per Job and version across runs', async () => {
      repository.seedVersion(JOB, [postgres, python]);
      repository.seedApplication('a1', JOB, { status: 'readable', text: POSTGRES_CV });
      repository.seedApplication('a2', JOB, { status: 'readable', text: OTHER_CV });

      await service.score(target('a1'));
      await service.score(target('a2'));

      expect(embedder.callsOfKind('query')).toHaveLength(1);
      expect(repository.requirementVectors).toHaveLength(2);
      expect(repository.scoreOf('a2')).toMatchObject({ status: 'scored' });
    });

    it('do not clash when two runs embed them at the same time', async () => {
      repository.seedVersion(JOB, [postgres, python]);
      repository.seedApplication('a1', JOB, { status: 'readable', text: POSTGRES_CV });
      repository.seedApplication('a2', JOB, { status: 'readable', text: OTHER_CV });
      // Both runs find the Requirement vectors missing before either has stored them.
      embedder.beforeAnswer = () => new Promise((resolve) => setTimeout(resolve, 5));

      const [first, second] = await Promise.all([service.score(target('a1')), service.score(target('a2'))]);

      expect(first.outcome).toBe('scored');
      expect(second.outcome).toBe('scored');
      expect(repository.requirementVectors).toHaveLength(2);
      expect(repository.scoreOf('a1')).toMatchObject({ status: 'scored' });
      expect(repository.scoreOf('a2')).toMatchObject({ status: 'scored' });
    });

    it('are embedded again for a newer version of the Requirements', async () => {
      repository.seedVersion(JOB, [postgres]);
      repository.seedApplication('a1', JOB, { status: 'readable', text: POSTGRES_CV });
      await service.score(target('a1'));

      const newer = repository.seedVersion(JOB, [postgres, python]);
      await service.score(target('a1'));

      expect(repository.requirementVectors.filter((r) => r.version === newer)).toHaveLength(2);
      expect(repository.requirementVectors).toHaveLength(3);
      expect(repository.scoreOf('a1')).toMatchObject({ requirementsVersion: newer });
    });
  });

  describe('scoring the same Application twice', () => {
    it('replaces its row and does not duplicate chunk vectors', async () => {
      repository.seedVersion(JOB, [postgres]);
      repository.seedApplication('a1', JOB, { status: 'readable', text: 'postgres '.repeat(334).slice(0, 3000) });

      await service.score(target('a1'));
      await service.score(target('a1'));

      expect(repository.scores.size).toBe(1);
      expect(repository.chunkCount('a1')).toBe(2);
    });

    it('turns an earlier not-scored row into a scored one once the embedder works again', async () => {
      repository.seedVersion(JOB, [postgres]);
      repository.seedApplication('a1', JOB, { status: 'readable', text: POSTGRES_CV });
      embedder.failWith = new EmbedderError('down');
      await service.score(target('a1'));
      expect(repository.scoreOf('a1')).toMatchObject({ status: 'not_scored', reason: 'embedder_failed' });

      embedder.failWith = null;
      await service.score(target('a1'));

      expect(repository.scores.size).toBe(1);
      expect(repository.scoreOf('a1')).toMatchObject({ status: 'scored' });
    });
  });
});
