import { parseAnswers, type Answers } from './answers.js';
import { submitApplicationSchema } from './applications.js';
import { extractGroupAnswers } from './cv-groups.js';
import type { CvLayout } from './cv-layout.js';
import { findName } from './cv-name.js';
import type { FormField } from './form-fields.js';
import { normalizePhone } from './phone.js';
import type { PresetKey } from './preset-keys.js';

/**
 * What an extractor offers the apply form. The SAME shape covers contacts and groups (ticket 07
 * adds the Education and Experience Entries through `extractContactSuggestions`), so the server (ticket 04) and
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

// --- Email ------------------------------------------------------------------------------------

/**
 * The text is applicant-supplied and the server runs this on up to `CV_TEXT_CAP` characters, so the
 * pattern must stay linear. It starts only at the start of a run of local-part characters (the
 * lookbehind) and bounds each part to the real limits: 64 for the local part, 63 per domain label.
 * Without the start anchor, a long run with no `@` was re-scanned from every position (about 2 s
 * for 50,000 characters).
 */
const EMAIL =
  /(?<![\p{L}\p{N}._%+-])[\p{L}\p{N}._%+-]{1,64}@[\p{L}\p{N}-]{1,63}(?:\.[\p{L}\p{N}-]{1,63})*\.\p{L}{2,63}/gu;

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
  // Resume builders put their own address in a footer or watermark ("Created with enhancv.com").
  'enhancv.com',
  'canva.com',
  'novoresume.com',
  'zety.com',
  'resume.io',
  'resumegenius.com',
  'kickresume.com',
  'flowcv.com',
  'livecareer.com',
  'myperfectresume.com',
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
  /\b(engineer|developer|manager|designer|analyst|intern|consultant|architect|lead|director|specialist|administrator|officer|assistant|coordinator|technician|accountant|programmer|university|college|school|institute|inc|ltd|llc|company|corp)\b/i;

/** Lower-case joining words: a place never has one ("... Forms, Idoc RFC and Workflows."). */
const SENTENCE_WORDS = /\b(?:and|or|with|for|using|the|to)\b/;

/** The labels of contact details ("LinkedIn", "Email:"), which sit beside a city on one line. */
const CONTACT_LABEL = /\b(?:linkedin|github|portfolio|website|e-?mail|phone|mobile|tel)\b\s*:?/giu;

/**
 * A line with its email, phone, links and their labels blanked out, so a city on the same line
 * ("k@example.com (123) 456-7890 Brooklyn, NY LinkedIn") is left as its own piece.
 */
function withoutContactDetails(line: string): string {
  return line.replace(EMAIL, '  ').replace(PHONE, '  ').replace(URL_LIKE, '  ').replace(CONTACT_LABEL, '  ');
}

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
    for (const segment of withoutContactDetails(trimmed).split(/[|•·●▪\t]| {2,}/)) {
      const part = segment.trim();
      if (PLACE.test(part) && !NOT_PLACE_WORDS.test(part) && !SENTENCE_WORDS.test(part)) return part;
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
 * applicant: the best-scoring line near the top for the name (`cv-name.ts`: position, the email's
 * words, and, when `layout` is given, font size and bold), first valid email, first valid phone
 * (through `normalizePhone`), first LinkedIn / GitHub / other link, and a "City, Country" near the
 * top or a labelled location.
 *
 * `layout` is optional and browser-only (`cv-layout.ts`): a DOCX, a failed layout read and every
 * caller without it get the same answer minus the layout bonus.
 *
 * Questions are found by Preset key only, never by label or position; a Question without one is
 * ignored, and so is any Preset key not on the form. Every value for a Question goes through
 * `parseAnswers`, so it respects that Question's type and limits; one that fails is left out.
 * Bump `CV_EXTRACTOR_VERSION` (cv-text.ts) when a heuristic here changes.
 */
export function extractContactSuggestions(
  text: string,
  fields: readonly FormField[],
  layout?: CvLayout,
): CvSuggestions {
  const lines = text.split(/\r\n|\r|\n/);
  const suggestions: CvSuggestions = { answers: {} };

  // The email first: it is the more reliable value, and it helps pick the name.
  const email = findEmail(text);
  const name = findName(lines, email, layout);
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
  // Education and Experience Entries (ticket 07), in the same answers map.
  Object.assign(suggestions.answers, extractGroupAnswers(text, fields));
  return suggestions;
}
