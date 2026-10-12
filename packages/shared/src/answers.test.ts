import { describe, expect, it } from 'vitest';
import { findKnockout, parseAnswers, toPublicFields } from './answers.js';
import type { FormFields } from './form-fields.js';

const ONSITE = '3f1c9a52-6f0e-4b7a-9a43-1d2c8e5b7f10';
const LEVEL = 'a8d2e7b1-0c4f-4e9d-8b21-5f6a7c8d9e01';
const ABOUT = 'c4b1f6a2-9d3e-4f70-a1b2-3c4d5e6f7a81';
const JUNIOR = '11111111-1111-4111-8111-111111111111';
const SENIOR = '22222222-2222-4222-8222-222222222222';

const fields: FormFields = [
  {
    key: ONSITE,
    type: 'yes_no',
    label: 'Can you work on-site?',
    helpText: null,
    required: true,
    config: { rejectWhen: false },
  },
  {
    key: LEVEL,
    type: 'single_select',
    label: 'Your level',
    helpText: null,
    required: true,
    config: {
      options: [
        { id: JUNIOR, label: 'Junior' },
        { id: SENIOR, label: 'Senior' },
      ],
      rejectOptionIds: [JUNIOR],
    },
  },
  {
    key: ABOUT,
    type: 'short_text',
    label: 'About you',
    helpText: null,
    required: false,
    config: { maxLength: 10 },
  },
];

describe('toPublicFields', () => {
  it('removes knockout rules', () => {
    const text = JSON.stringify(toPublicFields(fields));
    expect(text).not.toContain('rejectWhen');
    expect(text).not.toContain('rejectOptionIds');
  });

  it('keeps the options', () => {
    expect(JSON.stringify(toPublicFields(fields))).toContain('Senior');
  });
});

describe('parseAnswers', () => {
  it('accepts valid answers and trims text', () => {
    const result = parseAnswers(fields, { [ONSITE]: true, [LEVEL]: SENIOR, [ABOUT]: '  hi  ' });
    expect(result).toEqual({
      ok: true,
      answers: { [ONSITE]: true, [LEVEL]: SENIOR, [ABOUT]: 'hi' },
    });
  });

  it('treats false as an answer, not as empty', () => {
    const result = parseAnswers(fields, { [ONSITE]: false, [LEVEL]: SENIOR });
    expect(result.ok).toBe(true);
  });

  it('leaves out unanswered optional fields', () => {
    const result = parseAnswers(fields, { [ONSITE]: true, [LEVEL]: SENIOR, [ABOUT]: '   ' });
    expect(result.ok && ABOUT in result.answers).toBe(false);
  });

  it('reports missing required fields', () => {
    const result = parseAnswers(fields, { [ABOUT]: 'hi' });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.map((e) => e.path).sort()).toEqual([ONSITE, LEVEL].sort());
  });

  it('rejects an option that is not on the form', () => {
    const result = parseAnswers(fields, { [ONSITE]: true, [LEVEL]: ABOUT });
    expect(result.ok).toBe(false);
  });

  it('rejects text over the limit', () => {
    const result = parseAnswers(fields, { [ONSITE]: true, [LEVEL]: SENIOR, [ABOUT]: 'x'.repeat(11) });
    expect(result.ok).toBe(false);
  });

  it('rejects answers for unknown fields', () => {
    const result = parseAnswers(fields, { [ONSITE]: true, [LEVEL]: SENIOR, extra: 'x' });
    expect(result.ok).toBe(false);
  });

  it('rejects input that is not an object', () => {
    expect(parseAnswers(fields, []).ok).toBe(false);
    expect(parseAnswers(fields, null).ok).toBe(false);
  });
});

describe('findKnockout', () => {
  it('finds a yes/no knockout', () => {
    expect(findKnockout(fields, { [ONSITE]: false, [LEVEL]: SENIOR })?.fieldKey).toBe(ONSITE);
  });

  it('finds a select knockout', () => {
    expect(findKnockout(fields, { [ONSITE]: true, [LEVEL]: JUNIOR })?.fieldKey).toBe(LEVEL);
  });

  it('returns null when nothing triggers', () => {
    expect(findKnockout(fields, { [ONSITE]: true, [LEVEL]: SENIOR })).toBeNull();
  });
});