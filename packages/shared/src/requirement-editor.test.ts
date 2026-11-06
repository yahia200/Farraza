import { describe, expect, it } from 'vitest';
import { REQUIREMENT_KEYWORD_MAX_LENGTH, REQUIREMENT_KEYWORDS_LIMIT } from './requirements.js';
import {
  addKeyword,
  groupRequirementErrors,
  moveItem,
  newRequirement,
  requirementErrorsFromIssues,
} from './requirement-editor.js';

/** The Settings tab's Requirements editor logic (.scratch/keyword-match, ticket 06). */
describe('newRequirement', () => {
  it('starts as an empty must-have with the given id', () => {
    expect(newRequirement('abc')).toEqual({ id: 'abc', text: '', tier: 'must_have', keywords: [] });
  });
});

describe('addKeyword', () => {
  it('trims and appends', () => {
    expect(addKeyword(['Go'], '  Rust ')).toEqual({ keywords: ['Go', 'Rust'] });
  });

  it('refuses blank input', () => {
    expect(addKeyword(['Go'], '   ')).toEqual({ keywords: ['Go'], error: 'Enter a keyword.' });
  });

  it('refuses a keyword already listed, ignoring case', () => {
    expect(addKeyword(['Go'], 'go')).toEqual({ keywords: ['Go'], error: '"go" is already listed.' });
  });

  it('refuses a keyword over the length cap', () => {
    const long = 'x'.repeat(REQUIREMENT_KEYWORD_MAX_LENGTH + 1);
    expect(addKeyword([], long).error).toBe(`Keywords must be ${REQUIREMENT_KEYWORD_MAX_LENGTH} characters or fewer.`);
  });

  it('refuses past the keyword cap', () => {
    const full = Array.from({ length: REQUIREMENT_KEYWORDS_LIMIT }, (_, i) => `k${i}`);
    const result = addKeyword(full, 'one more');
    expect(result.keywords).toEqual(full);
    expect(result.error).toBe(`Add at most ${REQUIREMENT_KEYWORDS_LIMIT} keywords.`);
  });
});

describe('addKeyword boundaries', () => {
  it('accepts a keyword of exactly the length cap', () => {
    const exact = 'x'.repeat(REQUIREMENT_KEYWORD_MAX_LENGTH);
    expect(addKeyword([], exact)).toEqual({ keywords: [exact] });
  });

  it('accepts the keyword that fills the list to exactly the keyword cap', () => {
    const almost = Array.from({ length: REQUIREMENT_KEYWORDS_LIMIT - 1 }, (_, i) => `k${i}`);
    expect(addKeyword(almost, 'last').keywords).toHaveLength(REQUIREMENT_KEYWORDS_LIMIT);
  });
});

describe('moveItem', () => {
  it('returns an empty copy for an empty list', () => {
    expect(moveItem([], 0, 0)).toEqual([]);
  });

  it('moves an item without mutating the input', () => {
    const list = ['a', 'b', 'c'];
    expect(moveItem(list, 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(list, 2, 1)).toEqual(['a', 'c', 'b']);
    expect(list).toEqual(['a', 'b', 'c']);
  });

  it('leaves the list alone for an index outside it', () => {
    expect(moveItem(['a', 'b'], 0, 2)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], -1, 0)).toEqual(['a', 'b']);
  });
});

describe('groupRequirementErrors', () => {
  it('puts errors on the requirement and field they are about', () => {
    const { byRequirement, form } = groupRequirementErrors([
      { path: 'requirements.1.text', message: 'Describe the requirement.' },
      { path: 'requirements.1.keywords', message: 'Add at least one keyword.' },
      { path: 'requirements.1.keywords.0', message: 'Enter a keyword.' },
      { path: 'requirements.0.id', message: 'Reload.' },
      { path: 'requirements', message: 'Add at most 10 requirements.' },
    ]);
    expect(byRequirement[1]).toEqual({
      text: ['Describe the requirement.'],
      keywords: ['Add at least one keyword.', 'Enter a keyword.'],
      other: [],
    });
    expect(byRequirement[0]).toEqual({ text: [], keywords: [], other: ['Reload.'] });
    expect(form).toEqual(['Add at most 10 requirements.']);
  });
});

describe('requirementErrorsFromIssues', () => {
  it('turns Zod issues for { requirements } into API-shaped errors', () => {
    const errors = requirementErrorsFromIssues([
      { path: ['requirements', 0, 'text'], message: 'Describe the requirement.' },
      { path: ['requirements'], message: 'Add at most 10 requirements.' },
    ]);
    expect(errors).toEqual([
      { path: 'requirements.0.text', message: 'Describe the requirement.' },
      { path: 'requirements', message: 'Add at most 10 requirements.' },
    ]);
  });
});
