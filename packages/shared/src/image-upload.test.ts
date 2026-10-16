import { describe, expect, it } from 'vitest';
import { CV_PDF_TYPE } from './files.js';
import {
  IMAGE_COMPRESS_MIN_BYTES,
  chooseImageUpload,
  mayBeAnimated,
  shouldCompressImage,
} from './image-upload.js';

const MB = 1024 * 1024;

// Which picked images the browser tries to shrink before uploading (ticket 08).
describe('shouldCompressImage', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp'])('shrinks a large %s', (contentType) => {
    expect(shouldCompressImage({ contentType, sizeBytes: 4 * MB })).toBe(true);
  });

  it('leaves a small image alone: there is little to gain and every re-encode costs quality', () => {
    expect(shouldCompressImage({ contentType: 'image/jpeg', sizeBytes: 120 * 1024 })).toBe(false);
    expect(shouldCompressImage({ contentType: 'image/png', sizeBytes: IMAGE_COMPRESS_MIN_BYTES - 1 })).toBe(false);
  });

  it('starts shrinking at the threshold itself', () => {
    expect(shouldCompressImage({ contentType: 'image/jpeg', sizeBytes: IMAGE_COMPRESS_MIN_BYTES })).toBe(true);
  });

  it.each([CV_PDF_TYPE, 'image/svg+xml', 'image/gif', 'image/heic', 'video/mp4', ''])(
    'never touches a %j file',
    (contentType) => {
      expect(shouldCompressImage({ contentType, sizeBytes: 8 * MB })).toBe(false);
    },
  );
});

/** Bytes from a list of numbers and ASCII strings, so a test reads like the format's hex dump. */
function bytes(...parts: Array<number | string | number[]>): Uint8Array {
  const out: number[] = [];
  for (const part of parts) {
    if (typeof part === 'number') out.push(part);
    else if (typeof part === 'string') out.push(...[...part].map((c) => c.charCodeAt(0)));
    else out.push(...part);
  }
  return Uint8Array.from(out);
}
const u32 = (n: number): number[] => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const le32 = (n: number): number[] => u32(n).reverse();
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** A PNG chunk with an empty-ish body of `length` zero bytes (the CRC is not read). */
const pngChunk = (type: string, length = 0): Uint8Array =>
  bytes(u32(length), type, new Array<number>(length).fill(0), u32(0));
const IHDR = pngChunk('IHDR', 13);

// A canvas keeps one frame, so an animated picture must be sent as it is, not flattened.
describe('mayBeAnimated', () => {
  it('sees an animated PNG: an acTL chunk before the image data', () => {
    const apng = bytes(PNG_SIGNATURE, [...IHDR], [...pngChunk('acTL', 8)], [...pngChunk('IDAT', 20)]);
    expect(mayBeAnimated(apng)).toBe(true);
  });

  it('accepts a plain PNG: image data comes before any animation chunk could', () => {
    const png = bytes(PNG_SIGNATURE, [...IHDR], [...pngChunk('iCCP', 40)], [...pngChunk('IDAT', 20)], [...pngChunk('IEND')]);
    expect(mayBeAnimated(png)).toBe(false);
  });

  it('cannot tell when the PNG header runs past what was read, and plays safe', () => {
    const cutOff = bytes(PNG_SIGNATURE, [...IHDR], [...pngChunk('iCCP', 40)].slice(0, 20));
    expect(mayBeAnimated(cutOff)).toBe(true);
  });

  it('sees an animated WebP: the animation flag of the VP8X header', () => {
    const animated = bytes('RIFF', le32(30), 'WEBP', 'VP8X', le32(10), 0b0000_0010, [0, 0, 0], [0, 0, 0], [0, 0, 0]);
    expect(mayBeAnimated(animated)).toBe(true);
  });

  it('accepts a still WebP, with or without the extended header', () => {
    const extended = bytes('RIFF', le32(30), 'WEBP', 'VP8X', le32(10), 0b0001_0000, [0, 0, 0], [0, 0, 0], [0, 0, 0]);
    const simple = bytes('RIFF', le32(30), 'WEBP', 'VP8 ', le32(10), new Array<number>(10).fill(0));
    expect(mayBeAnimated(extended)).toBe(false);
    expect(mayBeAnimated(simple)).toBe(false);
  });

  it('accepts a JPEG, which has no animation', () => {
    expect(mayBeAnimated(bytes([0xff, 0xd8, 0xff, 0xe0], new Array<number>(40).fill(0)))).toBe(false);
  });
});

const photo = { name: 'IMG_2041.jpg', type: 'image/jpeg', size: 4 * MB };

// The compressed copy replaces the original only when it is worth it and still the same kind of file.
describe('chooseImageUpload', () => {
  it('sends the compressed file when it is clearly smaller and the same type', () => {
    expect(chooseImageUpload(photo, { type: 'image/jpeg', size: 900 * 1024 })).toBe('compressed');
  });

  it('keeps the original when compression made it larger', () => {
    expect(chooseImageUpload(photo, { type: 'image/jpeg', size: 5 * MB })).toBe('original');
  });

  it('keeps the original when it is already optimal: the saving is too small to be worth a re-encode', () => {
    expect(chooseImageUpload(photo, { type: 'image/jpeg', size: Math.round(3.9 * MB) })).toBe('original');
    expect(chooseImageUpload(photo, { type: 'image/jpeg', size: photo.size })).toBe('original');
  });

  it('keeps the original when the browser could not produce the same type (it falls back to PNG)', () => {
    expect(chooseImageUpload({ ...photo, type: 'image/webp' }, { type: 'image/png', size: 100 * 1024 })).toBe('original');
  });

  it('keeps the original when the result is empty', () => {
    expect(chooseImageUpload(photo, { type: 'image/jpeg', size: 0 })).toBe('original');
  });

  it('keeps the original when there is no compressed file (it failed or was skipped)', () => {
    expect(chooseImageUpload(photo, null)).toBe('original');
  });
});
