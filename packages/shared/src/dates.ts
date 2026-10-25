import { z } from 'zod';

/*
 * Calendar dates without a time or timezone, as ISO `YYYY-MM-DD` text. The checks use the
 * platform's `Temporal` (Node >= 26 on the server; the web app loads a polyfill). This package
 * never imports a polyfill. Docs:
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/PlainDate
 */

/**
 * The date as a `Temporal.PlainDate`, or null when the text isn't a real calendar date in exactly
 * the `YYYY-MM-DD` form. `{ overflow: 'reject' }` refuses 2026-02-30 instead of rolling it into
 * March, and the round trip refuses forms `from` accepts that we don't store (`2026-2-5`
 * isn't one of them, but extended years such as `+002026-02-05` and a trailing time are).
 */
export function parseIsoDate(value: unknown): Temporal.PlainDate | null {
  if (typeof value !== 'string') return null;
  try {
    const date = Temporal.PlainDate.from(value, { overflow: 'reject' });
    return date.toString() === value ? date : null;
  } catch {
    return null;
  }
}

/** Negative when `a` is before `b`, 0 when the same day, positive when after. Both must be valid. */
export function isoDateOrder(a: string, b: string): number {
  const first = parseIsoDate(a);
  const second = parseIsoDate(b);
  if (first === null || second === null) return 0;
  return Temporal.PlainDate.compare(first, second);
}

/** Zod schema for a stored ISO date, such as a Date question's earliest or latest. */
export const isoDateSchema = z.string({ error: 'Enter a date.' }).refine((value) => parseIsoDate(value) !== null, {
  error: 'Enter a date.',
});
