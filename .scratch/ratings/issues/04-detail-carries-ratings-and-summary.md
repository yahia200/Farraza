# 04: The Application detail carries its Ratings and summary

**What to build:** `GET .../applications/:id` returns every Member's Rating and the summary, so the sheet can show them. No UI yet. Spec: `.scratch/ratings/spec.md` ("API: Read").

- **Payload:** `ratings: [{ userId, name, overall, criteria, updatedAt }]` (oldest first) and `ratingSummary` from `summariseRatings`. `name` is the author's name, or "Former member" when the author's user is gone (`user_id` is null). Dropped Criteria's scores are included as stored.
- **Access:** unchanged (membership guard plus job lookup, no policy), so interviewers see all of it.
- **Query:** one query for the Application's Ratings joined to the author's name, filtered by company, job and Application; never a query per Rating.
- **Public routes:** confirm no public payload carries a Rating field and pin that with a test.

**Blocked by:** 03.

**Status:** ready-for-agent

- [ ] The detail lists every Member's Rating with names and the summary matches
- [ ] A Rating whose author is gone shows "Former member" and still counts
- [ ] An Application with none returns `ratings: []` and `{ count: 0, average: null, criteria: {} }`
- [ ] An interviewer gets the same payload as a recruiter
- [ ] Another company's Application is 404 (no ratings leak)
- [ ] The public payloads contain no rating fields (test)
- [ ] Service specs on the in-memory fake repository
- [ ] `.claude/rules/api.md` and `docs/db-schema.md` updated where they describe the detail payload
- [ ] `pnpm lint` and `pnpm check-types` pass

## Comments

## Answer
