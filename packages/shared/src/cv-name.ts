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
  /\b(engineer|developer|programmer|manager|designer|analyst|intern|consultant|architect|lead|director|specialist|scientist|officer|assistant|coordinator|administrator|accountant|teacher|student|graduate|university|college|school|institute|bachelor|bachelors|master|masters|degree|diploma|doctorate|phd)\b/i;

/**
 * How far down the CV a name is looked for. Two-column templates put it after the sidebar (lines 60
 * and 68 in the 38-CV test run), so this is deep; what keeps a deep scan safe is `NAME_TOP_LINES`.
 */
const NAME_SCAN_LINES = 150;

/**
 * A candidate on one of the first lines (counting non-blank lines) is taken on position alone. One
 * further down needs evidence (`hasEvidence`), because below the header block a two-word line is
 * more often a degree, a skill or a heading ("Bachelor of Science", "KEY ACHIEVEMENTS") than a name.
 */
const NAME_TOP_LINES = 5;

/** A line with more pieces than this is a list ("JavaScript | HTML | PHP | ..."), not a contact line. */
const MAX_NAME_LINE_SEGMENTS = 4;

/** "Name : Sara Hassan", "Full name: ...", "Họ và tên : ..." (Vietnamese): the name is what follows the label. */
const NAME_LABEL = /^(?:full\s+name|name|họ\s+và\s+tên|họ\s+tên|tên)\s*[:：]\s*(.+)$/iu;

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
  /** The line said so: it follows a "Name :" label. */
  labelled: boolean;
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

  const gated: {
    text: string;
    words: string[];
    position: number;
    line: CvLayoutLine | undefined;
    labelled: boolean;
  }[] = [];
  let position = 0;
  const drawnLines = [...drawn.entries()];
  /** The layout line for a piece of text: the same text, else the line that holds it (a segment). */
  const drawnFor = (text: string) =>
    drawn.get(text) ?? drawnLines.find(([key]) => key.includes(text))?.[1];
  /** The non-blank lines in order, for joining a name written over two lines. */
  const seen: { whole: string; position: number }[] = [];

  for (const raw of lines.slice(0, NAME_SCAN_LINES)) {
    const whole = normalizeSpaces(raw);
    if (whole === '') continue;
    const here = position++;
    seen.push({ whole, position: here });

    // A labelled name ("Name : Sara Hassan") is read from after the label. The label is evidence.
    const label = NAME_LABEL.exec(whole)?.[1];
    if (label !== undefined) {
      const labelled = gate(normalizeSpaces(label.split(SEGMENT_SEPARATOR)[0] ?? ''));
      if (labelled) {
        gated.push({ ...labelled, position: here, line: drawnFor(labelled.text), labelled: true });
        continue;
      }
    }

    // A name often shares its line with contact details ("Sara Hassan  +20 100 ..."). The whole
    // line is tried first, so "Omar  Khaled" stays one name; only a line that fails the gate is
    // split into its pieces.
    const wholeGate = gate(whole);
    const segments = raw.split(SEGMENT_SEPARATOR).map(normalizeSpaces).filter((piece) => piece !== '' && piece !== whole);
    // A long list is not a header line: its pieces count only if the email vouches for one.
    const isList = segments.length > MAX_NAME_LINE_SEGMENTS;
    const pieces = wholeGate
      ? [wholeGate]
      : segments
          .flatMap((piece) => gate(piece) ?? [])
          .filter((piece) => !isList || (emailMatchRatio(piece.words, email) ?? 0) > 0);
    for (const piece of pieces) {
      gated.push({ ...piece, position: here, line: drawnFor(piece.text), labelled: false });
    }
  }

  // A name over two lines ("ENRIQUE" above "VERAGOZA"): two one-word lines that sit together at the
  // top. Only the top, so a stray pair of words further down is never glued into a name.
  for (let i = 0; i + 1 < seen.length; i++) {
    const first = seen[i]!;
    const second = seen[i + 1]!;
    if (second.position >= NAME_TOP_LINES) break;
    if (first.whole.includes(' ') || second.whole.includes(' ')) continue;
    // Each half must be a possible name word on its own: "Resume" above "one" is no name.
    if ([first.whole, second.whole].some((word) => NOT_A_NAME.test(word) || NOT_NAME_WORD.test(word))) continue;
    const joined = gate(`${first.whole} ${second.whole}`);
    if (joined) gated.push({ ...joined, position: first.position, line: undefined, labelled: false });
  }
  gated.sort((a, b) => a.position - b.position);

  const sizes = gated.flatMap((candidate) => (candidate.line ? [candidate.line.fontSize] : []));
  const biggest = sizes.length > 0 ? Math.max(...sizes) : null;

  return gated.map(({ text, words, position: at, line, labelled }) => ({
    text,
    features: {
      position: at,
      relativeSize: line && biggest ? line.fontSize / biggest : null,
      bold: line ? line.bold : null,
      allCaps: text === text.toUpperCase() && text !== text.toLowerCase(),
      emailMatch: emailMatchRatio(words, email),
      roleWord: ROLE_WORD.test(text),
      labelled,
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
 * - A "Name :" label is as strong as an email match (+4): the CV says it is the name.
 * - Position is a mild tiebreaker (-0.3 per line above), so with no other signal the first
 *   candidate still wins, as it did before scoring existed.
 */
const NAME_WEIGHTS = {
  roleWord: -5,
  relativeSize: 5,
  emailMatch: 4,
  bold: 1.5,
  allCaps: 1,
  labelled: 4,
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
  if (features.labelled) score += NAME_WEIGHTS.labelled;
  return score;
}

/**
 * A candidate far from the top is only believable with a reason: a "Name :" label, an email whose
 * words match it, or being the biggest text on the page when at least one other candidate was drawn.
 */
function hasEvidence(features: NameFeatures, sizedCandidates: number): boolean {
  return (
    features.labelled ||
    (features.emailMatch ?? 0) > 0 ||
    (features.relativeSize !== null && features.relativeSize >= 0.999 && sizedCandidates >= 2)
  );
}

/**
 * The best-scoring candidate's text; on a tie the earlier line wins. A candidate beyond the first
 * `NAME_TOP_LINES` lines must have evidence (`hasEvidence`). Undefined without a candidate.
 */
export function findName(
  lines: readonly string[],
  email: string | undefined,
  layout?: CvLayout,
): string | undefined {
  const candidates = nameCandidates(lines, email, layout);
  const sized = candidates.filter((candidate) => candidate.features.relativeSize !== null).length;
  let best: { text: string; score: number } | undefined;
  for (const candidate of candidates) {
    if (candidate.features.position >= NAME_TOP_LINES && !hasEvidence(candidate.features, sized)) continue;
    const score = scoreNameFeatures(candidate.features);
    if (best === undefined || score > best.score) best = { text: candidate.text, score };
  }
  return best?.text;
}
