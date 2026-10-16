import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { AuthorizationService } from '@nestjs/authorization';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MemberRole, Membership } from '../companies/company.js';
import type { JobWithStages } from '../jobs/job.js';
import type { JobsService } from '../jobs/jobs.service.js';
import type { StorageService } from '../storage/storage.service.js';
import { DOWNLOAD_URL_TTL_SECONDS } from '../storage/storage.js';
import type { ApplicationFile, DownloadableFile } from './pipeline.js';
import type { PipelineRepository } from './pipeline.repository.js';
import { PipelineService } from './pipeline.service.js';

// What a recruiter or interviewer can do with an Application's files, through the service. The
// real PipelineService runs against hand-written in-memory fakes (the pattern of
// applications.service.spec.ts). The fake repository mirrors the SQL rules that matter here: a
// file is found only for its own company, job and Application, and only once it is uploaded. Those
// rules are checked against the real database by hand.

type PublicApi<T> = { [K in keyof T]: T[K] };

interface StoredRow extends DownloadableFile {
  companyId: string;
  jobId: string;
  applicationId: string | null;
  status: 'pending' | 'uploaded';
}

class InMemoryPipelineRepository
  implements Pick<PublicApi<PipelineRepository>, 'findFiles' | 'findFile'>
{
  private readonly applications: Array<{
    id: string;
    companyId: string;
    jobId: string;
  }> = [];
  private readonly files: StoredRow[] = [];

  seedApplication(companyId: string, jobId: string, id: string): void {
    this.applications.push({ id, companyId, jobId });
  }

  seedFile(row: Partial<StoredRow> & { id: string }): void {
    this.files.push({
      companyId: 'company-1',
      jobId: 'job-1',
      applicationId: 'application-1',
      status: 'uploaded',
      purpose: 'cv',
      fieldKey: null,
      originalName: 'cv.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1000,
      durationSeconds: null,
      storageKey: `companies/company-1/jobs/job-1/files/${row.id}`,
      ...row,
    });
  }

  async findFiles(
    companyId: string,
    jobId: string,
    applicationId: string,
  ): Promise<ApplicationFile[] | null> {
    const found = this.applications.some(
      (a) =>
        a.id === applicationId && a.companyId === companyId && a.jobId === jobId,
    );
    if (!found) return null;
    return this.files
      .filter(
        (f) =>
          f.companyId === companyId &&
          f.jobId === jobId &&
          f.applicationId === applicationId &&
          f.status === 'uploaded',
      )
      .map((f) => ({
        id: f.id,
        purpose: f.purpose,
        fieldKey: f.fieldKey,
        originalName: f.originalName,
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes,
        durationSeconds: f.durationSeconds,
      }));
  }

  async findFile(
    companyId: string,
    jobId: string,
    applicationId: string,
    fileId: string,
  ): Promise<DownloadableFile | null> {
    const found = this.files.find(
      (f) =>
        f.id === fileId &&
        f.companyId === companyId &&
        f.jobId === jobId &&
        f.applicationId === applicationId &&
        f.status === 'uploaded',
    );
    return found
      ? {
          id: found.id,
          purpose: found.purpose,
          fieldKey: found.fieldKey,
          originalName: found.originalName,
          mimeType: found.mimeType,
          sizeBytes: found.sizeBytes,
          durationSeconds: found.durationSeconds,
          storageKey: found.storageKey,
        }
      : null;
  }
}

class FakeStorage implements Pick<PublicApi<StorageService>, 'createDownloadUrl' | 'createViewUrl'> {
  readonly requests: Array<{ key: string; fileName: string }> = [];
  readonly viewRequests: Array<{ key: string; fileName: string; contentType: string }> = [];

  async createDownloadUrl(key: string, fileName: string): Promise<string> {
    this.requests.push({ key, fileName });
    return `https://bucket.test/${key}?signed=1`;
  }

  async createViewUrl(key: string, fileName: string, contentType: string): Promise<string> {
    this.viewRequests.push({ key, fileName, contentType });
    return `https://bucket.test/${key}?signed=inline`;
  }
}

/** Mirrors JobsService.get: a job is visible only inside its own company, else 404. */
class FakeJobs implements Pick<PublicApi<JobsService>, 'get'> {
  private readonly jobs = [
    { companyId: 'company-1', job: { id: 'job-1', slug: 'engineer' } },
    { companyId: 'company-2', job: { id: 'job-2', slug: 'designer' } },
  ];

  async get(membership: Membership, jobSlug: string): Promise<JobWithStages> {
    const found = this.jobs.find(
      (j) => j.companyId === membership.company.id && j.job.slug === jobSlug,
    );
    if (!found) throw new NotFoundException();
    return found.job as JobWithStages;
  }
}

function member(companyId: string, role: MemberRole): Membership {
  return {
    userId: `user-${role}`,
    role,
    company: {
      id: companyId,
      name: companyId,
      slug: companyId,
      logoUrl: null,
      brandColor: null,
    },
  };
}

describe('files on an Application (recruiter side)', () => {
  let repository: InMemoryPipelineRepository;
  let storage: FakeStorage;
  let service: PipelineService;

  beforeEach(() => {
    repository = new InMemoryPipelineRepository();
    storage = new FakeStorage();
    service = new PipelineService(
      repository as unknown as PipelineRepository,
      new FakeJobs() as unknown as JobsService,
      { authorize: async () => {} } as unknown as AuthorizationService,
      storage as unknown as StorageService,
    );
    repository.seedApplication('company-1', 'job-1', 'application-1');
    repository.seedApplication('company-1', 'job-1', 'application-2');
    repository.seedApplication('company-2', 'job-2', 'application-9');
  });

  describe('listing', () => {
    it('lists the Application\'s files with name, type and size, but no storage key', async () => {
      repository.seedFile({ id: 'file-cv', originalName: 'Mona CV.pdf', sizeBytes: 2048 });
      repository.seedFile({
        id: 'file-intro',
        purpose: 'answer',
        fieldKey: 'field-1',
        originalName: 'intro.mp4',
        mimeType: 'video/mp4',
        sizeBytes: 5_000_000,
        durationSeconds: 42,
      });

      const files = await service.listFiles(member('company-1', 'recruiter'), 'engineer', 'application-1');

      expect(files).toEqual([
        {
          id: 'file-cv',
          purpose: 'cv',
          fieldKey: null,
          originalName: 'Mona CV.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 2048,
          durationSeconds: null,
        },
        {
          id: 'file-intro',
          purpose: 'answer',
          fieldKey: 'field-1',
          originalName: 'intro.mp4',
          mimeType: 'video/mp4',
          sizeBytes: 5_000_000,
          durationSeconds: 42,
        },
      ]);
    });

    it('lists nothing for an Application without files', async () => {
      const files = await service.listFiles(member('company-1', 'recruiter'), 'engineer', 'application-2');

      expect(files).toEqual([]);
    });

    it('does not list files that are still pending or belong to another Application', async () => {
      repository.seedFile({ id: 'file-pending', status: 'pending', applicationId: null });
      repository.seedFile({ id: 'file-other', applicationId: 'application-2' });

      const files = await service.listFiles(member('company-1', 'recruiter'), 'engineer', 'application-1');

      expect(files).toEqual([]);
    });

    it.each<MemberRole>(['owner', 'admin', 'recruiter', 'interviewer'])(
      'lets a %s see the files',
      async (role) => {
        repository.seedFile({ id: 'file-cv' });

        const files = await service.listFiles(member('company-1', role), 'engineer', 'application-1');

        expect(files.map((f) => f.id)).toEqual(['file-cv']);
      },
    );

    it('answers 404 for a member of another company', async () => {
      repository.seedFile({ id: 'file-cv' });

      await expect(
        service.listFiles(member('company-2', 'owner'), 'engineer', 'application-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('answers 404 when the Application is not in that company\'s job', async () => {
      await expect(
        service.listFiles(member('company-1', 'owner'), 'engineer', 'application-9'),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.listFiles(member('company-1', 'owner'), 'engineer', 'no-such-application'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('download link', () => {
    it('returns a short-lived link for the file, named after the applicant\'s original file name', async () => {
      repository.seedFile({ id: 'file-cv', originalName: 'Mona Ali – CV.pdf' });

      const link = await service.downloadLink(
        member('company-1', 'recruiter'),
        'engineer',
        'application-1',
        'file-cv',
      );

      expect(link).toEqual({
        url: 'https://bucket.test/companies/company-1/jobs/job-1/files/file-cv?signed=1',
        expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
      });
      expect(storage.requests).toEqual([
        {
          key: 'companies/company-1/jobs/job-1/files/file-cv',
          fileName: 'Mona Ali – CV.pdf',
        },
      ]);
    });

    it('gives interviewers the same access as recruiters', async () => {
      repository.seedFile({ id: 'file-cv' });

      const link = await service.downloadLink(
        member('company-1', 'interviewer'),
        'engineer',
        'application-1',
        'file-cv',
      );

      expect(link.url).toContain('file-cv');
    });

    it('answers 404 for a member of another company and signs nothing', async () => {
      repository.seedFile({ id: 'file-cv' });

      await expect(
        service.downloadLink(member('company-2', 'owner'), 'engineer', 'application-1', 'file-cv'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(storage.requests).toEqual([]);
    });

    it('answers 404 for a file that belongs to another Application of the same job', async () => {
      repository.seedFile({ id: 'file-other', applicationId: 'application-2' });

      await expect(
        service.downloadLink(member('company-1', 'owner'), 'engineer', 'application-1', 'file-other'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(storage.requests).toEqual([]);
    });

    it('answers 404 for a file of another company, even through your own Application', async () => {
      repository.seedFile({
        id: 'file-foreign',
        companyId: 'company-2',
        jobId: 'job-2',
        applicationId: 'application-9',
      });

      await expect(
        service.downloadLink(member('company-1', 'owner'), 'engineer', 'application-1', 'file-foreign'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(storage.requests).toEqual([]);
    });

    it('answers 404 for a file that was never submitted (still pending)', async () => {
      repository.seedFile({ id: 'file-pending', status: 'pending', applicationId: null });

      await expect(
        service.downloadLink(member('company-1', 'owner'), 'engineer', 'application-1', 'file-pending'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('answers 404 for a file id that does not exist', async () => {
      await expect(
        service.downloadLink(member('company-1', 'owner'), 'engineer', 'application-1', 'nope'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // Ticket 06: the same files, shown in place. The link is inline and pins the content type, so it
  // is only ever minted for the types the candidate sheet renders (previewKindOf in @repo/shared).
  describe('view link', () => {
    const PDF = 'application/pdf';
    const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    it.each([PDF, DOCX])('returns a short-lived inline link for a %s file', async (mimeType) => {
      repository.seedFile({ id: 'file-cv', originalName: 'Mona Ali – CV', mimeType });

      const link = await service.viewLink(
        member('company-1', 'recruiter'),
        'engineer',
        'application-1',
        'file-cv',
      );

      expect(link).toEqual({
        url: 'https://bucket.test/companies/company-1/jobs/job-1/files/file-cv?signed=inline',
        expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
      });
      // The bucket is told the stored type, not whatever the object's own metadata says.
      expect(storage.viewRequests).toEqual([
        { key: 'companies/company-1/jobs/job-1/files/file-cv', fileName: 'Mona Ali – CV', contentType: mimeType },
      ]);
      expect(storage.requests).toEqual([]);
    });

    it.each(['text/html', 'image/svg+xml', 'application/octet-stream', 'video/mp4', 'application/msword'])(
      'refuses to show a %s file inline and signs nothing',
      async (mimeType) => {
        repository.seedFile({ id: 'file-odd', mimeType });

        await expect(
          service.viewLink(member('company-1', 'owner'), 'engineer', 'application-1', 'file-odd'),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(storage.viewRequests).toEqual([]);
      },
    );

    // Ticket 08: images are shown in place too (SVG stays refused, above).
    it.each(['image/jpeg', 'image/png', 'image/webp'])(
      'returns an inline link pinned to %s for an image attachment',
      async (mimeType) => {
        repository.seedFile({
          id: 'file-photo',
          purpose: 'answer',
          fieldKey: 'question-1',
          originalName: 'portfolio.jpg',
          mimeType,
        });

        const link = await service.viewLink(
          member('company-1', 'recruiter'),
          'engineer',
          'application-1',
          'file-photo',
        );

        expect(link.url).toBe(
          'https://bucket.test/companies/company-1/jobs/job-1/files/file-photo?signed=inline',
        );
        expect(storage.viewRequests).toEqual([
          { key: 'companies/company-1/jobs/job-1/files/file-photo', fileName: 'portfolio.jpg', contentType: mimeType },
        ]);
      },
    );

    it('gives interviewers the same access as recruiters', async () => {
      repository.seedFile({ id: 'file-cv' });

      const link = await service.viewLink(
        member('company-1', 'interviewer'),
        'engineer',
        'application-1',
        'file-cv',
      );

      expect(link.url).toContain('file-cv');
    });

    it('answers 404 for a member of another company and signs nothing', async () => {
      repository.seedFile({ id: 'file-cv' });

      await expect(
        service.viewLink(member('company-2', 'owner'), 'engineer', 'application-1', 'file-cv'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(storage.viewRequests).toEqual([]);
    });

    it('answers 404 for a file of another Application, another company, or one still pending', async () => {
      repository.seedFile({ id: 'file-other', applicationId: 'application-2' });
      repository.seedFile({ id: 'file-foreign', companyId: 'company-2', jobId: 'job-2', applicationId: 'application-9' });
      repository.seedFile({ id: 'file-pending', status: 'pending', applicationId: null });

      for (const fileId of ['file-other', 'file-foreign', 'file-pending', 'nope']) {
        await expect(
          service.viewLink(member('company-1', 'owner'), 'engineer', 'application-1', fileId),
        ).rejects.toBeInstanceOf(NotFoundException);
      }
      expect(storage.viewRequests).toEqual([]);
    });
  });
});
