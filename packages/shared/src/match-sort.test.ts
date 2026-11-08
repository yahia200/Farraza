import { describe, expect, it } from 'vitest';
import { compareMatchSort, matchSortAvailability, matchSortValue } from './match-sort.js';

/*
 * "Sort by score" on the candidate table (embedding-match ticket 10). The card and row carry the
 * overall number `matchScore` and a `matchState` (null with no score row); the number is used for
 * ordering only and is never shown.
 */

describe('matchSortValue', () => {
  it('is the overall score for a scored Application', () => {
    expect(matchSortValue({ matchScore: 0.72, matchState: { status: 'scored' } })).toBe(0.72);
    expect(matchSortValue({ matchScore: 0, matchState: { status: 'scored' } })).toBe(0);
  });

  it('is undefined for one that is scoring, not scored, or has no score row', () => {
    expect(matchSortValue({ matchScore: null, matchState: { status: 'scoring' } })).toBeUndefined();
    expect(
      matchSortValue({
        matchScore: null,
        matchState: { status: 'not_scored', reason: 'cv_unreadable' },
      }),
    ).toBeUndefined();
    expect(matchSortValue({ matchScore: null, matchState: null })).toBeUndefined();
  });

  it('is undefined for a scored Application with no number, rather than a made-up one', () => {
    expect(matchSortValue({ matchScore: null, matchState: { status: 'scored' } })).toBeUndefined();
  });
});

describe('matchSortAvailability', () => {
  const scored = { matchScore: 0.7, matchState: { status: 'scored' } } as const;
  const scoring = {
    matchScore: null,
    matchState: { status: 'scoring' },
  } as const;
  const none = { matchScore: null, matchState: null } as const;

  it('is available when the Job has Requirements and at least one Application is scored', () => {
    expect(matchSortAvailability(2, [none, scored, scoring])).toEqual({
      enabled: true,
    });
  });

  it('is unavailable, with a reason, when the Job has no Requirements', () => {
    expect(matchSortAvailability(0, [scored])).toEqual({
      enabled: false,
      reason: 'Add Requirements in Settings to sort by score.',
    });
  });

  it('is unavailable, with a reason, when nothing is scored yet', () => {
    const nothingScored = {
      enabled: false,
      reason: 'No candidate has a score yet.',
    };
    expect(matchSortAvailability(3, [])).toEqual(nothingScored);
    expect(matchSortAvailability(3, [none, scoring])).toEqual(nothingScored);
  });

  it('gives the missing Requirements as the reason when both apply', () => {
    expect(matchSortAvailability(0, [])).toMatchObject({
      enabled: false,
      reason: expect.stringContaining('Requirements'),
    });
  });
});

describe('compareMatchSort', () => {
  const order = (values: (number | undefined)[]) => [...values].sort(compareMatchSort);

  it('puts the highest score first', () => {
    expect(order([0.4, 0.9, 0.6])).toEqual([0.9, 0.6, 0.4]);
  });

  it('puts Applications with no score last, whatever the scored ones are', () => {
    expect(order([undefined, 0.2, undefined, 0.8])).toEqual([0.8, 0.2, undefined, undefined]);
    expect(order([undefined, 0])).toEqual([0, undefined]);
  });

  it('calls equal scores a tie (0), so the next sort key decides, and a stable sort keeps the list order', () => {
    expect(compareMatchSort(0.5, 0.5)).toBe(0);
    expect(compareMatchSort(undefined, undefined)).toBe(0);
    const rows = [
      { id: 'a', score: 0.5 },
      { id: 'b', score: undefined },
      { id: 'c', score: 0.5 },
      { id: 'd', score: undefined },
      { id: 'e', score: 0.9 },
    ];
    const ids = [...rows].sort((x, y) => compareMatchSort(x.score, y.score)).map((row) => row.id);
    expect(ids).toEqual(['e', 'a', 'c', 'b', 'd']);
  });
});
