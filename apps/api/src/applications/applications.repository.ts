import { Injectable } from '@nestjs/common';
import type { FormFields } from '@repo/shared';
import { isUniqueViolation } from '../common/db-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { NewApplication, OpenJob } from './application.js';

@Injectable()
export class ApplicationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get companies() {
    return this.prisma.db.orm.public.Company;
  }

  private get jobs() {
    return this.prisma.db.orm.public.Job;
  }

  private get formVersions() {
    return this.prisma.db.orm.public.FormVersion;
  }

  /** The job as applicants see it, or null unless it is open with a published form. */
  async findOpenJob(companySlug: string, jobSlug: string): Promise<OpenJob | null> {
    const company = await this.companies.where({ slug: companySlug }).first();
    if (!company) return null;

    const job = await this.jobs
      .where({ companyId: company.id, slug: jobSlug, status: 'open' })
      .include('stages')
      .first();
    if (!job) return null;

    const form = await this.formVersions
      .where({ jobId: job.id })
      .where((version) => version.publishedAt.isNotNull())
      .orderBy((version) => version.version.desc())
      .first();
    if (!form) return null;

    const stages = [...job.stages].sort((a, b) => a.position - b.position);
    const first = stages.find((stage) => stage.kind === 'normal');
    const rejected = stages.find((stage) => stage.kind === 'rejected');
    if (!first || !rejected) return null;

    return {
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        logoUrl: company.logoUrl,
        brandColor: company.brandColor,
      },
      job: { id: job.id, title: job.title, description: job.description },
      form: { id: form.id, fields: form.fields as FormFields },
      firstStageId: first.id,
      rejectedStageId: rejected.id,
    };
  }

  /** Returns 'duplicate' if this person already applied to this job. */
  async submit(input: NewApplication): Promise<'created' | 'duplicate'> {
    try {
      await this.prisma.db.transaction(async (tx) => {
        const candidate = await tx.orm.public.Candidate.upsert({
          create: { companyId: input.companyId, ...input.candidate },
          update: { name: input.candidate.name, phone: input.candidate.phone },
          conflictOn: { companyId: input.companyId, email: input.candidate.email },
        });

        const application = await tx.orm.public.Application.create({
          companyId: input.companyId,
          jobId: input.jobId,
          candidateId: candidate.id,
          formVersionId: input.formVersionId,
          stageId: input.stageId,
          status: input.status,
          answers: input.answers,
          source: input.source,
        });

        await tx.orm.public.ApplicationEvent.createAll(
          input.events.map((event) => ({
            companyId: input.companyId,
            applicationId: application.id,
            ...event,
          })),
        );
      });
      return 'created';
    } catch (error) {
      if (isUniqueViolation(error)) {
        return 'duplicate';
      }
      throw error;
    }
  }
}