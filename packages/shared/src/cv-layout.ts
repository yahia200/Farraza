/**
 * How the first page of a PDF CV is drawn, as the browser's reader sees it. The plain CV text has
 * lost this (it keeps line breaks, not font sizes), and a name is usually the biggest text on the
 * page, so the name scorer (`cv-name.ts`) uses it as one signal among several.
 *
 * Browser-only on purpose: it is never sent to the API and never stored (ADR-0006 stores CV text
 * only), and every extractor must still work without it (a DOCX, a failed layout read, the server).
 * Pure: no I/O, no DOM. The idea (score text by its look, not only by its words) is from OpenResume's
 * parser, https://www.open-resume.com/resume-parser, "Step 4: Extract attributes from sections".
 */

/**
 * One piece of text as the PDF reader reports it. This is the subset of unpdf's `StructuredTextItem`
 * that matters here (`apps/web/node_modules/unpdf/dist/index.d.mts`; README "extractTextItems"),
 * declared again so this package does not depend on unpdf. A unpdf item can be passed as is.
 */
export interface LayoutItem {
  str: string;
  /** PDF space, origin bottom-left: a larger `y` is higher on the page. */
  x: number;
  y: number;
  width: number;
  fontSize: number;
  /** pdf.js's CSS family for the font: a real name only sometimes, often just `sans-serif`. */
  fontFamily: string;
}

/** One drawn line: its text, its biggest font size, and whether all of it looks bold. */
export interface CvLayoutLine {
  text: string;
  fontSize: number;
  bold: boolean;
}

/** The first page's lines, top to bottom. */
export interface CvLayout {
  lines: CvLayoutLine[];
}

/**
 * Words that say a font is bold. `fontFamily` is only sometimes a real font name ("Calibri-Bold");
 * for many PDFs it is a generic family and this never matches, so bold is a bonus signal and font
 * size is the one to rely on (owner decision, cv-autofill name scoring).
 */
const BOLD_FAMILY = /bold|black|heavy|demi/i;

export function isBoldFamily(family: string): boolean {
  return BOLD_FAMILY.test(family);
}

/** Two items are on one line when their baselines differ by less than this share of the font size. */
const SAME_LINE_TOLERANCE = 0.4;

/** A gap wider than this share of the font size between two items is a space. */
const SPACE_GAP = 0.2;

/**
 * Groups reported text items into lines: top to bottom, each line left to right. Items that only
 * hold spaces are dropped (the gap between neighbours decides whether a space goes in). A page with
 * two columns whose items share a baseline comes out as one long line, which simply will not match
 * a line of the CV text; nothing breaks, the name loses only the layout bonus.
 */
export function buildLayoutLines(items: readonly LayoutItem[]): CvLayoutLine[] {
  const usable = items.filter(
    (item) =>
      item.str.trim() !== '' &&
      Number.isFinite(item.x) &&
      Number.isFinite(item.y) &&
      Number.isFinite(item.width) &&
      Number.isFinite(item.fontSize) &&
      item.fontSize > 0,
  );
  const ordered = [...usable].sort((a, b) => b.y - a.y || a.x - b.x);

  const rows: LayoutItem[][] = [];
  for (const item of ordered) {
    const row = rows.at(-1);
    if (row && Math.abs(row[0]!.y - item.y) <= item.fontSize * SAME_LINE_TOLERANCE) row.push(item);
    else rows.push([item]);
  }

  const lines: CvLayoutLine[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    let text = '';
    let previous: LayoutItem | undefined;
    for (const item of row) {
      const gap = previous ? item.x - (previous.x + previous.width) : 0;
      if (previous && gap > item.fontSize * SPACE_GAP) text += ' ';
      text += item.str;
      previous = item;
    }
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean === '') continue;
    lines.push({
      text: clean,
      fontSize: Math.max(...row.map((item) => item.fontSize)),
      bold: row.every((item) => isBoldFamily(item.fontFamily)),
    });
  }
  return lines;
}
