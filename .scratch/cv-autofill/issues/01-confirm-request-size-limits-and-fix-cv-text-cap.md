# 01: Confirm request-size limits and fix the CV text cap

**What to build:** Settle how much CV text the submit can carry, so every later ticket uses a verified number. The apply form submits through a Server Action to the API, and neither app sets a body limit, so framework defaults apply (believed to be about 100 kB for the API's JSON body and 1 MB for Server Actions; not verified). Read the installed Next.js docs and the installed NestJS/Express types for the actual defaults, then prove it by sending an oversize submit-shaped body through both hops in development. Decide the CV text cap (placeholder: 50,000 characters, counted after the other submit fields and UTF-8 expansion), or raise the limit for the public submit route only if that is safer. Spec: `.scratch/cv-autofill/spec.md` ("Further Notes", "Request size"); ADR-0006.

Record the verified limits, the evidence and the chosen cap in this ticket under `## Answer`, with the doc paths or URLs you read.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The real default body limit of the API and of Server Actions is stated, with the doc or type reference it came from
- [ ] A body near the cap was sent through the real web-to-API path and accepted; one above it was refused with a clear error
- [ ] The chosen cap is written as a single number, with the reasoning, and any limit change is scoped to the submit route
- [ ] Multi-byte text (for example Arabic names in an English CV) was tried, since the limit is in bytes and the cap in characters
