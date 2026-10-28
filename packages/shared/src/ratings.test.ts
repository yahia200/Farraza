import { describe, expect, it } from 'vitest';
import { checkRatingCriteria, saveRatingSchema, summariseRatings } from './ratings.js';

/*
 * Ratings (.scratch/ratings/spec.md, "Concept and rules"): the request body that gives or replaces a
 * Member's Rating, the check against the Job's Criteria, and the summary.
 */

describe('saveRatingSchema', () => {
  it('accepts an overall rating of 1 and of 5, with or without Criteria', () => {
    expect(saveRatingSchema.safeParse({ overall: 1 }).success).toBe(true);
    expect(saveRatingSchema.safeParse({ overall: 5 }).success).toBe(true);
    expect(saveRatingSchema.safeParse({ overall: 3, criteria: {} }).success).toBe(true);
  });

  it('keeps the parsed value as sent', () => {
    expect(saveRatingSchema.parse({ overall: 4, criteria: { culture_fit: 2, leadership: null } })).toEqual({
      overall: 4,
      criteria: { culture_fit: 2, leadership: null },
    });
  });

  it.each([0, 6, 3.5, -1, '3', null, Number.NaN, Number.POSITIVE_INFINITY, undefined])(
    'refuses %j as the overall rating',
    (overall) => {
      expect(saveRatingSchema.safeParse({ overall }).success).toBe(false);
    },
  );

  it('requires the overall rating', () => {
    expect(saveRatingSchema.safeParse({}).success).toBe(false);
    expect(saveRatingSchema.safeParse({ criteria: { culture_fit: 3 } }).success).toBe(false);
  });

  it('accepts a Criterion score of 1 to 5, and null to clear it', () => {
    expect(saveRatingSchema.safeParse({ overall: 3, criteria: { culture_fit: 1, leadership: 5 } }).success).toBe(true);
    expect(saveRatingSchema.safeParse({ overall: 3, criteria: { culture_fit: null } }).success).toBe(true);
  });

  it.each([0, 6, 3.5, '3', true])('refuses %j as a Criterion score', (score) => {
    expect(saveRatingSchema.safeParse({ overall: 3, criteria: { culture_fit: score } }).success).toBe(false);
  });

  it('refuses a Criterion that is not in the catalog', () => {
    expect(saveRatingSchema.safeParse({ overall: 3, criteria: { punctuality: 3 } }).success).toBe(false);
  });

  it('refuses unknown keys on the body, and a criteria value that is not an object', () => {
    expect(saveRatingSchema.safeParse({ overall: 3, userId: 'someone-else' }).success).toBe(false);
    expect(saveRatingSchema.safeParse({ overall: 3, criteria: ['culture_fit'] }).success).toBe(false);
    expect(saveRatingSchema.safeParse({ overall: 3, criteria: null }).success).toBe(false);
  });
});

describe('checkRatingCriteria', () => {
  const selected = ['technical_skills', 'culture_fit'];

  it('accepts scores for Criteria the Job uses, unchanged, null included', () => {
    expect(checkRatingCriteria({ culture_fit: 4, technical_skills: null }, selected)).toEqual({
      ok: true,
      criteria: { culture_fit: 4, technical_skills: null },
    });
  });

  it('accepts no scores at all, and a skipped Criterion', () => {
    expect(checkRatingCriteria({}, selected)).toEqual({ ok: true, criteria: {} });
    expect(checkRatingCriteria({}, [])).toEqual({ ok: true, criteria: {} });
    expect(checkRatingCriteria({ culture_fit: 2 }, selected)).toEqual({ ok: true, criteria: { culture_fit: 2 } });
  });

  it('names each Criterion the Job does not use, with its key as the path', () => {
    expect(checkRatingCriteria({ culture_fit: 4, leadership: 3, communication: 5 }, selected)).toEqual({
      ok: false,
      errors: [
        { path: 'leadership', message: "This criterion isn't used for this job. Reload the page and try again." },
        { path: 'communication', message: "This criterion isn't used for this job. Reload the page and try again." },
      ],
    });
  });

  it('refuses a score for any Criterion when the Job uses none, a null (clear) included', () => {
    expect(checkRatingCriteria({ leadership: null }, [])).toEqual({
      ok: false,
      errors: [
        { path: 'leadership', message: "This criterion isn't used for this job. Reload the page and try again." },
      ],
    });
  });
});

describe('summariseRatings', () => {
  it('gives a count of 0 and no average for no ratings', () => {
    expect(summariseRatings([])).toEqual({ count: 0, average: null, criteria: {} });
  });

  it('averages the overall ratings, without rounding', () => {
    expect(summariseRatings([{ overall: 5, criteria: {} }])).toEqual({ count: 1, average: 5, criteria: {} });
    const summary = summariseRatings([
      { overall: 5, criteria: {} },
      { overall: 4, criteria: {} },
      { overall: 4, criteria: {} },
    ]);
    expect(summary.count).toBe(3);
    expect(summary.average).toBeCloseTo(13 / 3, 10);
    expect(summary.average).not.toBe(4.3);
  });

  it('ignores the Criteria when averaging the overall rating', () => {
    const summary = summariseRatings([
      { overall: 2, criteria: { culture_fit: 5, leadership: 5 } },
      { overall: 4, criteria: { culture_fit: 5 } },
    ]);
    expect(summary.average).toBe(3);
  });

  it('averages a Criterion over the Members who scored it only', () => {
    const summary = summariseRatings([
      { overall: 3, criteria: { culture_fit: 4, leadership: 2 } },
      { overall: 3, criteria: { culture_fit: 5 } },
      { overall: 3, criteria: {} },
    ]);
    expect(summary.count).toBe(3);
    expect(summary.criteria).toEqual({
      culture_fit: { count: 2, average: 4.5 },
      leadership: { count: 1, average: 2 },
    });
  });

  it('leaves out a Criterion nobody scored, a cleared (null) score included', () => {
    const summary = summariseRatings([
      { overall: 3, criteria: { culture_fit: null } },
      { overall: 4, criteria: { culture_fit: null, communication: 3 } },
    ]);
    expect(summary.criteria).toEqual({ communication: { count: 1, average: 3 } });
    expect(summary.criteria).not.toHaveProperty('culture_fit');
  });
});
