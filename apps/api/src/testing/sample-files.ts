// Real bytes for tests: the files are built by hand, byte by byte, so a test can say "this is what a
// real PDF / DOCX / Windows program starts with" without a fixture on disk. Test support only: not
// part of the build (see tsconfig.build.json).

import { randomBytes } from 'node:crypto';
import { crc32, deflateRawSync } from 'node:zlib';

const text = (value: string) => Buffer.from(value, 'utf8');

/** A tiny but complete PDF: header, one empty page, cross-reference table, trailer, end marker. */
export function samplePdf(): Buffer {
  return text(
    [
      '%PDF-1.4',
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >> endobj',
      'xref',
      '0 4',
      '0000000000 65535 f ',
      'trailer << /Size 4 /Root 1 0 R >>',
      'startxref',
      '0',
      '%%EOF',
      '',
    ].join('\n'),
  );
}

interface ZipEntry {
  name: string;
  data: Buffer;
  /** Store the bytes as they are (true) or deflate them like Word does (false, the default). */
  stored?: boolean;
}

/** A ZIP archive made of local file headers, entry data and a central directory, like any zip tool writes. */
export function zip(entries: ZipEntry[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = text(entry.name);
    const method = entry.stored ? 0 : 8;
    const body = entry.stored ? entry.data : deflateRawSync(entry.data);
    const checksum = crc32(entry.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header signature
    local.writeUInt16LE(20, 4); // version needed to extract
    local.writeUInt16LE(0, 6); // flags: no data descriptor
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    parts.push(local, name, body);

    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0); // central directory header signature
    directory.writeUInt16LE(20, 4); // version made by
    directory.writeUInt16LE(20, 6); // version needed
    directory.writeUInt16LE(method, 10);
    directory.writeUInt32LE(checksum, 16);
    directory.writeUInt32LE(body.length, 20);
    directory.writeUInt32LE(entry.data.length, 24);
    directory.writeUInt16LE(name.length, 28);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, name);

    offset += local.length + name.length + body.length;
  }

  const directoryBytes = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // end of central directory signature
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directoryBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, directoryBytes, end]);
}

const CONTENT_TYPES_DOCX =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '</Types>';

const ROOT_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  '</Relationships>';

/**
 * A DOCX laid out the way Word writes one: `[Content_Types].xml` first, then the relationships and
 * the document. `extraBytes` adds an incompressible part after them (an embedded photo, say), so
 * the file can be made far bigger than any leading slice of it.
 */
export function sampleDocx(options: { extraBytes?: number } = {}): Buffer {
  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', data: text(CONTENT_TYPES_DOCX) },
    { name: '_rels/.rels', data: text(ROOT_RELS) },
    {
      name: 'word/document.xml',
      data: text(
        '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Ada Lovelace</w:t></w:r></w:p></w:body></w:document>',
      ),
    },
  ];
  if (options.extraBytes) {
    entries.push({ name: 'word/media/image1.png', data: randomBytes(options.extraBytes), stored: true });
  }
  return zip(entries);
}

/** A zip that is not a Word document (what a renamed archive looks like). */
export function sampleZip(): Buffer {
  return zip([{ name: 'notes.txt', data: text('not a document') }]);
}

/** The start of a Windows program: the `MZ` header, the DOS stub and a PE header. */
export function sampleWindowsExecutable(): Buffer {
  const bytes = Buffer.alloc(512);
  bytes.write('MZ', 0, 'latin1');
  bytes.writeUInt32LE(0x80, 0x3c); // where the PE header starts
  bytes.write('PE\0\0', 0x80, 'latin1');
  bytes.writeUInt16LE(0x8664, 0x84); // machine: x86-64
  return bytes;
}

/** The start of a Linux program: the ELF header of a 64-bit little-endian executable. */
export function sampleLinuxExecutable(): Buffer {
  const bytes = Buffer.alloc(512);
  Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0]).copy(bytes, 0);
  bytes.writeUInt16LE(2, 16); // e_type: executable
  bytes.writeUInt16LE(0x3e, 18); // e_machine: x86-64
  return bytes;
}
