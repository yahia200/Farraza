# 08: Images: browser recompression and inline preview

**What to build:** Images an applicant picks are downscaled and recompressed in their browser before the upload starts, so large phone photos upload quickly and use less storage; the original is kept when compression would make it larger. The declared size and type sent when creating the upload are those of the compressed file. Recruiters see image Attachments previewed inline on the candidate sheet through the view URL. See the spec's Implementation Decisions (Web: public apply page, candidate sheet).

**Blocked by:** 07

**Status:** resolved

- [x] `browser-image-compression`'s installed options are read before use, including whether it can output WebP; if not, the chosen approach is noted in the ticket.
- [x] A large JPEG or PNG is reduced before upload; a small or already-optimal image is sent unchanged.
- [x] The compressed file still passes the question's type check and size limit.
- [x] Images show inline on the sheet, with download still available.
- [x] Manually verified with a large phone-sized photo.

## Comments

Resolved on integration branch `feat/file-uploads`: merge c047d95 (feat 4318a46).

WebP finding: `browser-image-compression` 2.0.2 can output WebP via `fileType: 'image/webp'`, only where the browser canvas encodes it, and it keeps the input file name, so conversion would leave a wrong extension. Chosen: keep the input type (JPEG stays JPEG, PNG stays PNG, WebP stays WebP). Checked in a browser against a mock API and bucket only, not the real API or RustFS. **Pending on the live stack:** a real phone photo end to end. Owner decisions outstanding: lossy PNG quantisation, main-thread compression (no CDN worker), image preview opens by default.

Live-stack verification (2026-10-16): a 6.1 MB JPEG was reduced to 488 KB before upload ("Reduced from 5.8 MB"), the row stores the compressed size (499,648 bytes), and the sheet opens the image inline by default with Hide and Download. Safari, a real phone photo and a slow-phone freeze check were not done.
