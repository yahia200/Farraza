# 03: Embedder interface and the Ollama implementation

**What to build:** The one seam through which Layer 3 reaches an embedding model, plus its development implementation. When the two optional environment variables are unset, Layer 3 is simply off. Spec: `.scratch/candidate-matching/layer3-spec.md` ("The embedder"); ADR-0008; notes: `.scratch/candidate-matching/layer3-embeddings-notes.md`.

- An `Embedder` interface that takes the texts and a kind (query or document) and returns the vectors, the model id and the vector length. It is shaped by what the caller needs, not by Ollama's request, so a later OpenAI implementation is a new class.
- The Ollama implementation posts to `/api/embed` with `truncate: false`, adds the query instruction only to inputs of kind query, skips blank strings before calling, and fails with a clear message on an unreachable host, a non-OK HTTP status, or a vector count that differs from the input count (an empty `input` returns HTTP 200 with zero vectors).
- Two optional environment variables (a base URL and a model name) are added to the API's environment schema. Unset means Layer 3 is off: nothing is queued and nothing is shown, and the API still boots, including in production.
- Read the installed docs for any library used and the Ollama references before writing, and name them: https://docs.ollama.com/api/embed and https://docs.ollama.com/capabilities/embeddings. Add the Ollama embed doc to the documentation table in the root `CLAUDE.md`.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The implementation is tested against a fake `fetch`: the request body (`truncate: false`, model, input), the prefix on queries only, blanks skipped, and each failure message
- [ ] With the variables unset the API boots and the embedder reports itself as not configured
- [ ] A manual run against local Ollama (`qwen3-embedding:0.6b`) returns 1,024-length vectors and passes the count check
- [ ] The environment schema and the `CLAUDE.md` setup text list the two new variables as optional
- [ ] `pnpm lint`, `pnpm check-types` and `pnpm --filter api test` pass
