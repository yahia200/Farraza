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

// --- Recruiter downloads (ticket 05) ---

/**
 * The `Content-Disposition` value that makes a browser save a file under the applicant's name.
 *
 * `attachment` stops the browser rendering the file on the bucket's origin. The name goes out twice
 * (RFC 6266 section 4.3, https://www.rfc-editor.org/rfc/rfc6266): `filename` is a quoted ASCII
 * fallback for old clients, and `filename*` is the real name as an RFC 8187 ext-value, UTF-8 with
 * percent-encoding (https://www.rfc-editor.org/rfc/rfc8187#section-3.2.1). Modern browsers use
 * `filename*`. The name is untrusted, so it is reduced to its last path segment and stripped of
 * control characters (RFC 6266 section 4.3 asks recipients to do the same; doing it here means the
 * header is safe whatever the recipient does).
 */
export function attachmentDisposition(originalName: string): string {
  return contentDisposition('attachment', originalName);
}

function contentDisposition(type: 'attachment' | 'inline', originalName: string): string {
  const name = safeFileName(originalName);
  // Quoted-string: no quote or backslash; `%` is replaced because some old clients decode it.
  const fallback = name.replace(/[^\x20-\x7e]|["\\%]/g, '_');
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encodeExtValue(name)}`;
}

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

function safeFileName(originalName: string): string {
  const lastSegment = originalName.split(/[\\/]/).pop() ?? '';
  const name = lastSegment
    .replace(/\p{Cc}/gu, '') // control characters: C0, DEL and C1
    .replace(LONE_SURROGATE, '\uFFFD')
    .trim();
  return name === '' || /^\.+$/.test(name) ? 'file' : name;
}

/** RFC 8187 `value-chars`: `encodeURIComponent` also leaves `' ( ) *` bare, which `attr-char` forbids. */
function encodeExtValue(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

// --- Inline viewing (ticket 06) ---

/**
 * The `Content-Disposition` value for a file the candidate sheet shows in place: `inline`, with the
 * applicant's name kept (cleaned exactly like `attachmentDisposition`) so a browser's "save as" in
 * its PDF viewer proposes a readable name rather than the file id.
 */
export function inlineDisposition(originalName: string): string {
  return contentDisposition('inline', originalName);
}
