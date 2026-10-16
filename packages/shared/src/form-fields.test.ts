import { describe, expect, it } from 'vitest';
import { parseFormFields } from './form-fields.js';

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

    it('carries the video and audio kinds, which are not accepted yet', () => {
      // The config model already knows all four kinds (spec); only document and image have formats so far.
      for (const kind of ['video', 'audio']) {
        const result = parseFormFields([fileQuestion({ ...validFileConfig, kinds: [kind] })]);
        expect(result).toMatchObject({ ok: false, errors: [{ path: '0.config.kinds' }] });
      }
    });

    it('allows a duration limit only with video or audio', () => {
      expect(parseFormFields([fileQuestion({ ...validFileConfig, maxDurationSeconds: 60 })])).toMatchObject({
        ok: false,
        errors: [{ path: '0.config.maxDurationSeconds' }],
      });
    });
  });
});
