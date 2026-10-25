import { describe, expect, it } from 'vitest';
import { findKnockout, parseAnswers, toPublicFields } from './answers.js';
import { parseFormFields, type FormFields } from './form-fields.js';

/*
 * The number, date and URL question types (.scratch/question-types/spec.md).
 * Everything goes through the public functions: a list of questions in, what
 * parses (or the path-and-message errors) out.
 */

const NUMBER = '9b8a7c6d-5e4f-4321-8abc-def012345678';
const DATE = 'a1b2c3d4-e5f6-4708-9a1b-2c3d4e5f6a7b';
const URL_KEY = 'f0e1d2c3-b4a5-4968-87a6-b5c4d3e2f1a0';
const GROUP = '7a9e4c10-5d2b-4f83-9c6a-0b1d2e3f4a50';
const SCHOOL = 'b1c2d3e4-f5a6-4b78-8c9d-0e1f2a3b4c5d';

const WRONG_TYPE_PRESET_KEY = "This question's type doesn't match its Preset. Reload the page and try again.";
const NEEDS_AN_ANSWER = 'This question needs an answer.';

const base = { helpText: null, required: false };

const numberQuestion = (config: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({
  ...base,
  key: NUMBER,
  type: 'number',
  label: 'Years of experience',
  config: { min: null, max: null, integerOnly: false, ...config },
  ...extra,
});

const dateQuestion = (config: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({
  ...base,
  key: DATE,
  type: 'date',
  label: 'Available from',
  config: { min: null, max: null, ...config },
  ...extra,
});

const urlQuestion = (extra: Record<string, unknown> = {}) => ({
  ...base,
  key: URL_KEY,
  type: 'url',
  label: 'Portfolio',
  config: {},
  ...extra,
});

const schoolQuestion = {
  ...base,
  key: SCHOOL,
  type: 'short_text',
  label: 'School',
  required: true,
  config: { maxLength: 150 },
};

const group = (fields: unknown[], extra: Record<string, unknown> = {}) => ({
  ...base,
  key: GROUP,
  type: 'repeating_group',
  label: 'Things',
  config: { fields, maxEntries: 3 },
  ...extra,
});

/** Parses a form that must be valid, so a test can run answers against it. */
function formOf(...questions: unknown[]): FormFields {
  const result = parseFormFields(questions);
  if (!result.ok) throw new Error(`Test form is invalid: ${JSON.stringify(result.errors)}`);
  return result.fields;
}

const answersFor = (fields: FormFields, input: unknown) => parseAnswers(toPublicFields(fields), input);
const errorsOf = (result: ReturnType<typeof parseAnswers>) => (result.ok ? [] : result.errors);

describe('question types: form validation', () => {
  it('accepts one question of each type, with and without limits', () => {
    expect(parseFormFields([numberQuestion(), dateQuestion(), urlQuestion()])).toMatchObject({ ok: true });
    expect(
      parseFormFields([
        numberQuestion({ min: 0, max: 40, integerOnly: true }),
        dateQuestion({ min: '2026-01-01', max: '2026-12-31' }),
      ]),
    ).toMatchObject({ ok: true });
  });

  it('accepts a number limit equal on both sides, and a negative or fractional one', () => {
    expect(parseFormFields([numberQuestion({ min: 5, max: 5 })])).toMatchObject({ ok: true });
    expect(parseFormFields([numberQuestion({ min: -2.5, max: 0.5 })])).toMatchObject({ ok: true });
  });

  it('refuses a number minimum above the maximum, pointing at the minimum', () => {
    expect(parseFormFields([numberQuestion({ min: 10, max: 5 })])).toEqual({
      ok: false,
      errors: [{ path: '0.config.min', message: "The minimum can't be more than the maximum." }],
    });
  });

  it.each(['min', 'max'])('refuses a number %s that is not a finite number', (side) => {
    for (const bad of ['5', Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(parseFormFields([numberQuestion({ [side]: bad })])).toMatchObject({
        ok: false,
        errors: [{ path: `0.config.${side}` }],
      });
    }
  });

  it('refuses a number question without its whole-numbers setting', () => {
    expect(parseFormFields([{ ...numberQuestion(), config: { min: null, max: null } }])).toMatchObject({
      ok: false,
      errors: [{ path: '0.config.integerOnly' }],
    });
  });

  it('refuses a date minimum after the maximum, pointing at the minimum, and accepts the same day', () => {
    expect(parseFormFields([dateQuestion({ min: '2026-06-02', max: '2026-06-01' })])).toEqual({
      ok: false,
      errors: [{ path: '0.config.min', message: "The earliest date can't be after the latest." }],
    });
    expect(parseFormFields([dateQuestion({ min: '2026-06-01', max: '2026-06-01' })])).toMatchObject({ ok: true });
  });

  it.each(['2026-02-30', '2026-2-5', 'tomorrow', '', 20260101])(
    'refuses %j as a date limit, pointing at it',
    (bad) => {
      expect(parseFormFields([dateQuestion({ min: bad })])).toEqual({
        ok: false,
        errors: [{ path: '0.config.min', message: 'Enter a date.' }],
      });
      expect(parseFormFields([dateQuestion({ max: bad })])).toEqual({
        ok: false,
        errors: [{ path: '0.config.max', message: 'Enter a date.' }],
      });
    },
  );

  it('accepts a leap day and refuses a day that does not exist', () => {
    expect(parseFormFields([dateQuestion({ min: '2028-02-29' })])).toMatchObject({ ok: true });
    expect(parseFormFields([dateQuestion({ min: '2027-02-29' })])).toMatchObject({ ok: false });
  });

  it('has no auto-reject rules: a rule sent with a question is not kept', () => {
    const result = parseFormFields([
      numberQuestion({ rejectWhen: true, rejectOptionIds: [] }),
      dateQuestion({ rejectWhen: true }),
      urlQuestion({ config: { rejectWhen: true } }),
    ]);
    expect(result).toMatchObject({ ok: true });
    expect(result.ok && JSON.stringify(result.fields)).not.toContain('reject');
  });

  it('accepts the three types inside a group, with their own rules checked there', () => {
    expect(parseFormFields([group([schoolQuestion, numberQuestion(), dateQuestion(), urlQuestion()])])).toMatchObject({
      ok: true,
    });
    expect(parseFormFields([group([schoolQuestion, numberQuestion({ min: 3, max: 1 })])])).toEqual({
      ok: false,
      errors: [{ path: '0.config.fields.1.config.min', message: "The minimum can't be more than the maximum." }],
    });
    expect(parseFormFields([group([dateQuestion({ min: '2026-06-02', max: '2026-06-01' })])])).toMatchObject({
      ok: false,
      errors: [{ path: '0.config.fields.0.config.min' }],
    });
  });

  it('refuses a Preset key that belongs to another type, pointing at it', () => {
    expect(parseFormFields([urlQuestion({ presetKey: 'education.school' })])).toEqual({
      ok: false,
      errors: [{ path: '0.presetKey', message: WRONG_TYPE_PRESET_KEY }],
    });
  });
});

describe('number answers', () => {
  const answer = (config: Record<string, unknown>, value: unknown, required = false) => {
    const fields = formOf(numberQuestion(config, { required }));
    return answersFor(fields, { [NUMBER]: value });
  };

  it('accepts a number, and 0 as an answer', () => {
    expect(answer({}, 3.5)).toEqual({ ok: true, answers: { [NUMBER]: 3.5 } });
    expect(answer({}, 0, true)).toEqual({ ok: true, answers: { [NUMBER]: 0 } });
    expect(answer({}, -4)).toEqual({ ok: true, answers: { [NUMBER]: -4 } });
  });

  it('accepts the limits themselves and refuses a number outside them', () => {
    const config = { min: 1, max: 10 };
    expect(answer(config, 1).ok).toBe(true);
    expect(answer(config, 10).ok).toBe(true);
    expect(errorsOf(answer(config, 0.9))).toEqual([{ path: NUMBER, message: 'Enter a number of at least 1.' }]);
    expect(errorsOf(answer(config, 10.1))).toEqual([{ path: NUMBER, message: 'Enter a number of at most 10.' }]);
  });

  it('refuses a fraction when only whole numbers are allowed', () => {
    expect(answer({ integerOnly: true }, 2).ok).toBe(true);
    expect(errorsOf(answer({ integerOnly: true }, 2.5))).toEqual([{ path: NUMBER, message: 'Enter a whole number.' }]);
  });

  it.each(['3', true, [3], { n: 3 }, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'refuses %j, which is not a finite number',
    (value) => {
      expect(errorsOf(answer({}, value))).toEqual([{ path: NUMBER, message: 'Enter a number.' }]);
    },
  );

  it('skips an optional blank answer and fails a required one with the usual message', () => {
    expect(answer({}, null)).toEqual({ ok: true, answers: {} });
    expect(answer({}, undefined)).toEqual({ ok: true, answers: {} });
    expect(errorsOf(answer({}, null, true))).toEqual([{ path: NUMBER, message: NEEDS_AN_ANSWER }]);
  });
});

describe('date answers', () => {
  const answer = (config: Record<string, unknown>, value: unknown, required = false) => {
    const fields = formOf(dateQuestion(config, { required }));
    return answersFor(fields, { [DATE]: value });
  };

  it('accepts an ISO date, a leap day, and returns it unchanged', () => {
    expect(answer({}, '2026-02-05')).toEqual({ ok: true, answers: { [DATE]: '2026-02-05' } });
    expect(answer({}, '2028-02-29').ok).toBe(true);
  });

  it.each(['2026-02-30', '2027-02-29', '2026-2-5', '2026-02-5', '02/05/2026', '2026-02-05T00:00', ' 2026-02-05', 'soon'])(
    'refuses %j as a date',
    (value) => {
      expect(errorsOf(answer({}, value))).toEqual([{ path: DATE, message: 'Enter a date.' }]);
    },
  );

  it.each([20260205, true, ['2026-02-05'], {}])('refuses %j, which is not text', (value) => {
    expect(errorsOf(answer({}, value))).toEqual([{ path: DATE, message: 'Enter a date.' }]);
  });

  it('accepts the limits themselves and refuses a date outside them', () => {
    const config = { min: '2026-01-10', max: '2026-01-20' };
    expect(answer(config, '2026-01-10').ok).toBe(true);
    expect(answer(config, '2026-01-20').ok).toBe(true);
    expect(errorsOf(answer(config, '2026-01-09'))).toEqual([
      { path: DATE, message: 'Choose a date on or after 2026-01-10.' },
    ]);
    expect(errorsOf(answer(config, '2026-01-21'))).toEqual([
      { path: DATE, message: 'Choose a date on or before 2026-01-20.' },
    ]);
  });

  it('skips an optional blank answer and fails a required one with the usual message', () => {
    expect(answer({}, '')).toEqual({ ok: true, answers: {} });
    expect(answer({}, null)).toEqual({ ok: true, answers: {} });
    expect(errorsOf(answer({}, '  ', true))).toEqual([{ path: DATE, message: NEEDS_AN_ANSWER }]);
  });
});

describe('URL answers', () => {
  const answer = (value: unknown, required = false) => {
    const fields = formOf(urlQuestion({ required }));
    return answersFor(fields, { [URL_KEY]: value });
  };
  const NOT_A_LINK = 'Enter a web address that starts with http:// or https://.';

  it('accepts an http or https address and trims it', () => {
    expect(answer('https://example.com/me')).toEqual({ ok: true, answers: { [URL_KEY]: 'https://example.com/me' } });
    expect(answer('  http://example.com  ')).toEqual({ ok: true, answers: { [URL_KEY]: 'http://example.com' } });
  });

  it.each(['javascript:alert(1)', 'ftp://example.com/file', 'mailto:me@example.com', 'data:text/html,hi', 'example.com', 'www.example.com/me', 'https://', 'https:// spaced.com'])(
    'refuses %j',
    (value) => {
      expect(errorsOf(answer(value))).toEqual([{ path: URL_KEY, message: NOT_A_LINK }]);
    },
  );

  it('refuses an answer that is not text', () => {
    expect(errorsOf(answer(42))).toEqual([{ path: URL_KEY, message: NOT_A_LINK }]);
  });

  it('accepts 2,048 characters and refuses more', () => {
    const prefix = 'https://example.com/';
    expect(answer(prefix + 'a'.repeat(2048 - prefix.length)).ok).toBe(true);
    expect(errorsOf(answer(prefix + 'a'.repeat(2049 - prefix.length)))).toEqual([
      { path: URL_KEY, message: 'Keep the link to 2,048 characters or fewer.' },
    ]);
  });

  it('skips an optional blank answer and fails a required one with the usual message', () => {
    expect(answer('   ')).toEqual({ ok: true, answers: {} });
    expect(errorsOf(answer('', true))).toEqual([{ path: URL_KEY, message: NEEDS_AN_ANSWER }]);
  });
});

describe('number, date and URL answers inside a repeating group', () => {
  const fields = formOf(
    group([
      numberQuestion({ min: 1950, max: 2100, integerOnly: true }),
      dateQuestion({ min: '2000-01-01' }),
      urlQuestion(),
    ]),
  );

  it('accepts Entries with all three types', () => {
    const entries = [{ [NUMBER]: 2020, [DATE]: '2021-05-04', [URL_KEY]: ' https://example.com ' }];
    expect(answersFor(fields, { [GROUP]: entries })).toEqual({
      ok: true,
      answers: { [GROUP]: [{ [NUMBER]: 2020, [DATE]: '2021-05-04', [URL_KEY]: 'https://example.com' }] },
    });
  });

  it('reports errors at <group>.<index>.<child>', () => {
    const result = answersFor(fields, {
      [GROUP]: [{ [NUMBER]: 2020 }, { [NUMBER]: 1900, [DATE]: '2026-02-30', [URL_KEY]: 'javascript:alert(1)' }],
    });
    expect(errorsOf(result).map((e) => e.path)).toEqual([
      `${GROUP}.1.${NUMBER}`,
      `${GROUP}.1.${DATE}`,
      `${GROUP}.1.${URL_KEY}`,
    ]);
  });

  it('counts 0 as an answer, so an Entry holding only 0 is kept', () => {
    const zero = formOf(group([numberQuestion()]));
    expect(answersFor(zero, { [GROUP]: [{ [NUMBER]: 0 }, {}] })).toEqual({
      ok: true,
      answers: { [GROUP]: [{ [NUMBER]: 0 }] },
    });
  });

  it('drops an Entry whose three answers are all blank', () => {
    expect(answersFor(fields, { [GROUP]: [{ [NUMBER]: null, [DATE]: '', [URL_KEY]: '  ' }] })).toEqual({
      ok: true,
      answers: {},
    });
  });

  it('holds a required sub-question to an answer once the Entry has any', () => {
    const required = formOf(group([numberQuestion({}, { required: true }), dateQuestion()]));
    expect(errorsOf(answersFor(required, { [GROUP]: [{ [DATE]: '2026-01-01' }] }))).toEqual([
      { path: `${GROUP}.0.${NUMBER}`, message: NEEDS_AN_ANSWER },
    ]);
  });
});

describe('number, date and URL questions and the rest of the form', () => {
  it('shows applicants all three types whole', () => {
    const questions = [
      numberQuestion({ min: 1, max: 9, integerOnly: true }),
      dateQuestion({ min: '2026-01-01', max: '2026-12-31' }),
      urlQuestion(),
    ];
    const fields = formOf(...questions);
    expect(toPublicFields(fields)).toEqual(fields);
  });

  it('never triggers an auto-reject', () => {
    const fields = formOf(numberQuestion(), dateQuestion(), urlQuestion());
    const answers = { [NUMBER]: 0, [DATE]: '2026-01-01', [URL_KEY]: 'https://example.com' };
    expect(findKnockout(fields, answers)).toBeNull();
  });
});
