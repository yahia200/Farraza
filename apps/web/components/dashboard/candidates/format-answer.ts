import { isBlankAnswer, isPlainObject, type AnswerValue, type Entry, type FormField, type LeafFormField } from '@repo/shared';

/** One row of an Entry's block: the sub-question's label and its answer as text. */
export type EntryRow = { label: string; answer: string | string[] | LinkAnswer };

/**
 * A web link, ready to show. Tagged by `href` so a reader can tell it from a group (`entries`).
 * Only ever built for an `http:` or `https:` address; anything else comes back as plain text.
 */
export type LinkAnswer = { href: string; text: string };

/**
 * A repeating group's answer, ready to show: one list of rows per Entry, in the
 * order the applicant gave them. Tagged as an object so a reader can tell it
 * from a list of option labels (`string[]`) without looking at the question.
 */
export type GroupAnswer = { entries: EntryRow[][] };

/** What the candidate view can show for one question; `null` means no answer. */
export type FormattedAnswer = string | string[] | LinkAnswer | GroupAnswer | null;

/**
 * An answer as text for the candidate view, using the question the candidate
 * actually saw (the form version stored with the application). Option ids are
 * turned back into their labels; answers stay readable if the job's current
 * form has since changed. A repeating group's answer comes back as rows per
 * Entry (labels from the group's own sub-questions) rather than as one string.
 */
export function formatAnswer(field: FormField, value: AnswerValue | undefined): FormattedAnswer {
  switch (field.type) {
    case 'file':
      // The answer is a file id, which text can't show: the sheet renders the file itself
      // (candidate-file.tsx) and never asks for this.
      return null;
    case 'repeating_group':
      return formatGroup(field.config.fields, value);
    default:
      return formatLeaf(field, value);
  }
}

/** The text of a single-answer question; `null` when it has no answer. */
function formatLeaf(field: LeafFormField, value: AnswerValue | undefined): string | string[] | LinkAnswer | null {
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
      // As entered: `String(0)` is "0", so a zero is an answer (isBlankAnswer only skips missing/blank/empty).
      return typeof value === 'number' && Number.isFinite(value) ? String(value) : null;
    case 'date':
      return typeof value === 'string' ? formatIsoDate(value) : null;
    case 'url':
      return typeof value === 'string' ? formatUrl(value) : null;
    case 'single_select':
      return field.config.options.find((option) => option.id === value)?.label ?? 'Unknown option';
    case 'multi_select':
      return Array.isArray(value)
        ? value.map((id) => field.config.options.find((option) => option.id === id)?.label ?? 'Unknown option')
        : null;
  }
}

/**
 * Each Entry as its answered rows. A blank sub-answer is left out, and so is an
 * Entry with nothing left (the API drops those on submit, so this is only a guard).
 * No Entries at all, as with a skipped optional group, is `null`: "No answer".
 */
function formatGroup(children: readonly LeafFormField[], value: AnswerValue | undefined): GroupAnswer | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const entries = value
    .filter((entry): entry is Entry => isPlainObject(entry))
    .map((entry) =>
      children.flatMap((child): EntryRow[] => {
        const answer = formatLeaf(child, entry[child.key]);
        return answer === null || isBlankAnswer(answer) ? [] : [{ label: child.label, answer }];
      }),
    )
    .filter((rows) => rows.length > 0);
  return entries.length > 0 ? { entries } : null;
}

/**
 * An ISO `YYYY-MM-DD` date as "February 5, 2026". A date has no time or timezone, so it goes through
 * `Temporal.PlainDate`, never `new Date(iso)` (which reads it as UTC midnight and can show the
 * previous day to viewers west of UTC). The format is fixed to `en-US` with `dateStyle: 'long'`,
 * not the viewer's locale, so every viewer (and the server render) reads the same day and text,
 * and the month name avoids the 02/05 day-month ambiguity. Text that isn't a date is shown as stored.
 * Docs: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/PlainDate/toLocaleString
 */
function formatIsoDate(value: string): string {
  try {
    return Temporal.PlainDate.from(value, { overflow: 'reject' }).toLocaleString('en-US', { dateStyle: 'long' });
  } catch {
    return value;
  }
}

/**
 * A link only when the address parses and its scheme is `http:` or `https:` (the server already
 * refuses others; this guards bad data, such as `javascript:`, reaching the sheet). Anything else
 * is plain text, never an `href`.
 * Docs: https://developer.mozilla.org/en-US/docs/Web/API/URL/protocol
 */
function formatUrl(value: string): string | LinkAnswer {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? { href: url.href, text: value.trim() } : value;
  } catch {
    return value;
  }
}
