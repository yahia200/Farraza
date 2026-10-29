Status: draft (design notes, not yet a spec)

# Candidate matching: four layers, cheapest first

Related: the auto-reject rules (`findKnockout` in `packages/shared/src/answers.ts`, the rule properties in `packages/shared/src/form-fields.ts`), the Rating Criteria spec (`.scratch/ratings/spec.md`, the pattern a Job-level list follows), ADR-0002 (the CV as a built-in form slot, `docs/adr/0002-cv-as-built-in-form-slot.md`), `docs/db-schema.md` (§3.5 `jobs`, the files table, line 288 on a future CV parse table), and the glossary entries **Rating**, **Criterion**, **Average rating** and the auto-reject rule (`GLOSSARY.md`).

## Problem

A job can attract hundreds of Applications and a reviewer opens them one by one. The team wants help sorting them, and the help has to be cheap enough to run on every Job without a second thought. A model call per candidate is the obvious answer and the most expensive one, so this doc layers the options: do the free things first, and spend money only on the candidates and moments where it changes a decision.

Every layer here is **advisory except Layer 1's auto-reject**. Nothing in Layers 2 to 4 moves an Application, rejects it or notifies anyone. They add flags, a sort order and explanations that a human reads.

## The layers at a glance

| Layer | What it does | Marginal cost per candidate | New infrastructure |
|---|---|---|---|
| 1. Rules | Exact checks on typed form answers. Can reject, flag or move. | $0 | None. Extends what exists. |
| 2. Keyword match | Checks that the CV and text answers mention each requirement's terms. | $0 | CV text extraction. |
| 3. Embeddings | Ranks candidates by topical similarity between the CV and each requirement. | About $0.00003 hosted, $0 local | Vector storage and a background embed step. |
| 4. LLM | Judges each requirement with a verdict, evidence and a reason. | About $0.001 to $0.05 | An API call per candidate scored. |

Layer 4 is the expensive option. It is meant for minimal situations: the top N candidates, or candidates at one chosen stage. It is never the default for every Application.

## What the layers share

### Requirements

A Job gets a short list of written **Requirements** (this doc uses that word because the glossary already uses **Criterion** for a Rating dimension; the name is still open, see "Open decisions"). Each one is:

- `text`: one plain text box, for example "Has run Postgres in production".
- `tier`: must-have or nice-to-have.
- `questionKey`: either `null` (judged against the CV and all answers) or the key of one form question (judged against that question's answer only).

The list lives on the Job, not on the form field, following `jobs.rating_criteria` and `jobs.highlighted_question_keys`: a `jsonb` array saved by one unconditional replace. Reasons: published form versions are immutable, so a requirement on a field would force a new version for every reworded sentence; and the apply page serves the form's fields, so keeping the rubric off them means it cannot reach an applicant. Question keys are stable across versions (`docs/db-schema.md`, the `key` row of the field table), which is what lets a Job-level list point at a question.

### CV text

Layers 2 to 4 all need the CV as text. Today a CV is a PDF or DOCX file and nothing parses it (`docs/db-schema.md` line 288: "A later parse table would reference the CV's row"). A parse step stores the extracted text once, keyed to the CV's file row, and every layer reads that. Two cases need handling rather than silence:

- **No text layer** (a scanned PDF): record "unreadable" and show that to the reviewer. A requirement must never read as "missing" because the extraction failed.
- **Empty or very short result**: treat the same way.

### Language

CVs are English only (the owner confirmed there are no Arabic CVs). No layer handles right-to-left text, Arabic or mixed-language documents: keywords are given in English, and Layer 3 can use an English-only embedding model. If that changes, Layer 2's terms and Layer 3's model choice are the two places to revisit.

### Never on protected attributes

A free-text Requirement or a rule on a date could be used to filter on age, gender, nationality, religion and similar. The editor should say so in helper text, and Layer 1 should not offer a date-of-birth rule. Whether to add a blocklist or a warning, and the legal review, are open decisions.

## Layer 1: rules (expand the auto-reject rules)

### Today

The auto-reject rules cover two of the ten question types, and only the "reject" outcome:

| Type | Rule today |
|---|---|
| `yes_no` | `rejectWhen`: `true`, `false` or `null`. |
| `single_select` | `rejectOptionIds`: reject when the chosen option is in the list. |
| `short_text`, `long_text`, `multi_select`, `number`, `date`, `url`, `file`, `repeating_group` | None. |

`findKnockout` runs server-side on submit and the first match places the Application in the Rejected stage. A sub-question inside a repeating group cannot carry a rule (`parseFormFields` refuses it), and `findKnockout` ignores groups. The rule properties live in each field's `config` inside the form version, and `toPublicFields` strips them before applicants see the form.

### Expansion: more types, finer conditions

Each row below is a candidate rule. All are exact comparisons on a typed answer, so they cost nothing and can be explained in one sentence ("rejected because years of experience was 2, minimum 5").

| Type | Conditions to offer |
|---|---|
| `single_select` | Reject if the answer is in a set (today). Also: **accept-list**, reject unless the answer is in a set. |
| `multi_select` | **Any-of**: reject if any selected option is in a set. **None-of-required**: reject unless at least one of a set is selected. **All-of**: reject unless every option in a set is selected. |
| `yes_no` | As today. |
| `number` | Below a minimum, above a maximum, or outside a range. This is separate from the field's own `min`/`max`, which only validate input. |
| `date` | Before or after a fixed date. Relative to the submission date, for example "available within 60 days" (`Temporal.PlainDate`, as `dates.ts` already uses). No date-of-birth rules. |
| `url` | Present or absent; optionally the host must be in an allow-list (for example a profile link on a given site). Low value, so last on the list. |
| `short_text`, `long_text` | Only length or presence checks here. Anything about the content belongs to Layer 2. |
| `repeating_group` | **Entry count** at least N. **Total duration** at least N months, summed over the entries of the `experience` preset from its start and end dates. **Any entry** whose sub-answer matches (a title containing a word, a level in a set). Needs the Preset keys; a rule must look inside the group that carries the matching group key, not anywhere on the form (`docs/db-schema.md`, Preset keys). |
| `file` | Presence is already `required`. No rule. |

### Expansion: more outcomes, not just reject

Auto-reject is a blunt outcome for a soft condition. Each rule should choose one:

| Outcome | Effect |
|---|---|
| Reject | Place in Rejected (today). Recorded as an auto-reject event. |
| Flag | Leave the Application where it is and show an "unmet requirement" marker on the card, the table row and the sheet, with the reason. |
| Move to stage | Place in a chosen non-final stage (for example Screening), for conditions that mean "look at this first". |

A rule can also carry the Requirement's tier: a must-have that fails flags more loudly than a nice-to-have.

### Where rules live

Today a rule is part of the form version. More rule types mean more edits to published forms, and each edit is a new version. The alternative is a Job-level list keyed by question key (the same place as the Requirements). That is a decision, see "Open decisions". Either way, `findKnockout` stays server-side only and `toPublicFields` must keep stripping rules.

## Layer 2: keyword match

### What it does

For each Requirement, check whether the CV text and the relevant text answers contain the Requirement's **terms**. The output per Requirement is matched or not matched, plus the terms that matched, so a reviewer sees why. A must-have with no match raises a flag. It never rejects.

### Where the terms come from

- **Manager-supplied (recommended).** Each Requirement can list keywords and synonyms beside its text, for example "Postgres, PostgreSQL, psql". It is deterministic, explainable and the manager controls it.
- **Auto-extracted.** Pull the nouns from the Requirement's text. Cheaper for the manager, noisier for everyone.

### How it matches

- **App code.** Case-insensitive, whole-word matching with a little normalisation (plurals, punctuation). No new dependency and no schema change.
- **Postgres full-text search.** Built in, handles stemming and ranking (documented at https://www.postgresql.org/docs/current/textsearch.html). I have not opened that page this session, and I have not checked that the Prisma 8 contract can express a `tsvector` column. Treat it as an option to verify, not a plan.

### Limits

- Synonyms and misspellings it was not told about.
- Negation and context: "no experience with Postgres" matches "Postgres".
- Failed extraction, covered above.

For must-haves this is more reliable than an embedding, which is why it sits below Layer 1 and above Layer 3.

## Layer 3: embeddings

### What it does

Turn the CV text and each Requirement into vectors with a text embedding model and compare them by cosine similarity. The result is a **Best match** sort on the candidate list and, per Requirement, a "strong or weak" indication. It measures how on-topic a CV is. It does not verify that a Requirement is met: "Postgres" and "MySQL" land close together. So it is advisory, and it never auto-rejects, partly because embeddings pick up proxies such as school names.

### What gets embedded

- Once per Application, on CV upload or submit, in the background: the CV text. For a long CV, embed it in chunks (by section) and score a Requirement by its best chunk.
- Once per Job, when the manager saves it: each Requirement's text.
- Optionally the text answers to questions that have a question-level Requirement. Choice, number and date answers are not embedded; Layer 1 handles those exactly.
- Scoring is cosine over the stored vectors in application code: no API call, so re-ranking after a Requirement edit is free (only the changed Requirement is re-embedded).
- Store the model id beside each vector. Vectors from different models cannot be compared, so a model change means re-embedding.

### Hosted options

Prices are per million input tokens and come from a web search, not from the providers' pages, except where noted. Check the live pricing before budgeting.

| Model | Price | Note |
|---|---|---|
| OpenAI `text-embedding-3-small` | $0.02 | Confirmed on OpenAI's model page: https://developers.openai.com/api/docs/models/text-embedding-3-small |
| Voyage 3.5 lite | $0.02 | Third-party aggregators only. |
| Voyage 3.5 | $0.06 | Third-party aggregators only. |

At about 1,500 tokens per CV, that is roughly $0.00003 to $0.00009 per candidate, or $0.03 to $0.09 per 1,000 candidates. As far as I know Anthropic offers no embedding model of its own, so this is a second provider. A hosted API means CV content goes to a third party, which is a data-protection decision.

### Local options

A local model removes the per-call cost and keeps CVs in-house. The cost moves to the host.

- **How.** Run an open embedding model inside the API process with ONNX Runtime or `@huggingface/transformers` (transformers.js), or as a small separate inference service. I have not checked either library's current API; read the installed docs before using one.
- **Candidate models.** Small English sentence-embedding models such as `all-MiniLM-L6-v2` and `bge-small-en-v1.5`. These names and their sizes are from memory: confirm dimensions, input-length limit and licence on each model card. Small models often cap input at a few hundred tokens, so chunking is needed. Because CVs are English only (see "Language" above), an English-only model is enough and a multilingual one is not needed.
- **Costs to weigh.** Model files add image size and memory; a cold start has to load the model; CPU inference is slower than an API call; the API runs on Cloud Run with a single instance (`.claude/rules/api.md`), so inference would compete with request handling unless it is a background job or a separate service; quality is usually below the larger hosted models.
- **When it pays off.** The hosted price is already a few cents per thousand candidates, so a local model saves little money. The reasons to choose it are data residency and avoiding a second provider.

### Storage

A plain `jsonb` or `real[]` column with cosine in app code is enough at this scale, since a Job's pool is hundreds of rows. A 1,024-dimension vector is about 4 KB as 32-bit floats; a 384-dimension one is about 1.5 KB. pgvector would need a different dev image than `postgres:17` in `docker-compose.yml`, and I have not checked whether the Prisma 8 contract supports a vector type (`apps/api/prisma-8.md` is the place to check). A hosted vector database is not justified.

## Layer 4: LLM scoring (expensive, use with care)

### What it does

For one candidate, give a language model the Job's Requirements, the CV text and the relevant answers, and ask for a structured verdict per Requirement (met, partly met, not met, unknown), a short quote from the CV or answer as evidence, a one-line reason, and an overall summary. It is the only layer that can say whether a Requirement is actually satisfied. It is also the only layer that costs real money per candidate and that sends the full application text to a model provider.

### Cost

Estimates for about 4,500 input tokens and 1,500 output tokens per candidate (the output includes reasoning tokens, which are billed as output). Prices are the per-million-token rates in the Claude API skill's model table, cached 2026-10-06; check live pricing.

| Model | Per candidate | Top 20 of a Job | All 300 applicants |
|---|---|---|---|
| Haiku 5.5 | about $0.001 | about $0.02 | about $0.36 |
| Sonnet 5.5 | about $0.024 | about $0.48 | about $7.20 |
| Opus 5.5 | about $0.048 | about $0.96 | about $14.40 |

Output is the larger share of the cost. The Batch API halves these figures for work that does not need to be instant. Prompt caching helps little, because the shared prefix is only a couple of thousand tokens.

### When to run it

Only in narrow situations, each one a bounded set of candidates:

1. **Top N after Layer 3.** A manager clicks "Score the top N" (N defaults to 10 to 20 and is capped). The shortlist is already ranked by Layers 1 to 3.
2. **At a chosen stage.** Run when an Application enters a stage the manager picks, for example Interview. Only candidates who got that far are scored, so the spend follows the pipeline instead of the applicant count.
3. **On demand for one candidate.** An "Explain this match" button in the candidate sheet.

Never run it on every Application at submit.

### Guardrails

- Manual trigger by default; an automatic stage trigger is a per-Job opt-in.
- Show an estimated cost before a bulk run, and cap runs per Job and per company per month.
- Store the result with the model id and a hash of the Requirement list, and do not rerun unless the manager asks. Editing a Requirement marks results stale instead of re-spending.
- Never auto-reject on it. The output is shown to a reviewer next to the evidence quote so it can be checked.
- Which model, and at what effort, is a measured decision: score a small hand-labelled sample with Haiku 5.5 and Sonnet 5.5 and compare before picking.
- Decide whether a scoring run writes an `ApplicationEvent`. The audit trail currently records state changes only (`.claude/rules/api.md`, Audit trail), and a score is not one.

## Suggested build order

1. Layer 1 expansion (new rule types, then the flag and move outcomes). No new infrastructure, and the code lives in `@repo/shared` with the existing test seam.
2. The Requirements list on the Job, then CV text extraction, then Layer 2.
3. Layer 3, if Layer 2 does not rank well enough.
4. Layer 4, only if reviewers need explanations, and only behind the triggers above.

## Open decisions

1. **Where Layer 1 rules live:** on the field in the form version (today) or on the Job keyed by question key.
2. **Which outcomes a rule may have:** reject, flag, move; and whether a tier changes how a flag looks.
3. **Name:** "Requirement" (assumed here; not yet checked against `GLOSSARY.md`) versus anything else, and a glossary entry.
4. **Keywords:** manager-supplied, auto-extracted, or both.
5. **Embedding source:** hosted API, local model, or none.
6. **Vector storage:** plain column with app-code cosine, or pgvector (needs a Prisma 8 check).
7. **Layer 4 triggers and model:** top N, stage-triggered, on demand; Haiku 5.5 or Sonnet 5.5, decided by a sample.
8. **Safeguards for free-text Requirements:** helper text only, a warning, or a blocklist, and the legal review of using automated ranking in hiring.
9. **A background job runner:** not checked whether the API has one; Layers 2 to 4 would need it for extraction and embedding.

## Not decided here

Schema, API routes, UI and ticket breakdown. This doc fixes the layering and the cost reasoning; a spec would turn the chosen layers into user stories and vertical slices, as `.scratch/ratings/spec.md` does.
