import { z } from 'zod';
import type { FieldError } from './form-fields.js';

/**
 * Applicant file uploads. The CV's rules are fixed (ADR-0002: a parser depends on them), so they are
 * constants here, shared by the browser (checks before asking for an upload) and the API (checks
 * again, as the authority). An Attachment (the answer to a file question) brings its own rules in
 * the question's config; the format and size checks for those also live here, so both sides run the
 * same code.
 */

export const CV_PDF_TYPE = 'application/pdf';
export const CV_DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const CV_CONTENT_TYPES: readonly string[] = [CV_PDF_TYPE, CV_DOCX_TYPE];

export const CV_MAX_SIZE_MB = 5;
export const CV_MAX_SIZE_BYTES = CV_MAX_SIZE_MB * 1024 * 1024;

/** Shown before the applicant picks a file. */
export const CV_ACCEPT_HINT = `PDF or DOCX, up to ${CV_MAX_SIZE_MB} MB`;

// --- Attachments: what a file question can ask for ---------------------------------------------

/** The kinds of file a question can accept (spec: .scratch/file-uploads/spec.md, Domain model). */
export const FILE_KINDS = ['document', 'image', 'video', 'audio'] as const;
export type FileKind = (typeof FILE_KINDS)[number];

/**
 * The formats each kind means, as the content types an upload may declare and the bytes may turn
 * out to be. Only kinds listed here can be used so far: a form with a kind that has no formats
 * would ask for files nobody can send, so `formFieldsSchema` refuses it. Adding a kind's formats
 * here is what switches it on (video and audio arrive with ticket 09).
 *
 * SVG is deliberately absent: it is a document that can carry script, and `file-type` would not
 * recognise it anyway, so it could never pass the check at submit.
 */
export const FILE_KIND_TYPES: Partial<Record<FileKind, readonly string[]>> = {
  document: CV_CONTENT_TYPES,
  image: ['image/jpeg', 'image/png', 'image/webp'],
};

/** Whether a kind can be asked for yet, i.e. whether its formats are known. */
export function isFileKindAvailable(kind: FileKind): boolean {
  return FILE_KIND_TYPES[kind] !== undefined;
}

/** Limits on a question's size setting, in MB. */
export const MIN_FILE_SIZE_MB = 1;
export const MAX_FILE_SIZE_MB = 200;

/**
 * What the builder suggests as a size limit for a kind (spec, user story 11). A question that
 * accepts several kinds is suggested the largest of them.
 */
const SUGGESTED_MAX_SIZE_MB: Record<FileKind, number> = {
  document: 10,
  image: 10,
  audio: 25,
  video: 100,
};

export function suggestedMaxSizeMb(kinds: readonly FileKind[]): number {
  return Math.max(...kinds.map((kind) => SUGGESTED_MAX_SIZE_MB[kind]));
}

/** The content types a question accepting `kinds` allows, in kind order. */
export function allowedContentTypes(kinds: readonly FileKind[]): string[] {
  return kinds.flatMap((kind) => FILE_KIND_TYPES[kind] ?? []);
}

/** The part of a file question's config that decides which files are acceptable. */
export interface AttachmentRules {
  kinds: readonly FileKind[];
  maxSizeMb: number;
}

const TYPE_LABELS: Record<string, string> = {
  [CV_PDF_TYPE]: 'PDF',
  [CV_DOCX_TYPE]: 'DOCX',
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
};

/** "A", "A or B", "A, B or C". */
function listWithOr(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} or ${items.at(-1)}`;
}

/** The formats a question accepting `kinds` means, for messages: "PDF, DOCX, JPEG, PNG or WebP". */
export function fileFormatNames(kinds: readonly FileKind[]): string {
  return listWithOr(allowedContentTypes(kinds).map((type) => TYPE_LABELS[type] ?? type));
}

/** Shown before the applicant picks a file, like `CV_ACCEPT_HINT`. */
export function attachmentHint(rules: AttachmentRules): string {
  return `${fileFormatNames(rules.kinds)}, up to ${rules.maxSizeMb} MB`;
}

/** The first problem with a file for this question, or null. `path` names the request property. */
export function checkAttachmentFile(rules: AttachmentRules, file: DeclaredFile): FieldError | null {
  if (!allowedContentTypes(rules.kinds).includes(file.contentType)) {
    return { path: 'contentType', message: `Upload a ${fileFormatNames(rules.kinds)} file.` };
  }
  if (file.sizeBytes <= 0) {
    return { path: 'sizeBytes', message: 'That file is empty. Choose another one.' };
  }
  if (file.sizeBytes > rules.maxSizeMb * 1024 * 1024) {
    return { path: 'sizeBytes', message: `This file must be ${rules.maxSizeMb} MB or smaller.` };
  }
  return null;
}

const TYPE_BY_EXTENSION: Record<string, string> = {
  pdf: CV_PDF_TYPE,
  docx: CV_DOCX_TYPE,
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/**
 * The content type to declare for a picked file. Browsers take it from the operating system and some
 * leave it empty (.docx especially), so an empty type falls back to the extension. A type the
 * browser did report is passed through unchanged so that the check can refuse it.
 */
export function contentTypeOf(file: { name: string; type: string }): string {
  if (file.type) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return file.name.includes('.') ? (TYPE_BY_EXTENSION[extension] ?? '') : '';
}

/**
 * The value for a file input's `accept` attribute for these kinds: extensions as well as types, as
 * some systems report no type for .docx. It only steers the file chooser; the checks are above.
 */
export function fileAccept(kinds: readonly FileKind[]): string {
  const types = allowedContentTypes(kinds);
  const extensions = Object.entries(TYPE_BY_EXTENSION)
    .filter(([, type]) => types.includes(type))
    .map(([extension]) => `.${extension}`);
  return [...extensions, ...types].join(',');
}

/** What the browser says about the file; the API re-checks the real bytes when the form is submitted. */
export interface DeclaredFile {
  contentType: string;
  sizeBytes: number;
}

/** The first problem with a CV, or null. `path` names the request property so it maps to an error. */
export function checkCvFile(file: DeclaredFile): FieldError | null {
  if (!CV_CONTENT_TYPES.includes(file.contentType)) {
    return { path: 'contentType', message: 'Upload your CV as a PDF or DOCX file.' };
  }
  if (file.sizeBytes <= 0) {
    return { path: 'sizeBytes', message: 'That file is empty. Choose your CV again.' };
  }
  if (file.sizeBytes > CV_MAX_SIZE_BYTES) {
    return { path: 'sizeBytes', message: `Your CV must be ${CV_MAX_SIZE_MB} MB or smaller.` };
  }
  return null;
}

const uploadFile = {
  originalName: z
    .string()
    .min(1, { error: 'That file has no name.' })
    .max(255, { error: 'That file name is too long.' }),
  contentType: z.string().max(255, { error: 'That file type is not supported.' }),
  sizeBytes: z
    .number({ error: 'Choose your file again.' })
    .int({ error: 'Choose your file again.' })
    .min(1, { error: 'That file is empty. Choose it again.' }),
};

/**
 * Body of "create an upload" on the public apply page. `purpose` says what the file is for: the CV
 * slot, or the answer to the file question named by `fieldKey`. A union on `purpose`, so a request
 * for an answer must name its question and a CV request must not.
 */
export const createUploadSchema = z.discriminatedUnion(
  'purpose',
  [
    z.strictObject({ purpose: z.literal('cv'), ...uploadFile }),
    z.strictObject({
      purpose: z.literal('answer'),
      /** The file question's key, as in `answers`. Whether it is a file question is the service's call. */
      fieldKey: z.uuid({ error: 'Something went wrong. Reload the page and try again.' }),
      ...uploadFile,
    }),
  ],
  { error: 'Something went wrong. Reload the page and try again.' },
);
export type CreateUploadInput = z.infer<typeof createUploadSchema>;
