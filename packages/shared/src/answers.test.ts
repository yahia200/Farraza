import { describe, expect, it } from 'vitest';
import { findKnockout, isBlankAnswer, isPlainObject, parseAnswers, toPublicFields } from './answers.js';
import { parseFormFields, type FormFields } from './form-fields.js';

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

  it('keeps Preset keys, on questions and on a group and its sub-questions', () => {
    const parsed = parseFormFields([
      {
        key: ABOUT,
        type: 'short_text',
        label: 'Where did you study?',
        helpText: null,
        required: false,
        presetKey: 'education.school',
        config: { maxLength: 150 },
      },
      {
        key: ONSITE,
        type: 'repeating_group',
        label: 'Jobs',
        helpText: null,
        required: false,
        presetKey: 'experience',
        config: {
          maxEntries: 3,
          fields: [
            {
              key: LEVEL,
              type: 'yes_no',
              label: 'Still there?',
              helpText: null,
              required: false,
              config: { rejectWhen: null },
            },
            {
              key: JUNIOR,
              type: 'short_text',
              label: 'Title',
              helpText: null,
              required: true,
              presetKey: 'experience.job_title',
              config: { maxLength: 100 },
            },
          ],
        },
      },
    ]);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const [school, jobs] = toPublicFields(parsed.fields);
    expect(school).toMatchObject({ presetKey: 'education.school' });
    expect(jobs).toMatchObject({
      presetKey: 'experience',
      config: { fields: [{ key: LEVEL }, { key: JUNIOR, presetKey: 'experience.job_title' }] },
    });
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

describe('file questions (Attachments)', () => {
  const SAMPLE = '5e0d7c3a-2b1f-4a69-8c7d-6e5f4a3b2c10';
  const FILE_ID = '9c2b1f3e-7a64-4d10-b5e8-0a1b2c3d4e5f';
  const sample = (required: boolean): FormFields[number] => ({
    key: SAMPLE,
    type: 'file',
    label: 'Work sample',
    helpText: null,
    required,
    config: { kinds: ['document', 'image'], maxSizeMb: 10, maxDurationSeconds: null },
  });

  it('shows applicants the limits they need to check a file before uploading', () => {
    const [publicField] = toPublicFields([sample(true)]);
    expect(publicField).toMatchObject({
      type: 'file',
      config: { kinds: ['document', 'image'], maxSizeMb: 10, maxDurationSeconds: null },
    });
  });

  it('takes the file id as the answer', () => {
    expect(parseAnswers([sample(true)], { [SAMPLE]: FILE_ID })).toEqual({
      ok: true,
      answers: { [SAMPLE]: FILE_ID },
    });
  });

  it('refuses an answer that is not a file id', () => {
    for (const value of ['my-portfolio.pdf', 42, true, [FILE_ID]]) {
      const result = parseAnswers([sample(true)], { [SAMPLE]: value });
      expect(result).toEqual({ ok: false, errors: [{ path: SAMPLE, message: 'Upload a file.' }] });
    }
  });

  it('needs a file when the question is required, and only then', () => {
    expect(parseAnswers([sample(true)], {})).toEqual({
      ok: false,
      errors: [{ path: SAMPLE, message: 'This question needs an answer.' }],
    });
    expect(parseAnswers([sample(false)], {})).toEqual({ ok: true, answers: {} });
    expect(parseAnswers([sample(false)], { [SAMPLE]: null })).toEqual({ ok: true, answers: {} });
  });
});

describe('repeating groups', () => {
  const GROUP = '7a9e4c10-5d2b-4f83-9c6a-0b1d2e3f4a50';
  const SCHOOL = 'b1c2d3e4-f5a6-4b78-8c9d-0e1f2a3b4c5d';
  const DEGREE = 'd9e8f7a6-b5c4-4d32-a1b0-9f8e7d6c5b4a';
  const CURRENT = 'e2f3a4b5-c6d7-4e89-9fa0-b1c2d3e4f5a6';
  const SUBJECTS = 'f6a7b8c9-d0e1-4f23-8a45-b6c7d8e9f0a1';
  const HIGH_SCHOOL = '33333333-3333-4333-8333-333333333333';
  const BACHELORS = '44444444-4444-4444-8444-444444444444';
  const NO_LONGER_ON_FORM = 'This question is no longer on the form. Reload the page and try again.';

  const education = (required: boolean, maxEntries = 3): FormFields[number] => ({
    key: GROUP,
    type: 'repeating_group',
    label: 'Education',
    helpText: null,
    required,
    config: {
      maxEntries,
      fields: [
        {
          key: SCHOOL,
          type: 'short_text',
          label: 'School',
          helpText: null,
          required: true,
          config: { maxLength: 10 },
        },
        {
          key: DEGREE,
          type: 'single_select',
          label: 'Degree',
          helpText: null,
          required: false,
          config: {
            options: [
              { id: HIGH_SCHOOL, label: 'High school' },
              { id: BACHELORS, label: "Bachelor's" },
            ],
            rejectOptionIds: [],
          },
        },
        {
          key: CURRENT,
          type: 'yes_no',
          label: 'Still studying?',
          helpText: null,
          required: false,
          config: { rejectWhen: null },
        },
        {
          key: SUBJECTS,
          type: 'multi_select',
          label: 'Subjects',
          helpText: null,
          required: false,
          config: {
            options: [
              { id: HIGH_SCHOOL, label: 'Maths' },
              { id: BACHELORS, label: 'Physics' },
            ],
            maxSelections: 1,
          },
        },
      ],
    },
  });

  const form = (required = false, maxEntries = 3): FormFields => [education(required, maxEntries)];
  const errorsOf = (result: ReturnType<typeof parseAnswers>) => (result.ok ? [] : result.errors);

  it('accepts Entries and trims text inside them', () => {
    const result = parseAnswers(form(), {
      [GROUP]: [
        { [SCHOOL]: '  Cairo U  ', [DEGREE]: BACHELORS },
        { [SCHOOL]: 'AUC', [SUBJECTS]: [BACHELORS] },
      ],
    });
    expect(result).toEqual({
      ok: true,
      answers: {
        [GROUP]: [
          { [SCHOOL]: 'Cairo U', [DEGREE]: BACHELORS },
          { [SCHOOL]: 'AUC', [SUBJECTS]: [BACHELORS] },
        ],
      },
    });
  });

  it('treats false as an answer inside an Entry', () => {
    const entry = { [SCHOOL]: 'AUC', [CURRENT]: false };
    expect(parseAnswers(form(), { [GROUP]: [entry] })).toEqual({ ok: true, answers: { [GROUP]: [entry] } });
    // An Entry holding only a "no" is not blank, so it must satisfy the required sub-questions.
    expect(errorsOf(parseAnswers(form(), { [GROUP]: [{ [CURRENT]: false }] }))).toEqual([
      { path: `${GROUP}.0.${SCHOOL}`, message: 'This question needs an answer.' },
    ]);
  });

  it('leaves out blank sub-answers of an Entry', () => {
    expect(parseAnswers(form(), { [GROUP]: [{ [SCHOOL]: 'AUC', [DEGREE]: null, [SUBJECTS]: [] }] })).toEqual({
      ok: true,
      answers: { [GROUP]: [{ [SCHOOL]: 'AUC' }] },
    });
  });

  it('drops fully blank Entries', () => {
    const result = parseAnswers(form(), {
      [GROUP]: [{}, { [SCHOOL]: 'AUC' }, { [SCHOOL]: '   ', [DEGREE]: null, [SUBJECTS]: [] }],
    });
    expect(result).toEqual({ ok: true, answers: { [GROUP]: [{ [SCHOOL]: 'AUC' }] } });
  });

  it('does not count blank Entries toward the limit', () => {
    const result = parseAnswers(form(false, 1), { [GROUP]: [{}, { [SCHOOL]: 'AUC' }, {}] });
    expect(result.ok).toBe(true);
  });

  it('fails a required group with no Entries left, with the usual message', () => {
    for (const value of [[], [{}], [{ [SCHOOL]: ' ' }], undefined, null]) {
      expect(parseAnswers(form(true), { [GROUP]: value })).toEqual({
        ok: false,
        errors: [{ path: GROUP, message: 'This question needs an answer.' }],
      });
    }
  });

  it('leaves an optional group with no Entries out of the answers', () => {
    for (const value of [[], [{}], undefined, null]) {
      expect(parseAnswers(form(false), { [GROUP]: value })).toEqual({ ok: true, answers: {} });
    }
    expect(parseAnswers(form(false), {})).toEqual({ ok: true, answers: {} });
  });

  it("holds an Entry with any answer to its sub-questions' own required flags", () => {
    expect(errorsOf(parseAnswers(form(), { [GROUP]: [{ [DEGREE]: BACHELORS }] }))).toEqual([
      { path: `${GROUP}.0.${SCHOOL}`, message: 'This question needs an answer.' },
    ]);
  });

  it('reports errors at <group>.<index>.<child>, indexed by position in the submitted array', () => {
    const result = parseAnswers(form(), {
      [GROUP]: [{}, { [SCHOOL]: 'x'.repeat(11) }, { [DEGREE]: BACHELORS }],
    });
    expect(errorsOf(result)).toEqual([
      { path: `${GROUP}.1.${SCHOOL}`, message: 'Keep your answer to 10 characters or fewer.' },
      { path: `${GROUP}.2.${SCHOOL}`, message: 'This question needs an answer.' },
    ]);
  });

  it('refuses more Entries than the limit', () => {
    const entries = [{ [SCHOOL]: 'A' }, { [SCHOOL]: 'B' }, { [SCHOOL]: 'C' }];
    expect(parseAnswers(form(false, 3), { [GROUP]: entries }).ok).toBe(true);
    expect(errorsOf(parseAnswers(form(false, 2), { [GROUP]: entries }))).toEqual([
      { path: GROUP, message: 'Add at most 2 entries.' },
    ]);
    expect(errorsOf(parseAnswers(form(false, 1), { [GROUP]: entries.slice(0, 2) }))).toEqual([
      { path: GROUP, message: 'Add at most 1 entry.' },
    ]);
  });

  it.each(['AUC', 7, true, { [SCHOOL]: 'AUC' }])('refuses the answer %j, which is not an array', (value) => {
    expect(errorsOf(parseAnswers(form(), { [GROUP]: value }))).toEqual([
      { path: GROUP, message: 'Add your answers as a list of entries.' },
    ]);
  });

  it.each([['AUC'], [7], [null], [[{ [SCHOOL]: 'AUC' }]]])(
    'refuses the Entry %j, which is not an object',
    (entry) => {
      expect(errorsOf(parseAnswers(form(), { [GROUP]: [{ [SCHOOL]: 'A' }, entry] }))).toEqual([
        { path: `${GROUP}.1`, message: 'Fill in this entry again.' },
      ]);
    },
  );

  it('refuses an unknown key inside an Entry', () => {
    const result = parseAnswers(form(), { [GROUP]: [{ [SCHOOL]: 'AUC', [GROUP]: 'x', extra: 'y' }] });
    expect(errorsOf(result)).toEqual([
      { path: `${GROUP}.0.${GROUP}`, message: NO_LONGER_ON_FORM },
      { path: `${GROUP}.0.extra`, message: NO_LONGER_ON_FORM },
    ]);
  });

  it('refuses an invalid choice inside an Entry', () => {
    expect(errorsOf(parseAnswers(form(), { [GROUP]: [{ [SCHOOL]: 'AUC', [DEGREE]: SCHOOL }] }))).toEqual([
      { path: `${GROUP}.0.${DEGREE}`, message: 'Choose one of the options.' },
    ]);
  });

  it('applies a multiple-choice limit to each Entry on its own', () => {
    const separate = parseAnswers(form(), {
      [GROUP]: [
        { [SCHOOL]: 'A', [SUBJECTS]: [HIGH_SCHOOL] },
        { [SCHOOL]: 'B', [SUBJECTS]: [BACHELORS] },
      ],
    });
    expect(separate.ok).toBe(true);

    const over = parseAnswers(form(), {
      [GROUP]: [{ [SCHOOL]: 'A', [SUBJECTS]: [HIGH_SCHOOL, BACHELORS] }],
    });
    expect(errorsOf(over)).toEqual([{ path: `${GROUP}.0.${SUBJECTS}`, message: 'Choose up to 1 option.' }]);
  });

  it('shows applicants the group and all its sub-questions', () => {
    const [publicGroup] = toPublicFields(form());
    expect(publicGroup).toMatchObject({
      type: 'repeating_group',
      config: { maxEntries: 3, fields: [{ key: SCHOOL }, { key: DEGREE }, { key: CURRENT }, { key: SUBJECTS }] },
    });
  });

  it('never triggers an auto-reject', () => {
    const answers = { [GROUP]: [{ [SCHOOL]: 'AUC', [DEGREE]: HIGH_SCHOOL, [CURRENT]: false }] };
    expect(findKnockout(form(), answers)).toBeNull();
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

describe('isBlankAnswer', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['an empty string', ''],
    ['spaces only', '   '],
    ['an empty list', []],
  ])('counts %s as blank', (_name, value) => {
    expect(isBlankAnswer(value)).toBe(true);
  });

  it.each([
    ['text', 'Cairo'],
    ['text with spaces around it', ' Cairo '],
    ['false (a "no" is an answer)', false],
    ['true', true],
    ['a list of choices', [JUNIOR]],
    ['a list holding a blank Entry', [{}]],
  ])('counts %s as an answer', (_name, value) => {
    expect(isBlankAnswer(value)).toBe(false);
  });
});

describe('isPlainObject', () => {
  it('accepts an object such as an Entry', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ [ONSITE]: true })).toBe(true);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a list', []],
    ['a list of Entries', [{}]],
    ['text', 'text'],
    ['a boolean', false],
  ])('refuses %s', (_name, value) => {
    expect(isPlainObject(value)).toBe(false);
  });
});
