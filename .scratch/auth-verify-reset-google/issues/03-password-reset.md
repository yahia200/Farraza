# 03: Password reset

**What to build:** A person who forgot their password enters their email on a forgot-password page and is always told to check their email (whether or not an account exists). If the address has an account, a reset link is sent to the *stored* address; opening it lets them choose a new password, which signs them in and ends all their other sessions. Links are single-use, short-lived, and invalidated by any password change.

**Blocked by:** 02 (reuses the `PrismaEmailTokenStore` and the `MailModule` it stands up).

**Status:** ready-for-agent

- [ ] A `PasswordResetHandler` registered as `passwordReset` finds the account by email (returning the stored address and stored hash), sends the link to the stored address, and stores the new hash; `passwordReset.url` points at the web reset page.
- [ ] `POST /api/auth/password/forgot` (public) returns 202 before the lookup, so timing and response are identical whether or not the address exists, and is rate-limited to 5 per 10 minutes per visitor.
- [ ] `POST /api/auth/password/reset` (public) accepts the token and a new password (sign-up password rules), signs the user in on success, ends the account's other sessions, and marks the address verified; an invalid, used, or expired token — or a password the hasher refuses — returns 400 without consuming the link.
- [ ] A password reset on an account someone else registered with the user's address takes over that account (new password, address verified).
- [ ] The web app has a forgot-password page and a reset-password page (reads the token from its URL, redirects to the dashboard on success).
- [ ] `forgotPassword` and `resetPassword` shared Zod schemas in `@repo/shared` are used by both the API DTOs and the web actions.
- [ ] A reset email template renders through the existing mail setup.
- [ ] Build, lint, and type-check pass across the touched packages.
