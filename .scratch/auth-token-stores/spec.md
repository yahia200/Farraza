Status: resolved

# Refresh token and MFA stores

Related: the glossary entries **Identity** and **Account linking** (`GLOSSARY.md`, "Accounts"; a **User** is the person's login, as defined under **Member**), ADR-0003 (OIDC through the web app: no conflict, it only uses the sessions, email-token and OIDC-state stores), `docs/nestjs/auth.md` ("Issue tokens to the mobile app", "Add two-factor authentication") and the three existing stores that this work mirrors (`PrismaSessionStore`, `PrismaEmailTokenStore`, `PrismaOidcStateStore`).

## Problem Statement

The API depends on `@nestjs/authentication`, which keeps its state behind six storage contracts. Farraza has real Postgres-backed stores for three of them (sessions, email tokens, OIDC states). The other two that the configured features read, **refresh tokens** and **MFA** (authenticators, recovery codes, failed attempts), have none, so the package falls back to its process-local in-memory defaults.

That is harmless in development. In production the package refuses to start: the cookie-session provider and password reset both read the refresh-token and MFA stores, and a production boot with a contract in use and no registered source fails (unless in-memory storage is explicitly allowed). The API cannot be deployed until both stores exist. Running in memory instead (`allowInMemoryStorage`) would lose every refresh-token family and every MFA lockout counter on each restart, and break entirely on more than one instance.

## Solution

Add two Postgres-backed stores that implement the package's contracts and register themselves like the existing stores:

- A **refresh-token store** that keeps hashed refresh tokens grouped in families, detects reuse with one conditional write, and keeps a family revoked even for tokens saved after the revocation.
- An **MFA store** that keeps each User's authenticator (with its staged replacement and last accepted time step), their recovery code hashes, and their recent failed attempts.

After this work the API boots in production with no in-memory fallback in use. No user-visible feature changes: the `accessToken` and `mfa` features stay unconfigured, there are no new endpoints and no web UI. The stores sit idle until those features are turned on in a later piece of work.

## User Stories

1. As the person deploying the API, I want it to start in production without `allowInMemoryStorage`, so that I am not running a silent in-memory fallback.
2. As the person deploying the API, I want the startup storage log to show Postgres-backed sources for refresh tokens and MFA, so that I can confirm nothing is running in memory.
3. As a maintainer, I want the new stores to follow the same shape as the existing session, email-token and OIDC-state stores, so that the auth folder stays predictable.
4. As a maintainer, I want each store to register itself with the authentication storage from its constructor, so that no extra wiring is needed beyond listing it as a provider.
5. As a future mobile-app User, I want my refresh token to survive an API restart, so that I am not signed out by a deploy.
6. As a future mobile-app User, I want a refresh token to work only once, so that a copied token is useless after I refresh.
7. As a future mobile-app User, I want the whole token family revoked if a spent token is presented again, so that a thief and I are both signed out rather than the thief staying in.
8. As a future mobile-app User, I want a refresh that loses a race with a reuse to still end up revoked, so that the successor it saves cannot be used.
9. As a future mobile-app User, I want signing out everywhere (or resetting my password) to revoke every refresh-token family I already have, so that old devices stop working.
10. As a future mobile-app User, I want families I start after a revoke-all to be unaffected, so that signing in again works.
11. As a future mobile-app User, I want the claims fixed at sign-in (such as `amr`) to be kept with my token family, so that a sign-in that passed MFA stays MFA-verified on refresh.
12. As a future mobile-app User, I want a family never to be extended past its absolute expiry however often it rotates, so that a stolen token cannot live forever.
13. As the operator, I want expired token families and their revocation rows pruned as new tokens are saved, so that the tables stay bounded without a cleanup job.
14. As the operator, I want deleting a User to delete their refresh tokens and MFA data, so that no credentials outlive the account.
15. As a User who enrolls an authenticator, I want my secret stored (sealed by the package) and my enrollment confirmable later, so that a mistyped secret cannot lock me out.
16. As a User replacing my phone, I want a staged replacement secret to sit beside the active one, so that my current authenticator keeps working until the new one is confirmed.
17. As a User, I want each TOTP code to be accepted only once, so that a code shoulder-surfed or intercepted cannot be replayed.
18. As a User, I want two simultaneous submissions of the same code to result in exactly one success, so that a race cannot defeat replay protection.
19. As a User, I want a stale read of my authenticator never to reopen a time step that was already used, so that saving my record cannot lower the replay marker.
20. As a User, I want my ten recovery codes stored only as hashes, so that a copy of the database does not reveal them.
21. As a User, I want a recovery code to work exactly once, even if it is submitted twice at the same instant, so that it cannot be reused.
22. As a User, I want to know how many recovery codes I have left, so that I can regenerate them before I run out.
23. As a User, I want regenerating my recovery codes to replace the old set, so that an old printout stops working.
24. As a User, I want repeated wrong codes to lock me out for the configured window, so that my account is protected from guessing.
25. As a User, I want a burst of parallel guesses to be counted correctly, so that no more attempts than the limit get checked.
26. As a User, I want my failed-attempt count cleared after I verify a correct code, so that earlier typos do not count against me.
27. As a User, I want failed attempts older than the window to stop counting, so that the lockout ends on its own.
28. As the operator, I want old failed attempts, even those of Users who never come back, to be pruned as new ones are recorded, so that the table stays bounded.
29. As a User who disables two-factor authentication, I want my authenticator, recovery codes and failure history removed, so that nothing stale is left behind.
30. As a maintainer, I want every column and table documented in the database schema doc, so that the next person can find out what is stored and why.
31. As a maintainer, I want the places that use raw SQL to say in a comment why the query builder could not express the statement, so that nobody "simplifies" an atomic write into a read followed by a write.

## Implementation Decisions

**Scope.** Two new stores only (refresh tokens and MFA), their tables, their registration in the auth module, and the matching schema documentation. The `accessToken` and `mfa` options in the application module stay unset. No controllers, no DTOs, no web changes.

**Module layout.** Two classes, one per contract, each a single-purpose provider in the auth module that takes the Prisma service and the authentication storage and registers itself as the source for its contract. This follows the existing one-store-per-class pattern; the two stores share no logic. Like the other auth stores, they query the Prisma service directly (the documented exception to "only repositories touch Prisma", because their shape is the package's contract rather than a domain type). Optional fields come back absent, never null, and times come from the caller (the package's clock), never from the database, with one exception noted below.

**Schema: refresh tokens.**
- A refresh-token table holding the contract record: the token's SHA-256 as the text primary key, family id, user id (foreign key to users, cascade on delete), created, expires, family-expires, used-at (nullable) and the sign-in claims as nullable JSONB. Indexes on family id, user id and family expiry.
- A revoked-families table: family id as the primary key and an expiry, with no foreign key (a revocation must be able to exist before, or after, any of the family's token rows).

**Schema: MFA.**
- An authenticator table keyed by user id (foreign key to users, cascade): sealed secret, confirmed flag, nullable staged replacement secret, nullable last-used time step as a plain integer (a step is about 58.7 million, far inside int4).
- A recovery-codes table with primary key (user id, hash), foreign key to users, cascade.
- A failures table with an id, user id (foreign key, cascade) and the attempt time as a timestamptz, indexed on (user id, time) and on time alone (for the global prune).

The contract enum-to-text convention and snake_case mapping follow the rest of the schema. The contract file is the source of truth; the schema doc is updated in the same change.

**Refresh-token store behaviour.**
- Read returns the record whether used or expired; the package checks.
- Save is a plain insert, then prunes tokens whose family expiry has passed and revocation rows whose expiry has passed, using the saved record's creation time as "now". Expired data only: no row cap, because refresh tokens are minted only for authenticated sign-ins (unlike email tokens, which anonymous visitors can request).
- Mark-used is one conditional update (`used_at` set where the token exists and `used_at` is null), true when exactly this call changed a row. Never a read followed by a write.
- Revoke-family always records the family as revoked, idempotently. Its expiry is the family's own absolute expiry when any token of the family is stored, and otherwise a fallback of one year measured by the database clock, held in a named constant. This is the only use of the database clock: revoke-family receives no timestamp, and the value is housekeeping, never a security decision. It exists so that revocation still covers a successor saved after the revoke by a refresh that lost a race.
- Revoke-all-for-user records every family the user currently has tokens in as revoked, idempotently, in one statement. Families the user starts later are unaffected.
- Is-revoked is a lookup on the revoked-families table.

**MFA store behaviour.**
- Get returns the authenticator or nothing. Save is an upsert, or a delete when given nothing; the stored last-used step is never lowered: the larger of the stored value and the record's wins, so a record read before a concurrent claim cannot reopen a claimed step.
- Claim-step is one conditional update: set the step where the user has an authenticator and the new step is greater than the stored one (or none stored); true only for the single call that did it.
- Save-recovery-codes replaces the user's set (an empty list deletes it). Consume-recovery-code is one conditional delete, true only for the single call that removed the row. Count returns the number remaining.
- Record-failure is three separate autocommit statements, deliberately not in a transaction (a transaction would hide the new row from parallel callers until commit, which breaks the rule that each recorded attempt is visible to later callers as soon as it returns): insert the attempt; delete every user's attempts older than the window (a global prune, which keeps the table bounded even for users who fail once and never succeed; safe because the application has a single configured lockout window); then count this user's attempts inside the window, the new one included. Count-failures is that count alone, and clear-failures deletes the user's rows.

**Query lane.** The ORM chain is used everywhere it can express the statement (following the session store): conditional updates and deletes with their affected-row counts. Raw SQL through the client's raw lane is used for exactly three methods, each with a comment explaining why: saving the authenticator (an upsert with `GREATEST` on the last-used step, which the ORM's upsert update branch cannot express), revoking one family (insert with a subselect for the expiry and a fallback), and revoking all of a user's families (insert from a select with do-nothing on conflict, which the ORM cannot express).

**Registration.** Both classes are added to the auth module's providers, beside the existing stores. Because registration happens in the constructor, nothing else is wired.

**Documentation.** The schema doc gains an entry per new table (columns, constraints, indexes, and the rule that explains each atomic write) and a line in the rules section for the atomic-write conventions, matching how email tokens and OIDC states are documented. The architecture notes for the API mention the two new stores next to the existing three.

## Testing Decisions

**What makes a good test here.** A store's contract is its public methods and nothing else. A good check calls those methods, including concurrently, and asserts only on what they return and on what the next call then returns. It must never inspect rows or SQL, because the point is that the behaviour (single winner of a race, revocation covering later saves, step never lowered) holds regardless of how it is written.

**The one seam.** The package's own contract suite, run through each store's public methods against a real Postgres, in its concurrent mode. It is the highest possible seam, it already encodes every atomic rule above, and no second seam is needed. A hand-written in-memory fake (the repository-spec pattern used elsewhere in this repo) is deliberately not used: the SQL is the thing under test, so a fake would only test the fake.

**Decision (owner): no committed tests.** No test files or scripts are added to the repository, and the default test run stays database-free. Instead, the suite is run once, locally, as a throwaway script outside the repository against the dev database, and its result is reported. The type-check and the lint are run as well. Both stores' atomic-write rules are therefore verified once at delivery but not guarded against regression; that is a known and accepted gap.

**Prior art.** None for store tests in this repo. The in-memory-fake service specs in the jobs and pipeline areas are the nearest existing pattern, and are intentionally not followed (see above). The package's contract helper is the reference.

## Out of Scope

- Configuring `accessToken` (bearer tokens, the mobile app's token endpoints) or `mfa` (enrollment, confirmation, verification endpoints, recovery-code generation) in the application module.
- Any web UI for two-factor authentication or session management.
- The remaining storage contracts (magic links), which no configured feature uses.
- Encryption of the authenticator secret: the package seals it before it reaches the store; the store only persists the sealed string.
- A scheduled cleanup job: pruning happens as rows are written.
- Committed database-backed tests, a test script, or CI wiring for them.
- Changing the existing session, email-token and OIDC-state stores.

## Further Notes

- The glossary has no terms for refresh token, token family, authenticator or recovery code. The spec uses the package's own vocabulary; if these become domain concepts when the features are switched on, they are candidates for `/domain-modeling`.
- The cause of this work is the package's production storage guard: a cookie-session provider reads the sessions, refresh-token and MFA stores, and password reset reads the same three. This spec fixes that by implementing the missing two, not by relaxing the guard.
- Applying the schema follows the repo's Prisma 8 workflow (edit the contract, emit, update the dev database), and past schema commits also included the migration snapshot files.
- Known limitation carried over from the owner's choice of no committed tests: if the package's contract changes in a later version, nothing in the repository will notice until someone reruns its suite.
