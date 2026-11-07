import { submitApplicationSchema } from './applications.js';
import type { CvLayout, CvLayoutLine } from './cv-layout.js';

/**
 * Finding the applicant's name in CV text, by scoring candidate lines instead of taking the first
 * plausible one (the approach of OpenResume's parser, https://www.open-resume.com/resume-parser,
 * "Step 4": every candidate gets a score from features, the best wins).
 *
 * Two stages, kept apart on purpose:
 * 1. A hard gate (`nameCandidates`): the line must look like a name and be valid for the apply
 *    form's name field. A line that fails is never offered, whatever it would score.
 * 2. Features, then a score (`scoreNameFeatures`): how much each feature matters is the one judgment
 *    call, so it is the one function you tune. Features are measured here and never weighted here.
 *
 * Bump `CV_EXTRACTOR_VERSION` (cv-text.ts) when a gate or the score changes.
 */

/** Lines that head a CV or a section and are never a person's name. */
const NOT_A_NAME =
  /^(curriculum vitae|resume|résumé|cv|profile|summary|contact|contact details|personal details|personal information|objective|about me|experience|education|skills)$/i;

/** Letters (any script), marks, then words joined by space, hyphen, apostrophe or full stop. */
const NAME_WORD = /^[\p{L}\p{M}][\p{L}\p{M}'’.-]*$/u;

/**
 * Words of contact details and section headings: a line holding one is never a name ("LinkedIn
 * Profile", "Personal Information"). Whole words only.
 */
const NOT_NAME_WORD =
  /^(contact|linkedin|github|gitlab|profile|email|e-mail|phone|mobile|tel|address|website|portfolio|references|languages|projects|certifications|skills|education|experience|summary|objective|personal|information|birth)$/i;

/** Where one piece of a CV line ends and the next begins ("Sara Hassan  +20 100 ..."). */
const SEGMENT_SEPARATOR = /[|•·●▪\t]| {2,}/;

/** Job titles and institutions: two capitalised words that are not a person. */
const ROLE_WORD =
  /\b(engineer|developer|programmer|manager|designer|analyst|intern|consultant|architect|lead|director|specialist|scientist|officer|assistant|coordinator|administrator|accountant|teacher|student|graduate|university|college|school|institute)\b/i;

const NAME_SCAN_LINES = 10;

/**
 * What is measured about one candidate line. Raw facts only, no weights. `null` means "this
 * signal is not available" (no layout, no email, a name in another script), and a scorer must
 * treat it as "no information", never as "no match".
 */
export interface NameFeatures {
  /** Non-blank lines above this one: 0 for the first line of the CV. */
  position: number;
  /** Font size as a share of the biggest candidate's, in (0, 1]; null without layout for this line. */
  relativeSize: number | null;
  /** All of the line looks bold; null without layout for this line. */
  bold: boolean | null;
  /** Every letter is a capital (and there is at least one cased letter). */
  allCaps: boolean;
  /** Share of the line's Latin words (3+ letters) found in the email's part before the @; null if unknown. */
  emailMatch: number | null;
  /** Holds a job-title or institution word ("Software Engineer", "Cairo University"). */
  roleWord: boolean;
}

export interface NameCandidate {
  text: string;
  features: NameFeatures;
}

/** Letters a to z only, lower case, accents removed: "Hassan" and "hassân" compare equal. */
function latinLetters(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

/**
 * How well the line's words agree with the email's local part ("sara.hassan" or "shassan" for
 * "Sara Hassan"). Words under 3 letters are ignored ("Al", initials: "ali" would match "natalie");
 * a name with no Latin words (Arabic script) gives null, because an Arabic name cannot match a
 * Latin address by letters and that must not count against it.
 */
export function emailMatchRatio(words: readonly string[], email: string | undefined): number | null {
  if (!email) return null;
  const local = latinLetters(email.slice(0, email.lastIndexOf('@')));
  const latin = words.map(latinLetters).filter((word) => word.length >= 3);
  if (local === '' || latin.length === 0) return null;
  return latin.filter((word) => local.includes(word)).length / latin.length;
}

function normalizeSpaces(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

/** The hard gate for one piece of text: the words if it can be a name, undefined if not. */
function gate(text: string): { text: string; words: string[] } | undefined {
  if (NOT_A_NAME.test(text)) return undefined;
  const words = text.split(' ');
  if (words.length < 2 || words.length > 5) return undefined;
  if (!words.every((word) => NAME_WORD.test(word))) return undefined;
  // A lone letter is an initial only when written "J."; a bare one is usually an icon from the
  // PDF's symbol font read as a letter ("ï LinkedIn Profile").
  if (words.some((word) => [...word].length === 1)) return undefined;
  if (words.some((word) => NOT_NAME_WORD.test(word))) return undefined;
  // The application form's own rule (2 to 100 characters).
  const checked = submitApplicationSchema.shape.name.safeParse(text);
  return checked.success ? { text: checked.data, words } : undefined;
}

/**
 * The lines that pass the gate, each with its features, in CV order. Layout lines are matched to CV
 * text lines by their text (spaces collapsed); a line with no match simply has no layout features.
 * The CV text stays the source of truth: layout only adds information, it never adds a candidate.
 */
export function nameCandidates(
  lines: readonly string[],
  email: string | undefined,
  layout?: CvLayout,
): NameCandidate[] {
  const drawn = new Map<string, CvLayoutLine>();
  for (const line of layout?.lines ?? []) {
    const key = normalizeSpaces(line.text);
    if (!drawn.has(key)) drawn.set(key, line);
  }

  const gated: { text: string; words: string[]; position: number; line: CvLayoutLine | undefined }[] = [];
  let position = 0;
  const drawnLines = [...drawn.entries()];
  /** The layout line for a piece of text: the same text, else the line that holds it (a segment). */
  const drawnFor = (text: string) =>
    drawn.get(text) ?? drawnLines.find(([key]) => key.includes(text))?.[1];

  for (const raw of lines.slice(0, NAME_SCAN_LINES)) {
    const whole = normalizeSpaces(raw);
    if (whole === '') continue;
    const here = position++;
    // A name often shares its line with contact details ("Sara Hassan  +20 100 123 4567"). The whole
    // line is tried first, so "Omar  Khaled" stays one name; only a line that fails the gate is
    // split into its pieces.
    const wholeGate = gate(whole);
    const pieces = wholeGate
      ? [wholeGate]
      : raw
          .split(SEGMENT_SEPARATOR)
          .map(normalizeSpaces)
          .filter((piece) => piece !== '' && piece !== whole)
          .flatMap((piece) => gate(piece) ?? []);
    for (const piece of pieces) {
      gated.push({ ...piece, position: here, line: drawnFor(piece.text) });
    }
  }

  const sizes = gated.flatMap((candidate) => (candidate.line ? [candidate.line.fontSize] : []));
  const biggest = sizes.length > 0 ? Math.max(...sizes) : null;

  return gated.map(({ text, words, position: at, line }) => ({
    text,
    features: {
      position: at,
      relativeSize: line && biggest ? line.fontSize / biggest : null,
      bold: line ? line.bold : null,
      allCaps: text === text.toUpperCase() && text !== text.toLowerCase(),
      emailMatch: emailMatchRatio(words, email),
      roleWord: ROLE_WORD.test(text),
    },
  }));
}

/**
 * What each feature is worth. Hand-picked, like OpenResume's (whose name features are bold +2,
 * all capitals +2, and -4 for a line that looks like another attribute), and not yet tuned on real
 * CVs: tune these against `.scratch/cv-samples/` and keep `cv-name.test.ts` passing.
 *
 * The reasoning, strongest first:
 * - A job-title or institution word is the clearest sign of "not a name" (-5), enough to beat the
 *   gap between a headline's early position and a name's later one.
 * - The biggest text on page 1 is usually the name, so relative size is worth up to +5.
 * - An email whose words match the line is strong evidence (+4 at a full match). No email, or a
 *   name in another script, scores 0: absence is not a mismatch.
 * - Bold (+1.5) and all capitals (+1) only add. Bold is never penalised when false, because
 *   `fontFamily` often cannot say bold at all (see `cv-layout.ts`).
 * - Position is a mild tiebreaker (-0.3 per line above), so with no other signal the first
 *   candidate still wins, as it did before scoring existed.
 */
const NAME_WEIGHTS = {
  roleWord: -5,
  relativeSize: 5,
  emailMatch: 4,
  bold: 1.5,
  allCaps: 1,
  position: -0.3,
} as const;

/** How likely a candidate line is the applicant's name: higher is better, only the order matters. */
export function scoreNameFeatures(features: NameFeatures): number {
  let score = NAME_WEIGHTS.position * features.position;
  if (features.roleWord) score += NAME_WEIGHTS.roleWord;
  if (features.relativeSize !== null) score += NAME_WEIGHTS.relativeSize * features.relativeSize;
  if (features.emailMatch !== null) score += NAME_WEIGHTS.emailMatch * features.emailMatch;
  if (features.bold === true) score += NAME_WEIGHTS.bold;
  if (features.allCaps) score += NAME_WEIGHTS.allCaps;
  return score;
}

/** The best-scoring candidate's text; on a tie the earlier line wins. Undefined without a candidate. */
export function findName(
  lines: readonly string[],
  email: string | undefined,
  layout?: CvLayout,
): string | undefined {
  let best: { text: string; score: number } | undefined;
  for (const candidate of nameCandidates(lines, email, layout)) {
    const score = scoreNameFeatures(candidate.features);
    if (best === undefined || score > best.score) best = { text: candidate.text, score };
  }
  return best?.text;
}
