import { describe, expect, it } from 'vitest';
import { PRESET_KEY_TYPES } from './preset-keys.js';

describe('the Preset key catalog', () => {
  // Append-only: a key is never removed and never changes type (see preset-keys.ts), except the one-time
  // retyping of the four year/date keys recorded in ADR-0004 (question-types ticket 05).
  // This list is the spec's, written out by hand. Add to it when the catalog grows; never edit a line.
  const shipped = [
    ['education', 'repeating_group'],
    ['education.school', 'short_text'],
    ['education.degree', 'single_select'],
    ['education.field_of_study', 'short_text'],
    ['education.start_year', 'number'],
    ['education.end_year', 'number'],
    ['experience', 'repeating_group'],
    ['experience.job_title', 'short_text'],
    ['experience.company', 'short_text'],
    ['experience.start_date', 'date'],
    ['experience.end_date', 'date'],
    ['experience.description', 'long_text'],
  ] as const;

  it.each(shipped)('still maps %s to %s', (key, type) => {
    expect(PRESET_KEY_TYPES[key]).toBe(type);
  });
});
