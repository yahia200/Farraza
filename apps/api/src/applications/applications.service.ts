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
  allowedContentTypes,
  checkAttachmentFile,
  checkCvFile,
  fileFormatPhrase,
  findKnockout,
  isMediaContentType,
  matchAllowedType,
  parseAnswers,
  publicBrandingSchema,
  publicCompanyJobsSchema,
  toPublicFields,
  type Answers,
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

  /**
   * The company's branding and its open jobs, for the public listing at
   * /{companySlug}. A company that doesn't exist is a 404 (same as a missing
   * job on the apply page); a company with no open jobs is a 200 with an empty
   * list, so the page can say "no openings". Parsing through the shared schema
   * is the public projection: only the listed fields leave the API.
   */
  async listCompanyJobs(companySlug: string) {
    const found = await this.applications.listCompanyOpenJobs(companySlug);
    if (!found) {
      throw new NotFoundException();
    }
    return publicCompanyJobsSchema.parse(found);
  }

  /**
   * A company's branding for the public layout: a 404 when the company doesn't
   * exist (like the listing). Parsing through the shared schema is the public
   * projection — only the branding fields leave the API.
   */
  async getCompanyBranding(companySlug: string) {
    const found = await this.applications.findCompanyBranding(companySlug);
    if (!found) {
      throw new NotFoundException();
    }
    return publicBrandingSchema.parse(found);
  }

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

    // What to pin on the presigned URL and record on the row, and, for video and audio, the length
    // the browser read from the file. Both are decided by the form version, not taken as sent.
    let contentType = dto.contentType;
    let durationSeconds: number | null = null;

    if (dto.purpose === 'cv') {
      if (found.form.cvMode === 'off') {
        throw fieldErrors([
          { path: 'purpose', message: "This job doesn't ask for a CV." },
        ]);
      }
      const problem = checkCvFile(dto);
      if (problem) {
        throw fieldErrors([problem]);
      }
    } else {
      // The question's own limits decide, from the form version applicants are looking at.
      const question = found.form.fields.find((field) => field.key === dto.fieldKey);
      if (question?.type !== 'file') {
        throw fieldErrors([
          {
            path: 'fieldKey',
            message: 'This question is no longer on the form. Reload the page and try again.',
          },
        ]);
      }
      const problem = checkAttachmentFile(question.config, dto);
      if (problem) {
        throw fieldErrors([problem]);
      }
      // The check passed, so the declared type stands for one of the question's types. Use that one
      // (`audio/x-m4a` is `audio/mp4`; a WebM declared as video is audio in an audio question).
      contentType =
        matchAllowedType(allowedContentTypes(question.config.kinds), dto.contentType) ?? dto.contentType;
      // The server does not re-measure the length; it keeps what the browser declared, which the
      // check above required and compared with the limit. A document has no length.
      if (isMediaContentType(contentType)) durationSeconds = dto.durationSeconds ?? null;
    }

    const fileId = randomUUID();
    const target = { companyId: found.company.id, jobId: found.job.id, fileId };
    const { key, url } = await this.storage.createUpload(target, {
      contentType,
      sizeBytes: dto.sizeBytes,
    });
    await this.applications.createPendingFile({
      id: fileId,
      companyId: found.company.id,
      jobId: found.job.id,
      purpose: dto.purpose,
      fieldKey: dto.purpose === 'answer' ? dto.fieldKey : null,
      storageKey: key,
      originalName: dto.originalName,
      mimeType: contentType,
      sizeBytes: dto.sizeBytes,
      durationSeconds,
    });
    return { fileId, url, contentType };
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
    // A copy: the CV checks below push onto it, and the parser's own array must stay as it was.
    const errors: FieldError[] = parsed.ok ? [] : [...parsed.errors];
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
    const wanted = wantedFiles(found, dto, parsed.answers);
    const files = await this.verifyFiles(found, wanted);

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
    if (typeof result === 'object') {
      throw fileConflict(wanted.find((file) => file.id === result.fileId));
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
  private async verifyFiles(found: OpenJob, wanted: WantedFile[]): Promise<FileToAttach[]> {
    if (wanted.length === 0) return [];
    const rows = await this.applications.findFilesToVerify(
      found.company.id,
      found.job.id,
      wanted.map((file) => file.id),
    );

    const verified: FileToAttach[] = [];
    const errors: FieldError[] = [];
    for (const file of wanted) {
      // The row must have been uploaded for exactly this slot: the CV, or this very question. This is
      // what stops a file uploaded for one question (or as the CV) being used as another's answer.
      const row = rows.find(
        (candidate) =>
          candidate.id === file.id &&
          candidate.purpose === file.purpose &&
          candidate.fieldKey === file.fieldKey,
      );
      if (!row) throw fileConflict(file);

      const outcome = await this.checkObject(row, file);
      if ('mimeType' in outcome) {
        verified.push({
          id: file.id,
          purpose: file.purpose,
          fieldKey: file.fieldKey,
          mimeType: outcome.mimeType,
        });
        continue;
      }
      await this.discard(found, row);
      errors.push({ path: pathOf(file), message: outcome.message });
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
    wanted: WantedFile,
  ): Promise<{ mimeType: string } | { message: string }> {
    const head = await this.storage.headObject(row.storageKey);
    if (!head || head.sizeBytes !== row.sizeBytes) {
      return {
        message:
          wanted.purpose === 'cv'
            ? UPLOAD_INCOMPLETE_CV
            : UPLOAD_INCOMPLETE_ATTACHMENT,
      };
    }
    const bytes = await this.storage.readLeadingBytes(row.storageKey, SNIFF_BYTES);
    // `file-type` answers `video/webm` for any WebM and `audio/x-m4a` for an M4A, so the allowed
    // type it stands for is what gets stored (`matchAllowedType`).
    const sniffed = await sniffFileType(bytes);
    const mimeType = sniffed === null ? null : matchAllowedType(wanted.allowedTypes, sniffed);
    if (mimeType === null) {
      return {
        message:
          wanted.purpose === 'cv'
            ? NOT_THE_CLAIMED_TYPE_CV
            : `That file isn't really the kind it claims to be. Upload ${wanted.formats}.`,
      };
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

const UPLOAD_INCOMPLETE_CV = "Your CV didn't finish uploading. Upload it again.";
const UPLOAD_INCOMPLETE_ATTACHMENT = "Your file didn't finish uploading. Upload it again.";
const NOT_THE_CLAIMED_TYPE_CV =
  "That file isn't really a PDF or DOCX. Upload your CV as a PDF or DOCX file.";

/**
 * A file a submit refers to, and what it must turn out to be. Built from the form version, so the
 * rules are the ones the applicant was shown: the CV's fixed ones, or the question's own.
 */
interface WantedFile extends Omit<FileToAttach, 'mimeType'> {
  /** The types the bytes may turn out to be. */
  allowedTypes: readonly string[];
  /** The same, for messages: "a PDF or DOCX file". */
  formats: string;
}

/**
 * The files this submit refers to: the CV, and the answer of every file question. Only answers that
 * passed `parseAnswers()` are looked at, so each is a well-formed id; whether it is a usable file
 * is decided by `verifyFiles()` and the attach.
 */
function wantedFiles(found: OpenJob, dto: SubmitApplicationDto, answers: Answers): WantedFile[] {
  const wanted: WantedFile[] = [];
  if (dto.cvFileId) {
    wanted.push({
      id: dto.cvFileId,
      purpose: 'cv',
      fieldKey: null,
      allowedTypes: CV_CONTENT_TYPES,
      formats: 'a PDF or DOCX file',
    });
  }
  for (const field of found.form.fields) {
    const answer = answers[field.key];
    if (field.type === 'file' && typeof answer === 'string') {
      wanted.push({
        id: answer,
        purpose: 'answer',
        fieldKey: field.key,
        allowedTypes: allowedContentTypes(field.config.kinds),
        formats: fileFormatPhrase(field.config.kinds),
      });
    }
  }
  return wanted;
}

/** Where the applicant's form shows an error about this file: the CV's step, or the question's. */
function pathOf(file: Pick<WantedFile, 'fieldKey'>): string {
  return file.fieldKey ?? 'cvFileId';
}

/**
 * 409 for a file that can't be used at all; `errors` lets the apply form put it on the step the
 * file belongs to, as for 400s.
 */
function fileConflict(file: WantedFile | undefined): ConflictException {
  const message =
    file?.purpose === 'answer'
      ? "Your file couldn't be attached to this application. Upload it again and resubmit."
      : "Your CV couldn't be attached to this application. Upload it again and resubmit.";
  return new ConflictException({ message, errors: [{ path: file ? pathOf(file) : 'cvFileId', message }] });
}

/** 400 in the same `{ message, errors }` shape as validation failures (common/validation-errors.ts). */
function fieldErrors(errors: FieldError[]): BadRequestException {
  return new BadRequestException({ message: 'Some fields need attention.', errors });
}
