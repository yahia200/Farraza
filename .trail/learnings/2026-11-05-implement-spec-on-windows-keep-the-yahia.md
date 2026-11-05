---
title: "/implement-spec on Windows: keep the integration branch in its own worktree; subagents end turns early; long-path worktree folders can't be deleted"
author: Yahia
date: 2026-11-05
branch: main
cost: { minutes: 61, tokens: 268484 }
id: l-0abf25bb
scope: repo
status: active
src: agent
touches:
  - apps/web/components/apply/apply-form.tsx
  - packages/shared/src/index.ts
  - ".cto-toolkit/learning/patterns.jsonl"
  - ".scratch/cv-autofill/spec.md"
---

## Decided
- cv-autofill run: the integration branch `feat/cv-autofill` lived in its own worktree (`.claude/worktrees/cv-autofill-integration`), not the main folder, because the owner had uncommitted edits to `apps/web/components/apply/apply-form.tsx` and `packages/shared/src/index.ts`, which tickets also touch. Merges were `--ff-only` once each implementer had merged the integration tip.
- Parallel tickets that edit the same hook (06, 08, 09 all touched `use-cv-autofill.ts`) merged cleanly because each implementer merged the tip before reporting; 08 resolved the one conflict.

## Tried and ruled out
- Trusting a subagent's first stop: implementers often ended their turn after writing only failing tests or edits, with no commit and no report. Resuming with "do not end your turn until the commit exists" fixed it every time; check `git status` in the worktree before believing "completed".

## Watch out
- A hook rewrites `.cto-toolkit/learning/patterns.jsonl` constantly; it leaked into one implementer commit (undone by a chore commit). `git checkout --` it before each merge.
- `git worktree remove` on Windows fails with "Filename too long" or "Permission denied" on the node_modules in agent worktrees; the worktrees are unregistered but the folders stay, and the tool blocked recursive deletes. Delete `.claude/worktrees/agent-*` folders by hand.
- Ticket 08 found PDFs give no Education/Experience suggestions (unpdf merges lines without blank lines between entries); only DOCX fills groups.
