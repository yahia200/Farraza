import { fileTypeFromBuffer } from 'file-type';

/**
 * How many leading bytes of an object are read to find out what it really is.
 *
 * `file-type` documents that its buffer "may be a portion of the beginning of a file" and shows a
 * 4100-byte read (apps/api/node_modules/file-type/readme.md, "Node.js"). A PDF needs only its first
 * four bytes. A DOCX is a zip, and `file-type` decides it from `[Content_Types].xml`
 * (source/detectors/zip.js): the entry must lie wholly inside the buffer. If it is cut off, the
 * result is a plain `application/zip`. Word writes that entry first and it is small, but one that
 * lists many parts can take a few KB, so this reads 64 KiB: still one cheap ranged request.
 */
export const SNIFF_BYTES = 64 * 1024;

/**
 * The MIME type found in a file's leading bytes by magic number, or null when nothing is
 * recognised. This is a hint about the format, not proof that the file is well-formed
 * (file-type's readme says so), and it is what gets stored as the file's type.
 */
export async function sniffFileType(
  leadingBytes: Uint8Array,
): Promise<string | null> {
  const found = await fileTypeFromBuffer(leadingBytes);
  return found?.mime ?? null;
}
