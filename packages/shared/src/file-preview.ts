import { CV_DOCX_TYPE, CV_PDF_TYPE } from './files.js';

/**
 * How the candidate sheet shows an applicant's file inline. One list for both sides: the API mints
 * an inline (`view`) link only for a type that has a kind here, and the web app only offers a
 * preview for such a type, so a type the sheet can't render safely is never served inline.
 *
 * Only an exact stored type counts (no parameters, no look-alikes). Later kinds (image, video,
 * audio) are added here when the sheet learns to render them.
 */
export type PreviewKind = 'pdf' | 'docx';

const PREVIEW_KIND_BY_TYPE: Record<string, PreviewKind> = {
  [CV_PDF_TYPE]: 'pdf',
  [CV_DOCX_TYPE]: 'docx',
};

/** The preview kind for a stored content type, or null when the file can only be downloaded. */
export function previewKindOf(contentType: string): PreviewKind | null {
  return PREVIEW_KIND_BY_TYPE[contentType.toLowerCase()] ?? null;
}
