import { CV_DOCX_TYPE, CV_PDF_TYPE, FILE_KIND_TYPES } from './files.js';

/**
 * How the candidate sheet shows an applicant's file inline. One list for both sides: the API mints
 * an inline (`view`) link only for a type that has a kind here, and the web app only offers a
 * preview for such a type, so a type the sheet can't render safely is never served inline.
 *
 * Only an exact stored type counts (no parameters, no look-alikes). Images are the types an image
 * question accepts; video and audio are the formats an Attachment may hold (`FILE_KIND_TYPES`),
 * played by the browser's own `<video>` and `<audio>` elements.
 */
export type PreviewKind = 'pdf' | 'docx' | 'image' | 'video' | 'audio';

const PREVIEW_KIND_BY_TYPE: Record<string, PreviewKind> = {
  [CV_PDF_TYPE]: 'pdf',
  [CV_DOCX_TYPE]: 'docx',
  // Images: exactly the types an image question accepts (never SVG, which can carry script).
  ...Object.fromEntries(FILE_KIND_TYPES.image.map((type) => [type, 'image' as const])),
  ...Object.fromEntries(FILE_KIND_TYPES.video.map((type) => [type, 'video' as const])),
  ...Object.fromEntries(FILE_KIND_TYPES.audio.map((type) => [type, 'audio' as const])),
};

/** The preview kind for a stored content type, or null when the file can only be downloaded. */
export function previewKindOf(contentType: string): PreviewKind | null {
  return PREVIEW_KIND_BY_TYPE[contentType.toLowerCase()] ?? null;
}
