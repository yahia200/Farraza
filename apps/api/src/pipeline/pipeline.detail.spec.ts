import { NotFoundException } from '@nestjs/common';
import type { AuthorizationService } from '@nestjs/authorization';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MemberRole, Membership } from '../companies/company.js';
import type { FormsRepository } from '../forms/forms.repository.js';
import type { JobWithStages } from '../jobs/job.js';
import type { JobsService } from '../jobs/jobs.service.js';
import type { StorageService } from '../storage/storage.service.js';
import type { ScreeningFlag } from '@repo/shared';
import type {
  ApplicationDetailRow,
  CvState,
  EmbeddingMatchRow,
  RatingRow,
  RequirementCheckRow,
} from './pipeline.js';
import type { PipelineRepository } from './pipeline.repository.js';
import { PipelineService } from './pipeline.service.js';

// The Application detail (`PipelineService.detail`) with its Ratings and their summary, through the
// service. The real PipelineService runs against hand-written in-memory fakes. The fake repository
// mirrors the scoping of `PipelineRepository.findDetail` (the Application must be this company's and
// this Job's; its Ratings are those of the company and the Application, oldest first, each with the
// author's name or null when the author's user is gone). The SQL itself (the join, the ordering) is
// checked against the real database by hand.

type PublicApi<T> = { [K in keyof T]: T[K] };

interface StoredRating extends RatingRow {
  companyId: string;
  applicationId: string;
}

class InMemoryPipelineRepository implements Pick<PublicApi<PipelineRepository>, 'findDetail'> {
  private readonly applications: {
    id: string;
    companyId: string;
    jobId: string;
    flags: ScreeningFlag[];
    cvState: CvState;
    requirementCheck: RequirementCheckRow | null;
    embeddingMatch: EmbeddingMatchRow | null;
  }[] = [];
  private readonly ratings: StoredRating[] = [];
  /** How many times `findDetail` ran: the detail must not cost a query per Rating. */
  detailReads = 0;

  seedApplication(row: {
    id: string;
    companyId?: string;
    jobId?: string;
    flags?: ScreeningFlag[];
    cvState?: CvState;
    requirementCheck?: RequirementCheckRow | null;
    embeddingMatch?: EmbeddingMatchRow | null;
  }): void {
    this.applications.push({
      companyId: 'company-1',
      jobId: 'job-1',
      flags: [],
      cvState: 'none',
      requirementCheck: null,
      embeddingMatch: null,
      ...row,
    });
  }

  seedRating(row: Partial<StoredRating> & { applicationId: string }): void {
    this.ratings.push({
      companyId: 'company-1',
      userId: 'user-1',
      userName: 'Sam Reviewer',
      overall: 3,
      criteria: {},
      createdAt: new Date('2026-02-01T00:00:00Z'),
      updatedAt: new Date('2026-02-01T00:00:00Z'),
      ...row,
    });
  }

  async findDetail(
    companyId: string,
    jobId: string,
    applicationId: string,
  ): Promise<ApplicationDetailRow | null> {
    this.detailReads += 1;
    const found = this.applications.find(
      (a) => a.id === applicationId && a.companyId === companyId && a.jobId === jobId,
    );
    if (!found) return null;
    const ratings = this.ratings
      .filter((r) => r.companyId === companyId && r.applicationId === applicationId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map(({ companyId: _company, applicationId: _application, ...row }) => row);
    return {
      id: found.id,
      status: 'active',
      submittedAt: new Date('2026-01-01T00:00:00Z'),
      source: null,
      stage: { id: 'stage-applied', name: 'Applied', kind: 'normal' },
      candidate: { id: 'candidate-1', name: 'Ada', email: 'ada@example.com', phone: '+201001234567' },
      fields: [],
      cvMode: 'off',
      answers: {},
      flags: found.flags,
      cvState: found.cvState,
      requirementCheck: found.requirementCheck,
      embeddingMatch: found.embeddingMatch,
      events: [],
      notes: [],
      ratings,
    };
  }
}

/** Mirrors JobsService.get: company-1 has the job `engineer` (job-1); anything else is 404. */
class FakeJobs implements Pick<PublicApi<JobsService>, 'get'> {
  async get(membership: Membership, jobSlug: string): Promise<JobWithStages> {
    const ids: Record<string, string> = { engineer: 'job-1', designer: 'job-3' };
    const id = ids[jobSlug];
    if (membership.company.id !== 'company-1' || !id) throw new NotFoundException();
    return { id, slug: jobSlug, ratingCriteria: [], stages: [] } as unknown as JobWithStages;
  }
}

function member(companyId: string, role: MemberRole): Membership {
  return {
    userId: `user-${role}`,
    role,
    company: { id: companyId, name: companyId, slug: companyId, logoUrl: null, brandColor: null },
  };
}

describe('PipelineService.detail: Ratings and their summary', () => {
  let repository: InMemoryPipelineRepository;
  let service: PipelineService;

  beforeEach(() => {
    repository = new InMemoryPipelineRepository();
    repository.seedApplication({ id: 'app-1' });
    // The detail has no policy (the membership guard and the job lookup are the access check), so an
    // `authorize` that fails the test pins that it stays that way.
    const noPolicy = {
      authorize: async () => {
        throw new Error('detail must not call a policy');
      },
    } as unknown as AuthorizationService;
    service = new PipelineService(
      repository as unknown as PipelineRepository,
      new FakeJobs() as unknown as JobsService,
      noPolicy,
      {} as StorageService,
      {} as FormsRepository,
    );
  });

  const detail = (membership: Membership, applicationId = 'app-1', jobSlug = 'engineer') =>
    service.detail(membership, jobSlug, applicationId);

  it("lists every Member's Rating with their name, oldest first, and a matching summary", async () => {
    repository.seedRating({
      applicationId: 'app-1',
      userId: 'user-2',
      userName: 'Noor Second',
      overall: 2,
      criteria: { communication: 3 },
      createdAt: new Date('2026-02-02T00:00:00Z'),
      updatedAt: new Date('2026-02-05T00:00:00Z'),
    });
    repository.seedRating({
      applicationId: 'app-1',
      userId: 'user-1',
      userName: 'Sam First',
      overall: 5,
      criteria: { communication: 5, culture_fit: 4 },
      createdAt: new Date('2026-02-01T00:00:00Z'),
      updatedAt: new Date('2026-02-01T00:00:00Z'),
    });

    const result = await detail(member('company-1', 'recruiter'));

    expect(result.ratings).toEqual([
      {
        userId: 'user-1',
        name: 'Sam First',
        overall: 5,
        criteria: { communication: 5, culture_fit: 4 },
        updatedAt: new Date('2026-02-01T00:00:00Z'),
      },
      {
        userId: 'user-2',
        name: 'Noor Second',
        overall: 2,
        criteria: { communication: 3 },
        updatedAt: new Date('2026-02-05T00:00:00Z'),
      },
    ]);
    expect(result.ratingSummary).toEqual({
      count: 2,
      average: 3.5,
      criteria: {
        communication: { count: 2, average: 4 },
        culture_fit: { count: 1, average: 4 },
      },
    });
  });

  it('keeps the scores of a Criterion the Job no longer uses, as stored, in the Rating and the summary', async () => {
    // The Job's selection is empty in this fake: `leadership` is a dropped Criterion.
    repository.seedRating({ applicationId: 'app-1', overall: 4, criteria: { leadership: 2 } });

    const result = await detail(member('company-1', 'owner'));

    expect(result.ratings[0]?.criteria).toEqual({ leadership: 2 });
    expect(result.ratingSummary.criteria).toEqual({ leadership: { count: 1, average: 2 } });
  });

  it('shows "Former member" for a Rating whose author is gone, and still counts it', async () => {
    repository.seedRating({ applicationId: 'app-1', userId: 'user-1', userName: 'Sam', overall: 4 });
    repository.seedRating({
      applicationId: 'app-1',
      userId: null,
      userName: null,
      overall: 2,
      createdAt: new Date('2026-02-03T00:00:00Z'),
    });

    const result = await detail(member('company-1', 'admin'));

    expect(result.ratings.map((r) => ({ userId: r.userId, name: r.name }))).toEqual([
      { userId: 'user-1', name: 'Sam' },
      { userId: null, name: 'Former member' },
    ]);
    expect(result.ratingSummary).toMatchObject({ count: 2, average: 3 });
  });

  it('answers an Application with no Ratings with an empty list and an empty summary', async () => {
    const result = await detail(member('company-1', 'recruiter'));

    expect(result.ratings).toEqual([]);
    expect(result.ratingSummary).toEqual({ count: 0, average: null, criteria: {} });
  });

  it('gives an interviewer the same Ratings and summary as a recruiter', async () => {
    repository.seedRating({ applicationId: 'app-1', overall: 4, criteria: { communication: 5 } });

    const asInterviewer = await detail(member('company-1', 'interviewer'));
    const asRecruiter = await detail(member('company-1', 'recruiter'));

    expect(asInterviewer.ratings).toEqual(asRecruiter.ratings);
    expect(asInterviewer.ratingSummary).toEqual(asRecruiter.ratingSummary);
    expect(asInterviewer.ratings).toHaveLength(1);
  });

  it("reads the Ratings with the Application, not one query per Rating", async () => {
    for (const n of [1, 2, 3, 4]) {
      repository.seedRating({ applicationId: 'app-1', userId: `user-${n}`, userName: `Member ${n}` });
    }

    await detail(member('company-1', 'recruiter'));

    expect(repository.detailReads).toBe(1);
  });

  describe('flags', () => {
    const flag: ScreeningFlag = {
      ruleId: 'rule-1',
      questionKey: 'q-1',
      questionLabel: 'Years of experience',
      reason: 'Years of experience was 2, minimum 5',
    };

    it('carries the stored flags with their reasons, to an interviewer too', async () => {
      repository.seedApplication({ id: 'app-flagged', flags: [flag] });

      expect((await detail(member('company-1', 'interviewer'), 'app-flagged')).flags).toEqual([flag]);
      expect((await detail(member('company-1', 'owner'), 'app-flagged')).flags).toEqual([flag]);
    });

    it('carries [] for an Application with none', async () => {
      expect((await detail(member('company-1', 'recruiter'))).flags).toEqual([]);
    });
  });

  describe('another tenant or Job', () => {
    beforeEach(() => {
      repository.seedApplication({ id: 'app-other-company', companyId: 'company-2', jobId: 'job-9' });
      repository.seedRating({ applicationId: 'app-other-company', companyId: 'company-2', overall: 1 });
      repository.seedApplication({ id: 'app-other-job', jobId: 'job-3' });
      repository.seedRating({ applicationId: 'app-other-job', overall: 1 });
    });

    it("is a 404 for another company's Application, so its Ratings do not leak", async () => {
      await expect(
        detail(member('company-1', 'recruiter'), 'app-other-company'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("is a 404 for an Application of another Job of the company", async () => {
      await expect(
        detail(member('company-1', 'recruiter'), 'app-other-job'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("is a 404 for another company's Job slug", async () => {
      await expect(
        detail(member('company-2', 'owner'), 'app-1', 'engineer'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("does not mix another Application's Ratings into this one", async () => {
      repository.seedRating({ applicationId: 'app-1', userId: 'user-1', overall: 5 });

      const result = await detail(member('company-1', 'recruiter'));

      expect(result.ratings).toHaveLength(1);
      expect(result.ratingSummary).toMatchObject({ count: 1, average: 5 });
    });
  });
});

describe('PipelineService.detail: Requirement results and the CV state', () => {
  const goId = '11111111-1111-4111-8111-111111111111';
  const sqlId = '22222222-2222-4222-8222-222222222222';
  const check: RequirementCheckRow = {
    version: 2,
    missedMustHave: true,
    results: {
      [goId]: { matched: false, terms: [] },
      [sqlId]: { matched: true, terms: ['SQL'] },
    },
    requirements: [
      { id: goId, text: 'Writes Go', tier: 'must_have', keywords: ['Go', 'Golang'] },
      { id: sqlId, text: 'Knows SQL', tier: 'nice_to_have', keywords: ['SQL', 'psql'] },
    ],
  };
  let repository: InMemoryPipelineRepository;
  let service: PipelineService;

  beforeEach(() => {
    repository = new InMemoryPipelineRepository();
    service = new PipelineService(
      repository as unknown as PipelineRepository,
      new FakeJobs() as unknown as JobsService,
      { authorize: async () => {} } as unknown as AuthorizationService,
      {} as StorageService,
      {} as FormsRepository,
    );
  });

  const detail = (role: MemberRole = 'recruiter') => service.detail(member('company-1', role), 'engineer', 'app-1');

  it('lists each Requirement of the checked version with its text, tier, verdict and terms found', async () => {
    repository.seedApplication({ id: 'app-1', cvState: 'readable', requirementCheck: check });

    const result = await detail();

    expect(result.cvState).toBe('readable');
    expect(result.requirementCheck).toEqual({
      version: 2,
      missedMustHave: true,
      results: [
        { id: goId, text: 'Writes Go', tier: 'must_have', matched: false, terms: [] },
        { id: sqlId, text: 'Knows SQL', tier: 'nice_to_have', matched: true, terms: ['SQL'] },
      ],
    });
  });

  it('shows a Requirement without a stored verdict as not matched rather than dropping it', async () => {
    repository.seedApplication({
      id: 'app-1',
      cvState: 'readable',
      requirementCheck: { ...check, missedMustHave: false, results: { [sqlId]: { matched: true, terms: ['SQL'] } } },
    });

    const result = await detail();

    expect(result.requirementCheck?.results.map((r) => [r.id, r.matched])).toEqual([
      [goId, false],
      [sqlId, true],
    ]);
  });

  it('shows a keyword-less Requirement as not checked (matched: null), stored verdict or not', async () => {
    const pgId = '33333333-3333-4333-8333-333333333333';
    repository.seedApplication({
      id: 'app-1',
      cvState: 'readable',
      requirementCheck: {
        version: 3,
        missedMustHave: false,
        results: {},
        requirements: [{ id: pgId, text: 'Knows Postgres', tier: 'must_have', keywords: [] }],
      },
    });
    repository.seedApplication({
      id: 'app-2',
      cvState: 'readable',
      requirementCheck: {
        version: 3,
        missedMustHave: false,
        results: { [pgId]: { matched: null, terms: [] } },
        requirements: [{ id: pgId, text: 'Knows Postgres', tier: 'must_have', keywords: [] }],
      },
    });

    for (const id of ['app-1', 'app-2']) {
      const result = await service.detail(member('company-1', 'recruiter'), 'engineer', id);
      expect(result.requirementCheck?.results).toEqual([
        { id: pgId, text: 'Knows Postgres', tier: 'must_have', matched: null, terms: [] },
      ]);
      expect(result.requirementCheck?.missedMustHave).toBe(false);
    }
  });

  it.each(['unreadable', 'failed'] as const)(
    'gives no verdict for a %s CV, even if a stale row exists',
    async (cvState) => {
      repository.seedApplication({ id: 'app-1', cvState, requirementCheck: check });

      const result = await detail();

      expect(result.cvState).toBe(cvState);
      expect(result.requirementCheck).toBeNull();
    },
  );

  it('gives the state none and no check for an Application without CV text', async () => {
    repository.seedApplication({ id: 'app-1' });

    const result = await detail('interviewer');

    expect(result.cvState).toBe('none');
    expect(result.requirementCheck).toBeNull();
  });

  it('returns no CV text, only the state', async () => {
    repository.seedApplication({ id: 'app-1', cvState: 'readable', requirementCheck: check });

    const result = await detail();

    expect(JSON.stringify(result)).not.toMatch(/cv_?text/i);
  });
});

describe('PipelineService.detail: the embedding match', () => {
  const pgId = '44444444-4444-4444-8444-444444444444';
  const reactId = '55555555-5555-4555-8555-555555555555';
  const goId = '66666666-6666-4666-8666-666666666666';
  const requirements = [
    { id: pgId, text: 'Knows Postgres', tier: 'must_have' as const, keywords: [] },
    { id: reactId, text: 'Knows React', tier: 'nice_to_have' as const, keywords: ['React'] },
    { id: goId, text: 'Writes Go', tier: 'nice_to_have' as const, keywords: [] },
  ];
  const scored: EmbeddingMatchRow = {
    version: 4,
    status: 'scored',
    reason: null,
    // 0.47 and above is strong, below 0.415 is weak, between is related (bandOf in @repo/shared).
    scores: { [pgId]: 0.7, [reactId]: 0.44, [goId]: 0.3 },
    requirements,
  };
  let repository: InMemoryPipelineRepository;
  let service: PipelineService;

  beforeEach(() => {
    repository = new InMemoryPipelineRepository();
    // `authorize` fails the test if called: the detail has no policy.
    const noPolicy = {
      authorize: async () => {
        throw new Error('detail must not call a policy');
      },
    } as unknown as AuthorizationService;
    service = new PipelineService(
      repository as unknown as PipelineRepository,
      new FakeJobs() as unknown as JobsService,
      noPolicy,
      {} as StorageService,
      {} as FormsRepository,
    );
  });

  const detail = (role: MemberRole = 'recruiter') => service.detail(member('company-1', role), 'engineer', 'app-1');

  it("gives a band per Requirement of the version it was scored against, with that version's text and tier, and the state", async () => {
    repository.seedApplication({ id: 'app-1', embeddingMatch: scored });

    const result = await detail();

    expect(result.embeddingMatch).toEqual({
      version: 4,
      state: { status: 'scored' },
      requirements: [
        { id: pgId, text: 'Knows Postgres', tier: 'must_have', band: 'strong' },
        { id: reactId, text: 'Knows React', tier: 'nice_to_have', band: 'related' },
        { id: goId, text: 'Writes Go', tier: 'nice_to_have', band: 'weak' },
      ],
    });
  });

  it('computes the band on read, at the boundaries', async () => {
    repository.seedApplication({
      id: 'app-1',
      embeddingMatch: { ...scored, scores: { [pgId]: 0.47, [reactId]: 0.415, [goId]: 0.4149 } },
    });

    const result = await detail();

    expect(result.embeddingMatch?.requirements.map((r) => r.band)).toEqual(['strong', 'related', 'weak']);
  });

  it('never carries a raw per-Requirement score, a vector, a chunk or CV text', async () => {
    repository.seedApplication({ id: 'app-1', cvState: 'readable', embeddingMatch: scored });

    const result = await detail();

    expect(Object.keys(result.embeddingMatch ?? {}).sort()).toEqual(['requirements', 'state', 'version']);
    for (const requirement of result.embeddingMatch?.requirements ?? []) {
      expect(Object.keys(requirement).sort()).toEqual(['band', 'id', 'text', 'tier']);
    }
    // The stored numbers appear nowhere in what the match adds to the payload.
    expect(JSON.stringify(result.embeddingMatch)).not.toMatch(/0\.7|0\.44|0\.3\b/);
  });

  it('is null for an Application with no score row', async () => {
    repository.seedApplication({ id: 'app-1' });

    expect((await detail()).embeddingMatch).toBeNull();
  });

  it('shows "scoring" for a pending row, with no band yet', async () => {
    repository.seedApplication({
      id: 'app-1',
      embeddingMatch: { version: 4, status: 'pending', reason: null, scores: {}, requirements },
    });

    const result = await detail();

    expect(result.embeddingMatch?.state).toEqual({ status: 'scoring' });
    expect(result.embeddingMatch?.requirements.map((r) => r.band)).toEqual([null, null, null]);
  });

  it.each(['cv_unreadable', 'embedder_failed', 'model_changed'] as const)(
    'shows not scored with the reason %s, and no band',
    async (reason) => {
      repository.seedApplication({
        id: 'app-1',
        embeddingMatch: { version: 4, status: 'not_scored', reason, scores: {}, requirements },
      });

      const result = await detail();

      expect(result.embeddingMatch?.state).toEqual({ status: 'not_scored', reason });
      expect(result.embeddingMatch?.requirements.map((r) => r.band)).toEqual([null, null, null]);
    },
  );

  it('gives a Requirement with no stored score no band rather than dropping it', async () => {
    repository.seedApplication({ id: 'app-1', embeddingMatch: { ...scored, scores: { [pgId]: 0.9 } } });

    const result = await detail();

    expect(result.embeddingMatch?.requirements.map((r) => [r.id, r.band])).toEqual([
      [pgId, 'strong'],
      [reactId, null],
      [goId, null],
    ]);
  });

  it('reaches an interviewer', async () => {
    repository.seedApplication({ id: 'app-1', embeddingMatch: scored });

    expect((await detail('interviewer')).embeddingMatch?.state).toEqual({ status: 'scored' });
  });
});
