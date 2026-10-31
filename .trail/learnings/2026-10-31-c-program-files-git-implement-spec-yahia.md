---
title: "C:/Program Files/Git/implement-spec worktrees have no .env, so browser checks are deferred to the owner"
author: Yahia
date: 2026-10-31
branch: feat/screening-rules
cost: { minutes: 36, tokens: 169848 }
id: l-2a57f2fe
scope: repo
status: active
src: agent
touches:
  - ".scratch/screening-rules/issues/09-flag-markers-on-card-row-and-sheet.md"
  - apps/web/components/dashboard/candidates/activity-items.ts
  - apps/web/components/dashboard/candidates/candidate-card.tsx
  - apps/web/components/dashboard/candidates/candidate-detail.tsx
  - apps/web/components/dashboard/candidates/columns.tsx
  - apps/web/components/dashboard/candidates/flag-marker.tsx
  - packages/shared/src/index.ts
  - packages/shared/src/screening-display.test.ts
  - packages/shared/src/screening-display.ts
  - ".scratch/screening-rules/issues/08-remove-field-level-rule-controls.md"
---

## Decided
- In the screening-rules run, implementer worktrees had no `apps/api/.env` or `apps/web/.env.local` (`.worktreeinclude` did not copy them and copying them in was refused by the permission system), so no implementer could start dev servers or use the browser pane. Tickets 06 to 09 were built with lint, types and shared tests only; their browser checkboxes stay unticked.
- For ticket 10 (browser walkthrough) the owner chose to do it themself rather than have a subagent run it in the main folder or in a worktree. The orchestrator still runs the code review and the docs sweep, and hands over a checklist of browser checks.

## Tried and ruled out
- A subagent running dev servers in the main folder: the owner had uncommitted edits there (package.json files, companies.controller.ts, CLAUDE.md) and the walkthrough writes test jobs and applications to their dev DB.
- A subagent in a clean worktree with the .env files copied in: needs a permission approval that was refused earlier.

## Watch out
- An implementer ran `docker compose up -d` in its worktree and left stopped containers named `agent-<id>-*`; port 5432 is already held by the main folder's compose, so tell implementers not to run compose at all.
