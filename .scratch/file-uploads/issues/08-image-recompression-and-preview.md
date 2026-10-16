# 08: Images: browser recompression and inline preview

**What to build:** Images an applicant picks are downscaled and recompressed in their browser before the upload starts, so large phone photos upload quickly and use less storage; the original is kept when compression would make it larger. The declared size and type sent when creating the upload are those of the compressed file. Recruiters see image Attachments previewed inline on the candidate sheet through the view URL. See the spec's Implementation Decisions (Web: public apply page, candidate sheet).

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] `browser-image-compression`'s installed options are read before use, including whether it can output WebP; if not, the chosen approach is noted in the ticket.
- [ ] A large JPEG or PNG is reduced before upload; a small or already-optimal image is sent unchanged.
- [ ] The compressed file still passes the question's type check and size limit.
- [ ] Images show inline on the sheet, with download still available.
- [ ] Manually verified with a large phone-sized photo.
