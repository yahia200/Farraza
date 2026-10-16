import { describe, expect, it } from 'vitest';
import { CV_DOCX_TYPE, CV_PDF_TYPE } from './files.js';
import { previewKindOf } from './file-preview.js';

// Which stored types the candidate sheet shows inline. The API only mints an inline link for these,
// and the web app only offers a preview for these, so both ask this one function.
describe('previewKindOf', () => {
  it('previews a PDF and a DOCX', () => {
    expect(previewKindOf(CV_PDF_TYPE)).toBe('pdf');
    expect(previewKindOf(CV_DOCX_TYPE)).toBe('docx');
  });

  it('ignores the case of the type', () => {
    expect(previewKindOf('Application/PDF')).toBe('pdf');
  });

  it.each([
    'text/html',
    'image/svg+xml',
    'application/xhtml+xml',
    'application/javascript',
    'application/msword',
    'application/octet-stream',
    // Only an exact type counts: no parameters, no look-alikes.
    'application/pdf; charset=utf-8',
    'application/pdfx',
    ' application/pdf',
    '',
  ])('has no preview for %j', (type) => {
    expect(previewKindOf(type)).toBeNull();
  });
});
