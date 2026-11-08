---
title: "Layer 3 design: Requirement list reused, embeddings rank topic not level, edit limit locks Requirements, tiers out of scope"
author: Yahia
date: 2026-11-08
branch: main
cost: { minutes: 29, tokens: 105738 }
id: l-1d76ea3e
scope: repo
status: active
src: agent
touches:
  - docs/feature-backlog.md
  - GLOSSARY.md
  - docs/adr/0008-embeddings-behind-an-embedder-interface-and-stored-as-real-arrays.md
  - ".scratch/candidate-matching/layer3-spec.md"
  - ".scratch/candidate-matching/layers.md"
  - packages/shared/src/requirements.ts
---

## Decided
Grilling of 2026-11-08 produced `.scratch/candidate-matching/layer3-spec.md` and ADR-0008 (`docs/adr/0008-embeddings-behind-an-embedder-interface-and-stored-as-real-arrays.md`). Layer 3 reuses Layer 2's Requirement list and versions; embeds each Requirement's `text` only (with the query instruction prefix); keywords become optional (`.min(1)` in `packages/shared/src/requirements.ts` is dropped, a keyword-less Requirement reads "not checked" in Layer 2 and never sets `missedMustHave`); Layer 2 stays on every tier; the layers stay independent (no combined score yet). Scores are stored per Application so "Sort by score" is a plain sort and pagination is a separate backlog item. Edit limit (100, one constant) locks the whole Requirement list; the Application limit and tiers are out of scope (backlog "Job tiers and the Application limit"). The glossary has Application limit and Edit limit.

## Tried and ruled out
A Job description or a longer matching description as the match target: not cheaper in any way that matters, and a long vector drifts toward its topic. Level words in a Requirement ("intermediate Postgres"): in `.scratch/candidate-matching/layer3-embeddings-notes.md` the beginner chunk scored at or above the expert one. A bare keyword ("Postgres") without the instruction prefix scored a MySQL CV 0.661 against 0.681 for the real Postgres CV.

## Watch out
The strong/weak cutoffs (0.65 and 0.50) come from invented text and are placeholders: test them on real CVs before any label ships (marked URGENT in the notes and the backlog). Never return a CV passage to the web: the glossary keeps CV text out of sight. The `Float[]` column in Prisma 8 is unverified (ADR-0008 gate).
