import { BadRequestException } from '@nestjs/common';
import type { AuthorizationService } from '@nestjs/authorization';
import type { CvMode, FormFields, ScreeningRule } from '@repo/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Membership } from '../companies/company.js';
import type { JobsService } from '../jobs/jobs.service.js';
import type { User } from '../users/user.js';
import type { FormVersion } from './form.js';
import type { FormsRepository } from './forms.repository.js';
import { FormsService } from './forms.service.js';

// Same pattern as jobs.service.spec.ts: the real service, an in-memory fake repository, assertions
// through the service's public methods. Authorization and the job lookup are not what is under test
// here (JobsService has its own spec), so they are stubbed to allow everything.

type PublicApi<T> = { [K in keyof T]: T[K] };

class InMemoryFormsRepository implements PublicApi<FormsRepository> {
  private readonly versions: Array<FormVersion & { jobId: string }> = [];

  async findDraft(jobId: string): Promise<FormVersion | null> {
    return this.versions.find((v) => v.jobId === jobId && v.publishedAt === null) ?? null;
  }

  async findLatestPublished(jobId: string): Promise<FormVersion | null> {
    const published = this.versions.filter((v) => v.jobId === jobId && v.publishedAt !== null);
    return published.sort((a, b) => b.version - a.version)[0] ?? null;
  }

  async createDraft(input: {
    companyId: string;
    jobId: string;
    version: number;
    fields: FormFields;
    cvMode: CvMode;
    createdById: string;
  }): Promise<FormVersion> {
    const version = {
      id: `form-${this.versions.length + 1}`,
      jobId: input.jobId,
      version: input.version,
      fields: input.fields,
      cvMode: input.cvMode,
      publishedAt: null,
      updatedAt: new Date(),
    };
    this.versions.push(version);
    return version;
  }

  async updateDraft(id: string, input: { fields: FormFields; cvMode: CvMode }): Promise<FormVersion | null> {
    const version = this.versions.find((v) => v.id === id && v.publishedAt === null);
    return version ? Object.assign(version, input) : null;
  }

  async publish(id: string, at: Date): Promise<FormVersion | null> {
    const version = this.versions.find((v) => v.id === id && v.publishedAt === null);
    return version ? Object.assign(version, { publishedAt: at }) : null;
  }
}

const user = { id: 'user-1' } as User;
const membership = { company: { id: 'company-1' } } as Membership;

const FILE_KEY = '5e0d7c3a-2b1f-4a69-8c7d-6e5f4a3b2c10';
const fileQuestion = (config: Record<string, unknown>) =>
  ({
    key: FILE_KEY,
    type: 'file',
    label: 'Work sample',
    helpText: null,
    required: true,
    config,
  }) as unknown;

describe('FormsService', () => {
  let service: FormsService;
  let screeningRules: ScreeningRule[];

  beforeEach(() => {
    screeningRules = [];
    service = new FormsService(
      new InMemoryFormsRepository() as unknown as FormsRepository,
      {
        get: async () => ({ id: 'job-1', screeningRules }),
      } as unknown as JobsService,
      { authorize: async () => undefined } as unknown as AuthorizationService,
    );
  });

  it('saves a draft with a file question and publishes it', async () => {
    const config = {
      kinds: ['document', 'image'],
      maxSizeMb: 10,
      maxDurationSeconds: null,
    };

    const draft = await service.saveDraft(user, membership, 'backend', {
      fields: [fileQuestion(config)],
      cvMode: 'optional',
    });
    expect(draft.fields).toMatchObject([{ type: 'file', config }]);

    const published = await service.publish(user, membership, 'backend');
    expect(published.publishedAt).toBeInstanceOf(Date);
    expect(published.fields).toMatchObject([{ type: 'file', config }]);
  });

  describe('CV setting', () => {
    it('saves cvMode with the draft and keeps it when the draft is published', async () => {
      const draft = await service.saveDraft(user, membership, 'backend', {
        fields: [],
        cvMode: 'required',
      });
      expect(draft.cvMode).toBe('required');

      // Saving again updates the same draft, cvMode included.
      const resaved = await service.saveDraft(user, membership, 'backend', {
        fields: [],
        cvMode: 'off',
      });
      expect(resaved.id).toBe(draft.id);
      expect(resaved.cvMode).toBe('off');

      const published = await service.publish(user, membership, 'backend');
      expect(published.cvMode).toBe('off');
      expect((await service.get(membership, 'backend')).published?.cvMode).toBe('off');
    });

    it('lets a new draft after publishing change cvMode without touching the published version', async () => {
      await service.saveDraft(user, membership, 'backend', {
        fields: [],
        cvMode: 'required',
      });
      await service.publish(user, membership, 'backend');

      const draft = await service.saveDraft(user, membership, 'backend', {
        fields: [],
        cvMode: 'off',
      });
      expect(draft.version).toBe(2);
      expect(draft.cvMode).toBe('off');

      const form = await service.get(membership, 'backend');
      expect(form.published).toMatchObject({ version: 1, cvMode: 'required' });
      expect(form.draft).toMatchObject({ version: 2, cvMode: 'off' });
    });

    it('lets a new draft after publishing keep the same cvMode', async () => {
      await service.saveDraft(user, membership, 'backend', {
        fields: [],
        cvMode: 'optional',
      });
      await service.publish(user, membership, 'backend');

      await service.saveDraft(user, membership, 'backend', {
        fields: [],
        cvMode: 'optional',
      });
      const republished = await service.publish(user, membership, 'backend');

      expect(republished).toMatchObject({ version: 2, cvMode: 'optional' });
      const form = await service.get(membership, 'backend');
      expect(form.published).toMatchObject({ version: 2, cvMode: 'optional' });
      expect(form.draft).toBeNull();
    });
  });

  it('refuses a file question without kinds, pointing at them', async () => {
    const error = await service
      .saveDraft(user, membership, 'backend', {
        fields: [fileQuestion({ kinds: [], maxSizeMb: 10, maxDurationSeconds: null })],
        cvMode: 'off',
      })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toMatchObject({
      errors: [{ path: '0.config.kinds' }],
    });
  });

  it('refuses a file size limit over 200 MB', async () => {
    await expect(
      service.saveDraft(user, membership, 'backend', {
        fields: [
          fileQuestion({
            kinds: ['image'],
            maxSizeMb: 201,
            maxDurationSeconds: null,
          }),
        ],
        cvMode: 'off',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  describe('Screening rules', () => {
    const YEARS_KEY = '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed';
    const PICK_KEY = '2c8d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bee';
    const OPT_A = '3d7d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bef';
    const OPT_B = '4e6d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bf0';
    const OPT_C = '5f5d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bf1';

    const years = (label = 'Years of experience') => ({
      key: YEARS_KEY,
      type: 'number',
      label,
      helpText: null,
      required: true,
      config: { min: null, max: null, integerOnly: true },
    });
    const pick = (options: Array<[string, string]>, label = 'Notice period') => ({
      key: PICK_KEY,
      type: 'single_select',
      label,
      helpText: null,
      required: true,
      config: {
        options: options.map(([id, l]) => ({ id, label: l })),
      },
    });
    const yearsRule: ScreeningRule = {
      id: '6a4d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bf2',
      questionKey: YEARS_KEY,
      outcome: 'reject',
      condition: { type: 'number', op: 'min', value: 5 },
    };
    const pickRule: ScreeningRule = {
      id: '7b3d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bf3',
      questionKey: PICK_KEY,
      outcome: 'flag',
      condition: { type: 'single_select', op: 'in', optionIds: [OPT_A, OPT_B] },
    };
    const AB: Array<[string, string]> = [
      [OPT_A, 'Now'],
      [OPT_B, '1 month'],
    ];

    const publishForm = async (fields: unknown[]) => {
      await service.saveDraft(user, membership, 'backend', {
        fields,
        cvMode: 'off',
      });
      return service.publish(user, membership, 'backend');
    };
    const publishError = async (fields: unknown[]) => {
      const error = await publishForm(fields).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(BadRequestException);
      return (error as BadRequestException).getResponse() as {
        message: string;
        errors: Array<{ path: string; message: string }>;
      };
    };

    beforeEach(async () => {
      await publishForm([years(), pick(AB)]);
      screeningRules = [yearsRule, pickRule];
    });

    it('refuses to publish a version that drops a question a rule points to', async () => {
      const response = await publishError([pick(AB)]);

      expect(response.message).toContain('screening rule');
      expect(response.errors).toEqual([
        {
          path: 'screeningRules.0.questionKey',
          message: expect.stringContaining('Years of experience'),
        },
      ]);
    });

    it('refuses to publish a version that changes the type of a ruled question', async () => {
      const asText = {
        ...years(),
        type: 'short_text',
        config: { maxLength: 100 },
      };
      const response = await publishError([asText, pick(AB)]);

      expect(response.errors).toEqual([
        {
          path: 'screeningRules.0.questionKey',
          message: expect.stringContaining('Years of experience'),
        },
      ]);
    });

    it('refuses to publish a version that removes an option a rule uses', async () => {
      const response = await publishError([years(), pick([AB[0]!, [OPT_C, '3 months']])]);

      expect(response.errors).toEqual([
        {
          path: 'screeningRules.1.condition.optionIds.1',
          message: expect.stringContaining('1 month'),
        },
      ]);
    });

    it('still publishes when questions and options are relabelled, added or reordered', async () => {
      const published = await publishForm([
        pick(
          [
            [OPT_B, 'In a month'],
            [OPT_A, 'Immediately'],
            [OPT_C, 'Later'],
          ],
          'When can you start?',
        ),
        years('Total years of experience'),
        {
          ...years(),
          key: '8c2d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bf4',
          label: 'Another number',
        },
      ]);

      expect(published.version).toBe(2);
    });

    it('publishes once the offending rule is removed', async () => {
      await publishError([pick(AB)]);

      screeningRules = [pickRule];
      const published = await service.publish(user, membership, 'backend');

      expect(published.publishedAt).toBeInstanceOf(Date);
    });

    it('publishes a job with no rules without checks', async () => {
      screeningRules = [];

      const published = await publishForm([pick(AB)]);

      expect(published.publishedAt).toBeInstanceOf(Date);
    });
  });
});
