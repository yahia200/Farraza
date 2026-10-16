# 06: Inline PDF and DOCX viewer

**What to build:** Recruiters can read a CV (and later document Attachments) directly in the candidate sheet. A view endpoint returns a short-lived presigned GET with inline disposition and the sniffed content type. PDFs open in the browser's native viewer; DOCX renders client-side with `docx-preview` inside a sandboxed `iframe`, with no third-party service. A download button is always shown as the fallback. The bucket CORS rules also allow browser GETs. See the spec's Implementation Decisions (Web: candidate sheet).

**Blocked by:** 05

**Status:** resolved

- [x] `docx-preview`'s source is read to see how it treats untrusted content, and the render is sandboxed regardless; the finding is noted in the ticket's comments.
- [ ] A PDF CV displays inline on desktop; where inline PDF is unsupported, the download button is the visible fallback.
- [x] A DOCX CV renders inline; a DOCX that fails to render falls back to download with a short message.
- [x] The view URL is never used for formats the sheet doesn't render inline.
- [ ] Bucket CORS (dev and documented production equivalent) allows browser GET from the web app origin.
- [ ] Manually verified with a sample PDF and DOCX.

## Comments

Resolved on integration branch `feat/file-uploads`: merge 8bb7992 (feat b1d0ce4).

docx-preview 0.4.1 source finding: it builds DOM with createElement/setAttribute/text nodes (one innerHTML for "&nbsp;"), no eval or script creation, no sanitising, no network loads. It passes through unchecked: hyperlink targets (`javascript:` survives), `altChunk` parts rendered as `<iframe srcdoc>` (default on), inline CSS and `url()`, embedded fonts, and zip/XML parsing in the recruiter's tab. Mitigations: `renderAltChunks: false`, `ignoreFonts: true`, render into detached DOM, strip `a[href]`, `on*`, script/iframe/object/embed/link/base/meta/form, escape `</style>`, and show the serialised result in `<iframe sandbox="">` under a meta CSP. Verified with a hostile DOCX. Residual risk: a small, highly compressible zip can stall the tab (10 MB cap on the file itself, no uncompressed-size pre-check).

Verified on a scratch stack; **pending on the live stack:** PDF and DOCX preview, and the CORS rules applied to the dev bucket.
