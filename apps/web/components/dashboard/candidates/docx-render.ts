/**
 * Turns an applicant's DOCX into a self-contained HTML page for a sandboxed iframe's `srcdoc`.
 *
 * A DOCX is untrusted input from a stranger, so nothing here lets it run or load anything:
 * - `docx-preview` (version-matched source read in apps/web/node_modules/docx-preview/dist/docx-preview.mjs)
 *   builds DOM with createElement/setAttribute/textContent only, with no innerHTML on document text and
 *   no script or eval. What it does pass through unchecked is (1) hyperlink targets (`a.href = rel.target`,
 *   so `javascript:` and `https:` links are kept), (2) `altChunk` parts, which become an `<iframe srcdoc>`
 *   holding the document's own HTML (which would run with the page's origin if attached to the dashboard),
 *   and (3) inline CSS and `url(...)` values. So: `renderAltChunks: false`, links are stripped below, and
 *   the result goes into an iframe that has no scripts and no origin (`sandbox=""`, see DocxViewer) under a
 *   CSP that forbids every network load.
 * - The library renders into elements that are never attached to the dashboard, and its output is
 *   serialised to a string rather than moved into the page, so the dashboard document never holds
 *   the applicant's markup.
 */

/** Pages bigger than this are not rendered inline (the zip is unpacked in the recruiter's tab). */
export const DOCX_PREVIEW_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Applies to the srcdoc itself, as a `<meta http-equiv>` before any document content: no scripts, no
 * network (images and fonts only as `data:` URLs, which `useBase64URL` produces), no forms, no
 * navigation base. Defence in depth: the iframe's `sandbox` already runs no script.
 * https://developer.mozilla.org/docs/Web/HTTP/Reference/Headers/Content-Security-Policy
 */
const CSP =
  "default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'";

/**
 * Makes the page read as a document in a narrow panel: pages reflow to the panel's width
 * (`ignoreWidth`, see below) instead of keeping Word's fixed page size, which would shrink the text
 * to nothing in a 450px sheet. The library's own styles (in `<style>` blocks above this one) use
 * inline `width`/`padding` on each page, hence the `!important`s.
 */
const READER_STYLE = `
html { color-scheme: light; }
body { margin: 0; background: #f4f4f5; }
.docx-wrapper { padding: 12px !important; background: transparent !important; }
.docx-wrapper > section.docx { width: auto !important; max-width: 100% !important; min-height: 0 !important; padding: 20px !important; margin: 0 0 12px !important; box-sizing: border-box; box-shadow: 0 0 0 1px #e4e4e7 !important; overflow-wrap: anywhere; }
img { max-width: 100%; height: auto; }
a { color: inherit; text-decoration: none; cursor: default; }
`;

export async function renderDocxToSrcdoc(data: ArrayBuffer): Promise<string> {
  // Loaded on demand (https://nextjs.org/docs/app/guides/lazy-loading, "Loading External Libraries"),
  // so the library isn't in the bundle of every candidate page, only of those who open a DOCX.
  const { renderAsync } = await import('docx-preview');

  const body = document.createElement('div');
  const styles = document.createElement('div');
  await renderAsync(data, body, styles, {
    inWrapper: true,
    ignoreWidth: true, // reflow to the panel (see READER_STYLE)
    ignoreHeight: true,
    ignoreFonts: true, // never decode a font the applicant embedded; the page falls back to system fonts
    useBase64URL: true, // images as data: URLs, which an origin-less frame can load (blob: URLs belong to our origin)
    renderAltChunks: false, // an altChunk is a whole HTML page nested in the DOCX; never render it
    renderComments: false,
    renderChanges: false,
    experimental: false,
    debug: false,
  });

  strip(body);
  strip(styles);
  // A `</style>` inside style text would end the element when the string is parsed again.
  for (const style of styles.querySelectorAll('style')) {
    style.textContent = (style.textContent ?? '').replace(/<\/(style)/gi, '<\\/$1');
  }

  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">` +
    `${styles.innerHTML}<style>${READER_STYLE}</style></head><body>${body.innerHTML}</body></html>`
  );
}

const NEVER_KEEP = 'script, iframe, frame, object, embed, link, base, meta, form';

/**
 * Removes what the sandbox and CSP already neutralise, so a future change to either can't be the
 * only thing between a document and the recruiter: elements that load or run things, event-handler
 * attributes, and the targets of links (a link would navigate the frame to a site of the
 * applicant's choosing).
 */
function strip(root: Element) {
  for (const element of root.querySelectorAll(NEVER_KEEP)) {
    element.remove();
  }
  for (const element of root.querySelectorAll('*')) {
    for (const { name } of Array.from(element.attributes)) {
      const lower = name.toLowerCase();
      const isLink = element.localName === 'a' && (lower === 'href' || lower === 'xlink:href');
      if (lower.startsWith('on') || isLink) {
        element.removeAttribute(name);
      }
    }
  }
}
