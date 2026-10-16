import { describe, expect, it } from 'vitest';
import { cvModeSchema, DEFAULT_CV_MODE } from './cv-mode.js';
import { saveFormSchema } from './jobs.js';

describe('cvModeSchema', () => {
  it.each(['off', 'optional', 'required'])('accepts %s', (mode) => {
    expect(cvModeSchema.parse(mode)).toBe(mode);
  });

  it.each(['', 'on', 'OPTIONAL', 'Required', null, undefined, true, 1])(
    'rejects %j',
    (value) => {
      expect(cvModeSchema.safeParse(value).success).toBe(false);
    },
  );

  it('tells recruiters what is wrong in plain words', () => {
    const result = cvModeSchema.safeParse('sometimes');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Choose whether the form asks for a CV.');
  });

  it('starts new forms at optional', () => {
    expect(DEFAULT_CV_MODE).toBe('optional');
  });
});

describe('saveFormSchema', () => {
  it('carries the CV mode with the fields', () => {
    expect(saveFormSchema.parse({ fields: [], cvMode: 'required' })).toEqual({
      fields: [],
      cvMode: 'required',
    });
  });

  it('refuses a save without a CV mode', () => {
    expect(saveFormSchema.safeParse({ fields: [] }).success).toBe(false);
  });

  it('refuses an unknown CV mode', () => {
    expect(saveFormSchema.safeParse({ fields: [], cvMode: 'maybe' }).success).toBe(false);
  });
});
