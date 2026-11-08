---
title: "Layer 3 dev embeddings: qwen3-embedding:0.6b via Ollama, truncate:false, production undecided"
author: Yahia
date: 2026-11-08
branch: main
cost: { minutes: 14, tokens: 83013 }
id: l-d08e8530
scope: repo
status: active
src: agent
touches:
  - ".scratch/candidate-matching/layer3-embeddings-notes.md"
  - ".scratch/candidate-matching/layers.md"
---

## Decided
Development and tests for candidate matching Layer 3 use `qwen3-embedding:0.6b` through Ollama `/api/embed` (owner's choice, 2026-11-08). Send `truncate: false` on every call (the default `true` silently cuts oversized input). `/api/embed` returns L2-normalized vectors, so cosine is a plain dot product. Store model id and vector length beside each vector. Details and the unconfirmed items are in `.scratch/candidate-matching/layer3-embeddings-notes.md`.

## Tried and ruled out
Relying on recalled model facts: the Ollama page for the 0.6b tag does not state dimensions, context length, instruction format or licence (figures on the page belong to the 8B model). Measure dimensions by calling the API.

## Watch out
Production embedding source and vector storage (pgvector vs plain column) are undecided (`layers.md` decisions 5 and 6). Cloud Run runs a single instance, so Ollama cannot run inside the API process. A different production model means re-embedding everything.
