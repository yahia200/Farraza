import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CV_DOCX_TYPE, CV_PDF_TYPE, type CvMode } from '@repo/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { SNIFF_BYTES } from '../storage/file-sniff.js';
import type {
  PresignedUpload,
  UploadDeclaration,
  UploadTarget,
} from '../storage/storage.js';
import type { StorageService } from '../storage/storage.service.js';
import {
  sampleDocx,
  sampleLinuxExecutable,
  samplePdf,
  sampleWindowsExecutable,
  sampleZip,
} from '../testing/sample-files.js';
import type {
  FileToVerify,
  NewApplication,
  NewPendingFile,
  OpenJob,
  SubmitResult,
} from './application.js';
import type { ApplicationsRepository } from './applications.repository.js';
import { ApplicationsService } from './applications.service.js';
import type { SubmitApplicationDto } from './dto/submit-application.dto.js';

// Same pattern as jobs.service.spec.ts: the real service, hand-written in-memory fakes for the
// repository and the storage service, assertions through the service's public methods. The fake
// repository mirrors the SQL rules that matter here (one application per email and job; a file
// attaches only if it is this job's, this purpose, unattached and pending), so these tests pin the
// service's behaviour, not the SQL. Those rules are checked against the real database by hand.

type PublicApi<T> = { [K in keyof T]: T[K] };

interface StoredFile extends NewPendingFile {
  applicationId: string | null;
  status: 'pending' | 'uploaded';
  uploadedAt: Date | null;
}

class InMemoryApplicationsRepository implements PublicApi<ApplicationsRepository> {
  private readonly jobs: OpenJob[] = [];
  private readonly files = new Map<string, StoredFile>();
  private readonly applied = new Set<string>();
  private nextApplicationId = 1;
  readonly applications: NewApplication[] = [];

  /** Test setup: an open job. Pass `open: false` for a closed one (applicants can't see it). */
  seedJob(options: { slug: string; cvMode: CvMode; open?: boolean }): OpenJob {
    const job: OpenJob = {
      company: {
        id: 'company-1',
        name: 'Acme',
        slug: 'acme',
        logoUrl: null,
        brandColor: null,
      },
      job: {
        id: `job-${options.slug}`,
        title: options.slug,
        description: null,
      },
      form: { id: `form-${options.slug}`, fields: [], cvMode: options.cvMode },
      firstStageId: 'stage-applied',
      rejectedStageId: 'stage-rejected',
    };
    if (options.open !== false) this.jobs.push(job);
    return job;
  }

  /** Test setup: a file that was uploaded for a job but not yet submitted. */
  seedPendingFile(jobId: string, id: string): void {
    this.files.set(id, {
      id,
      companyId: 'company-1',
      jobId,
      purpose: 'cv',
      storageKey: `companies/company-1/jobs/${jobId}/files/${id}`,
      originalName: 'cv.pdf',
      mimeType: CV_PDF_TYPE,
      sizeBytes: 1000,
      applicationId: null,
      status: 'pending',
      uploadedAt: null,
    });
  }

  file(id: string): StoredFile | undefined {
    const file = this.files.get(id);
    return file && { ...file };
  }

  /** The SQL's rule for a file that can still be checked, attached or removed: this job's, pending, unattached. */
  private isOpenFile(file: StoredFile, companyId: string, jobId: string) {
    return (
      file.companyId === companyId &&
      file.jobId === jobId &&
      file.status === 'pending' &&
      file.applicationId === null
    );
  }

  async findFilesToVerify(
    companyId: string,
    jobId: string,
    ids: string[],
  ): Promise<FileToVerify[]> {
    return ids.flatMap((id) => {
      const file = this.files.get(id);
      if (!file || !this.isOpenFile(file, companyId, jobId)) return [];
      return [
        {
          id: file.id,
          purpose: file.purpose,
          fieldKey: file.fieldKey ?? null,
          storageKey: file.storageKey,
          sizeBytes: file.sizeBytes,
        },
      ];
    });
  }

  async deletePendingFile(
    companyId: string,
    jobId: string,
    id: string,
  ): Promise<void> {
    const file = this.files.get(id);
    if (file && this.isOpenFile(file, companyId, jobId)) this.files.delete(id);
  }

  async findOpenJob(
    companySlug: string,
    jobSlug: string,
  ): Promise<OpenJob | null> {
    return (
      this.jobs.find(
        (j) => j.company.slug === companySlug && j.job.title === jobSlug,
      ) ?? null
    );
  }

  async createPendingFile(input: NewPendingFile): Promise<void> {
    this.files.set(input.id, {
      ...input,
      applicationId: null,
      status: 'pending',
      uploadedAt: null,
    });
  }

  async submit(input: NewApplication): Promise<SubmitResult> {
    const person = `${input.jobId}:${input.candidate.email}`;
    if (this.applied.has(person)) return 'duplicate';

    // All or nothing, like the transaction: check every file before changing anything.
    const toAttach = input.files.map((wanted) => ({
      wanted,
      file: this.files.get(wanted.id),
    }));
    for (const { wanted, file } of toAttach) {
      const attachable =
        file &&
        file.companyId === input.companyId &&
        file.jobId === input.jobId &&
        file.purpose === wanted.purpose &&
        file.status === 'pending' &&
        file.applicationId === null;
      if (!attachable) return 'file_conflict';
    }

    const applicationId = `application-${this.nextApplicationId++}`;
    for (const { wanted, file } of toAttach) {
      Object.assign(file!, {
        applicationId,
        status: 'uploaded',
        uploadedAt: new Date(),
        mimeType: wanted.mimeType,
      });
    }
    this.applied.add(person);
    this.applications.push(input);
    return 'created';
  }
}

class FakeStorage
  implements
    Pick<
      PublicApi<StorageService>,
      'createUpload' | 'headObject' | 'readLeadingBytes' | 'deleteObject'
    >
{
  readonly requests: Array<{
    target: UploadTarget;
    declared: UploadDeclaration;
  }> = [];
  /** The bucket's contents: what the browser's PUT leaves behind. */
  private readonly objects = new Map<string, Uint8Array>();
  readonly reads: Array<{ key: string; length: number }> = [];
  readonly deleted: string[] = [];
  /** Test setup: make deleting fail, as an unreachable bucket would. */
  failDeletes = false;

  /** Test setup: the browser has PUT these bytes. */
  put(key: string, bytes: Uint8Array): void {
    this.objects.set(key, bytes);
  }

  has(key: string): boolean {
    return this.objects.has(key);
  }

  async headObject(key: string) {
    const object = this.objects.get(key);
    return object ? { sizeBytes: object.length } : null;
  }

  /** Like a ranged GET: the first `length` bytes, or the whole object if it is shorter. */
  async readLeadingBytes(key: string, length: number) {
    this.reads.push({ key, length });
    return (this.objects.get(key) ?? new Uint8Array(0)).subarray(0, length);
  }

  async deleteObject(key: string) {
    if (this.failDeletes) throw new Error('bucket unreachable');
    this.deleted.push(key);
    this.objects.delete(key);
  }

  async createUpload(
    target: UploadTarget,
    declared: UploadDeclaration,
  ): Promise<PresignedUpload> {
    this.requests.push({ target, declared });
    const key = `companies/${target.companyId}/jobs/${target.jobId}/files/${target.fileId}`;
    return { key, url: `https://bucket.test/${key}?signed` };
  }
}

const applicant = (
  overrides: Partial<SubmitApplicationDto> = {},
): SubmitApplicationDto => ({
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '+201001234567',
  answers: {},
  ...overrides,
});

const pdf = {
  purpose: 'cv',
  originalName: 'cv.pdf',
  contentType: CV_PDF_TYPE,
  sizeBytes: 2048,
} as const;

const MB = 1024 * 1024;

describe('ApplicationsService', () => {
  let repository: InMemoryApplicationsRepository;
  let storage: FakeStorage;
  let service: ApplicationsService;

  beforeEach(() => {
    repository = new InMemoryApplicationsRepository();
    storage = new FakeStorage();
    // `new` rather than a Nest provider: Vitest doesn't emit decorator metadata (see jobs.service.spec.ts).
    service = new ApplicationsService(
      repository as unknown as ApplicationsRepository,
      storage as unknown as StorageService,
    );
  });

  /**
   * What the apply page does: ask for an upload declaring a size, then PUT bytes. The bucket would
   * refuse bytes of another length (the URL signs it), but a truncated or swapped object is exactly
   * what the submit-time check exists for, so `declaredSize` may differ from the bytes.
   */
  async function uploadCv(
    bytes: Uint8Array,
    options: { declaredSize?: number; contentType?: string } = {},
  ): Promise<string> {
    const { fileId } = await service.createUpload('acme', 'backend', {
      ...pdf,
      contentType: options.contentType ?? CV_PDF_TYPE,
      sizeBytes: options.declaredSize ?? bytes.length,
    });
    storage.put(repository.file(fileId)!.storageKey, bytes);
    return fileId;
  }

  describe('createUpload', () => {
    it('hands the browser a file id and a URL for exactly the file it declared', async () => {
      repository.seedJob({ slug: 'backend', cvMode: 'optional' });

      const upload = await service.createUpload('acme', 'backend', pdf);

      expect(upload.fileId).toMatch(/^[0-9a-f-]{36}$/);
      expect(upload.url).toContain(upload.fileId);
      expect(upload.contentType).toBe(CV_PDF_TYPE);
      expect(storage.requests).toEqual([
        {
          target: {
            companyId: 'company-1',
            jobId: 'job-backend',
            fileId: upload.fileId,
          },
          declared: { contentType: CV_PDF_TYPE, sizeBytes: 2048 },
        },
      ]);
    });

    it('records the file as pending, with the name the applicant gave it and no key from it', async () => {
      repository.seedJob({ slug: 'backend', cvMode: 'required' });

      const { fileId } = await service.createUpload('acme', 'backend', {
        ...pdf,
        originalName: '../../my cv (final).pdf',
      });

      expect(repository.file(fileId)).toMatchObject({
        companyId: 'company-1',
        jobId: 'job-backend',
        purpose: 'cv',
        originalName: '../../my cv (final).pdf',
        mimeType: CV_PDF_TYPE,
        sizeBytes: 2048,
        status: 'pending',
        applicationId: null,
        storageKey: `companies/company-1/jobs/job-backend/files/${fileId}`,
      });
    });

    it('accepts a DOCX and a file of exactly 5 MB', async () => {
      repository.seedJob({ slug: 'backend', cvMode: 'optional' });

      await expect(
        service.createUpload('acme', 'backend', {
          ...pdf,
          originalName: 'cv.docx',
          contentType: CV_DOCX_TYPE,
          sizeBytes: 5 * MB,
        }),
      ).resolves.toBeDefined();
    });

    it('refuses an unknown job', async () => {
      await expect(
        service.createUpload('acme', 'nope', pdf),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses a closed job', async () => {
      repository.seedJob({ slug: 'backend', cvMode: 'optional', open: false });

      await expect(
        service.createUpload('acme', 'backend', pdf),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(storage.requests).toEqual([]);
    });

    it('refuses a CV when the form does not ask for one', async () => {
      repository.seedJob({ slug: 'backend', cvMode: 'off' });

      await expect(
        service.createUpload('acme', 'backend', pdf),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(storage.requests).toEqual([]);
    });

    it('refuses a file over 5 MB, saying which property is wrong', async () => {
      repository.seedJob({ slug: 'backend', cvMode: 'optional' });

      const error = await service
        .createUpload('acme', 'backend', { ...pdf, sizeBytes: 5 * MB + 1 })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        errors: [
          { path: 'sizeBytes', message: 'Your CV must be 5 MB or smaller.' },
        ],
      });
      expect(storage.requests).toEqual([]);
    });

    it.each(['image/png', 'text/html', 'application/msword', ''])(
      'refuses the declared type %j',
      async (contentType) => {
        repository.seedJob({ slug: 'backend', cvMode: 'optional' });

        const error = await service
          .createUpload('acme', 'backend', { ...pdf, contentType })
          .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).getResponse()).toMatchObject({
          errors: [{ path: 'contentType' }],
        });
        expect(storage.requests).toEqual([]);
      },
    );
  });

  describe('submit', () => {
    it('attaches the CV in the same step as creating the Application', async () => {
      const job = repository.seedJob({ slug: 'backend', cvMode: 'optional' });
      const fileId = await uploadCv(samplePdf());

      await service.submit('acme', 'backend', applicant({ cvFileId: fileId }));

      expect(repository.applications).toHaveLength(1);
      expect(repository.file(fileId)).toMatchObject({
        jobId: job.job.id,
        status: 'uploaded',
        applicationId: expect.stringMatching(/^application-/),
        uploadedAt: expect.any(Date),
      });
    });

    it('lets an optional CV be skipped', async () => {
      repository.seedJob({ slug: 'backend', cvMode: 'optional' });

      await expect(
        service.submit('acme', 'backend', applicant()),
      ).resolves.toEqual({
        received: true,
      });
      expect(repository.applications).toHaveLength(1);
    });

    it('lets a job with no CV take applications without one', async () => {
      repository.seedJob({ slug: 'backend', cvMode: 'off' });

      await expect(
        service.submit('acme', 'backend', applicant()),
      ).resolves.toEqual({
        received: true,
      });
    });

    it('refuses a missing required CV with a field error on the CV', async () => {
      repository.seedJob({ slug: 'backend', cvMode: 'required' });

      const error = await service
        .submit('acme', 'backend', applicant())
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        errors: [{ path: 'cvFileId', message: 'Upload your CV to apply.' }],
      });
      expect(repository.applications).toHaveLength(0);
    });

    it('refuses a CV on a job that does not ask for one', async () => {
      const job = repository.seedJob({ slug: 'backend', cvMode: 'off' });
      repository.seedPendingFile(
        job.job.id,
        '11111111-1111-4111-8111-111111111111',
      );

      const error = await service
        .submit(
          'acme',
          'backend',
          applicant({ cvFileId: '11111111-1111-4111-8111-111111111111' }),
        )
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        errors: [{ path: 'cvFileId' }],
      });
      expect(
        repository.file('11111111-1111-4111-8111-111111111111')?.status,
      ).toBe('pending');
    });

    it('reports a missing CV together with problems in the answers', async () => {
      repository.seedJob({ slug: 'backend', cvMode: 'required' });

      const error = await service
        .submit(
          'acme',
          'backend',
          applicant({ answers: { 'not-a-question': 'x' } }),
        )
        .catch((e: unknown) => e);

      const { errors } = (error as BadRequestException).getResponse() as {
        errors: Array<{ path: string }>;
      };
      expect(errors.map((e) => e.path).sort()).toEqual([
        'cvFileId',
        'not-a-question',
      ]);
    });

    it('points a file conflict at the CV, so the form can ask for it again', async () => {
      repository.seedJob({ slug: 'backend', cvMode: 'optional' });

      const error = await service
        .submit(
          'acme',
          'backend',
          applicant({ cvFileId: '44444444-4444-4444-8444-444444444444' }),
        )
        .catch((e: unknown) => e);

      expect((error as ConflictException).getResponse()).toMatchObject({
        errors: [{ path: 'cvFileId' }],
      });
    });

    it("refuses another job's file with a conflict and creates no Application", async () => {
      repository.seedJob({ slug: 'backend', cvMode: 'optional' });
      const other = repository.seedJob({ slug: 'design', cvMode: 'optional' });
      repository.seedPendingFile(
        other.job.id,
        '22222222-2222-4222-8222-222222222222',
      );

      await expect(
        service.submit(
          'acme',
          'backend',
          applicant({ cvFileId: '22222222-2222-4222-8222-222222222222' }),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repository.applications).toHaveLength(0);
      expect(
        repository.file('22222222-2222-4222-8222-222222222222')?.status,
      ).toBe('pending');
    });

    it('refuses a file id that does not exist with a conflict', async () => {
      repository.seedJob({ slug: 'backend', cvMode: 'optional' });

      await expect(
        service.submit(
          'acme',
          'backend',
          applicant({ cvFileId: '33333333-3333-4333-8333-333333333333' }),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('refuses a file that already belongs to another Application', async () => {
      repository.seedJob({ slug: 'backend', cvMode: 'optional' });
      const fileId = await uploadCv(samplePdf());
      await service.submit('acme', 'backend', applicant({ cvFileId: fileId }));

      await expect(
        service.submit(
          'acme',
          'backend',
          applicant({
            email: 'grace@example.com',
            phone: '+201001234568',
            cvFileId: fileId,
          }),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repository.applications).toHaveLength(1);
      // The first Application's CV is untouched: its object was never a candidate for cleanup.
      expect(storage.deleted).toEqual([]);
      expect(repository.file(fileId)?.status).toBe('uploaded');
    });

    it('leaves the file pending when the person already applied, so a retry can reuse it', async () => {
      repository.seedJob({ slug: 'backend', cvMode: 'optional' });
      await service.submit('acme', 'backend', applicant());
      const fileId = await uploadCv(samplePdf());

      await expect(
        service.submit('acme', 'backend', applicant({ cvFileId: fileId })),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repository.file(fileId)?.status).toBe('pending');
      expect(storage.has(repository.file(fileId)!.storageKey)).toBe(true);

      await service.submit(
        'acme',
        'backend',
        applicant({
          email: 'grace@example.com',
          phone: '+201001234568',
          cvFileId: fileId,
        }),
      );
      expect(repository.file(fileId)?.status).toBe('uploaded');
    });

    it('leaves the file pending when the answers are invalid', async () => {
      repository.seedJob({ slug: 'backend', cvMode: 'optional' });
      const fileId = await uploadCv(samplePdf());

      await expect(
        service.submit(
          'acme',
          'backend',
          applicant({ cvFileId: fileId, answers: { 'not-a-question': 'x' } }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.file(fileId)?.status).toBe('pending');
      // Nothing was wrong with the file, so it is not even looked at, let alone removed.
      expect(storage.reads).toEqual([]);
      expect(storage.deleted).toEqual([]);

      await service.submit('acme', 'backend', applicant({ cvFileId: fileId }));
      expect(repository.file(fileId)?.status).toBe('uploaded');
    });

    it('does not save a bot submission or touch its file', async () => {
      repository.seedJob({ slug: 'backend', cvMode: 'optional' });
      const { fileId } = await service.createUpload('acme', 'backend', pdf);

      await service.submit(
        'acme',
        'backend',
        applicant({ cvFileId: fileId, website: 'spam.test' }),
      );

      expect(repository.applications).toHaveLength(0);
      expect(repository.file(fileId)?.status).toBe('pending');
    });
  });

  // The browser's word about a file (name, type, size) is not trusted: at submit the bucket object
  // is checked against what was declared and against its own leading bytes (ticket 04).
  describe('submit: checking the uploaded file', () => {
    const DOCX =
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    /** Submits and returns what the applicant is told, as the Nest exception it becomes. */
    async function submitRefused(fileId: string) {
      const error = await service
        .submit('acme', 'backend', applicant({ cvFileId: fileId }))
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(BadRequestException);
      return (error as BadRequestException).getResponse() as {
        errors: Array<{ path: string; message: string }>;
      };
    }

    /** The refusal every failed check ends in: gone from the bucket, gone from the table, no Application. */
    function expectRemoved(fileId: string, storageKey: string) {
      expect(repository.file(fileId)).toBeUndefined();
      expect(storage.has(storageKey)).toBe(false);
      expect(storage.deleted).toEqual([storageKey]);
      expect(repository.applications).toHaveLength(0);
    }

    beforeEach(() => {
      repository.seedJob({ slug: 'backend', cvMode: 'optional' });
    });

    it('stores the type found in the bytes, not the one the browser declared', async () => {
      // Declared (and named) as a PDF, but the bytes are a real DOCX: both are allowed, and the row says what it is.
      const fileId = await uploadCv(sampleDocx(), { contentType: CV_PDF_TYPE });

      await service.submit('acme', 'backend', applicant({ cvFileId: fileId }));

      expect(repository.file(fileId)).toMatchObject({
        status: 'uploaded',
        mimeType: DOCX,
        originalName: 'cv.pdf',
      });
    });

    it('accepts a real PDF and records its type', async () => {
      const fileId = await uploadCv(samplePdf());

      await service.submit('acme', 'backend', applicant({ cvFileId: fileId }));

      expect(repository.file(fileId)).toMatchObject({
        status: 'uploaded',
        mimeType: CV_PDF_TYPE,
      });
    });

    it('recognises a big DOCX after reading only its first bytes', async () => {
      const docx = sampleDocx({ extraBytes: 4 * SNIFF_BYTES });
      const fileId = await uploadCv(docx, { contentType: DOCX });

      await service.submit('acme', 'backend', applicant({ cvFileId: fileId }));

      expect(repository.file(fileId)?.mimeType).toBe(DOCX);
      expect(storage.reads).toEqual([
        { key: repository.file(fileId)!.storageKey, length: SNIFF_BYTES },
      ]);
    });

    it.each([
      ['a Windows program', sampleWindowsExecutable],
      ['a Linux program', sampleLinuxExecutable],
      ['a zip that is not a Word document', sampleZip],
      ['plain text', () => Buffer.from('I am definitely a PDF, trust me.')],
    ])(
      'refuses %s renamed to cv.pdf, with a field error on the CV',
      async (_name, make) => {
        const fileId = await uploadCv(make());
        const storageKey = repository.file(fileId)!.storageKey;

        const { errors } = await submitRefused(fileId);

        expect(errors).toEqual([
          {
            path: 'cvFileId',
            message: expect.stringContaining('PDF or DOCX'),
          },
        ]);
        expectRemoved(fileId, storageKey);
      },
    );

    it('refuses an object cut short, declared at its full size', async () => {
      const pdfBytes = samplePdf();
      const fileId = await uploadCv(pdfBytes.subarray(0, pdfBytes.length - 20), {
        declaredSize: pdfBytes.length,
      });
      const storageKey = repository.file(fileId)!.storageKey;

      const { errors } = await submitRefused(fileId);

      expect(errors).toEqual([
        { path: 'cvFileId', message: expect.stringContaining('upload') },
      ]);
      expectRemoved(fileId, storageKey);
    });

    it('refuses an object bigger than declared, though its bytes are a real PDF', async () => {
      const pdfBytes = samplePdf();
      const fileId = await uploadCv(pdfBytes, {
        declaredSize: pdfBytes.length - 1,
      });
      const storageKey = repository.file(fileId)!.storageKey;

      await submitRefused(fileId);

      expectRemoved(fileId, storageKey);
    });

    it('refuses an upload that never reached the bucket', async () => {
      const { fileId } = await service.createUpload('acme', 'backend', pdf);
      const storageKey = repository.file(fileId)!.storageKey;

      const { errors } = await submitRefused(fileId);

      expect(errors[0]).toMatchObject({ path: 'cvFileId' });
      expect(repository.file(fileId)).toBeUndefined();
      expect(storage.reads).toEqual([]);
      expect(repository.applications).toHaveLength(0);
      expect(storage.has(storageKey)).toBe(false);
    });

    it('refuses a required CV that fails the check, so no Application is made without one', async () => {
      repository.seedJob({ slug: 'strict', cvMode: 'required' });
      const { fileId } = await service.createUpload('acme', 'strict', pdf);
      storage.put(repository.file(fileId)!.storageKey, sampleWindowsExecutable());

      await expect(
        service.submit('acme', 'strict', applicant({ cvFileId: fileId })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.applications).toHaveLength(0);
    });

    it('lets the applicant upload again and apply after a refusal', async () => {
      const bad = await uploadCv(sampleWindowsExecutable());
      await submitRefused(bad);

      const good = await uploadCv(samplePdf());
      await service.submit('acme', 'backend', applicant({ cvFileId: good }));

      expect(repository.applications).toHaveLength(1);
      expect(repository.file(good)?.status).toBe('uploaded');
    });

    it('still tells the applicant when the bucket cannot delete, and keeps the row so it can be found later', async () => {
      const fileId = await uploadCv(sampleWindowsExecutable());
      storage.failDeletes = true;

      const { errors } = await submitRefused(fileId);

      expect(errors[0]).toMatchObject({ path: 'cvFileId' });
      expect(repository.file(fileId)).toMatchObject({ status: 'pending' });
    });
  });

  describe('getPublicJob', () => {
    it('carries the CV setting and never an upload URL', async () => {
      repository.seedJob({ slug: 'backend', cvMode: 'required' });

      const job = await service.getPublicJob('acme', 'backend');

      expect(job.cvMode).toBe('required');
      expect(JSON.stringify(job)).not.toContain('signed');
    });
  });
});
