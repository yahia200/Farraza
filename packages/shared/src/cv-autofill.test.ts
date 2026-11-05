import { describe, expect, it } from 'vitest';
import {
  EMPTY_AUTOFILL,
  applySuggestions,
  suggestedValues,
  touchAutofill,
  undoAutofill,
} from './cv-autofill.js';

const KEY = '3f2b8c1e-0000-4000-8000-000000000001';

describe('suggestedValues', () => {
  it('lists the contact values and the string answers by form path', () => {
    expect(
      suggestedValues({ name: 'Sara Hassan', email: 'sara@example.com', answers: { [KEY]: 'https://x.dev' } }),
    ).toEqual({ name: 'Sara Hassan', email: 'sara@example.com', [`answers.${KEY}`]: 'https://x.dev' });
  });

  it('leaves out what was not found and answers that are not text', () => {
    expect(suggestedValues({ phone: '+201001234567', answers: { [KEY]: ['a'] } })).toEqual({
      phone: '+201001234567',
    });
  });
});

describe('applySuggestions', () => {
  const suggested = { name: 'Sara Hassan', email: 'sara@example.com' };

  it('fills empty values and remembers them as untouched suggestions', () => {
    const { state, fill } = applySuggestions(EMPTY_AUTOFILL, suggested, () => true);
    expect(fill).toEqual(suggested);
    expect(state.untouched).toEqual(suggested);
  });

  it('never fills a value the applicant already has, even one typed while the CV was being read', () => {
    const { state, fill } = applySuggestions(EMPTY_AUTOFILL, suggested, (path) => path !== 'name');
    expect(fill).toEqual({ email: 'sara@example.com' });
    expect(state.untouched).toEqual({ email: 'sara@example.com' });
  });

  it('keeps earlier suggestions when a later read adds more', () => {
    const first = applySuggestions(EMPTY_AUTOFILL, { name: 'Sara Hassan' }, () => true);
    const second = applySuggestions(first.state, { phone: '+201001234567' }, () => true);
    expect(second.state.untouched).toEqual({ name: 'Sara Hassan', phone: '+201001234567' });
  });
});

describe('touchAutofill', () => {
  it('forgets a value the applicant changed, so Undo keeps it', () => {
    const { state } = applySuggestions(EMPTY_AUTOFILL, { name: 'Sara Hassan', email: 'sara@example.com' }, () => true);
    expect(touchAutofill(state, 'name').untouched).toEqual({ email: 'sara@example.com' });
  });

  it('returns the same state for a value that was never suggested', () => {
    const { state } = applySuggestions(EMPTY_AUTOFILL, { name: 'Sara Hassan' }, () => true);
    expect(touchAutofill(state, 'phone')).toBe(state);
  });
});

describe('empty input', () => {
  it('offers nothing for suggestions with nothing found', () => {
    expect(suggestedValues({ answers: {} })).toEqual({});
  });

  it('applying nothing returns the same state and fills nothing', () => {
    const result = applySuggestions(EMPTY_AUTOFILL, {}, () => true);
    expect(result.fill).toEqual({});
    expect(result.state).toBe(EMPTY_AUTOFILL);
  });

  it('undo with nothing suggested clears nothing', () => {
    expect(undoAutofill(EMPTY_AUTOFILL).clear).toEqual([]);
  });
});

describe('undoAutofill', () => {
  it('clears only the untouched suggestions', () => {
    const { state } = applySuggestions(EMPTY_AUTOFILL, { name: 'Sara Hassan', email: 'sara@example.com' }, () => true);
    const result = undoAutofill(touchAutofill(state, 'name'));
    expect(result.clear).toEqual(['email']);
    expect(result.state).toEqual(EMPTY_AUTOFILL);
  });
});
