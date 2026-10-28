import { isBlankAnswer, type AnswerValue } from './answers.js';
import { formatIsoDate } from './dates.js';
import type { LeafFormField } from './form-fields.js';

/**
 * A single-answer Question's answer as text, read against the Question the applicant saw (the form
 * version stored with the Application), so option labels stay those of that version. `null` means
 * no answer. A multi-select is its labels, one per item; an option id that version doesn't have is
 * "Unknown option". Text is returned as stored, blank text included: the sheet's output is fixed,
 * and only `formatHighlightText` turns blank text into `null`.
 */
export function formatAnswerText(field: LeafFormField, value: AnswerValue | undefined): string | string[] | null {
  if (value === undefined) {
    return null;
  }
  switch (field.type) {
    case 'short_text':
    case 'long_text':
      return typeof value === 'string' ? value : null;
    case 'yes_no':
      return value === true ? 'Yes' : value === false ? 'No' : null;
    case 'number':
      // `String(0)` is "0", so a zero is an answer.
      return typeof value === 'number' && Number.isFinite(value) ? String(value) : null;
    case 'date':
      return typeof value === 'string' ? formatIsoDate(value) : null;
    case 'url':
      // Plain text: whether to make it a link is the reader's call (the sheet does, the list doesn't).
      return typeof value === 'string' ? value : null;
    case 'single_select':
      return optionLabel(field.config.options, value);
    case 'multi_select':
      return Array.isArray(value) ? value.map((id) => optionLabel(field.config.options, id)) : null;
  }
}

/** The longest a Highlighted question's answer is on the candidate list, in characters. */
export const HIGHLIGHT_MAX_CHARACTERS = 200;

/**
 * A Highlighted question's answer for the candidate list: one line of plain text, or `null` when
 * there is no answer. A multi-select's labels are joined with ", ", a link is its trimmed text (never
 * a link, so clicking a row can't leave the page), and anything over `HIGHLIGHT_MAX_CHARACTERS` is cut
 * there with "…". Blank text (spaces or line breaks only) is no answer, the rule of `isBlankAnswer`,
 * so it shows "—" rather than an empty cell. The sheet shows the full answer.
 */
export function formatHighlightText(field: LeafFormField, value: AnswerValue | undefined): string | null {
  const text = formatAnswerText(field, value);
  if (text === null) {
    return null;
  }
  const line = Array.isArray(text) ? text.join(', ') : field.type === 'url' ? text.trim() : text;
  return isBlankAnswer(line) ? null : truncate(line, HIGHLIGHT_MAX_CHARACTERS);
}

/**
 * Cuts by Unicode code points, not UTF-16 units, so an emoji or other surrogate pair is never split:
 * a string's iterator yields code points.
 * Docs: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/Symbol.iterator
 */
function truncate(text: string, max: number): string {
  const characters = Array.from(text);
  return characters.length > max ? `${characters.slice(0, max).join('')}…` : text;
}

function optionLabel(options: readonly { id: string; label: string }[], id: unknown): string {
  return options.find((option) => option.id === id)?.label ?? 'Unknown option';
}

/**
 * A Highlighted question's answer for the candidate list, raw and tagged by type so the reader can
 * format and sort it: the web app does both (`formatHighlight`, `highlightSortValue`). A select
 * arrives as labels, not option ids, because only the Application's own form version can name them.
 */
export type Highlight =
  | { type: 'text'; value: string }
  | { type: 'number'; value: number }
  | { type: 'date'; value: string }
  | { type: 'yes_no'; value: boolean }
  | { type: 'select'; labels: string[] };

/** What kind of answer a Highlighted question's column holds. */
export type HighlightKind = Highlight['type'];

/** The raw answer to a Highlighted question as a tagged `Highlight`, or `null` for no answer. */
export function toHighlight(field: LeafFormField, value: AnswerValue | undefined): Highlight | null {
  switch (field.type) {
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) ? { type: 'number', value } : null;
    case 'yes_no':
      return typeof value === 'boolean' ? { type: 'yes_no', value } : null;
    case 'date':
      return typeof value === 'string' ? { type: 'date', value } : null;
    case 'single_select':
    case 'multi_select': {
      const text = formatAnswerText(field, value);
      const labels = text === null ? [] : Array.isArray(text) ? text : [text];
      return labels.length > 0 ? { type: 'select', labels } : null;
    }
    case 'short_text':
    case 'long_text':
    case 'url': {
      // The text rules (blank is no answer, a link is trimmed, 200 characters) stay in one place.
      const text = formatHighlightText(field, value);
      return text === null ? null : { type: 'text', value: text };
    }
  }
}

/** The kind of Highlight a Question of this type gives: what its Highlighted column holds. */
export function highlightKindOf(field: LeafFormField): HighlightKind {
  switch (field.type) {
    case 'short_text':
    case 'long_text':
    case 'url':
      return 'text';
    case 'single_select':
    case 'multi_select':
      return 'select';
    case 'yes_no':
    case 'number':
    case 'date':
      return field.type;
  }
}
