---
title: "Layer 3 embedder is an HTTP API in dev and production; provider may become OpenAI, so the interface is caller-shaped"
author: Yahia
date: 2026-11-08
branch: main
cost: { minutes: 1, tokens: 1423 }
id: l-61f93210
scope: repo
status: active
src: agent
touches:
  - ".scratch/candidate-matching/layers.md"
  - apps/api/src/prisma/contract.prisma
---

## Decided
Owner (2026-11-08): Layer 3 calls an embedding API over HTTP the same way in development and production. Dev uses Ollama; production may switch to the OpenAI API (undecided). So the `Embedder` interface is shaped by what the caller needs (`embed(texts, kind)` returning vectors, model id and dimensions), not by Ollama's `/api/embed` request. Ollama-specific settings (`truncate: false`, the embeddings-count assertion) live inside the Ollama implementation only. Context: `.scratch/candidate-matching/layer3-embeddings-notes.md` and `.scratch/candidate-matching/layers.md`.

## Tried and ruled out
Building the production host (a separate Ollama service) first: it blocks everything else. Production hosting stays a later, separate decision.

## Watch out
A provider switch can change the vector length (OpenAI small is 1536 from memory, unverified), so the vector column must accept any length. That favours `real[]` over a fixed `pgvector.Vector(length: N)` in `apps/api/src/prisma/contract.prisma`. Store model id and length beside every vector and refuse to compare mismatches.
