import { describe, expect, it } from 'vitest';
import {
  CV_DOCX_TYPE,
  CV_MAX_SIZE_BYTES,
  CV_PDF_TYPE,
  checkCvFile,
  createUploadSchema,
  cvContentTypeOf,
} from './files.js';

const MB = 1024 * 1024;

describe('checkCvFile', () => {
  it('accepts a PDF and a DOCX within 5 MB', () => {
    expect(checkCvFile({ contentType: CV_PDF_TYPE, sizeBytes: 1 * MB })).toBeNull();
    expect(checkCvFile({ contentType: CV_DOCX_TYPE, sizeBytes: 5 * MB })).toBeNull();
  });

  it('refuses a file over 5 MB, pointing at the size', () => {
    expect(checkCvFile({ contentType: CV_PDF_TYPE, sizeBytes: 5 * MB + 1 })).toEqual({
      path: 'sizeBytes',
      message: 'Your CV must be 5 MB or smaller.',
    });
  });

  it('refuses an empty file', () => {
    expect(checkCvFile({ contentType: CV_PDF_TYPE, sizeBytes: 0 })?.path).toBe('sizeBytes');
  });

  it.each(['image/png', 'text/html', 'application/msword', 'application/pdf; charset=x', ''])(
    'refuses the type %j',
    (contentType) => {
      expect(checkCvFile({ contentType, sizeBytes: 1000 })).toEqual({
        path: 'contentType',
        message: 'Upload your CV as a PDF or DOCX file.',
      });
    },
  );

  it('keeps the limit in one place', () => {
    expect(CV_MAX_SIZE_BYTES).toBe(5 * MB);
  });
});

describe('cvContentTypeOf', () => {
  it('trusts the type the browser reports', () => {
    expect(cvContentTypeOf({ name: 'cv.pdf', type: CV_PDF_TYPE })).toBe(CV_PDF_TYPE);
  });

  it('falls back to the extension when the browser reports no type', () => {
    expect(cvContentTypeOf({ name: 'My CV.DOCX', type: '' })).toBe(CV_DOCX_TYPE);
    expect(cvContentTypeOf({ name: 'cv.pdf', type: '' })).toBe(CV_PDF_TYPE);
  });

  it('reports the browser type as is when it is something else', () => {
    expect(cvContentTypeOf({ name: 'cv.pdf', type: 'text/plain' })).toBe('text/plain');
  });

  it('gives an empty type when nothing identifies the file', () => {
    expect(cvContentTypeOf({ name: 'cv', type: '' })).toBe('');
    expect(cvContentTypeOf({ name: 'cv.doc', type: '' })).toBe('');
  });
});

describe('createUploadSchema', () => {
  const valid = {
    purpose: 'cv',
    originalName: 'cv.pdf',
    contentType: CV_PDF_TYPE,
    sizeBytes: 1000,
  };

  it('accepts a CV upload request', () => {
    expect(createUploadSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ['an unknown purpose', { ...valid, purpose: 'photo' }],
    ['a missing name', { ...valid, originalName: '' }],
    ['a fractional size', { ...valid, sizeBytes: 10.5 }],
    ['a negative size', { ...valid, sizeBytes: -1 }],
    ['an extra key', { ...valid, storageKey: 'x' }],
  ])('refuses %s', (_label, body) => {
    expect(createUploadSchema.safeParse(body).success).toBe(false);
  });
});
