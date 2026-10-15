// Domain types and pure helpers for object storage (no NestJS, no S3 SDK here).

export interface PresignedUpload {
  /** The object key the browser PUTs to, and the key the API stores on the answer. */
  key: string;
  /** Short-lived signed URL the browser PUTs the raw file bytes to. */
  url: string;
}

/** Identifies where an uploaded applicant file belongs, before it has a key. */
export interface UploadTarget {
  companyId: string;
  applicationId: string;
  /** The `file` form-field this upload answers. One file per field (see buildObjectKey). */
  fieldId: string;
  /** The applicant's original, UNTRUSTED file name (e.g. "my cv (final).pdf"). */
  filename: string;
}

/** How long a presigned upload URL stays valid, in seconds. */
export const UPLOAD_URL_TTL_SECONDS = 300;
/** How long a presigned download URL stays valid, in seconds. */
export const DOWNLOAD_URL_TTL_SECONDS = 300;

/**
 * Builds the S3 object key for an uploaded applicant file.
 *
 * The key is the file's full path inside the bucket. It must keep each
 * company's files isolated, never collide between two uploads, and never let
 * an attacker-controlled filename escape its prefix.
 */
export function buildObjectKey(target: UploadTarget): string {
  // Collision-safe because each file field holds at most one file today, so the
  // (application, field) prefix is unique. Revisit if multi-file fields are
  // added — then two files in one field could share a name.
  const safeFilename = target.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `companies/${target.companyId}/applications/${target.applicationId}/${target.fieldId}/${safeFilename}`;
}
