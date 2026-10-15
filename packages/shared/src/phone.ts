import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import { z } from 'zod';

/**
 * Numbers written without a +country code ("0100 123 4567") are read as this
 * country's. One constant for now; it could become a per-company setting.
 */
export const DEFAULT_PHONE_COUNTRY: CountryCode = 'EG';

export const PHONE_ERROR = 'Enter a valid phone number, for example 0100 123 4567 or +20 100 123 4567.';

/** E.164 ("+201001234567"): what the database stores and checks (applications_phone_format). */
export const E164 = /^\+[1-9][0-9]{6,14}$/;

/**
 * Parses a phone number written any common way and returns it in E.164, so the
 * same number always becomes the same text and UNIQUE (job_id, phone) catches
 * a repeat. Uses libphonenumber-js's default "min" metadata, which checks the
 * number's length for its country, not its exact digits
 * (node_modules/libphonenumber-js/README.md, "min" vs "max").
 */
export function normalizePhone(input: string): string | null {
  // extract: false: the whole input must be the number, not text around one.
  const phone = parsePhoneNumberFromString(input, { defaultCountry: DEFAULT_PHONE_COUNTRY, extract: false });
  return phone?.isValid() ? phone.number : null;
}

/** A phone field: validates, then hands back the E.164 form. */
export const phoneSchema = z.string().transform((value, ctx) => {
  const normalized = normalizePhone(value);
  if (!normalized) {
    ctx.addIssue(PHONE_ERROR);
    return z.NEVER;
  }
  return normalized;
});
