import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { findKnockout, parseAnswers, toPublicFields } from '@repo/shared';
import { ApplicationsRepository } from './applications.repository.js';
import type { SubmitApplicationDto } from './dto/submit-application.dto.js';

@Injectable()
export class ApplicationsService {
  constructor(private readonly applications: ApplicationsRepository) {}

  async getPublicJob(companySlug: string, jobSlug: string) {
    const found = await this.applications.findOpenJob(companySlug, jobSlug);
    if (!found) {
      throw new NotFoundException();
    }
    return {
      company: {
        name: found.company.name,
        slug: found.company.slug,
        logoUrl: found.company.logoUrl,
        brandColor: found.company.brandColor,
      },
      job: { title: found.job.title, description: found.job.description },
      fields: toPublicFields(found.form.fields),
    };
  }

  async submit(companySlug: string, jobSlug: string, dto: SubmitApplicationDto) {
    if (dto.website) {
      // A bot filled in the hidden field. Answer as if it worked, and save nothing.
      return { received: true };
    }

    const found = await this.applications.findOpenJob(companySlug, jobSlug);
    if (!found) {
      throw new NotFoundException();
    }

    const parsed = parseAnswers(found.form.fields, dto.answers);
    if (!parsed.ok) {
      throw new BadRequestException({ message: 'Some answers need attention.', errors: parsed.errors });
    }

    const knockout = findKnockout(found.form.fields, parsed.answers);
    const source = dto.source ?? null;

    const result = await this.applications.submit({
      companyId: found.company.id,
      jobId: found.job.id,
      formVersionId: found.form.id,
      stageId: knockout ? found.rejectedStageId : found.firstStageId,
      status: knockout ? 'rejected' : 'active',
      candidate: { email: dto.email, name: dto.name.trim(), phone: dto.phone.trim() },
      answers: parsed.answers,
      source,
      events: [
        { type: 'applied', fromStageId: null, toStageId: found.firstStageId, data: { source } },
        ...(knockout
          ? [
              {
                type: 'auto_rejected' as const,
                fromStageId: found.firstStageId,
                toStageId: found.rejectedStageId,
                data: { fieldKey: knockout.fieldKey, fieldLabel: knockout.fieldLabel },
              },
            ]
          : []),
      ],
    });

    if (result === 'duplicate') {
      throw new ConflictException('You have already applied for this job.');
    }
    return { received: true };
  }
}