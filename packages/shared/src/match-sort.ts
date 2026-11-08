/**
 * "Sort by score" on the candidate table (embedding-match ticket 10, `.scratch/candidate-matching/layer3-spec.md`
 * stories 1, 3 and 12). Pure and server-or-browser safe. The overall number is for ordering only:
 * nothing here, and nothing in the UI, shows it.
 *
 * While the candidate list is unpaginated the web app sorts the rows it already holds. Pagination
 * (`docs/feature-backlog.md`) will move this sort to the server: the number then has to be an
 * `ORDER BY` on the stored score, with the same rules (highest first, unscored last, ties in the
 * list's default order), and these functions become the reference for that query's behaviour.
 */

/** The part of a card or table row the sort reads (`ApplicationSummary` in the web app's `dal.ts`). */
export type MatchSortable = {
  matchScore: number | null;
  matchState: { status: 'scoring' | 'scored' | 'not_scored'; reason?: string } | null;
};

/**
 * What "Sort by score" orders an Application by: its overall number, or `undefined` when it has none
 * to give (still scoring, could not be scored, never queued, or a `scored` row with no number).
 */
export function matchSortValue(row: MatchSortable): number | undefined {
  if (row.matchState?.status !== 'scored') return undefined;
  return row.matchScore ?? undefined;
}

/** Why "Sort by score" is off, in the words the table shows next to it. */
export const MATCH_SORT_NO_REQUIREMENTS = 'Add Requirements in Settings to sort by score.';
export const MATCH_SORT_NOTHING_SCORED = 'No candidate has a score yet.';

export type MatchSortAvailability = { enabled: true } | { enabled: false; reason: string };

/**
 * Whether "Sort by score" is on offer: the Job needs at least one Requirement (without one nothing is
 * ever scored, spec story 12) and at least one listed Application must have a number to sort by.
 * Missing Requirements is the reason given when both apply, since it is what the manager can fix.
 */
export function matchSortAvailability(requirementCount: number, rows: readonly MatchSortable[]): MatchSortAvailability {
  if (requirementCount === 0) return { enabled: false, reason: MATCH_SORT_NO_REQUIREMENTS };
  if (!rows.some((row) => matchSortValue(row) !== undefined)) {
    return { enabled: false, reason: MATCH_SORT_NOTHING_SCORED };
  }
  return { enabled: true };
}

/**
 * Orders two `matchSortValue`s best first: the higher score comes first, no score comes after every
 * score, and equal values (two scores, or two gaps) are a tie, `0`. A tie is what lets the table's
 * next sort key decide, and what keeps the existing order under a stable sort (`Array.prototype.sort`
 * is stable; so is TanStack Table's, which falls back to the row's original index).
 */
export function compareMatchSort(a: number | undefined, b: number | undefined): number {
  if (a === undefined || b === undefined) {
    if (a === b) return 0;
    return a === undefined ? 1 : -1;
  }
  return b - a;
}
