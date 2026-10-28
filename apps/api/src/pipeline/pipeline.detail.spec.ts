import { NotFoundException } from '@nestjs/common';
import type { AuthorizationService } from '@nestjs/authorization';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MemberRole, Membership } from '../companies/company.js';
import type { FormsRepository } from '../forms/forms.repository.js';
import type { JobWithStages } from '../jobs/job.js';
import type { JobsService } from '../jobs/jobs.service.js';
import type { StorageService } from '../storage/storage.service.js';
import type { ApplicationDetailRow, RatingRow } from './pipeline.js';
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
  private readonly applications: { id: string; companyId: string; jobId: string }[] = [];
  private readonly ratings: StoredRating[] = [];
  /** How many times `findDetail` ran: the detail must not cost a query per Rating. */
  detailReads = 0;

  seedApplication(row: { id: string; companyId?: string; jobId?: string }): void {
    this.applications.push({ companyId: 'company-1', jobId: 'job-1', ...row });
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
