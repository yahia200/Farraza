---
title: "/implement-spec keyword-match: half the implementers stop early; reviewer claims need checking; fake-repo specs can't test raw SQL"
author: Yahia
date: 2026-11-07
branch: feat/keyword-match
cost: { minutes: 53, tokens: 614772 }
id: l-b8b3b766
scope: repo
status: active
src: agent
touches:
  - ".scratch/keyword-match/issues/01-queue-infrastructure-spike.md"
  - ".scratch/keyword-match/issues/02-requirement-schema-and-matcher-in-shared.md"
  - ".scratch/keyword-match/issues/03-job-stores-and-saves-requirement-versions.md"
  - ".scratch/keyword-match/issues/04-submit-stores-the-requirement-result.md"
  - ".scratch/keyword-match/issues/05-missed-must-have-marker-and-sheet-section.md"
  - ".scratch/keyword-match/issues/06-manager-edits-requirements-on-the-settings-tab.md"
  - ".scratch/keyword-match/issues/07-recheck-count-enqueue-and-processor.md"
  - ".scratch/keyword-match/issues/08-recheck-button-and-progress.md"
  - ".scratch/keyword-match/issues/09-verification-pass-and-docs-sweep.md"
  - apps/api/src/recheck/recheck.repository.ts
---

## Decided
- Integration branch `feat/keyword-match` lived in its own worktree (`.claude/worktrees/keyword-match-integration`); every implementer branch was fast-forwarded in (`git merge --ff-only`) after it had merged the integration tip, so no merger subagent was needed. All 9 tickets plus 1 review-fix branch merged this way.
- Re-check SQL (`apps/api/src/recheck/recheck.repository.ts`) stays two near-identical queries: prisma-8's `db.raw.sql` takes whole queries only (`apps/api/node_modules/@prisma/orm-postgres/skills/prisma-8/references/queries.md`), so the FROM/JOIN/WHERE block is repeated with a comment on each saying they must match (progress totals depend on it).

## Tried and ruled out
- Trusting "completed" notices: 5 of 10 implementers (tickets 01 twice, 06 twice, 08 once) ended a turn with only uncommitted files and no report. Check `git log` and `git status` in the worktree, then resume with an ordered finish list (stop processes, run checks, `git add` only intended files, commit, merge the tip, send the report). Giving a numbered order worked every time.
- Taking the Standards reviewer at its word: it claimed the `CLAUDE.md` docs table lacked the new bullmq/pg row; line 38 already had it. Grep each claim before assigning a fix.
- A service spec on a hand-written fake repository cannot fail on a wrong raw-SQL predicate (the ticket 09 `uploaded` filter had no true red). Run the exact query read-only against the dev DB.

## Watch out
- `git worktree remove` unregisters the `agent-*` worktrees and `git branch -D` works, but the folders stay on Windows (long node_modules paths), and the PowerShell tool refuses to delete under this repo. Delete them by hand.
- A Re-check interrupted by an API restart does not resume on its own; click Re-check again. Whether Cloud Run has CPU always allocated is still the owner's open question (ADR-0007).
