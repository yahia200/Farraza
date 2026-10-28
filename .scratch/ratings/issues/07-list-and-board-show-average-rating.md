# 07: The list and the board show the Average rating

**What to build:** Every candidate in the table and on the board card shows the Average rating and the number of raters, and the table sorts by it. Spec: `.scratch/ratings/spec.md` ("API: Board / list", "Web: Table", "Web: Board card").

- **API:** every card in the board payload (`GET .../jobs/:jobSlug/applications`, `PipelineService.board`) gains `rating: { average, count }` (`average` `null` when `count` is 0), computed in one grouped query by Application id over the Job's Applications, using `summariseRatings` or an equivalent that has the same result. Never a query per card.
- **Table:** a "Rating" column showing the average to one decimal and the count ("4.2 (3)") or "No ratings"; sortable, nulls last. Sorting is client-side (all rows are loaded). Read the `.d.ts` in `apps/web/node_modules/@tanstack/table-core` for v9 sorting; do not assume the v8 API.
- **Board card:** the same label under the candidate's name; a card with no ratings shows nothing extra or "No ratings" (pick one and note it).
- Do not slow the board for Jobs with no ratings: with none, the grouped query still runs once and returns nothing.

**Blocked by:** 03.

**Status:** ready-for-agent

- [ ] Cards carry `rating` with the right average and count; none is `{ average: null, count: 0 }`
- [ ] The average counts overall Ratings only, never Criteria scores
- [ ] One extra query for the whole board, not one per card (spec test or a recorded query count)
- [ ] The table shows the Rating column and sorts ascending and descending, unrated last both ways
- [ ] The board card shows the average and count
- [ ] Service specs on the in-memory fake repository
- [ ] Phone-width table and board checked in the browser, and what was checked recorded
- [ ] `.claude/rules/api.md` (board payload) and `.claude/rules/web.md` updated
- [ ] `pnpm lint` and `pnpm check-types` pass

## Comments

## Answer
