# 03: Applicant uploads a CV and applies (happy path)

**What to build:** On a job whose form asks for a **CV**, the CV is the first step of the public apply form (before name, email and phone). The applicant picks a PDF or DOCX up to 5 MB, it uploads immediately straight to the bucket with progress, remove, replace and retry, and the applicant cannot advance or submit while it is uploading. Submitting creates the Application with the CV attached. Optional CVs can be skipped; required ones block the step with a clear message. Jobs with CV off start at the contact step as before.

Behind it: a public create-upload endpoint (reached through a Server Action, never directly from the browser) validates the request against the open job's published form, creates a pending `files` row, and returns a presigned PUT whose signed size and type match the declared file. It is throttled per visitor. Objects are keyed by company, job and file id. The submit body takes an optional CV file id, which is attached inside the Application transaction with a conditional update. The dev bucket gets CORS rules for browser uploads. See the spec's Implementation Decisions (Upload flow) and ADR-0002.

**Blocked by:** 01, 02

**Status:** ready-for-agent

- [ ] Creating an upload is refused for closed jobs, unknown jobs, a CV when the mode is off, and files that exceed 5 MB or are not PDF/DOCX by declared type.
- [ ] The create-upload endpoint is throttled per visitor with its own limit.
- [ ] The presigned PUT signs the declared content type and length; whether the bucket enforces the length is checked against the installed SDK and recorded.
- [ ] The existing object-key builder is replaced by one based on company, job and file id; no applicant file name appears in a key.
- [ ] Submit with a CV id attaches the file (status uploaded, uploaded-at set) in the same transaction as the Application; a file from another job or already attached makes the submit fail with a conflict.
- [ ] A required CV that is missing fails the submit with a field error; an optional one does not.
- [ ] The apply form shows the CV step first only when the mode is not off; the upload control supports keyboard use and shows accepted types and size before picking.
- [ ] Wrong type or size is rejected in the browser before any request.
- [ ] Dev bucket CORS lets the browser PUT from the web app origin after `docker compose up`.
- [ ] API service tests (in-memory fakes) cover the create-upload limits and the attach rules; shared tests cover the submit schema change.
- [ ] Manually verified in the browser: apply with a CV, see an uploaded file row.
