# 10: Sort by score

**What to build:** The candidate table gets a "Sort by score" option that puts the most on-topic CVs first. Spec: `.scratch/candidate-matching/layer3-spec.md` (stories 1, 3 and 12).

- The option sorts by the overall score, highest first. Applications that are not scored, or have no score, sort last; ties keep the table's existing order.
- It is disabled, with a short reason, when the Job has no Requirements or nothing is scored yet.
- While the list is unpaginated the web app sorts what it already has, the way the highlighted-question sort does (`highlightSortValue` in `@repo/shared`). Candidate-list pagination is a separate backlog item and will move this sort to the server; leave a note where that will matter.
- The raw score is used for ordering only and is never displayed.

**Blocked by:** 08 (scores in the payloads).

**Status:** ready-for-agent

- [ ] The sort orders scored Applications by score, puts unscored ones last, and is stable for ties (pure-function tests)
- [ ] The option is disabled with no Requirements and with nothing scored, checked in a browser
- [ ] Sorting does not change the board; it applies to the table only
- [ ] `apps/web` lint and type checks pass (`pnpm lint`, `pnpm check-types`)
