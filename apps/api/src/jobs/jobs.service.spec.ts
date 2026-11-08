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
import {
  parseFormFields,
  SCREENING_RULES_LIMIT,
  REQUIREMENTS_LIMIT,
  REQUIREMENT_EDIT_LIMIT,
  type FormFields,
  type Requirement,
  type ScreeningRule,
} from '@repo/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { toValidationException } from '../common/validation-errors.js';
import type { MemberRole, Membership } from '../companies/company.js';
import type { FormVersion } from '../forms/form.js';
import type { FormsRepository } from '../forms/forms.repository.js';
import type { User } from '../users/user.js';
import { DEFAULT_STAGES } from './job.js';
import { saveHighlightedQuestionsSchema } from './dto/save-highlighted-questions.dto.js';
import { saveRatingCriteriaSchema } from './dto/save-rating-criteria.dto.js';
import { saveRequirementsSchema } from './dto/save-requirements.dto.js';
import { saveScreeningRulesSchema } from './dto/save-screening-rules.dto.js';
import type { Job, JobWithStages, RequirementVersion } from './job.js';
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
  private readonly requirementVersions: RequirementVersion[] = [];
  private readonly applicationStatuses = new Map<string, string[]>();
  private nextId = 1;

  /** Test setup: the job holds `count` more Applications, all in `status`. */
  seedApplications(job: JobWithStages, count: number, status = 'active'): void {
    const existing = this.applicationStatuses.get(job.id) ?? [];
    this.applicationStatuses.set(job.id, [...existing, ...new Array<string>(count).fill(status)]);
  }

  /** Every Application counts, whatever its status (mirrors the real unfiltered count). */
  async countApplications(_companyId: string, jobId: string): Promise<number> {
    return this.applicationStatuses.get(jobId)?.length ?? 0;
  }

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
      ratingCriteria: [],
      screeningRules: [],
      requirements: [],
      requirementsVersion: 0,
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
    if (!found) return null;
    const latest = this.latestVersion(found.job.id);
    return {
      ...found.job,
      requirements: structuredClone(latest?.requirements ?? []),
      requirementsVersion: latest?.version ?? 0,
    };
  }

  /** Test setup and assertions: every stored version of a job, oldest first. */
  versionsOf(jobId: string): RequirementVersion[] {
    return structuredClone(
      this.requirementVersions
        .filter((row) => row.jobId === jobId)
        .sort((a, b) => a.version - b.version),
    );
  }

  /** Test setup: store the next version of a job directly, as another request would. */
  seedVersion(job: JobWithStages, requirements: Requirement[]): void {
    const version = (this.latestVersion(job.id)?.version ?? 0) + 1;
    this.requirementVersions.push({
      companyId: 'company-1',
      jobId: job.id,
      version,
      requirements: structuredClone(requirements),
      createdAt: new Date('2026-01-03T00:00:00Z'),
    });
  }

  private beforeInsert: (() => void) | null = null;

  /** Test setup: run `hook` once, just before the next version insert (a racing save). */
  beforeNextVersionInsert(hook: () => void): void {
    this.beforeInsert = hook;
  }

  private latestVersion(jobId: string): RequirementVersion | null {
    return (
      this.requirementVersions
        .filter((row) => row.jobId === jobId)
        .sort((a, b) => b.version - a.version)[0] ?? null
    );
  }

  async findLatestRequirementVersion(
    jobId: string,
  ): Promise<RequirementVersion | null> {
    const latest = this.latestVersion(jobId);
    return latest ? structuredClone(latest) : null;
  }

  /** Mirrors UNIQUE (job_id, version): a taken number is a unique violation. */
  async createRequirementVersion(input: {
    companyId: string;
    jobId: string;
    version: number;
    requirements: Requirement[];
  }): Promise<RequirementVersion> {
    const hook = this.beforeInsert;
    this.beforeInsert = null;
    hook?.();
    if (
      this.requirementVersions.some(
        (row) => row.jobId === input.jobId && row.version === input.version,
      )
    ) {
      throw Object.assign(new Error('duplicate key'), { sqlState: '23505' });
    }
    const row: RequirementVersion = {
      ...structuredClone(input),
      createdAt: new Date('2026-01-03T00:00:00Z'),
    };
    this.requirementVersions.push(row);
    return structuredClone(row);
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

  /** Replaces the whole list in one write (mirrors the real unconditional update). */
  async replaceRatingCriteria(id: string, keys: string[]): Promise<Job | null> {
    const job = this.jobs.find((row) => row.job.id === id)?.job;
    if (!job) return null;
    job.ratingCriteria = [...keys];
    return { ...job };
  }

  /** Replaces the whole list in one write (mirrors the real unconditional update). */
  async replaceScreeningRules(
    id: string,
    rules: ScreeningRule[],
  ): Promise<Job | null> {
    const job = this.jobs.find((row) => row.job.id === id)?.job;
    if (!job) return null;
    job.screeningRules = structuredClone(rules);
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
    },
  },
  {
    ...base,
    key: Q.yesNo,
    type: 'yes_no',
    label: 'On site?',
    config: {},
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

  describe('saveRatingCriteria', () => {
    it('saves a manager’s Criteria and reports them on the Job', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');

      const saved = await service.saveRatingCriteria(
        user,
        membershipWithRole('recruiter'),
        job.slug,
        { keys: ['culture_fit', 'technical_skills'] },
      );

      expect(saved).toEqual({ keys: ['culture_fit', 'technical_skills'] });
      expect(
        (await service.get(membershipWithRole('interviewer'), job.slug))
          .ratingCriteria,
      ).toEqual(['culture_fit', 'technical_skills']);
    });

    it('lets owners and admins save too', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');

      await service.saveRatingCriteria(user, membershipWithRole('owner'), job.slug, {
        keys: ['leadership'],
      });
      const saved = await service.saveRatingCriteria(
        user,
        membershipWithRole('admin'),
        job.slug,
        { keys: ['communication'] },
      );

      expect(saved).toEqual({ keys: ['communication'] });
    });

    it('saves on a draft, an open and a closed Job', async () => {
      const membership = membershipWithRole('owner');
      const draft = jobs.seedJob(company.id, 'Draft Job');
      const open = jobs.seedJob(company.id, 'Open Job');
      const closed = jobs.seedJob(company.id, 'Closed Job');
      jobs.publishFormFor(open.id);
      jobs.publishFormFor(closed.id);
      await service.open(user, membership, open.slug);
      await service.open(user, membership, closed.slug);
      await service.close(user, membership, closed.slug);

      for (const job of [draft, open, closed]) {
        await expect(
          service.saveRatingCriteria(user, membership, job.slug, {
            keys: ['problem_solving'],
          }),
        ).resolves.toEqual({ keys: ['problem_solving'] });
      }
      expect((await service.get(membership, closed.slug)).status).toBe('closed');
    });

    it('forbids an interviewer and leaves the list unchanged', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');

      const attempt = service.saveRatingCriteria(
        user,
        membershipWithRole('interviewer'),
        job.slug,
        { keys: ['culture_fit'] },
      );

      await expect(attempt).rejects.toBeInstanceOf(AuthorizationError);
      await expect(attempt).rejects.toMatchObject({ reason: 'forbidden' });
      expect(
        (await service.get(membershipWithRole('owner'), job.slug)).ratingCriteria,
      ).toEqual([]);
    });

    it('replaces the previous list on every save, and an empty list clears it', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');
      const membership = membershipWithRole('owner');
      await service.saveRatingCriteria(user, membership, job.slug, {
        keys: ['culture_fit', 'leadership', 'communication'],
      });

      await service.saveRatingCriteria(user, membership, job.slug, {
        keys: ['relevant_experience'],
      });
      expect((await service.get(membership, job.slug)).ratingCriteria).toEqual([
        'relevant_experience',
      ]);

      const cleared = await service.saveRatingCriteria(user, membership, job.slug, {
        keys: [],
      });
      expect(cleared).toEqual({ keys: [] });
      expect((await service.get(membership, job.slug)).ratingCriteria).toEqual([]);
    });

    it('does not find a job that belongs to another company', async () => {
      const job = jobs.seedJob('another-company', 'Backend Engineer');

      await expect(
        service.saveRatingCriteria(user, membershipWithRole('owner'), job.slug, {
          keys: ['culture_fit'],
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('reads as an empty list on a Job that never had Criteria saved', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');

      expect(
        (await service.get(membershipWithRole('owner'), job.slug)).ratingCriteria,
      ).toEqual([]);
    });
  });

  // An unknown key, more than five and repeats are refused before the service runs, by the global
  // pipe main.ts installs, applying the route's body schema. Same approach as the Highlighted
  // questions body describe above: the 400 a client gets is checked here; the schema's own rules
  // are tested in @repo/shared.
  describe('the save rating criteria request body', () => {
    const pipe = new StandardSchemaValidationPipe({
      exceptionFactory: toValidationException,
    });
    const validate = (body: unknown) =>
      pipe.transform(body, { type: 'body', schema: saveRatingCriteriaSchema });

    it('accepts up to five distinct catalog keys, and none', async () => {
      const five = [
        'technical_skills',
        'problem_solving',
        'communication',
        'culture_fit',
        'leadership',
      ];
      await expect(validate({ keys: five })).resolves.toEqual({ keys: five });
      await expect(validate({ keys: [] })).resolves.toEqual({ keys: [] });
    });

    it('refuses an unknown key, more than five and a repeat, with errors paths', async () => {
      await expect(validate({ keys: ['charisma'] })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(validate({ keys: ['charisma'] })).rejects.toMatchObject({
        response: { errors: [{ path: 'keys.0' }] },
      });
      await expect(
        validate({
          keys: [
            'technical_skills',
            'problem_solving',
            'communication',
            'culture_fit',
            'leadership',
            'relevant_experience',
          ],
        }),
      ).rejects.toMatchObject({ response: { errors: [{ path: 'keys' }] } });
      await expect(
        validate({ keys: ['culture_fit', 'culture_fit'] }),
      ).rejects.toMatchObject({ response: { errors: [{ path: 'keys.1' }] } });
    });
  });

  describe('saveScreeningRules', () => {
    const LEVEL_SENIOR = '30000000-0000-4000-8000-000000000002';
    const rule = (
      n: number,
      over: Partial<ScreeningRule> = {},
    ): ScreeningRule => ({
      id: `40000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
      questionKey: Q.years,
      outcome: 'reject',
      condition: { type: 'number', op: 'min', value: 5 },
      ...over,
    });
    const withForm = (title = 'Backend Engineer') => {
      const job = jobs.seedJob(company.id, title);
      forms.seedPublished(job.id, publishedForm);
      return job;
    };

    it('saves a manager’s rules and reports them on the Job', async () => {
      const job = withForm();
      const rules = [
        rule(1),
        rule(2, {
          questionKey: Q.level,
          outcome: 'flag',
          condition: {
            type: 'single_select',
            op: 'in',
            optionIds: [LEVEL_SENIOR],
          },
        }),
      ];

      const saved = await service.saveScreeningRules(
        user,
        membershipWithRole('recruiter'),
        job.slug,
        { rules },
      );

      expect(saved).toEqual({ rules });
      expect(
        (await service.get(membershipWithRole('interviewer'), job.slug))
          .screeningRules,
      ).toEqual(rules);
    });

    it('lets owners and admins save too', async () => {
      const job = withForm();
      await service.saveScreeningRules(user, membershipWithRole('owner'), job.slug, {
        rules: [rule(1)],
      });
      await expect(
        service.saveScreeningRules(user, membershipWithRole('admin'), job.slug, {
          rules: [rule(2)],
        }),
      ).resolves.toEqual({ rules: [rule(2)] });
    });

    it('saves on a draft, an open and a closed Job', async () => {
      const membership = membershipWithRole('owner');
      const draft = withForm('Draft Job');
      const open = withForm('Open Job');
      const closed = withForm('Closed Job');
      jobs.publishFormFor(open.id);
      jobs.publishFormFor(closed.id);
      await service.open(user, membership, open.slug);
      await service.open(user, membership, closed.slug);
      await service.close(user, membership, closed.slug);

      for (const job of [draft, open, closed]) {
        await expect(
          service.saveScreeningRules(user, membership, job.slug, {
            rules: [rule(1)],
          }),
        ).resolves.toEqual({ rules: [rule(1)] });
      }
      expect((await service.get(membership, closed.slug)).status).toBe('closed');
    });

    it('forbids an interviewer and leaves the list unchanged', async () => {
      const job = withForm();

      const attempt = service.saveScreeningRules(
        user,
        membershipWithRole('interviewer'),
        job.slug,
        { rules: [rule(1)] },
      );

      await expect(attempt).rejects.toBeInstanceOf(AuthorizationError);
      await expect(attempt).rejects.toMatchObject({ reason: 'forbidden' });
      expect(
        (await service.get(membershipWithRole('owner'), job.slug)).screeningRules,
      ).toEqual([]);
    });

    it('refuses rules the shared validator refuses, with a path per problem', async () => {
      const job = withForm();
      const membership = membershipWithRole('owner');

      const attempt = service.saveScreeningRules(user, membership, job.slug, {
        rules: [
          rule(1),
          rule(2, { questionKey: NOT_ON_FORM }),
          rule(3, {
            questionKey: Q.city,
            condition: { type: 'number', op: 'min', value: 1 },
          }),
          rule(4, {
            questionKey: Q.level,
            condition: {
              type: 'single_select',
              op: 'in',
              optionIds: ['30000000-0000-4000-8000-0000000000ff'],
            },
          }),
        ],
      });

      await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
      await expect(attempt).rejects.toMatchObject({
        response: {
          message: expect.any(String),
          errors: [
            { path: expect.stringMatching(/^rules.1./), message: expect.any(String) },
            { path: expect.stringMatching(/^rules.2./), message: expect.any(String) },
            { path: expect.stringMatching(/^rules.3./), message: expect.any(String) },
          ],
        },
      });
      expect((await service.get(membership, job.slug)).screeningRules).toEqual([]);
    });

    it('refuses more rules than the cap', async () => {
      const job = withForm();
      const rules = Array.from({ length: SCREENING_RULES_LIMIT + 1 }, (_, n) =>
        rule(n + 1),
      );

      await expect(
        service.saveScreeningRules(user, membershipWithRole('owner'), job.slug, {
          rules,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts only an empty list on a Job with no published form', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');
      const membership = membershipWithRole('owner');

      await expect(
        service.saveScreeningRules(user, membership, job.slug, { rules: [] }),
      ).resolves.toEqual({ rules: [] });

      const attempt = service.saveScreeningRules(user, membership, job.slug, {
        rules: [rule(1)],
      });
      await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
      await expect(attempt).rejects.toMatchObject({
        response: { errors: [{ path: 'rules.0.questionKey' }] },
      });
    });

    it('replaces the previous list on every save, and an empty list clears it', async () => {
      const job = withForm();
      const membership = membershipWithRole('owner');
      await service.saveScreeningRules(user, membership, job.slug, {
        rules: [rule(1), rule(2)],
      });

      await service.saveScreeningRules(user, membership, job.slug, {
        rules: [rule(3)],
      });
      expect((await service.get(membership, job.slug)).screeningRules).toEqual([
        rule(3),
      ]);

      await expect(
        service.saveScreeningRules(user, membership, job.slug, { rules: [] }),
      ).resolves.toEqual({ rules: [] });
      expect((await service.get(membership, job.slug)).screeningRules).toEqual([]);
    });

    it('does not find a job that belongs to another company', async () => {
      const job = jobs.seedJob('another-company', 'Backend Engineer');

      await expect(
        service.saveScreeningRules(user, membershipWithRole('owner'), job.slug, {
          rules: [],
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('reads as an empty list on a Job that never had rules saved', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');

      expect(
        (await service.get(membershipWithRole('owner'), job.slug)).screeningRules,
      ).toEqual([]);
    });
  });

  // The array and cap check is the route's body schema, run by the global pipe; item validation is
  // the service's (`parseScreeningRules`). Only the pipe's 400 shape is checked here.
  describe('the save screening rules request body', () => {
    const pipe = new StandardSchemaValidationPipe({
      exceptionFactory: toValidationException,
    });
    const validate = (body: unknown) =>
      pipe.transform(body, { type: 'body', schema: saveScreeningRulesSchema });

    it('passes a list through and refuses a non-array or an over-cap list', async () => {
      await expect(validate({ rules: [] })).resolves.toEqual({ rules: [] });
      await expect(validate({ rules: 'x' })).rejects.toMatchObject({
        response: { errors: [{ path: 'rules' }] },
      });
      await expect(
        validate({ rules: new Array(SCREENING_RULES_LIMIT + 1).fill({}) }),
      ).rejects.toMatchObject({ response: { errors: [{ path: 'rules' }] } });
    });
  });

  describe('saveRequirements', () => {
    const req = (n: number, over: Partial<Requirement> = {}): Requirement => ({
      id: `50000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
      text: `Requirement ${n}`,
      tier: 'must_have',
      keywords: ['postgres', 'postgresql'],
      ...over,
    });
    const save = (
      slug: string,
      requirements: Requirement[],
      role: MemberRole = 'recruiter',
    ) =>
      service.saveRequirements(user, membershipWithRole(role), slug, {
        requirements,
      });
    const current = (slug: string) =>
      service.get(membershipWithRole('owner'), slug);

    it('creates version 1 for a first save and reports it on the Job', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');
      const requirements = [req(1), req(2, { tier: 'nice_to_have' })];

      const saved = await save(job.slug, requirements);

      expect(saved).toEqual({ requirements, version: 1 });
      const payload = await current(job.slug);
      expect(payload.requirements).toEqual(requirements);
      expect(payload.requirementsVersion).toBe(1);
    });

    it('reads as no Requirements and version 0 before any save', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');
      const payload = await current(job.slug);
      expect(payload.requirements).toEqual([]);
      expect(payload.requirementsVersion).toBe(0);
    });

    it('creates version N+1 when the list changes', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');
      await save(job.slug, [req(1)]);

      const saved = await save(job.slug, [req(1), req(2)]);

      expect(saved.version).toBe(2);
      expect((await current(job.slug)).requirementsVersion).toBe(2);
    });

    it('creates nothing when the list is identical to the current version', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');
      await save(job.slug, [req(1)]);

      const saved = await save(job.slug, [req(1)]);

      expect(saved).toEqual({ requirements: [req(1)], version: 1 });
      expect(jobs.versionsOf(job.id)).toHaveLength(1);
    });

    it('counts a reorder as a change', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');
      await save(job.slug, [req(1), req(2)]);

      expect((await save(job.slug, [req(2), req(1)])).version).toBe(2);
    });

    it('saves an empty list as a new version with no Requirements', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');
      await save(job.slug, [req(1)]);

      const saved = await save(job.slug, []);

      expect(saved).toEqual({ requirements: [], version: 2 });
      expect(jobs.versionsOf(job.id)[1]?.requirements).toEqual([]);
    });

    it('creates no version for an empty list on a Job that never had Requirements', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');

      expect(await save(job.slug, [])).toEqual({
        requirements: [],
        version: 0,
      });
      expect(jobs.versionsOf(job.id)).toHaveLength(0);
    });

    it('never modifies an older version', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');
      await save(job.slug, [req(1)]);
      await save(job.slug, [req(1, { text: 'Edited' }), req(2)]);
      await save(job.slug, []);

      const versions = jobs.versionsOf(job.id);
      expect(versions.map((v) => v.version)).toEqual([1, 2, 3]);
      expect(versions[0]?.requirements).toEqual([req(1)]);
      expect(versions[1]?.requirements).toEqual([
        req(1, { text: 'Edited' }),
        req(2),
      ]);
    });

    it('keeps a Requirement’s id when the manager edits it', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');
      await save(job.slug, [req(1)]);

      await save(job.slug, [
        req(1, { text: 'Run Postgres', keywords: ['postgres', 'psql'] }),
      ]);

      const [first, second] = jobs.versionsOf(job.id);
      expect(second?.requirements[0]?.id).toBe(first?.requirements[0]?.id);
      expect(second?.requirements[0]?.keywords).toEqual(['postgres', 'psql']);
    });

    it.each(['draft', 'open', 'closed'] as const)(
      'saves on a %s Job',
      async (status) => {
        const job = jobs.seedJob(company.id, `Job ${status}`);
        if (status !== 'draft') {
          jobs.publishFormFor(job.id);
          await jobs.open(job.id, new Date());
        }
        if (status === 'closed') await jobs.close(job.id, new Date());

        expect((await save(job.slug, [req(1)])).version).toBe(1);
      },
    );

    it('lets an owner, admin and recruiter save but refuses an interviewer', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');

      for (const [n, role] of (['owner', 'admin', 'recruiter'] as const).entries()) {
        await expect(
          save(job.slug, [req(n + 1)], role),
        ).resolves.toBeDefined();
      }
      await expect(
        save(job.slug, [req(9)], 'interviewer'),
      ).rejects.toBeInstanceOf(AuthorizationError);
      expect(jobs.versionsOf(job.id)).toHaveLength(3);
    });

    it('404s for a Job of another company', async () => {
      jobs.seedJob('company-2', 'Other Job');

      await expect(save('other-job', [req(1)])).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('answers 409 when someone else saved a new version first', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');
      jobs.beforeNextVersionInsert(() =>
        jobs.seedVersion(job, [req(9)]),
      );

      await expect(save(job.slug, [req(1)])).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('the Edit limit', () => {
    const req = (n: number): Requirement => ({
      id: `50000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
      text: `Requirement ${n}`,
      tier: 'must_have',
      keywords: ['postgres'],
    });
    const save = (slug: string, requirements: Requirement[], role: MemberRole = 'recruiter') =>
      service.saveRequirements(user, membershipWithRole(role), slug, { requirements });
    const detail = (slug: string) => service.getDetail(membershipWithRole('owner'), slug);

    it('allows a save one Application below the limit', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');
      jobs.seedApplications(job, REQUIREMENT_EDIT_LIMIT - 1);

      await expect(save(job.slug, [req(1)])).resolves.toMatchObject({ version: 1 });
    });

    it('refuses a save at the limit with a 409 that says why', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');
      jobs.seedApplications(job, REQUIREMENT_EDIT_LIMIT);

      const refused = save(job.slug, [req(1)]);

      await expect(refused).rejects.toBeInstanceOf(ConflictException);
      await expect(refused).rejects.toThrow(/can no longer be changed/);
      await expect(refused).rejects.toThrow(String(REQUIREMENT_EDIT_LIMIT));
    });

    it('counts a rejected Application towards the limit', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');
      jobs.seedApplications(job, REQUIREMENT_EDIT_LIMIT - 1);
      jobs.seedApplications(job, 1, 'rejected');

      await expect(save(job.slug, [req(1)])).rejects.toBeInstanceOf(ConflictException);
    });

    it('refuses for every role that may save, and past the limit too', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');
      jobs.seedApplications(job, REQUIREMENT_EDIT_LIMIT + 50);

      for (const role of ['owner', 'admin', 'recruiter'] as const) {
        await expect(save(job.slug, [req(1)], role)).rejects.toBeInstanceOf(ConflictException);
      }
    });

    it('writes no version and leaves the stored list untouched when it refuses', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');
      await save(job.slug, [req(1)]);
      jobs.seedApplications(job, REQUIREMENT_EDIT_LIMIT);

      await expect(save(job.slug, [req(1), req(2)])).rejects.toBeInstanceOf(ConflictException);
      await expect(save(job.slug, [])).rejects.toBeInstanceOf(ConflictException);

      expect(jobs.versionsOf(job.id)).toHaveLength(1);
      const payload = await detail(job.slug);
      expect(payload.requirements).toEqual([req(1)]);
      expect(payload.requirementsVersion).toBe(1);
    });

    it('still refuses a save that would change nothing', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');
      await save(job.slug, [req(1)]);
      jobs.seedApplications(job, REQUIREMENT_EDIT_LIMIT);

      await expect(save(job.slug, [req(1)])).rejects.toBeInstanceOf(ConflictException);
    });

    it('checks the role before the limit', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');
      jobs.seedApplications(job, REQUIREMENT_EDIT_LIMIT);

      await expect(save(job.slug, [req(1)], 'interviewer')).rejects.toBeInstanceOf(AuthorizationError);
    });

    it('reports requirementsLocked false below the limit and true from it', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');
      jobs.seedApplications(job, REQUIREMENT_EDIT_LIMIT - 1);
      expect((await detail(job.slug)).requirementsLocked).toBe(false);

      jobs.seedApplications(job, 1, 'rejected');
      expect((await detail(job.slug)).requirementsLocked).toBe(true);
    });

    it('locks a Job that is already past the limit', async () => {
      const job = jobs.seedJob(company.id, 'Backend Engineer');
      jobs.seedApplications(job, REQUIREMENT_EDIT_LIMIT * 3);

      expect((await detail(job.slug)).requirementsLocked).toBe(true);
    });
  });

  describe('the save requirements request body', () => {
    const pipe = new StandardSchemaValidationPipe({
      exceptionFactory: toValidationException,
    });
    const validate = (body: unknown) =>
      pipe.transform(body, { type: 'body', schema: saveRequirementsSchema });
    const valid = {
      id: '50000000-0000-4000-8000-000000000001',
      text: 'Postgres',
      tier: 'must_have',
      keywords: ['postgres'],
    };

    it('passes an empty list and a valid one through', async () => {
      await expect(validate({ requirements: [] })).resolves.toEqual({
        requirements: [],
      });
      await expect(validate({ requirements: [valid] })).resolves.toEqual({
        requirements: [valid],
      });
    });

    it('refuses an unknown key, a requirement with no keywords and an over-cap list', async () => {
      await expect(
        validate({ requirements: [], extra: 1 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        validate({ requirements: [{ ...valid, keywords: [] }] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      const many = Array.from({ length: REQUIREMENTS_LIMIT + 1 }, (_, i) => ({
        ...valid,
        id: `50000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
      }));
      await expect(validate({ requirements: many })).rejects.toBeInstanceOf(
        BadRequestException,
      );
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
