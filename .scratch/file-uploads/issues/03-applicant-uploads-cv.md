# 03: Applicant uploads a CV and applies (happy path)

**What to build:** On a job whose form asks for a **CV**, the CV is the first step of the public apply form (before name, email and phone). The applicant picks a PDF or DOCX up to 5 MB, it uploads immediately straight to the bucket with progress, remove, replace and retry, and the applicant cannot advance or submit while it is uploading. Submitting creates the Application with the CV attached. Optional CVs can be skipped; required ones block the step with a clear message. Jobs with CV off start at the contact step as before.

Behind it: a public create-upload endpoint (reached through a Server Action, never directly from the browser) validates the request against the open job's published form, creates a pending `files` row, and returns a presigned PUT whose signed size and type match the declared file. It is throttled per visitor. Objects are keyed by company, job and file id. The submit body takes an optional CV file id, which is attached inside the Application transaction with a conditional update. The dev bucket gets CORS rules for browser uploads. See the spec's Implementation Decisions (Upload flow) and ADR-0002.

**Blocked by:** 01, 02

**Status:** resolved

- [x] Creating an upload is refused for closed jobs, unknown jobs, a CV when the mode is off, and files that exceed 5 MB or are not PDF/DOCX by declared type.
- [x] The create-upload endpoint is throttled per visitor with its own limit.
- [x] The presigned PUT signs the declared content type and length; whether the bucket enforces the length is checked against the installed SDK and recorded.
- [x] The existing object-key builder is replaced by one based on company, job and file id; no applicant file name appears in a key.
- [x] Submit with a CV id attaches the file (status uploaded, uploaded-at set) in the same transaction as the Application; a file from another job or already attached makes the submit fail with a conflict.
- [x] A required CV that is missing fails the submit with a field error; an optional one does not.
- [x] The apply form shows the CV step first only when the mode is not off; the upload control supports keyboard use and shows accepted types and size before picking.
- [x] Wrong type or size is rejected in the browser before any request.
- [x] Dev bucket CORS lets the browser PUT from the web app origin after `docker compose up`.
- [x] API service tests (in-memory fakes) cover the create-upload limits and the attach rules; shared tests cover the submit schema change.
- [x] Manually verified in the browser: apply with a CV, see an uploaded file row.

## Comments

Resolved on integration branch `feat/file-uploads`: merge a0478c7 (feat 76b6258).

Bucket enforcement finding: RustFS enforces the signed content length and content type (a PUT with a different length or type gets 403 SignatureDoesNotMatch, no object). The presigner needs `signableHeaders` for `content-type` and `requestChecksumCalculation: 'WHEN_REQUIRED'`. AWS S3 and R2 were not tested; ticket 04's submit-time check is the backstop. Recorded in `docs/db-schema.md` §9.

Browser-verified on a scratch stack (own API, web and RustFS), not on the live stack. **Pending on the live stack:** run `docker compose up createbuckets` (applies `docker/rustfs-cors.json`), then apply with a CV at https://localhost:3000.

Live-stack verification (2026-10-16): `docker compose up createbuckets` applied the CORS rules (OPTIONS from https://localhost:3000 returns allow-origin and PUT, GET, HEAD). CV step is first with the hint shown before picking; a JPEG as CV is refused in the browser with no request sent; a real PDF uploads straight to http://localhost:9000 from the HTTPS page (Chrome did not block it), key has no file name; submit attaches it (row uploaded, attached, uploaded_at set).
