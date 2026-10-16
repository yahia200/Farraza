import { BadRequestException } from '@nestjs/common';
import type { AuthorizationService } from '@nestjs/authorization';
import type { CvMode, FormFields } from '@repo/shared';
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

  beforeEach(() => {
    service = new FormsService(
      new InMemoryFormsRepository() as unknown as FormsRepository,
      { get: async () => ({ id: 'job-1' }) } as unknown as JobsService,
      { authorize: async () => undefined } as unknown as AuthorizationService,
    );
  });

  it('saves a draft with a file question and publishes it', async () => {
    const config = { kinds: ['document', 'image'], maxSizeMb: 10, maxDurationSeconds: null };

    const draft = await service.saveDraft(user, membership, 'backend', {
      fields: [fileQuestion(config)],
      cvMode: 'optional',
    });
    expect(draft.fields).toMatchObject([{ type: 'file', config }]);

    const published = await service.publish(user, membership, 'backend');
    expect(published.publishedAt).toBeInstanceOf(Date);
    expect(published.fields).toMatchObject([{ type: 'file', config }]);
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
        fields: [fileQuestion({ kinds: ['image'], maxSizeMb: 201, maxDurationSeconds: null })],
        cvMode: 'off',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
