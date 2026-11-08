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

**Built (2026-11-07):** Layer 2 is in: Requirements editor on the Settings tab, result stored at submit, the "Missing must-have" marker on the card, row and sheet (with a Requirements section on the sheet), and the Re-check button with progress. Checked end to end in a browser against the real API (ticket 09, `.scratch/keyword-match/screenshots/`). Open: whether Cloud Run has CPU always allocated (ADR-0007), the legal review, and no filter or sort on the marker yet.

**Designed and ticketed (2026-11-06):** spec and nine tickets in `.scratch/keyword-match/`, background work decided in ADR-0007 (BullMQ over Postgres, with two gates to pass first). Decided: manager-supplied keywords, a pure-function matcher, versioned Requirements, results stored at submit, and a manual Re-check for Applications that need it.

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

Design in the grilling session of 2026-11-08; notes and measurements in [`.scratch/candidate-matching/layer3-embeddings-notes.md`](../.scratch/candidate-matching/layer3-embeddings-notes.md). Not yet a spec.

- Needs a background embed step and vector storage (a `real[]` column with cosine in app code; pgvector only if cross-Job search appears).
- An `Embedder` interface over an HTTP API: Ollama (`qwen3-embedding:0.6b`) in development, production undecided (possibly OpenAI).
- It shares Layer 2's Requirement list and versions, embeds each Requirement's `text` only, and stores a score per Application so "Best match" is a plain `ORDER BY`.
- Build only if Layer 2 does not rank well enough.
- **URGENT before shipping: test the strong/weak cutoffs on real CVs.** The values (strong at 0.65 and above, weak below 0.50) come from a few invented paragraphs, so they are placeholders. Wrong cutoffs would label candidates misleadingly. Do this with 10 to 20 real CVs (kept out of git) and a few real Requirements, and re-test the instruction prefix wording at the same time.

### Candidate list pagination

The candidate list returns every Application at once (nothing in `apps/api/src/applications` limits or pages it). With Jobs of up to 500 Applications that will get heavy. Split out of Layer 3 on 2026-11-08.

- Check how the board (all cards per stage) and the table each fetch before choosing offset or cursor paging.
- Once it lands, the list API must sort by Layer 3's stored score on the server.

### Job tiers and the Application limit

Split out of Layer 3 on 2026-11-08 (decided out of scope for that slice). The glossary already defines **Application limit** and **Edit limit**; Layer 3 ships with one fixed edit limit of 100 for every Job (`.scratch/candidate-matching/layer3-spec.md`).

- **Application limit:** the most Applications a Job accepts; at the limit the public apply page closes. Owner's figures: 200 on the standard tier and 500 on a more expensive one.
- **Edit limit per tier:** the number of Applications after which a Job's Requirements and other cost-driving settings lock. 100 for every tier for now; the owner expects more tier granularity later, so store the numbers on the Job and not as global constants once tiers exist.
- **Feature gating:** Layer 2 stays on every tier. Whether Layer 3 is limited to the higher tier is a pricing choice, not a cost one (about $0.02 per 500 candidates hosted); Layer 4 is where cost bites (roughly $7 to $14 for 300 candidates on Sonnet or Opus, `layers.md`). Decide gating in one helper function so changing it is a one-line edit.
- **Open:** how a Job gets its tier, whether it can be upgraded after the edit limit is hit, and where the tier lives (Job or company). Related: "Duplicate a locked Job as a new Job" in Low priority.

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

### Company logo: upload instead of a link

Today the logo is a pasted `https://` link (`logoUrl`, `BrandingFields`). Replace it with an upload, so a company doesn't need to host its own image.

- The storage side exists (presigned uploads to the bucket, `files` rows, `browser-image-compression` on the web app); the logo needs its own file purpose, a size/type limit (small images only) and a public-readable URL, because the public apply pages show it to anyone.
- Keep `logoUrl` as the stored value, so the public pages and the sidebar don't change. Decide what happens to the old object when the logo is replaced or removed.
- Applies to Settings, step 2 of "Add company" and the branding card on the overview.

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

### Duplicate a locked Job as a new Job

Let a recruiter copy a Job whose cost-driving settings are locked, to get a fresh, editable Job. Decided in the Layer 3 grilling session of 2026-11-08, and deliberately left out of the Layer 3 slice: a locked Job stays locked, and the UI only explains why.

- **Why it exists:** once a Job reaches its editing limit (the number of Applications after which the Requirements and the Layer 3 and 4 settings can no longer change), a recruiter who got them wrong has no way out. This is that way out. Note the two separate limits: the editing limit (settings lock) and the acceptance limit (200, or 500 on the premium tier; the apply page closes).
- **What to copy:** title, description, the form's latest published version, stages, Screening rules, Rating criteria, Requirements and the Layer 3 and 4 settings. Do not copy Applications, results or vectors.
- **Open:** what the copy's slug and status are, whether the original closes automatically, and whether duplicating is allowed on unlocked Jobs too (it probably is).
