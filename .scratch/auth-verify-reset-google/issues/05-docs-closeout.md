# 05: Docs closeout — ADR, glossary, env docs

**What to build:** The durable documentation the auth work leaves behind, so a future reader understands the non-obvious decisions and can configure the app.

**Blocked by:** 04 (the OIDC design it documents must be settled).

**Status:** resolved

- [x] An ADR records the OIDC backend-for-frontend integration: the API returns `{ url, cookies }` and the web Route Handlers relay cookies onto the web origin, instead of sending the browser straight to the API. It states the trade-off (preserving the "browser never calls the API" / session-cookie-on-web-origin invariant) and why the alternative was rejected.
- [x] Glossary entries for *identity* (a `(provider, subject)` link to a User), *account linking*, and *account pre-hijacking*, created in the project's glossary file (lazily, if none exists yet).
- [ ] `CLAUDE.md`'s environment paragraph lists the new variables (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SMTP_URL`, `MAIL_FROM`) and `apps/api/.env` has them; `docs/db-schema.md` reflects the new `email_tokens`, `oidc_states`, and `identities` tables.
- [x] No code behaviour changes in this ticket.

## Comments

**2026-10-19 (resolved):** ADR-0003, glossary, CLAUDE.md env paragraph and db-schema.md are done. Left unticked only because agents cannot edit `apps/api/.env` (blocked by a permission rule): the owner adds `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and optionally `SMTP_URL`/`MAIL_FROM` (`SMTP_URL` is required when `NODE_ENV=production`).
