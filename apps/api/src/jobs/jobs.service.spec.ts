import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  AuthorizationError,
  AuthorizationModule,
  AuthorizationService,
} from '@nestjs/authorization';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MemberRole, Membership } from '../companies/company.js';
import type { User } from '../users/user.js';
import { DEFAULT_STAGES } from './job.js';
import type { Job, JobWithStages } from './job.js';
import { JobPolicy } from './job.policy.js';
import type { JobsRepository } from './jobs.repository.js';
import { JobsService } from './jobs.service.js';

// Test pattern for API services: the service under test is the real class, wired
// to the REAL authorization module and policies, with only the repository swapped
// for a hand-written in-memory fake. Assertions go through the service's public
// methods; they never read the fake's internals.

/**
 * The repository's public surface without its private members. `JobsRepository`
 * has a private `prisma` field, so a class can't `implements` it directly, but a
 * mapped type drops private members and keeps the method signatures checked.
 */
type PublicApi<T> = { [K in keyof T]: T[K] };

class InMemoryJobsRepository implements PublicApi<JobsRepository> {
  private readonly jobs: { companyId: string; job: JobWithStages }[] = [];
  private readonly publishedFormJobIds = new Set<string>();
  private nextId = 1;

  /** Test setup: a draft job with the default stages. */
  seedJob(companyId: string, title: string): JobWithStages {
    const id = `job-${this.nextId++}`;
    const now = new Date('2026-01-01T00:00:00Z');
    const job: JobWithStages = {
      id,
      title,
      slug: title.toLowerCase().replaceAll(' ', '-'),
      description: null,
      status: 'draft',
      openedAt: null,
      closedAt: null,
      createdAt: now,
      updatedAt: now,
      stages: DEFAULT_STAGES.map((stage, index) => ({
        ...stage,
        id: `${id}-stage-${index}`,
      })),
    };
    this.jobs.push({ companyId, job });
    return job;
  }

  /** Test setup: the job has a published form version. */
  publishFormFor(jobId: string): void {
    this.publishedFormJobIds.add(jobId);
  }

  async findBySlug(
    companyId: string,
    slug: string,
  ): Promise<JobWithStages | null> {
    const found = this.jobs.find(
      (row) => row.companyId === companyId && row.job.slug === slug,
    );
    return found ? { ...found.job } : null;
  }

  async hasPublishedForm(jobId: string): Promise<boolean> {
    return this.publishedFormJobIds.has(jobId);
  }

  /** Returns null if the job is already open (mirrors the real conditional update). */
  async open(id: string, at: Date): Promise<Job | null> {
    const job = this.jobs.find((row) => row.job.id === id)?.job;
    if (!job || job.status === 'open') return null;
    job.status = 'open';
    job.openedAt = at;
    job.closedAt = null;
    return { ...job };
  }

  /** Returns null if the job is not open (mirrors the real conditional update). */
  async close(id: string, at: Date): Promise<Job | null> {
    const job = this.jobs.find((row) => row.job.id === id)?.job;
    if (!job || job.status !== 'open') return null;
    job.status = 'closed';
    job.closedAt = at;
    return { ...job };
  }

  // The methods below aren't exercised yet. Throwing makes an accidental use loud
  // instead of silently returning something misleading.
  slugExists(): Promise<boolean> {
    throw new Error('not implemented in this fake');
  }
  createWithStages(): Promise<JobWithStages> {
    throw new Error('not implemented in this fake');
  }
  findAllForCompany(): Promise<Job[]> {
    throw new Error('not implemented in this fake');
  }
  update(): Promise<Job | null> {
    throw new Error('not implemented in this fake');
  }
}

const company = {
  id: 'company-1',
  name: 'Acme',
  slug: 'acme',
  logoUrl: null,
  brandColor: null,
};
const user: User = {
  id: 'user-1',
  email: 'a@acme.test',
  emailVerified: true,
  name: 'Ada',
};
const membershipWithRole = (role: MemberRole): Membership => ({
  userId: user.id,
  role,
  company,
});

describe('JobsService', () => {
  let jobs: InMemoryJobsRepository;
  let service: JobsService;

  beforeEach(async () => {
    jobs = new InMemoryJobsRepository();

    // Why `new JobsService(...)` and not a Nest provider: Vitest's transformer does
    // not emit decorator metadata, so Nest could not infer JobsService's
    // constructor dependencies. AuthorizationService (compiled library code) is
    // resolved from a real Nest module so policies are discovered as in production.
    const moduleRef = await Test.createTestingModule({
      imports: [AuthorizationModule.forRoot()],
      providers: [JobPolicy],
    }).compile();

    service = new JobsService(
      jobs as unknown as JobsRepository,
      moduleRef.get(AuthorizationService),
    );
  });

  describe('open', () => {
    it('refuses to open a job that has no published form', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');

      await expect(
        service.open(user, membershipWithRole('owner'), job.slug),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('opens a job that has a published form and stamps when it opened', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');
      jobs.publishFormFor(job.id);

      const opened = await service.open(
        user,
        membershipWithRole('recruiter'),
        job.slug,
      );

      expect(opened.status).toBe('open');
      expect(opened.openedAt).toBeInstanceOf(Date);
      expect(
        (await service.get(membershipWithRole('recruiter'), job.slug)).status,
      ).toBe('open');
    });

    it('refuses to open a job that is already open', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');
      jobs.publishFormFor(job.id);
      const membership = membershipWithRole('owner');
      await service.open(user, membership, job.slug);

      await expect(
        service.open(user, membership, job.slug),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('reopens a closed job and clears its closed date', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');
      jobs.publishFormFor(job.id);
      const membership = membershipWithRole('admin');
      await service.open(user, membership, job.slug);
      await service.close(user, membership, job.slug);

      const reopened = await service.open(user, membership, job.slug);

      expect(reopened.status).toBe('open');
      expect(reopened.closedAt).toBeNull();
    });

    it('forbids an interviewer, who cannot manage jobs', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');
      jobs.publishFormFor(job.id);

      const attempt = service.open(
        user,
        membershipWithRole('interviewer'),
        job.slug,
      );

      await expect(attempt).rejects.toBeInstanceOf(AuthorizationError);
      await expect(attempt).rejects.toMatchObject({ reason: 'forbidden' });
      expect(
        (await service.get(membershipWithRole('owner'), job.slug)).status,
      ).toBe('draft');
    });

    it('does not find a job that belongs to another company', async () => {
      const job = jobs.seedJob('another-company', 'Backend Engineer');
      jobs.publishFormFor(job.id);

      await expect(
        service.open(user, membershipWithRole('owner'), job.slug),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('close', () => {
    it('closes an open job and stamps when it closed', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');
      jobs.publishFormFor(job.id);
      const membership = membershipWithRole('owner');
      await service.open(user, membership, job.slug);

      const closed = await service.close(user, membership, job.slug);

      expect(closed.status).toBe('closed');
      expect(closed.closedAt).toBeInstanceOf(Date);
    });

    it('refuses to close a job that is not open', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');

      await expect(
        service.close(user, membershipWithRole('owner'), job.slug),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
