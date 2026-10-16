# 09: Video and audio Attachments

**What to build:** Recruiters can allow video and audio on an Attachment question, with a required maximum duration whenever either is allowed and suggested sizes by kind (audio 25 MB, video 100 MB, within the 1–200 MB limit). Applicants upload existing files (no in-browser recording): the browser reads the duration from the file's metadata and rejects an over-long file before uploading, sends the declared duration when creating the upload, and the server checks it against the limit and stores it. The server does not re-measure duration; the size cap is the hard limit. Accepted formats: video MP4, MOV and WebM; audio MP3, M4A, WAV, OGG and WebM audio. Recruiters play video and audio inline on the candidate sheet and see the duration. Finish by adding the storage-provider note (S3 versus an S3-compatible provider with free egress) to the schema doc. See the spec's Implementation Decisions and Out of Scope.

**Blocked by:** 07

**Status:** resolved

- [x] The shared config requires a duration limit when video or audio is allowed and null otherwise; the builder shows a clear error and hides the field when not relevant; tests cover both.
- [x] `file-type` detects all listed video and audio formats in the verification step (ticket 04 path), including WebM audio.
- [x] Create-upload rejects a declared duration above the question's limit and stores the declared duration.
- [x] The apply control reads duration in the browser and rejects over-long files with the allowed length in the message.
- [x] The sheet plays video and audio inline with the duration shown, and download remains available.
- [x] API service tests cover duration limits and format acceptance; shared tests cover the config rule.
- [x] The schema doc notes that the storage provider is a deploy-time choice and the egress trade-off.
- [ ] Manually verified with a short video and a short audio file.

## Comments

Resolved on integration branch `feat/file-uploads`: merge a98e087 (feat 0821789).

`file-type` 22.2.0 results: MP4 `video/mp4`; MOV `video/quicktime`; WebM `video/webm` for both video and audio-only (there is no `audio/webm`); MP3 `audio/mpeg`; M4A `audio/x-m4a` (an audio-only MP4 with brand mp42/isom gives `video/mp4`); WAV `audio/wav`; OGG Vorbis `audio/ogg`, Opus `audio/ogg; codecs=opus`. All detected from the first bytes, so the 64 KiB read is enough. `matchAllowedType` maps aliases so a WebM is accepted for either kind.

Apply-side duration check browser-verified on a scratch stack. **Pending on the live stack:** inline video/audio playback on the candidate sheet and the real-bucket round trip. Owner decisions outstanding: declared duration rounds up, unreadable duration is rejected.
