# File uploads: CVs and Attachments

Status: ready-for-agent

Related: ADR-0002 (CV is a built-in slot on the form version), `GLOSSARY.md` (CV, Attachment), `docs/db-schema.md` §8.1 (`files` table).

## Problem Statement

Recruiters cannot ask applicants for a CV or for any file. The storage plumbing exists (presigned URLs, a local bucket), but the form refuses file questions at every layer, the apply page shows "File uploads aren't available yet", and recruiters have no way to open a file. Applicants who would naturally attach a CV, a portfolio image, or a short video or audio introduction can't, so recruiters chase them by email and the pipeline is missing the one document most hiring decisions rest on. Recruiters also want CVs to be parseable later, so the application form can autofill from them, and that needs the CV to be a known, predictable thing rather than one question among many.

## Solution

A job's form gains a dedicated **CV** setting (off, optional, required). When it is on, the CV is the very first step of the public apply form, so a future parser can autofill name, email and phone. Recruiters can also add **Attachment** questions to the form, accepting documents (PDF, DOCX), images, video and audio, with a size limit and, for video and audio, a maximum duration.

Applicants pick a file and it uploads immediately, straight to object storage, with progress, retry, remove and replace. On submit, the Application is created with its CV and Attachments attached. Recruiters see the CV and Attachments on the candidate sheet: images, video and audio play inline, PDFs and DOCX open in an inline viewer, and every file can be downloaded.

## User Stories

### Recruiter: configuring the form

1. As a recruiter, I want to choose whether a job's form asks for a CV (off, optional or required), so that I collect CVs only when they matter for the role.
2. As a recruiter, I want new job forms to ask for an optional CV by default, so that I get CVs without having to remember to turn the setting on.
3. As a recruiter, I want existing published forms to keep not asking for a CV until I change them, so that a deploy never changes what applicants are asked.
4. As a recruiter, I want the CV setting shown as its own card above the questions in the form builder, so that I don't confuse it with an ordinary question.
5. As a recruiter, I want the CV card to say that CVs must be PDF or DOCX and up to 5 MB, so that I know what applicants can send without a setting to configure.
6. As a recruiter, I want changing the CV setting after publishing to create a new form version, so that earlier Applications still show the form their applicant actually saw.
7. As a recruiter, I want to add a file question (Attachment) to a form, so that I can collect work samples, certificates, or introductions.
8. As a recruiter, I want to choose which kinds of file an Attachment question accepts (document, image, video, audio), so that applicants can't send something I can't review.
9. As a recruiter, I want "document" to mean PDF and DOCX, so that I get formats every reviewer can open.
10. As a recruiter, I want to set a maximum file size for an Attachment question, from 1 to 200 MB, so that I control storage cost and applicant effort.
11. As a recruiter, I want the builder to suggest a sensible size for the kinds I pick (10 MB for documents and images, 25 MB for audio, 100 MB for video), so that I don't have to guess.
12. As a recruiter, I want to set a maximum duration for video and audio Attachments, so that I don't have to watch a ten-minute video when I asked for one minute.
13. As a recruiter, I want the duration limit required only when video or audio is allowed, so that it doesn't clutter questions that don't need it.
14. As a recruiter, I want a clear error if I allow video or audio without a duration limit, so that I can fix the question before saving.
15. As a recruiter, I want to mark an Attachment question as required or optional, so that I decide what applicants must provide.
16. As a recruiter, I want to add help text to an Attachment question, so that I can tell applicants what I'd like to see.
17. As a recruiter, I want to be able to publish a form that contains Attachment questions, so that the feature is usable, not just visible.
18. As a recruiter, I want to reorder, edit and delete Attachment questions like any other question, so that the builder feels consistent.
19. As an interviewer, I want to see the CV setting and Attachment questions in the form builder read-only, so that I understand what applicants were asked without being able to change it.

### Applicant: the public apply form

20. As an applicant, I want the CV to be the first thing I'm asked for, so that I can start with a document I already have.
21. As an applicant, I want to skip the CV step when it is optional, so that I can still apply without one.
22. As an applicant, I want to be told the CV is required, with a clear message, when it is and I haven't added one, so that I know why I can't continue.
23. As an applicant, I want the apply form to start at name, email and phone when the job doesn't ask for a CV, so that nothing changes for those jobs.
24. As an applicant, I want to be told which file types and what size are accepted before I pick a file, so that I don't waste time on a file that will be rejected.
25. As an applicant, I want my file to start uploading as soon as I choose it, so that submitting at the end is fast.
26. As an applicant, I want to see upload progress, so that I know a large file is working.
27. As an applicant, I want to remove a file I picked, so that I can change my mind.
28. As an applicant, I want to replace a file with another, so that I can fix a mistake without reloading the page.
29. As an applicant, I want a clear error and a retry button when an upload fails, so that a flaky connection doesn't lose my application.
30. As an applicant, I want a file of the wrong type or too large to be rejected immediately, before any upload starts, with a message saying why, so that I can pick another.
31. As an applicant, I want an image to be shrunk in my browser before it uploads, so that large phone photos don't take minutes to send.
32. As an applicant, I want an over-long video or audio file to be rejected before it uploads, with the allowed length in the message, so that I can trim it.
33. As an applicant, I want to be unable to move on or submit while an upload is still running, so that I never submit a half-uploaded file.
34. As an applicant, I want my application to go through even if I leave an optional file question empty, so that optional means optional.
35. As an applicant, I want a clear message on a required Attachment question I left empty, so that I know what to fix.
36. As an applicant, I want my uploaded files to still be there if my submit fails (for example, "you've already applied" or a validation error), so that I don't have to upload them again.
37. As an applicant, I want to be told if my file was found to be a different kind than it claims (for example a renamed program), so that I understand why it was refused.
38. As an applicant, I want the upload control to work with the keyboard and a screen reader, so that I can apply without a mouse.
39. As an applicant on a phone, I want to choose a file from my camera, gallery or files, so that I can apply from my phone.
40. As an applicant, I don't want my files stored in my browser after I leave, so that my documents aren't left on a shared device.

### Recruiter: reviewing candidates

41. As a recruiter, I want to see an Application's CV on the candidate sheet, so that I can review it without leaving the pipeline.
42. As a recruiter, I want to read a PDF CV inline, so that I don't have to download and open it.
43. As a recruiter, I want to read a DOCX CV inline, so that I don't have to download and open it.
44. As a recruiter, I want a download button next to every file, so that I can keep a copy or open it in another app when the inline viewer falls short.
45. As a recruiter, I want to see Attachments listed under the question that asked for them, so that I know which answer each file belongs to.
46. As a recruiter, I want images shown inline, so that I can judge a portfolio sample at a glance.
47. As a recruiter, I want video and audio to play inline, so that I can watch or listen without downloading.
48. As a recruiter, I want to see the length of a video or audio file, so that I know what I'm about to watch.
49. As a recruiter, I want to see each file's name, type and size, so that I recognise it.
50. As an interviewer, I want to view and download files exactly as recruiters can, so that I can prepare for interviews.
51. As a recruiter, I want files to download with the applicant's original file name, so that they are easy to find on my computer.
52. As a recruiter, I want an Application with an auto-rejected outcome to still show its files, so that I can see what the applicant sent.
53. As a recruiter, I want an Application's file links to stop working after a few minutes, so that a link copied from my screen can't be shared for long.
54. As a recruiter, I want to be unable to open files belonging to another company, so that tenants stay isolated.

### Security, abuse and operations

55. As a company, I want applicant files never to execute or render as a web page on our domain, so that a hostile file can't attack our recruiters.
56. As a company, I want every uploaded file's real type checked, not just its extension or the browser's claim, so that a renamed program is rejected.
57. As a company, I want the server to refuse a file whose size doesn't match what was declared, so that the size limit means something.
58. As a company, I want upload creation to be throttled per visitor, so that bots can't flood storage.
59. As a company, I want uploads for a job to be impossible when the job isn't open, so that closed jobs don't collect files.
60. As a company, I want a file attached to an Application only if it was uploaded for that same job and question, so that one applicant can't reference another's files.
61. As a company, I want a file to attach to at most one Application, so that files can't be shared across Applications.
62. As a company, I want a file that fails verification deleted from storage, so that bad files don't linger.
63. As a developer, I want the CV in a known place on the form version and the files table, so that a future parser can find every CV without scanning answers.
64. As a developer, I want the bucket provider to be a configuration choice, so that moving to a provider with cheaper egress needs no code change.
65. As a developer, I want the local dev bucket to accept browser uploads out of the box, so that the feature works after `docker compose up`.
66. As a developer, I want the known gaps (orphaned uploads, lifecycle rules, retention) written down, so that they are tracked as debt rather than forgotten.

## Implementation Decisions

### Domain model

- **CV** and **Attachment** are distinct. The CV is a built-in slot on the form version; an Attachment is the answer to a file question. An Application has at most one CV, which never appears in `answers`. See ADR-0002 and the glossary.
- The form version gains a CV setting with three values: off, optional, required. Existing versions default to off; new drafts for a new job start at optional. It is stored as text with a CHECK constraint, like other contract enums. Published versions stay immutable, so changing it creates a new version.
- The file question's config becomes: allowed kinds (any of document, image, video, audio; at least one), maximum size in MB (1 to 200), and maximum duration in seconds (required when video or audio is allowed, null otherwise). The previous kinds enum (pdf, image, document) is replaced. This is safe because the schema never let a file question be stored.
- Kind to format mapping: document is PDF and DOCX; image is JPEG, PNG and WebP (never SVG); video is MP4, MOV and WebM; audio is MP3, M4A, WAV, OGG and WebM audio. The CV accepts PDF and DOCX only, up to 5 MB, fixed.
- A file question holds one file. An answer to a file question is the file's id, as the existing answer checker already expects.

### Persistence

- A `files` table as planned in `docs/db-schema.md` §8.1: company, job, nullable application, purpose (cv or answer), field key (answers only), storage key, original name, sniffed MIME type, size in bytes, status (pending or uploaded), uploaded-at, created-at, plus a nullable declared duration in seconds. A CHECK ties purpose to field key; a partial unique index allows one CV per application; an index on (status, created-at) supports a future cleanup job.
- Rows are created before the Application exists. At submit they are attached and become uploaded in the same transaction that creates the Application.
- The object key is built from the company, the job and the file id only. The applicant's file name lives only in the row, which removes filename sanitising from the key and the old "one file per field" collision caveat.
- Nothing parsing-specific is stored. A later parse table will reference the CV's file row.
- Update `docs/db-schema.md` to match the contract (this is required by the repo's rules whenever the contract changes), and re-emit the contract artifacts.

### Upload flow (API)

- A new public endpoint creates an upload for an open job: it takes the purpose (CV or a file question's key), the original name, the declared size and type, and for video and audio the declared duration. It validates all of these against the form's current published version (allowed format for the question or the CV rules, size limit, duration limit), creates a pending row, and returns the file id and a presigned PUT URL.
- The presigned URL signs the declared content type and content length, so the bucket itself rejects a different size or type. Verify against the installed SDK that the content length is actually enforced; if it is not, fall back to relying on the submit-time verification and record that.
- The endpoint is throttled per visitor with its own limit (about 20 per 10 minutes) using the existing trusted-client throttler. There is no cap on pending files per job.
- URLs are created lazily, one per chosen file. They are never part of the cached public form: that payload is shared by all visitors and a presigned URL is bound to one object.
- The public job payload exposes the CV setting and the file question limits so the browser can reject bad files before asking for a URL.
- Submit accepts an optional CV file id in addition to the answers. File answers are still in `answers`.
- Before the transaction, the service verifies each referenced file: it exists in the bucket with the declared size, and its leading bytes match the real format, detected with the `file-type` library, which also supplies the stored MIME type. If a file fails, it is deleted from the bucket, its row removed, and the submit fails with a field error on the matching question or CV.
- Inside the transaction each file is attached with a conditional update that requires the file to belong to this job, to match the purpose and field key, to be unattached and pending. If any attach affects no row, the service throws a conflict. A duplicate Application or a validation error leaves files pending and reusable.
- CV required or optional is enforced at submit by comparing the form version's CV setting with whether a CV id was given.
- Auto-reject rules and the Application Event history are unchanged; files do not add events.

### Recruiter access (API)

- An authenticated endpoint under the company routes lists an Application's files and returns a short-lived presigned GET (the existing 300 seconds) for one file. It uses the existing application read policy, so interviewers have access, and tenant isolation follows the existing membership guard (404 for non-members).
- Two flavours: download (attachment disposition, original file name) and view (inline disposition, sniffed content type), the latter only for kinds the UI renders inline: images, video, audio, PDF and DOCX bytes for the viewer.
- Downloads and views do not write history events.

### Shared package

- Update the form field schemas, the public field projection, the answer checker and the applicant-facing validation to cover the new file config, the CV setting, the duration rule and the removal of the "not supported yet" guards. The submit-body schema gains the optional CV id. These are used by the API and the web app.

### Web: form builder

- The file question type is un-hidden, with a config editor (kinds, size, duration when relevant, with suggested defaults).
- A CV card above the questions with a three-way toggle group.
- Read-only behaviour for interviewers follows the existing pattern.

### Web: public apply page

- The CV step is first when its setting is not off; contact step otherwise first. Attachment questions render a custom upload control inside a questionnaire step (the questionnaire's input type has no file support).
- The control uploads on selection with progress, remove, replace and retry, blocks advancing while uploading, and holds only file ids in memory (not saved locally).
- Images are downscaled and recompressed in the browser before the upload starts, keeping the original if it would get bigger. Video and audio duration is read from the file in the browser and sent as the declared duration.
- The browser never calls the API directly: the create-upload call goes through a Server Action. The file bytes go straight to the bucket with a PUT.

### Web: candidate sheet

- Lists the CV and each Attachment under its question, with name, type, size and, for media, duration.
- Images, video and audio display inline. PDFs use the browser's native viewer; DOCX renders client-side with `docx-preview` inside a sandboxed `iframe`. A download button is always shown as the fallback. No third-party viewer is used, because Office-style online viewers need a public URL and cache content.
- The answer formatter replaces its "File (uploads are not available yet)" text with a real representation.

### Infrastructure

- The bucket needs CORS for browser PUT and GET. Add it to the local dev bucket setup and document the production equivalent. Verify RustFS supports bucket CORS.
- The storage provider remains a deploy-time choice (S3 versus an S3-compatible one with free egress, such as R2). Note the egress trade-off in the schema doc.

## Testing Decisions

- A good test checks external behaviour through a public interface: given these inputs, what does the caller get back or what state results. It should not assert how the code is arranged inside.
- **Seam 1, existing: `@repo/shared` pure functions.** Cover the form field schema (file config valid and invalid cases, duration rule, kinds), the CV setting, the answer checker for file answers, and the public field projection. Prior art: the existing form-field and answer test files in the shared package, run with Vitest as `*.test.ts`.
- **Seam 2, new: API service level.** Test the upload-creation and submit/attach behaviour through the services against in-memory fakes of the repository and the storage service. Cases include: limits and formats enforced at upload creation; closed jobs refused; submit attaches CV and Attachments atomically; required CV missing; file from another job or field rejected; file already attached rejected; mismatched size or sniffed type fails and deletes the object; a duplicate Application leaves files pending and a retry succeeds; recruiter download requires membership and returns the right disposition. There is no working API test today (the existing scaffolding specs reference a deleted controller), so this seam sets the pattern for later specs. Use Vitest `*.spec.ts`.
- Web behaviour is verified manually in the browser against the local bucket (upload, progress, retry, inline viewers, builder, read-only mode). No component tests.
- Run the existing shared tests, lint and type checks for every affected package before finishing each layer.

## Out of Scope

- Parsing CVs, autofilling the form from them, and any parse-result storage.
- Virus or malware scanning.
- Recording video or audio in the browser (upload only).
- Re-measuring video or audio duration on the server; the size cap is the hard limit.
- Server-side video transcoding or compression of anything except browser-side image recompression.
- Cleanup of orphaned pending uploads, bucket lifecycle rules, and retention or deletion policies for rejected or old Applications (documented as known debt).
- Multiple files per file question.
- Letting candidates log in to see or replace their files.
- Scoring, annotating or commenting on a file.
- A history event when a recruiter opens a file.

## Further Notes

- Items to verify against installed docs or source while building (the repo's rules say not to rely on memory): that the signed content length is enforced by the bucket; the `file-type` API, how many leading bytes it needs and whether it detects DOCX from a partial read; how `docx-preview` treats hostile content (render it in a sandboxed `iframe` regardless); whether `browser-image-compression` can output WebP; whether RustFS supports bucket CORS.
- Suggested work order, one commit per layer in Conventional Commit style: shared, then database, then API, then web (builder, apply page, candidate sheet).
- `apps/api/src/main.ts` has a stray second CORS origin hard-coded to a LAN address; unrelated to this spec, worth removing separately.
- Existing published forms contain no file questions, so no data migration is needed beyond the new column's default.
