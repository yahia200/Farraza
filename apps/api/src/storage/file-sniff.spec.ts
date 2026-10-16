import { describe, expect, it } from 'vitest';
import {
  sampleDocx,
  sampleLinuxExecutable,
  samplePdf,
  sampleWindowsExecutable,
  sampleZip,
} from '../testing/sample-files.js';
import { SNIFF_BYTES, sniffFileType } from './file-sniff.js';

const PDF = 'application/pdf';
const DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

describe('sniffFileType', () => {
  it('recognises a PDF by its bytes', async () => {
    expect(await sniffFileType(samplePdf())).toBe(PDF);
  });

  it('recognises a DOCX by its bytes', async () => {
    expect(await sniffFileType(sampleDocx())).toBe(DOCX);
  });

  it('recognises a DOCX from only the first part of a much bigger file', async () => {
    const whole = sampleDocx({ extraBytes: 3 * SNIFF_BYTES });
    expect(whole.length).toBeGreaterThan(SNIFF_BYTES * 3);

    expect(await sniffFileType(whole.subarray(0, SNIFF_BYTES))).toBe(DOCX);
  });

  it('does not guess DOCX when the slice ends inside [Content_Types].xml', async () => {
    // Why SNIFF_BYTES is generous: file-type needs that whole first entry to call a zip a DOCX.
    expect(await sniffFileType(sampleDocx().subarray(0, 100))).toBe(
      'application/zip',
    );
  });

  it('does not take a plain zip for a DOCX', async () => {
    expect(await sniffFileType(sampleZip())).toBe('application/zip');
  });

  it('names a Windows program and a Linux program for what they are', async () => {
    expect(await sniffFileType(sampleWindowsExecutable())).toBe(
      'application/x-msdownload',
    );
    expect(await sniffFileType(sampleLinuxExecutable())).toBe(
      'application/x-elf',
    );
  });

  it('finds nothing in plain text or an empty read', async () => {
    expect(await sniffFileType(Buffer.from('just some words'))).toBeNull();
    expect(await sniffFileType(new Uint8Array(0))).toBeNull();
  });
});
