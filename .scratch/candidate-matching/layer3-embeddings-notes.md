Status: working notes (updated 2026-11-08 with measurements). Development choices are made; production is undecided. Not a spec and not an ADR yet.

# Layer 3 (embeddings): choices so far

Related: `.scratch/candidate-matching/layers.md` (Layer 3 section, open decisions 5 and 6), ADR-0007 (`docs/adr/0007-background-work-on-bullmq-over-postgres.md`), `.scratch/keyword-match/spec.md` (Layer 2, the pattern this layer follows).

## Decided (development)

1. **Embedding model in development and tests: `qwen3-embedding:0.6b`, served by Ollama.** The owner chose it. Page read on 2026-11-08: https://ollama.com/library/qwen3-embedding:0.6b (639 MB, 596M parameters, Q8_0, 100+ languages). Layer 3 only needs English (`layers.md`, "Language"), so the multilingual coverage is unused but harmless.
2. **Call shape: `POST /api/embed`** (reference: https://docs.ollama.com/api/embed, the `EmbedRequest` schema):
   - `input` takes an array, so all chunks of one CV go in one call. One vector comes back per string, in order.
   - Always send `truncate: false`. The default is `true`, which silently cuts inputs that exceed the context window (measured below: it returned 4,095 tokens for an input of about 64,000 characters). With `false`, an oversized input returns HTTP 400 and the caller splits the chunk instead of scoring part of a CV.
   - `prompt_eval_count` in the response is the input token count. Log it while tuning the chunk size.
   - `keep_alive` controls how long the model stays loaded. The first call pays a `load_duration`.
3. **Vectors are L2-normalized by `/api/embed`** (https://docs.ollama.com/capabilities/embeddings, the note under "Generate embeddings"; measured norm 1.0000). Cosine similarity is therefore the plain dot product. This supports `layers.md`'s plan to score in application code over a plain column.
4. **Store the model id and the vector length beside every vector**, and refuse to compare vectors whose model or length differ. Ollama's tag can be re-pushed, so also record the model digest if the API exposes it (not checked). This extends the rule in `layers.md` ("Store the model id beside each vector").
5. **Put the embedder behind one small interface** (`embed(texts, kind) -> vectors`, `kind` being query or document). Development uses Ollama; production is still open, so the rest of Layer 3 must not know which backend it is.
6. **Chunk the CV by section and score a Requirement by its best chunk**, as `layers.md` already plans. Chunking also keeps every input far under the context limit.
7. **Query side gets an instruction prefix, document side does not** (see "Measured", instruction results). Keep the instruction text in one named constant. The exact wording is provisional and should be re-tested on real CVs.

## Measured on 2026-11-08 (local Ollama, `qwen3-embedding:0.6b`, `/api/embed`)

Scripts were throwaway and are not in the repo. The test data was a few invented CV paragraphs and requirements, not real CVs, so treat the quality results as indications only.

| Question | Result |
|---|---|
| Vector length | **1024** (`/api/show`: `qwen3.embedding_length`). |
| Normalized? | Yes, norm 1.0000 (to about 1e-6). Dot product equals cosine. |
| `dimensions` parameter | Works for 32, 128, 256, 512, 1024. Above 1024 it returns HTTP 400: `dimensions 2048 exceeds embedding length 1024`. A 256-dimension result equals the first 256 values of the full vector, renormalized (dot product 1.0000), so the model is Matryoshka-style and the stored full vector can be sliced and renormalized later. |
| Model context length | **32768** (`/api/show`: `qwen3.context_length`). |
| Context the server actually allows by default | **About 4,096 tokens.** 4,052 tokens succeeded; the next step (about 4,100) returned HTTP 400 `the input length exceeds the context length`. With `truncate: true` an oversized input returned 4,095 tokens. |
| Raising it | `options: { num_ctx: 8192 }` and `num_ctx: 32768` both accepted an input of about 8,000 tokens. Not needed if CV chunks stay short. |
| Determinism | The same input twice gives dot product 1.0000. A string embedded alone equals the same string embedded inside a batch. |
| Empty input | `""` on its own, and `[]`, return **zero** embeddings (HTTP 200, no error). `["alpha", "", "gamma"]` and `["alpha", " ", "gamma"]` each returned 3 vectors. A single space alone returns 1. Guard: assert `embeddings.length === input.length` and skip blank chunks before the call. |
| Licence | `/api/show` returns an empty `license`. Still unconfirmed; check the Qwen3-Embedding repo before production use. |
| Speed (this machine, hardware not recorded) | One 1,500-token chunk: 46 ms. A batch of 64 short chunks (694 tokens in total): 516 ms. About 8,000 tokens: 2.5 s. |
| Postgres vs MySQL | Requirement "Experience with PostgreSQL" vs CV lines: Postgres 0.779, MySQL 0.685, unrelated 0.397. As `layers.md` says, related technologies score close, so the score is advisory and never verifies a Requirement. |

### Instruction prefix (query side)

Five requirements against eight invented CV paragraphs, one correct paragraph each. All variants ranked the correct paragraph first (5/5). The margin between the correct paragraph and the best wrong one:

| Variant | Margins per requirement |
|---|---|
| No instruction | 0.220, 0.163, 0.347, 0.238, 0.211 |
| `Instruct: Given a job requirement, retrieve resume passages that satisfy it\nQuery:<req>` | 0.314, 0.197, 0.355, 0.344, 0.301 |
| Same, with a space after `Query:` | 0.315, 0.193, 0.359, 0.349, 0.302 |
| Qwen's web-search style instruction | 0.325, 0.241, 0.341, 0.330, 0.305 |
| Short: `Find the CV section that shows this skill` | 0.270, 0.226, 0.350, 0.317, 0.289 |

The instruction widened the margin in every case, most for the weaker ones. Whitespace after `Query:` made no difference. A separate first run, with only two requirements and three paragraphs, showed the instruction narrowing one margin ("Has managed a team of five or more engineers" against a retail manager paragraph: 0.588 vs 0.508 without, 0.477 vs 0.480 with). One small set cannot decide this. Re-test with real CVs (see "Evaluation plan") before fixing the wording. The Qwen3-Embedding repo (https://github.com/QwenLM/Qwen3-Embedding) is still the source for the official template; it has not been read yet.

## Open (production)

1. **Where embeddings are computed in production** (`layers.md` open decision 5). The API runs on Cloud Run with a single instance, so Ollama cannot live inside the API process the way an in-process library could. Options to weigh: a separate small CPU service running Ollama; a hosted API (a different model, so different vectors, and CV text leaves our infrastructure, a data-protection decision); or a hosted provider that serves the same Qwen3-Embedding model. Not researched yet.
2. **Vector storage** (`layers.md` open decision 6). Leaning toward a plain `real[]` or `jsonb` column with dot product in application code, since a Job's pool is hundreds of rows. At 1024 dimensions a vector is about 4 KB as 32-bit floats (about 1 KB at 256 dimensions, if `dimensions` is used). pgvector would need a different dev image than `postgres:17`, and Prisma 8 support is unchecked (`apps/api/prisma-8.md`; the repo's Prisma skill mentions a pgvector extension).
3. **Dev/production model parity.** If production uses a different model, the ranking-quality checks done against `qwen3-embedding:0.6b` do not carry over, and all stored vectors must be re-embedded at the switch.
4. **Licence** of the model (see above).

## Evaluation plan

Compare candidate models and instruction wordings on 10 to 20 real CVs and a few real Requirements, ranked by dot product, against what the owner would expect. Public leaderboards are a poor guide for this narrow, English-only data. Real CVs stay out of git (see the commit `chore: ignore real CVs used for manual parser testing`).

## Measured on 2026-11-08 (second run): keyword vs sentence, and level words

Same setup as above (local Ollama, `qwen3-embedding:0.6b`, dot product). Six invented CV chunks, five phrasings of one Requirement, with and without the instruction prefix. The script was throwaway and is not in the repo. Invented text, one run: an indication only.

Scores against each chunk (strong = four years of tuning Postgres; beginner = a course and a hobby app; skills = a list that includes "Postgres"):

| Requirement phrasing | prefix | strong | beginner | skills list | MySQL | React | retail |
|---|---|---|---|---|---|---|---|
| `Postgres` | no | 0.681 | 0.658 | 0.518 | 0.661 | 0.397 | 0.341 |
| `Postgres` | yes | 0.675 | 0.681 | 0.548 | 0.540 | 0.363 | 0.287 |
| `Experience with PostgreSQL` | no | 0.723 | 0.712 | 0.558 | 0.668 | 0.399 | 0.372 |
| `Experience with PostgreSQL` | yes | 0.727 | 0.724 | 0.546 | 0.589 | 0.317 | 0.330 |
| `Has intermediate Postgres experience` | no | 0.614 | 0.677 | 0.568 | 0.576 | 0.404 | 0.373 |
| `Has intermediate Postgres experience` | yes | 0.659 | 0.672 | 0.533 | 0.555 | 0.345 | 0.342 |
| `Has run Postgres in production` | yes | 0.722 | 0.710 | 0.540 | 0.613 | 0.351 | 0.340 |

What it suggests:
- A bare keyword without the prefix barely separates Postgres from MySQL (0.681 against 0.661). The prefix is what pushes MySQL away (0.675 against 0.540), more than the choice of keyword or sentence.
- A short topic sentence ("Experience with PostgreSQL") with the prefix gave the widest margin over MySQL (0.727 against 0.589).
- Level words did not work. "Intermediate" scored the beginner chunk at or above the strong one in both runs (0.677 against 0.614 without the prefix, 0.672 against 0.659 with it), and it lowered the strong chunk's score. In every row the strong and beginner chunks are within about 0.03 of each other except that one.
- So embeddings rank by topic, not by depth. Seniority belongs in a Layer 1 rule on a number question (years) or in Layer 4.

Do not generalize from one invented set. Re-test on real CVs (Evaluation plan).

## URGENT: cutoff testing (added 2026-11-08)

The strong and weak cutoffs (strong at 0.65 and above, weak below 0.50, with 0.50 to 0.65 as "related but unsure") come from two small runs on invented text. Relevant chunks scored 0.65 to 0.73 and unrelated ones 0.28 to 0.40, but related-technology and beginner-level chunks landed in between, and the 0.6b model's spread may differ on real CVs. Before the labels ship:

1. Collect 10 to 20 real CVs and a few real Requirements (CVs stay out of git).
2. For each Requirement, have the owner mark which CVs clearly satisfy it, clearly do not, and are borderline.
3. Check where the scores of each group fall, and move the cutoffs until the labels match the owner's marks. Record the overlap, because some will overlap.
4. Repeat the check after any change of model or instruction prefix; cutoffs do not carry over between models.
