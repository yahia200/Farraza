/**
 * Text from the header and footer parts of a DOCX. `mammoth.extractRawText` reads only the body, so a
 * CV that keeps its email and website in the page footer lost them (found in the 38-CV test run).
 * The browser unzips the DOCX, hands each `word/header*.xml` and `word/footer*.xml` to
 * `docxPartText`, and appends the lines to the body text (`apps/web/lib/cv-reader.ts`).
 *
 * Pure and linear: the XML is applicant-supplied, so there is no backtracking pattern and no
 * recursion, and the output stops at `DOCX_PART_TEXT_CAP`.
 */

/** The most text kept from one header or footer part. Far more than a contact block needs. */
export const DOCX_PART_TEXT_CAP = 5_000;

/** `word/header1.xml`, `word/footer.xml`, ...: the part names Word gives headers and footers. */
const HEADER_OR_FOOTER = /^word\/(?:header|footer)\d*\.xml$/;

/** Whether a name inside the DOCX zip is a header or footer part (not a relationships file, media or a nested path). */
export function isDocxHeaderOrFooter(name: string): boolean {
  return HEADER_OR_FOOTER.test(name);
}

/**
 * One token of the XML we care about: a paragraph start, a paragraph end, or a text run's content.
 * `<w:t>` must be followed by whitespace or `>`, so `<w:tab/>` and `<w:tbl>` are not text, and
 * `<w:p>` must be too, so `<w:pPr/>` and `<w:p/>` do not open a paragraph.
 */
const TOKEN = /<w:p(?:\s[^>]*)?>|<\/w:p>|<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** Decodes the five XML entities and numeric references in ONE pass, so `&amp;lt;` becomes `&lt;`, not `<`. */
function decodeEntities(value: string): string {
  return value.replace(/&(?:#(\d{1,7})|#x([0-9a-fA-F]{1,6})|(amp|lt|gt|quot|apos));/g, (match, dec, hex, named) => {
    if (named) return ENTITIES[named]!;
    const code = dec ? Number.parseInt(dec, 10) : Number.parseInt(hex, 16);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
  });
}

/** The text of one header or footer part: one line per paragraph, empty paragraphs dropped. */
export function docxPartText(xml: string): string {
  const lines: string[] = [];
  let current = '';
  let length = 0;

  const flush = () => {
    if (current.trim() !== '') {
      lines.push(current);
      length += current.length + 1;
    }
    current = '';
  };

  for (const match of xml.matchAll(TOKEN)) {
    if (match[1] !== undefined) {
      current += decodeEntities(match[1]);
    } else {
      // A paragraph start or end: either way the text so far is one finished line.
      flush();
      if (length >= DOCX_PART_TEXT_CAP) break;
    }
    // One huge run must not be held up until the paragraph ends.
    if (current.length >= DOCX_PART_TEXT_CAP) break;
  }
  flush();
  return lines.join('\n').slice(0, DOCX_PART_TEXT_CAP);
}
