import { describe, expect, it } from 'vitest';
import {
  EMPTY_AUTOFILL,
  applySuggestions,
  suggestedValues,
  touchAutofill,
  undoAutofill,
} from './cv-autofill.js';
import { extractContactSuggestions } from './cv-contacts.js';
import type { FormField } from './form-fields.js';
import type { PresetKey } from './preset-keys.js';

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

// Ticket 06: the extractor's Preset-keyed answers flow through the same state as the contact values.
describe('Preset-keyed answers through the autofill state', () => {
  const CV = `Sara Hassan
Cairo, Egypt | sara.hassan@example.com
linkedin.com/in/sara-hassan | github.com/sarah-codes | https://sara.dev
`;
  function question(presetKey: PresetKey | null, type: 'url' | 'short_text', label: string): FormField {
    return {
      key: crypto.randomUUID(),
      type,
      label,
      helpText: null,
      required: false,
      presetKey,
      config: type === 'short_text' ? { maxLength: 100 } : {},
    } as FormField;
  }
  const linkedin = question('contact.linkedin_url', 'url', 'Find us online');
  const github = question('contact.github_url', 'url', 'GitHub');
  const portfolio = question('contact.portfolio_url', 'url', 'Portfolio');
  const location = question('contact.location', 'short_text', 'Location');
  const handBuilt = question(null, 'url', 'LinkedIn');
  const fields = [location, handBuilt, linkedin, portfolio, github];
  const path = (f: FormField) => `answers.${f.key}`;

  it('fills the four contact Presets, relabelled and reordered, and leaves a hand-built Question alone', () => {
    const suggested = suggestedValues(extractContactSuggestions(CV, fields));
    const { fill } = applySuggestions(EMPTY_AUTOFILL, suggested, () => true);
    expect(fill[path(linkedin)]).toBe('https://www.linkedin.com/in/sara-hassan');
    expect(fill[path(github)]).toBe('https://github.com/sarah-codes');
    expect(fill[path(portfolio)]).toBe('https://sara.dev');
    expect(fill[path(location)]).toBe('Cairo, Egypt');
    expect(path(handBuilt) in fill).toBe(false);
  });

  it('does not overwrite a Preset answer the applicant already has', () => {
    const suggested = suggestedValues(extractContactSuggestions(CV, fields));
    const { fill } = applySuggestions(EMPTY_AUTOFILL, suggested, (p) => p !== path(github));
    expect(path(github) in fill).toBe(false);
    expect(path(linkedin) in fill).toBe(true);
  });

  it('omits a suggestion its Question would refuse, so it is never applied', () => {
    const tight = { ...location, config: { maxLength: 5 } } as FormField;
    expect(Object.keys(suggestedValues(extractContactSuggestions(CV, [tight])))).toEqual(["name", "email"]);
  });

  it('tracks them as untouched: an edited one survives Undo, the rest are cleared', () => {
    const suggested = suggestedValues(extractContactSuggestions(CV, fields));
    const { state } = applySuggestions(EMPTY_AUTOFILL, suggested, () => true);
    const undone = undoAutofill(touchAutofill(state, path(portfolio)));
    expect(undone.clear.sort()).toEqual([path(linkedin), path(github), path(location), "email", "name"].sort());
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

describe('replacing or removing the CV', () => {
  const first = { name: 'Sara Hassan', email: 'sara@example.com' };

  it('clears the first CV suggestions, keeps edits, and the second CV fills only what is empty', () => {
    const filled = applySuggestions(EMPTY_AUTOFILL, first, () => true).state;
    // The applicant edits the name, so it is theirs; the email is still a suggestion.
    const cleared = undoAutofill(touchAutofill(filled, 'name'));
    expect(cleared.clear).toEqual(['email']);
    const second = applySuggestions(cleared.state, { name: 'Omar Ali', phone: '+201001234567' }, (path) => path !== 'name');
    expect(second.fill).toEqual({ phone: '+201001234567' });
    expect(second.state.untouched).toEqual({ phone: '+201001234567' });
  });

  it('removing (clearing with no new read) leaves no suggestions', () => {
    const filled = applySuggestions(EMPTY_AUTOFILL, first, () => true).state;
    expect(undoAutofill(filled).state.untouched).toEqual({});
  });
});
