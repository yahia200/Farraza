# Feature backlog

Features I want to add to Farraza, ordered by priority within each section. Add new items at the bottom of the section that matches their priority, and move them when priorities change.

Priority levels: **High** (next up), **Medium** (soon), **Low** (nice to have, no rush).

## High priority

Candidate matching: design notes in [`.scratch/candidate-matching/layers.md`](../.scratch/candidate-matching/layers.md) (draft, not yet a spec). Four layers, cheapest first. Everything except Layer 1's auto-reject is advisory.

### Candidate matching, Layer 1: expand the auto-reject rules

Today rules exist only for `yes_no` and `single_select`, and the only outcome is reject.

- More types: `multi_select` (any-of, none-of-required, all-of), `number` (min, max, range), `date` (fixed or relative to submission, no date-of-birth rules), `repeating_group` (entry count, total duration, any-entry match), `url` (low value, last).
- More outcomes: reject (today), flag (marker plus reason, application stays put), move to a chosen non-final stage.
- Open: do rules stay on the form field or move to a Job-level list keyed by question key?

### Candidate matching, Layer 2: keyword match

Check that the CV and text answers mention each Requirement's terms. Shows matched or not matched plus the terms found. Flags a missed must-have, never rejects.

- Needs a Requirements list on the Job and CV text extraction (a scanned PDF must read as "unreadable", not "missing").
- Terms are manager-supplied keywords and synonyms (recommended) or auto-extracted.
- Matching in app code, or Postgres full-text search (not yet verified against the Prisma 8 contract).

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

### Repeating group full support

Adding the repeating group full support.

## Low priority

### Two-factor authentication (2FA) with TOTP

Let users protect their account with a time-based one-time password from an authenticator app (Google Authenticator, 1Password, etc.).

- Enrol: show a QR code / secret, confirm with a first valid code, then issue recovery codes.
- Sign-in: after the password (or Google) step, ask for the 6-digit code.
- Manage: disable 2FA, regenerate recovery codes.
- Note: `PrismaMfaStore` already exists in `apps/api/src/auth/` (wired in `auth.module.ts`), so check what the auth package already provides before designing anything new.
