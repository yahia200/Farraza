import type { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  S3Client,
} from '@aws-sdk/client-s3';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

// Reading back what the browser uploaded (verification at submit, ticket 04). The SDK client is the
// boundary: its `send` is replaced, so these check which requests are made and how the answers are
// read, not the network. The same calls were also run against the local RustFS bucket by hand.
describe('StorageService: checking and removing uploaded objects', () => {
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
  const key = 'companies/c/jobs/j/files/f';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function stubSend(respond: (command: unknown) => unknown) {
    return vi
      .spyOn(S3Client.prototype, 'send')
      .mockImplementation(
        (async (command: unknown) => respond(command)) as never,
      );
  }

  describe('headObject', () => {
    it("reports the object's size", async () => {
      const send = stubSend(() => ({ ContentLength: 1234 }));

      expect(await storage.headObject(key)).toEqual({ sizeBytes: 1234 });
      const command = send.mock.calls[0]![0] as unknown as HeadObjectCommand;
      expect(command).toBeInstanceOf(HeadObjectCommand);
      expect(command.input).toEqual({ Bucket: 'test-bucket', Key: key });
    });

    it('reports a missing object as null, not as an error', async () => {
      stubSend(() => {
        throw new NotFound({
          message: 'nope',
          $metadata: { httpStatusCode: 404 },
        });
      });

      expect(await storage.headObject(key)).toBeNull();
    });

    it('lets any other failure through', async () => {
      stubSend(() => {
        throw new Error('bucket unreachable');
      });

      await expect(storage.headObject(key)).rejects.toThrow(
        'bucket unreachable',
      );
    });
  });

  describe('readLeadingBytes', () => {
    it('asks for exactly the first bytes, as a range, and returns them', async () => {
      const send = stubSend(() => ({
        Body: {
          transformToByteArray: async () =>
            Uint8Array.from([0x25, 0x50, 0x44, 0x46]),
        },
      }));

      expect(await storage.readLeadingBytes(key, 4)).toEqual(
        Uint8Array.from([0x25, 0x50, 0x44, 0x46]),
      );
      const command = send.mock.calls[0]![0] as unknown as GetObjectCommand;
      expect(command).toBeInstanceOf(GetObjectCommand);
      expect(command.input).toEqual({
        Bucket: 'test-bucket',
        Key: key,
        Range: 'bytes=0-3',
      });
    });

    it('returns nothing for an object with no body', async () => {
      stubSend(() => ({}));

      expect(await storage.readLeadingBytes(key, 4)).toEqual(
        new Uint8Array(0),
      );
    });
  });

  describe('deleteObject', () => {
    it('deletes that object', async () => {
      const send = stubSend(() => ({}));

      await storage.deleteObject(key);

      const command = send.mock.calls[0]![0] as unknown as DeleteObjectCommand;
      expect(command).toBeInstanceOf(DeleteObjectCommand);
      expect(command.input).toEqual({ Bucket: 'test-bucket', Key: key });
    });
  });
});
