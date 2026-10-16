import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  buildObjectKey,
  UPLOAD_URL_TTL_SECONDS,
  DOWNLOAD_URL_TTL_SECONDS,
  type PresignedUpload,
  type UploadDeclaration,
  type UploadTarget,
} from './storage.js';

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    this.bucket = config.getOrThrow<string>('S3_BUCKET');
    this.client = new S3Client({
      endpoint: config.getOrThrow<string>('S3_ENDPOINT'),
      region: config.getOrThrow<string>('S3_REGION'),
      // RustFS/MinIO need path-style URLs (endpoint/bucket), not the AWS
      // default virtual-host style (bucket.endpoint). Configurable so a real
      // AWS deployment can turn it off.
      forcePathStyle: config.get<string>('S3_FORCE_PATH_STYLE', 'true') !== 'false',
      // The default (WHEN_SUPPORTED) puts a CRC32 of an empty body into a presigned PUT's query
      // string, which a bucket that checks it would then reject for the real bytes. Only the
      // browser has the bytes, so don't ask for a checksum at all.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      credentials: {
        accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY'),
        secretAccessKey: config.getOrThrow<string>('S3_SECRET_KEY'),
      },
    });
  }

  /**
   * Mints a presigned PUT URL for the browser to upload a file directly to the
   * bucket. Returns the URL and the object key to persist on the file's row.
   *
   * The content type and length are signed: the browser must send exactly these
   * headers, or the bucket answers 403 SignatureDoesNotMatch (verified against
   * RustFS, see docs/db-schema.md). The presigner never signs `content-type` on
   * its own, so it is named in `signableHeaders`; `content-length` is signed
   * because `ContentLength` is set.
   * Docs: apps/api/node_modules/@aws-sdk/s3-request-presigner/README.md
   * ("Get Presigned URL with headers that should be signed").
   */
  async createUpload(
    target: UploadTarget,
    declared: UploadDeclaration,
  ): Promise<PresignedUpload> {
    const key = buildObjectKey(target);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: declared.contentType,
      ContentLength: declared.sizeBytes,
    });
    const url = await getSignedUrl(this.client, command, {
      expiresIn: UPLOAD_URL_TTL_SECONDS,
      signableHeaders: new Set(['content-type', 'content-length']),
    });
    return { key, url };
  }

  /** Mints a presigned GET URL so an authenticated reader can fetch a file. */
  async createDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, {
      expiresIn: DOWNLOAD_URL_TTL_SECONDS,
    });
  }
}
