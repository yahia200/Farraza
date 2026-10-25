import { describe, expect, it } from 'vitest';
import { MAX_FIELDS, parseFormFields } from './form-fields.js';

const UNKNOWN_PRESET_KEY = "This question's Preset isn't recognised. Reload the page and try again.";
const WRONG_TYPE_PRESET_KEY = "This question's type doesn't match its Preset. Reload the page and try again.";
const DUPLICATE_PRESET_KEY = 'This Preset is already on the form.';

const ABOUT = 'c4b1f6a2-9d3e-4f70-a1b2-3c4d5e6f7a81';
const PORTFOLIO = '5e0d7c3a-2b1f-4a69-8c7d-6e5f4a3b2c10';

const shortText = {
  key: ABOUT,
  type: 'short_text',
  label: 'About you',
  helpText: null,
  required: true,
  config: { maxLength: 200 },
};

const fileQuestion = (config: Record<string, unknown>) => ({
  key: PORTFOLIO,
  type: 'file',
  label: 'Portfolio sample',
  helpText: 'A PDF or a screenshot',
  required: false,
  config,
});

const validFileConfig = { kinds: ['document', 'image'], maxSizeMb: 10, maxDurationSeconds: null };

const GROUP = '7a9e4c10-5d2b-4f83-9c6a-0b1d2e3f4a50';
const SCHOOL = 'b1c2d3e4-f5a6-4b78-8c9d-0e1f2a3b4c5d';
const DEGREE = 'd9e8f7a6-b5c4-4d32-a1b0-9f8e7d6c5b4a';
const HIGH_SCHOOL = '33333333-3333-4333-8333-333333333333';
const BACHELORS = '44444444-4444-4444-8444-444444444444';

const schoolQuestion = {
  key: SCHOOL,
  type: 'short_text',
  label: 'School',
  helpText: null,
  required: true,
  config: { maxLength: 150 },
};

const degreeQuestion = {
  key: DEGREE,
  type: 'single_select',
  label: 'Degree',
  helpText: null,
  required: true,
  config: {
    options: [
      { id: HIGH_SCHOOL, label: 'High school' },
      { id: BACHELORS, label: "Bachelor's" },
    ],
    rejectOptionIds: [],
  },
};

/** A repeating group; the sub-questions are the ones the test is about. */
const group = (
  fields: unknown[] = [schoolQuestion, degreeQuestion],
  config: Record<string, unknown> = {},
) => ({
  key: GROUP,
  type: 'repeating_group',
  label: 'Education',
  helpText: null,
  required: false,
  config: { fields, maxEntries: 5, ...config },
});

describe('parseFormFields', () => {
  it('accepts a valid form', () => {
    expect(parseFormFields([shortText])).toMatchObject({ ok: true });
  });

  describe('file questions (Attachments)', () => {
    it('accepts documents and images with a size limit', () => {
      expect(parseFormFields([shortText, fileQuestion(validFileConfig)])).toMatchObject({ ok: true });
      expect(
        parseFormFields([fileQuestion({ kinds: ['image'], maxSizeMb: 1, maxDurationSeconds: null })]),
      ).toMatchObject({ ok: true });
      expect(
        parseFormFields([fileQuestion({ kinds: ['document'], maxSizeMb: 200, maxDurationSeconds: null })]),
      ).toMatchObject({ ok: true });
    });

    it('needs at least one kind, pointing at the kinds', () => {
      expect(parseFormFields([fileQuestion({ ...validFileConfig, kinds: [] })])).toEqual({
        ok: false,
        errors: [{ path: '0.config.kinds', message: 'Choose at least one kind of file.' }],
      });
    });

    it('refuses a kind listed twice', () => {
      const result = parseFormFields([fileQuestion({ ...validFileConfig, kinds: ['image', 'image'] })]);
      expect(result).toMatchObject({ ok: false, errors: [{ path: '0.config.kinds' }] });
    });

    it.each(['pdf', 'svg', 'spreadsheet'])(
      'refuses the unknown kind %j (the old pdf/image/document names are gone)',
      (kind) => {
        const result = parseFormFields([fileQuestion({ ...validFileConfig, kinds: [kind] })]);
        expect(result).toMatchObject({ ok: false, errors: [{ path: '0.config.kinds.0' }] });
      },
    );

    it.each([0, -1, 201, 10.5, Number.NaN])('refuses the size limit %s, pointing at the size', (maxSizeMb) => {
      expect(parseFormFields([fileQuestion({ ...validFileConfig, maxSizeMb })])).toEqual({
        ok: false,
        errors: [{ path: '0.config.maxSizeMb', message: 'Set a file size limit from 1 to 200 MB.' }],
      });
    });

    it('refuses the previous config shape', () => {
      const result = parseFormFields([fileQuestion({ allowedTypes: ['pdf'], maxSizeMb: 5 })]);
      expect(result.ok).toBe(false);
    });

    it('allows a duration limit only with video or audio', () => {
      expect(parseFormFields([fileQuestion({ ...validFileConfig, maxDurationSeconds: 60 })])).toEqual({
        ok: false,
        errors: [
          { path: '0.config.maxDurationSeconds', message: 'A length limit only applies to video and audio.' },
        ],
      });
    });

    describe('video and audio', () => {
      it.each([
        [['video']],
        [['audio']],
        [['video', 'audio']],
        [['document', 'image', 'video', 'audio']],
      ])('accepts %j with a length limit', (kinds) => {
        const config = { kinds, maxSizeMb: 100, maxDurationSeconds: 90 };
        expect(parseFormFields([fileQuestion(config)])).toMatchObject({ ok: true });
      });

      it.each([['video'], ['audio'], ['document', 'audio']])(
        'needs a length limit when %j is allowed, pointing at the limit',
        (...kinds) => {
          const config = { kinds, maxSizeMb: 100, maxDurationSeconds: null };
          expect(parseFormFields([fileQuestion(config)])).toEqual({
            ok: false,
            errors: [
              {
                path: '0.config.maxDurationSeconds',
                message: 'Set a length limit for video and audio files.',
              },
            ],
          });
        },
      );

      it.each([0, -5, 1.5, Number.NaN])('refuses the length limit %s', (maxDurationSeconds) => {
        const config = { kinds: ['video'], maxSizeMb: 100, maxDurationSeconds };
        const result = parseFormFields([fileQuestion(config)]);
        expect(result).toMatchObject({ ok: false, errors: [{ path: '0.config.maxDurationSeconds' }] });
      });

      it('accepts a one-second limit', () => {
        const config = { kinds: ['audio'], maxSizeMb: 25, maxDurationSeconds: 1 };
        expect(parseFormFields([fileQuestion(config)])).toMatchObject({ ok: true });
      });
    });
  });

  describe('repeating groups', () => {
    it('accepts a group of leaf questions', () => {
      expect(parseFormFields([shortText, group()])).toMatchObject({ ok: true });
    });

    it('counts a group as one question toward the form limit', () => {
      const others = Array.from({ length: MAX_FIELDS - 1 }, (_, i) => ({
        ...shortText,
        key: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      }));
      expect(parseFormFields([...others, group()])).toMatchObject({ ok: true });
      expect(parseFormFields([...others, group(), { ...shortText, key: SCHOOL.replace('b', 'a') }])).toMatchObject({
        ok: false,
        errors: [{ path: '', message: `A form can have at most ${MAX_FIELDS} questions.` }],
      });
    });

    it.each([1, 10])('accepts an entry limit of %s', (maxEntries) => {
      expect(parseFormFields([group(undefined, { maxEntries })])).toMatchObject({ ok: true });
    });

    it.each([0, 11, 2.5, Number.NaN])('refuses the entry limit %s, pointing at the limit', (maxEntries) => {
      expect(parseFormFields([group(undefined, { maxEntries })])).toEqual({
        ok: false,
        errors: [{ path: '0.config.maxEntries', message: 'Set an entry limit from 1 to 10.' }],
      });
    });

    it('refuses a group with no questions in it', () => {
      expect(parseFormFields([group([])])).toMatchObject({
        ok: false,
        errors: [{ path: '0.config.fields' }],
      });
    });

    it.each([
      ['a file question', { ...fileQuestion(validFileConfig), key: SCHOOL }],
      ['a nested group', { ...group([schoolQuestion]), key: SCHOOL }],
    ])('refuses %s inside a group, pointing at its type', (_name, child) => {
      expect(parseFormFields([group([degreeQuestion, child])])).toEqual({
        ok: false,
        errors: [
          {
            path: '0.config.fields.1.type',
            message: 'Only text, choice, yes/no, number, date and link questions can go inside a group.',
          },
        ],
      });
    });

    it('refuses an auto-reject rule on a single-choice sub-question', () => {
      const withRule = {
        ...degreeQuestion,
        config: { ...degreeQuestion.config, rejectOptionIds: [HIGH_SCHOOL] },
      };
      expect(parseFormFields([group([schoolQuestion, withRule])])).toEqual({
        ok: false,
        errors: [
          {
            path: '0.config.fields.1.config.rejectOptionIds',
            message: "Auto-reject rules aren't available inside a group.",
          },
        ],
      });
    });

    it('refuses an auto-reject rule on a yes/no sub-question, but not the absence of one', () => {
      const yesNo = (rejectWhen: boolean | null) => ({
        key: SCHOOL,
        type: 'yes_no',
        label: 'Did you graduate?',
        helpText: null,
        required: false,
        config: { rejectWhen },
      });
      expect(parseFormFields([group([yesNo(null)])])).toMatchObject({ ok: true });
      for (const rejectWhen of [true, false]) {
        expect(parseFormFields([group([yesNo(rejectWhen)])])).toEqual({
          ok: false,
          errors: [
            {
              path: '0.config.fields.0.config.rejectWhen',
              message: "Auto-reject rules aren't available inside a group.",
            },
          ],
        });
      }
    });

    it('refuses two sub-questions with the same key', () => {
      expect(parseFormFields([group([schoolQuestion, { ...degreeQuestion, key: SCHOOL }])])).toMatchObject({
        ok: false,
        errors: [{ path: '0.config.fields.1.key' }],
      });
    });

    it('refuses a sub-question key that is also a top-level key, in either order', () => {
      const clash = { ...schoolQuestion, key: ABOUT };
      expect(parseFormFields([shortText, group([clash])])).toMatchObject({
        ok: false,
        errors: [{ path: '1.config.fields.0.key' }],
      });
      expect(parseFormFields([group([clash]), shortText])).toMatchObject({
        ok: false,
        errors: [{ path: '1.key' }],
      });
    });

    it('refuses a sub-question key equal to the group key', () => {
      expect(parseFormFields([group([{ ...schoolQuestion, key: GROUP }])])).toMatchObject({
        ok: false,
        errors: [{ path: '0.config.fields.0.key' }],
      });
    });

    it('checks a sub-question like any other question', () => {
      const oneOption = {
        ...degreeQuestion,
        config: { ...degreeQuestion.config, options: [{ id: HIGH_SCHOOL, label: 'High school' }] },
      };
      expect(parseFormFields([group([oneOption])])).toEqual({
        ok: false,
        errors: [{ path: '0.config.fields.0.config.options', message: 'Add at least 2 options.' }],
      });

      const tooMany = {
        key: SCHOOL,
        type: 'multi_select',
        label: 'Subjects',
        helpText: null,
        required: false,
        config: { options: degreeQuestion.config.options, maxSelections: 3 },
      };
      expect(parseFormFields([group([tooMany])])).toMatchObject({
        ok: false,
        errors: [{ path: '0.config.fields.0.config.maxSelections' }],
      });

      const repeatedOption = {
        ...degreeQuestion,
        config: {
          ...degreeQuestion.config,
          options: [
            { id: HIGH_SCHOOL, label: 'A' },
            { id: HIGH_SCHOOL, label: 'B' },
          ],
        },
      };
      expect(parseFormFields([group([repeatedOption])])).toMatchObject({
        ok: false,
        errors: [{ path: '0.config.fields.0.config.options' }],
      });
    });
  });

  describe('Preset keys', () => {
    const ABOUT_2 = '8d7c6b5a-4e3f-4a21-b0c9-d8e7f6a5b4c3';

    it('accepts a question with no Preset key, a null one and a valid one', () => {
      const result = parseFormFields([
        shortText,
        { ...shortText, key: ABOUT_2, presetKey: null },
        group([{ ...schoolQuestion, presetKey: 'education.school' }]),
      ]);
      expect(result).toMatchObject({ ok: true });
      expect(result.ok && result.fields.map((field) => field.presetKey ?? null)).toEqual([null, null, null]);
      expect(result.ok && result.fields[2]).toMatchObject({
        config: { fields: [{ presetKey: 'education.school' }] },
      });
    });

    it('keeps a Preset key on every question type', () => {
      const result = parseFormFields([
        { ...group(), presetKey: 'education' },
        { ...shortText, presetKey: 'experience.job_title' },
        { ...shortText, key: ABOUT_2, presetKey: 'experience.company' },
      ]);
      expect(result).toMatchObject({ ok: true });
      expect(result.ok && result.fields.map((field) => field.presetKey)).toEqual([
        'education',
        'experience.job_title',
        'experience.company',
      ]);
    });

    it('refuses an unknown Preset key, pointing at it', () => {
      expect(parseFormFields([{ ...shortText, presetKey: 'education.shoe_size' }])).toEqual({
        ok: false,
        errors: [{ path: '0.presetKey', message: UNKNOWN_PRESET_KEY }],
      });
      expect(parseFormFields([group([{ ...schoolQuestion, presetKey: 'nope' }])])).toEqual({
        ok: false,
        errors: [{ path: '0.config.fields.0.presetKey', message: UNKNOWN_PRESET_KEY }],
      });
    });

    it('refuses a Preset key that is not a string', () => {
      expect(parseFormFields([{ ...shortText, presetKey: 7 }])).toEqual({
        ok: false,
        errors: [{ path: '0.presetKey', message: UNKNOWN_PRESET_KEY }],
      });
    });

    it('refuses a Preset key on a question of the wrong type, pointing at it', () => {
      const yesNo = {
        key: ABOUT_2,
        type: 'yes_no',
        label: 'Did you graduate?',
        helpText: null,
        required: false,
        config: { rejectWhen: null },
      };
      // A school key on a yes/no, and the group key on a short text.
      expect(parseFormFields([{ ...yesNo, presetKey: 'education.school' }])).toEqual({
        ok: false,
        errors: [{ path: '0.presetKey', message: WRONG_TYPE_PRESET_KEY }],
      });
      expect(parseFormFields([{ ...shortText, presetKey: 'education' }])).toEqual({
        ok: false,
        errors: [{ path: '0.presetKey', message: WRONG_TYPE_PRESET_KEY }],
      });
      // A text key on a single choice, inside a group.
      expect(parseFormFields([group([{ ...degreeQuestion, presetKey: 'education.school' }])])).toEqual({
        ok: false,
        errors: [{ path: '0.config.fields.0.presetKey', message: WRONG_TYPE_PRESET_KEY }],
      });
    });

    it('takes the year and date Preset keys on number and date questions and refuses them on short text', () => {
      const yearQuestion = {
        key: ABOUT_2,
        type: 'number',
        label: 'Start year',
        helpText: null,
        required: false,
        config: { min: 1950, max: 2100, integerOnly: true },
      };
      const dateQuestion = {
        key: ABOUT,
        type: 'date',
        label: 'Start date',
        helpText: null,
        required: true,
        config: { min: null, max: null },
      };
      expect(parseFormFields([group([{ ...yearQuestion, presetKey: 'education.end_year' }])])).toMatchObject({ ok: true });
      expect(parseFormFields([group([{ ...dateQuestion, presetKey: 'experience.start_date' }])])).toMatchObject({ ok: true });
      for (const presetKey of ['education.start_year', 'education.end_year', 'experience.start_date', 'experience.end_date']) {
        expect(parseFormFields([group([{ ...schoolQuestion, presetKey }])])).toEqual({
          ok: false,
          errors: [{ path: '0.config.fields.0.presetKey', message: WRONG_TYPE_PRESET_KEY }],
        });
      }
    });

    it('refuses the same top-level Preset key twice, pointing at the second, and accepts two different ones', () => {
      const company = { ...shortText, key: ABOUT_2, presetKey: 'experience.company' };
      const jobTitle = { ...shortText, presetKey: 'experience.job_title' };
      expect(parseFormFields([jobTitle, company])).toMatchObject({ ok: true });
      expect(parseFormFields([jobTitle, { ...company, presetKey: 'experience.job_title' }])).toEqual({
        ok: false,
        errors: [{ path: '1.presetKey', message: DUPLICATE_PRESET_KEY }],
      });
      expect(parseFormFields([{ ...group(), presetKey: 'education' }, { ...group(), presetKey: 'education' }])).toMatchObject({
        ok: false,
        errors: expect.arrayContaining([{ path: '1.presetKey', message: DUPLICATE_PRESET_KEY }]),
      });
    });

    it('allows the same sub-question Preset key in two groups, but not twice in one group', () => {
      const GROUP_2 = '1f2e3d4c-5b6a-4789-8a9b-0c1d2e3f4a5b';
      const SCHOOL_2 = '2a3b4c5d-6e7f-4801-9a2b-3c4d5e6f7a8b';
      const school = { ...schoolQuestion, presetKey: 'education.school' };
      const otherGroup = {
        ...group([{ ...school, key: SCHOOL_2 }]),
        key: GROUP_2,
        presetKey: 'experience',
      };
      expect(parseFormFields([group([school]), otherGroup])).toMatchObject({ ok: true });

      const secondSchool = { ...school, key: ABOUT_2 };
      expect(parseFormFields([group([school, secondSchool])])).toEqual({
        ok: false,
        errors: [{ path: '0.config.fields.1.presetKey', message: DUPLICATE_PRESET_KEY }],
      });
    });
  });
});
