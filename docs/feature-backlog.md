# Feature backlog

Features I want to add to Farraza, ordered by priority within each section. Add new items at the bottom of the section that matches their priority, and move them when priorities change.

Priority levels: **High** (next up), **Medium** (soon), **Low** (nice to have, no rush).

## High priority

Candidate matching: design notes in [`.scratch/candidate-matching/layers.md`](../.scratch/candidate-matching/layers.md) (draft, not yet a spec). Four layers, cheapest first. Everything except Layer 1's auto-reject is advisory.

### Candidate matching, Layer 1: expand the auto-reject rules

Today rules exist only for `yes_no` and `single_select`, and the only outcome is reject. Decided in the grilling session of 2026-10-31 (the glossary calls them **Screening rules**):

- **Storage:** a Job-level `jobs.screening_rules` list keyed by question key, replaced whole by one `PUT` like Rating Criteria. `rejectWhen` and `rejectOptionIds` leave the field `config`. No data migration: only test jobs exist, so they are cleared.
- **Outcomes in this slice:** reject (today) and flag (marker plus a generated reason, application stays put; shown on the board card, table row and candidate sheet, with a new `flagged` event). Reject wins over flag, every rule that fired is recorded, and rules are evaluated once at submit.
- **Types in this slice:** `single_select` (also an accept-list), `multi_select` (any-of, none-of-required, all-of), `number` (min, max, range), `date` (fixed or relative to the submission date), `short_text` and `long_text` (words: any-of, all-of, none-of, whole-word and case-insensitive), `yes_no` (as today). A blank answer never fires a rule. No guard on protected attributes: a manager may screen on any question.
- **Editor:** a new **Settings** tab on the Job (`/settings`) hosting Screening rules and Rating Criteria (moved there). Publishing a form version that drops a question a rule points to is blocked until the rule is removed.
- **Later slices:** move to a chosen non-final stage as an outcome, `repeating_group` rules (entry count, total duration, any-entry match), `url` rules.

### Candidate matching, Layer 2: keyword match

Check that the CV mentions each Requirement's terms. Shows matched or not matched plus the terms found. Flags a missed must-have, never rejects. Layer 2 reads the CV only: text answers are Layer 1's (word rules on `short_text` and `long_text`).

- Needs a Requirements list on the Job and CV text extraction (a scanned PDF must read as "unreadable", not "missing").
- Terms are manager-supplied keywords and synonyms (recommended) or auto-extracted.
- Matching in app code, or Postgres full-text search (not yet verified against the Prisma 8 contract).

### Repeating group full support

Adding the repeating group full support.

v1 shipped deliberately narrow (`.scratch/repeating-groups/spec.md`, "Out of Scope", and ADR-0004, "v1 limits"). "Full support" means widening these, none of which should break stored data. Pick from this list when this is scheduled:

- **Auto-reject rules and matching:** `findKnockout` ignores groups and the schema refuses a rule on a sub-question. Rules over entries (entry count, total duration, any-entry match) are specified in Layer 1 of candidate matching, so build them together.
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
