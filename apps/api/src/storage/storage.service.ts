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
      credentials: {
        accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY'),
        secretAccessKey: config.getOrThrow<string>('S3_SECRET_KEY'),
      },
    });
  }

  /**
   * Mints a presigned PUT URL for the browser to upload a file directly to the
   * bucket. Returns the URL and the object key to persist on the answer.
   */
  async createUpload(
    target: UploadTarget,
    contentType: string,
  ): Promise<PresignedUpload> {
    const key = buildObjectKey(target);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    const url = await getSignedUrl(this.client, command, {
      expiresIn: UPLOAD_URL_TTL_SECONDS,
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
