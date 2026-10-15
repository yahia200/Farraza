import { describe, expect, it } from 'vitest';
import { E164, normalizePhone, PHONE_ERROR, phoneSchema } from './phone.js';

describe('normalizePhone', () => {
  it('writes the same number the same way, however it was typed', () => {
    const forms = ['+20 100 123 4567', '+201001234567', '0100 123 4567', '01001234567', '(0100) 123-4567'];
    expect(new Set(forms.map(normalizePhone))).toEqual(new Set(['+201001234567']));
  });

  it('keeps numbers from other countries', () => {
    expect(normalizePhone('+44 20 7946 0958')).toBe('+442079460958');
  });

  it('rejects what is not a phone number', () => {
    expect(normalizePhone('123')).toBeNull();
    expect(normalizePhone('call me')).toBeNull();
    expect(normalizePhone('+20 100 123 4567 ext. 9, thanks')).toBeNull();
  });

  it('always produces the E.164 form the database checks', () => {
    expect(normalizePhone('0100 123 4567')).toMatch(E164);
  });
});

describe('phoneSchema', () => {
  it('outputs E.164', () => {
    expect(phoneSchema.parse('0100 123 4567')).toBe('+201001234567');
  });

  it('explains what is wrong', () => {
    const result = phoneSchema.safeParse('12');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(PHONE_ERROR);
  });
});
