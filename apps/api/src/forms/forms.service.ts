import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { AuthorizationService } from '@nestjs/authorization';
import { parseFormFields } from '@repo/shared';
import type { Membership } from '../companies/company.js';
import { JobPolicy } from '../jobs/job.policy.js';
import { JobsService } from '../jobs/jobs.service.js';
import type { User } from '../users/user.js';
import type { FormVersion, JobForm } from './form.js';
import { FormsRepository } from './forms.repository.js';
import { isUniqueViolation } from '../common/db-errors.js';

@Injectable()
export class FormsService {
  constructor(
    private readonly forms: FormsRepository,
    private readonly jobs: JobsService,
    private readonly authorization: AuthorizationService,
  ) {}

  async get(membership: Membership, jobSlug: string): Promise<JobForm> {
    const job = await this.jobs.get(membership, jobSlug);
    const [draft, published] = await Promise.all([
      this.forms.findDraft(job.id),
      this.forms.findLatestPublished(job.id),
    ]);
    return { draft, published };
  }

  async saveDraft(
    user: User,
    membership: Membership,
    jobSlug: string,
    input: unknown,
  ): Promise<FormVersion> {
    await this.authorization.authorize(JobPolicy, 'update', user, membership);

    const parsed = parseFormFields(input);
    if (!parsed.ok) {
      throw new BadRequestException({ message: 'Some questions in this form need attention.', errors: parsed.errors });
    }

    const job = await this.jobs.get(membership, jobSlug);
    const draft = await this.forms.findDraft(job.id);

    if (draft) {
      const updated = await this.forms.updateDraftFields(draft.id, parsed.fields);
      if (!updated) {
        throw new ConflictException('This draft was just published. Reload and try again.');
      }
      return updated;
    }

    const published = await this.forms.findLatestPublished(job.id);
    try {
      return await this.forms.createDraft({
        companyId: membership.company.id,
        jobId: job.id,
        version: (published?.version ?? 0) + 1,
        fields: parsed.fields,
        createdById: user.id,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Someone else just started a draft. Reload and try again.');
      }
      throw error;
    }
  }

  async publish(user: User, membership: Membership, jobSlug: string): Promise<FormVersion> {
    await this.authorization.authorize(JobPolicy, 'update', user, membership);

    const job = await this.jobs.get(membership, jobSlug);
    const draft = await this.forms.findDraft(job.id);
    if (!draft) {
      throw new ConflictException('There is no draft to publish.');
    }

    const published = await this.forms.publish(draft.id, new Date());
    if (!published) {
      throw new ConflictException('This draft was already published.');
    }
    return published;
  }
}