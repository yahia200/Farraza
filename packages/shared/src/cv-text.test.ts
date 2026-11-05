import { describe, expect, it } from 'vitest';
import { submitApplicationSchema } from './applications.js';
import {
  CV_TEXT_CAP,
  CV_TEXT_MIN_LENGTH,
  cvTextSchema,
  normalizeCvText,
  resolveCvTextStatus,
} from './cv-text.js';

const long = 'a'.repeat(CV_TEXT_MIN_LENGTH);
const short = 'a'.repeat(CV_TEXT_MIN_LENGTH - 1);

describe('resolveCvTextStatus', () => {
  it('calls text of the threshold length or more readable, and anything shorter unreadable', () => {
    expect(resolveCvTextStatus(long, 'readable')).toBe('readable');
    expect(resolveCvTextStatus(short, 'readable')).toBe('unreadable');
    expect(resolveCvTextStatus('', 'readable')).toBe('unreadable');
  });

  it('does not count spaces around the text', () => {
    expect(resolveCvTextStatus(`   ${short}   \n\n`, 'readable')).toBe('unreadable');
  });

  it('never lets a client claim readable for text that is too short', () => {
    expect(resolveCvTextStatus(short, 'readable')).not.toBe('readable');
  });

  it('takes only failed from the client', () => {
    expect(resolveCvTextStatus(long, 'failed')).toBe('failed');
    expect(resolveCvTextStatus('', 'failed')).toBe('failed');
    // A client cannot downgrade good text to unreadable either: that status is always recomputed.
    expect(resolveCvTextStatus(long, 'unreadable')).toBe('readable');
  });
});

describe('normalizeCvText', () => {
  it('strips control characters, which cost 6 bytes each in JSON, and keeps line breaks and tabs', () => {
    expect(normalizeCvText('a\u0000b\u0007c\u001fd\u007fe\u0085f\ng\th')).toBe('abcdef\ng\th');
  });

  it('turns Windows line endings into plain ones', () => {
    expect(normalizeCvText('a\r\nb\rc')).toBe('a\nb\nc');
  });

  it('cuts text over the cap and keeps the first part', () => {
    const cut = normalizeCvText('x'.repeat(CV_TEXT_CAP) + 'TAIL');
    expect(cut).toHaveLength(CV_TEXT_CAP);
    expect(cut.endsWith('TAIL')).toBe(false);
  });

  it('keeps text exactly at the cap', () => {
    expect(normalizeCvText('x'.repeat(CV_TEXT_CAP))).toHaveLength(CV_TEXT_CAP);
  });

  it('does not leave half an emoji at the cut', () => {
    const cut = normalizeCvText('x'.repeat(CV_TEXT_CAP - 1) + '😀');
    expect(cut).toBe('x'.repeat(CV_TEXT_CAP - 1));
  });

  it('strips control characters before cutting, so they do not use up the cap', () => {
    const cut = normalizeCvText('\u0000'.repeat(1000) + 'x'.repeat(CV_TEXT_CAP));
    expect(cut).toBe('x'.repeat(CV_TEXT_CAP));
  });
});

describe('cvTextSchema', () => {
  it('accepts text and a status, and gives back the recomputed status', () => {
    expect(cvTextSchema.parse({ text: long, status: 'readable' })).toEqual({ text: long, status: 'readable' });
    expect(cvTextSchema.parse({ text: short, status: 'readable' })).toEqual({ text: short, status: 'unreadable' });
    expect(cvTextSchema.parse({ text: '', status: 'failed' })).toEqual({ text: '', status: 'failed' });
  });

  it('cuts overlong text instead of refusing it', () => {
    const result = cvTextSchema.safeParse({ text: 'x'.repeat(CV_TEXT_CAP + 5000), status: 'readable' });
    expect(result.success).toBe(true);
    expect(result.data?.text).toHaveLength(CV_TEXT_CAP);
  });

  it('is strict: unknown properties and unknown statuses are refused', () => {
    expect(cvTextSchema.safeParse({ text: long, status: 'readable', extra: 1 }).success).toBe(false);
    expect(cvTextSchema.safeParse({ text: long, status: 'great' }).success).toBe(false);
    expect(cvTextSchema.safeParse({ text: 5, status: 'readable' }).success).toBe(false);
  });
});

describe('submitApplicationSchema with CV text', () => {
  const contact = { name: 'Sara Hassan', email: 'sara@example.com', phone: '0100 123 4567', answers: {} };

  it('accepts a submit without CV text', () => {
    const result = submitApplicationSchema.safeParse(contact);
    expect(result.success).toBe(true);
    expect(result.data?.cvText).toBeUndefined();
  });

  it('accepts and normalises a CV text object', () => {
    const result = submitApplicationSchema.safeParse({ ...contact, cvText: { text: short, status: 'readable' } });
    expect(result.data?.cvText).toEqual({ text: short, status: 'unreadable' });
  });

  it('cuts overlong CV text without failing the submit', () => {
    const result = submitApplicationSchema.safeParse({
      ...contact,
      cvText: { text: 'x'.repeat(CV_TEXT_CAP * 2), status: 'readable' },
    });
    expect(result.success).toBe(true);
    expect(result.data?.cvText?.text).toHaveLength(CV_TEXT_CAP);
  });
});
