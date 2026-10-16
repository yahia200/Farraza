# 04: Server verifies files at submit and cleans up

**What to build:** The server no longer trusts what the browser said about a file. At submit, before the Application transaction, each referenced file is checked: it exists in the bucket with the declared size, and its leading bytes match a real PDF or DOCX, detected with the `file-type` library (which also provides the stored MIME type). A file that fails is deleted from the bucket, its row removed, and the applicant sees a field error on the CV step. A duplicate-application or validation failure leaves already-uploaded files pending so a retry with the same file ids succeeds. See the spec's Implementation Decisions (Upload flow).

**Blocked by:** 03

**Status:** resolved

- [x] `file-type`'s installed API and the number of leading bytes it needs are read from its installed docs or source before use; DOCX detection from a partial read is verified.
- [x] A renamed executable or a truncated object submitted as a CV is refused with a field error, and the bucket object and row are gone.
- [x] An object whose size differs from the declared size is refused the same way.
- [x] After a 409 "already applied" or a validation error, the files are still pending and a retry succeeds.
- [x] The stored MIME type is the sniffed one, not the declared one.
- [x] API service tests cover each of the cases above with in-memory fakes of storage and repository.
- [x] `docs/db-schema.md` notes the known debt: orphaned pending uploads, bucket lifecycle rules, and retention for rejected or old Applications.

## Comments

Resolved on integration branch `feat/file-uploads`: merge 4ce8584 (feat edeea81).

`file-type` 22.2.0: `fileTypeFromBuffer(Uint8Array)`; the verifier reads 64 KiB (`SNIFF_BYTES`). PDF needs 4 bytes; DOCX is only recognised as DOCX when `[Content_Types].xml` lies wholly inside the buffer (otherwise `application/zip`), which a 64 KiB read covers for real documents. Not run against Postgres: the new repository queries (`findFilesToVerify`, `deletePendingFile`) were exercised through fakes only. If an object vanishes between HEAD and GET the request returns 500 (left unmapped as rare).
