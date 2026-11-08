---
title: "Layer 3 dev embeddings: qwen3-embedding:0.6b measured (1024-d, default ctx 4096, truncate:false), production undecided"
author: Yahia
date: 2026-11-08
branch: main
cost: { minutes: 2, tokens: 25592 }
id: l-544fa550
scope: repo
status: active
replaces: l-d08e8530
src: agent
touches:
  - ".scratch/candidate-matching/layer3-embeddings-notes.md"
---

## Decided
Development and tests for candidate matching Layer 3 use `qwen3-embedding:0.6b` through Ollama `/api/embed` (owner's choice, 2026-11-08). Always send `truncate: false`. Vectors are 1024-d and L2-normalized, so cosine is a plain dot product. Store model id and vector length beside each vector. Query side gets an `Instruct: ...\nQuery:...` prefix (widened the correct-vs-best-wrong margin in 5 of 5 invented cases); documents get none. Wording is provisional. Full measurements are in `.scratch/candidate-matching/layer3-embeddings-notes.md`.

## Tried and ruled out
Trusting the model's reported context of 32768: the server rejects input over about 4,096 tokens (HTTP 400) unless `options.num_ctx` is raised, and with `truncate: true` it silently cuts instead. Relying on recalled model facts: dimensions, context and licence are not on the Ollama page for the 0.6b tag; read them from `/api/show` and by calling the API. `/api/show` returns an empty licence.

## Watch out
`input: ""` alone, or `[]`, returns zero embeddings with HTTP 200, so assert `embeddings.length === input.length`. `dimensions` above 1024 returns 400; below works and equals the sliced, renormalized full vector. Production embedding source and vector storage (pgvector vs plain column) are undecided (`layers.md` decisions 5 and 6); Cloud Run runs a single instance, so Ollama cannot run inside the API process. Test data was invented, not real CVs.
