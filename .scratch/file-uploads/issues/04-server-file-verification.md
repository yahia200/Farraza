# 04: Server verifies files at submit and cleans up

**What to build:** The server no longer trusts what the browser said about a file. At submit, before the Application transaction, each referenced file is checked: it exists in the bucket with the declared size, and its leading bytes match a real PDF or DOCX, detected with the `file-type` library (which also provides the stored MIME type). A file that fails is deleted from the bucket, its row removed, and the applicant sees a field error on the CV step. A duplicate-application or validation failure leaves already-uploaded files pending so a retry with the same file ids succeeds. See the spec's Implementation Decisions (Upload flow).

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] `file-type`'s installed API and the number of leading bytes it needs are read from its installed docs or source before use; DOCX detection from a partial read is verified.
- [ ] A renamed executable or a truncated object submitted as a CV is refused with a field error, and the bucket object and row are gone.
- [ ] An object whose size differs from the declared size is refused the same way.
- [ ] After a 409 "already applied" or a validation error, the files are still pending and a retry succeeds.
- [ ] The stored MIME type is the sniffed one, not the declared one.
- [ ] API service tests cover each of the cases above with in-memory fakes of storage and repository.
- [ ] `docs/db-schema.md` notes the known debt: orphaned pending uploads, bucket lifecycle rules, and retention for rejected or old Applications.
