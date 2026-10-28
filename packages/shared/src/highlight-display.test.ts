import { describe, expect, it } from 'vitest';
import { compareHighlightSort, formatHighlight, highlightSortValue } from './highlight-display.js';

/*
 * A Highlighted answer as the candidate list shows it and sorts it (the API sends it raw and tagged,
 * `toHighlight`; the web app reads it here).
 */

describe('formatHighlight', () => {
  it('shows each type the way the candidate sheet does', () => {
    expect(formatHighlight({ type: 'text', value: 'Cairo' })).toBe('Cairo');
    expect(formatHighlight({ type: 'number', value: 0 })).toBe('0');
    expect(formatHighlight({ type: 'number', value: -2.5 })).toBe('-2.5');
    expect(formatHighlight({ type: 'yes_no', value: true })).toBe('Yes');
    expect(formatHighlight({ type: 'yes_no', value: false })).toBe('No');
    expect(formatHighlight({ type: 'date', value: '2026-02-05' })).toBe('February 5, 2026');
  });

  it('joins a select\'s labels with commas', () => {
    expect(formatHighlight({ type: 'select', labels: ['Senior'] })).toBe('Senior');
    expect(formatHighlight({ type: 'select', labels: ['Senior', 'Junior'] })).toBe('Senior, Junior');
  });
});

describe('highlightSortValue', () => {
  it('is the number for a number, the ISO date for a date, 0 or 1 for a yes/no', () => {
    expect(highlightSortValue({ type: 'number', value: 0 }, 'number')).toBe(0);
    expect(highlightSortValue({ type: 'date', value: '2026-02-05' }, 'date')).toBe('2026-02-05');
    expect(highlightSortValue({ type: 'yes_no', value: false }, 'yes_no')).toBe(0);
    expect(highlightSortValue({ type: 'yes_no', value: true }, 'yes_no')).toBe(1);
  });

  it('is the shown text for text and for a select', () => {
    expect(highlightSortValue({ type: 'text', value: 'Cairo' }, 'text')).toBe('Cairo');
    expect(highlightSortValue({ type: 'select', labels: ['Senior', 'Junior'] }, 'select')).toBe('Senior, Junior');
  });

  it('leaves out the spaces around text, so a leading space does not sort before "Apple"', () => {
    expect(highlightSortValue({ type: 'text', value: '  Cairo ' }, 'text')).toBe('Cairo');
  });

  it('is undefined for no answer, and for an answer of another kind than the column holds', () => {
    expect(highlightSortValue(null, 'number')).toBeUndefined();
    expect(highlightSortValue({ type: 'text', value: 'ten' }, 'number')).toBeUndefined();
    expect(highlightSortValue({ type: 'number', value: 10 }, 'text')).toBeUndefined();
  });
});

describe('compareHighlightSort', () => {
  it('orders numbers by value, not as text', () => {
    expect(compareHighlightSort(9, 10)).toBeLessThan(0);
    expect(compareHighlightSort(10, 9)).toBeGreaterThan(0);
    expect(compareHighlightSort(3, 3)).toBe(0);
  });

  it('orders dates in time order', () => {
    expect(compareHighlightSort('2026-02-05', '2026-10-01')).toBeLessThan(0);
  });

  it('orders text ignoring case', () => {
    expect(compareHighlightSort('apple', 'Banana')).toBeLessThan(0);
    expect(compareHighlightSort('Banana', 'apple')).toBeGreaterThan(0);
    expect(compareHighlightSort('cairo', 'Cairo')).toBe(0);
  });
});
