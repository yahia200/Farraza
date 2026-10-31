---
title: "/implement-spec: isolated worktrees start from main, not the integration branch, so implementers must reset first"
author: Yahia
date: 2026-10-31
branch: feat/screening-rules
cost: { minutes: 11, tokens: 29352 }
id: l-a6b6ea87
scope: repo
status: active
src: agent
touches:
  - ".scratch/screening-rules/issues/01-screening-rule-schemas-and-evaluator-in-shared.md"
  - ".scratch/candidate-matching/layers.md"
  - ".scratch/screening-rules/issues/10-verification-pass-and-docs-sweep.md"
  - README.md
  - apps/web/components/dashboard/candidates/candidate-detail.tsx
  - apps/web/components/landing/steps-section.tsx
  - docs/db-schema.md
  - docs/feature-backlog.md
  - apps/web/components/dashboard/jobs/settings/condition-inputs.tsx
  - apps/web/components/dashboard/jobs/settings/screening-rules-editor.tsx
---

## Decided
- In the screening-rules run, most implementer worktrees (tickets 01, 02, 04, 07, 08 and others) started on `main`'s commit (04a4619 or 246ef0f), not on `feat/screening-rules`, so the spec docs and earlier tickets were missing. Every implementer prompt now says: check `git log` for the expected tip commit and run `git reset --hard feat/screening-rules` if it is not there, then `pnpm install` and `pnpm --filter @repo/shared build`.
- Because each implementer merged the integration tip into its branch before reporting, nearly every merge into the integration branch was a fast-forward (`git merge --ff-only`); no separate merger subagent was needed. Only the orchestrator's own checks (tests, `tsc`, `git log`, `git status`) were run after each merge.
- A condition in `@repo/shared` screening rules describes the ACCEPTABLE answer and the rule fires when the answer is outside it (so `in [x]` fires when the answer is not x). UI labels in the Settings editor are worded from that, not from the spec's "reject if any selected".

## Tried and ruled out
- Spawning a merger subagent per ticket: unnecessary once branches contain the integration tip.

## Watch out
- `apps/api` and `apps/web` have no `check-types` script, so root `pnpm check-types` only checks `@repo/shared`. Run `npx tsc --noEmit` in each (web needs `pnpm --filter web exec next typegen` first, which rewrites root `AGENTS.md`; revert that).
