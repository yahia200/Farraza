# 04: The Application detail carries its Ratings and summary

**What to build:** `GET .../applications/:id` returns every Member's Rating and the summary, so the sheet can show them. No UI yet. Spec: `.scratch/ratings/spec.md` ("API: Read").

- **Payload:** `ratings: [{ userId, name, overall, criteria, updatedAt }]` (oldest first) and `ratingSummary` from `summariseRatings`. `name` is the author's name, or "Former member" when the author's user is gone (`user_id` is null). Dropped Criteria's scores are included as stored.
- **Access:** unchanged (membership guard plus job lookup, no policy), so interviewers see all of it.
- **Query:** one query for the Application's Ratings joined to the author's name, filtered by company, job and Application; never a query per Rating.
- **Public routes:** confirm no public payload carries a Rating field and pin that with a test.

**Blocked by:** 03.

**Status:** resolved

- [x] The detail lists every Member's Rating with names and the summary matches
- [x] A Rating whose author is gone shows "Former member" and still counts
- [x] An Application with none returns `ratings: []` and `{ count: 0, average: null, criteria: {} }`
- [x] An interviewer gets the same payload as a recruiter
- [x] Another company's Application is 404 (no ratings leak)
- [x] The public payloads contain no rating fields (test)
- [x] Service specs on the in-memory fake repository
- [x] `.claude/rules/api.md` and `docs/db-schema.md` updated where they describe the detail payload
- [x] `pnpm lint` and `pnpm check-types` pass

## Comments

## Answer

Built test-first through `PipelineService.detail` (the real service on an in-memory fake repository; `pipeline.detail.spec.ts`, 10 tests). First run: 5 red (the Rating list, summary, "Former member", empty and interviewer cases), then the minimum code; the cross-tenant 404 cases and the "no policy" and "one read" guards passed at once because they follow from the existing lookups. Seams: `PipelineService.detail` and, for the public routes, the four public methods of `ApplicationsService`. No schema change and no `db update`.

### Choices (owner may want to review)

1. **Where the rules live.** Options: (A) `findDetail` returns the finished payload, with "Former member" and `summariseRatings` applied in the repository; (B, chosen) `findDetail` returns an `ApplicationDetailRow` whose `ratings` are raw `RatingRow`s (`userName: string | null`), and `PipelineService.detail` maps the name and builds the summary; (C) a second repository method `findRatings` called by the service after `findDetail`. B follows ticket 03's choice that rules stay in the service (the fallback label and the summary are rules), so the spec can test them on the fake. C was rejected because it is a second sequential round trip and the ticket asks for one query; B puts the Ratings read in the same `Promise.all` as the events and notes, so it adds no latency. Docs: none for the pattern (app design); the existing `notes` read in `findDetail` is the model.
2. **One query, scoped.** `this.ratings.where({ companyId, applicationId }).include('user').orderBy(createdAt asc).all()`. `Rating` has no `jobId`, so "filtered by company, job and Application" works like this: the Application row is first found by `{ id, companyId, jobId }` (null, so 404, otherwise), and the Ratings query adds `companyId` and `applicationId`. `include('user')` is the same relation load as `Note.author` (`include('author')`) and compiles against `apps/api/src/prisma/contract.d.ts` (`Rating.user`, a nullable `User`). Docs: `apps/api/prisma-8.md` and the generated `contract.d.ts`; I followed the existing `notes` read in the same method.
3. **Checked against the real dev database** (a throwaway spec, deleted, not committed): with an Application from the dev DB I created two Ratings (one with a real user, one with `user_id` NULL), called the real `PipelineRepository.findDetail`, and got the user's name and `null`, `userId` `null` on the second, oldest first, and `null` for a wrong job id; the script then deleted both rows. So the join with a SET NULL author works.
4. **`userId` is `string | null`.** The ticket lists `userId`; a Rating whose author is gone has none, so it is `null` there (the web must treat `null` as "not mine").
5. **Order: `created_at` ascending** ("oldest first": when the Member first rated), not `updated_at`. A re-rate does not move a Rating in the list; `updatedAt` is still sent.
6. **`criteria` is `Record<string, number>`** as stored (no `null` values, dropped Criteria included). The summary averages every stored key that is in the six-key catalog (`summariseRatings` ignores any other key).
7. **Public routes: test only, no code.** The public payloads are built field by field, so there was nothing to remove. `applications.service.spec.ts` ("no Rating reaches the public routes") collects every object key, however deep, in what `getPublicJob`, `listCompanyJobs`, `getCompanyBranding` and `submit` return, and asserts none matches `/rating|criteri/i`. It is a guard (green on arrival, by design); it goes red if someone spreads a Job row into a public payload. It cannot see a route that does not exist yet.
8. **No policy on the detail**, pinned by the spec: the service is built with an `authorize` that throws, so adding a policy call to `detail` fails the test.

### Exact payload

`GET /api/companies/:companySlug/jobs/:jobSlug/applications/:applicationId` is the existing detail plus two fields:

```json
{
  "id": "...", "status": "active", "...": "(existing fields, events and notes unchanged)",
  "ratings": [
    { "userId": "9d0c...", "name": "Sam Reviewer", "overall": 5,
      "criteria": { "communication": 5, "culture_fit": 4 }, "updatedAt": "2026-10-28T17:58:04.488Z" },
    { "userId": null, "name": "Former member", "overall": 2,
      "criteria": { "leadership": 1 }, "updatedAt": "2026-10-20T09:00:00.000Z" }
  ],
  "ratingSummary": {
    "count": 2, "average": 3.5,
    "criteria": {
      "communication": { "count": 1, "average": 5 },
      "culture_fit": { "count": 1, "average": 4 },
      "leadership": { "count": 1, "average": 1 }
    }
  }
}
```

No Ratings: `"ratings": []` and `"ratingSummary": { "count": 0, "average": null, "criteria": {} }`. `average` is unrounded (a float such as `3.6666666666666665`); the web rounds for display. `updatedAt` is an ISO string over JSON. Errors are unchanged: 404 for an unknown or other company's job or Application, or a non-UUID id.

### For tickets 06 and 08

- **Ticket 06 (web DAL and sheet):** add `ratings` and `ratingSummary` (the type `RatingSummary` is exported by `@repo/shared`) to the DAL's detail type and mapping, treating `updatedAt` like the other timestamps in that DAL. Find the caller's own Rating with `ratings.find((r) => r.userId === currentUserId)`; `userId === null` is never the caller. A Rating's `criteria` may hold keys outside `job.ratingCriteria` (dropped Criteria): show those as "no longer used", with labels from `RATING_CRITERIA`. The summary's `criteria` also includes dropped Criteria, so the per-Criterion averages should mark them the same way. After a save, revalidate the detail so this payload refreshes (the save's answer is only the caller's own Rating). `events` now contains `rated` events (`data: { previous, current, stage }`, no stage ids), which the sheet's history must render.
- **Ticket 08 (verification and docs sweep):** check by hand with two accounts: the order (first rater first), a deleted author's Rating shown as "Former member" (delete the user in the dev DB and reopen the sheet), and that an interviewer sees the same list. `docs/db-schema.md` §3.16 and `.claude/rules/api.md` (Pipeline, "Detail payload") are already updated for this ticket; the board card's `rating` is ticket 07's.

### Docs relied on

`apps/api/prisma-8.md` and `apps/api/src/prisma/contract.d.ts` (`include` of a relation, the `Rating.user` relation); the existing `findDetail` notes read in `apps/api/src/pipeline/pipeline.repository.ts` as the pattern; `packages/shared/src/ratings.ts` (`summariseRatings`, `RatingSummary`). The Vitest and Nest patterns follow `pipeline.rating.spec.ts` and `pipeline.board.spec.ts`; I did not re-open their `.d.ts` files this session.

### Files

- Modified `apps/api/src/pipeline/pipeline.ts`: `RatingView`, `RatingRow`, `ApplicationDetailRow`; `ApplicationDetail` gains `ratings` and `ratingSummary`.
- Modified `apps/api/src/pipeline/pipeline.repository.ts`: `findDetail` reads the Ratings joined to the author in its `Promise.all`; new `ratings` getter.
- Modified `apps/api/src/pipeline/pipeline.service.ts`: `detail` maps names ("Former member") and builds the summary.
- Created `apps/api/src/pipeline/pipeline.detail.spec.ts`: 10 service specs on an in-memory fake.
- Modified `apps/api/src/applications/applications.service.spec.ts`: the "no Rating reaches the public routes" test.
- Modified `docs/db-schema.md` (§3.16) and `.claude/rules/api.md` (Pipeline "Detail payload"; one sentence that said the detail was unchanged): the new read.
- Modified `.scratch/ratings/issues/04-detail-carries-ratings-and-summary.md`: status, ticked boxes, this Answer.
