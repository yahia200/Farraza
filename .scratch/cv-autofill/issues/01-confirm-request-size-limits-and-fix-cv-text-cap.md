# 01: Confirm request-size limits and fix the CV text cap

**What to build:** Settle how much CV text the submit can carry, so every later ticket uses a verified number. The apply form submits through a Server Action to the API, and neither app sets a body limit, so framework defaults apply (believed to be about 100 kB for the API's JSON body and 1 MB for Server Actions; not verified). Read the installed Next.js docs and the installed NestJS/Express types for the actual defaults, then prove it by sending an oversize submit-shaped body through both hops in development. Decide the CV text cap (placeholder: 50,000 characters, counted after the other submit fields and UTF-8 expansion), or raise the limit for the public submit route only if that is safer. Spec: `.scratch/cv-autofill/spec.md` ("Further Notes", "Request size"); ADR-0006.

Record the verified limits, the evidence and the chosen cap in this ticket under `## Answer`, with the doc paths or URLs you read.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [ ] The real default body limit of the API and of Server Actions is stated, with the doc or type reference it came from
- [ ] A body near the cap was sent through the real web-to-API path and accepted; one above it was refused with a clear error
- [ ] The chosen cap is written as a single number, with the reasoning, and any limit change is scoped to the submit route
- [ ] Multi-byte text (for example Arabic names in an English CV) was tried, since the limit is in bytes and the cap in characters

## Answer

**Chosen CV text cap: 50,000 characters** (JavaScript string `.length`, i.e. UTF-16 code units, the same unit `long_text` already uses in `packages/shared/src/answers.ts`). The API's JSON limit for the public submit route only is raised to **1 MB**.

### Verified default limits

- **API JSON body: 100 kB (102,400 bytes) for the whole request.** `apps/api/node_modules/@nestjs/platform-express/adapters/express-adapter.js` (`registerParserMiddleware`) calls `express.json()` with no `limit`; body-parser's default is in `node_modules/.pnpm/body-parser@2.4.0*/node_modules/body-parser/lib/utils.js` line 47 (`102400 // 100kb default`) and its `README.md` (`limit`, default `'100kb'`). Over it, Express answers 413.
- **Server Action request body: 1 MB (1,048,576 bytes).** `apps/web/node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverActions.md` ("bodySizeLimit") and `01-app/02-guides/server-actions.md` line 83. (`proxyClientMaxBodySize`, 10 MB, only applies with a proxy file; the app has none.)

### Evidence (dev, own worktree, throwaway DB `hiring_cv01`, API on :3101, web on :3100)

Submit-shaped bodies: a real open job whose published form has 30 `long_text` questions (10,000 chars each), so every body is a fully valid submit. The web path was driven by POSTing the real `submitApplication` Server Action (`Next-Action` header, `text/plain` body, the encoding `encodeReply` uses for plain arguments) so it went web action -> `apiFetch` -> API. Direct API calls used the same JSON.

- Direct API: 102,357-byte body accepted (201); 102,557 bytes refused with `413 request entity too large`. Boundary = 102,400, as read from the source.
- Through the Server Action, before the change: 100,000 ASCII chars (action body 100,539 B) saved the application; 101,900 chars (API body ~102,4xx B) came back as the generic "Something went wrong" (the API's 413).
- Server Action limit: a 1,048,159-byte action body reached the API; 1,049,159 bytes failed in Next with `Body exceeded 1 MB limit.` (HTTP 500 in the action response, logged by `next dev`).
- Multi-byte (limit is bytes, cap is characters): 50,000 Arabic chars (2 B each) = 100,329-byte action body, accepted; 25,000 emoji = 100,305-byte API body, accepted (so 50,000 emoji = ~200 kB would be refused under 100 kB). `\n` costs 2 bytes in JSON (30,000 newlines = 60,245 B, accepted). CJK is 3 B per unit, so 50,000 CJK chars = ~150 kB, over the default.
- After the change (`apps/api/src/common/body-limits.spec.ts`, supertest on a Nest app built like `main.ts`): submit route takes 300 kB, refuses 1 MB + 10 B (413); another route keeps the 100 kB default (90 kB ok, 101 kB 413).

### Reasoning

The default cannot hold a 50,000-character CV: worst-case 3 bytes per unit is 150 kB, and the other submit fields share the same body (a form may hold up to 50 questions of up to 10,000 characters; today ~11 full long answers already exceed 100 kB, an existing latent bug this also fixes). So the limit is raised on the submit route only, to 1 MB, equal to the Server Action limit: the web hop is then always the first to refuse and the API limit is never the binding one. 50,000 characters leaves at least ~700 kB for everything else even at 6 bytes per unit. Other routes (including anonymous `uploads`) keep 100 kB. Ticket 02 should strip control characters from the extracted text (each costs 6 bytes as `\u00XX`) before the cap. The cap is applied before submit by cutting, never by rejecting (ADR-0006).

### Why `express` is a direct dependency of `apps/api`

`apps/api/src/common/body-limits.ts` imports `json` from `express` to mount a route-scoped parser (`app.useBodyParser` in `nest-express-application.interface.d.ts` is global only). `express` was only a transitive dependency of `@nestjs/platform-express`; importing a transitive package is fragile under pnpm. It is pinned to 5.3.0, the exact version `@nestjs/platform-express` requires, so the lockfile now has one Express (5.2.1 dropped) instead of two. Nest's own parsers are turned off (`bodyParser: false` in `main.ts`) and re-registered in `configureBodyParsers` with the same defaults except the submit route.
