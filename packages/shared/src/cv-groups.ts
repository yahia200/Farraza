import { parseAnswers, type Answers, type Entry } from './answers.js';
import type { FormField } from './form-fields.js';

/**
 * Phase two of the CV extractor (`.scratch/cv-autofill/spec.md`, "Shared package"; ticket 07):
 * Education and Experience Entries for the matching Repeating groups. Pure, English CVs only.
 *
 * Heuristics that stay quiet when unsure: it only fills sub-answers it is confident about (degree
 * level, years, dates, plain title / company / school lines) and never guesses from messy layout.
 * Groups and sub-questions are found by Preset key only (ADR-0004), never by label or position.
 * Bump `CV_EXTRACTOR_VERSION` (cv-text.ts) when a heuristic here changes.
 */

// --- Sections ---------------------------------------------------------------------------------

const EDUCATION_HEADINGS = new Set([
  'education',
  'educational background',
  'education and training',
  'education & training',
  'education and qualifications',
  'educational qualifications',
  'academic background',
  'academic qualifications',
  'academic education',
]);

const EXPERIENCE_HEADINGS = new Set([
  'experience',
  'work experience',
  'professional experience',
  'employment history',
  'work history',
  'employment',
  'career history',
  'professional background',
  'relevant experience',
]);

/** Headings that end a section without being one we read. */
const OTHER_HEADINGS = new Set([
  'skills', 'technical skills', 'key skills', 'core skills', 'summary', 'professional summary', 'profile',
  'objective', 'career objective', 'projects', 'certifications', 'certificates', 'courses', 'languages',
  'awards', 'honors', 'achievements', 'references', 'interests', 'hobbies', 'publications', 'volunteering',
  'volunteer experience', 'activities', 'contact', 'personal details', 'personal information',
  'additional information', 'links', 'tools', 'technologies',
]);

function headingOf(line: string): string {
  return line
    .trim()
    .replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

type SectionKind = 'education' | 'experience';

/** The lines under each heading we read, up to the next heading of any kind. */
function findSections(lines: string[]): Record<SectionKind, string[][]> {
  const sections: Record<SectionKind, string[][]> = { education: [], experience: [] };
  let current: string[] | null = null;
  for (const line of lines) {
    const heading = line.trim().length <= 40 ? headingOf(line) : '';
    if (EDUCATION_HEADINGS.has(heading)) sections.education.push((current = []));
    else if (EXPERIENCE_HEADINGS.has(heading)) sections.experience.push((current = []));
    else if (OTHER_HEADINGS.has(heading)) current = null;
    else current?.push(line);
  }
  return sections;
}

/** Entries are separated by blank lines. */
function toBlocks(section: string[]): string[][] {
  const blocks: string[][] = [];
  let block: string[] = [];
  for (const line of section) {
    if (line.trim() === '') {
      if (block.length > 0) blocks.push(block);
      block = [];
    } else {
      block.push(line.trim());
    }
  }
  if (block.length > 0) blocks.push(block);
  return blocks;
}

// --- Dates ------------------------------------------------------------------------------------

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const MONTH_SRC =
  '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const YEAR_SRC = '(?:19|20)\\d\\d';
const POINT_SRC = `(?:${MONTH_SRC}\\.?,?\\s+)?${YEAR_SRC}|(?:0?[1-9]|1[0-2])[/.]${YEAR_SRC}`;
const OPEN_END_SRC = '(?:to\\s+date|till\\s+date|present|current|currently|now|ongoing|today|date)';
const RANGE = new RegExp(
  `(?<![\\p{L}\\p{N}/.])(${POINT_SRC})\\s*(?:-|–|—|to|until|till)\\s*(${POINT_SRC}|${OPEN_END_SRC})(?![\\p{L}\\p{N}])`,
  'iu',
);
const RANGE_ALL = new RegExp(RANGE.source, 'giu');

interface Point {
  year: number;
  /** 1 to 12, or null for a year-only date. */
  month: number | null;
}

function parsePoint(text: string): Point | null {
  const year = /(?:19|20)\d\d/.exec(text);
  if (!year) return null;
  const word = /[a-z]{3}/i.exec(text.replace(year[0], ''));
  if (word) {
    const month = MONTHS[word[0].toLowerCase()];
    return month === undefined ? null : { year: Number(year[0]), month };
  }
  const numeric = /^(\d{1,2})[/.]/.exec(text.trim());
  return { year: Number(year[0]), month: numeric ? Number(numeric[1]) : null };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** First day of the period (a start) or its last day (an end), as `YYYY-MM-DD`. */
function isoOf(point: Point, edge: 'start' | 'end'): string {
  const month = point.month ?? (edge === 'start' ? 1 : 12);
  const day = edge === 'start' ? 1 : new Date(Date.UTC(point.year, month, 0)).getUTCDate();
  return `${point.year}-${pad(month)}-${pad(day)}`;
}

interface DateRange {
  start: Point | null;
  /** `null` for "Present" or an unreadable end. */
  end: Point | null;
}

/** Reads the range (or null) out of a line and returns the line without it. */
function takeRange(line: string): { range: DateRange | null; rest: string; count: number } {
  const matches = [...line.matchAll(RANGE_ALL)];
  if (matches.length === 0) return { range: null, rest: line, count: 0 };
  const first = matches[0]!;
  // A single unknown word before the date ("Smarch 2020") is a month we cannot read: no start.
  const before = line.slice(0, first.index).trim();
  const unreadableMonth = /^\p{L}+\.?,?$/u.test(before);
  const start = unreadableMonth ? null : parsePoint(first[1]!);
  const end = parsePoint(first[2]!);
  const rest = line
    .replace(unreadableMonth ? before : '', '')
    .replace(first[0], ' ')
    .replace(/\(\s*\)|\[\s*\]/g, ' ')
    .replace(/^[\s|,;:\-–—•·]+|[\s|,;:\-–—•·]+$/g, '')
    .replace(/\s+/g, ' ');
  const backwards =
    start !== null && end !== null &&
    (start.year > end.year || (start.year === end.year && (start.month ?? 1) > (end.month ?? 12)));
  return { range: backwards ? { start: null, end: null } : { start, end }, rest, count: matches.length };
}

/** A line that is only a year: "2019", "Graduated 2019", "Class of 2019", "(June 2019)". */
const LONE_YEAR = new RegExp(
  `^(?:graduat(?:ed|ion)(?:\\s+in)?:?|expected(?:\\s+graduation)?(?:\\s+in)?:?|class\\s+of|completed(?:\\s+in)?:?)?\\s*\\(?(?:${MONTH_SRC}\\.?,?\\s+)?(${YEAR_SRC})\\)?$`,
  'i',
);

// --- Block analysis ---------------------------------------------------------------------------

const BULLET = /^[-–—•*·▪●◦■□►>]\s/;
const MAX_LINE = 100;
const CONNECTORS = new Set(['of', 'and', '&', 'the', 'at', 'for', 'in', 'de', 'la', 'al']);

/** Title-case-ish text: every word starts with a capital or digit (or is a small connector). */
function looksNamed(text: string): boolean {
  const words = text.split(' ');
  return words.every((w) => CONNECTORS.has(w.toLowerCase()) || /^[\p{Lu}\d&(]/u.test(w));
}

interface Block {
  /** Non-bullet lines, short enough to be a heading line, with the date range taken out. */
  headers: string[];
  range: DateRange | null;
  loneYear: number | null;
}

/** Null when the block is ambiguous (more than one date range). */
function analyse(lines: string[]): Block | null {
  const headers: string[] = [];
  let range: DateRange | null = null;
  let loneYear: number | null = null;
  let ranges = 0;
  for (const line of lines) {
    if (BULLET.test(line) || line.length > MAX_LINE) continue;
    const taken = takeRange(line);
    ranges += taken.count;
    if (taken.range) range = taken.range;
    if (taken.rest === '') continue;
    const lone = taken.count === 0 ? LONE_YEAR.exec(taken.rest) : null;
    if (lone) {
      loneYear = Number(lone[1]);
      continue;
    }
    headers.push(taken.rest);
  }
  if (ranges > 1) return null;
  return { headers: headers.slice(0, 5), range, loneYear };
}

// --- Education --------------------------------------------------------------------------------

type DegreeLevel = 'high_school' | 'diploma' | 'bachelor' | 'master' | 'doctorate';

/** Words match in any case; abbreviations (MSc, BA) only as written in capitals. */
const LEVELS: [DegreeLevel, RegExp[]][] = [
  ['doctorate', [/\b(?:ph\.?\s?d|doctorate|doctor of)\b/i]],
  ['master', [/\bmaster'?s?\b/i, /\b(?:M\.?Sc|M\.?Eng|MBA|MPhil|M\.?[AS](?=\s+in\b))\b/]],
  ['bachelor', [/\bbachelor'?s?\b/i, /\b(?:B\.?Sc|B\.?Eng|B\.?Tech|BBA|LLB|B\.?[AS](?=\s+in\b|,))\b/]],
  ['diploma', [/\bdiploma\b/i]],
  ['high_school', [/\b(?:high school|secondary school|secondary education|general secondary)\b/i]],
];

const namesLevel = (line: string) => LEVELS.some(([, patterns]) => patterns.some((p) => p.test(line)));

/** The one level the block names, or null for none or for several (then we do not guess). */
function degreeLevel(headers: string[]): DegreeLevel | null {
  const found = new Set<DegreeLevel>();
  for (const line of headers) for (const [level, patterns] of LEVELS) if (patterns.some((p) => p.test(line))) found.add(level);
  if (found.has('high_school')) found.delete('diploma');
  return found.size === 1 ? [...found][0]! : null;
}

const LEVEL_LABEL: Record<DegreeLevel, RegExp> = {
  doctorate: /doctor|phd/i,
  master: /master/i,
  bachelor: /bachelor/i,
  diploma: /^(?!.*school).*diploma/i,
  high_school: /high school|secondary/i,
};

/** The id of the single option whose label names the level, or undefined. */
function optionFor(field: FormField, level: DegreeLevel): string | undefined {
  if (field.type !== 'single_select') return undefined;
  const matches = field.config.options.filter((o) => LEVEL_LABEL[level].test(o.label));
  return matches.length === 1 ? matches[0]!.id : undefined;
}

const SCHOOL_WORD = /\b(?:university|college|institute|school|academy|polytechnic)\b/i;

/** A clean line naming one school: no commas or separators, so no field of study mixed in. */
function findSchool(headers: string[]): string | undefined {
  const lines = headers.filter(
    (l) =>
      SCHOOL_WORD.test(l) &&
      !namesLevel(l) &&
      !/[,|;:]|\s[-–—]\s/.test(l) &&
      !/\d/.test(l) &&
      looksNamed(l) &&
      l.split(' ').length <= 8,
  );
  return lines.length === 1 ? lines[0] : undefined;
}

type RawEntry = Partial<Record<string, string | number>>;

function educationEntry(block: Block, children: Map<string, FormField>): RawEntry {
  const out: RawEntry = {};
  const level = degreeLevel(block.headers);
  const degree = children.get('education.degree');
  if (level && degree) out['education.degree'] = optionFor(degree, level);
  out['education.school'] = findSchool(block.headers);
  if (block.range) {
    if (block.range.start) out['education.start_year'] = block.range.start.year;
    if (block.range.end) out['education.end_year'] = block.range.end.year;
  } else if (block.loneYear !== null) {
    out['education.end_year'] = block.loneYear;
  }
  return out;
}

// --- Experience -------------------------------------------------------------------------------

const TITLE_WORD =
  /\b(?:engineer|developer|programmer|manager|designer|analyst|intern|consultant|architect|lead|director|specialist|administrator|accountant|officer|coordinator|assistant|teacher|instructor|scientist|researcher|technician|supervisor|executive|associate|representative|strategist|editor|writer|trainee|tutor|head|president|founder|cto|ceo|cfo|freelancer)\b/i;

const COMPANY_SUFFIX =
  /\b(?:inc|llc|ltd|corp|corporation|company|co|gmbh|group|technologies|solutions|systems|labs|studio|studios|bank|agency|partners|consulting|industries|holdings|enterprises)\b\.?$/i;

const isTitle = (text: string) =>
  TITLE_WORD.test(text) && text.split(' ').length <= 7 && !/[.:;]$/.test(text) && !/\d/.test(text) && looksNamed(text);

const isNamedCompany = (text: string) =>
  text.length <= 60 && text.split(' ').length <= 5 && !/\d/.test(text) && !/[.:;]$/.test(text) && looksNamed(text);

/** Splits "Title at Company", "Title | Company", "Title - Company", "Title, Company" (either order). */
function splitTitleCompany(line: string): { title: string; company: string } | null {
  const at = /^(.+?)\s+(?:at|@)\s+(.+)$/i.exec(line);
  if (at && isTitle(at[1]!) && isNamedCompany(at[2]!)) return { title: at[1]!, company: at[2]! };
  for (const separator of [/\s*\|\s*/, /\s+[-–—]\s+/, /,\s+/]) {
    const parts = line.split(separator);
    if (parts.length !== 2) continue;
    const [a, b] = parts as [string, string];
    if (isTitle(a) && !isTitle(b) && isNamedCompany(b)) return { title: a, company: b };
    if (isTitle(b) && !isTitle(a) && isNamedCompany(a)) return { title: b, company: a };
  }
  return null;
}

function findTitleAndCompany(headers: string[]): { title?: string; company?: string } {
  for (const line of headers.slice(0, 3)) {
    const split = splitTitleCompany(line);
    if (split) return split;
  }

  const titled = headers.slice(0, 3).filter((l) => isTitle(l) && !splitTitleCompany(l));
  const title = titled.length === 1 ? titled[0] : undefined;

  const suffixed = headers.filter((l) => !TITLE_WORD.test(l) && COMPANY_SUFFIX.test(l) && isNamedCompany(l));
  if (suffixed.length === 1) return { title, company: suffixed[0] };
  if (suffixed.length > 1 || title === undefined) return { title };

  // A plain line right next to the title line, when only one side qualifies.
  const at = headers.indexOf(title);
  const neighbours = [headers[at - 1], headers[at + 1]].filter(
    (l): l is string => l !== undefined && !TITLE_WORD.test(l) && !l.includes(',') && isNamedCompany(l),
  );
  return { title, company: neighbours.length === 1 ? neighbours[0] : undefined };
}

function experienceEntry(block: Block): RawEntry {
  const out: RawEntry = {};
  const { title, company } = findTitleAndCompany(block.headers);
  out['experience.job_title'] = title;
  out['experience.company'] = company;
  if (block.range?.start) out['experience.start_date'] = isoOf(block.range.start, 'start');
  if (block.range?.end) out['experience.end_date'] = isoOf(block.range.end, 'end');
  return out;
}

// --- The entry point --------------------------------------------------------------------------

/** The group with this Preset key and its sub-questions by their own Preset keys. */
function findGroup(fields: readonly FormField[], presetKey: SectionKind) {
  const group = fields.find((f) => f.presetKey === presetKey && f.type === 'repeating_group');
  if (!group || group.type !== 'repeating_group') return null;
  const children = new Map<string, FormField>();
  for (const child of group.config.fields) if (child.presetKey != null) children.set(child.presetKey, child);
  return { group, children, maxEntries: group.config.maxEntries };
}

/**
 * Keeps the value only if it passes the sub-question's own type and limits. `required` is ignored on
 * purpose: a suggestion is partial (the applicant completes the rest), and `parseAnswers` would
 * otherwise refuse an Entry that lacks, say, a school.
 */
function validated(child: FormField, value: string | number): string | number | undefined {
  const checked = parseAnswers([{ ...child, required: false } as FormField], { [child.key]: value });
  const kept = checked.ok ? checked.answers[child.key] : undefined;
  return typeof kept === 'string' || typeof kept === 'number' ? kept : undefined;
}

function buildEntries(
  blocks: string[][],
  children: Map<string, FormField>,
  maxEntries: number,
  read: (block: Block) => RawEntry,
): Entry[] {
  const entries: Entry[] = [];
  for (const lines of blocks) {
    const block = analyse(lines);
    if (!block) continue;
    const raw = read(block);
    const entry: Entry = {};
    for (const [presetKey, value] of Object.entries(raw)) {
      const child = children.get(presetKey);
      if (!child || value === undefined) continue;
      const kept = validated(child, value);
      if (kept !== undefined) entry[child.key] = kept;
    }
    if (Object.keys(entry).length > 0) entries.push(entry);
  }
  return entries.slice(0, maxEntries);
}

/**
 * Education and Experience Entries for the form's matching Repeating groups, as `Answers` keyed by
 * the group's Question key (each value a list of Entries keyed by sub-question key). A form
 * without those groups gets `{}`. Normally called through `extractContactSuggestions`.
 */
export function extractGroupAnswers(text: string, fields: readonly FormField[]): Answers {
  const answers: Answers = {};
  const education = findGroup(fields, 'education');
  const experience = findGroup(fields, 'experience');
  if (!education && !experience) return answers;

  const sections = findSections(text.split(/\r\n|\r|\n/));

  const targets = [
    { target: education, kind: 'education' as const, read: (b: Block, c: Map<string, FormField>) => educationEntry(b, c) },
    { target: experience, kind: 'experience' as const, read: (b: Block) => experienceEntry(b) },
  ];
  for (const { target, kind, read } of targets) {
    if (!target) continue;
    const blocks = sections[kind].flatMap(toBlocks);
    const entries = buildEntries(blocks, target.children, target.maxEntries, (b) => read(b, target.children));
    if (entries.length > 0) answers[target.group.key] = entries;
  }
  return answers;
}
