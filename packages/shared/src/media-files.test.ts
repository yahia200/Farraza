import { describe, expect, it } from 'vitest';
import {
  CV_PDF_TYPE,
  allowedContentTypes,
  attachmentHint,
  checkAttachmentFile,
  contentTypeOf,
  createUploadSchema,
  declaredDuration,
  fileAccept,
  fileFormatPhrase,
  formatClock,
  formatDuration,
  isMediaContentType,
  matchAllowedType,
  suggestedMaxSizeMb,
  type FileKind,
} from './files.js';

// Video and audio Attachments (ticket 09): the formats, the type matching that copes with
// containers and aliases, and the length rules. Plain files.test.ts covers documents and images.

const MB = 1024 * 1024;

describe('video and audio Attachments', () => {
  const video = { kinds: ['video'] as FileKind[], maxSizeMb: 100, maxDurationSeconds: 60 };
  const audio = { kinds: ['audio'] as FileKind[], maxSizeMb: 25, maxDurationSeconds: 90 };
  const mixed = { kinds: ['document', 'video', 'audio'] as FileKind[], maxSizeMb: 100, maxDurationSeconds: 120 };

  describe('formats', () => {
    it('maps video to MP4, MOV and WebM and audio to MP3, M4A, WAV, OGG and WebM', () => {
      expect(allowedContentTypes(['video'])).toEqual(['video/mp4', 'video/quicktime', 'video/webm']);
      expect(allowedContentTypes(['audio'])).toEqual([
        'audio/mpeg',
        'audio/mp4',
        'audio/wav',
        'audio/ogg',
        'audio/webm',
      ]);
    });

    it('names each format once in messages, though WebM is both video and audio', () => {
      expect(attachmentHint(video)).toBe('MP4, MOV or WebM, up to 100 MB and 1 minute');
      expect(attachmentHint(audio)).toBe('MP3, M4A, WAV, OGG or WebM, up to 25 MB and 1 minute 30 seconds');
      expect(attachmentHint({ ...mixed, kinds: ['video', 'audio'] })).toBe(
        'MP4, MOV, WebM, MP3, M4A, WAV or OGG, up to 100 MB and 2 minutes',
      );
    });

    it('writes "an MP4", not "a MP4", and "a WAV", in the sentence that names the formats', () => {
      expect(fileFormatPhrase(['video'])).toBe('an MP4, MOV or WebM file');
      expect(fileFormatPhrase(['audio'])).toBe('an MP3, M4A, WAV, OGG or WebM file');
      expect(fileFormatPhrase(['document'])).toBe('a PDF or DOCX file');
      expect(checkAttachmentFile(video, { contentType: 'audio/mpeg', sizeBytes: MB })?.message).toBe(
        'Upload an MP4, MOV or WebM file.',
      );
    });

    it('asks the file chooser for the extensions as well as the types', () => {
      expect(fileAccept(['video']).split(',')).toEqual([
        '.mp4',
        '.mov',
        '.webm',
        'video/mp4',
        'video/quicktime',
        'video/webm',
      ]);
      // A .webm or .mp4 recording may hold sound only, so an audio question lists them too.
      expect(fileAccept(['audio']).split(',')).toEqual([
        '.mp4',
        '.webm',
        '.weba',
        '.mp3',
        '.m4a',
        '.wav',
        '.ogg',
        'audio/mpeg',
        'audio/mp4',
        'audio/wav',
        'audio/ogg',
        'audio/webm',
      ]);
    });

    it('finds the type of a media file from its extension when the browser reports none', () => {
      expect(contentTypeOf({ name: 'intro.MP4', type: '' })).toBe('video/mp4');
      expect(contentTypeOf({ name: 'intro.mov', type: '' })).toBe('video/quicktime');
      expect(contentTypeOf({ name: 'intro.webm', type: '' })).toBe('video/webm');
      expect(contentTypeOf({ name: 'voice.weba', type: '' })).toBe('audio/webm');
      expect(contentTypeOf({ name: 'voice.mp3', type: '' })).toBe('audio/mpeg');
      expect(contentTypeOf({ name: 'voice.m4a', type: '' })).toBe('audio/mp4');
      expect(contentTypeOf({ name: 'voice.wav', type: '' })).toBe('audio/wav');
      expect(contentTypeOf({ name: 'voice.ogg', type: '' })).toBe('audio/ogg');
    });
  });

  describe('matchAllowedType', () => {
    const videoTypes = allowedContentTypes(['video']);
    const audioTypes = allowedContentTypes(['audio']);

    it('returns the allowed type a type stands for, or null', () => {
      expect(matchAllowedType(videoTypes, 'video/mp4')).toBe('video/mp4');
      expect(matchAllowedType(videoTypes, 'audio/mpeg')).toBeNull();
      expect(matchAllowedType(videoTypes, 'video/x-matroska')).toBeNull();
      expect(matchAllowedType(videoTypes, '')).toBeNull();
    });

    it('ignores case and parameters, as in "audio/ogg; codecs=opus", which file-type reports for Opus', () => {
      expect(matchAllowedType(audioTypes, 'audio/ogg; codecs=opus')).toBe('audio/ogg');
      expect(matchAllowedType(audioTypes, 'Audio/WebM;codecs=opus')).toBe('audio/webm');
    });

    it.each([
      ['audio/x-m4a', 'audio/mp4'], // file-type's name for the M4A brand, and what many systems report
      ['audio/m4a', 'audio/mp4'],
      ['audio/x-wav', 'audio/wav'],
      ['audio/wave', 'audio/wav'],
      ['audio/mp3', 'audio/mpeg'],
    ])('treats %s as %s', (alias, canonical) => {
      expect(matchAllowedType(audioTypes, alias)).toBe(canonical);
    });

    it('lets an MP4 or WebM stand for its audio type when only audio is allowed, as the container cannot say', () => {
      expect(matchAllowedType(audioTypes, 'video/webm')).toBe('audio/webm');
      expect(matchAllowedType(audioTypes, 'video/mp4')).toBe('audio/mp4');
    });

    it('does not let audio stand for video, nor a MOV for audio', () => {
      expect(matchAllowedType(videoTypes, 'audio/webm')).toBeNull();
      expect(matchAllowedType(videoTypes, 'audio/mp4')).toBeNull();
      expect(matchAllowedType(audioTypes, 'video/quicktime')).toBeNull();
    });

    it('keeps the exact type when both are allowed', () => {
      const both = allowedContentTypes(['video', 'audio']);
      expect(matchAllowedType(both, 'video/webm')).toBe('video/webm');
      expect(matchAllowedType(both, 'audio/webm')).toBe('audio/webm');
    });

    it('still matches documents and images exactly', () => {
      expect(matchAllowedType(allowedContentTypes(['document']), CV_PDF_TYPE)).toBe(CV_PDF_TYPE);
      expect(matchAllowedType(allowedContentTypes(['image']), 'image/svg+xml')).toBeNull();
    });
  });

  describe('isMediaContentType', () => {
    it('is true for the video and audio formats only', () => {
      expect(isMediaContentType('video/webm')).toBe(true);
      expect(isMediaContentType('audio/mpeg')).toBe(true);
      expect(isMediaContentType('image/png')).toBe(false);
      expect(isMediaContentType(CV_PDF_TYPE)).toBe(false);
    });
  });

  describe('checkAttachmentFile with a duration', () => {
    const file = { contentType: 'video/mp4', sizeBytes: 5 * MB };

    it('accepts a file up to the limit, inclusive', () => {
      expect(checkAttachmentFile(video, { ...file, durationSeconds: 60 })).toBeNull();
      expect(checkAttachmentFile(video, { ...file, durationSeconds: 1 })).toBeNull();
    });

    it('refuses a longer file, saying the allowed length', () => {
      expect(checkAttachmentFile(video, { ...file, durationSeconds: 61 })).toEqual({
        path: 'durationSeconds',
        message: 'This file must be 1 minute or shorter.',
      });
      expect(
        checkAttachmentFile(audio, { contentType: 'audio/mpeg', sizeBytes: MB, durationSeconds: 91 })?.message,
      ).toBe('This file must be 1 minute 30 seconds or shorter.');
    });

    it('needs the length of a video or audio file', () => {
      expect(checkAttachmentFile(video, file)).toEqual({
        path: 'durationSeconds',
        message: "We couldn't read how long this file is. Choose another file.",
      });
    });

    it('does not ask for a length when the file is a document in a question that also takes video', () => {
      expect(checkAttachmentFile(mixed, { contentType: CV_PDF_TYPE, sizeBytes: MB })).toBeNull();
    });

    it('checks the type and size before the length', () => {
      expect(checkAttachmentFile(video, { contentType: 'image/png', sizeBytes: MB, durationSeconds: 999 })?.path).toBe(
        'contentType',
      );
      expect(checkAttachmentFile(video, { ...file, sizeBytes: 101 * MB, durationSeconds: 999 })?.path).toBe(
        'sizeBytes',
      );
    });

    it('accepts the aliases and the WebM an audio question allows', () => {
      expect(
        checkAttachmentFile(audio, { contentType: 'audio/x-m4a', sizeBytes: MB, durationSeconds: 30 }),
      ).toBeNull();
      expect(
        checkAttachmentFile(audio, { contentType: 'video/webm', sizeBytes: MB, durationSeconds: 30 }),
      ).toBeNull();
    });
  });

  describe('suggestedMaxSizeMb', () => {
    it('suggests 25 MB for audio and 100 MB for video, the larger when both are allowed', () => {
      expect(suggestedMaxSizeMb(['audio'])).toBe(25);
      expect(suggestedMaxSizeMb(['video'])).toBe(100);
      expect(suggestedMaxSizeMb(['audio', 'video'])).toBe(100);
    });
  });

  describe('createUploadSchema with a declared length', () => {
    const FIELD = '5e0d7c3a-2b1f-4a69-8c7d-6e5f4a3b2c10';
    const body = {
      purpose: 'answer',
      fieldKey: FIELD,
      originalName: 'intro.mp4',
      contentType: 'video/mp4',
      sizeBytes: 1000,
    };

    it('takes the length in whole seconds, optionally', () => {
      expect(createUploadSchema.safeParse(body).success).toBe(true);
      expect(createUploadSchema.safeParse({ ...body, durationSeconds: 42 }).success).toBe(true);
    });

    it.each([0, -3, 4.5, '42', null])('refuses the length %j', (durationSeconds) => {
      expect(createUploadSchema.safeParse({ ...body, durationSeconds }).success).toBe(false);
    });

    it('does not take a length on a CV request', () => {
      const cv = { purpose: 'cv', originalName: 'cv.pdf', contentType: CV_PDF_TYPE, sizeBytes: 1, durationSeconds: 3 };
      expect(createUploadSchema.safeParse(cv).success).toBe(false);
    });
  });
});

describe('formatDuration', () => {
  it.each([
    [1, '1 second'],
    [45, '45 seconds'],
    [60, '1 minute'],
    [90, '1 minute 30 seconds'],
    [120, '2 minutes'],
    [3600, '60 minutes'],
    [3661, '61 minutes 1 second'],
  ])('writes %s seconds as %j', (seconds, words) => {
    expect(formatDuration(seconds)).toBe(words);
  });

  it.each([
    [5, '0:05'],
    [65, '1:05'],
    [600, '10:00'],
    [3725, '1:02:05'],
  ])('shows %s seconds on a clock as %j', (seconds, clock) => {
    expect(formatClock(seconds)).toBe(clock);
  });
});

describe('declaredDuration', () => {
  it('rounds up to whole seconds, never under-declaring, and never below 1', () => {
    expect(declaredDuration(60)).toBe(60);
    expect(declaredDuration(60.02)).toBe(61);
    expect(declaredDuration(0.2)).toBe(1);
    expect(declaredDuration(12.5)).toBe(13);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 0, -4])('has no length for %s', (seconds) => {
    expect(declaredDuration(seconds)).toBeNull();
  });
});
