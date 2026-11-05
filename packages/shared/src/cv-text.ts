import { z } from 'zod';

/**
 * CV text rules shared by the browser (which reads the CV) and the API (which stores the text).
 * ADR-0006; spec `.scratch/cv-autofill/spec.md`, "Shared package". Pure: no I/O, no DOM.
 */

/**
 * How a CV's text turned out.
 * - `readable`: text came out and is long enough to work with.
 * - `unreadable`: the reader ran but found (almost) no text, e.g. a scanned CV. Never a reason to
 *   think the applicant lacks a skill.
 * - `failed`: the reader errored, timed out, or the browser could not read at all.
 */
export const CV_TEXT_STATUSES = ['readable', 'unreadable', 'failed'] as const;
export type CvTextStatus = (typeof CV_TEXT_STATUSES)[number];

/**
 * The longest CV text kept, in JavaScript string `.length` (UTF-16 code units), the unit
 * `long_text` answers use. Longer text is cut, never refused. 50,000 was settled in
 * `.scratch/cv-autofill/issues/01-confirm-request-size-limits-and-fix-cv-text-cap.md` (## Answer):
 * it fits the 1 MB submit-route body limit even at 6 bytes per unit.
 */
export const CV_TEXT_CAP = 50_000;

/** Text shorter than this (after trimming) is `unreadable`. A placeholder to tune on sample CVs. */
export const CV_TEXT_MIN_LENGTH = 100;

/** Bumped whenever an extractor heuristic changes, so stored results can be told apart and re-run. */
export const CV_EXTRACTOR_VERSION = 3;

/**
 * C0 controls except tab, line feed and carriage return, plus DEL and the C1 controls. JSON writes
 * each as `\u00XX`, 6 bytes, so a CV full of them could blow the body limit (ticket 01).
 */
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

/**
 * Cleans CV text for sending and storing: strips control characters, turns CRLF and lone CR into
 * LF, then cuts at `CV_TEXT_CAP`. The strip comes first so control characters never use up the
 * cap. A cut never leaves half of a surrogate pair (an emoji).
 */
export function normalizeCvText(text: string): string {
  const clean = text.replace(CONTROL_CHARACTERS, '').replace(/\r\n?/g, '\n');
  if (clean.length <= CV_TEXT_CAP) return clean;
  const lastUnit = clean.charCodeAt(CV_TEXT_CAP - 1);
  const splitsPair = lastUnit >= 0xd800 && lastUnit <= 0xdbff;
  return clean.slice(0, splitsPair ? CV_TEXT_CAP - 1 : CV_TEXT_CAP);
}

/**
 * The status to store. Only `failed` is believed from the client; `readable` and `unreadable` are
 * always recomputed from the text, so a client cannot claim `readable` for text that is too short.
 */
export function resolveCvTextStatus(text: string, claimed: CvTextStatus): CvTextStatus {
  if (claimed === 'failed') return 'failed';
  return text.trim().length >= CV_TEXT_MIN_LENGTH ? 'readable' : 'unreadable';
}

/**
 * The CV text object on the submit body. Strict. Overlong text is cut (not an error) and the
 * status comes out already resolved by `resolveCvTextStatus`, so the output is safe to store.
 */
export const cvTextSchema = z
  .strictObject({
    text: z.string(),
    status: z.enum(CV_TEXT_STATUSES),
  })
  .transform(({ text, status }) => {
    const normalized = normalizeCvText(text);
    return { text: normalized, status: resolveCvTextStatus(normalized, status) };
  });

/** What the browser sends. */
export type CvTextInput = z.input<typeof cvTextSchema>;
/** What the schema outputs: cleaned, cut, status resolved. */
export type CvText = z.output<typeof cvTextSchema>;
