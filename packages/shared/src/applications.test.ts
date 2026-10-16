import { describe, expect, it } from 'vitest';
import { submitApplicationSchema } from './applications.js';

const contact = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '+201001234567',
  answers: {},
};

describe('submitApplicationSchema', () => {
  it('accepts a submit without a CV', () => {
    const result = submitApplicationSchema.safeParse(contact);
    expect(result.success).toBe(true);
  });

  it('carries the CV file id when the applicant uploaded one', () => {
    const cvFileId = '7b2c3a1e-0d1f-4b6a-9c53-2f8e4a1d6b90';
    const result = submitApplicationSchema.safeParse({ ...contact, cvFileId });
    expect(result.success && result.data.cvFileId).toBe(cvFileId);
  });

  it('refuses a CV file id that is not an id', () => {
    const result = submitApplicationSchema.safeParse({ ...contact, cvFileId: 'my-cv.pdf' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['cvFileId']);
  });

  it('still refuses unknown keys', () => {
    expect(submitApplicationSchema.safeParse({ ...contact, resume: 'x' }).success).toBe(false);
  });
});
