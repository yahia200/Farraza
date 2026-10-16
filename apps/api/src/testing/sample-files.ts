// Real bytes for tests: the files are built by hand, byte by byte, so a test can say "this is what a
// real PDF / DOCX / Windows program starts with" without a fixture on disk. Test support only: not
// part of the build (see tsconfig.build.json).

import { randomBytes } from 'node:crypto';
import { crc32, deflateRawSync, deflateSync } from 'node:zlib';

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

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([text(type), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, checksum]);
}

/** A 1x1 PNG: signature, IHDR, one IDAT and IEND, as every PNG encoder writes them. */
export function samplePng(): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0); // width
  header.writeUInt32BE(1, 4); // height
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: RGB
  const pixel = Buffer.from([0, 255, 0, 0]); // filter byte + one red pixel
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(pixel)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** The start and end of a JPEG: SOI, a JFIF header and EOI (enough for its signature, not a picture). */
export function sampleJpeg(): Buffer {
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
    0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
  ]);
}

/** A RIFF container holding a WebP: `RIFF`, the size, `WEBP` and a `VP8L` chunk header. */
export function sampleWebp(): Buffer {
  const body = Buffer.concat([text('WEBP'), text('VP8L'), Buffer.alloc(4), Buffer.alloc(8)]);
  const size = Buffer.alloc(4);
  size.writeUInt32LE(body.length, 0);
  return Buffer.concat([text('RIFF'), size, body]);
}

/** An SVG that runs script when opened: what an image upload must never let through. */
export function sampleSvg(): Buffer {
  return text(
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(document.cookie)</script></svg>',
  );
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

// --- Video and audio ----------------------------------------------------------------------------
// Hand-built containers, like the files above: enough structure for a magic-number check and for a
// player to read the length where it says so (the WAV is complete and plays), not real recordings.

/** An ISO base media (MP4 family) box: a big-endian size that includes these 8 bytes, a type, a payload. */
function isoBox(type: string, payload: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(8 + payload.length, 0);
  header.write(type, 4, 'latin1');
  return Buffer.concat([header, payload]);
}

/** The `ftyp` box every MP4, MOV and M4A starts with: a major brand, a minor version and compatible brands. */
function fileTypeBox(majorBrand: string, compatible: string[]): Buffer {
  const head = Buffer.alloc(8);
  head.write(majorBrand, 0, 'latin1');
  return isoBox('ftyp', Buffer.concat([head, ...compatible.map((brand) => text(brand))]));
}

/** `extraBytes` of incompressible media data after the header, so a file can be far bigger than any leading slice. */
function mediaData(extraBytes: number): Buffer {
  return isoBox('mdat', randomBytes(extraBytes));
}

/** An MP4 as most encoders write it: brand `isom` (what ffmpeg, phones and screen recorders use). */
export function sampleMp4(options: { extraBytes?: number } = {}): Buffer {
  return Buffer.concat([
    fileTypeBox('isom', ['isom', 'iso2', 'avc1', 'mp41']),
    isoBox('free', Buffer.alloc(0)),
    mediaData(options.extraBytes ?? 16),
  ]);
}

/** A QuickTime movie as an iPhone or macOS writes it: brand `qt  `. */
export function sampleMov(options: { extraBytes?: number } = {}): Buffer {
  return Buffer.concat([
    fileTypeBox('qt  ', ['qt  ']),
    isoBox('wide', Buffer.alloc(0)),
    mediaData(options.extraBytes ?? 16),
  ]);
}

/** A QuickTime movie with no `ftyp`, which old tools write: it starts with `moov` (or `free`, `wide`, `mdat`). */
export function sampleMovWithoutFileType(): Buffer {
  return Buffer.concat([isoBox('moov', Buffer.alloc(8)), mediaData(16)]);
}

/** An M4A as iTunes and Voice Memos write it: brand `M4A `. */
export function sampleM4a(): Buffer {
  return Buffer.concat([fileTypeBox('M4A ', ['M4A ', 'mp42', 'isom']), mediaData(16)]);
}

/** An audio-only MP4 whose brand is `isom` or `mp42`: a container `file-type` cannot tell from a video. */
export function sampleM4aWithMp4Brand(): Buffer {
  return Buffer.concat([fileTypeBox('mp42', ['mp42', 'isom']), mediaData(16)]);
}

/** One EBML element (the container WebM and Matroska use) with a one-byte length, so up to 126 bytes of payload. */
function ebml(id: number[], payload: Buffer): Buffer {
  if (payload.length > 126) throw new Error('the sample builder only writes small elements');
  return Buffer.concat([Buffer.from(id), Buffer.from([0x80 | payload.length]), payload]);
}

/**
 * A WebM file: the EBML header with DocType `webm`, then a segment with a tracks list of one track.
 * `track` says whether that track is video (VP8) or audio (Opus); the bytes `file-type` reads are the
 * same either way, which is the point of having both.
 */
export function sampleWebm(track: 'video' | 'audio' = 'video'): Buffer {
  const header = ebml(
    [0x1a, 0x45, 0xdf, 0xa3],
    Buffer.concat([
      ebml([0x42, 0x86], Buffer.from([1])), // EBMLVersion
      ebml([0x42, 0xf7], Buffer.from([1])), // EBMLReadVersion
      ebml([0x42, 0xf2], Buffer.from([4])), // EBMLMaxIDLength
      ebml([0x42, 0xf3], Buffer.from([8])), // EBMLMaxSizeLength
      ebml([0x42, 0x82], text('webm')), // DocType
      ebml([0x42, 0x87], Buffer.from([4])), // DocTypeVersion
      ebml([0x42, 0x85], Buffer.from([2])), // DocTypeReadVersion
    ]),
  );
  const entry = ebml(
    [0xae], // TrackEntry
    Buffer.concat([
      ebml([0xd7], Buffer.from([1])), // TrackNumber
      ebml([0x73, 0xc5], Buffer.from([1])), // TrackUID
      ebml([0x83], Buffer.from([track === 'video' ? 1 : 2])), // TrackType
      ebml([0x86], text(track === 'video' ? 'V_VP8' : 'A_OPUS')), // CodecID
    ]),
  );
  const tracks = ebml([0x16, 0x54, 0xae, 0x6b], entry);
  // Segment with an unknown length (all ones), as live encoders and MediaRecorder write it.
  const segment = Buffer.concat([Buffer.from([0x18, 0x53, 0x80, 0x67, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]), tracks]);
  return Buffer.concat([header, segment]);
}

/**
 * An MP3: an optional ID3v2 tag (`id3Bytes` of tag data, such as cover art), then MPEG-1 Layer III
 * frames at 128 kbps and 44.1 kHz.
 */
export function sampleMp3(options: { id3Bytes?: number } = {}): Buffer {
  const parts: Buffer[] = [];
  if (options.id3Bytes !== undefined) {
    const tag = Buffer.alloc(10);
    tag.write('ID3', 0, 'latin1');
    tag[3] = 3; // ID3v2.3
    const size = options.id3Bytes;
    // The tag's size is "synchsafe": four bytes of seven bits each.
    tag.set([(size >> 21) & 0x7f, (size >> 14) & 0x7f, (size >> 7) & 0x7f, size & 0x7f], 6);
    parts.push(tag, Buffer.alloc(options.id3Bytes));
  }
  for (let frame = 0; frame < 3; frame++) {
    const header = Buffer.from([0xff, 0xfb, 0x90, 0x64]);
    parts.push(header, Buffer.alloc(413)); // a 417-byte frame
  }
  return Buffer.concat(parts);
}

/** An Ogg file: one first page whose packet starts like a Vorbis or an Opus stream. */
export function sampleOgg(codec: 'vorbis' | 'opus' = 'vorbis'): Buffer {
  const packet =
    codec === 'vorbis'
      ? Buffer.concat([Buffer.from([0x01]), text('vorbis'), Buffer.alloc(23)])
      : Buffer.concat([text('OpusHead'), Buffer.from([1, 1]), Buffer.alloc(17)]);
  const page = Buffer.alloc(28);
  page.write('OggS', 0, 'latin1');
  page[5] = 0x02; // first page of the stream
  page[26] = 1; // one segment
  page[27] = packet.length; // its length
  return Buffer.concat([page, packet]);
}

/**
 * A complete mono WAV (16-bit PCM, a 440 Hz tone) that a browser plays, so a manual check has a file
 * whose length is known exactly: `seconds` at `sampleRate` Hz.
 */
export function sampleWav(options: { seconds?: number; sampleRate?: number } = {}): Buffer {
  const sampleRate = options.sampleRate ?? 8000;
  const samples = Math.round((options.seconds ?? 1) * sampleRate);
  const data = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) {
    data.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 8000), i * 2);
  }
  const format = Buffer.alloc(16);
  format.writeUInt16LE(1, 0); // PCM
  format.writeUInt16LE(1, 2); // channels
  format.writeUInt32LE(sampleRate, 4);
  format.writeUInt32LE(sampleRate * 2, 8); // bytes per second
  format.writeUInt16LE(2, 12); // bytes per sample frame
  format.writeUInt16LE(16, 14); // bits per sample
  const chunk = (id: string, body: Buffer) => {
    const header = Buffer.alloc(8);
    header.write(id, 0, 'latin1');
    header.writeUInt32LE(body.length, 4);
    return Buffer.concat([header, body]);
  };
  const body = Buffer.concat([text('WAVE'), chunk('fmt ', format), chunk('data', data)]);
  return Buffer.concat([chunk('RIFF', body)]);
}
