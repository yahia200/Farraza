import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  StandardSchemaValidationPipe,
} from '@nestjs/common';
import {
  AuthorizationModule,
  AuthorizationService,
} from '@nestjs/authorization';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { toValidationException } from '../common/validation-errors.js';
import type { MemberRole, Membership } from '../companies/company.js';
import type { FormsRepository } from '../forms/forms.repository.js';
import type { JobWithStages } from '../jobs/job.js';
import type { JobsService } from '../jobs/jobs.service.js';
import type { StorageService } from '../storage/storage.service.js';
import type { User } from '../users/user.js';
import { ApplicationPolicy } from './application.policy.js';
import { saveRatingSchema } from './dto/save-rating.dto.js';
import type { RatingValues } from './pipeline.js';
import type { PipelineRepository } from './pipeline.repository.js';
import { PipelineService } from './pipeline.service.js';

// A Member giving or changing their own Rating (`PipelineService.rate`), through the service. The real
// PipelineService and the real ApplicationPolicy (via a real AuthorizationModule, as in
// jobs.service.spec.ts) run against hand-written in-memory fakes. The fake repository mirrors what
// `PipelineRepository.saveRating` does in one transaction: read the caller's current Rating, let the
// service decide the new values from it, upsert on (application, user), and append the `rated` event.
// The SQL itself (the upsert, the CHECKs, the transaction) is checked against the real database by hand.

type PublicApi<T> = { [K in keyof T]: T[K] };

interface StoredRating extends RatingValues {
  companyId: string;
  applicationId: string;
  userId: string;
  updatedAt: Date;
}

interface StoredEvent {
  companyId: string;
  applicationId: string;
  type: 'rated';
  actorId: string;
  data: { previous: RatingValues | null; current: RatingValues; stage: string };
}

class InMemoryPipelineRepository implements Pick<
  PublicApi<PipelineRepository>,
  'findStageOf' | 'saveRating'
> {
  private readonly applications: {
    id: string;
    companyId: string;
    jobId: string;
    stageId: string;
  }[] = [];
  /** One row per (application, user), like the UNIQUE constraint. */
  readonly ratings = new Map<string, StoredRating>();
  readonly events: StoredEvent[] = [];
  private clock = 0;
  /** When set, the next `saveRating` fails with this error (for the race on a first rating). */
  failNextSaveWith: Error | null = null;

  seedApplication(row: {
    id: string;
    companyId?: string;
    jobId?: string;
    stageId?: string;
  }): void {
    this.applications.push({
      companyId: 'company-1',
      jobId: 'job-1',
      stageId: 'stage-applied',
      ...row,
    });
  }

  moveApplication(id: string, stageId: string): void {
    const found = this.applications.find((a) => a.id === id);
    if (found) found.stageId = stageId;
  }

  seedRating(row: Omit<StoredRating, 'companyId' | 'updatedAt'>): void {
    this.ratings.set(`${row.applicationId}:${row.userId}`, {
      companyId: 'company-1',
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      ...row,
    });
  }

  async findStageOf(
    companyId: string,
    jobId: string,
    applicationId: string,
  ): Promise<string | null> {
    const found = this.applications.find(
      (a) =>
        a.id === applicationId &&
        a.companyId === companyId &&
        a.jobId === jobId,
    );
    return found ? found.stageId : null;
  }

  async saveRating(input: Parameters<PipelineRepository['saveRating']>[0]) {
    if (this.failNextSaveWith) {
      const error = this.failNextSaveWith;
      this.failNextSaveWith = null;
      throw error;
    }
    const key = `${input.applicationId}:${input.userId}`;
    const existing = this.ratings.get(key);
    const previous = existing
      ? { overall: existing.overall, criteria: existing.criteria }
      : null;
    const current = input.resolve(previous);
    // The clock moves on every save, so a spec can tell an update from an untouched row.
    this.clock += 1;
    const updatedAt = new Date(Date.UTC(2026, 5, 1, 0, 0, this.clock));
    this.ratings.set(key, {
      companyId: input.companyId,
      applicationId: input.applicationId,
      userId: input.userId,
      ...current,
      updatedAt,
    });
    this.events.push({
      companyId: input.companyId,
      applicationId: input.applicationId,
      type: 'rated',
      actorId: input.userId,
      data: { previous, current, stage: input.stageName },
    });
    return { ...current, updatedAt };
  }
}

/** Mirrors JobsService.get: company-1 has two jobs, `engineer` (job-1) and `designer` (job-3); anything else is 404. */
class FakeJobs implements Pick<PublicApi<JobsService>, 'get'> {
  /** The Job's current Criteria selection (`engineer` only). */
  ratingCriteria: string[] = [
    'technical_skills',
    'communication',
    'culture_fit',
  ];

  private readonly stages: JobWithStages['stages'] = [
    {
      id: 'stage-applied',
      name: 'Applied',
      position: 0,
      kind: 'normal',
      publicLabel: 'received',
    },
    {
      id: 'stage-interview',
      name: 'Interview',
      position: 1,
      kind: 'normal',
      publicLabel: 'in_review',
    },
    {
      id: 'stage-hired',
      name: 'Hired',
      position: 2,
      kind: 'hired',
      publicLabel: 'closed',
    },
    {
      id: 'stage-rejected',
      name: 'Rejected',
      position: 3,
      kind: 'rejected',
      publicLabel: 'closed',
    },
  ];

  async get(membership: Membership, jobSlug: string): Promise<JobWithStages> {
    const ids: Record<string, string> = {
      engineer: 'job-1',
      designer: 'job-3',
    };
    const id = ids[jobSlug];
    if (membership.company.id !== 'company-1' || !id)
      throw new NotFoundException();
    return {
      id,
      title: jobSlug,
      slug: jobSlug,
      description: null,
      status: 'open',
      openedAt: null,
      closedAt: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      highlightedQuestionKeys: [],
      ratingCriteria: jobSlug === 'engineer' ? this.ratingCriteria : [],
      stages: this.stages,
    };
  }
}

function member(
  companyId: string,
  role: MemberRole,
  userId = `user-${role}`,
): Membership {
  return {
    userId,
    role,
    company: {
      id: companyId,
      name: companyId,
      slug: companyId,
      logoUrl: null,
      brandColor: null,
    },
  };
}

function userOf(membership: Membership): User {
  return {
    id: membership.userId,
    email: `${membership.userId}@acme.test`,
    emailVerified: true,
    name: membership.userId,
  };
}

type Body = Parameters<PipelineService['rate']>[4];

describe('PipelineService.rate', () => {
  let repository: InMemoryPipelineRepository;
  let jobs: FakeJobs;
  let service: PipelineService;

  beforeEach(async () => {
    repository = new InMemoryPipelineRepository();
    jobs = new FakeJobs();
    repository.seedApplication({ id: 'app-1' });

    // `new PipelineService(...)`, not a Nest provider: Vitest does not emit decorator metadata, so Nest
    // could not infer the constructor dependencies. AuthorizationService comes from a real module so
    // ApplicationPolicy is discovered as in production (the pattern of jobs.service.spec.ts).
    const moduleRef = await Test.createTestingModule({
      imports: [AuthorizationModule.forRoot()],
      providers: [ApplicationPolicy],
    }).compile();

    service = new PipelineService(
      repository as unknown as PipelineRepository,
      jobs as unknown as JobsService,
      moduleRef.get(AuthorizationService),
      {} as StorageService,
      {} as FormsRepository,
    );
  });

  function rate(
    membership: Membership,
    body: Body,
    applicationId = 'app-1',
    jobSlug = 'engineer',
  ) {
    return service.rate(
      userOf(membership),
      membership,
      jobSlug,
      applicationId,
      body,
    );
  }

  describe('a first rating', () => {
    it("creates the Member's Rating, writes a rated event with no previous, and answers with the Rating", async () => {
      const recruiter = member('company-1', 'recruiter');

      const saved = await rate(recruiter, {
        overall: 4,
        criteria: { communication: 5 },
      });

      expect(saved).toEqual({
        overall: 4,
        criteria: { communication: 5 },
        updatedAt: expect.any(Date),
      });
      expect(repository.ratings.size).toBe(1);
      expect(repository.events).toEqual([
        {
          companyId: 'company-1',
          applicationId: 'app-1',
          type: 'rated',
          actorId: 'user-recruiter',
          data: {
            previous: null,
            current: { overall: 4, criteria: { communication: 5 } },
            stage: 'Applied',
          },
        },
      ]);
    });

    it('works without any Criteria scores', async () => {
      const saved = await rate(member('company-1', 'owner'), { overall: 3 });

      expect(saved).toMatchObject({ overall: 3, criteria: {} });
    });
  });

  describe("the Criteria scores against the Job's selection", () => {
    it('refuses a score for a Criterion the Job does not use, with its path, and saves nothing', async () => {
      const result = rate(member('company-1', 'recruiter'), {
        overall: 4,
        criteria: { communication: 4, leadership: 2 },
      });

      await expect(result).rejects.toBeInstanceOf(BadRequestException);
      await expect(result).rejects.toMatchObject({
        response: { errors: [{ path: 'criteria.leadership' }] },
      });
      expect(repository.ratings.size).toBe(0);
      expect(repository.events).toEqual([]);
    });

    it('refuses any score when the Job uses no Criteria', async () => {
      jobs.ratingCriteria = [];

      await expect(
        rate(member('company-1', 'recruiter'), {
          overall: 4,
          criteria: { communication: 4 },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('changing a Rating', () => {
    const recruiter = member('company-1', 'recruiter');

    it('replaces the row, and the event carries the old and new values and the current stage name', async () => {
      await rate(recruiter, { overall: 2, criteria: { communication: 1 } });
      repository.moveApplication('app-1', 'stage-interview');

      const saved = await rate(recruiter, {
        overall: 5,
        criteria: { communication: 4 },
      });

      expect(repository.ratings.size).toBe(1);
      expect(saved).toMatchObject({
        overall: 5,
        criteria: { communication: 4 },
      });
      expect(repository.events).toHaveLength(2);
      expect(repository.events[1]!.data).toEqual({
        previous: { overall: 2, criteria: { communication: 1 } },
        current: { overall: 5, criteria: { communication: 4 } },
        stage: 'Interview',
      });
    });

    it('moves updatedAt on a change', async () => {
      const first = await rate(recruiter, { overall: 2 });
      const second = await rate(recruiter, { overall: 3 });

      expect(second.updatedAt.getTime()).toBeGreaterThan(
        first.updatedAt.getTime(),
      );
    });

    it('keeps the scores the request does not name', async () => {
      await rate(recruiter, {
        overall: 3,
        criteria: { communication: 2, culture_fit: 4 },
      });

      const saved = await rate(recruiter, {
        overall: 4,
        criteria: { communication: 5 },
      });

      expect(saved.criteria).toEqual({ communication: 5, culture_fit: 4 });
    });

    it('clears only the named Criterion when sent null', async () => {
      await rate(recruiter, {
        overall: 3,
        criteria: { communication: 2, culture_fit: 4 },
      });

      const saved = await rate(recruiter, {
        overall: 3,
        criteria: { communication: null },
      });

      expect(saved.criteria).toEqual({ culture_fit: 4 });
      expect(repository.events[1]!.data).toMatchObject({
        previous: { criteria: { communication: 2, culture_fit: 4 } },
        current: { criteria: { culture_fit: 4 } },
      });
    });

    it('ignores a null for a Criterion that has no score yet', async () => {
      const saved = await rate(recruiter, {
        overall: 3,
        criteria: { communication: null },
      });

      expect(saved.criteria).toEqual({});
    });

    it('carries over a score for a Criterion the Job no longer uses, in the row and the event', async () => {
      await rate(recruiter, {
        overall: 3,
        criteria: { communication: 2, culture_fit: 4 },
      });
      jobs.ratingCriteria = ['communication'];

      const saved = await rate(recruiter, {
        overall: 5,
        criteria: { communication: 3 },
      });

      expect(saved.criteria).toEqual({ communication: 3, culture_fit: 4 });
      expect(repository.events[1]!.data).toMatchObject({
        current: { overall: 5, criteria: { communication: 3, culture_fit: 4 } },
      });
    });

    it('does not let a re-rate with no Criteria erase the old scores', async () => {
      await rate(recruiter, { overall: 3, criteria: { communication: 2 } });

      const saved = await rate(recruiter, { overall: 4 });

      expect(saved.criteria).toEqual({ communication: 2 });
    });
  });

  describe('who can rate, and whose Rating it is', () => {
    it.each(['owner', 'admin', 'recruiter', 'interviewer'] as const)(
      'a %s can rate',
      async (role) => {
        const saved = await rate(member('company-1', role), { overall: 4 });

        expect(saved.overall).toBe(4);
      },
    );

    it('gives two Members two Ratings on the same Application', async () => {
      await rate(member('company-1', 'recruiter', 'user-a'), { overall: 2 });
      await rate(member('company-1', 'interviewer', 'user-b'), { overall: 5 });

      expect(repository.ratings.size).toBe(2);
      expect(repository.ratings.get('app-1:user-a')).toMatchObject({
        overall: 2,
      });
      expect(repository.ratings.get('app-1:user-b')).toMatchObject({
        overall: 5,
      });
      expect(repository.events.map((event) => event.actorId)).toEqual([
        'user-a',
        'user-b',
      ]);
    });

    it("does not touch another Member's Rating", async () => {
      repository.seedRating({
        applicationId: 'app-1',
        userId: 'user-a',
        overall: 1,
        criteria: {},
      });

      await rate(member('company-1', 'recruiter', 'user-b'), { overall: 5 });

      expect(repository.ratings.get('app-1:user-a')).toMatchObject({
        overall: 1,
      });
    });
  });

  describe('any Application status', () => {
    it.each([
      ['Rejected', 'stage-rejected'],
      ['Hired', 'stage-hired'],
    ])(
      'rates a %s Application and records its stage',
      async (stageName, stageId) => {
        repository.seedApplication({ id: 'app-done', stageId });

        const saved = await rate(
          member('company-1', 'recruiter'),
          { overall: 3 },
          'app-done',
        );

        expect(saved.overall).toBe(3);
        expect(repository.events[0]!.data).toMatchObject({ stage: stageName });
      },
    );
  });

  describe('which Applications can be rated', () => {
    const recruiter = member('company-1', 'recruiter');

    it("404s for another company's Application", async () => {
      repository.seedApplication({
        id: 'app-other',
        companyId: 'company-2',
        jobId: 'job-2',
      });

      await expect(
        rate(recruiter, { overall: 3 }, 'app-other'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.ratings.size).toBe(0);
    });

    it("404s for another job's Application in the same company", async () => {
      repository.seedApplication({ id: 'app-designer', jobId: 'job-3' });

      await expect(
        rate(recruiter, { overall: 3 }, 'app-designer'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.ratings.size).toBe(0);
    });

    it('404s for an Application that does not exist', async () => {
      await expect(
        rate(recruiter, { overall: 3 }, 'nope'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("404s for another company's job", async () => {
      await expect(
        rate(member('company-2', 'owner'), { overall: 3 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('a race on a first rating', () => {
    it('becomes a 409 when the database reports a unique violation', async () => {
      repository.failNextSaveWith = Object.assign(new Error('duplicate key'), {
        sqlState: '23505',
      });

      await expect(
        rate(member('company-1', 'recruiter'), { overall: 3 }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('lets any other failure through', async () => {
      repository.failNextSaveWith = new Error('connection lost');

      await expect(
        rate(member('company-1', 'recruiter'), { overall: 3 }),
      ).rejects.toThrow('connection lost');
    });
  });

  // `@Body({ schema })` makes the global StandardSchemaValidationPipe validate the body before the
  // service runs. This runs that same pipe and exception factory, so the 400 a client gets is checked
  // here; the schema's own rules are tested in @repo/shared.
  describe('the rating request body', () => {
    const pipe = new StandardSchemaValidationPipe({
      exceptionFactory: toValidationException,
    });
    const validate = (body: unknown) =>
      pipe.transform(body, { type: 'body', schema: saveRatingSchema });

    it('accepts an overall from 1 to 5, with or without Criteria scores', async () => {
      await expect(validate({ overall: 1 })).resolves.toEqual({ overall: 1 });
      await expect(
        validate({
          overall: 5,
          criteria: { communication: 3, culture_fit: null },
        }),
      ).resolves.toEqual({
        overall: 5,
        criteria: { communication: 3, culture_fit: null },
      });
    });

    it('refuses an overall outside 1 to 5 and a missing one, with errors paths', async () => {
      await expect(validate({ overall: 0 })).rejects.toMatchObject({
        response: { errors: [{ path: 'overall' }] },
      });
      await expect(validate({ overall: 6 })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(validate({ criteria: {} })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('refuses a user in the body, so nobody can rate as someone else', async () => {
      await expect(
        validate({ overall: 3, userId: 'user-victim' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
