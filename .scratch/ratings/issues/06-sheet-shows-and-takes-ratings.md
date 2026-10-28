# 06: The Application sheet shows and takes Ratings

**What to build:** In the Application detail sheet, a Member sees everyone's Ratings and the per-Criterion averages and can give or change their own. Spec: `.scratch/ratings/spec.md` ("Web: Sheet").

- **Own Rating control:** the overall as five buttons (1 to 5), then a row per Criterion the Job currently uses, each also five buttons and each clearable. A change saves at once through a Server Action calling `PUT .../rating`. Check the Base UI docs under `apps/web/node_modules/@base-ui/react/docs/` for a toggle group before picking the component (spec "Confirmed details", item 5: five 1 to 5 buttons).
- **Everyone's Ratings:** a row per Member with name, overall, each Criterion score and the date; Criteria no longer used are marked "no longer used". Show the per-Criterion averages and the Average rating with its count.
- **Data:** the DAL (`lib/dal.ts`) types and mapping for `ratings` and `ratingSummary` from ticket 04; revalidate the sheet and the board after a save.
- An empty state ("No ratings yet") and keyboard and screen-reader access for the buttons.

**Blocked by:** 03, 04.

**Status:** resolved

- [x] A Member gives an overall rating, changes it, and sees it saved at once
- [x] Scoring and clearing a Criterion works; the overall can't be cleared
- [x] Two accounts see each other's Ratings by name
- [x] A Criterion the Job dropped shows its old scores marked "no longer used" and offers no new entry
- [x] An interviewer can rate
- [x] A Rejected Application can still be rated
- [x] Phone-width sheet checked in the browser, and what was checked recorded
- [x] `.claude/rules/web.md` updated
- [x] `pnpm lint` and `pnpm check-types` pass

## Comments

## Answer

Built and checked in the browser. `tdd` did not apply: web has no test runner and none was added, and there is no new pure logic that deserves a shared test (the 1 to 5 rules, the catalog labels and the summary are already in `@repo/shared`; the new code is rendering, one action and a history line).

### What shipped

A "Ratings" section in the candidate sheet, between Answers and Activity:
- **Your rating** (`rating-control.tsx`, client): the overall as five buttons, then five buttons per Criterion the Job uses now. Each click saves at once.
- **Average rating** next to the heading (reusing `AverageRatingLabel`), then "Average by criterion" (the Job's Criteria, then dropped ones that still have scores), then one row per Member: name ("(you)" on your own), date, overall, each Criterion score. "No ratings yet." when empty.
- **History:** `rated` events have a line.

### Component structure

- `candidate-detail.tsx` (server) reads `getCurrentUser()` in its `Promise.all` and passes the page's `job.ratingCriteria` down.
- `candidate-ratings.tsx` (server): the section; splits the Job's Criteria from the dropped ones, finds the viewer's Rating (`userId === currentUserId`; `null` is never mine), renders `RatingControl` and the lists.
- `rating-control.tsx` (client): `RatingControl` (state, `useOptimistic`, the action call, toast, sr-only status) with two small local pieces, `CriterionRow` and `ScoreRow` (label plus `ToggleGroup`).
- `app/actions/applications.ts`: `saveRating`. `lib/dal.ts`: `RatingView`, and `ratings` and `ratingSummary` on `ApplicationDetailView`, mapped field by field in `getApplication`.

### Choices (owner may want to review)

1. **The 1 to 5 control: shadcn `ToggleGroup` (single-select, `variant="outline" size="sm"`).** Docs: `apps/web/node_modules/@base-ui/react/docs/react/components/toggle-group.md` ("API reference": `value` is `string[]`, `multiple` defaults to `false`, `loopFocus`, `disabled`). Rejected: `RadioGroup` (`components/ui/radio-group.tsx`): dot-style radios, not buttons as the spec's confirmed item 5 wants, and a radio can't be pressed again to clear a Criterion. The wrapper was already used single-select in `cv-card.tsx`; I followed that. Base UI gives pressing the pressed button `[]`: ignored for the overall (cannot be cleared), `null` (clear) for a Criterion. A visible hint says "Press a chosen score again to clear it".
2. **Criteria stay disabled until the overall is given**, with a line saying so. The API requires `overall` on every save and the spec says it is never derived, so a Criterion score alone cannot be sent. Rejected: sending a default overall (it would invent a judgement).
3. **A click sends the overall plus only the Criterion that changed**; the API carries the rest over (ticket 03). So a second tab's changes to other Criteria are not overwritten by a stale local copy.
4. **Optimistic and refresh: `useOptimistic` + `revalidatePath` on the literal candidates path**, the pattern of `RatingCriteriaPicker` and `CandidateMove`. A failed save snaps back (the base value is the server's Rating) and a toast says why. `revalidatePath` refreshes the sheet, the table and the board in one response, so the averages follow. Docs relied on: `apps/web/node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md` and `02-guides/server-actions.md` ("A single response carries data and UI"), as the ticket 05 Answer cites them. I did not re-read them this session; the pattern is inherited and the browser check confirms it.
5. **Phone width: `spacing={1}` and `h-9 min-w-9` buttons.** The sheet is only 3/4 of 375px wide (about 281px; `sheet.tsx`'s `data-[side=right]:w-3/4` beats the sheet's `w-full`, existing behaviour, not changed). At `h-10` with the default 8px gap the fifth button touched the card border. Rejected: widening the sheet (the owner has uncommitted edits to `sheet.tsx`). Touch targets are 36px.
6. **History line wording (`activity-items.ts`, `describeEvent` case `rated`).** Events carry only `actorId`, so the name comes from the detail's `ratings` (everyone who rated still has a Rating row, as ratings cannot be removed); no match shows "Former member". Wording:
   - first Rating: "Alice rated 4 out of 5 (in Interview)"
   - overall changed: "Alice changed their rating from 3 to 4 (in Interview)"
   - only Criteria changed: "Alice scored Culture fit 4, cleared Communication (in Interview)", naming each changed Criterion, in catalog order
   - nothing changed: "Alice kept their rating at 4 (in Interview)"
   - unreadable `data`: "Alice rated"

   The stage is the name stored in the event. I chose named Criterion changes over a generic "updated their criteria scores" because the data has everything needed. Rejected: "You rated" for the viewer's own events (the notes show names the same way for everyone).
7. **No-ratings state:** "No ratings yet." under the control (the control is still there, so the person can rate). The Average label is hidden until someone rates.
8. **Dropped Criteria** show their scores with an outline `Badge` "no longer used", in each row and in the averages; the control never lists them. Labels from `RATING_CRITERIA`.
9. **Dates in each row use `formatDate(updatedAt)`**, the last change, not the first rating (rows are ordered by when each Member first rated, ticket 04).

### Browser verification (own servers: API 3011, web 3010; test data in the local dev DB)

Accounts created through the API's sign-up: an owner (Alice, in the pane), a recruiter (Bob) and an interviewer (Carol, in a second pane tab at `carol.localhost:3010` so the cookies are separate); one Job with a published form; three applicants.
- **Give and change a Rating:** overall 4 saved at once, then 5; pressing 5 again changed nothing (stayed 5, no new event). The API's events matched (`previous`/`current` per save).
- **Criteria:** scored Technical skills 4, Communication 3, cleared Communication (back to unscored; the stored `criteria` no longer had it), Culture fit 4. Disabled until an overall existed (seen on a candidate with no Rating).
- **Two accounts:** Alice, Bob (via the API) and Carol (in the pane, an interviewer: no Move control, no pickers) saw one another's Ratings by name, with "(you)" on their own; the summary showed 4.0 (3) after 5, 3 and 4; per-Criterion averages matched (Technical skills (4+2)/2 = 3.0).
- **Dropped Criterion:** the Job's Criteria changed from three to two; Communication stayed in the averages and in Bob's and Carol's rows with "no longer used", and is not in the control. Carol re-rated the overall (2 to 4) and her old Communication 1 survived (still in her row).
- **Rejected Application:** Carol rated it (overall 3); the table then said 3.0 (1).
- **Interviewer:** rated, saw everything.
- **`rated` history lines:** the first-rating, changed-overall and scored/cleared wordings rendered from real events.
- **"Former member":** deleted Bob's user in the dev DB; his row became "Former member" (not "(you)"), his history line "Former member rated 3 out of 5".
- **Averages refresh:** the table showed 4.0 (3) right after a save without a reload, and the board cards showed "4.0 (3)" and "3.0 (1)".
- **Keyboard:** the group is one tab stop (`tabindex` 0,-1,-1,-1,-1); ArrowRight moved from 1 to 2, Space pressed it and saved, Tab went to the next group, Space on Communication saved; the sr-only status said "Communication saved: 1."
- **Failure:** patched `fetch` to reject Server Action calls: the button snapped back to 3 and the toast "Couldn't save your rating" appeared.
- **Phone (375x812):** no horizontal page scroll (document 375); five buttons fit inside the card (right edge 320 of a 359 card); the lists wrap; "no longer used" badges wrap under the label.
- **Not checked:** the light theme (dark only); a real screen reader (the status text and labels were read from the DOM); touch (clicks arrive as mouse clicks); two quick clicks racing; a 400 from a Job whose Criteria changed under an open sheet (the action's message and revalidation are untested); the "kept their rating" wording from a real event.
- **Clean-up:** the test company, Job, applicants, Ratings, memberships and the three users were deleted; both servers stopped; `apps/web/AGENTS.md` and `tsconfig.build.tsbuildinfo` were rewritten by tooling and restored. Ports 3000 and 3001 were never touched. One unrelated `candidates` row (an older test applicant) remains in the DB; it is not mine.

### For ticket 08

- Check by hand that the list order is first rater first (not checked here beyond the three Members). A deleted author's Rating showing as "Former member" was checked here once.
- The history line for a `rated` event names the actor through the Ratings list. If Ratings ever become removable, the lookup would miss and the line would read "Former member".
- The sheet is 3/4 of a phone's width (existing behaviour); the five buttons were sized for that.
- `docs/db-schema.md` needs no change (no schema change); `.claude/rules/web.md` has the sheet note.

### Docs relied on

`apps/web/node_modules/@base-ui/react/docs/react/components/toggle-group.md` (props, `[]` on unpressing), `apps/web/node_modules/@animate-ui/react/dist/primitives/base-ui/toggle-group/toggle-group.js` and `toggle/toggle.js` (the Animate UI layer passes the props through; it adds a motion highlight and press animation), `@repo/shared` `ratings.ts` and `rating-criteria.ts` (types, labels, `RATING_MAX`), the ticket 03 and 04 Answers (payload shapes), the ticket 05 Answer (picker pattern) and the 07 Answer (`AverageRatingLabel`). React's `useOptimistic`/`startTransition` and Next.js `revalidatePath` were used as in the existing components; I did not re-open their docs this session.

### Files

- Created `apps/web/components/dashboard/candidates/rating-control.tsx`: the viewer's own Rating control.
- Created `apps/web/components/dashboard/candidates/candidate-ratings.tsx`: the "Ratings" section (averages, everyone's Ratings, dropped Criteria).
- Modified `apps/web/components/dashboard/candidates/candidate-detail.tsx`: renders the section, reads the current user, takes `ratingCriteria`.
- Modified `apps/web/components/dashboard/candidates/activity-items.ts`: the `rated` history line and the `raters` lookup.
- Modified `apps/web/app/actions/applications.ts`: the `saveRating` Server Action.
- Modified `apps/web/lib/dal.ts`: `RatingView`, `ratings` and `ratingSummary` on the detail.
- Modified `apps/web/app/(dashboard)/dashboard/[companySlug]/jobs/[jobSlug]/candidates/page.tsx`: passes `job.ratingCriteria` to the sheet.
- Modified `.claude/rules/web.md`: a note on the sheet's Ratings section.
- Modified `.scratch/ratings/issues/06-sheet-shows-and-takes-ratings.md`: status, boxes, this Answer.
