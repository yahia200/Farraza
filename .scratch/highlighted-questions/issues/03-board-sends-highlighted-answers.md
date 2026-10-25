# 03: The board sends the Highlighted answers

**What to build:** The board response carries the Job's Highlighted questions and, for each Application, the display-ready answer to each one, resolved against that Application's own form version. No UI yet. Spec: `.scratch/highlighted-questions/spec.md` ("API").

- `GET .../jobs/:jobSlug/applications` answers `{ columns, highlightedQuestions }`. `highlightedQuestions` is the stored keys filtered against the latest published form (a key that form no longer has, or that is no longer highlightable, is dropped), in form order, as `{ key, label }` with the latest text. Each card gains `highlights: Record<string, string | null>` keyed by Question key.
- Each Application's text comes from the same-key Question in **its own** form version, through the shared formatter's list variant (ticket 01); a version without that Question gives `null`. In `PipelineRepository.findCards`, read each row's `answers` and `formVersionId`, then fetch the distinct form versions once by id; do not `include('formVersion')` per row. Check `apps/api/prisma-8.md` for what the ORM supports before choosing the query. With nothing left after filtering, don't read answers at all and send `highlights: {}`.
- Same access check as today (interviewers included). Only Highlighted answers leave the API; the detail route is untouched.
- Web side, kept minimal: `getPipelineBoard` (`apps/web/lib/dal.ts`) returns the extra data, and `PipelineCard` / `ApplicationSummary` carry `highlights`. Nothing renders them yet.

**Blocked by:** 01, 02.

**Status:** needs-triage

- [ ] With no Highlighted questions, `highlights` is `{}` on every card and answers are not read
- [ ] With Highlighted questions, each card has only those keys, formatted as display text or `null`
- [ ] An Application on an older form version shows its own applicant's option labels
- [ ] An Application whose version lacks the Question gets `null`
- [ ] A stored key the latest published form no longer has is absent from `highlightedQuestions` and from every card
- [ ] `highlightedQuestions` is in form order with the latest labels
- [ ] Long text is cut at 200 characters
- [ ] Another company's job is 404; an interviewer can read the board
- [ ] Service specs on the in-memory fake repository for every case above
- [ ] The DAL and its types are updated; the existing table and board still render exactly as before
- [ ] `.claude/rules/api.md` updated for the board payload
- [ ] `pnpm lint` and `pnpm check-types` pass

## Comments

## Answer
