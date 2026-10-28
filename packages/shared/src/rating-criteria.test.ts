import { describe, expect, it } from 'vitest';
import { saveRatingCriteriaSchema } from './jobs.js';
import {
  RATING_CRITERIA,
  RATING_CRITERIA_LIMIT,
  RATING_MAX,
  RATING_MIN,
  ratingCriteriaKeysSchema,
} from './rating-criteria.js';

/*
 * The Criteria catalog and the 1 to 5 rule (.scratch/ratings/spec.md, "Concept and rules").
 */

describe('the Criteria catalog', () => {
  // Append-only: a key is never removed or renamed (see rating-criteria.ts). This list is the spec's,
  // written out by hand. Add to it when the catalog grows; never edit a line.
  const shipped = [
    ['technical_skills', 'Technical skills'],
    ['problem_solving', 'Problem solving'],
    ['communication', 'Communication'],
    ['culture_fit', 'Culture fit'],
    ['leadership', 'Leadership'],
    ['relevant_experience', 'Relevant experience'],
  ] as const;

  it('has exactly the six shipped keys, in this order, with their labels', () => {
    expect(RATING_CRITERIA).toEqual(shipped.map(([key, label]) => ({ key, label })));
  });

  it('allows five Criteria per Job and scores from 1 to 5', () => {
    expect(RATING_CRITERIA_LIMIT).toBe(5);
    expect(RATING_MIN).toBe(1);
    expect(RATING_MAX).toBe(5);
  });
});

describe('ratingCriteriaKeysSchema', () => {
  it('accepts a list of catalog keys, including the empty list and five keys', () => {
    expect(ratingCriteriaKeysSchema.safeParse([]).success).toBe(true);
    expect(ratingCriteriaKeysSchema.safeParse(['culture_fit', 'technical_skills']).success).toBe(true);
    expect(
      ratingCriteriaKeysSchema.safeParse([
        'technical_skills',
        'problem_solving',
        'communication',
        'culture_fit',
        'leadership',
      ]).success,
    ).toBe(true);
  });

  it('refuses more than five keys', () => {
    const six = RATING_CRITERIA.map((criterion) => criterion.key);
    expect(six).toHaveLength(6);
    expect(ratingCriteriaKeysSchema.safeParse(six).success).toBe(false);
  });

  it('refuses a key twice', () => {
    expect(ratingCriteriaKeysSchema.safeParse(['culture_fit', 'culture_fit']).success).toBe(false);
  });

  it('refuses a key that is not in the catalog, and anything that is not a list of strings', () => {
    expect(ratingCriteriaKeysSchema.safeParse(['culture_fit', 'punctuality']).success).toBe(false);
    expect(ratingCriteriaKeysSchema.safeParse([1]).success).toBe(false);
    expect(ratingCriteriaKeysSchema.safeParse('culture_fit').success).toBe(false);
    expect(ratingCriteriaKeysSchema.safeParse(undefined).success).toBe(false);
  });
});

describe('saveRatingCriteriaSchema', () => {
  it('takes { keys } and nothing else', () => {
    expect(saveRatingCriteriaSchema.safeParse({ keys: ['culture_fit'] }).success).toBe(true);
    expect(saveRatingCriteriaSchema.safeParse({ keys: [] }).success).toBe(true);
    expect(saveRatingCriteriaSchema.safeParse({ keys: ['culture_fit'], extra: true }).success).toBe(false);
    expect(saveRatingCriteriaSchema.safeParse({}).success).toBe(false);
  });

  it('refuses an unknown key', () => {
    expect(saveRatingCriteriaSchema.safeParse({ keys: ['punctuality'] }).success).toBe(false);
  });
});
