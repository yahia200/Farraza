import { describe, expect, it } from 'vitest';
import { FILE_UNSUPPORTED, parseFormFields } from './form-fields.js';

const ABOUT = 'c4b1f6a2-9d3e-4f70-a1b2-3c4d5e6f7a81';
const CV = '5e0d7c3a-2b1f-4a69-8c7d-6e5f4a3b2c10';

const shortText = {
  key: ABOUT,
  type: 'short_text',
  label: 'About you',
  helpText: null,
  required: true,
  config: { maxLength: 200 },
};

describe('parseFormFields', () => {
  it('accepts a valid form', () => {
    expect(parseFormFields([shortText])).toMatchObject({ ok: true });
  });

  it('refuses file questions until uploads exist', () => {
    const result = parseFormFields([
      shortText,
      {
        key: CV,
        type: 'file',
        label: 'Your CV',
        helpText: null,
        required: true,
        config: { allowedTypes: ['pdf'], maxSizeMb: 5 },
      },
    ]);
    expect(result).toEqual({ ok: false, errors: [{ path: '1.type', message: FILE_UNSUPPORTED }] });
  });
});
