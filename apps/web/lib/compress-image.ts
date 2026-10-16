import {
  IMAGE_MAX_DIMENSION,
  IMAGE_PNG_QUALITY,
  IMAGE_QUALITY,
  chooseImageUpload,
  mayBeAnimated,
  shouldCompressImage,
} from '@repo/shared';

/** How much of the file is read to tell whether a picture is animated (a PNG's header can hold a colour profile). */
const SNIFF_BYTES = 1024 * 1024;

/**
 * Shrinks a large phone photo or screenshot in the browser before it uploads, and returns the file
 * to send: the compressed copy, or the picked file itself when there is nothing to gain. It never
 * makes things worse and never fails the upload: any trouble (a corrupt image, a browser that can't
 * decode it) just means the original is sent. Only an aborted `signal` throws.
 *
 * The decisions are in `@repo/shared` (`image-upload.ts`, tested): which files to try, which
 * pictures to leave alone (animated ones: a canvas keeps one frame), and whether the result is
 * worth sending. This file only drives the library.
 *
 * Library facts, from the installed `browser-image-compression` 2.0.2
 * (`node_modules/browser-image-compression/README.md` and `dist/browser-image-compression.d.ts`):
 * - The output keeps the input's type unless `fileType` says otherwise, and the name stays as it
 *   was. We pass the type explicitly and never change it, so the name and extension stay right
 *   (WebP output exists, but depends on the browser's canvas encoder; Safari falls back to PNG).
 * - It draws the image on a canvas, which applies the EXIF orientation and drops the metadata
 *   (location included) from the compressed copy. The original, if kept, keeps its metadata.
 * - It returns a `Blob` with a `name` property, not a `File`, hence the wrapping below.
 * - PNG is re-encoded with UPNG, which reduces the picture to `4096 * quality` colours: lossy, so
 *   `IMAGE_PNG_QUALITY` is the highest the library allows (1).
 * - `useWebWorker: false`: the worker variant loads the library from cdn.jsdelivr.net at run time
 *   (`libURL`), which would put a third party and a CSP exception into the apply page.
 */
export async function compressImageForUpload({
  file,
  contentType,
  signal,
}: {
  file: File;
  /** The type to treat the file as (`contentTypeOf`), which fills in a missing browser-reported one. */
  contentType: string;
  signal: AbortSignal;
}): Promise<File> {
  if (!shouldCompressImage({ contentType, sizeBytes: file.size })) return file;

  try {
    const head = new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer());
    if (mayBeAnimated(head)) return file;

    // Loaded on first use: most applicants never pick a large image.
    const { default: imageCompression } = await import('browser-image-compression');
    // The library refuses a file whose own type isn't `image/*` (a missing one is filled in here).
    const source =
      file.type === contentType
        ? file
        : new File([file], file.name, { type: contentType, lastModified: file.lastModified });

    const result = await imageCompression(source, {
      maxWidthOrHeight: IMAGE_MAX_DIMENSION,
      initialQuality: contentType === 'image/png' ? IMAGE_PNG_QUALITY : IMAGE_QUALITY,
      fileType: contentType,
      useWebWorker: false,
      signal,
    });

    // Same name, and the type the encoder really produced; `chooseImageUpload` rejects a changed one.
    const compressed = new File([result], file.name, { type: result.type, lastModified: file.lastModified });
    const choice = chooseImageUpload(
      { type: contentType, size: file.size },
      { type: compressed.type, size: compressed.size },
    );
    return choice === 'compressed' ? compressed : file;
  } catch (error) {
    if (signal.aborted) throw error;
    return file;
  }
}
