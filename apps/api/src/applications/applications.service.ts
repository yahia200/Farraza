import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CV_CONTENT_TYPES,
  checkCvFile,
  findKnockout,
  parseAnswers,
  toPublicFields,
  type FieldError,
} from '@repo/shared';
import { SNIFF_BYTES, sniffFileType } from '../storage/file-sniff.js';
import { StorageService } from '../storage/storage.service.js';
import type { FileToAttach, FileToVerify, OpenJob } from './application.js';
import { ApplicationsRepository } from './applications.repository.js';
import type { CreateUploadDto } from './dto/create-upload.dto.js';
import type { SubmitApplicationDto } from './dto/submit-application.dto.js';

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

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

    // The cheap checks passed; now look at the uploaded objects themselves, before the transaction.
    const files = await this.verifyFiles(
      found,
      dto.cvFileId ? [{ id: dto.cvFileId, purpose: 'cv', fieldKey: null }] : [],
    );

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
      throw fileConflict();
    }
    return { received: true };
  }

  /**
   * Checks every file the submit refers to against the bucket, before the Application exists, and
   * returns them ready to attach with the type found in their bytes.
   *
   * A file that isn't a candidate at all (unknown id, another job's, already attached) is a
   * conflict, as when the attach itself refuses it. A file that is, but whose object is missing,
   * the wrong size or the wrong kind of file, is deleted from the bucket and its row removed, and
   * the applicant gets a 400 field error. Only failures of these checks delete anything: a
   * duplicate Application or invalid answers never reach here, so those files stay pending.
   */
  private async verifyFiles(
    found: OpenJob,
    wanted: Array<Omit<FileToAttach, 'mimeType'>>,
  ): Promise<FileToAttach[]> {
    if (wanted.length === 0) return [];
    const rows = await this.applications.findFilesToVerify(
      found.company.id,
      found.job.id,
      wanted.map((file) => file.id),
    );

    const verified: FileToAttach[] = [];
    const errors: FieldError[] = [];
    for (const file of wanted) {
      const row = rows.find(
        (candidate) =>
          candidate.id === file.id &&
          candidate.purpose === file.purpose &&
          candidate.fieldKey === file.fieldKey,
      );
      if (!row) throw fileConflict();

      // Only the CV can be submitted today; a file question brings its own list of allowed types.
      const outcome = await this.checkObject(row, CV_CONTENT_TYPES);
      if ('mimeType' in outcome) {
        verified.push({ ...file, mimeType: outcome.mimeType });
        continue;
      }
      await this.discard(found, row);
      errors.push({ path: file.fieldKey ?? 'cvFileId', message: outcome.message });
    }

    if (errors.length > 0) {
      throw new BadRequestException({ message: 'Some answers need attention.', errors });
    }
    return verified;
  }

  /**
   * Looks at the object the browser PUT: it must exist, have exactly the declared size (which the
   * presigned URL already pinned, so a difference means a truncated or swapped object), and its
   * leading bytes must be one of the allowed formats. Returns the sniffed type or a message.
   */
  private async checkObject(
    row: FileToVerify,
    allowedTypes: readonly string[],
  ): Promise<{ mimeType: string } | { message: string }> {
    const head = await this.storage.headObject(row.storageKey);
    if (!head || head.sizeBytes !== row.sizeBytes) {
      return { message: UPLOAD_INCOMPLETE };
    }
    const bytes = await this.storage.readLeadingBytes(row.storageKey, SNIFF_BYTES);
    const mimeType = await sniffFileType(bytes);
    if (!mimeType || !allowedTypes.includes(mimeType)) {
      return { message: NOT_THE_CLAIMED_TYPE };
    }
    return { mimeType };
  }

  /**
   * Deletes a refused file's object, then its row. The object goes first: a row left behind points
   * at the object and a future cleanup job (docs/db-schema.md, §9) can find it by status, whereas an
   * object whose row was deleted first would be invisible to it. If the bucket can't delete, the row
   * stays and the failure is logged; the applicant is told about the file either way.
   */
  private async discard(found: OpenJob, row: FileToVerify): Promise<void> {
    try {
      await this.storage.deleteObject(row.storageKey);
    } catch (error) {
      this.logger.warn(
        `Could not delete refused upload ${row.storageKey}: ${error instanceof Error ? error.message : error}`,
      );
      return;
    }
    await this.applications.deletePendingFile(found.company.id, found.job.id, row.id);
  }
}

const UPLOAD_INCOMPLETE = "Your CV didn't finish uploading. Upload it again.";
const NOT_THE_CLAIMED_TYPE =
  "That file isn't really a PDF or DOCX. Upload your CV as a PDF or DOCX file.";

/** 409 for a file that can't be used at all; `errors` lets the apply form put it on the CV step, as for 400s. */
function fileConflict(): ConflictException {
  const message = "Your CV couldn't be attached to this application. Upload it again and resubmit.";
  return new ConflictException({ message, errors: [{ path: 'cvFileId', message }] });
}

/** 400 in the same `{ message, errors }` shape as validation failures (common/validation-errors.ts). */
function fieldErrors(errors: FieldError[]): BadRequestException {
  return new BadRequestException({ message: 'Some fields need attention.', errors });
}
