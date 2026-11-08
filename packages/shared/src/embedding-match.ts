/**
 * Layer 3 (embedding match) scoring maths (.scratch/candidate-matching/layer3-spec.md "Shared",
 * ADR-0008). Pure and server-or-browser safe: no model, no database, no network.
 *
 * EVERY CONSTANT BELOW IS A PLACEHOLDER. The chunk size, overlap, weights and cutoffs were picked
 * from two small runs on invented text (.scratch/candidate-matching/layer3-embeddings-notes.md) and
 * are to be tested on real CVs before any label ships (ticket 12). Cutoffs do not carry over between
 * embedding models or instruction wordings: re-test after changing either.
 */

/** Characters per token. No tokenizer runs here, so windows are measured in characters. Placeholder. */
export const CHARS_PER_TOKEN = 4;
/** Window size in tokens. Placeholder. */
export const CHUNK_SIZE_TOKENS = 400;
/** Overlap between neighbouring windows in tokens. Placeholder. */
export const CHUNK_OVERLAP_TOKENS = 50;
/** Window size in characters (about 400 tokens). Placeholder. */
export const CHUNK_SIZE_CHARS = CHUNK_SIZE_TOKENS * CHARS_PER_TOKEN;
/** Overlap in characters (about 50 tokens). Placeholder. */
export const CHUNK_OVERLAP_CHARS = CHUNK_OVERLAP_TOKENS * CHARS_PER_TOKEN;
/**
 * Stored beside every chunk vector. Bump it whenever `chunkCvText` would cut the same text
 * differently (size, overlap, blank rule), so stale vectors can be told apart. Placeholder.
 */
export const CHUNKER_VERSION = 1;

/**
 * Cuts CV text into fixed-size overlapping windows and drops blank ones. The index of a chunk in the
 * result is its chunk index. Windows are counted in code points, so a character made of two UTF-16
 * units is never split across a window edge. Section-aware chunking is later, and only if the
 * evaluation shows fixed windows score badly.
 */
export function chunkCvText(text: string): string[] {
  const points = Array.from(text);
  const step = CHUNK_SIZE_CHARS - CHUNK_OVERLAP_CHARS;
  const chunks: string[] = [];
  for (let start = 0; start < points.length; start += step) {
    const end = start + CHUNK_SIZE_CHARS;
    const window = points.slice(start, end).join("");
    if (window.trim() !== "") chunks.push(window);
    // The window reached the end of the text: the next one would only repeat the overlap.
    if (end >= points.length) break;
  }
  return chunks;
}

/** Weight of a must-have Requirement in the overall number. */
export const MUST_HAVE_WEIGHT = 1;
/** Weight of a nice-to-have Requirement in the overall number. Placeholder. */
export const NICE_TO_HAVE_WEIGHT = 0.1;

/** A score at or above this is `strong`. Placeholder, to be tested on real CVs (ticket 12). */
export const SCORE_STRONG_MIN = 0.65;
/** A score below this is `weak`. Placeholder, to be tested on real CVs (ticket 12). */
export const SCORE_WEAK_MAX = 0.5;

/**
 * Put before a Requirement's text when it is embedded as a query (documents get none). Provisional
 * wording from the notes file; the Qwen3-Embedding template has not been checked.
 */
export const REQUIREMENT_QUERY_INSTRUCTION =
  "Instruct: Given a job requirement, retrieve resume passages that satisfy it\nQuery:";

/** A stored vector with the model that made it. Its length is `vector.length`. */
export type EmbeddedVector = { model: string; vector: readonly number[] };

/** The part of a Requirement the scorer needs. */
export type ScoredRequirement = {
  id: string;
  tier: "must_have" | "nice_to_have";
};

export type ScoreRefusal =
  | "model_mismatch"
  | "length_mismatch"
  | "missing_requirement_vector"
  | "no_chunks";

export type ApplicationScore =
  | {
      ok: true;
      /** Weighted mean over all Requirements; `null` when there are none (nothing to rank by). */
      overall: number | null;
      /** Requirement id to its best dot product over the CV's chunks. */
      requirements: Record<string, number>;
    }
  | { ok: false; reason: ScoreRefusal };

const weightOf = (tier: ScoredRequirement["tier"]): number =>
  tier === "must_have" ? MUST_HAVE_WEIGHT : NICE_TO_HAVE_WEIGHT;

function dot(a: readonly number[], b: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i]! * b[i]!;
  return sum;
}

/**
 * Scores one Application. A Requirement's score is the best dot product over the CV's chunks (the
 * vectors are L2-normalised by the embedder, so the dot product is the cosine: ADR-0008); the
 * overall number is the mean over all Requirements weighted by tier.
 *
 * Refuses, with a reason and never a number, when the vectors it would compare differ in model or
 * length, when a listed Requirement has no vector, or when the CV has no chunks (a best-of-nothing
 * must not read as a low score). Nothing is stored here: a band is `bandOf` of a score.
 */
export function scoreApplication(
  requirementVectors: Readonly<Record<string, EmbeddedVector>>,
  chunkVectors: readonly EmbeddedVector[],
  requirements: readonly ScoredRequirement[],
): ApplicationScore {
  if (requirements.length === 0)
    return { ok: true, overall: null, requirements: {} };

  const wanted: EmbeddedVector[] = [];
  for (const requirement of requirements) {
    const found = requirementVectors[requirement.id];
    if (!found) return { ok: false, reason: "missing_requirement_vector" };
    wanted.push(found);
  }
  if (chunkVectors.length === 0) return { ok: false, reason: "no_chunks" };

  const first = wanted[0]!;
  const all = [...wanted, ...chunkVectors];
  if (all.some((v) => v.model !== first.model))
    return { ok: false, reason: "model_mismatch" };
  if (all.some((v) => v.vector.length !== first.vector.length)) {
    return { ok: false, reason: "length_mismatch" };
  }

  const scores: Record<string, number> = {};
  let weighted = 0;
  let totalWeight = 0;
  requirements.forEach((requirement, index) => {
    const query = wanted[index]!.vector;
    let best = -Infinity;
    for (const chunk of chunkVectors)
      best = Math.max(best, dot(query, chunk.vector));
    scores[requirement.id] = best;
    const weight = weightOf(requirement.tier);
    weighted += weight * best;
    totalWeight += weight;
  });
  return { ok: true, overall: weighted / totalWeight, requirements: scores };
}

export type MatchBand = "strong" | "related" | "weak";

/**
 * The label for one Requirement's score. Nothing about a band or a threshold is stored: change the
 * constants and every read changes with them.
 */
export function bandOf(score: number): MatchBand {
  if (score >= SCORE_STRONG_MIN) return "strong";
  if (score < SCORE_WEAK_MAX) return "weak";
  return "related";
}
