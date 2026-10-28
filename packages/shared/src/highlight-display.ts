import type { Highlight, HighlightKind } from './answer-text.js';
import { formatIsoDate } from './dates.js';

/**
 * A Highlighted answer as one line of text for the candidate list and the board card. The same
 * wording as the candidate sheet (`formatAnswerText`): "Yes"/"No", the long US date, a select's
 * labels joined with ", ".
 */
export function formatHighlight(highlight: Highlight): string {
  switch (highlight.type) {
    case 'text':
      return highlight.value;
    case 'number':
      return String(highlight.value);
    case 'yes_no':
      return highlight.value ? 'Yes' : 'No';
    case 'date':
      return formatIsoDate(highlight.value);
    case 'select':
      return highlight.labels.join(', ');
  }
}

/** What a Highlighted column sorts by: a number, or text (an ISO date included). */
export type HighlightSortValue = number | string;

/**
 * The value a Highlighted column sorts an answer by, or `undefined` when it has none: no answer, or
 * an answer of another kind than the column holds (the Question's type changed between form
 * versions). `undefined` is what the table's `sortUndefined: 'last'` looks for, so those rows end
 * up last in both directions. A yes/no sorts "No" before "Yes"; a date sorts as its ISO text.
 */
export function highlightSortValue(highlight: Highlight | null, kind: HighlightKind): HighlightSortValue | undefined {
  if (highlight === null || highlight.type !== kind) return undefined;
  switch (highlight.type) {
    case 'number':
      return highlight.value;
    case 'yes_no':
      return highlight.value ? 1 : 0;
    case 'date':
      return highlight.value;
    case 'text':
      // Short text is stored as typed, so "  Cairo" would sort before "Apple".
      return highlight.value.trim();
    case 'select':
      return formatHighlight(highlight);
  }
}

/** Orders two sort values of one column: numbers by value, text ignoring case and accents. */
export function compareHighlightSort(a: HighlightSortValue, b: HighlightSortValue): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'en', { sensitivity: 'base' });
}
