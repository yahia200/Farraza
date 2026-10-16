# 09: Video and audio Attachments

**What to build:** Recruiters can allow video and audio on an Attachment question, with a required maximum duration whenever either is allowed and suggested sizes by kind (audio 25 MB, video 100 MB, within the 1–200 MB limit). Applicants upload existing files (no in-browser recording): the browser reads the duration from the file's metadata and rejects an over-long file before uploading, sends the declared duration when creating the upload, and the server checks it against the limit and stores it. The server does not re-measure duration; the size cap is the hard limit. Accepted formats: video MP4, MOV and WebM; audio MP3, M4A, WAV, OGG and WebM audio. Recruiters play video and audio inline on the candidate sheet and see the duration. Finish by adding the storage-provider note (S3 versus an S3-compatible provider with free egress) to the schema doc. See the spec's Implementation Decisions and Out of Scope.

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] The shared config requires a duration limit when video or audio is allowed and null otherwise; the builder shows a clear error and hides the field when not relevant; tests cover both.
- [ ] `file-type` detects all listed video and audio formats in the verification step (ticket 04 path), including WebM audio.
- [ ] Create-upload rejects a declared duration above the question's limit and stores the declared duration.
- [ ] The apply control reads duration in the browser and rejects over-long files with the allowed length in the message.
- [ ] The sheet plays video and audio inline with the duration shown, and download remains available.
- [ ] API service tests cover duration limits and format acceptance; shared tests cover the config rule.
- [ ] The schema doc notes that the storage provider is a deploy-time choice and the egress trade-off.
- [ ] Manually verified with a short video and a short audio file.
