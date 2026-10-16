import { FILE_KIND_TYPES, type DeclaredFile } from './files.js';

/**
 * The rules for shrinking a picked image in the browser before it uploads (spec: .scratch/file-uploads/
 * spec.md, "Web: public apply page"). Pure decisions only; the work itself (decoding, scaling,
 * encoding with `browser-image-compression`) is in `apps/web/lib/compress-image.ts`. They live here,
 * beside the other file rules, so they run under this package's tests.
 */

/**
 * The longest side, in pixels, a compressed image keeps. 2560 fills a 1440p screen, which is as
 * large as a recruiter views an image on the candidate sheet; a 12 MP phone photo (4032 x 3024)
 * becomes about 4 MP.
 */
export const IMAGE_MAX_DIMENSION = 2560;

/** The JPEG and WebP encoder quality (0 to 1). 0.8 is visually near-lossless for photographs. */
export const IMAGE_QUALITY = 0.8;

/**
 * For PNG the library does not use the quality as an encoder setting: it reduces the picture to
 * `4096 * quality` colours. 1 (4096 colours) is the least loss it offers; lower would posterize.
 */
export const IMAGE_PNG_QUALITY = 1;

/**
 * Images under this size are sent as they are: they are already small, and each re-encode costs
 * quality and gains little. Phone photos (usually 2 MB or more) are well above it.
 */
export const IMAGE_COMPRESS_MIN_BYTES = 512 * 1024;

/**
 * The compressed file must be at most this fraction of the original to replace it. A saving of a
 * few percent isn't worth a lossy re-encode, so such an image counts as "already optimal".
 */
export const IMAGE_MIN_SAVING_RATIO = 0.9;

/** Whether the browser should try to shrink this picked file: a large JPEG, PNG or WebP. */
export function shouldCompressImage(file: DeclaredFile): boolean {
  return (FILE_KIND_TYPES.image ?? []).includes(file.contentType) && file.sizeBytes >= IMAGE_COMPRESS_MIN_BYTES;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function hasBytes(bytes: Uint8Array, offset: number, expected: readonly number[]): boolean {
  return expected.every((value, index) => bytes[offset + index] === value);
}

const ascii = (text: string): number[] => [...text].map((char) => char.charCodeAt(0));

/**
 * Whether the picture may hold more than one frame, judged from its leading bytes (not from the
 * declared type, which is only a claim). Redrawing on a canvas keeps a single frame, so such a file
 * must be uploaded as it is. When the answer can't be read from `bytes` the result is `true`: not
 * touching a file is always safe.
 *
 * - PNG: an animated PNG has an `acTL` chunk, which must come before the first `IDAT` chunk
 *   (https://www.w3.org/TR/png-3/#acTL-chunk).
 * - WebP: the `VP8X` header's flags carry an animation bit
 *   (https://developers.google.com/speed/webp/docs/riff_container#extended_file_format).
 * - JPEG (and anything unrecognised) has no animation.
 */
export function mayBeAnimated(bytes: Uint8Array): boolean {
  if (hasBytes(bytes, 0, PNG_SIGNATURE)) {
    let offset = PNG_SIGNATURE.length;
    // Each chunk: 4 bytes length, 4 bytes type, the data, 4 bytes CRC.
    while (offset + 8 <= bytes.length) {
      if (hasBytes(bytes, offset + 4, ascii('acTL'))) return true;
      if (hasBytes(bytes, offset + 4, ascii('IDAT'))) return false;
      const length = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
      offset += 12 + length;
    }
    return true;
  }

  if (hasBytes(bytes, 0, ascii('RIFF')) && hasBytes(bytes, 8, ascii('WEBP'))) {
    // A still WebP starts with a 'VP8 ' or 'VP8L' chunk; only the extended header can announce animation.
    if (!hasBytes(bytes, 12, ascii('VP8X'))) return false;
    return bytes.length < 21 || (bytes[20]! & 0b0000_0010) !== 0;
  }

  return false;
}

/**
 * Which file to upload after trying to compress: the compressed one only if it is clearly smaller
 * and still the same type as the original, otherwise the original, untouched. A different type
 * happens when the browser can't encode the requested format and silently falls back (Safari with
 * WebP gives PNG): that file would be larger, and the name and type no longer match what was picked.
 */
export function chooseImageUpload(
  original: { type: string; size: number },
  compressed: { type: string; size: number } | null,
): 'original' | 'compressed' {
  if (!compressed) return 'original';
  if (compressed.type !== original.type) return 'original';
  if (compressed.size <= 0) return 'original';
  return compressed.size <= original.size * IMAGE_MIN_SAVING_RATIO ? 'compressed' : 'original';
}
