import { parseAnswers, type Answers } from './answers.js';
import { submitApplicationSchema } from './applications.js';
import type { FormField } from './form-fields.js';
import { normalizePhone } from './phone.js';
import type { PresetKey } from './preset-keys.js';

/**
 * What an extractor offers the apply form. The SAME shape is returned by every extractor (the
 * contact one here; the Education and Experience one in ticket 07), so the server (ticket 04) and
 * the browser (ticket 05) consume it the same way.
 *
 * - `name`, `email`, `phone`: the built-in contact values. Each is already valid for the apply
 *   form's own field (name 2 to 100 characters, email as the form normalises it, phone in E.164).
 *   Absent when nothing plausible was found.
 * - `answers`: answers for Questions on the form, keyed by the Question's `key` (a UUID), found by
 *   Preset key only. Each value already passed that Question's own type and limits (`parseAnswers`),
 *   so it is never an invalid answer. A repeating group's answer is a list of Entries (ticket 07).
 *   `{}` when there is nothing to offer.
 *
 * Pure suggestions: nothing here decides whether to apply them (the form only fills empty answers).
 */
export interface CvSuggestions {
  name?: string;
  email?: string;
  phone?: string;
  answers: Answers;
}

// --- Name -------------------------------------------------------------------------------------

/** Lines that head a CV or a section and are never a person's name. */
const NOT_A_NAME =
  /^(curriculum vitae|resume|résumé|cv|profile|summary|contact|contact details|personal details|personal information|objective|about me|experience|education|skills)$/i;

/** Letters (any script), marks, then words joined by space, hyphen, apostrophe or full stop. */
const NAME_WORD = /^[\p{L}\p{M}][\p{L}\p{M}'’.-]*$/u;

const NAME_SCAN_LINES = 10;

function findName(lines: string[]): string | undefined {
  for (const line of lines.slice(0, NAME_SCAN_LINES)) {
    const candidate = line.replace(/\s+/g, ' ').trim();
    if (candidate === '' || NOT_A_NAME.test(candidate)) continue;
    const words = candidate.split(' ');
    if (words.length < 2 || words.length > 5) continue;
    if (!words.every((word) => NAME_WORD.test(word))) continue;
    // The application form's own rule (2 to 100 characters).
    const checked = submitApplicationSchema.shape.name.safeParse(candidate);
    if (checked.success) return checked.data;
  }
  return undefined;
}

// --- Email ------------------------------------------------------------------------------------

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/gu;

function findEmail(text: string): string | undefined {
  for (const match of text.matchAll(EMAIL)) {
    const checked = submitApplicationSchema.shape.email.safeParse(match[0]);
    if (checked.success) return checked.data;
  }
  return undefined;
}

// --- Phone ------------------------------------------------------------------------------------

/** Digits with the separators people put in them; at least 9 digits are checked below. */
const PHONE = /(?<![\p{L}\p{N}])\+?\(?\d[\d\s().-]{6,}\d(?![\p{L}\p{N}])/gu;

/** "2015 - 2019", "2015 2019 2021": only years, so a date range and not a phone number. */
function isYearList(candidate: string): boolean {
  const groups = candidate.split(/[\s().-]+/).filter(Boolean);
  return groups.length > 1 && groups.every((group) => /^(19|20)\d\d$/.test(group));
}

function findPhone(text: string): string | undefined {
  for (const match of text.matchAll(PHONE)) {
    const candidate = match[0].trim();
    const digits = candidate.replace(/\D/g, '').length;
    if (digits < 9 || digits > 15 || isYearList(candidate)) continue;
    const phone = normalizePhone(candidate);
    if (phone) return phone;
  }
  return undefined;
}

// --- Links ------------------------------------------------------------------------------------

interface Links {
  linkedin?: string;
  github?: string;
  portfolio?: string;
}

/**
 * A web address written with `http(s)://` or `www.`, or bare on a common portfolio domain ending.
 * Bare names like "Node.js" or "ASP.NET" are not matched: their endings (js, net) are not listed.
 */
const URL_LIKE =
  /(?<![\p{L}\p{N}@._/-])(?:https?:\/\/|www\.)[^\s<>"'|,;]+|(?<![\p{L}\p{N}@._/-])(?:[\p{L}\p{N}-]+\.)+(?:com|io|dev|me|org|co|app|site|design|xyz|tech)(?:\/[^\s<>"'|,;]*)?(?![\p{L}\p{N}@])/giu;

/** Social sites and messengers that are not a portfolio. */
const NOT_PORTFOLIO_HOSTS = new Set([
  'linkedin.com',
  'github.com',
  'twitter.com',
  'x.com',
  'facebook.com',
  'instagram.com',
  'wa.me',
  't.me',
  'youtube.com',
]);

const PROFILE_SLUG = '[\\p{L}\\p{N}_%-]+';

function findLinks(text: string): Links {
  const links: Links = {};
  // Take emails out first so their domains are not read as links.
  const withoutEmails = text.replace(EMAIL, ' ');
  for (const match of withoutEmails.matchAll(URL_LIKE)) {
    const raw = match[0].replace(/[.,;:!?)\]>]+$/, '');
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    } catch {
      continue;
    }
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const bareHost = host.split('.').slice(-2).join('.');

    if (bareHost === 'linkedin.com' && host.split('.').length <= 3) {
      const slug = new RegExp(`^/(?:in|pub)/(${PROFILE_SLUG})`, 'iu').exec(url.pathname)?.[1];
      links.linkedin ??= slug ? `https://www.linkedin.com/in/${slug}` : undefined;
    } else if (host === 'github.com') {
      const user = new RegExp(`^/(${PROFILE_SLUG})`, 'iu').exec(url.pathname)?.[1];
      links.github ??= user ? `https://github.com/${user}` : undefined;
    } else if (!NOT_PORTFOLIO_HOSTS.has(host) && !NOT_PORTFOLIO_HOSTS.has(bareHost)) {
      const path = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '');
      links.portfolio ??= `${url.protocol}//${url.host}${path}`;
    }
  }
  return links;
}

// --- Location ---------------------------------------------------------------------------------

const LOCATION_SCAN_LINES = 15;

const LOCATION_LABEL = /^(?:location|address|city|based in|lives in)\s*[:\-–]\s*(.+)$/i;

/** "Cairo, Egypt" or "San Francisco, CA, USA": two or three capitalised parts, no digits. */
const PLACE = /^\p{Lu}[\p{L}\p{M}.'’ -]*(?:,\s*\p{Lu}[\p{L}\p{M}.'’ -]*){1,2}$/u;

/** Words that make a "Word, Word" line a job title or an institution, not a place. */
const NOT_PLACE_WORDS =
  /\b(engineer|developer|manager|designer|analyst|intern|consultant|architect|lead|director|specialist|university|college|school|institute|inc|ltd|llc|company|corp)\b/i;

function findLocation(lines: string[], name: string | undefined): string | undefined {
  let seenFirstLine = false;
  for (const line of lines.slice(0, LOCATION_SCAN_LINES)) {
    const trimmed = line.trim();
    if (trimmed === '' || (name !== undefined && trimmed.replace(/\s+/g, ' ') === name)) continue;
    // The first line of a CV is the name ("Hassan, Sara" looks like a place), so only a label counts there.
    const isFirstLine = name === undefined && !seenFirstLine;
    seenFirstLine = true;

    const labelled = LOCATION_LABEL.exec(trimmed)?.[1]?.split(/[|•·●▪\t]| {2,}/)[0]?.trim();
    if (labelled && !/[@\d]/.test(labelled)) return labelled;

    if (isFirstLine) continue;
    for (const segment of trimmed.split(/[|•·●▪\t]| {2,}/)) {
      const part = segment.trim();
      if (PLACE.test(part) && !NOT_PLACE_WORDS.test(part)) return part;
    }
  }
  return undefined;
}

// --- The extractor ----------------------------------------------------------------------------

/** The Preset key of each contact Question, to the value it takes from the text. */
const LINK_KEYS = {
  'contact.linkedin_url': 'linkedin',
  'contact.github_url': 'github',
  'contact.portfolio_url': 'portfolio',
} as const satisfies Partial<Record<PresetKey, keyof Links>>;

/**
 * Reads contact details out of CV text and offers them for the form (phase one of the extractor,
 * `.scratch/cv-autofill/spec.md`). Heuristics, so every value is a guess to be checked by the
 * applicant: first plausible line for the name, first valid email, first valid phone (through
 * `normalizePhone`), first LinkedIn / GitHub / other link, and a "City, Country" near the top or a
 * labelled location.
 *
 * Questions are found by Preset key only, never by label or position; a Question without one is
 * ignored, and so is any Preset key not on the form. Every value for a Question goes through
 * `parseAnswers`, so it respects that Question's type and limits; one that fails is left out.
 * Bump `CV_EXTRACTOR_VERSION` (cv-text.ts) when a heuristic here changes.
 */
export function extractContactSuggestions(text: string, fields: readonly FormField[]): CvSuggestions {
  const lines = text.split(/\r\n|\r|\n/);
  const suggestions: CvSuggestions = { answers: {} };

  const name = findName(lines);
  const email = findEmail(text);
  const phone = findPhone(text);
  if (name) suggestions.name = name;
  if (email) suggestions.email = email;
  if (phone) suggestions.phone = phone;

  const links = findLinks(text);
  const location = findLocation(lines, name);

  for (const field of fields) {
    const key = field.presetKey;
    if (key == null) continue;

    let value: string | undefined;
    if (key === 'contact.location') value = location;
    else if (key in LINK_KEYS) value = links[LINK_KEYS[key as keyof typeof LINK_KEYS]];
    if (value === undefined) continue;

    // The Question's own check: type, length, link rules. A failing value is simply not offered.
    const checked = parseAnswers([field], { [field.key]: value });
    if (checked.ok && field.key in checked.answers) {
      suggestions.answers[field.key] = checked.answers[field.key]!;
    }
  }
  return suggestions;
}
