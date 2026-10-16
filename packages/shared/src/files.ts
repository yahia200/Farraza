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
 * The formats each kind means, as the content types an upload is declared and stored as. The
 * browser and `file-type` may name the same format differently (`audio/x-m4a`, `audio/ogg;
 * codecs=opus`); `matchAllowedType` below maps those onto these.
 *
 * Video is MP4, MOV and WebM; audio is MP3, M4A, WAV, OGG and WebM audio (spec, Domain model). MP4
 * and WebM appear under both kinds' names because those containers hold sound alone just as well.
 *
 * SVG is deliberately absent: it is a document that can carry script, and `file-type` would not
 * recognise it anyway, so it could never pass the check at submit.
 */
export const FILE_KIND_TYPES: Record<FileKind, readonly string[]> = {
  document: CV_CONTENT_TYPES,
  image: ['image/jpeg', 'image/png', 'image/webp'],
  video: ['video/mp4', 'video/quicktime', 'video/webm'],
  audio: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/webm'],
};

/** Other names for the formats above: what browsers report and what `file-type` returns. */
const TYPE_ALIASES: Record<string, string> = {
  'audio/x-m4a': 'audio/mp4', // file-type's name for the M4A brand
  'audio/m4a': 'audio/mp4',
  'audio/x-wav': 'audio/wav',
  'audio/wave': 'audio/wav',
  'audio/vnd.wave': 'audio/wav',
  'audio/mp3': 'audio/mpeg',
};

/**
 * A video type that may really be sound only: neither the browser (by extension) nor `file-type`
 * (by magic number) can tell a WebM or MP4 with pictures from one without, so where a question
 * allows audio but not video, these stand for their audio type.
 */
const AUDIO_ONLY_CONTAINER: Record<string, string> = {
  'video/mp4': 'audio/mp4',
  'video/webm': 'audio/webm',
};

/**
 * The allowed type that `type` stands for, or null when it is none of them. Ignores case and
 * parameters ("audio/ogg; codecs=opus" is `audio/ogg`), maps aliases, and lets an MP4 or WebM stand
 * for the audio type of the same container (`AUDIO_ONLY_CONTAINER`). Used on the type the browser
 * declares and on the type found in the bytes, so both mean the same by "allowed".
 */
export function matchAllowedType(allowed: readonly string[], type: string): string | null {
  const base = (type.split(';')[0] ?? '').trim().toLowerCase();
  const canonical = TYPE_ALIASES[base] ?? base;
  if (allowed.includes(canonical)) return canonical;
  const audio = AUDIO_ONLY_CONTAINER[canonical];
  return audio !== undefined && allowed.includes(audio) ? audio : null;
}

/** Whether a content type is a video or audio format, i.e. one whose files have a duration. */
export function isMediaContentType(type: string): boolean {
  return FILE_KIND_TYPES.video.includes(type) || FILE_KIND_TYPES.audio.includes(type);
}

/** Whether a question accepting these kinds needs a duration limit. */
export function kindsNeedDuration(kinds: readonly FileKind[]): boolean {
  return kinds.includes('video') || kinds.includes('audio');
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
  return kinds.flatMap((kind) => FILE_KIND_TYPES[kind]);
}

/** The part of a file question's config that decides which files are acceptable. */
export interface AttachmentRules {
  kinds: readonly FileKind[];
  maxSizeMb: number;
  /** Seconds; non-null when video or audio is allowed, null otherwise (the form rejects anything else). */
  maxDurationSeconds: number | null;
}

const TYPE_LABELS: Record<string, string> = {
  [CV_PDF_TYPE]: 'PDF',
  [CV_DOCX_TYPE]: 'DOCX',
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'video/mp4': 'MP4',
  'video/quicktime': 'MOV',
  'video/webm': 'WebM',
  'audio/mpeg': 'MP3',
  'audio/mp4': 'M4A',
  'audio/wav': 'WAV',
  'audio/ogg': 'OGG',
  'audio/webm': 'WebM',
};

/** "A", "A or B", "A, B or C". */
function listWithOr(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} or ${items.at(-1)}`;
}

/**
 * The formats a question accepting `kinds` means, for messages: "PDF, DOCX, JPEG, PNG or WebP". A
 * format with two types (WebM video and WebM audio) is named once.
 */
export function fileFormatNames(kinds: readonly FileKind[]): string {
  const names = allowedContentTypes(kinds).map((type) => TYPE_LABELS[type] ?? type);
  return listWithOr([...new Set(names)]);
}

/**
 * The formats as a noun phrase for a sentence: "a PDF or DOCX file", "an MP4, MOV or WebM file". The
 * article follows how the first name is said aloud ("em-pee-four", "oh-gee-gee"), so M and O take "an".
 */
export function fileFormatPhrase(kinds: readonly FileKind[]): string {
  const names = fileFormatNames(kinds);
  return `${/^[MO]/.test(names) ? 'an' : 'a'} ${names} file`;
}

/** Shown before the applicant picks a file, like `CV_ACCEPT_HINT`. */
export function attachmentHint(rules: AttachmentRules): string {
  const length =
    kindsNeedDuration(rules.kinds) && rules.maxDurationSeconds !== null
      ? ` and ${formatDuration(rules.maxDurationSeconds)}`
      : '';
  return `${fileFormatNames(rules.kinds)}, up to ${rules.maxSizeMb} MB${length}`;
}

// --- Lengths of video and audio ------------------------------------------------------------------

/** A length for a sentence: "45 seconds", "1 minute", "1 minute 30 seconds". */
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const part = (count: number, unit: string) => `${count} ${unit}${count === 1 ? '' : 's'}`;
  return [minutes > 0 ? part(minutes, 'minute') : '', seconds > 0 || minutes === 0 ? part(seconds, 'second') : '']
    .filter(Boolean)
    .join(' ');
}

/** A length as a player shows it: "0:05", "1:05", "1:02:05". */
export function formatClock(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const two = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${two(minutes)}:${two(seconds)}` : `${minutes}:${two(seconds)}`;
}

/**
 * The length to declare for a file whose metadata says `seconds`: whole seconds, rounded up so a
 * file is never declared shorter than it is, and at least 1 (the column's CHECK and the schema's
 * minimum). Null when the browser could not tell (NaN, Infinity) or reports nothing positive.
 */
export function declaredDuration(seconds: number): number | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.max(1, Math.ceil(seconds));
}

/** The first problem with a file for this question, or null. `path` names the request property. */
export function checkAttachmentFile(rules: AttachmentRules, file: DeclaredFile): FieldError | null {
  const type = matchAllowedType(allowedContentTypes(rules.kinds), file.contentType);
  if (type === null) {
    return { path: 'contentType', message: `Upload ${fileFormatPhrase(rules.kinds)}.` };
  }
  if (file.sizeBytes <= 0) {
    return { path: 'sizeBytes', message: 'That file is empty. Choose another one.' };
  }
  if (file.sizeBytes > rules.maxSizeMb * 1024 * 1024) {
    return { path: 'sizeBytes', message: `This file must be ${rules.maxSizeMb} MB or smaller.` };
  }
  // The length is the browser's word (the server does not re-measure it), but it must be given.
  if (isMediaContentType(type)) {
    if (file.durationSeconds === undefined) {
      return {
        path: 'durationSeconds',
        message: "We couldn't read how long this file is. Choose another file.",
      };
    }
    if (rules.maxDurationSeconds !== null && file.durationSeconds > rules.maxDurationSeconds) {
      return {
        path: 'durationSeconds',
        message: `This file must be ${formatDuration(rules.maxDurationSeconds)} or shorter.`,
      };
    }
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
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  weba: 'audio/webm',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
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
    .filter(([, type]) => matchAllowedType(types, type) !== null)
    .map(([extension]) => `.${extension}`);
  return [...extensions, ...types].join(',');
}

/** What the browser says about the file; the API re-checks the real bytes when the form is submitted. */
export interface DeclaredFile {
  contentType: string;
  sizeBytes: number;
  /** Video and audio only: whole seconds, read from the file's metadata by the browser. */
  durationSeconds?: number;
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
      /** Video and audio only: the length in whole seconds, as the browser read it from the file. */
      durationSeconds: z
        .number({ error: 'Choose your file again.' })
        .int({ error: 'Choose your file again.' })
        .min(1, { error: 'Choose your file again.' })
        .optional(),
    }),
  ],
  { error: 'Something went wrong. Reload the page and try again.' },
);
export type CreateUploadInput = z.infer<typeof createUploadSchema>;
