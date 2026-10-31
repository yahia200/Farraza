---
title: "Security headers use Nest's built-in useSecurityHeaders and a nonce-free CSP; scrypt logN stays 17"
author: Yahia
date: 2026-10-31
branch: main
cost: { minutes: 47, tokens: 243148 }
id: l-d2399833
scope: repo
status: active
src: agent
touches:
  - ".cto-toolkit/learning/patterns.jsonl"
  - docs/feature-backlog.md
  - apps/api/src/auth/auth.controller.ts
  - apps/api/.cto-toolkit/learning/patterns.jsonl
  - apps/web/.cto-toolkit/learning/patterns.jsonl
  - apps/api/src/companies/companies.controller.ts
  - apps/api/src/main.ts
  - apps/web/next.config.ts
  - CLAUDE.md
  - apps/api/package.json
---

## Decided
- API: `app.useSecurityHeaders()` in apps/api/src/main.ts (built into @nestjs/common 12.1, helmet 8 defaults and option names) instead of adding the `helmet` package. Types: node_modules/@nestjs/common/interfaces/http/security-headers-options.interface.d.ts.
- Web: `headers()` in apps/web/next.config.ts sets only `frame-ancestors 'none'; base-uri 'self'; object-src 'none'`, HSTS `max-age=63072000` (no preload, no includeSubDomains: the owner's other subdomains are unknown), nosniff, and `strict-origin-when-cross-origin`.
- Sign-in 10 and sign-up 5 attempts per 10 minutes per visitor (`@Throttle` in auth.controller.ts), following password-reset.controller.ts.

## Tried and ruled out
- A strict `script-src` with nonces: Next's CSP guide says nonces force dynamic rendering and are incompatible with Partial Prerendering, and this app has `cacheComponents` and `partialPrefetching` on. SRI (experimental) is the static-friendly alternative, not tried.
- Lowering scrypt `logN` to 15 (the security review's suggestion for M-5): the library's own comment calls logN 17 the OWASP minimum. Read OWASP's cheat sheet before weakening it.

## Watch out
- The per-visitor sign-in limit counts the visitor only if the web app forwards `x-client-ip` on the sign-in call (TrustedClientThrottlerGuard); not verified for sign-in.
- Testing sign-in against a temporary API copy returns 500 when Docker/Postgres is down; the 429 still shows because the guard runs before the handler.
- The cto-toolkit review reports were partial (each agent hit its turn limit) and not checked against the code except the cases above. Open items are in docs/feature-backlog.md (per-email limits, hashing cap).
