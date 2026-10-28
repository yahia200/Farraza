Status: resolved

# Ratings on Applications

Related: the glossary entries **Rating**, **Criterion**, **Average rating** and **Application Event** (`GLOSSARY.md`), the highlighted-questions spec (`.scratch/highlighted-questions/spec.md`: the Job-level picker, the board payload and the table columns this spec extends), the preset-key catalog (`packages/shared/src/preset-keys.ts`: the append-only catalog pattern the Criteria follow), and the glossary terms Application, Member, Job and Note.

## Problem Statement

A hiring team has no way to record what they think of a candidate. A reviewer can leave a free-text Note, but notes can't be compared, summed up or scanned down a list. To see how the team feels about ten candidates, someone has to open each Application and read every note. There is also no way to say "strong on technical skills, weak on culture fit" in a form that lets candidates be compared.

## Solution

A Member can give any Application a **Rating**: an overall score from 1 to 5. The Job can also offer up to five **Criteria** (technical skills, culture fit and so on, from a fixed catalog) that raters may score from 1 to 5 as well. Everyone who can view the Application sees every Rating on it with the name of who gave it. A Member can change their Rating at any time but not remove it, and every change is recorded in the Application's history. The candidate list shows the **Average rating** and how many Members gave one, and the table can be sorted by it. The Application's detail view shows each Member's Rating and the average per Criterion.

Ratings are advisory and internal: they never move an Application, never notify anyone, and never leave the signed-in API (the public routes don't return them).

## User Stories

1. As a reviewer, I want to give an Application an overall rating from 1 to 5, so that my judgement is recorded where the team can see it.
2. As a reviewer, I want to change my rating later, so that a second interview or a re-read can update my view.
3. As a reviewer, I want my change to be saved the moment I pick a value, so that there is no Save button to forget.
4. As a reviewer, I want to see every colleague's rating with their name, so that I know who thinks what.
5. As an interviewer, I want to rate Applications like any other Member, so that my interview feedback counts.
6. As a reviewer, I want to rate an Application that is already Rejected, Hired or Withdrawn, so that I can add a retrospective view.
7. As a reviewer, I want to score each Criterion the Job uses from 1 to 5, so that I can say where a candidate is strong or weak.
8. As a reviewer, I want to skip a Criterion, so that I'm not forced to score what I couldn't judge.
9. As a reviewer, I want to clear a Criterion score I gave by mistake, so that I'm not stuck with it.
10. As a reviewer, I want the overall rating to be mine to enter, so that it is never silently worked out from the Criteria.
11. As a manager, I want to pick up to five Criteria for a Job from a fixed list, so that everyone rating that Job scores the same things.
12. As a manager, I want a Job with no Criteria picked to be rated on the overall alone, so that nothing changes until I opt in.
13. As a manager, I want to change a Job's Criteria at any time, so that I'm not locked in by a choice I made before anyone applied.
14. As a reviewer, I want scores already given for a Criterion the Job later dropped to stay visible (marked as no longer used), so that the record isn't rewritten.
15. As a reviewer, I want to see the Average rating and the number of raters on each candidate in the table and on the board, so that I can tell who the team likes without opening anyone.
16. As a reviewer, I want to sort the table by Average rating, so that I can find the top candidates.
17. As a reviewer, I want an Application with no ratings shown as "No ratings", sorted last, so that it isn't mistaken for a low score.
18. As a reviewer, I want the detail view to show the average per Criterion, so that I can see a candidate's profile at a glance.
19. As a reviewer, I want a Rating to stay (and still count) when its author leaves the company, so that a hiring decision doesn't change because someone moved on.
20. As a recruiter, I want the history of rating changes in the Application's history, so that I can see who changed their mind and when.
21. As an applicant, I want my ratings to be invisible to me, so that internal opinions stay internal.
22. As a maintainer, I want the Criteria catalog, the 1–5 rule and the average in `@repo/shared`, so that the API and the web agree because they run the same code.

## Implementation Decisions

The concept (everything in the glossary, plus: one Rating per Member per Application kept as a current row with history in events; the overall is required and never derived; Criteria are picked per Job from a fixed, append-only catalog, optional for the rater, scored 1–5; dropped Criteria keep their old scores; anyone who can view an Application can rate it, in any status; ratings can't be removed; averages on the card and list, per-Criterion averages in the detail view; sort on the table only; no auto-move, no notification, never public) was settled with the owner in the grilling session. The six items under **Confirmed details** below were proposed afterwards and the owner accepted all of them as written.

**Concept and rules (all in `@repo/shared`, pure and tested)**

- A catalog file (next to `preset-keys.ts`), for example `rating-criteria.ts`: `RATING_CRITERIA`, an array of `{ key, label }` for `technical_skills`, `problem_solving`, `communication`, `culture_fit`, `leadership`, `relevant_experience`; `RATING_CRITERIA_LIMIT = 5`; `RATING_MIN = 1`, `RATING_MAX = 5`. It is **append-only**, like `PRESET_KEY_TYPES`: never remove or rename a key, or an old Rating or a stored Job selection could no longer be read. Keys are stable snake_case slugs, not UUIDs, because the catalog is fixed. Labels live in shared so the API and the web agree.
- Zod schemas: `ratingCriteriaKeysSchema` (an array of at most `RATING_CRITERIA_LIMIT` unique catalog keys, wrapped by `saveRatingCriteriaSchema` for the request body, `z.strictObject` per the API conventions) and `saveRatingSchema` (`overall` an integer 1–5, `criteria` an optional object of catalog key to integer 1–5 or `null`, strict). A pure function checks a Rating's criteria against the Job's current selection and returns `<path>` errors like the other validators.
- A pure `summariseRatings(ratings)` returns `{ count, average, criteria: Record<key, { count, average }> }` where `average` is the mean of the `overall` values (a number, or `null` for no ratings) and each Criterion's average is over the Members who scored it. Rounding is for display, not for this function (the web shows one decimal).

**Database** (proposed names; confirm syntax in `apps/api/prisma-8.md` and the existing `contract.prisma`)

- `jobs.rating_criteria`: `jsonb`, NOT NULL, DEFAULT `'[]'`, CHECK that it is an array (same pattern as `jobs.highlighted_question_keys`). Catalog keys with no FK (they live inside a JSONB array; add it to the no-FK list in `docs/db-schema.md` §7).
- A new table `ratings` (model `Rating`): `id`, `company_id`, `application_id` (FK to applications, cascade), `user_id` (FK to users, **SET NULL**, like `notes.author_id`, so a Rating outlives its author's membership; nullable), `overall` (`smallint`, CHECK 1 to 5), `criteria` (`jsonb`, NOT NULL, DEFAULT `'{}'`, CHECK it is an object), `created_at`, `updated_at`. UNIQUE (`application_id`, `user_id`) enforces one Rating per Member per Application. An index on `(application_id)`. Every company-owned table has `company_id` (`.claude/rules/api.md`, "Tenant isolation"); copy it from the Application on insert.
- `application_events.type` gains a value `rated` (the contract enum becomes a `text` CHECK, so this is an additive change to the CHECK; check how `prisma db update --dry-run` plans it). `data` holds `{ previous: { overall, criteria } | null, current: { overall, criteria }, stage: <stage name> }`, with the stage name stored so the history stays readable if stages are renamed (the existing audit-trail rule). Add the shape to `docs/db-schema.md` §4.3. One event per save, written in the same transaction as the Rating.
- Changes go through `apps/api/src/prisma/contract.prisma`, then `pnpm --filter api exec prisma contract emit` and `prisma db update` (CLAUDE.md "Database"); commit `contract.json`, `contract.d.ts` and any new snapshot files. The last two highlighted-questions tickets' Answers describe the dry-run and snapshot workflow.

**API (`apps/api`)**

- **Job criteria:** `PUT companies/:companySlug/jobs/:jobSlug/rating-criteria` with `{ keys }`, in the jobs module following the layering, authorized with `JobPolicy` `update` (interviewers 403), any Job status, one unconditional `UPDATE` replacing the whole list (a preference, last-write-wins; say so in a comment as `replaceHighlightedQuestionKeys` does). It returns `{ keys }`. The Job payload gains `ratingCriteria: string[]`; the web `CompanyJob` mirrors it.
- **Rate:** `PUT companies/:companySlug/jobs/:jobSlug/applications/:applicationId/rating` with `{ overall, criteria? }`, in the pipeline module. It gives or replaces **the caller's own** Rating (the user comes from the session, never the body). A new `ApplicationPolicy` action `rate` allows all four roles. The Application must belong to the company and the Job (404 otherwise, like `detail`). Any Application status is allowed. Criteria scores must be keys in the Job's current selection (400 with `errors` paths otherwise).
- **History rule for dropped Criteria:** when a Member saves, scores for Criteria the Job no longer uses are carried over from their existing Rating untouched (the request only addresses the Job's current Criteria), so a re-rate never silently erases an old score.
- **Event:** inside one transaction, the upsert and the `rated` event; `previous` is the Rating as read in that same transaction (`null` for a first rating). Use `.upsert({ create, update, conflictOn })` (CLAUDE.md "Database") and `isUniqueViolation()` for a race on the first rating (`.claude/rules/api.md`, "Concurrency").
- **Read:** `GET .../applications/:id` (the detail payload) gains `ratings: [{ userId, name, overall, criteria, updatedAt }]` and `ratingSummary` from `summariseRatings`; `name` is the author's name, or a fallback label ("Former member") when the author is gone. The detail call keeps its current access check (membership guard plus job lookup, no policy), so interviewers see them.
- **Board / list:** the board payload (`GET .../jobs/:jobSlug/applications`, which both the table and the board read) gains, on every card, `rating: { average, count }` (`average` `null` when `count` is 0). Compute it in one grouped query by Application id over the Job's Applications, not a query per card (the highlighted-questions ticket 03 Answer describes the shape of the card queries to extend).
- Ratings never appear in the public routes (`applications/` `PublicController`). Say so in a test.

**Web (`apps/web`)**

- DAL types gain `ratingCriteria`, `ratings`, `ratingSummary` and the card `rating`; new Server Actions (`app/actions/`) for saving a Rating and the Job's Criteria, returning `ActionFailure` like the others, with the cached board and detail revalidated.
- **Sheet:** a "Ratings" section showing the Member's own Rating control (1–5 as five buttons, one per value, plus a row per selected Criterion that can also be cleared), every Member's Rating with their name and the date, the per-Criterion averages, and dropped Criteria's old scores marked "no longer used". A change saves at once.
- **Table:** a "Rating" column showing the average to one decimal and the count (for example "4.2 (3)"), or "No ratings"; sortable (`enableSorting: true`, nulls last). The table already has every row client-side, so the sort is client-side too. Read the `.d.ts` in `node_modules/@tanstack/table-core` for v9 sorting rather than assuming v8 (`.claude/rules/web.md`, and the highlighted-questions spec's warning).
- **Board card:** the same "4.2 (3)" under the name.
- **Picker:** beside the existing Highlighted questions settings, a manager-only control to choose up to five Criteria for the Job (checkboxes in a popover, like the highlight picker, disabled at five with a line explaining the limit). Shown only when `canManageJobs(role)`.
- Keep copy to the glossary words (Rating, Criterion, Application, Member).

**Confirmed details** (accepted by the owner as written)

1. **Table names and route paths** above (`ratings`, `rating_criteria`, `.../rating`, `.../rating-criteria`, the event name `rated`). The existing conventions are followed; the alternative is a pluralised route.
2. **Last-write-wins on the rating upsert**, with `previous` read in the same transaction, rather than an optimistic "only if unchanged" write. A Member rating from two tabs at once could record a slightly wrong `previous`; nothing else is lost. The alternative is a conditional update on `updated_at`, which means a conflict message for a person fighting themselves.
3. **A Criterion score can be cleared** (send `null` for it), though a whole Rating can't be removed. The owner settled the second rule and the first was not asked.
4. **Stage name in the event data** (not asked): the stage the Application was in when the Rating was given.
5. **Five 1–5 buttons**, not stars or a slider, as the rating control. Check the Base UI docs for a `ToggleGroup` (`apps/web/node_modules/@base-ui/react/docs/`) before choosing the component.
6. **"Former member"** as the label for a Rating whose author is gone.

**Docs**

- `docs/db-schema.md`: the `jobs` table (§3.5), a new `ratings` section, the event type (§3.10, §4.3), the no-FK list and the rules (§7). `.claude/rules/api.md` (jobs, pipeline, shared notes) and `.claude/rules/web.md` (sheet, table, card, picker). `GLOSSARY.md` already has the terms. No ADR: nothing here is surprising or hard to reverse (the owner and I agreed on this during the grilling).

## Testing Decisions

- A good test checks external behaviour through the public functions, in the existing styles: API specs test a service through its public methods with the real service and policies on an in-memory fake repository (`src/jobs/jobs.service.spec.ts`, the `src/pipeline` specs), no database; `@repo/shared` tests the pure functions. Web has no test runner and none is added.
- **`@repo/shared`:** the catalog (six keys, none removable: a test that pins the exact keys, like `preset-keys.test.ts`); the criteria-keys schema (valid, over five, duplicates, an unknown key); the save-rating schema (1 and 5 pass; 0, 6, 3.5, a string fail; `criteria` entries 1–5 or `null`; unknown keys refused); the criteria-against-selection check; `summariseRatings` (no ratings gives `average: null` and `count: 0`; the overall average ignores Criteria; each Criterion averages only the Members who scored it; a Criterion nobody scored is absent).
- **API (fake repository):**
  - Criteria save: a manager saves; an interviewer gets 403; an unknown key, over five, or duplicates are 400; saving replaces the list; an empty list clears it; another company's job is 404.
  - Rating: every role can rate; a first rating creates a row and a `rated` event with `previous: null`; a second one replaces it and the event carries the old and new values; a rating on a Rejected Application is allowed; a score for a Criterion not in the Job's selection is 400; a dropped Criterion's old score survives a re-rate; clearing a Criterion score with `null` removes only that one; two Members rate the same Application and both rows exist; another company's or another job's Application is 404; the caller can't rate as someone else.
  - Read: the detail payload lists every Member's Rating with names, the summary averages match, and a Rating whose author is gone shows the fallback name; the board card's `rating` is `{ average: null, count: 0 }` with none and correct with several; the public routes carry no rating fields.
- **Web:** verify in the browser: give and change a rating; clear a Criterion; two accounts see each other's ratings; the sheet, the table column and the card update at once; sort the table by Average rating with an unrated candidate last; an interviewer can rate but doesn't see the Criteria picker; drop a Criterion and see the old scores marked; a phone-width sheet, table and board. Record what was checked.

## Out of Scope

- Removing a whole Rating, or an admin deleting someone else's Rating.
- Filtering by rating, ordering the board by rating, or rating-based auto-move or auto-reject.
- Notifications about ratings, or rating "requests" to a Member.
- A free-text comment on a Rating (Notes stay separate).
- Custom Criteria, Company-wide Criteria defaults, or copying a Job's Criteria to another Job.
- Weights, a weighted score, or an overall derived from Criteria.
- Showing ratings to applicants, or on any public route.
- A rating history screen (the history is in the Application's event list; a dedicated view is later).
- A test setup for the web app.

## Further Notes

- Suggested vertical slices, to make tickets from: (1) the shared catalog and rules; (2) the Job stores and saves its Criteria; (3) a Member rates an Application (API); (4) the detail payload carries ratings and the summary; (5) a manager picks Criteria (web); (6) the sheet shows and takes ratings (web); (7) the card and table show the Average rating, with the sort; (8) verification pass and docs sweep. These are the tickets in `.scratch/ratings/issues/`.
- Per the working agreement in `CLAUDE.md`, each ticket should name the doc it relied on for every library call (`apps/api/prisma-8.md` for the contract and queries, `apps/web/node_modules/@tanstack/table-core` for sorting, the Base UI docs for the controls).
- The glossary's Application Event entry already mentions "rating given or changed"; keep it in step with the event name if that changes. (The event shipped as `rated`; the entry's plain words still match.)

**Follow-up notes after the build (ticket 08).** Where the shipped feature differs from, or settles something the spec left open:

- **Board card with no ratings shows nothing**, not "No ratings". The spec says the card carries "the same" label; the table says "No ratings" (story 17). Chosen in ticket 07 so a new board stays as quiet as before; a one-line change in `candidate-card.tsx` if the owner prefers the label on every card.
- **The table label has a filled star** before the one-decimal average and the count ("4.2 (3)"), and an sr-only sentence ("Average rating 4.2 from 3 ratings") for screen readers.
- **Criterion rows are disabled until the viewer has an overall**, with a line saying so (ticket 06): the API requires `overall` on every save and the spec says it is never derived, so a Criterion score cannot be sent alone. The control sends the overall plus only the one Criterion that changed; the API carries the rest over.
- **A `null` (clear) for a Criterion the Job no longer uses is a 400**, like a score for one (ticket 01 choice): the request only addresses the Job's current Criteria, so a dropped Criterion's old score can be neither changed nor cleared. Spec story 9 (clearing) applies to the Criteria in use.
- **"Former member" appears only when the author's user row is deleted** (`ratings.user_id` SET NULL). A Member who is merely removed from the company keeps their `user_id` and their real name on the Rating (checked in the browser pass). Spec story 19 ("a Rating stays and still counts when its author leaves the company") holds for both.
- **The 409 on a unique violation is defensive only.** The upsert is `INSERT ... ON CONFLICT DO UPDATE`, so the (application, user) key cannot raise 23505; two tabs rating for the first time end as two events (the second's `previous` points at the first), the last-write-wins trade the spec accepted. The catch stays as the spec asked and the test fakes the error.
- **The board's grouped read is skipped when the Job has no Applications** (there are no ids to ask about); with Applications but no Ratings it runs once and returns nothing. Ticket 07's text said it "still runs once with none"; its Answer and `.claude/rules/api.md` describe what the code does, which is the better behaviour, so the ticket text is the stale part.
- **The stored order of a Job's Criteria is whatever the request sends**, and the web picker always sends catalog order (the picker's ticket 05 choice), so the list does not depend on click order. `docs/db-schema.md` §3.5 now says so; an earlier line said "the order the manager picked them".
- **Database shape details:** adding `rated` to `application_events.type` *replaced* the CHECK (drop, then add: a "destructive" class in the planner, no data touched; apply with `--no-interactive --confirm <db>`); `ratings` also has Prisma's automatic `(user_id)` index and an `(application_id)` index that duplicates the UNIQUE's leading column.
- **Detail payload:** Ratings are ordered by `created_at` (first rater first; a re-rate does not move a row), and a Rating's `userId` is `null` when the author's user is gone.
- **History lines** (web, `activity-items.ts`) name the rater through the detail's `ratings` list (events carry only `actorId`), so the lookup would miss, and read "Former member", only if Ratings ever become removable.
- **Not built or not reachable:** a `withdrawn` Application cannot be produced yet (no Stage kind writes it), so only Rejected and Hired were exercised; rating is status-blind in the code.
- **Seen, not caused by ratings:** switching the Table/Board toggle client-side logs "`NaN` is an invalid value for the `left` css style property" once (it did not appear on a fresh load of the table, the board or the open sheet). Not traced; most likely the view toggle's highlight animation, which predates this feature.
