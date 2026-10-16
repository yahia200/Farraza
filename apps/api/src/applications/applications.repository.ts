import { Injectable } from '@nestjs/common';
import type { FormFields } from '@repo/shared';
import { isUniqueViolation } from '../common/db-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { NewApplication, NewPendingFile, OpenJob, SubmitResult } from './application.js';

/** Thrown inside the submit transaction to roll it back when a file can't be attached. */
class FileConflict extends Error {}

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
      form: { id: form.id, fields: form.fields as FormFields, cvMode: form.cvMode },
      firstStageId: first.id,
      rejectedStageId: rejected.id,
    };
  }

  private get files() {
    return this.prisma.db.orm.public.File;
  }

  /** Records an upload that has been started: pending, and attached to no Application yet. */
  async createPendingFile(input: NewPendingFile): Promise<void> {
    await this.files.create({ ...input, fieldKey: input.fieldKey ?? null });
  }

  /**
   * Creates the Application and attaches its files in one transaction. Returns 'duplicate' if this
   * person already applied to this job, and 'file_conflict' if a file can't be attached. Nothing is
   * saved in either case, so the files stay pending and can be sent again.
   */
  async submit(input: NewApplication): Promise<SubmitResult> {
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
          // Copied per application: UNIQUE (job_id, email) and (job_id, phone) reject a repeat.
          email: input.candidate.email,
          phone: input.candidate.phone,
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

        const attachedAt = new Date();
        for (const file of input.files) {
          // Conditional update (api.md, "Concurrency"): the file must be this company's and job's,
          // match the purpose and question, be unattached and still pending. Anything else updates
          // no row, and throwing rolls the whole submit back.
          const attached = await tx.orm.public.File.where({
            id: file.id,
            companyId: input.companyId,
            jobId: input.jobId,
            purpose: file.purpose,
            status: 'pending',
          })
            .where((f) => f.applicationId.isNull())
            .where((f) => (file.fieldKey === null ? f.fieldKey.isNull() : f.fieldKey.eq(file.fieldKey)))
            .update({ applicationId: application.id, status: 'uploaded', uploadedAt: attachedAt });
          if (!attached) throw new FileConflict();
        }
      });
      return 'created';
    } catch (error) {
      if (error instanceof FileConflict) {
        return 'file_conflict';
      }
      if (isUniqueViolation(error)) {
        return 'duplicate';
      }
      throw error;
    }
  }
}