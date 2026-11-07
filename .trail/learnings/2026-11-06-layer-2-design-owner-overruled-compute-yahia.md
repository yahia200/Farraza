---
title: "Layer 2 design: owner overruled compute-on-read, row snapshots and sync re-check"
author: Yahia
date: 2026-11-06
branch: main
cost: { minutes: 32, tokens: 157327 }
id: l-14b623df
scope: repo
status: active
src: agent
touches:
  - ".scratch/candidate-matching/layers.md"
  - ".scratch/keyword-match/issues/01-queue-infrastructure-spike.md"
  - ".scratch/keyword-match/issues/02-requirement-schema-and-matcher-in-shared.md"
  - ".scratch/keyword-match/issues/03-job-stores-and-saves-requirement-versions.md"
  - ".scratch/keyword-match/issues/04-submit-stores-the-requirement-result.md"
  - ".scratch/keyword-match/issues/05-missed-must-have-marker-and-sheet-section.md"
  - ".scratch/keyword-match/issues/06-manager-edits-requirements-on-the-settings-tab.md"
  - ".scratch/keyword-match/issues/07-recheck-count-enqueue-and-processor.md"
  - ".scratch/keyword-match/issues/08-recheck-button-and-progress.md"
  - ".scratch/keyword-match/issues/09-verification-pass-and-docs-sweep.md"
---

## Decided
Grilling of 2026-11-06 produced .scratch/keyword-match/spec.md and ADR-0007. The owner overruled three of my recommendations: results are stored at submit (not computed on read), Requirements are immutable versions that results reference (not a snapshot copied onto each row), and Re-check runs asynchronously over every non-rejected Application that needs it (not a synchronous 200 cap). Re-check is manual, with a count and a button disabled at zero. Background work is BullMQ on its Postgres backend (createPostgresBackend), chosen over a run-row design and over Redis.

## Tried and ruled out
A hand-written run row with a chunked loop (kept as the fallback if the gates fail), BullMQ on Redis (a third service for one cheap job), Postgres full-text search for matching (unverified in Prisma 8, awkward for C# and Node.js), Application Events for Layer 2 (no "unflagged" event exists, so event flags could never clear).

## Watch out
ADR-0007 rests on bullmq 6.7.1 and @nestjs/bullmq 12.0.1 type definitions read in a scratch install, not a real run. Two gates are open: prisma db update/verify must leave BullMQ's bullmq schema alone, and the Cloud Run CPU-always-allocated setting is unconfirmed. The caps (10 / 15 / 40) and chunk size 50 are placeholders.
