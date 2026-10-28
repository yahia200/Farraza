import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  StandardSchemaValidationPipe,
} from '@nestjs/common';
import {
  AuthorizationError,
  AuthorizationModule,
  AuthorizationService,
} from '@nestjs/authorization';
import { Test } from '@nestjs/testing';
import { parseFormFields, type FormFields } from '@repo/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { toValidationException } from '../common/validation-errors.js';
import type { MemberRole, Membership } from '../companies/company.js';
import type { FormVersion } from '../forms/form.js';
import type { FormsRepository } from '../forms/forms.repository.js';
import type { User } from '../users/user.js';
import { DEFAULT_STAGES } from './job.js';
import { saveHighlightedQuestionsSchema } from './dto/save-highlighted-questions.dto.js';
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
      highlightedQuestionKeys: [],
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

  /** Replaces the whole list in one write (mirrors the real unconditional update). */
  async replaceHighlightedQuestionKeys(
    id: string,
    keys: string[],
  ): Promise<Job | null> {
    const job = this.jobs.find((row) => row.job.id === id)?.job;
    if (!job) return null;
    job.highlightedQuestionKeys = [...keys];
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

/**
 * Only the read JobsService needs: the latest published form of a job, which the
 * Highlighted questions are checked against. Drafts never reach JobsService.
 */
class InMemoryFormsRepository implements PublicApi<FormsRepository> {
  private readonly published: Array<FormVersion & { jobId: string }> = [];

  /** Test setup: the job gets a new published version with these fields. */
  seedPublished(jobId: string, fields: FormFields): void {
    const version =
      this.published.filter((row) => row.jobId === jobId).length + 1;
    this.published.push({
      id: `${jobId}-form-${version}`,
      jobId,
      version,
      fields,
      cvMode: 'off',
      publishedAt: new Date('2026-01-02T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
    });
  }

  async findLatestPublished(jobId: string): Promise<FormVersion | null> {
    const versions = this.published.filter((row) => row.jobId === jobId);
    return versions.sort((a, b) => b.version - a.version)[0] ?? null;
  }

  findDraft(): Promise<FormVersion | null> {
    throw new Error('not implemented in this fake');
  }
  createDraft(): Promise<FormVersion> {
    throw new Error('not implemented in this fake');
  }
  updateDraft(): Promise<FormVersion | null> {
    throw new Error('not implemented in this fake');
  }
  publish(): Promise<FormVersion | null> {
    throw new Error('not implemented in this fake');
  }
}

/** Question keys of the test form. */
const Q = {
  city: '10000000-0000-4000-8000-000000000001',
  level: '10000000-0000-4000-8000-000000000002',
  yesNo: '10000000-0000-4000-8000-000000000003',
  years: '10000000-0000-4000-8000-000000000004',
  sample: '10000000-0000-4000-8000-000000000005',
  education: '10000000-0000-4000-8000-000000000006',
  school: '10000000-0000-4000-8000-000000000007',
} as const;
const NOT_ON_FORM = '20000000-0000-4000-8000-000000000000';

/** Parses a form that must be valid, so the fixture can't drift from the real shape. */
function formOf(questions: unknown[]): FormFields {
  const result = parseFormFields(questions);
  if (!result.ok) {
    throw new Error(`Test form is invalid: ${JSON.stringify(result.errors)}`);
  }
  return result.fields;
}

const base = { helpText: null, required: false };
const publishedForm = formOf([
  {
    ...base,
    key: Q.city,
    type: 'short_text',
    label: 'City',
    config: { maxLength: 100 },
  },
  {
    ...base,
    key: Q.level,
    type: 'single_select',
    label: 'Level',
    config: {
      options: [
        { id: '30000000-0000-4000-8000-000000000001', label: 'Junior' },
        { id: '30000000-0000-4000-8000-000000000002', label: 'Senior' },
      ],
      rejectOptionIds: [],
    },
  },
  {
    ...base,
    key: Q.yesNo,
    type: 'yes_no',
    label: 'On site?',
    config: { rejectWhen: null },
  },
  {
    ...base,
    key: Q.years,
    type: 'number',
    label: 'Years of experience',
    config: { min: null, max: null, integerOnly: true },
  },
  {
    ...base,
    key: Q.sample,
    type: 'file',
    label: 'Work sample',
    config: { kinds: ['document'], maxSizeMb: 10, maxDurationSeconds: null },
  },
  {
    ...base,
    key: Q.education,
    type: 'repeating_group',
    label: 'Education',
    config: {
      maxEntries: 3,
      fields: [
        {
          ...base,
          key: Q.school,
          type: 'short_text',
          label: 'School',
          config: { maxLength: 100 },
        },
      ],
    },
  },
]);

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
  let forms: InMemoryFormsRepository;
  let service: JobsService;

  beforeEach(async () => {
    jobs = new InMemoryJobsRepository();
    forms = new InMemoryFormsRepository();

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
      forms as unknown as FormsRepository,
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

  describe('saveHighlightedQuestions', () => {
    it('saves a manager’s Highlighted questions and reports them on the Job', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');
      forms.seedPublished(job.id, publishedForm);

      const saved = await service.saveHighlightedQuestions(
        user,
        membershipWithRole('recruiter'),
        job.slug,
        { keys: [Q.yesNo, Q.city] },
      );

      expect(saved).toEqual({ keys: [Q.yesNo, Q.city] });
      expect(
        (await service.get(membershipWithRole('interviewer'), job.slug))
          .highlightedQuestionKeys,
      ).toEqual([Q.yesNo, Q.city]);
    });

    it('forbids an interviewer and leaves the list unchanged', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');
      forms.seedPublished(job.id, publishedForm);

      const attempt = service.saveHighlightedQuestions(
        user,
        membershipWithRole('interviewer'),
        job.slug,
        { keys: [Q.city] },
      );

      await expect(attempt).rejects.toBeInstanceOf(AuthorizationError);
      await expect(attempt).rejects.toMatchObject({ reason: 'forbidden' });
      expect(
        (await service.get(membershipWithRole('owner'), job.slug))
          .highlightedQuestionKeys,
      ).toEqual([]);
    });

    it('refuses a job that has no published form', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');

      await expect(
        service.saveHighlightedQuestions(
          user,
          membershipWithRole('owner'),
          job.slug,
          {
            keys: [],
          },
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('refuses keys of a file, a Repeating group or a sub-question, with a path per bad key', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');
      forms.seedPublished(job.id, publishedForm);

      const attempt = service.saveHighlightedQuestions(
        user,
        membershipWithRole('admin'),
        job.slug,
        { keys: [Q.sample, Q.city, Q.education] },
      );

      await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
      await expect(attempt).rejects.toMatchObject({
        response: {
          message: expect.any(String),
          errors: [
            { path: 'keys.0', message: expect.any(String) },
            { path: 'keys.2', message: expect.any(String) },
          ],
        },
      });
      await expect(
        service.saveHighlightedQuestions(
          user,
          membershipWithRole('admin'),
          job.slug,
          {
            keys: [Q.school],
          },
        ),
      ).rejects.toMatchObject({ response: { errors: [{ path: 'keys.0' }] } });
      expect(
        (await service.get(membershipWithRole('owner'), job.slug))
          .highlightedQuestionKeys,
      ).toEqual([]);
    });

    it('checks keys against the latest published form, not an older one', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');
      forms.seedPublished(job.id, publishedForm);
      forms.seedPublished(
        job.id,
        publishedForm.filter((question) => question.key !== Q.years),
      );

      const attempt = service.saveHighlightedQuestions(
        user,
        membershipWithRole('owner'),
        job.slug,
        { keys: [Q.city, Q.years, NOT_ON_FORM] },
      );

      await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
      await expect(attempt).rejects.toMatchObject({
        response: { errors: [{ path: 'keys.1' }, { path: 'keys.2' }] },
      });
    });

    it('replaces the previous list on every save, and an empty list clears it', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');
      forms.seedPublished(job.id, publishedForm);
      const membership = membershipWithRole('owner');
      await service.saveHighlightedQuestions(user, membership, job.slug, {
        keys: [Q.city, Q.level, Q.years],
      });

      await service.saveHighlightedQuestions(user, membership, job.slug, {
        keys: [Q.yesNo],
      });
      expect(
        (await service.get(membership, job.slug)).highlightedQuestionKeys,
      ).toEqual([Q.yesNo]);

      const cleared = await service.saveHighlightedQuestions(
        user,
        membership,
        job.slug,
        {
          keys: [],
        },
      );
      expect(cleared).toEqual({ keys: [] });
      expect(
        (await service.get(membership, job.slug)).highlightedQuestionKeys,
      ).toEqual([]);
    });

    it('does not find a job that belongs to another company', async () => {
      const job = jobs.seedJob('another-company', 'Backend Engineer');
      forms.seedPublished(job.id, publishedForm);

      await expect(
        service.saveHighlightedQuestions(
          user,
          membershipWithRole('owner'),
          job.slug,
          {
            keys: [Q.city],
          },
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // The cap, repeats and non-UUIDs are refused before the service runs, by the global pipe main.ts
  // installs, applying the route's body schema. This runs that same pipe and exception factory, so
  // the 400 a client gets is checked here; the schema's own rules are tested in @repo/shared.
  describe('the save request body', () => {
    const pipe = new StandardSchemaValidationPipe({
      exceptionFactory: toValidationException,
    });
    const validate = (body: unknown) =>
      pipe.transform(body, {
        type: 'body',
        schema: saveHighlightedQuestionsSchema,
      });

    it('accepts up to three distinct keys', async () => {
      await expect(
        validate({ keys: [Q.city, Q.level, Q.yesNo] }),
      ).resolves.toEqual({
        keys: [Q.city, Q.level, Q.yesNo],
      });
    });

    it('refuses more than three keys, a repeat and a non-UUID, with errors paths', async () => {
      await expect(
        validate({ keys: [Q.city, Q.level, Q.yesNo, Q.years] }),
      ).rejects.toMatchObject({ response: { errors: [{ path: 'keys' }] } });
      await expect(validate({ keys: [Q.city, Q.city] })).rejects.toMatchObject({
        response: { errors: [{ path: 'keys.1' }] },
      });
      await expect(validate({ keys: ['not-a-uuid'] })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(validate({ keys: ['not-a-uuid'] })).rejects.toMatchObject({
        response: { errors: [{ path: 'keys.0' }] },
      });
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
