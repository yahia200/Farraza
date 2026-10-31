# Feature backlog

Features I want to add to Farraza, ordered by priority within each section. Add new items at the bottom of the section that matches their priority, and move them when priorities change.

Priority levels: **High** (next up), **Medium** (soon), **Low** (nice to have, no rush).

## High priority

Candidate matching: design notes in [`.scratch/candidate-matching/layers.md`](../.scratch/candidate-matching/layers.md) (draft, not yet a spec). Four layers, cheapest first. Everything except Layer 1's reject outcome is advisory.

### Candidate matching, Layer 1: Screening rules (first slice shipped)

The first slice is built (`.scratch/screening-rules/spec.md`, ADR-0005, `docs/db-schema.md` §3.5): Screening rules live on the Job, with reject and flag outcomes, for every question type except `file`, `url` and `repeating_group`. Decided in the grilling session of 2026-10-31 (the glossary calls them **Screening rules**); what the first slice delivered, and what is left:

- **Storage:** a Job-level `jobs.screening_rules` list keyed by question key, replaced whole by one `PUT` like Rating Criteria. `rejectWhen` and `rejectOptionIds` left the field `config` (old stored versions are tolerated and stripped).
- **Outcomes (built):** reject and flag (marker plus a generated reason, application stays put; shown on the board card, table row and candidate sheet, with a new `flagged` event). Reject wins over flag, every rule that fired is recorded, and rules are evaluated once at submit.
- **Types (built):** `single_select` (also an accept-list), `multi_select` (any-of, none-of-required, all-of), `number` (min, max, range), `date` (fixed or relative to the submission date), `short_text` and `long_text` (words: any-of, all-of, none-of, whole-word and case-insensitive), `yes_no` (as today). A blank answer never fires a rule. No guard on protected attributes: a manager may screen on any question.
- **Editor (built):** the **Settings** tab on the Job (`/settings`) hosts Screening rules and Rating criteria. Publishing a form version that drops a question a rule points to is blocked until the rule is removed.
- **Still to do (later slices):** move to a chosen non-final stage as an outcome, `repeating_group` rules (entry count, total duration, any-entry match), `url` rules, regex matching.

### Candidate matching, Layer 2: keyword match

Check that the CV mentions each Requirement's terms. Shows matched or not matched plus the terms found. Flags a missed must-have, never rejects. Layer 2 reads the CV only: text answers are Layer 1's (word rules on `short_text` and `long_text`).

- Needs a Requirements list on the Job and CV text extraction (a scanned PDF must read as "unreadable", not "missing").
- Terms are manager-supplied keywords and synonyms (recommended) or auto-extracted.
- Matching in app code, or Postgres full-text search (not yet verified against the Prisma 8 contract).

### Repeating group full support

Adding the repeating group full support.

v1 shipped deliberately narrow (`.scratch/repeating-groups/spec.md`, "Out of Scope", and ADR-0004, "v1 limits"). "Full support" means widening these, none of which should break stored data. Pick from this list when this is scheduled:

- **Screening rules and matching:** Screening rules ignore groups and the schema refuses a rule on a sub-question. Rules over entries (entry count, total duration, any-entry match) are specified in Layer 1 of candidate matching, so build them together.
- **Sub-question types:** only `short_text`, `long_text`, `single_select`, `multi_select` and `yes_no` are allowed. Check whether `number`, `date` and `url` can now go inside a group (the v1 presets use free text for dates and years), and whether `file` or nested groups are worth allowing.
- **Builder:** recruiters can only insert presets and edit labels, help text, `required` and `maxEntries`. Missing: a blank group, adding, removing and reordering sub-questions, editing option lists, and saving their own presets.
- **Minimum entries:** `required` means at least one entry and there is no minimum setting.
- **Single-question presets** (for example notice period): the preset key design allows them, none ship.
- **Conditional logic** on sub-questions and groups.
- **Candidate list:** no columns, filters or search over group answers.
- **CV autofill:** preset keys are recorded so autofill can recognise a school or job title, but nothing uses them yet. Needs CV parsing from Layer 2.
- **Apply page:** a group is one step with entry cards, and the letter-shortcut choices only work on top-level steps.

## Medium priority

### Candidate matching, Layer 3: embeddings

Rank candidates by topical similarity between the CV and each Requirement ("Best match" sort, strong or weak per Requirement). Advisory only, never auto-rejects.

- Needs a background embed step and vector storage (plain `jsonb`/`real[]` with cosine in app code is enough at this scale).
- Hosted (about $0.00003 per candidate) or a local English-only model. Open decision.
- Build only if Layer 2 does not rank well enough.

### Candidate matching, Layer 4: LLM scoring

Per-Requirement verdict with an evidence quote and a reason. The only layer that can say a Requirement is actually met, and the only one that costs real money (about $0.001 to $0.05 per candidate).

- Never on every application. Triggers: top N after Layer 3, a chosen stage, or on demand for one candidate.
- Guardrails: manual by default, cost estimate before a bulk run, monthly caps, results marked stale on Requirement edits, never auto-reject.
- Build only if reviewers need explanations.

## Low priority

### Screening rules: regex matching on text answers

A regex condition for `short_text` and `long_text` Screening rules, left out of Layer 1.

- A manager's pattern runs on the server against applicant text, so a backtracking engine (native `RegExp`) risks ReDoS. Use a linear-time engine such as `re2js` (pure-JS RE2 port); read its installed README and `.d.ts` first, it is not yet verified.
- Validate the pattern when the rule is saved, so a bad one is an editor error and never a failure at submit.

### Two-factor authentication (2FA) with TOTP

Let users protect their account with a time-based one-time password from an authenticator app (Google Authenticator, 1Password, etc.).

- Enrol: show a QR code / secret, confirm with a first valid code, then issue recovery codes.
- Sign-in: after the password (or Google) step, ask for the 6-digit code.
- Manage: disable 2FA, regenerate recovery codes.
- Note: `PrismaMfaStore` already exists in `apps/api/src/auth/` (wired in `auth.module.ts`), so check what the auth package already provides before designing anything new.

### Sign-in limits per email

Limit failed sign-ins per account, not only per visitor. Sign-in and sign-up already have per-visitor limits (`@Throttle` in `apps/api/src/auth/auth.controller.ts`: 10 sign-ins and 5 sign-ups per 10 minutes). That does not stop an attacker who guesses one account's password from many addresses (security review finding M-4).

- A second tracker keyed on the normalized email, or a failure counter in the database. `TrustedClientThrottlerGuard` (`apps/api/src/common/trusted-client-throttler.guard.ts`) overrides `getTracker`; read "Customization" and "Proxies" in `apps/api/node_modules/@nestjs/throttler/README.md` first.
- Don't hard-lock the account: anyone could lock a victim out by failing on purpose. Use a growing delay (backoff) or a challenge instead.
- Only worth building if credential stuffing shows up in practice.

### Cap concurrent password hashing

Bound how many password hashes run at once, so a burst of sign-in attempts from many addresses cannot exhaust memory or the thread pool (security review finding M-5). Each hash uses about 128 MiB (scrypt `logN: 17`) and runs on the libuv thread pool; an unknown email still pays for a full dummy hash, by design, so the response time does not reveal which accounts exist.

- Idea: at most 2 hashes at once, and extra requests get `503` with `Retry-After` instead of queuing. Read how `@nestjs/authentication` lets the app replace the `PasswordHasher` it builds from its `password` option before choosing where the cap goes (`apps/api/node_modules/@nestjs/authentication/dist/services/password-hasher.service.d.ts`).
- **Check first whether this is needed at all for a small team's app.** The per-visitor limits on sign-in and sign-up already bound each address. Weigh the cost of a distributed burst (rare for a small private tool) against the extra code and the chance of turning away real sign-ins.
- **Before lowering the hash cost:** `logN: 17` is the library's stated OWASP minimum (N=2^17, r=8, p=1). OWASP's Password Storage Cheat Sheet lists other scrypt settings that trade memory for CPU; read it before weakening anything (not yet verified). The security review's "logN 15 is fine" claim contradicts the library comment.
- Also check the memory size of the API's Cloud Run service (not in the repo): four concurrent hashes are about 512 MiB before Node itself.
