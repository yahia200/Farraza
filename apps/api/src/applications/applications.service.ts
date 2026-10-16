import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  checkCvFile,
  findKnockout,
  parseAnswers,
  toPublicFields,
  type FieldError,
} from '@repo/shared';
import { StorageService } from '../storage/storage.service.js';
import type { FileToAttach } from './application.js';
import { ApplicationsRepository } from './applications.repository.js';
import type { CreateUploadDto } from './dto/create-upload.dto.js';
import type { SubmitApplicationDto } from './dto/submit-application.dto.js';

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly applications: ApplicationsRepository,
    private readonly storage: StorageService,
  ) {}

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
      cvMode: found.form.cvMode,
      fields: toPublicFields(found.form.fields),
    };
  }

  /**
   * Starts an upload: checks the declared file against the open job's published form, records a
   * pending `files` row and returns a presigned PUT for exactly that file. The browser later sends
   * the returned file id with the submit. Nothing here is cached or shared between visitors.
   */
  async createUpload(companySlug: string, jobSlug: string, dto: CreateUploadDto) {
    const found = await this.applications.findOpenJob(companySlug, jobSlug);
    if (!found) {
      throw new NotFoundException();
    }

    if (found.form.cvMode === 'off') {
      throw fieldErrors([
        { path: 'purpose', message: "This job doesn't ask for a CV." },
      ]);
    }
    const problem = checkCvFile(dto);
    if (problem) {
      throw fieldErrors([problem]);
    }

    const fileId = randomUUID();
    const target = { companyId: found.company.id, jobId: found.job.id, fileId };
    const { key, url } = await this.storage.createUpload(target, {
      contentType: dto.contentType,
      sizeBytes: dto.sizeBytes,
    });
    await this.applications.createPendingFile({
      id: fileId,
      companyId: found.company.id,
      jobId: found.job.id,
      purpose: 'cv',
      storageKey: key,
      originalName: dto.originalName,
      mimeType: dto.contentType,
      sizeBytes: dto.sizeBytes,
    });
    return { fileId, url, contentType: dto.contentType };
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
    const errors: FieldError[] = parsed.ok ? [] : parsed.errors;
    // The form version says whether a CV is asked for; the id's validity is checked when attaching.
    const { cvMode } = found.form;
    if (cvMode === 'off' && dto.cvFileId) {
      errors.push({ path: 'cvFileId', message: "This job doesn't ask for a CV." });
    } else if (cvMode === 'required' && !dto.cvFileId) {
      errors.push({ path: 'cvFileId', message: 'Upload your CV to apply.' });
    }
    if (!parsed.ok || errors.length > 0) {
      throw new BadRequestException({ message: 'Some answers need attention.', errors });
    }

    const knockout = findKnockout(found.form.fields, parsed.answers);
    const source = dto.source ?? null;
    const files: FileToAttach[] = dto.cvFileId
      ? [{ id: dto.cvFileId, purpose: 'cv', fieldKey: null }]
      : [];

    const result = await this.applications.submit({
      companyId: found.company.id,
      jobId: found.job.id,
      formVersionId: found.form.id,
      stageId: knockout ? found.rejectedStageId : found.firstStageId,
      status: knockout ? 'rejected' : 'active',
      candidate: { email: dto.email, name: dto.name.trim(), phone: dto.phone.trim() },
      answers: parsed.answers,
      files,
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
      throw new ConflictException("You've already applied for this job.");
    }
    if (result === 'file_conflict') {
      // `errors` lets the apply form put the message on the CV step, as it does for 400s.
      const message = "Your CV couldn't be attached to this application. Upload it again and resubmit.";
      throw new ConflictException({ message, errors: [{ path: 'cvFileId', message }] });
    }
    return { received: true };
  }
}

/** 400 in the same `{ message, errors }` shape as validation failures (common/validation-errors.ts). */
function fieldErrors(errors: FieldError[]): BadRequestException {
  return new BadRequestException({ message: 'Some fields need attention.', errors });
}
