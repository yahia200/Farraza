# 07: The list and the board show the Average rating

**What to build:** Every candidate in the table and on the board card shows the Average rating and the number of raters, and the table sorts by it. Spec: `.scratch/ratings/spec.md` ("API: Board / list", "Web: Table", "Web: Board card").

- **API:** every card in the board payload (`GET .../jobs/:jobSlug/applications`, `PipelineService.board`) gains `rating: { average, count }` (`average` `null` when `count` is 0), computed in one grouped query by Application id over the Job's Applications, using `summariseRatings` or an equivalent that has the same result. Never a query per card.
- **Table:** a "Rating" column showing the average to one decimal and the count ("4.2 (3)") or "No ratings"; sortable, nulls last. Sorting is client-side (all rows are loaded). Read the `.d.ts` in `apps/web/node_modules/@tanstack/table-core` for v9 sorting; do not assume the v8 API.
- **Board card:** the same label under the candidate's name; a card with no ratings shows nothing extra or "No ratings" (pick one and note it).
- Do not slow the board for Jobs with no ratings: with none, the grouped query still runs once and returns nothing.

**Blocked by:** 03.

**Status:** resolved

- [x] Cards carry `rating` with the right average and count; none is `{ average: null, count: 0 }`
- [x] The average counts overall Ratings only, never Criteria scores
- [x] One extra query for the whole board, not one per card (spec test or a recorded query count)
- [x] The table shows the Rating column and sorts ascending and descending, unrated last both ways
- [x] The board card shows the average and count
- [x] Service specs on the in-memory fake repository
- [x] Phone-width table and board checked in the browser, and what was checked recorded
- [x] `.claude/rules/api.md` (board payload) and `.claude/rules/web.md` updated
- [x] `pnpm lint` and `pnpm check-types` pass

## Comments

## Answer

API built test-first through `PipelineService.board` (the seam the highlighted-questions spec already approved; no new seam proposed): the real service on the in-memory fake in `pipeline.board.spec.ts`, which gained `findRatingSummaries`. Seven specs went red (`card.rating` undefined), then the service and repository code made them pass; 22 specs in the file. Web has no test runner (none added), so it was checked in the browser.

### The grouped query and the query count

- `PipelineRepository.findRatingSummaries(companyId, applicationIds): Promise<Map<applicationId, { count, average }>>`: `Rating.where({ companyId }).where((r) => r.applicationId.in(ids)).groupBy('applicationId').aggregate((agg) => ({ count: agg.count(), average: agg.avg('overall') }))`.
- Types read from `orm-client.d.mts` in `@prisma/orm-family-sql/dist` (`groupBy`, `GroupedCollection.aggregate`, `AggregateBuilder`) and the emitted `AggregateTypes` in `apps/api/src/prisma/contract.d.ts` (lines 46-64): `avg` over `pg/int2@1` is `pg/float8@1`, `nullable: true`, so `number | null`; `count()` is `pg/int8number@1`, a JS `number`. `groupBy().aggregate()` had no use in the repo before; it compiled first time and was run against the real database.
- Proof of "one extra query for the whole board": (1) spec "reads every Rating of the board in one query, however many cards there are": the fake records one entry per `findRatingSummaries` call, and five cards give one call holding the five ids; (2) recorded on the real dev DB with 5 Applications, three consecutive board requests: the `pg_stat_user_tables` scan count (seq + idx) of `ratings` went 34, 35, 36, one per request (`applications` also +1 per request; `candidates` +5 is the existing card join, not this ticket).
- The average is the plain mean, unrounded, identical to `summariseRatings`: the live API answered `{ count: 3, average: 4.333333333333333 }` for Ratings 5, 4, 4 (`13 / 3` in JS is the same double), `{ count: 2, average: 4 }`, `{ count: 1, average: 2 }`, and `{ average: null, count: 0 }` for the two unrated. Only `overall` is read; the Ratings were saved with `criteria: {}`, and `avg('overall')` cannot see Criteria. The spec "gives every card the plain mean ... unrounded" asserts `13 / 3`.
- With no Applications the query is skipped (there are no ids to ask about); with Applications but no Ratings it runs once and returns nothing (spec "still runs the one query when no card has a Rating, and none when the Job has no Applications"). The ticket said the query should still run once with none; with no cards there is nothing to ask, so I skip it.

### Choices (owner may want to review)

1. **How the grouped query is scoped.** Options: (A, chosen) `applicationId IN (the cards' ids)` plus `companyId`, run after the cards are read; (B) join to Application and filter by `jobId` in the same query (I found no relation filter in the grouped-query types, and the grouped key would still need the join); (C) add `job_id` to `ratings` (a schema change the ticket says is not expected). A costs one sequential round trip after the cards and an `IN` list as long as the board, which is fine at this size. The hint came from ticket 03's Answer.
2. **Where `rating` is added.** `CardRow` (the repository's card) stays without it; the service's `withRatings` adds it, so `findCards`, `findCardsWithAnswers` and their fakes did not change, and the cards are never joined with ratings (a join would repeat rows per rater).
3. **No-ratings card: show nothing.** The table says "No ratings" (spec); the card renders nothing extra when `count === 0`, so a fresh board looks as before and rated cards stand out. The alternative ("No ratings" on every card) adds a muted line to every unrated card. It is a one-line change in `candidate-card.tsx` if the owner prefers it.
4. **Sorting.** The Rating column has `sortFn: 'basic'` (numbers), `sortUndefined: 'last'`, and the accessor returns `undefined` (not `null`) for unrated. Docs: `rowSortingFeature.types.d.ts` (`sortUndefined`, lines 88-102) and `createSortedRowModel.js` (`aValue === void 0`; `'last'` returns before `desc` can flip it), both in `node_modules/.pnpm/@tanstack+table-core@9.2.8/node_modules/@tanstack/table-core/dist/features/row-sorting/`. `DataTableSortButton` starts ascending, so the first click lists the lowest first (as for every column here).
5. **Column position:** right after Candidate, a narrow `w-px` column, rather than after the variable run of Highlighted columns, so it is always in the same place and visible on a phone before the table scrolls.
6. **Formatting:** `toFixed(1)` in `formatAverageRating`, not `Intl.NumberFormat` (locale-independent, so no server/client mismatch). A `StarIcon` (lucide, the one the criteria picker uses) filled amber; the visible text is `aria-hidden` and an `sr-only` sentence ("Average rating 4.3 from 3 ratings", "1 rating" singular) is what a screen reader gets.
7. **Web type name** `CardRating` in `lib/dal.ts`, mirroring the API's `CardRating` (`Pick<RatingSummary, 'count' | 'average'>`). Shared's `RatingAverage` has a non-null average, so it was not reused.

### Browser check (own servers: API 3011, web 3010; real app, local DB)

Test data: 3 test accounts (an owner plus two recruiters added as Members), one company and Job with a published one-question form, 5 applicants through the real public apply API, 6 Ratings through the real `PUT .../rating`: Alice 5, 4, 4 (4.3, 3 raters), Chloe 3, 5 (4.0, 2), Bruno 2 (2.0, 1), Dmitri and Eve unrated.
- Table, 1024px: the Rating column shows a star and "4.3 (3)", "4.0 (2)", "2.0 (1)", "No ratings". Header clicks: first `aria-sort="ascending"` gave Bruno, Chloe, Alice, then Eve and Dmitri (unrated last); second `descending` gave Alice, Chloe, Bruno, then Eve and Dmitri (unrated still last); third ascending again. The sr-only text read "Average rating 4.3 from 3 ratings".
- Board, 1024px and 375px: the label under the name on rated cards only; unrated cards show just the name and the Move select. No horizontal page scroll at 375px (document and viewport both 375).
- Table, 375px: the table scrolls inside its frame (frame 341px, table 652px, page 375px); Rating is the second column and visible without scrolling.
- Not checked: a card with a Highlighted question and a rating together (the page serves its cached board until a Server Action revalidates it, and I set the Highlighted key through the API, so the card never showed it; the label and the `<dl>` are siblings in one flex column), the light theme, a screen reader (the sr-only text was read from the DOM, not heard).
- Cleaned up afterwards: the test company, Job, applicants, Ratings and the three users.

### For tickets 06 and 08

- Ticket 06: the sheet's own summary comes from the detail payload (ticket 04), not from the card. After a save the action must revalidate the candidates path (as the notes action does) so the table's and card's Average rating refresh: the board is a `'use cache: private'` read, which only refreshes from a Server Action's `revalidatePath`. `AverageRatingLabel` and `formatAverageRating` (`components/dashboard/candidates/average-rating-label.tsx`) take `{ average, count }`, so the sheet can reuse them for the same "4.3 (3)" look; the detail's `ratingSummary` has the same two fields.
- Ticket 08: the board's `rating` is on `ApplicationCard` only; the public routes and the detail payload are untouched by this ticket. `docs/db-schema.md` needed no change (no schema change); the board payload is documented in `.claude/rules/api.md`.

### Docs relied on

`orm-client.d.mts` (`@prisma/orm-family-sql/dist`), `apps/api/src/prisma/contract.d.ts` (`AggregateTypes`), `apps/api/prisma-8.md` for the query style, table-core 9.2.8 `rowSortingFeature.types.d.ts` and `createSortedRowModel.js`, `.claude/rules/web.md` (the DAL rebuilds objects field by field), lucide's `StarIcon` as already used in `rating-criteria-picker.tsx`. I did not open the Next.js docs this session: nothing new from Next.js was used.

### Files

- Modified `apps/api/src/pipeline/pipeline.ts`: `CardRating`, `ApplicationCard.rating`; `CardRow` omits it.
- Modified `apps/api/src/pipeline/pipeline.repository.ts`: `findRatingSummaries` (the grouped query).
- Modified `apps/api/src/pipeline/pipeline.service.ts`: `board` calls the new `withRatings`.
- Modified `apps/api/src/pipeline/pipeline.board.spec.ts`: fake `findRatingSummaries`, seven specs.
- Modified `apps/web/lib/dal.ts`: `CardRating`, card `rating` in the type and the explicit mapping.
- Created `apps/web/components/dashboard/candidates/average-rating-label.tsx`: the label.
- Modified `apps/web/components/dashboard/candidates/columns.tsx`: the Rating column.
- Modified `apps/web/components/dashboard/candidates/candidate-card.tsx`: the label under the name.
- Modified `.claude/rules/api.md`, `.claude/rules/web.md`: board payload, table and card notes.
- Modified `.scratch/ratings/issues/07-list-and-board-show-average-rating.md`: status, boxes, this Answer.
