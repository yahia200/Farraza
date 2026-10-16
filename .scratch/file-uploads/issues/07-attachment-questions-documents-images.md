# 07: Attachment questions for documents and images

**What to build:** Recruiters can add file questions (**Attachments**) to a form, accepting documents (PDF, DOCX) and images (JPEG, PNG, WebP; never SVG), with a size limit from 1 to 200 MB (suggested 10 MB). Such forms can be published. Applicants see an upload control on that question's step, with the same upload-on-selection behaviour as the CV. The answer is the file's id; on submit the file is verified and attached like the CV. The candidate sheet lists each Attachment under its question with name, type, size and download, and the answer formatter no longer says "uploads are not available yet".

This replaces the old file config (pdf, image, document) with kinds (document, image, video, audio), though only document and image are wired in this ticket; the duration limit arrives in ticket 09. The "not supported yet" guards in the shared schema, the form service and the builder are removed. See the spec's Implementation Decisions (Domain model, Shared package, Web).

**Blocked by:** 04, 05

**Status:** resolved

- [x] The file question config validates kinds (at least one) and size 1–200; tests cover valid and invalid configs, answers and the public field projection.
- [x] No published or stored form uses the old kinds enum (confirmed before replacing it).
- [x] The file type appears in the builder with a kinds and size editor and default suggestions; required/optional and help text work like other questions.
- [x] A form with file questions can be saved and published; the public payload exposes their limits.
- [x] Create-upload validates the declared type and size against the question; the applicant's browser rejects bad files first.
- [x] Answers store the file id; submit verification (ticket 04) and the conditional attach apply to Attachments, including field-key matching and required checks.
- [x] A file from a different question or job cannot be used as the answer.
- [x] The sheet lists Attachments under their question with a download button.
- [x] API service tests cover Attachment limits, field-key matching and required handling; shared tests cover the schema and answer rules.
- [x] Manually verified: build a form with a document and an image question, apply, download both.

## Comments

Resolved on integration branch `feat/file-uploads`: merge 6e5a3ee (feat 9e46f69).

Confirmed read-only on the dev DB before replacing the old enum: 10 form versions, none with a file question, none with `allowedTypes`. Verified on a scratch stack (document + image question, apply, fake PNG refused at submit, three downloads). **Pending on the live stack:** the same flow, interviewer read-only builder, keyboard and screen-reader use of the file input.

Live-stack verification (2026-10-16): the builder offers File upload with kinds and size (suggested size follows the kinds); a file question with all four kinds saved, published and appears in the public payload with its limits; applicants uploaded an image, a WAV and a WebM as the answer and PDF/DOCX as the CV, and all attached with sniffed MIME types. A PE executable declared as a PDF passed the browser but was refused at submit ("That file isn't really a PDF or DOCX"), the applicant returned to the CV step, its row and bucket object were deleted (6 objects remained for 6 attached files), and a retry reused the still-pending WAV and succeeded. Not tried live: a duplicate-email 409.
