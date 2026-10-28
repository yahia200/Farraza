import { describe, expect, it } from 'vitest';
import { HIGHLIGHT_MAX_CHARACTERS, formatAnswerText, formatHighlightText } from './answer-text.js';
import type { LeafFormField } from './form-fields.js';

/*
 * One Question's answer as text (.scratch/highlighted-questions/spec.md, "Concept and rules"):
 * what the candidate sheet and the candidate list both show for a single-answer Question.
 */

const KEY = '9b8a7c6d-5e4f-4321-8abc-def012345678';
const SENIOR = 'a1b2c3d4-e5f6-4708-9a1b-2c3d4e5f6a7b';
const JUNIOR = 'f0e1d2c3-b4a5-4968-87a6-b5c4d3e2f1a0';
const GONE = '7a9e4c10-5d2b-4f83-9c6a-0b1d2e3f4a50';

const base = { key: KEY, label: 'Question', helpText: null, required: false };
const options = [
  { id: SENIOR, label: 'Senior' },
  { id: JUNIOR, label: 'Junior' },
];

const shortText: LeafFormField = { ...base, type: 'short_text', config: { maxLength: 500 } };
const longText: LeafFormField = { ...base, type: 'long_text', config: { maxLength: 10000 } };
const yesNo: LeafFormField = { ...base, type: 'yes_no', config: { rejectWhen: null } };
const number: LeafFormField = { ...base, type: 'number', config: { min: null, max: null, integerOnly: false } };
const date: LeafFormField = { ...base, type: 'date', config: { min: null, max: null } };
const url: LeafFormField = { ...base, type: 'url', config: {} };
const singleSelect: LeafFormField = { ...base, type: 'single_select', config: { options, rejectOptionIds: [] } };
const multiSelect: LeafFormField = { ...base, type: 'multi_select', config: { options, maxSelections: null } };

describe('formatAnswerText', () => {
  it('shows a single choice as its label, and an id the version lacks as "Unknown option"', () => {
    expect(formatAnswerText(singleSelect, JUNIOR)).toBe('Junior');
    expect(formatAnswerText(singleSelect, GONE)).toBe('Unknown option');
  });

  it('shows text as written, a yes/no as "Yes" or "No", and a number as entered, 0 included', () => {
    expect(formatAnswerText(shortText, '  Cairo ')).toBe('  Cairo ');
    expect(formatAnswerText(longText, 'A long story.')).toBe('A long story.');
    expect(formatAnswerText(yesNo, true)).toBe('Yes');
    expect(formatAnswerText(yesNo, false)).toBe('No');
    expect(formatAnswerText(number, 0)).toBe('0');
    expect(formatAnswerText(number, -2.5)).toBe('-2.5');
  });

  it('shows a date in the long US form, and text that is not a date as stored', () => {
    expect(formatAnswerText(date, '2026-02-05')).toBe('February 5, 2026');
    expect(formatAnswerText(date, '2026-02-30')).toBe('2026-02-30');
  });

  it('shows a multi-select as its labels in the order given, unknown ids included', () => {
    expect(formatAnswerText(multiSelect, [JUNIOR, GONE, SENIOR])).toEqual(['Junior', 'Unknown option', 'Senior']);
  });

  it('shows a link as the text stored, never as anything to follow', () => {
    expect(formatAnswerText(url, 'https://example.com/me')).toBe('https://example.com/me');
  });

  it('is null for a value that does not fit the question', () => {
    expect(formatAnswerText(multiSelect, JUNIOR)).toBeNull();
    expect(formatAnswerText(date, 20260205)).toBeNull();
    expect(formatAnswerText(url, 42)).toBeNull();
    expect(formatAnswerText(shortText, 3)).toBeNull();
    expect(formatAnswerText(yesNo, 'yes')).toBeNull();
    expect(formatAnswerText(number, '3')).toBeNull();
    expect(formatAnswerText(number, Number.NaN)).toBeNull();
  });

  it('is null when there is no answer', () => {
    expect(formatAnswerText(shortText, undefined)).toBeNull();
    expect(formatAnswerText(singleSelect, undefined)).toBeNull();
  });

  it('keeps blank text as written, as the sheet has always shown it', () => {
    expect(formatAnswerText(shortText, '')).toBe('');
    expect(formatAnswerText(longText, '   ')).toBe('   ');
  });
});

describe('formatHighlightText', () => {
  it('reads like the sheet for single-answer types', () => {
    expect(formatHighlightText(singleSelect, SENIOR)).toBe('Senior');
    expect(formatHighlightText(yesNo, false)).toBe('No');
    expect(formatHighlightText(number, 0)).toBe('0');
    expect(formatHighlightText(date, '2026-02-05')).toBe('February 5, 2026');
  });

  it('joins a multi-select with commas', () => {
    expect(formatHighlightText(multiSelect, [SENIOR, GONE, JUNIOR])).toBe('Senior, Unknown option, Junior');
  });

  it('shows a link as its plain, trimmed text', () => {
    expect(formatHighlightText(url, '  https://example.com/me ')).toBe('https://example.com/me');
  });

  it('is null when there is no answer', () => {
    expect(formatHighlightText(shortText, undefined)).toBeNull();
    expect(formatHighlightText(multiSelect, [])).toBeNull();
  });

  it('is null for blank text, spaces or line breaks only, like isBlankAnswer', () => {
    expect(formatHighlightText(shortText, '')).toBeNull();
    expect(formatHighlightText(shortText, '   ')).toBeNull();
    expect(formatHighlightText(longText, ' \n\t ')).toBeNull();
    expect(formatHighlightText(url, '  ')).toBeNull();
  });

  it('keeps text with words in it as written', () => {
    expect(formatHighlightText(shortText, '  Cairo ')).toBe('  Cairo ');
  });

  it('keeps 200 characters and cuts longer text there with an ellipsis', () => {
    expect(HIGHLIGHT_MAX_CHARACTERS).toBe(200);
    expect(formatHighlightText(longText, 'a'.repeat(200))).toBe('a'.repeat(200));
    expect(formatHighlightText(longText, 'a'.repeat(201))).toBe(`${'a'.repeat(200)}…`);
  });

  it('counts characters, not UTF-16 units, so an emoji at the cut is kept whole', () => {
    // 199 letters, then "😀" (two UTF-16 units, one character) as the 200th, then more.
    const text = `${'a'.repeat(199)}😀bc`;
    expect(formatHighlightText(longText, text)).toBe(`${'a'.repeat(199)}😀…`);
    // 200 emoji are 400 UTF-16 units but only 200 characters: nothing is cut.
    expect(formatHighlightText(longText, '😀'.repeat(200))).toBe('😀'.repeat(200));
  });
});
