import { Injectable } from '@nestjs/common';
import type { FormFields } from '@repo/shared';
import { isUniqueViolation } from '../common/db-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  FileToVerify,
  NewApplication,
  NewPendingFile,
  OpenJob,
  SubmitResult,
} from './application.js';

/** Thrown inside the submit transaction to roll it back when a file can't be attached. */
class FileConflict extends Error {
  constructor(readonly fileId: string) {
    super(`File ${fileId} could not be attached`);
  }
}

/** Maps a `files` row to the plain type the service works with (api.md, "Repository"). */
function toFileToVerify(row: {
  id: string;
  purpose: 'cv' | 'answer';
  fieldKey: string | null;
  storageKey: string;
  sizeBytes: number;
}): FileToVerify {
  return {
    id: row.id,
    purpose: row.purpose,
    fieldKey: row.fieldKey,
    storageKey: row.storageKey,
    sizeBytes: row.sizeBytes,
  };
}

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
   * The rows among `ids` that a submit to this job may still use: this company's and job's, pending
   * and unattached (the same conditions the attach update demands). Others are simply absent, so a
   * missing, foreign, or already-attached id looks identical to the caller.
   */
  async findFilesToVerify(
    companyId: string,
    jobId: string,
    ids: string[],
  ): Promise<FileToVerify[]> {
    if (ids.length === 0) return [];
    const rows = await this.files
      .where({ companyId, jobId, status: 'pending' })
      .where((f) => f.applicationId.isNull())
      .where((f) => f.id.in(ids))
      .all();
    return rows.map(toFileToVerify);
  }

  /**
   * Removes a file row that failed its check. Conditional like every write here: only if it is still
   * pending and unattached, so a concurrent submit that attached it first is never undone.
   */
  async deletePendingFile(
    companyId: string,
    jobId: string,
    id: string,
  ): Promise<void> {
    await this.files
      .where({ id, companyId, jobId, status: 'pending' })
      .where((f) => f.applicationId.isNull())
      .deleteAndCount();
  }

  /**
   * Creates the Application and attaches its files in one transaction. Returns 'duplicate' if this
   * person already applied to this job, and a `file_conflict` (naming the file) if a file can't be
   * attached. Nothing is saved in either case, so the files stay pending and can be sent again.
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
            // The type is the one found in the bytes at the check, replacing the declared one.
            .update({
              applicationId: application.id,
              status: 'uploaded',
              uploadedAt: attachedAt,
              mimeType: file.mimeType,
            });
          if (!attached) throw new FileConflict(file.id);
        }
      });
      return 'created';
    } catch (error) {
      if (error instanceof FileConflict) {
        return { status: 'file_conflict', fileId: error.fileId };
      }
      if (isUniqueViolation(error)) {
        return 'duplicate';
      }
      throw error;
    }
  }
}