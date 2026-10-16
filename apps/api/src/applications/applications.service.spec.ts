import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CV_DOCX_TYPE, CV_PDF_TYPE, type CvMode, type FormFields } from '@repo/shared';
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
  sampleJpeg,
  sampleLinuxExecutable,
  samplePdf,
  samplePng,
  sampleSvg,
  sampleWebp,
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
  /** Test setup: a file whose attach loses a race (another submit takes it between the check and the attach). */
  raceOnFile: string | null = null;

  /** Test setup: an open job. Pass `open: false` for a closed one (applicants can't see it). */
  seedJob(options: {
    slug: string;
    cvMode: CvMode;
    open?: boolean;
    fields?: FormFields;
  }): OpenJob {
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
      form: {
        id: `form-${options.slug}`,
        fields: options.fields ?? [],
        cvMode: options.cvMode,
      },
      firstStageId: 'stage-applied',
      rejectedStageId: 'stage-rejected',
    };
    if (options.open !== false) this.jobs.push(job);
    return job;
  }

  /** Test setup: a file that was uploaded for a job but not yet submitted. */
  seedPendingFile(
    jobId: string,
    id: string,
    options: { fieldKey?: string } = {},
  ): void {
    this.files.set(id, {
      id,
      companyId: 'company-1',
      jobId,
      purpose: options.fieldKey ? 'answer' : 'cv',
      fieldKey: options.fieldKey ?? null,
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
        (file.fieldKey ?? null) === wanted.fieldKey &&
        file.status === 'pending' &&
        file.applicationId === null &&
        wanted.id !== this.raceOnFile;
      if (!attachable) return { status: 'file_conflict', fileId: wanted.id };
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

  // File questions (Attachments): the answer to the question is the file's id, and the question's
  // own limits decide what may be uploaded for it.
  describe('Attachments', () => {
    const SAMPLE = 'a1111111-1111-4111-8111-111111111111'; // required: documents and images, 2 MB
    const PHOTO = 'b2222222-2222-4222-8222-222222222222'; // optional: images only, 1 MB
    const ABOUT = 'c3333333-3333-4333-8333-333333333333'; // not a file question
    const fields: FormFields = [
      {
        key: SAMPLE,
        type: 'file',
        label: 'Work sample',
        helpText: null,
        required: true,
        config: { kinds: ['document', 'image'], maxSizeMb: 2, maxDurationSeconds: null },
      },
      {
        key: PHOTO,
        type: 'file',
        label: 'Photo',
        helpText: null,
        required: false,
        config: { kinds: ['image'], maxSizeMb: 1, maxDurationSeconds: null },
      },
      {
        key: ABOUT,
        type: 'short_text',
        label: 'About you',
        helpText: null,
        required: false,
        config: { maxLength: 100 },
      },
    ];

    const image = (fieldKey: string, overrides: Record<string, unknown> = {}) =>
      ({
        purpose: 'answer',
        fieldKey,
        originalName: 'work.png',
        contentType: 'image/png',
        sizeBytes: 2048,
        ...overrides,
      }) as Parameters<ApplicationsService['createUpload']>[2];

    /** What the apply page does for a file question: ask for an upload, then PUT the bytes. */
    async function uploadAttachment(
      fieldKey: string,
      bytes: Uint8Array,
      options: {
        slug?: string;
        contentType?: string;
        name?: string;
        declaredSize?: number;
      } = {},
    ): Promise<string> {
      const { fileId } = await service.createUpload(
        'acme',
        options.slug ?? 'backend',
        image(fieldKey, {
          contentType: options.contentType ?? 'image/png',
          originalName: options.name ?? 'work.png',
          sizeBytes: options.declaredSize ?? bytes.length,
        }),
      );
      storage.put(repository.file(fileId)!.storageKey, bytes);
      return fileId;
    }

    async function createUploadError(slug: string, dto: Parameters<ApplicationsService['createUpload']>[2]) {
      const error = await service.createUpload('acme', slug, dto).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(BadRequestException);
      expect(storage.requests).toEqual([]);
      return (error as BadRequestException).getResponse() as {
        errors: Array<{ path: string; message: string }>;
      };
    }

    beforeEach(() => {
      repository.seedJob({ slug: 'backend', cvMode: 'off', fields });
    });

    describe('createUpload', () => {
      it('hands the browser a file id and a URL for the file it declared, for that question', async () => {
        const upload = await service.createUpload('acme', 'backend', image(SAMPLE));

        expect(upload.contentType).toBe('image/png');
        expect(storage.requests).toEqual([
          {
            target: { companyId: 'company-1', jobId: 'job-backend', fileId: upload.fileId },
            declared: { contentType: 'image/png', sizeBytes: 2048 },
          },
        ]);
        expect(repository.file(upload.fileId)).toMatchObject({
          purpose: 'answer',
          fieldKey: SAMPLE,
          originalName: 'work.png',
          status: 'pending',
          applicationId: null,
          storageKey: `companies/company-1/jobs/job-backend/files/${upload.fileId}`,
        });
      });

      it('works when the form does not ask for a CV', async () => {
        await expect(service.createUpload('acme', 'backend', image(SAMPLE))).resolves.toBeDefined();
      });

      it.each([
        ['a PDF', 'application/pdf'],
        ['a DOCX', CV_DOCX_TYPE],
        ['a JPEG', 'image/jpeg'],
        ['a WebP', 'image/webp'],
      ])('accepts %s where documents and images are allowed', async (_name, contentType) => {
        await expect(service.createUpload('acme', 'backend', image(SAMPLE, { contentType }))).resolves.toBeDefined();
      });

      it('accepts a file of exactly the limit', async () => {
        await expect(
          service.createUpload('acme', 'backend', image(SAMPLE, { sizeBytes: 2 * MB })),
        ).resolves.toBeDefined();
      });

      it('refuses a file over the question limit, saying which property is wrong', async () => {
        const { errors } = await createUploadError('backend', image(SAMPLE, { sizeBytes: 2 * MB + 1 }));

        expect(errors).toEqual([{ path: 'sizeBytes', message: 'This file must be 2 MB or smaller.' }]);
      });

      it('uses the limit of the question it is for, not another one', async () => {
        const { errors } = await createUploadError('backend', image(PHOTO, { sizeBytes: 1 * MB + 1 }));

        expect(errors[0]).toMatchObject({ path: 'sizeBytes', message: 'This file must be 1 MB or smaller.' });
      });

      it.each(['video/mp4', 'audio/mpeg', 'image/svg+xml', 'image/gif', 'text/html', ''])(
        'refuses the declared type %j',
        async (contentType) => {
          const { errors } = await createUploadError('backend', image(SAMPLE, { contentType }));

          expect(errors).toMatchObject([{ path: 'contentType' }]);
        },
      );

      it('refuses a type the question does not accept, though another question does', async () => {
        const { errors } = await createUploadError('backend', image(PHOTO, { contentType: 'application/pdf' }));

        expect(errors).toEqual([{ path: 'contentType', message: 'Upload a JPEG, PNG or WebP file.' }]);
      });

      it('refuses an empty file', async () => {
        const { errors } = await createUploadError('backend', image(SAMPLE, { sizeBytes: 0 }));

        expect(errors).toMatchObject([{ path: 'sizeBytes' }]);
      });

      it.each([
        ['a question that is not on the form', 'd4444444-4444-4444-8444-444444444444'],
        ['a question that is not a file question', ABOUT],
      ])('refuses %s', async (_name, fieldKey) => {
        const { errors } = await createUploadError('backend', image(fieldKey));

        expect(errors).toMatchObject([{ path: 'fieldKey' }]);
      });

      it("refuses another job's question", async () => {
        repository.seedJob({ slug: 'design', cvMode: 'off', fields: [] });

        const { errors } = await createUploadError('design', image(SAMPLE));

        expect(errors).toMatchObject([{ path: 'fieldKey' }]);
      });

      it('refuses a closed job', async () => {
        repository.seedJob({ slug: 'closed', cvMode: 'off', open: false, fields });

        await expect(service.createUpload('acme', 'closed', image(SAMPLE))).rejects.toBeInstanceOf(NotFoundException);
        expect(storage.requests).toEqual([]);
      });
    });

    describe('submit', () => {
      it('attaches the file to the Application and stores the file id as the answer', async () => {
        const fileId = await uploadAttachment(SAMPLE, samplePng());

        await service.submit('acme', 'backend', applicant({ answers: { [SAMPLE]: fileId } }));

        expect(repository.applications).toHaveLength(1);
        expect(repository.applications[0]).toMatchObject({
          answers: { [SAMPLE]: fileId },
          files: [{ id: fileId, purpose: 'answer', fieldKey: SAMPLE, mimeType: 'image/png' }],
        });
        expect(repository.file(fileId)).toMatchObject({
          status: 'uploaded',
          applicationId: expect.stringMatching(/^application-/),
          fieldKey: SAMPLE,
          mimeType: 'image/png',
        });
      });

      it('attaches an Attachment and the CV together', async () => {
        repository.seedJob({ slug: 'both', cvMode: 'required', fields });
        const cvBytes = samplePdf();
        const { fileId: cv } = await service.createUpload('acme', 'both', { ...pdf, sizeBytes: cvBytes.length });
        storage.put(repository.file(cv)!.storageKey, cvBytes);
        const sample = await uploadAttachment(SAMPLE, samplePng(), { slug: 'both' });

        await service.submit('acme', 'both', applicant({ cvFileId: cv, answers: { [SAMPLE]: sample } }));

        expect(repository.file(cv)).toMatchObject({ status: 'uploaded', purpose: 'cv', fieldKey: null });
        expect(repository.file(sample)).toMatchObject({ status: 'uploaded', purpose: 'answer', fieldKey: SAMPLE });
      });

      it('records the type found in the bytes, whatever the browser declared', async () => {
        // Declared as a PNG, but the bytes are a real JPEG.
        const fileId = await uploadAttachment(SAMPLE, sampleJpeg(), { contentType: 'image/png' });

        await service.submit('acme', 'backend', applicant({ answers: { [SAMPLE]: fileId } }));

        expect(repository.file(fileId)?.mimeType).toBe('image/jpeg');
      });

      it.each([
        ['a JPEG', sampleJpeg, 'image/jpeg'],
        ['a WebP', sampleWebp, 'image/webp'],
        ['a PDF', samplePdf, 'application/pdf'],
        ['a DOCX', sampleDocx, CV_DOCX_TYPE],
      ])('accepts %s where documents and images are allowed', async (_name, make, mimeType) => {
        const fileId = await uploadAttachment(SAMPLE, make(), { contentType: mimeType });

        await service.submit('acme', 'backend', applicant({ answers: { [SAMPLE]: fileId } }));

        expect(repository.file(fileId)).toMatchObject({ status: 'uploaded', mimeType });
      });

      describe('required and optional questions', () => {
        it('refuses a missing required file with a field error on the question', async () => {
          const error = await service.submit('acme', 'backend', applicant()).catch((e: unknown) => e);

          expect(error).toBeInstanceOf(BadRequestException);
          expect((error as BadRequestException).getResponse()).toMatchObject({
            errors: [{ path: SAMPLE, message: 'This question needs an answer.' }],
          });
          expect(repository.applications).toHaveLength(0);
        });

        it('lets an optional file question stay empty', async () => {
          const fileId = await uploadAttachment(SAMPLE, samplePng());

          await service.submit('acme', 'backend', applicant({ answers: { [SAMPLE]: fileId } }));

          expect(repository.applications[0]!.files.map((f) => f.fieldKey)).toEqual([SAMPLE]);
        });

        it('refuses an answer that is not a file id', async () => {
          const error = await service
            .submit('acme', 'backend', applicant({ answers: { [SAMPLE]: 'my-portfolio.pdf' } }))
            .catch((e: unknown) => e);

          expect((error as BadRequestException).getResponse()).toMatchObject({
            errors: [{ path: SAMPLE, message: 'Upload a file.' }],
          });
        });
      });

      describe("a file that doesn't belong as the answer", () => {
        const refusedFor = async (answers: Record<string, unknown>) => {
          const error = await service.submit('acme', 'backend', applicant({ answers })).catch((e: unknown) => e);
          expect(error).toBeInstanceOf(ConflictException);
          expect(repository.applications).toHaveLength(0);
          return (error as ConflictException).getResponse() as { errors: Array<{ path: string }> };
        };

        it("is refused when it was uploaded for a different question, pointing at the answer's question", async () => {
          const photo = await uploadAttachment(PHOTO, samplePng());

          const { errors } = await refusedFor({ [SAMPLE]: photo });

          expect(errors).toEqual([{ path: SAMPLE, message: expect.any(String) }]);
          expect(repository.file(photo)?.status).toBe('pending');
        });

        it("is refused when it belongs to another job's form", async () => {
          const other = repository.seedJob({ slug: 'design', cvMode: 'off', fields });
          repository.seedPendingFile(other.job.id, 'e5555555-5555-4555-8555-555555555555', { fieldKey: SAMPLE });

          const { errors } = await refusedFor({ [SAMPLE]: 'e5555555-5555-4555-8555-555555555555' });

          expect(errors[0]!.path).toBe(SAMPLE);
          expect(repository.file('e5555555-5555-4555-8555-555555555555')?.status).toBe('pending');
          expect(storage.deleted).toEqual([]);
        });

        it('is refused when it is this job\'s CV', async () => {
          repository.seedJob({ slug: 'both', cvMode: 'optional', fields });
          const { fileId: cv } = await service.createUpload('acme', 'both', pdf);

          const error = await service
            .submit('acme', 'both', applicant({ answers: { [SAMPLE]: cv } }))
            .catch((e: unknown) => e);

          expect(error).toBeInstanceOf(ConflictException);
          expect(repository.applications).toHaveLength(0);
        });

        it('is refused when the id does not exist', async () => {
          await refusedFor({ [SAMPLE]: 'f6666666-6666-4666-8666-666666666666' });
        });

        it('is refused when one file is given as the answer to two questions', async () => {
          const fileId = await uploadAttachment(PHOTO, samplePng());

          await refusedFor({ [SAMPLE]: fileId, [PHOTO]: fileId });
        });

        it('is refused when it already belongs to another Application', async () => {
          const fileId = await uploadAttachment(SAMPLE, samplePng());
          await service.submit('acme', 'backend', applicant({ answers: { [SAMPLE]: fileId } }));

          await expect(
            service.submit(
              'acme',
              'backend',
              applicant({ email: 'grace@example.com', phone: '+201001234568', answers: { [SAMPLE]: fileId } }),
            ),
          ).rejects.toBeInstanceOf(ConflictException);
          expect(repository.applications).toHaveLength(1);
          expect(storage.deleted).toEqual([]);
        });

        it('is refused, naming the right question, when another submit takes it first', async () => {
          const fileId = await uploadAttachment(SAMPLE, samplePng());
          repository.raceOnFile = fileId;

          const { errors } = await refusedFor({ [SAMPLE]: fileId });

          expect(errors).toEqual([{ path: SAMPLE, message: expect.any(String) }]);
        });

        it('leaves the CV pending when an Attachment cannot be attached, so nothing is half-saved', async () => {
          repository.seedJob({ slug: 'both', cvMode: 'optional', fields });
          const { fileId: cv } = await service.createUpload('acme', 'both', { ...pdf, sizeBytes: samplePdf().length });
          storage.put(repository.file(cv)!.storageKey, samplePdf());
          const photo = await uploadAttachment(PHOTO, samplePng(), { slug: 'both' });

          await expect(
            service.submit('acme', 'both', applicant({ cvFileId: cv, answers: { [SAMPLE]: photo } })),
          ).rejects.toBeInstanceOf(ConflictException);

          expect(repository.applications).toHaveLength(0);
          expect(repository.file(cv)?.status).toBe('pending');
        });
      });

      describe('checking the uploaded file against the question', () => {
        async function submitRefused(fileId: string) {
          const error = await service
            .submit('acme', 'backend', applicant({ answers: { [SAMPLE]: fileId } }))
            .catch((e: unknown) => e);
          expect(error).toBeInstanceOf(BadRequestException);
          return (error as BadRequestException).getResponse() as {
            errors: Array<{ path: string; message: string }>;
          };
        }

        it.each([
          ['a Windows program', sampleWindowsExecutable],
          ['a Linux program', sampleLinuxExecutable],
          ['a zip that is not a Word document', sampleZip],
          ['an SVG with script in it', sampleSvg],
          ['plain text', () => Buffer.from('I am definitely a picture, trust me.')],
        ])('refuses %s renamed to work.png, with a field error on the question', async (_name, make) => {
          const fileId = await uploadAttachment(SAMPLE, make());
          const storageKey = repository.file(fileId)!.storageKey;

          const { errors } = await submitRefused(fileId);

          expect(errors).toEqual([{ path: SAMPLE, message: expect.stringContaining('PDF, DOCX, JPEG, PNG or WebP') }]);
          expect(repository.file(fileId)).toBeUndefined();
          expect(storage.deleted).toEqual([storageKey]);
          expect(repository.applications).toHaveLength(0);
        });

        it('refuses bytes of a kind this question does not accept, even though the browser declared an allowed type', async () => {
          // PHOTO takes images only; a real PDF declared as a PNG is not one.
          const fileId = await uploadAttachment(PHOTO, samplePdf(), { contentType: 'image/png' });
          const storageKey = repository.file(fileId)!.storageKey;

          const sample = await uploadAttachment(SAMPLE, samplePng());
          const refused = await service
            .submit('acme', 'backend', applicant({ answers: { [SAMPLE]: sample, [PHOTO]: fileId } }))
            .catch((e: unknown) => e);

          expect(refused).toBeInstanceOf(BadRequestException);
          expect((refused as BadRequestException).getResponse()).toMatchObject({
            errors: [{ path: PHOTO, message: expect.stringContaining('JPEG, PNG or WebP') }],
          });
          expect(storage.deleted).toEqual([storageKey]);
          expect(repository.file(sample)?.status).toBe('pending');
        });

        it('refuses an object cut short, declared at its full size', async () => {
          const png = samplePng();
          const fileId = await uploadAttachment(SAMPLE, png.subarray(0, png.length - 5), {
            declaredSize: png.length,
          });
          const storageKey = repository.file(fileId)!.storageKey;

          const { errors } = await submitRefused(fileId);

          expect(errors).toEqual([{ path: SAMPLE, message: expect.stringContaining('upload') }]);
          expect(storage.deleted).toEqual([storageKey]);
        });

        it('refuses an upload that never reached the bucket', async () => {
          const { fileId } = await service.createUpload('acme', 'backend', image(SAMPLE));

          const { errors } = await submitRefused(fileId);

          expect(errors[0]).toMatchObject({ path: SAMPLE });
          expect(repository.file(fileId)).toBeUndefined();
        });

        it('lets the applicant upload again and apply after a refusal', async () => {
          const bad = await uploadAttachment(SAMPLE, sampleWindowsExecutable());
          await submitRefused(bad);

          const good = await uploadAttachment(SAMPLE, samplePng());
          await service.submit('acme', 'backend', applicant({ answers: { [SAMPLE]: good } }));

          expect(repository.file(good)?.status).toBe('uploaded');
        });

        it('leaves the file pending when the person already applied, so a retry can reuse it', async () => {
          const first = await uploadAttachment(SAMPLE, samplePng());
          await service.submit('acme', 'backend', applicant({ answers: { [SAMPLE]: first } }));
          const second = await uploadAttachment(SAMPLE, samplePng());

          await expect(
            service.submit('acme', 'backend', applicant({ answers: { [SAMPLE]: second } })),
          ).rejects.toBeInstanceOf(ConflictException);
          expect(repository.file(second)?.status).toBe('pending');
          expect(storage.has(repository.file(second)!.storageKey)).toBe(true);
        });

        it('leaves the file pending when other answers are invalid', async () => {
          const fileId = await uploadAttachment(SAMPLE, samplePng());

          await expect(
            service.submit('acme', 'backend', applicant({ answers: { [SAMPLE]: fileId, [ABOUT]: 'x'.repeat(101) } })),
          ).rejects.toBeInstanceOf(BadRequestException);

          expect(repository.file(fileId)?.status).toBe('pending');
          expect(storage.reads).toEqual([]);
        });
      });
    });

    describe('getPublicJob', () => {
      it('shows applicants the limits of a file question, so their browser can check files first', async () => {
        const job = await service.getPublicJob('acme', 'backend');

        expect(job.fields.filter((f) => f.type === 'file')).toMatchObject([
          { key: SAMPLE, config: { kinds: ['document', 'image'], maxSizeMb: 2, maxDurationSeconds: null } },
          { key: PHOTO, config: { kinds: ['image'], maxSizeMb: 1, maxDurationSeconds: null } },
        ]);
      });
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
