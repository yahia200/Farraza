import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { buildObjectKey } from './storage.js';
import { StorageService } from './storage.service.js';

const target = {
  companyId: '0b1a6c7e-1111-4a2b-8c3d-000000000001',
  jobId: '0b1a6c7e-2222-4a2b-8c3d-000000000002',
  fileId: '0b1a6c7e-3333-4a2b-8c3d-000000000003',
};

describe('buildObjectKey', () => {
  it('is made of the company, the job and the file id, nothing the applicant typed', () => {
    expect(buildObjectKey(target)).toBe(
      `companies/${target.companyId}/jobs/${target.jobId}/files/${target.fileId}`,
    );
  });
});

describe('StorageService.createUpload', () => {
  // Signing is a local computation, so no bucket is needed to look at the URL it returns.
  const settings: Record<string, string> = {
    S3_BUCKET: 'test-bucket',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_REGION: 'us-east-1',
    S3_ACCESS_KEY: 'test-access',
    S3_SECRET_KEY: 'test-secret',
  };
  const config = {
    getOrThrow: (name: string) => settings[name],
    get: (name: string, fallback?: string) => settings[name] ?? fallback,
  } as unknown as ConfigService;
  const storage = new StorageService(config);

  it('returns the key and a URL for exactly that object', async () => {
    const upload = await storage.createUpload(target, {
      contentType: 'application/pdf',
      sizeBytes: 1234,
    });

    expect(upload.key).toBe(buildObjectKey(target));
    expect(new URL(upload.url).pathname).toBe(`/test-bucket/${upload.key}`);
  });

  it('signs the declared content type and length, so the bucket refuses any other', async () => {
    const { url } = await storage.createUpload(target, {
      contentType: 'application/pdf',
      sizeBytes: 1234,
    });

    const signed = new URL(url).searchParams.get('X-Amz-SignedHeaders')?.split(';');
    expect(signed).toEqual(['content-length', 'content-type', 'host']);
  });

  it('adds no checksum the browser could not reproduce', async () => {
    const { url } = await storage.createUpload(target, {
      contentType: 'application/pdf',
      sizeBytes: 1234,
    });

    expect(url.toLowerCase()).not.toContain('checksum');
  });
});
