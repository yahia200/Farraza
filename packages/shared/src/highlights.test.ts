import { describe, expect, it } from 'vitest';
import { parseFormFields, type FormFields } from './form-fields.js';
import {
  HIGHLIGHT_LIMIT,
  checkHighlightKeys,
  highlightableQuestions,
  highlightedQuestionKeysSchema,
  isHighlightable,
} from './highlights.js';
import { saveHighlightedQuestionsSchema } from './jobs.js';

/*
 * Highlighted questions (.scratch/highlighted-questions/spec.md, "Concept and rules"): which
 * Questions a Job may show on its candidate list, and the check on a saved list of keys.
 */

const KEYS = {
  shortText: '10000000-0000-4000-8000-000000000001',
  longText: '10000000-0000-4000-8000-000000000002',
  singleSelect: '10000000-0000-4000-8000-000000000003',
  multiSelect: '10000000-0000-4000-8000-000000000004',
  yesNo: '10000000-0000-4000-8000-000000000005',
  number: '10000000-0000-4000-8000-000000000006',
  date: '10000000-0000-4000-8000-000000000007',
  url: '10000000-0000-4000-8000-000000000008',
  file: '10000000-0000-4000-8000-000000000009',
  group: '10000000-0000-4000-8000-00000000000a',
  subQuestion: '10000000-0000-4000-8000-00000000000b',
} as const;
const NOT_ON_FORM = '20000000-0000-4000-8000-000000000000';

const base = { helpText: null, required: false };
const options = [
  { id: '30000000-0000-4000-8000-000000000001', label: 'One' },
  { id: '30000000-0000-4000-8000-000000000002', label: 'Two' },
];

/** One Question of each of the ten types, top level, in this order; the group holds one sub-question. */
const allTypes = [
  { ...base, key: KEYS.shortText, type: 'short_text', label: 'City', config: { maxLength: 100 } },
  { ...base, key: KEYS.longText, type: 'long_text', label: 'About you', config: { maxLength: 1000 } },
  { ...base, key: KEYS.singleSelect, type: 'single_select', label: 'Level', config: { options, rejectOptionIds: [] } },
  { ...base, key: KEYS.multiSelect, type: 'multi_select', label: 'Skills', config: { options, maxSelections: null } },
  { ...base, key: KEYS.yesNo, type: 'yes_no', label: 'On site?', config: { rejectWhen: null } },
  { ...base, key: KEYS.number, type: 'number', label: 'Years', config: { min: null, max: null, integerOnly: false } },
  { ...base, key: KEYS.date, type: 'date', label: 'Available from', config: { min: null, max: null } },
  { ...base, key: KEYS.url, type: 'url', label: 'Portfolio', config: {} },
  {
    ...base,
    key: KEYS.file,
    type: 'file',
    label: 'Sample',
    config: { kinds: ['document'], maxSizeMb: 10, maxDurationSeconds: null },
  },
  {
    ...base,
    key: KEYS.group,
    type: 'repeating_group',
    label: 'Education',
    config: {
      maxEntries: 3,
      fields: [{ ...base, key: KEYS.subQuestion, type: 'short_text', label: 'School', config: { maxLength: 100 } }],
    },
  },
];

/** Parses a form that must be valid. */
function formOf(questions: unknown[]): FormFields {
  const result = parseFormFields(questions);
  if (!result.ok) throw new Error(`Test form is invalid: ${JSON.stringify(result.errors)}`);
  return result.fields;
}

const form = formOf(allTypes);

describe('isHighlightable', () => {
  it('allows three Highlighted questions', () => {
    expect(HIGHLIGHT_LIMIT).toBe(3);
  });

  it.each([
    ['short_text', KEYS.shortText],
    ['long_text', KEYS.longText],
    ['single_select', KEYS.singleSelect],
    ['multi_select', KEYS.multiSelect],
    ['yes_no', KEYS.yesNo],
    ['number', KEYS.number],
    ['date', KEYS.date],
    ['url', KEYS.url],
  ])('allows a top-level %s Question', (_type, key) => {
    expect(isHighlightable(form, key)).toBe(true);
  });

  it.each([
    ['a file Question', KEYS.file],
    ['a repeating group', KEYS.group],
    ["a group's sub-question, even of an allowed type", KEYS.subQuestion],
    ['a key the form does not have', NOT_ON_FORM],
  ])('refuses %s', (_what, key) => {
    expect(isHighlightable(form, key)).toBe(false);
  });
});

describe('highlightableQuestions', () => {
  it('lists the highlightable Questions in form order, leaving the others out', () => {
    expect(highlightableQuestions(form).map((question) => question.key)).toEqual([
      KEYS.shortText,
      KEYS.longText,
      KEYS.singleSelect,
      KEYS.multiSelect,
      KEYS.yesNo,
      KEYS.number,
      KEYS.date,
      KEYS.url,
    ]);
  });

  it('follows the form when the Questions are reordered', () => {
    const reordered = formOf([allTypes[9], allTypes[7], allTypes[8], allTypes[0]]);
    expect(highlightableQuestions(reordered).map((question) => question.label)).toEqual(['Portfolio', 'City']);
  });
});

describe('highlightedQuestionKeysSchema', () => {
  const parse = (keys: unknown) => highlightedQuestionKeysSchema.safeParse(keys);

  it('accepts no keys, and up to three unique UUIDs', () => {
    expect(parse([]).success).toBe(true);
    expect(parse([KEYS.url, KEYS.shortText, KEYS.date])).toMatchObject({
      success: true,
      data: [KEYS.url, KEYS.shortText, KEYS.date],
    });
  });

  it('refuses more than three', () => {
    expect(parse([KEYS.url, KEYS.shortText, KEYS.date, KEYS.number]).error?.issues).toMatchObject([
      { path: [], message: 'Choose up to 3 questions.' },
    ]);
  });

  it('refuses a key given twice, pointing at the repeat', () => {
    expect(parse([KEYS.url, KEYS.date, KEYS.url]).error?.issues).toMatchObject([{ path: [2] }]);
  });

  it.each(['not-a-uuid', '', 42, null])('refuses %j as a key', (bad) => {
    expect(parse([KEYS.url, bad]).error?.issues).toMatchObject([{ path: [1] }]);
  });

  it('is wrapped in a strict request body', () => {
    expect(saveHighlightedQuestionsSchema.safeParse({ keys: [KEYS.url] }).success).toBe(true);
    expect(saveHighlightedQuestionsSchema.safeParse({ keys: [KEYS.url], extra: true }).success).toBe(false);
    expect(saveHighlightedQuestionsSchema.safeParse({}).success).toBe(false);
  });
});

describe('checkHighlightKeys', () => {
  it('accepts keys of highlightable Questions on the form, unchanged', () => {
    expect(checkHighlightKeys([KEYS.url, KEYS.shortText], form)).toEqual({
      ok: true,
      keys: [KEYS.url, KEYS.shortText],
    });
    expect(checkHighlightKeys([], form)).toEqual({ ok: true, keys: [] });
  });

  it('refuses a key the form does not have, with its index as the path', () => {
    expect(checkHighlightKeys([KEYS.url, NOT_ON_FORM], form)).toEqual({
      ok: false,
      errors: [{ path: '1', message: "This question isn't on the published form. Reload the page and try again." }],
    });
  });

  it('refuses a group, a sub-question and a file Question, one error per bad key', () => {
    expect(checkHighlightKeys([KEYS.group, KEYS.url, KEYS.subQuestion, KEYS.file], form)).toEqual({
      ok: false,
      errors: [
        { path: '0', message: "This question can't be shown in the list." },
        { path: '2', message: "This question can't be shown in the list." },
        { path: '3', message: "This question can't be shown in the list." },
      ],
    });
  });
});
