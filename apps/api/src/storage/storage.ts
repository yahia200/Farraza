// Domain types and pure helpers for object storage (no NestJS, no S3 SDK here).

export interface PresignedUpload {
  /** The object key the browser PUTs to, and the key stored on the file's row. */
  key: string;
  /** Short-lived signed URL the browser PUTs the raw file bytes to. */
  url: string;
}

/**
 * Identifies an uploaded applicant file before it has a key. There is no application id: the file
 * is uploaded before the Application exists. The file id is the id of its `files` row.
 */
export interface UploadTarget {
  companyId: string;
  jobId: string;
  fileId: string;
}

/** What the browser will send, which the presigned URL pins down. */
export interface UploadDeclaration {
  contentType: string;
  sizeBytes: number;
}

/** How long a presigned upload URL stays valid, in seconds. */
export const UPLOAD_URL_TTL_SECONDS = 300;
/** How long a presigned download URL stays valid, in seconds. */
export const DOWNLOAD_URL_TTL_SECONDS = 300;

/**
 * Builds the S3 object key for an uploaded applicant file: the company, the job and the file id.
 *
 * The key keeps each company's files under its own prefix and cannot collide, because the file id
 * is unique. The applicant's file name is untrusted, so it never goes into a key; it lives only on
 * the `files` row.
 */
export function buildObjectKey(target: UploadTarget): string {
  return `companies/${target.companyId}/jobs/${target.jobId}/files/${target.fileId}`;
}
