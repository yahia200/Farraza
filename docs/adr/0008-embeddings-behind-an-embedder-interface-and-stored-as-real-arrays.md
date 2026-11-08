# Embeddings sit behind an Embedder interface and are stored as plain `real[]` columns

Status: accepted for development (2026-11-08); the production embedding service is still open and will be a later ADR

Candidate matching Layer 3 ranks CVs by topical similarity to a Job's Requirements. We call an embedding model through a small `Embedder` interface (`embed(texts, kind)` returning vectors, the model id and the vector length), shaped by what the caller needs and not by any one provider's request. Development and tests use Ollama's `/api/embed` with `qwen3-embedding:0.6b`; production may use the OpenAI API or something else, and moving there is a new implementation of the interface plus a re-embed. Vectors are stored in plain `real[]` columns, each beside its model id and length, and similarity is a dot product in application code (Ollama returns L2-normalised vectors, so the dot product is the cosine). Derived scores are stored per Application, so sorting and later pagination are an ordinary `ORDER BY`.

Considered options:

- **pgvector (`vector(N)` column)** — rejected for now. The Prisma 8 skill documents it (`pgvector.Vector(length: N)`, `cosineDistance`), but the length is fixed in the column type and a provider switch can change it (OpenAI's small model is 1,536 dimensions from memory, unverified; ours is 1,024), it needs a different Postgres image than `postgres:17` in `docker-compose.yml`, and the production Postgres host must offer the extension (unknown). Its strength, database-side nearest-neighbour search, is not needed: a Job's pool is at most hundreds of Applications and the scores are stored. Cross-Job search ("candidates like this one") would change this; the data moves into a `vector` column with a one-off migration.
- **A hosted vector database** — not justified at this scale; another service and another place for CV content to live.
- **Ollama or a model library inside the API process** (ONNX Runtime, `@huggingface/transformers`) — rejected: the API runs as a single Cloud Run instance (`.claude/rules/api.md`), so inference would compete with request handling.
- **`jsonb` instead of `real[]`** — the fallback if the Prisma 8 contract cannot express a `Float[]` column (gate below).

Consequences:

- Every stored vector carries its model id and length, and vectors that differ in either are never compared. A model change means "not scored (model changed)" until a deliberate re-embed.
- Embeddings rank by topic, not by depth. In a measured run (`.scratch/candidate-matching/layer3-embeddings-notes.md`) a MySQL CV scored 0.661 against "Postgres" and the real Postgres CV 0.681, and "intermediate" did not separate a beginner from an expert. So Layer 3 is advisory only and sits beside Layer 2's exact keyword match, never in place of it.
- Ollama-specific behaviour (`truncate: false`, asserting that the count of vectors equals the count of inputs, because `input: ""` or `[]` returns HTTP 200 with zero vectors) lives inside the Ollama implementation only.
- The CV text never leaves the API for a reviewer; only bands and an ordering do (glossary: CV text).

Gate before this is relied on: emit a contract with one `Float[]` column and apply it with `prisma db update`. If Prisma 8 refuses it, store `jsonb` and supersede the storage part of this ADR.

References: https://docs.ollama.com/api/embed, https://docs.ollama.com/capabilities/embeddings, `apps/api/node_modules/@prisma/orm-postgres/skills/prisma-8/references/contract.md` (scalar lists, "Add an extension-typed scalar (pgvector)").
