# 03: Embedder interface and the Ollama implementation

**What to build:** The one seam through which Layer 3 reaches an embedding model, plus its development implementation. When the two optional environment variables are unset, Layer 3 is simply off. Spec: `.scratch/candidate-matching/layer3-spec.md` ("The embedder"); ADR-0008; notes: `.scratch/candidate-matching/layer3-embeddings-notes.md`.

- An `Embedder` interface that takes the texts and a kind (query or document) and returns the vectors, the model id and the vector length. It is shaped by what the caller needs, not by Ollama's request, so a later OpenAI implementation is a new class.
- The Ollama implementation posts to `/api/embed` with `truncate: false`, adds the query instruction only to inputs of kind query, skips blank strings before calling, and fails with a clear message on an unreachable host, a non-OK HTTP status, or a vector count that differs from the input count (an empty `input` returns HTTP 200 with zero vectors).
- Two optional environment variables (a base URL and a model name) are added to the API's environment schema. Unset means Layer 3 is off: nothing is queued and nothing is shown, and the API still boots, including in production.
- Read the installed docs for any library used and the Ollama references before writing, and name them: https://docs.ollama.com/api/embed and https://docs.ollama.com/capabilities/embeddings. Add the Ollama embed doc to the documentation table in the root `CLAUDE.md`.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] The implementation is tested against a fake `fetch`: the request body (`truncate: false`, model, input), the prefix on queries only, blanks skipped, and each failure message
- [x] With the variables unset the API boots and the embedder reports itself as not configured
- [x] A manual run against local Ollama (`qwen3-embedding:0.6b`) returns 1,024-length vectors and passes the count check
- [x] The environment schema and the `CLAUDE.md` setup text list the two new variables as optional
- [x] `pnpm lint`, `pnpm check-types` and `pnpm --filter api test` pass (run for `apps/api` only: `oxlint src/`, `npx tsc --noEmit`, `vitest run`; no other package changed)

## Answer

Commit `9dbc9c6` (`feat(api): add the Embedder interface and Ollama implementation`) on branch `worktree-agent-ae4940b2ac802d672`.

**What was built** (`apps/api/src/embedding/`)
- `embedder.ts`: the `Embedder` interface (`embed(texts, kind)` returning `{ vectors, model, dimensions }`), `EmbedderError`, and the `EMBEDDER` injection token.
- `ollama-embedder.ts`: `OllamaEmbedder` over `POST /api/embed`.
- `create-embedder.ts`: `createEmbedder(env)` returns the embedder or `null` (Layer 3 off).
- `embedding.module.ts`: global module providing `EMBEDDER` (`Embedder | null`), imported in `app.module.ts`.
- `env.schema.ts`: optional `EMBEDDING_BASE_URL` (http(s)) and `EMBEDDING_MODEL`; `CLAUDE.md` setup text and docs table updated.

**Decisions** (the agent's own; the owner may overrule)
1. The two variables must be set together (a refine on `EMBEDDING_BASE_URL`). Setting one stops the boot, because a half configuration would silently turn Layer 3 off. The ticket only said "unset means off".
2. "Reports itself as not configured" is `EMBEDDER` resolving to `null`, not a null-object class. Callers must check it. Alternative: a `NotConfiguredEmbedder` with `isConfigured`.
3. Blank texts are skipped before the call, so `vectors` lines up with the non-blank texts, not with every input. Ticket 06 must not pass blank chunks (the chunker already drops them) or must filter first. Nothing non-blank means no request and `{ vectors: [], dimensions: 0 }`.
4. `REQUIREMENT_QUERY_INSTRUCTION` is imported from `@repo/shared` (ticket 02 defined it there, as the spec says); the Ollama embedder applies it. A first draft kept a local copy; it was removed after the merge. A non-Qwen provider would not use it.
5. A 60 s per-request timeout (`AbortSignal.timeout`, option `timeoutMs`) and shape validation of the response; both fail as `EmbedderError`.
6. `model` in the result is the configured model, not the name Ollama echoes back.

**Verified**: 22 embedding specs (fake `fetch`, factory, module) and 6 new env schema specs; all api specs pass; `npx tsc --noEmit` clean; `oxlint` shows only pre-existing warnings. Manual run against local Ollama (`qwen3-embedding:0.6b`): 1,024-length vectors, count check passed, query norm 1.0000, an unreachable host and an unknown model (HTTP 404) gave the clear messages.

**Open**: a full `pnpm dev` boot with the variables unset was not run (no `.env`, no database in this worktree); the module spec and env schema specs cover the same path. The Ollama licence and the instruction wording remain open items of the spec.
