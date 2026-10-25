import type { PublicFormField } from '@repo/shared';

type Leaf = Exclude<PublicFormField, { type: 'repeating_group' }>;

/** An ISO `YYYY-MM-DD` date in the reader's own format, without a timezone shift (built from its parts). */
function readableDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year!, month! - 1, day!).toLocaleDateString(undefined, { dateStyle: 'long' });
}

/**
 * The limits of a Number or Date question as one line of hint text, or null when it has none
 * (the same limits `parseAnswers` enforces, shown before the applicant hits an error).
 */
export function limitHint(field: Leaf): string | null {
  if (field.type === 'number') {
    const { min, max, integerOnly } = field.config;
    const range =
      min !== null && max !== null
        ? `Between ${min} and ${max}`
        : min !== null
          ? `At least ${min}`
          : max !== null
            ? `At most ${max}`
            : null;
    if (range && integerOnly) return `${range}, whole numbers only.`;
    if (range) return `${range}.`;
    return integerOnly ? 'Whole numbers only.' : null;
  }
  if (field.type === 'date') {
    const { min, max } = field.config;
    if (min !== null && max !== null) return `Between ${readableDate(min)} and ${readableDate(max)}.`;
    if (min !== null) return `On or after ${readableDate(min)}.`;
    if (max !== null) return `On or before ${readableDate(max)}.`;
  }
  return null;
}
