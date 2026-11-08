import { describe, expect, it } from "vitest";
import {
  CHUNK_OVERLAP_CHARS,
  CHUNK_SIZE_CHARS,
  NICE_TO_HAVE_WEIGHT,
  REQUIREMENT_QUERY_INSTRUCTION,
  SCORE_STRONG_MIN,
  SCORE_WEAK_MAX,
  bandOf,
  chunkCvText,
  scoreApplication,
  type EmbeddedVector,
} from "./embedding-match.js";

const M = "model-a";
const vec = (vector: number[], model = M): EmbeddedVector => ({
  model,
  vector,
});

describe("scoreApplication", () => {
  // Unit vectors in 2 dimensions, so the dot products are known by hand.
  const A = vec([1, 0]);
  const B = vec([0, 1]);
  const chunks = [vec([0, 1]), vec([0.6, 0.8]), vec([0.8, 0.6])];
  const must = (id: string) => ({ id, tier: "must_have" as const });
  const nice = (id: string) => ({ id, tier: "nice_to_have" as const });

  it("scores a Requirement by its best chunk", () => {
    // dot(A, chunks) = 0, 0.6, 0.8 -> 0.8; dot(B, chunks) = 1, 0.8, 0.6 -> 1
    const result = scoreApplication({ a: A, b: B }, chunks, [
      must("a"),
      must("b"),
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.requirements.a).toBeCloseTo(0.8, 10);
    expect(result.requirements.b).toBeCloseTo(1, 10);
  });

  it("picks the best chunk even when every dot product is negative", () => {
    const result = scoreApplication(
      { a: A },
      [vec([-0.8, 0.6]), vec([-0.6, 0.8])],
      [must("a")],
    );
    if (!result.ok) throw new Error("expected ok");
    expect(result.requirements.a).toBeCloseTo(-0.6, 10);
  });

  it("weights a must-have 1 and a nice-to-have 0.1 in the overall number", () => {
    // (1 * 0.8 + 0.1 * 1) / 1.1
    const result = scoreApplication({ a: A, b: B }, chunks, [
      must("a"),
      nice("b"),
    ]);
    if (!result.ok) throw new Error("expected ok");
    expect(result.overall).toBeCloseTo(0.9 / 1.1, 10);
  });

  it("is the plain mean when every Requirement is a must-have", () => {
    const result = scoreApplication({ a: A, b: B }, chunks, [
      must("a"),
      must("b"),
    ]);
    if (!result.ok) throw new Error("expected ok");
    expect(result.overall).toBeCloseTo(0.9, 10);
  });

  it("counts a weak nice-to-have for much less than a weak must-have", () => {
    // a scores 0.8, b scores 1 but is nice-to-have: overall stays close to a. Swapped tiers differ.
    const niceB = scoreApplication({ a: A, b: B }, chunks, [
      must("a"),
      nice("b"),
    ]);
    const niceA = scoreApplication({ a: A, b: B }, chunks, [
      nice("a"),
      must("b"),
    ]);
    if (!niceB.ok || !niceA.ok) throw new Error("expected ok");
    expect(niceB.overall).toBeLessThan(niceA.overall!);
  });

  it("ignores vectors of Requirements that are not in the list", () => {
    const result = scoreApplication({ a: A, b: B }, chunks, [must("a")]);
    if (!result.ok) throw new Error("expected ok");
    expect(Object.keys(result.requirements)).toEqual(["a"]);
    expect(result.overall).toBeCloseTo(0.8, 10);
  });

  it("returns no overall number for an empty Requirement list, and does not fail", () => {
    expect(scoreApplication({}, chunks, [])).toEqual({
      ok: true,
      overall: null,
      requirements: {},
    });
    expect(scoreApplication({}, [], [])).toEqual({
      ok: true,
      overall: null,
      requirements: {},
    });
  });

  it("refuses a CV with no chunks instead of returning a number", () => {
    expect(scoreApplication({ a: A }, [], [must("a")])).toEqual({
      ok: false,
      reason: "no_chunks",
    });
  });

  it("refuses a Requirement with no vector", () => {
    expect(scoreApplication({ a: A }, chunks, [must("a"), must("b")])).toEqual({
      ok: false,
      reason: "missing_requirement_vector",
    });
  });

  it("refuses to compare vectors of different models", () => {
    const result = scoreApplication(
      { a: A },
      [vec([1, 0], "model-b")],
      [must("a")],
    );
    expect(result).toEqual({ ok: false, reason: "model_mismatch" });
  });

  it("refuses a model mismatch among the chunks themselves", () => {
    const result = scoreApplication(
      { a: A },
      [vec([1, 0]), vec([1, 0], "model-b")],
      [must("a")],
    );
    expect(result).toEqual({ ok: false, reason: "model_mismatch" });
  });

  it("refuses a model mismatch among the Requirement vectors themselves", () => {
    const result = scoreApplication(
      { a: A, b: vec([0, 1], "model-b") },
      chunks,
      [must("a"), must("b")],
    );
    expect(result).toEqual({ ok: false, reason: "model_mismatch" });
  });

  it("refuses to compare vectors of different lengths", () => {
    const result = scoreApplication({ a: A }, [vec([1, 0, 0])], [must("a")]);
    expect(result).toEqual({ ok: false, reason: "length_mismatch" });
  });

  it("refuses a length mismatch among the chunks themselves", () => {
    const result = scoreApplication(
      { a: A },
      [vec([1, 0]), vec([1, 0, 0])],
      [must("a")],
    );
    expect(result).toEqual({ ok: false, reason: "length_mismatch" });
  });
});

describe("placeholder constants", () => {
  it("are the values the spec names", () => {
    expect(NICE_TO_HAVE_WEIGHT).toBe(0.1);
    expect(SCORE_STRONG_MIN).toBe(0.65);
    expect(SCORE_WEAK_MAX).toBe(0.5);
    expect(REQUIREMENT_QUERY_INSTRUCTION).toBe(
      "Instruct: Given a job requirement, retrieve resume passages that satisfy it\nQuery:",
    );
  });
});

describe("bandOf", () => {
  it.each([
    [0.65, "strong"],
    [0.6500001, "strong"],
    [0.9, "strong"],
    [1, "strong"],
    [0.6499999, "related"],
    [0.6, "related"],
    [0.5, "related"],
    [0.4999999, "weak"],
    [0.3, "weak"],
    [0, "weak"],
    [-0.2, "weak"],
  ] as const)("puts %s in %s", (score, band) => {
    expect(bandOf(score)).toBe(band);
  });
});

/**
 * Layer 3 (embedding match) scoring maths (.scratch/candidate-matching/layer3-spec.md "Shared",
 * ticket 02). Seams: chunkCvText, scoreApplication, bandOf. No model, no database.
 */

describe("chunkCvText", () => {
  it("uses about 400 tokens of window and 50 of overlap, at about 4 characters a token", () => {
    expect(CHUNK_SIZE_CHARS).toBe(1600);
    expect(CHUNK_OVERLAP_CHARS).toBe(200);
  });

  it("cuts windows of the window size, each starting one step after the last", () => {
    const chunks = chunkCvText("x".repeat(4000));
    // step = 1600 - 200 = 1400: windows start at 0, 1400, 2800
    expect(chunks.map((chunk) => chunk.length)).toEqual([1600, 1600, 1200]);
  });

  it("overlaps neighbouring windows by the overlap size", () => {
    const text = Array.from({ length: 4000 }, (_, i) =>
      String.fromCharCode(97 + (i % 26)),
    ).join("");
    const [first, second] = chunkCvText(text);
    expect(first!.slice(-CHUNK_OVERLAP_CHARS)).toBe(
      second!.slice(0, CHUNK_OVERLAP_CHARS),
    );
    expect(second).toBe(text.slice(1400, 3000));
  });

  it("returns one chunk for a CV shorter than a window", () => {
    expect(chunkCvText("Senior engineer, Postgres.")).toEqual([
      "Senior engineer, Postgres.",
    ]);
  });

  it("returns one chunk for a CV exactly one window long, with no trailing sliver", () => {
    expect(chunkCvText("y".repeat(CHUNK_SIZE_CHARS))).toHaveLength(1);
  });

  it("keeps a short tail window that holds text past the previous window", () => {
    // 1700 characters: the second window starts at 1400 and holds 300.
    const chunks = chunkCvText("z".repeat(1700));
    expect(chunks.map((chunk) => chunk.length)).toEqual([1600, 300]);
  });

  it("returns no chunks for empty or whitespace-only text", () => {
    expect(chunkCvText("")).toEqual([]);
    expect(chunkCvText(" \n\t  ")).toEqual([]);
  });

  it("drops a blank window in the middle of a text", () => {
    const text = "a".repeat(1400) + " ".repeat(1600) + "b".repeat(5);
    // [0,1600) = a*1400 + 200 spaces; [1400,3000) = spaces only (dropped); [2800,3005) = 200 spaces + b*5
    const chunks = chunkCvText(text);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.startsWith("a")).toBe(true);
    expect(chunks[1]!.endsWith("bbbbb")).toBe(true);
  });

  it("never splits a character made of two UTF-16 units across a window edge", () => {
    const text = "a".repeat(1599) + "😀" + "b".repeat(10);
    const chunks = chunkCvText(text);
    expect(chunks.length).toBeGreaterThan(1);
    // A lone surrogate is a half of a pair; the package's lib predates String.isWellFormed.
    const loneSurrogate =
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
    for (const chunk of chunks) expect(chunk).not.toMatch(loneSurrogate);
  });
});
