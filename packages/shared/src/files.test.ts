import { describe, expect, it } from 'vitest';
import {
  CV_DOCX_TYPE,
  CV_MAX_SIZE_BYTES,
  CV_PDF_TYPE,
  allowedContentTypes,
  attachmentHint,
  checkAttachmentFile,
  checkCvFile,
  contentTypeOf,
  createUploadSchema,
  fileAccept,
  suggestedMaxSizeMb,
  type FileKind,
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

describe('contentTypeOf', () => {
  it('trusts the type the browser reports', () => {
    expect(contentTypeOf({ name: 'cv.pdf', type: CV_PDF_TYPE })).toBe(CV_PDF_TYPE);
  });

  it('falls back to the extension when the browser reports no type', () => {
    expect(contentTypeOf({ name: 'My CV.DOCX', type: '' })).toBe(CV_DOCX_TYPE);
    expect(contentTypeOf({ name: 'cv.pdf', type: '' })).toBe(CV_PDF_TYPE);
    expect(contentTypeOf({ name: 'photo.JPG', type: '' })).toBe('image/jpeg');
    expect(contentTypeOf({ name: 'photo.jpeg', type: '' })).toBe('image/jpeg');
    expect(contentTypeOf({ name: 'shot.webp', type: '' })).toBe('image/webp');
  });

  it('reports the browser type as is when it is something else', () => {
    expect(contentTypeOf({ name: 'cv.pdf', type: 'text/plain' })).toBe('text/plain');
  });

  it('gives an empty type when nothing identifies the file', () => {
    expect(contentTypeOf({ name: 'cv', type: '' })).toBe('');
    expect(contentTypeOf({ name: 'cv.doc', type: '' })).toBe('');
    expect(contentTypeOf({ name: 'logo.svg', type: '' })).toBe('');
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

describe('createUploadSchema for an Attachment', () => {
  const FIELD = '5e0d7c3a-2b1f-4a69-8c7d-6e5f4a3b2c10';
  const valid = {
    purpose: 'answer',
    fieldKey: FIELD,
    originalName: 'work.png',
    contentType: 'image/png',
    sizeBytes: 1000,
  };

  it('accepts a request naming the question', () => {
    expect(createUploadSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ['no question key', { ...valid, fieldKey: undefined }],
    ['a question key that is not a uuid', { ...valid, fieldKey: 'resume' }],
  ])('refuses %s', (_label, body) => {
    expect(createUploadSchema.safeParse(body).success).toBe(false);
  });

  it('refuses a question key on a CV request', () => {
    const body = { purpose: 'cv', fieldKey: FIELD, originalName: 'cv.pdf', contentType: CV_PDF_TYPE, sizeBytes: 1 };
    expect(createUploadSchema.safeParse(body).success).toBe(false);
  });

  it('narrows to the question key by purpose', () => {
    const parsed = createUploadSchema.parse(valid);
    expect(parsed.purpose === 'answer' && parsed.fieldKey).toBe(FIELD);
  });
});

describe('Attachment rules', () => {
  const documents = { kinds: ['document'] as FileKind[], maxSizeMb: 10, maxDurationSeconds: null };
  const both = { kinds: ['document', 'image'] as FileKind[], maxSizeMb: 10, maxDurationSeconds: null };

  describe('allowedContentTypes', () => {
    it('maps document to PDF and DOCX and image to JPEG, PNG and WebP, never SVG', () => {
      expect(allowedContentTypes(['document'])).toEqual([CV_PDF_TYPE, CV_DOCX_TYPE]);
      expect(allowedContentTypes(['image'])).toEqual(['image/jpeg', 'image/png', 'image/webp']);
      expect(allowedContentTypes(['document', 'image'])).toHaveLength(5);
      expect(allowedContentTypes(['image', 'document'])).not.toContain('image/svg+xml');
    });
  });

  describe('checkAttachmentFile', () => {
    it('accepts an allowed type up to the limit, inclusive', () => {
      expect(checkAttachmentFile(both, { contentType: 'image/webp', sizeBytes: 10 * MB })).toBeNull();
      expect(checkAttachmentFile(documents, { contentType: CV_PDF_TYPE, sizeBytes: 1 })).toBeNull();
    });

    it('refuses a type the question does not accept, pointing at the type and naming what is accepted', () => {
      expect(checkAttachmentFile(documents, { contentType: 'image/png', sizeBytes: 1000 })).toEqual({
        path: 'contentType',
        message: 'Upload a PDF or DOCX file.',
      });
      expect(checkAttachmentFile(both, { contentType: 'image/gif', sizeBytes: 1000 })?.message).toBe(
        'Upload a PDF, DOCX, JPEG, PNG or WebP file.',
      );
    });

    it.each(['image/svg+xml', 'text/html', 'application/zip', ''])(
      'refuses %j even when images are allowed',
      (contentType) => {
        expect(checkAttachmentFile(both, { contentType, sizeBytes: 1000 })?.path).toBe('contentType');
      },
    );

    it('refuses a file over the question limit, saying the limit', () => {
      const rules = { ...both, maxSizeMb: 3 };
      expect(checkAttachmentFile(rules, { contentType: CV_PDF_TYPE, sizeBytes: 3 * MB + 1 })).toEqual({
        path: 'sizeBytes',
        message: 'This file must be 3 MB or smaller.',
      });
    });

    it('refuses an empty file', () => {
      expect(checkAttachmentFile(both, { contentType: CV_PDF_TYPE, sizeBytes: 0 })?.path).toBe('sizeBytes');
    });
  });

  describe('fileAccept', () => {
    it('lists extensions as well as types, since some systems report no type for .docx', () => {
      expect(fileAccept(['document']).split(',')).toEqual(['.pdf', '.docx', CV_PDF_TYPE, CV_DOCX_TYPE]);
      expect(fileAccept(['image']).split(',')).toEqual([
        '.jpg',
        '.jpeg',
        '.png',
        '.webp',
        'image/jpeg',
        'image/png',
        'image/webp',
      ]);
    });
  });

  describe('attachmentHint', () => {
    it('tells the applicant what is accepted before they pick a file', () => {
      expect(attachmentHint(both)).toBe('PDF, DOCX, JPEG, PNG or WebP, up to 10 MB');
      expect(attachmentHint({ kinds: ['image'], maxSizeMb: 2, maxDurationSeconds: null })).toBe(
        'JPEG, PNG or WebP, up to 2 MB',
      );
    });
  });

  describe('suggestedMaxSizeMb', () => {
    it('suggests 10 MB for documents and images, the largest suggestion when kinds are mixed', () => {
      expect(suggestedMaxSizeMb(['document'])).toBe(10);
      expect(suggestedMaxSizeMb(['image', 'document'])).toBe(10);
      expect(suggestedMaxSizeMb(['audio'])).toBe(25);
      expect(suggestedMaxSizeMb(['video', 'document'])).toBe(100);
    });
  });
});
