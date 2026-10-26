---
title: "/implement-spec: commit spec docs to the integration branch before spawning worktrees"
author: Yahia
date: 2026-10-24
branch: feat/repeating-groups
cost: { minutes: 2, tokens: 68889 }
id: l-6d3131a8
scope: repo
status: active
src: agent
touches:
  - ".scratch/repeating-groups/issues/01-repeating-group-rules-in-shared.md"
  - ".scratch/repeating-groups/issues/02-preset-keys-and-catalog-in-shared.md"
  - ".scratch/repeating-groups/issues/03-recruiter-adds-education-preset.md"
  - ".scratch/repeating-groups/issues/04-applicant-answers-education-entries.md"
  - ".scratch/repeating-groups/issues/05-reviewer-reads-education-entries.md"
  - ".scratch/repeating-groups/issues/06-experience-preset.md"
  - ".scratch/repeating-groups/issues/07-verification-pass-and-docs-sweep.md"
  - ".scratch/repeating-groups/spec.md"
  - GLOSSARY.md
  - docs/adr/0004-repeating-group-as-generic-question-type.md
---

## Decided
- Before running /implement-spec, the spec, tickets, ADR and glossary edits must be committed. Implementer worktrees are checkouts of a commit, so uncommitted or untracked docs (.scratch/<feature>/, docs/adr/, GLOSSARY.md) are invisible to them.
- For the repeating-groups run, the user chose to put those docs as the first commit on the integration branch `feat/repeating-groups` (commit 1c166ba), leaving main clean. The integration branch is checked out in the main folder, and implementers merge into it.
- The user's unrelated uncommitted edits to form-builder.tsx, cv-card.tsx and steps-section.tsx were committed to main first as WIP (a7c2689), so later builder tickets start from them.

## Tried and ruled out
- Committing the docs to main first (as earlier specs were) and leaving it to the user to commit: offered, not chosen.
- Stashing or discarding the builder edits: offered, not chosen. The diff was mostly double-quote reformatting against the repo's single-quote Prettier config, so expect noisy diffs in those two files.

## Watch out
- The main folder keeps the user's other uncommitted edits (globals.css, button.tsx, toggle-group.tsx). A merge into the integration branch that touches those files will refuse to run until they are committed or stashed.
