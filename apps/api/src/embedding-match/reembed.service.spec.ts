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
import type { ReembedRepository, StaleTarget } from './reembed.repository.js';
import { REEMBED_PROBE_TEXT, ReembedService } from './reembed.service.js';

// Same pattern as embedding-match.service.spec.ts: the real EmbeddingMatchService and the real
// ReembedService, on one in-memory store that plays both repositories (so a re-embed really
// reads what scoring wrote), and a fake Embedder with hand-picked 3-dimensional vectors. The SQL
// in ReembedRepository.findStale / countStale is covered by a manual run against Postgres.

type PublicApi<T> = { [K in keyof T]: T[K] };

const COMPANY = '11111111-1111-4111-8111-111111111111';
const JOB = '22222222-2222-4222-8222-222222222222';
const OTHER_JOB = '22222222-2222-4222-8222-999999999999';
const POSTGRES = '33333333-3333-4333-8333-333333333331';
const PYTHON = '33333333-3333-4333-8333-333333333332';

const postgres: Requirement = { id: POSTGRES, text: 'Experience with PostgreSQL', tier: 'must_have', keywords: [] };
const python: Requirement = { id: PYTHON, text: 'Experience with Python', tier: 'nice_to_have', keywords: [] };

const POSTGRES_CV = 'Ten years of postgres administration, replication and tuning. '.repeat(3);

class InMemoryStore implements PublicApi<EmbeddingMatchRepository>, PublicApi<ReembedRepository> {
  readonly cvs = new Map<string, { jobId: string; cv: CvTextRow }>();
  readonly requirementVectors: (RequirementVector & { jobId: string; version: number })[] = [];
  readonly chunkVectors: (ChunkVector & { applicationId: string })[] = [];
  readonly scores = new Map<string, MatchScoreInput>();
  private readonly versions = new Map<string, CurrentRequirements[]>();

  seedVersion(jobId: string, requirements: Requirement[]): number {
    const list = this.versions.get(jobId) ?? [];
    const version = list.length + 1;
    list.push({ version, requirements });
    this.versions.set(jobId, list);
    return version;
  }

  seedApplication(id: string, jobId: string, cv: CvTextRow | null): void {
    if (cv) this.cvs.set(id, { jobId, cv });
  }

  async findCvText(_companyId: string, jobId: string, applicationId: string) {
    const found = this.cvs.get(applicationId);
    return found && found.jobId === jobId ? { ...found.cv } : null;
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

  async saveRequirementVectors(_companyId: string, jobId: string, version: number, rows: RequirementVector[]) {
    for (const row of rows) {
      const exists = this.requirementVectors.some(
        (r) => r.jobId === jobId && r.version === version && r.requirementId === row.requirementId,
      );
      if (!exists) this.requirementVectors.push({ ...structuredClone(row), jobId, version });
    }
  }

  async replaceChunkVectors(_companyId: string, _jobId: string, applicationId: string, rows: ChunkVector[]) {
    this.removeChunks((c) => c.applicationId === applicationId);
    for (const row of rows) this.chunkVectors.push({ ...structuredClone(row), applicationId });
  }

  async findChunkVectors(_companyId: string, _jobId: string, applicationId: string) {
    return this.chunkVectors
      .filter((c) => c.applicationId === applicationId)
      .map(({ applicationId: _a, ...row }) => structuredClone(row));
  }

  async saveScore(input: MatchScoreInput) {
    this.scores.set(input.applicationId, structuredClone(input));
  }

  /** This store only holds scored and not-scored rows, so there is never a pending one to delete. */
  async deletePendingScore() {
    return 0;
  }

  // ReembedRepository ------------------------------------------------------------------------

  private isStale(row: MatchScoreInput, model: string) {
    return (
      (row.model !== null && row.model !== model) ||
      (row.status === 'not_scored' && row.reason === 'model_changed')
    );
  }

  private staleRows(model: string, after: string | null) {
    return [...this.scores.values()]
      .filter((row) => this.isStale(row, model) && (after === null || row.applicationId > after))
      .sort((a, b) => a.applicationId.localeCompare(b.applicationId));
  }

  async countStale(model: string) {
    return this.staleRows(model, null).length;
  }

  async findStale(model: string, limit: number, after: string | null = null): Promise<StaleTarget[]> {
    return this.staleRows(model, after)
      .slice(0, limit)
      .map(({ companyId, jobId, applicationId }) => ({ companyId, jobId, applicationId }));
  }

  async deleteStaleRequirementVectors(_companyId: string, jobId: string, model: string) {
    return this.removeRequirements((r) => r.jobId === jobId && r.model !== model);
  }

  async deleteStaleChunkVectors(_companyId: string, _jobId: string, applicationId: string, model: string) {
    return this.removeChunks((c) => c.applicationId === applicationId && c.model !== model);
  }

  private removeRequirements(test: (r: (typeof this.requirementVectors)[number]) => boolean) {
    let removed = 0;
    for (let i = this.requirementVectors.length - 1; i >= 0; i--) {
      if (test(this.requirementVectors[i]!)) {
        this.requirementVectors.splice(i, 1);
        removed += 1;
      }
    }
    return removed;
  }

  private removeChunks(test: (c: (typeof this.chunkVectors)[number]) => boolean) {
    let removed = 0;
    for (let i = this.chunkVectors.length - 1; i >= 0; i--) {
      if (test(this.chunkVectors[i]!)) {
        this.chunkVectors.splice(i, 1);
        removed += 1;
      }
    }
    return removed;
  }

  snapshot() {
    return JSON.stringify({
      requirementVectors: this.requirementVectors,
      chunkVectors: this.chunkVectors,
      scores: [...this.scores.entries()],
    });
  }

  chunkModels(applicationId: string) {
    return this.chunkVectors.filter((c) => c.applicationId === applicationId).map((c) => c.model);
  }
}

const QUERY_VECTORS: Record<string, number[]> = {
  [postgres.text]: [1, 0, 0],
  [python.text]: [0, 0, 1],
};

class FakeEmbedder implements Embedder {
  readonly calls: { texts: string[]; kind: EmbedKind }[] = [];
  model = 'old-model';
  /** When set, `embed` of a text that is not the probe throws it. */
  failDocuments: Error | null = null;
  /** When set, every call throws it, the probe included. */
  down: Error | null = null;

  async embed(texts: string[], kind: EmbedKind): Promise<EmbedResult> {
    this.calls.push({ texts: [...texts], kind });
    if (this.down) throw this.down;
    const isProbe = texts.length === 1 && texts[0] === REEMBED_PROBE_TEXT;
    if (this.failDocuments && !isProbe) throw this.failDocuments;
    const vectors = texts.map((text) =>
      kind === 'query' ? (QUERY_VECTORS[text] ?? [0, 1, 0]) : text.includes('postgres') ? [0.8, 0.6, 0] : [0, 0, 1],
    );
    return { vectors, model: this.model, dimensions: 3 };
  }

  /** Calls that are not the model probe: the real embedding work. */
  work() {
    return this.calls.filter((c) => !(c.texts.length === 1 && c.texts[0] === REEMBED_PROBE_TEXT));
  }
}

describe('ReembedService.run', () => {
  let store: InMemoryStore;
  let embedder: FakeEmbedder;
  let scoring: EmbeddingMatchService;
  let service: ReembedService;
  const target = (applicationId: string, jobId = JOB) => ({ companyId: COMPANY, jobId, applicationId });

  /** Score `ids` under the model the embedder has now. */
  const scoreAll = async (ids: string[], jobId = JOB) => {
    for (const id of ids) await scoring.score(target(id, jobId));
  };

  beforeEach(() => {
    store = new InMemoryStore();
    embedder = new FakeEmbedder();
    scoring = new EmbeddingMatchService(store as unknown as EmbeddingMatchRepository, embedder);
    service = new ReembedService(
      store as unknown as ReembedRepository,
      scoring,
      embedder,
    );
  });

  it('re-embeds Applications scored under another model: old vectors cleared, new ones stored, scored again', async () => {
    store.seedVersion(JOB, [postgres, python]);
    store.seedApplication('a1', JOB, { status: 'readable', text: POSTGRES_CV });
    store.seedApplication('a2', JOB, { status: 'readable', text: POSTGRES_CV });
    await scoreAll(['a1', 'a2']);
    embedder.model = 'new-model';

    const report = await service.run();

    expect(report).toMatchObject({
      outcome: 'done',
      model: 'new-model',
      dryRun: false,
      found: 2,
      touched: 2,
      scored: 2,
      notScored: { cv_unreadable: 0, embedder_failed: 0, model_changed: 0 },
      unchanged: 0,
      requirementVectorsCleared: 2,
      chunkVectorsCleared: 2,
    });
    for (const id of ['a1', 'a2']) {
      expect(store.scores.get(id)).toMatchObject({ status: 'scored', model: 'new-model' });
      expect(store.chunkModels(id)).toEqual(['new-model']);
    }
    expect(store.requirementVectors.map((r) => r.model)).toEqual(['new-model', 'new-model']);
    expect(store.requirementVectors).toHaveLength(2);
  });

  it('changes nothing when run again, and does no embedding work', async () => {
    store.seedVersion(JOB, [postgres]);
    store.seedApplication('a1', JOB, { status: 'readable', text: POSTGRES_CV });
    await scoreAll(['a1']);
    embedder.model = 'new-model';
    await service.run();
    const before = store.snapshot();
    const callsBefore = embedder.work().length;

    const report = await service.run();

    expect(report).toMatchObject({ outcome: 'done', found: 0, touched: 0, scored: 0 });
    expect(store.snapshot()).toBe(before);
    expect(embedder.work()).toHaveLength(callsBefore);
  });

  it('picks up an Application that scoring left as "not scored (model changed)"', async () => {
    store.seedVersion(JOB, [postgres]);
    store.seedApplication('old', JOB, { status: 'readable', text: POSTGRES_CV });
    await scoreAll(['old']);
    embedder.model = 'new-model';
    // A submit after the model change: the Requirement vectors are still the old model's.
    store.seedApplication('fresh', JOB, { status: 'readable', text: POSTGRES_CV });
    await scoreAll(['fresh']);
    expect(store.scores.get('fresh')).toMatchObject({ status: 'not_scored', reason: 'model_changed' });

    const report = await service.run();

    expect(report).toMatchObject({ found: 2, touched: 2, scored: 2 });
    expect(store.scores.get('fresh')).toMatchObject({ status: 'scored', model: 'new-model' });
    expect(store.scores.get('old')).toMatchObject({ status: 'scored', model: 'new-model' });
  });

  it('clears each Job\'s old Requirement vectors once and leaves unaffected rows alone', async () => {
    store.seedVersion(JOB, [postgres]);
    store.seedVersion(OTHER_JOB, [python]);
    store.seedApplication('a1', JOB, { status: 'readable', text: POSTGRES_CV });
    store.seedApplication('a2', JOB, { status: 'readable', text: POSTGRES_CV });
    store.seedApplication('b1', OTHER_JOB, { status: 'readable', text: POSTGRES_CV });
    store.seedApplication('short', JOB, { status: 'unreadable', text: '' });
    await scoreAll(['a1', 'a2']);
    await scoreAll(['b1'], OTHER_JOB);
    await scoreAll(['short']);
    expect(store.scores.get('short')).toMatchObject({ status: 'not_scored', reason: 'cv_unreadable', model: null });
    embedder.model = 'new-model';

    const report = await service.run({ chunkSize: 1 });

    // One Requirement vector per Job was cleared (two Jobs), however many Applications each had.
    expect(report).toMatchObject({ touched: 3, requirementVectorsCleared: 2 });
    expect(store.scores.get('short')).toMatchObject({ reason: 'cv_unreadable', model: null });
  });

  it('counts but writes nothing in a dry run', async () => {
    store.seedVersion(JOB, [postgres]);
    store.seedApplication('a1', JOB, { status: 'readable', text: POSTGRES_CV });
    await scoreAll(['a1']);
    embedder.model = 'new-model';
    const before = store.snapshot();
    const callsBefore = embedder.work().length;

    const report = await service.run({ dryRun: true });

    expect(report).toMatchObject({ outcome: 'done', dryRun: true, found: 1, touched: 0 });
    expect(store.snapshot()).toBe(before);
    expect(embedder.work()).toHaveLength(callsBefore);
  });

  it('ends an Application as "embedder failed" when the service dies mid-run, and a rerun leaves it to Re-check', async () => {
    store.seedVersion(JOB, [postgres]);
    store.seedApplication('a1', JOB, { status: 'readable', text: POSTGRES_CV });
    await scoreAll(['a1']);
    embedder.model = 'new-model';
    embedder.failDocuments = new EmbedderError('connection refused');

    const report = await service.run();

    expect(report).toMatchObject({ found: 1, touched: 1, scored: 0, notScored: { embedder_failed: 1 } });
    expect(store.scores.get('a1')).toMatchObject({ status: 'not_scored', reason: 'embedder_failed', model: null });
    // Nothing of the old model is left to be compared against.
    expect(store.chunkModels('a1')).toEqual([]);
    embedder.failDocuments = null;
    expect(await service.run()).toMatchObject({ found: 0, touched: 0 });
  });

  it('refuses to start, touching nothing, when the embedder cannot be reached', async () => {
    store.seedVersion(JOB, [postgres]);
    store.seedApplication('a1', JOB, { status: 'readable', text: POSTGRES_CV });
    await scoreAll(['a1']);
    embedder.model = 'new-model';
    embedder.down = new EmbedderError('connection refused');
    const before = store.snapshot();

    await expect(service.run()).rejects.toBeInstanceOf(EmbedderError);

    expect(store.snapshot()).toBe(before);
  });

  it('ends in chunks even when scoring writes nothing for an Application', async () => {
    store.seedVersion(JOB, [postgres]);
    store.seedApplication('a1', JOB, { status: 'readable', text: POSTGRES_CV });
    store.seedApplication('a2', JOB, { status: 'readable', text: POSTGRES_CV });
    await scoreAll(['a1', 'a2']);
    embedder.model = 'new-model';
    // a1's CV is gone: scoring answers `no_cv` and leaves its row as it was.
    store.cvs.delete('a1');

    const report = await service.run({ chunkSize: 1 });

    expect(report).toMatchObject({ found: 2, touched: 2, scored: 1, unchanged: 1 });
    expect(store.scores.get('a1')).toMatchObject({ model: 'old-model' });
    expect(store.scores.get('a2')).toMatchObject({ model: 'new-model' });
  });

  it('does nothing when Layer 3 is off', async () => {
    const off = new ReembedService(
      store as unknown as ReembedRepository,
      new EmbeddingMatchService(store as unknown as EmbeddingMatchRepository, null),
      null,
    );

    expect(await off.run()).toEqual({ outcome: 'disabled' });
  });
});
