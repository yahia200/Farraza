import { NotFoundException } from '@nestjs/common';
import { AuthorizationError, AuthorizationModule, AuthorizationService } from '@nestjs/authorization';
import { Test } from '@nestjs/testing';
import { missedMustHave, type Requirement, type RequirementMatches } from '@repo/shared';
import type { Queue } from 'bullmq';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MemberRole, Membership } from '../companies/company.js';
import type { JobWithStages } from '../jobs/job.js';
import { JobPolicy } from '../jobs/job.policy.js';
import type { JobsService } from '../jobs/jobs.service.js';
import type { User } from '../users/user.js';
import type { EmbeddingMatchService } from '../embedding-match/embedding-match.service.js';
import type { ScoreOutcome, ScoreTarget } from '../embedding-match/embedding-match.js';
import type { RecheckRepository } from './recheck.repository.js';
import { PENDING_STALE_MINUTES } from './recheck.constants.js';
import { RecheckService } from './recheck.service.js';

// Same pattern as jobs.service.spec.ts: the real service and real JobPolicy, with
// the repository replaced by an in-memory fake and the queue by a fake that
// behaves like BullMQ for the two calls used (a stable jobId is unique; a
// finished job stays until removed). The BullMQ Postgres backend and the SQL in
// RecheckRepository are exercised by a manual run against the dev database.

type PublicApi<T> = { [K in keyof T]: T[K] };

interface FakeApplication {
  id: string;
  jobId: string;
  status: 'active' | 'rejected' | 'hired' | 'withdrawn';
  cv: 'readable' | 'unreadable' | 'failed' | null;
  text: string;
  /** False when the CV `files` row is still `pending` (no finished upload). */
  cvUploaded: boolean;
  result: { version: number; missedMustHave: boolean; results: RequirementMatches } | null;
  /** The Layer 3 row (`application_match_scores`), or null when the Application has none. */
  score: {
    version: number;
    status: 'pending' | 'scored' | 'not_scored';
    reason?: 'cv_unreadable' | 'embedder_failed' | 'model_changed';
    /** How long a `pending` row has been waiting, in minutes; absent means just written. */
    ageMinutes?: number;
  } | null;
}

class InMemoryRecheckRepository implements PublicApi<RecheckRepository> {
  readonly applications: FakeApplication[] = [];
  private readonly versions = new Map<string, { version: number; requirements: Requirement[] }[]>();
  private afterSave: ((saves: number) => void) | null = null;
  private saves = 0;

  seedVersion(jobId: string, requirements: Requirement[]): number {
    const list = this.versions.get(jobId) ?? [];
    const version = list.length + 1;
    list.push({ version, requirements });
    this.versions.set(jobId, list);
    return version;
  }

  seedApplication(input: Partial<FakeApplication> & { id: string; jobId: string }): void {
    this.applications.push({ status: 'active', cv: 'readable', text: '', cvUploaded: true, result: null, score: null, ...input });
  }

  /** Test setup: run `hook` after every save, as another request could between chunks. */
  afterEachSave(hook: (saves: number) => void): void {
    this.afterSave = hook;
  }

  resultOf(id: string) {
    return this.applications.find((a) => a.id === id)?.result ?? null;
  }

  async findCurrentRequirements(_companyId: string, jobId: string) {
    const list = this.versions.get(jobId) ?? [];
    const latest = list[list.length - 1];
    return latest ? structuredClone(latest) : null;
  }

  private needing(jobId: string, version: number) {
    return this.applications
      .filter(
        (a) =>
          a.jobId === jobId &&
          a.status !== 'rejected' &&
          a.cv === 'readable' &&
          a.cvUploaded &&
          (a.result === null || a.result.version < version),
      )
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  async countNeeding(_companyId: string, jobId: string, version: number) {
    return version > 0 ? this.needing(jobId, version).length : 0;
  }

  async findNeeding(_companyId: string, jobId: string, version: number, limit: number) {
    return this.needing(jobId, version)
      .slice(0, limit)
      .map((a) => ({ applicationId: a.id, text: a.text }));
  }

  /** What the Layer 3 stage works on: no score row, one behind, still pending, or the embedder failed. */
  private needsScore(a: FakeApplication, version: number) {
    return (
      a.score === null ||
      a.score.version < version ||
      (a.score.status === 'pending' && (a.score.ageMinutes ?? 0) >= PENDING_STALE_MINUTES) ||
      (a.score.status === 'not_scored' && a.score.reason === 'embedder_failed')
    );
  }

  private needingEither(jobId: string, version: number, after: string | null) {
    return this.applications
      .filter(
        (a) =>
          a.jobId === jobId &&
          a.status !== 'rejected' &&
          a.cv === 'readable' &&
          a.cvUploaded &&
          (a.result === null || a.result.version < version || this.needsScore(a, version)) &&
          (after === null || a.id > after),
      )
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  async countNeedingWithScores(_companyId: string, jobId: string, version: number, after: string | null = null) {
    return version > 0 ? this.needingEither(jobId, version, after).length : 0;
  }

  async findNeedingWithScores(
    _companyId: string,
    jobId: string,
    version: number,
    limit: number,
    after: string | null = null,
  ) {
    return this.needingEither(jobId, version, after)
      .slice(0, limit)
      .map((a) => ({
        applicationId: a.id,
        text: a.text,
        needsKeywords: a.result === null || a.result.version < version,
        needsScore: this.needsScore(a, version),
      }));
  }

  async saveResult(input: {
    companyId: string;
    jobId: string;
    applicationId: string;
    version: number;
    results: RequirementMatches;
    missedMustHave: boolean;
  }) {
    const app = this.applications.find((a) => a.id === input.applicationId)!;
    app.result = {
      version: input.version,
      results: input.results,
      missedMustHave: input.missedMustHave,
    };
    this.saves += 1;
    this.afterSave?.(this.saves);
  }
}

/**
 * Stands in for `EmbeddingMatchService`: `score` writes the score row the real service would
 * (`scored` when the embedder is up, `not_scored / embedder_failed` when it is down) so the
 * Application leaves, or stays in, the Re-check selection as it would in the database.
 */
class FakeEmbeddingMatch implements Pick<EmbeddingMatchService, 'enabled' | 'score'> {
  /** Layer 3 is off unless a spec turns it on: the older specs describe Re-check as it was. */
  enabled = false;
  embedderUp = true;
  readonly scored: string[] = [];
  /** Test setup: throw on the n-th call (1-based), as a lost database connection would. */
  throwOnCall: number | null = null;
  private calls = 0;

  constructor(private readonly repo: InMemoryRecheckRepository) {}

  async score(target: ScoreTarget): Promise<ScoreOutcome> {
    this.calls += 1;
    if (this.throwOnCall === this.calls) throw new Error('killed');
    const app = this.repo.applications.find((a) => a.id === target.applicationId)!;
    const current = await this.repo.findCurrentRequirements(target.companyId, target.jobId);
    const version = current!.version;
    this.scored.push(target.applicationId);
    if (!this.embedderUp) {
      app.score = { version, status: 'not_scored', reason: 'embedder_failed' };
      return { outcome: 'not_scored', reason: 'embedder_failed' };
    }
    app.score = { version, status: 'scored' };
    return { outcome: 'scored', overall: 0.5 };
  }
}

type FakeState = 'waiting' | 'active' | 'completed' | 'failed';
interface FakeJob {
  id: string;
  data: unknown;
  progress: unknown;
  returnvalue: unknown;
  finishedOn?: number;
  state: FakeState;
  getState(): Promise<FakeState>;
  remove(): Promise<void>;
}

class FakeQueue {
  readonly jobs = new Map<string, FakeJob>();
  addCalls = 0;

  async add(_name: string, data: unknown, opts: { jobId: string }) {
    this.addCalls += 1;
    const existing = this.jobs.get(opts.jobId);
    if (existing) return existing;
    const job: FakeJob = {
      id: opts.jobId,
      data,
      progress: 0,
      returnvalue: undefined,
      state: 'waiting',
      getState: async () => job.state,
      remove: async () => {
        this.jobs.delete(opts.jobId);
      },
    };
    this.jobs.set(opts.jobId, job);
    return job;
  }

  async getJob(id: string) {
    return this.jobs.get(id);
  }
}

const company = { id: 'company-1', name: 'Acme', slug: 'acme', logoUrl: null, brandColor: null };
const otherCompany = { ...company, id: 'company-2', slug: 'other' };
const user: User = { id: 'user-1', email: 'a@acme.test', emailVerified: true, name: 'Ada' };
const membershipWithRole = (role: MemberRole, c = company): Membership => ({
  userId: user.id,
  role,
  company: c,
});

const req = (id: string, tier: Requirement['tier'], keywords: string[]): Requirement => ({
  id,
  text: id,
  tier,
  keywords,
});

describe('RecheckService', () => {
  let repo: InMemoryRecheckRepository;
  let queue: FakeQueue;
  let embeddingMatch: FakeEmbeddingMatch;
  let service: RecheckService;
  const job = { id: 'job-1', slug: 'backend' } as JobWithStages;
  const slug = job.slug;

  beforeEach(async () => {
    repo = new InMemoryRecheckRepository();
    queue = new FakeQueue();
    embeddingMatch = new FakeEmbeddingMatch(repo);
    const moduleRef = await Test.createTestingModule({
      imports: [AuthorizationModule.forRoot()],
      providers: [JobPolicy],
    }).compile();

    // Only company-1 owns job-1, as the real JobsService would answer.
    const jobs = {
      get: async (membership: Membership, jobSlug: string) => {
        if (membership.company.id !== company.id || jobSlug !== job.slug) {
          throw new NotFoundException();
        }
        const current = await repo.findCurrentRequirements(company.id, job.id);
        return { ...job, requirementsVersion: current?.version ?? 0 };
      },
    } as unknown as JobsService;

    service = new RecheckService(
      jobs,
      repo as unknown as RecheckRepository,
      moduleRef.get(AuthorizationService),
      queue as unknown as Queue,
      embeddingMatch as unknown as EmbeddingMatchService,
    );
  });

  describe('count', () => {
    it('is zero for a Job with no Requirements version, whatever its Applications', async () => {
      repo.seedApplication({ id: 'a1', jobId: job.id });

      expect(await service.count(membershipWithRole('owner'), slug)).toEqual({ count: 0 });
    });

    it('counts only non-rejected Applications with a readable CV and no result or an older one', async () => {
      const v1 = repo.seedVersion(job.id, [req('go', 'must_have', ['go'])]);
      repo.seedApplication({ id: 'new', jobId: job.id });
      repo.seedApplication({ id: 'rejected', jobId: job.id, status: 'rejected' });
      repo.seedApplication({ id: 'unreadable', jobId: job.id, cv: 'unreadable' });
      repo.seedApplication({ id: 'failed', jobId: job.id, cv: 'failed' });
      repo.seedApplication({ id: 'nocv', jobId: job.id, cv: null });
      repo.seedApplication({ id: 'pending', jobId: job.id, cvUploaded: false });
      repo.seedApplication({
        id: 'current',
        jobId: job.id,
        result: { version: v1, missedMustHave: false, results: {} },
      });
      expect(await service.count(membershipWithRole('owner'), slug)).toEqual({ count: 1 });

      repo.seedVersion(job.id, [req('go', 'must_have', ['golang'])]);
      expect(await service.count(membershipWithRole('owner'), slug)).toEqual({ count: 2 });
    });

    it('answers 404 for another tenant', async () => {
      await expect(
        service.count(membershipWithRole('owner', otherCompany), slug),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('start', () => {
    beforeEach(() => {
      repo.seedVersion(job.id, [req('go', 'must_have', ['go'])]);
      repo.seedApplication({ id: 'a1', jobId: job.id });
    });

    it('enqueues one run with a stable jobId and reports it as running', async () => {
      const status = await service.start(user, membershipWithRole('owner'), slug);

      expect(queue.jobs.size).toBe(1);
      expect([...queue.jobs.keys()]).toEqual([`recheck-${job.id}`]);
      expect(status).toEqual({ state: 'running', processed: 0, total: 1 });
    });

    it('is a no-op while a run is waiting or active', async () => {
      await service.start(user, membershipWithRole('owner'), slug);
      await service.start(user, membershipWithRole('owner'), slug);
      queue.jobs.get(`recheck-${job.id}`)!.state = 'active';
      await service.start(user, membershipWithRole('owner'), slug);

      expect(queue.addCalls).toBe(1);
    });

    it('starts a new run once the previous one finished', async () => {
      await service.start(user, membershipWithRole('owner'), slug);
      const first = queue.jobs.get(`recheck-${job.id}`)!;
      first.state = 'completed';
      repo.seedVersion(job.id, [req('go', 'must_have', ['golang'])]);

      const status = await service.start(user, membershipWithRole('owner'), slug);

      expect(queue.addCalls).toBe(2);
      expect(queue.jobs.get(`recheck-${job.id}`)).not.toBe(first);
      expect(status.state).toBe('running');
    });

    it('does not enqueue when nothing needs a Re-check', async () => {
      repo.applications[0]!.cv = 'unreadable';

      const status = await service.start(user, membershipWithRole('owner'), slug);

      expect(queue.addCalls).toBe(0);
      expect(status).toEqual({ state: 'idle', lastRun: null });
    });

    it('is refused for an interviewer and answers 404 for another tenant', async () => {
      await expect(
        service.start(user, membershipWithRole('interviewer'), slug),
      ).rejects.toBeInstanceOf(AuthorizationError);
      await expect(
        service.start(user, membershipWithRole('owner', otherCompany), slug),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(queue.addCalls).toBe(0);
    });
  });

  describe('status', () => {
    it('is idle with no last run before any run', async () => {
      expect(await service.status(membershipWithRole('owner'), slug)).toEqual({
        state: 'idle',
        lastRun: null,
      });
    });

    it('shows progress while running and the last run once finished', async () => {
      repo.seedVersion(job.id, [req('go', 'must_have', ['go'])]);
      repo.seedApplication({ id: 'a1', jobId: job.id });
      await service.start(user, membershipWithRole('owner'), slug);
      const queued = queue.jobs.get(`recheck-${job.id}`)!;

      queued.state = 'active';
      queued.progress = { processed: 3, total: 7 };
      expect(await service.status(membershipWithRole('owner'), slug)).toEqual({
        state: 'running',
        processed: 3,
        total: 7,
      });

      queued.state = 'completed';
      queued.returnvalue = { processed: 7 };
      queued.finishedOn = Date.parse('2026-01-02T03:04:05Z');
      expect(await service.status(membershipWithRole('owner'), slug)).toEqual({
        state: 'idle',
        lastRun: { finishedAt: '2026-01-02T03:04:05.000Z', processed: 7, failed: false },
      });

      queued.state = 'failed';
      queued.returnvalue = undefined;
      expect(await service.status(membershipWithRole('owner'), slug)).toMatchObject({
        state: 'idle',
        lastRun: { failed: true },
      });
    });
  });

  describe('the Layer 3 stage (embedding match)', () => {
    const owner = membershipWithRole('owner');
    const data = { companyId: company.id, jobId: job.id };
    const go = req('go', 'must_have', ['go']);
    const sentence = req('postgres', 'must_have', []);

    beforeEach(() => {
      embeddingMatch.enabled = true;
    });

    it('counts Applications whose score is missing, behind, abandoned as pending or failed, once each', async () => {
      const v1 = repo.seedVersion(job.id, [go]);
      const done = { version: v1, missedMustHave: false, results: {} };
      repo.seedApplication({ id: 'missing', jobId: job.id, result: done });
      // Pending for longer than the submit-time job can still be working: its last attempt died
      // without writing a result (a database error), so nothing else will ever score it.
      repo.seedApplication({
        id: 'abandoned',
        jobId: job.id,
        result: done,
        score: { version: v1, status: 'pending', ageMinutes: PENDING_STALE_MINUTES },
      });
      // Pending for a minute: the submit-time job is still working on it, so Re-check leaves it.
      repo.seedApplication({
        id: 'in-flight',
        jobId: job.id,
        result: done,
        score: { version: v1, status: 'pending', ageMinutes: 1 },
      });
      repo.seedApplication({
        id: 'failed',
        jobId: job.id,
        result: done,
        score: { version: v1, status: 'not_scored', reason: 'embedder_failed' },
      });
      // Needs both the keyword result and the score, and still counts as one Application.
      repo.seedApplication({ id: 'both', jobId: job.id });
      // Up to date, or not this stage's to retry: a model change is the re-embed command's.
      repo.seedApplication({ id: 'scored', jobId: job.id, result: done, score: { version: v1, status: 'scored' } });
      repo.seedApplication({
        id: 'model',
        jobId: job.id,
        result: done,
        score: { version: v1, status: 'not_scored', reason: 'model_changed' },
      });
      repo.seedApplication({
        id: 'unreadable-cv',
        jobId: job.id,
        result: done,
        score: { version: v1, status: 'not_scored', reason: 'cv_unreadable' },
      });

      expect(await service.count(owner, slug)).toEqual({ count: 4 });

      // A new Requirements version puts every readable Application behind, scored or not.
      repo.seedVersion(job.id, [go, sentence]);
      expect(await service.count(owner, slug)).toEqual({ count: 8 });
    });

    it('scores an abandoned pending Application in a run and leaves an in-flight one alone', async () => {
      const v1 = repo.seedVersion(job.id, [go]);
      const done = { version: v1, missedMustHave: false, results: {} };
      repo.seedApplication({
        id: 'abandoned',
        jobId: job.id,
        result: done,
        score: { version: v1, status: 'pending', ageMinutes: PENDING_STALE_MINUTES },
      });
      // One minute short of the threshold: still in flight.
      repo.seedApplication({
        id: 'in-flight',
        jobId: job.id,
        result: done,
        score: { version: v1, status: 'pending', ageMinutes: PENDING_STALE_MINUTES - 1 },
      });

      expect(await service.run(data, async () => {})).toEqual({ processed: 1 });

      expect(embeddingMatch.scored).toEqual(['abandoned']);
      expect(repo.applications[0]!.score).toMatchObject({ status: 'scored' });
      expect(repo.applications[1]!.score).toMatchObject({ status: 'pending' });
    });

    it('skips rejected Applications, unreadable CVs and unfinished uploads', async () => {
      const v1 = repo.seedVersion(job.id, [go]);
      const done = { version: v1, missedMustHave: false, results: {} };
      repo.seedApplication({ id: 'rejected', jobId: job.id, status: 'rejected', result: done });
      repo.seedApplication({ id: 'unreadable', jobId: job.id, cv: 'unreadable', result: done });
      repo.seedApplication({ id: 'failed', jobId: job.id, cv: 'failed', result: done });
      repo.seedApplication({ id: 'nocv', jobId: job.id, cv: null, result: done });
      repo.seedApplication({ id: 'pending-upload', jobId: job.id, cvUploaded: false, result: done });

      expect(await service.count(owner, slug)).toEqual({ count: 0 });
    });

    it('is zero when Layer 3 is off, even for Applications with no score', async () => {
      const v1 = repo.seedVersion(job.id, [go]);
      repo.seedApplication({ id: 'a1', jobId: job.id, result: { version: v1, missedMustHave: false, results: {} } });
      embeddingMatch.enabled = false;

      expect(await service.count(owner, slug)).toEqual({ count: 0 });
      await service.run(data, async () => {});
      expect(embeddingMatch.scored).toEqual([]);
      expect(repo.applications[0]!.score).toBeNull();
    });

    it('is zero for a Job whose current Requirements list is empty (nothing to score against)', async () => {
      const v1 = repo.seedVersion(job.id, []);
      repo.seedApplication({ id: 'a1', jobId: job.id, result: { version: v1, missedMustHave: false, results: {} } });

      expect(await service.count(owner, slug)).toEqual({ count: 0 });
      expect(await service.run(data, async () => {})).toEqual({ processed: 0 });
    });

    it('starts a run for an Application that only lacks a score', async () => {
      const v1 = repo.seedVersion(job.id, [go]);
      repo.seedApplication({ id: 'a1', jobId: job.id, result: { version: v1, missedMustHave: false, results: {} } });

      expect(await service.start(user, owner, slug)).toEqual({ state: 'running', processed: 0, total: 1 });
    });

    it('does the keyword step and the scoring step for an Application, and counts it once in the progress', async () => {
      repo.seedVersion(job.id, [go]);
      repo.seedApplication({ id: 'a1', jobId: job.id, text: 'Go' });
      repo.seedApplication({ id: 'a2', jobId: job.id, text: 'Go' });
      const reports: { processed: number; total: number }[] = [];

      const result = await service.run(data, async (p) => void reports.push(p), 1);

      expect(result).toEqual({ processed: 2 });
      expect(reports).toEqual([
        { processed: 1, total: 2 },
        { processed: 2, total: 2 },
      ]);
      expect(embeddingMatch.scored).toEqual(['a1', 'a2']);
      expect(repo.resultOf('a1')).toMatchObject({ version: 1 });
      expect(repo.applications[0]!.score).toMatchObject({ version: 1, status: 'scored' });
      expect(await service.count(owner, slug)).toEqual({ count: 0 });
    });

    it('scores a not-scored Application once the embedder is back, and ends the run while it is down', async () => {
      repo.seedVersion(job.id, [go]);
      repo.seedApplication({ id: 'a1', jobId: job.id, text: 'Go' });
      repo.seedApplication({ id: 'a2', jobId: job.id, text: 'Go' });
      embeddingMatch.embedderUp = false;

      // Down: both end "embedder failed" and the run still finishes (each Application is tried once).
      expect(await service.run(data, async () => {}, 1)).toEqual({ processed: 2 });
      expect(repo.applications.map((a) => a.score)).toEqual([
        { version: 1, status: 'not_scored', reason: 'embedder_failed' },
        { version: 1, status: 'not_scored', reason: 'embedder_failed' },
      ]);
      // The keyword results were written regardless.
      expect(repo.resultOf('a1')).toMatchObject({ version: 1 });
      expect(await service.count(owner, slug)).toEqual({ count: 2 });

      embeddingMatch.embedderUp = true;
      expect(await service.run(data, async () => {}, 1)).toEqual({ processed: 2 });
      expect(repo.applications.map((a) => a.score?.status)).toEqual(['scored', 'scored']);
      expect(await service.count(owner, slug)).toEqual({ count: 0 });
    });

    it('after a restart mid-run only scores what is still missing', async () => {
      repo.seedVersion(job.id, [go]);
      for (const id of ['a1', 'a2', 'a3']) repo.seedApplication({ id, jobId: job.id, text: 'Go' });
      embeddingMatch.throwOnCall = 2;
      await expect(service.run(data, async () => {}, 1)).rejects.toThrow('killed');
      expect(embeddingMatch.scored).toEqual(['a1']);

      embeddingMatch.throwOnCall = null;
      const result = await service.run(data, async () => {}, 1);

      expect(result).toEqual({ processed: 2 });
      expect(embeddingMatch.scored).toEqual(['a1', 'a2', 'a3']);
      expect(await service.count(owner, slug)).toEqual({ count: 0 });
    });

    it('re-scores everything against a Requirements version saved mid-run', async () => {
      repo.seedVersion(job.id, [go]);
      for (const id of ['a1', 'a2', 'a3', 'a4']) repo.seedApplication({ id, jobId: job.id, text: 'Go and Rust' });
      repo.afterEachSave((saves) => {
        if (saves === 1) repo.seedVersion(job.id, [req('rust', 'must_have', ['rust'])]);
      });

      await service.run(data, async () => {}, 2);

      for (const app of repo.applications) {
        expect(app.result).toMatchObject({ version: 2 });
        expect(app.score).toMatchObject({ version: 2, status: 'scored' });
      }
      expect(await service.count(owner, slug)).toEqual({ count: 0 });
    });
  });

  describe('run (the processor body)', () => {
    const data = { companyId: company.id, jobId: job.id };
    const go = req('go', 'must_have', ['go']);

    it('writes a result on the current version for each Application that needs one, skipping the rest', async () => {
      const version = repo.seedVersion(job.id, [go]);
      repo.seedApplication({ id: 'a1', jobId: job.id, text: 'I write Go' });
      repo.seedApplication({ id: 'a2', jobId: job.id, text: 'I write Rust' });
      repo.seedApplication({ id: 'rej', jobId: job.id, status: 'rejected', text: 'Go' });
      repo.seedApplication({ id: 'unread', jobId: job.id, cv: 'unreadable', text: 'Go' });

      const result = await service.run(data, async () => {});

      expect(result).toEqual({ processed: 2 });
      expect(repo.resultOf('a1')).toMatchObject({ version, missedMustHave: false });
      expect(repo.resultOf('a1')!.results['go']).toEqual({ matched: true, terms: ['go'] });
      expect(repo.resultOf('a2')).toMatchObject({ version, missedMustHave: true });
      expect(repo.resultOf('rej')).toBeNull();
      expect(repo.resultOf('unread')).toBeNull();
      expect(missedMustHave([go], repo.resultOf('a2')!.results)).toBe(true);
      expect(await service.count(membershipWithRole('owner'), slug)).toEqual({ count: 0 });
    });

    it('reads a keyword-less Requirement as not checked: no marker, no failure', async () => {
      const sentenceOnly = req('postgres', 'must_have', []);
      const version = repo.seedVersion(job.id, [sentenceOnly, go]);
      repo.seedApplication({ id: 'a1', jobId: job.id, text: 'I write Go' });
      repo.seedApplication({ id: 'a2', jobId: job.id, text: 'I write Rust' });

      const result = await service.run(data, async () => {});

      expect(result).toEqual({ processed: 2 });
      expect(repo.resultOf('a1')).toMatchObject({ version, missedMustHave: false });
      expect(repo.resultOf('a1')!.results['postgres']).toEqual({ matched: null, terms: [] });
      // Only the must-have that has keywords can be missed.
      expect(repo.resultOf('a2')).toMatchObject({ version, missedMustHave: true });
      expect(await service.count(membershipWithRole('owner'), slug)).toEqual({ count: 0 });
    });

    it('never raises the marker for a Job whose only must-have has no keywords', async () => {
      repo.seedVersion(job.id, [req('postgres', 'must_have', [])]);
      repo.seedApplication({ id: 'a1', jobId: job.id, text: 'Anything' });

      await service.run(data, async () => {});

      expect(repo.resultOf('a1')).toMatchObject({ missedMustHave: false });
    });

    it('works in chunks and reports progress after each', async () => {
      repo.seedVersion(job.id, [go]);
      for (const id of ['a1', 'a2', 'a3', 'a4', 'a5']) {
        repo.seedApplication({ id, jobId: job.id, text: 'Go' });
      }
      const reports: { processed: number; total: number }[] = [];

      await service.run(data, async (p) => void reports.push(p), 2);

      expect(reports).toEqual([
        { processed: 2, total: 5 },
        { processed: 4, total: 5 },
        { processed: 5, total: 5 },
      ]);
    });

    it('picks up an edit saved mid-run and ends on the latest version', async () => {
      repo.seedVersion(job.id, [go]);
      for (const id of ['a1', 'a2', 'a3', 'a4']) {
        repo.seedApplication({ id, jobId: job.id, text: 'Go and Rust' });
      }
      let latest = 1;
      repo.afterEachSave((saves) => {
        if (saves === 1) latest = repo.seedVersion(job.id, [req('rust', 'must_have', ['rust'])]);
      });

      await service.run(data, async () => {}, 2);

      expect(latest).toBe(2);
      for (const id of ['a1', 'a2', 'a3', 'a4']) {
        expect(repo.resultOf(id)).toMatchObject({ version: 2 });
        expect(Object.keys(repo.resultOf(id)!.results)).toEqual(['rust']);
      }
      expect(await service.count(membershipWithRole('owner'), slug)).toEqual({ count: 0 });
    });

    it('is safe to run again after an interrupted run (idempotent)', async () => {
      repo.seedVersion(job.id, [go]);
      repo.seedApplication({ id: 'a1', jobId: job.id, text: 'Go' });
      repo.seedApplication({ id: 'a2', jobId: job.id, text: 'Go' });
      repo.afterEachSave((saves) => {
        if (saves === 1) throw new Error('killed');
      });
      await expect(service.run(data, async () => {}, 1)).rejects.toThrow('killed');
      repo.afterEachSave(() => {});

      const result = await service.run(data, async () => {}, 1);

      expect(result).toEqual({ processed: 1 });
      expect(await service.count(membershipWithRole('owner'), slug)).toEqual({ count: 0 });
    });

    it('does nothing for a Job without a version', async () => {
      repo.seedApplication({ id: 'a1', jobId: job.id, text: 'Go' });

      expect(await service.run(data, async () => {})).toEqual({ processed: 0 });
      expect(repo.resultOf('a1')).toBeNull();
    });
  });
});
