import { z } from 'zod';

// Calendar dates as ISO `YYYY-MM-DD` text, checked with the platform's `Temporal` (this package never
// imports a polyfill; the web app loads one): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/PlainDate

/**
 * The date as a `Temporal.PlainDate`, or null unless it is a real date in exactly `YYYY-MM-DD`
 * (`overflow: 'reject'` refuses 2026-02-30; the round trip refuses `+002026-02-05` and times).
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
