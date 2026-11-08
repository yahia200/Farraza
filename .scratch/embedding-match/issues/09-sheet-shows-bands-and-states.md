# 09: Sheet shows bands and states

**What to build:** A reviewer opening an Application sees, for each Requirement, Layer 2's verdict and Layer 3's band side by side, and understands when no score exists. Spec: `.scratch/candidate-matching/layer3-spec.md` ("Payloads and web", stories 2 to 6).

- Each Requirement on the sheet shows its Layer 2 verdict (matched with terms, not matched, or not checked) and a band: Strong, Related or Weak. Raw numbers are never shown.
- States: "Scoring…" while pending, and "Not scored" with a plain reason (CV could not be read, scoring failed, model changed). An Application with no state shows nothing, like Layer 2 with no CV.
- Layer 2's "Missing must-have" marker and its behaviour are unchanged; Layer 3 never sets or clears it.
- The wording leaves room for the reality that a band ranks by topic, not by depth. The band labels are driven by the shared constants, which are still placeholders until ticket 12.

**Blocked by:** 04 (optional keywords, which also edits this section), 07 (submit queues scoring), 08 (scores in the payloads).

**Status:** resolved

- [x] The sheet shows both layers per Requirement in each state: scored, scoring, each not-scored reason, and no state
- [x] A must-have missed by Layer 2 but scored Strong shows both, and the marker still shows
- [x] No raw number or CV passage appears anywhere in the sheet or the page source
- [ ] Checked in a browser against the real API and local Ollama, including a stopped Ollama
- [x] `apps/web` lint and type checks pass (`pnpm lint`, `pnpm check-types`)

## Answer

Built test-first (the shared test was written and run before the module existed) on branch `worktree-agent-a489fefe74b077a28`; commit `3d49820` (`feat(web): show embedding match bands and states in the candidate sheet`).

**What exists.** `packages/shared/src/embedding-match-display.ts` (pure, tested in `embedding-match-display.test.ts`): `matchStateNote(state)` (null for no row or scored; "Scoring…"; "Not scored: the CV could not be read." / "...the scoring service failed." / "...the scoring model has changed since this was scored."), `bandLabel(band)` (Strong / Related / Weak) and `requirementRows(check, match)` (Layer 2 and Layer 3 joined by Requirement id). `CandidateRequirements` now takes `embeddingMatch` and draws, under each Requirement, "Keywords: ..." (Layer 2) and "Topic match: <band>" (Layer 3), plus a one-line state note under the heading and a note under the list that a band is by topic, not depth. `candidate-detail.tsx` passes the new prop. `.claude/rules/web.md` has one additive bullet.

**Decisions** (the agent's own; the owner may overrule)
1. The state ("Scoring…", "Not scored: reason") is one line under the heading, not repeated on every row; only a scored Application shows a band per row.
2. "Topic match" is the wording, so a Strong band is never read as "requirement met" (a MySQL CV scored close to a Postgres one in testing).
3. The band labels live in `embedding-match-display.ts`, keyed by the band; the cutoffs stay in the shared constants (`SCORE_STRONG_MIN`, `SCORE_WEAK_MAX`, placeholders until ticket 12), and `bandOf` runs on the API.
4. Layer 2's early return for an unreadable or failed CV is unchanged ("CV could not be read." only), so Layer 3's `cv_unreadable` is not said twice.
5. A Layer 3 Requirement that Layer 2's version lacks (the two layers ran against different versions) is appended with no keyword line.
6. The marker reads `check?.missedMustHave` only; Layer 3 never touches it.
7. Layer 2's line now reads "Keywords: Not checked / Matched: ... / Not matched" (a "Keywords:" prefix added to tell the two lines apart).

**Verified**: `pnpm --filter @repo/shared test` 789 passed; `pnpm lint` 0 errors (two old web warnings); `next typegen` then `npx tsc --noEmit` in `apps/web` clean (typegen's `AGENTS.md` change reverted). Not verified: the rendered sheet (no browser, API, Ollama or database here).

**Needs the owner** (browser box stays unticked)
1. Start `docker compose up -d`, Ollama with the model, set `EMBEDDING_BASE_URL`/`EMBEDDING_MODEL` in `apps/api/.env`, `pnpm dev`. Give a Job a must-have Requirement with a keyword, e.g. "PostgreSQL" with keyword `postgres`.
2. Scored: submit an Application with a readable CV and open its sheet: each Requirement shows "Keywords: ..." and "Topic match: Strong/Related/Weak", with the note under the list. View the page source: no number or CV text.
3. Scoring: open the sheet right after submitting: "Scoring…" under the heading, no bands; reload once scored.
4. Strong but missed: use a CV that says "relational database administration" and not "postgres": the row reads "Keywords: Not matched" and a Strong or Related band, and the "Missing must-have" marker still shows on the sheet, card and row.
5. Not scored: stop Ollama, submit, wait about 2.5 minutes: "Not scored: the scoring service failed." Use a CV with under 100 characters: the sheet says "CV could not be read." For "model changed", change `EMBEDDING_MODEL` and open an Application scored earlier (needs ticket 11's flow to produce the row; otherwise set the row's reason in SQL).
6. No state: an Application with no CV, or on a Job with Layer 3 off: no extra line, like Layer 2.
7. Check at 1024px and 375px for no horizontal scroll and dark mode readability.
