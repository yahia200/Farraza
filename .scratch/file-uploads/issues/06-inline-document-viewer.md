# 06: Inline PDF and DOCX viewer

**What to build:** Recruiters can read a CV (and later document Attachments) directly in the candidate sheet. A view endpoint returns a short-lived presigned GET with inline disposition and the sniffed content type. PDFs open in the browser's native viewer; DOCX renders client-side with `docx-preview` inside a sandboxed `iframe`, with no third-party service. A download button is always shown as the fallback. The bucket CORS rules also allow browser GETs. See the spec's Implementation Decisions (Web: candidate sheet).

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] `docx-preview`'s source is read to see how it treats untrusted content, and the render is sandboxed regardless; the finding is noted in the ticket's comments.
- [ ] A PDF CV displays inline on desktop; where inline PDF is unsupported, the download button is the visible fallback.
- [ ] A DOCX CV renders inline; a DOCX that fails to render falls back to download with a short message.
- [ ] The view URL is never used for formats the sheet doesn't render inline.
- [ ] Bucket CORS (dev and documented production equivalent) allows browser GET from the web app origin.
- [ ] Manually verified with a sample PDF and DOCX.
