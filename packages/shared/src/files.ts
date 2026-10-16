import { z } from 'zod';
import type { FieldError } from './form-fields.js';

/**
 * Applicant file uploads. The CV's rules are fixed (ADR-0002: a parser depends on them), so they are
 * constants here, shared by the browser (checks before asking for an upload) and the API (checks
 * again, as the authority).
 */

export const CV_PDF_TYPE = 'application/pdf';
export const CV_DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const CV_CONTENT_TYPES: readonly string[] = [CV_PDF_TYPE, CV_DOCX_TYPE];

export const CV_MAX_SIZE_MB = 5;
export const CV_MAX_SIZE_BYTES = CV_MAX_SIZE_MB * 1024 * 1024;

/** Shown before the applicant picks a file. */
export const CV_ACCEPT_HINT = `PDF or DOCX, up to ${CV_MAX_SIZE_MB} MB`;

const CV_TYPE_BY_EXTENSION: Record<string, string> = {
  pdf: CV_PDF_TYPE,
  docx: CV_DOCX_TYPE,
};

/**
 * The content type to declare for a picked file. Browsers take it from the operating system and some
 * leave it empty for .docx, so an empty type falls back to the extension. A type the browser did
 * report is passed through unchanged so that `checkCvFile()` can refuse it.
 */
export function cvContentTypeOf(file: { name: string; type: string }): string {
  if (file.type) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return file.name.includes('.') ? (CV_TYPE_BY_EXTENSION[extension] ?? '') : '';
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

/**
 * Body of "create an upload" on the public apply page. `purpose` is only `'cv'` for now; file
 * questions will add their question key.
 */
export const createUploadSchema = z.strictObject({
  purpose: z.literal('cv', { error: 'Something went wrong. Reload the page and try again.' }),
  originalName: z
    .string()
    .min(1, { error: 'That file has no name.' })
    .max(255, { error: 'That file name is too long.' }),
  contentType: z.string().max(255, { error: 'That file type is not supported.' }),
  sizeBytes: z
    .number({ error: 'Choose your file again.' })
    .int({ error: 'Choose your file again.' })
    .min(1, { error: 'That file is empty. Choose your CV again.' }),
});
export type CreateUploadInput = z.infer<typeof createUploadSchema>;
