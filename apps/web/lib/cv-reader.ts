import {
  CV_DOCX_TYPE,
  CV_PDF_TYPE,
  buildLayoutLines,
  contentTypeOf,
  normalizeCvText,
  resolveCvTextStatus,
  type CvLayout,
  type CvText,
} from "@repo/shared";

/**
 * Reads the text of the CV the applicant picked, in their browser (ADR-0006). The only module that
 * knows about the PDF and DOCX libraries, so swapping one touches nothing else.
 *
 * - PDF: `unpdf` (`node_modules/unpdf/README.md`: `getDocumentProxy`, `extractText`, and
 *   `extractTextItems` for the first page's layout: font size and bold, used to score the name).
 * - DOCX: `mammoth` (`node_modules/mammoth/README.md`, `mammoth.extractRawText`, input
 *   `{ arrayBuffer }` in the browser; types in `lib/index.d.ts`).
 * Both are loaded with `import()` only when a CV is picked
 * (`node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`, "Loading External Libraries"),
 * so the apply page's first load does not grow.
 *
 * Never throws and never rejects: any failure, a file of another type, or a timeout is
 * `{ text: "", status: "failed" }`. A file that gives (almost) no text is `unreadable`
 * (`resolveCvTextStatus`, the same rule the server applies).
 *
 * The result keeps the two apart on purpose: `cv` is what the submit sends (strict schema, text and
 * status only), `layout` is for the extractor in this browser and is never sent or stored.
 */

/** What a read gives back. `layout` is only ever set for a PDF whose layout could be read. */
export interface CvRead {
  cv: CvText;
  layout?: CvLayout;
}

/** How long a read may take before it counts as `failed`. */
export const CV_READ_TIMEOUT_MS = 15_000;

/** A longer PDF is not a CV; stop before extracting it page by page. */
const MAX_PDF_PAGES = 30;

/** unpdf's advice for untrusted PDFs (README, "Process Untrusted PDFs"): about 16 megapixels. */
const MAX_IMAGE_PIXELS = 16_777_216;

/** How long Send waits for a read that has not finished before it sends the CV as `failed`. */
export const CV_SUBMIT_WAIT_MS = 5_000;

/** What a read that failed, or was given up on, reports: no text, status `failed`. */
export const CV_READ_FAILED: CvText = { text: "", status: "failed" };

const FAILED = CV_READ_FAILED;

async function readPdf(data: ArrayBuffer): Promise<{ text: string; layout?: CvLayout }> {
  const { extractText, extractTextItems, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(data), {
    maxImageSize: MAX_IMAGE_PIXELS,
  });
  if (pdf.numPages > MAX_PDF_PAGES) {
    throw new Error("Too many pages");
  }
  const { text } = await extractText(pdf, { mergePages: true });

  // The layout is a bonus: whatever goes wrong here, the text above is still returned. unpdf's
  // `extractTextItems` reads every page (no page option; the page cap above bounds it) and we keep
  // the first, where the name is.
  let layout: CvLayout | undefined;
  try {
    const { items } = await extractTextItems(pdf);
    // Cleaned like the CV text (symbol-font glyphs come out as control characters), so a layout
    // line still equals the CV text line it was drawn as.
    layout = {
      lines: buildLayoutLines(items[0] ?? []).map((line) => ({ ...line, text: normalizeCvText(line.text) })),
    };
  } catch {
    layout = undefined;
  }
  return { text, layout };
}

async function readDocx(data: ArrayBuffer): Promise<{ text: string; layout?: CvLayout }> {
  // mammoth is CommonJS: the namespace import has the functions on `default` or directly.
  const imported = await import("mammoth");
  const mammoth = imported.default ?? imported;
  const { value } = await mammoth.extractRawText({ arrayBuffer: data });
  // Raw text puts a blank line between every paragraph (and two around an empty one), but the
  // extractors read a blank line as the gap between entries. Halve each run of line breaks so a
  // Word paragraph is one line and an empty paragraph is one blank line (checked with mammoth 1.x
  // on a hand-made DOCX).
  return { text: value.replace(/\n\n/g, "\n") };
}

/**
 * `timeoutMs` bounds the wait, not the work: unpdf's serverless PDF.js runs on the page's own
 * thread (README: "no worker"), so a read that is stuck in synchronous code cannot be interrupted;
 * the result is simply ignored when the timeout wins.
 */
export async function readCv(
  file: File,
  { timeoutMs = CV_READ_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<CvRead> {
  const type = contentTypeOf(file);
  if (type !== CV_PDF_TYPE && type !== CV_DOCX_TYPE) {
    return { cv: FAILED };
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });

  try {
    const read = (async () => {
      const data = await file.arrayBuffer();
      return type === CV_PDF_TYPE ? readPdf(data) : readDocx(data);
    })();
    // A read that loses the race must not become an unhandled rejection later.
    read.catch(() => {});
    const raw = await Promise.race([read, timeout]);
    if (raw === null) {
      return { cv: FAILED };
    }
    const text = normalizeCvText(raw.text);
    return {
      cv: { text, status: resolveCvTextStatus(text, "readable") },
      layout: raw.layout,
    };
  } catch {
    return { cv: FAILED };
  } finally {
    clearTimeout(timer);
  }
}
