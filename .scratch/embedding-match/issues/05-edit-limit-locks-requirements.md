# 05: Edit limit locks Requirements

**What to build:** Once a Job holds 100 Applications (the **Edit limit**), its Requirements can no longer be changed. The save is refused with a plain explanation, the Job says it is locked, and the Settings tab shows the list read-only with the reason. Below the limit everything works as before. Spec: `.scratch/candidate-matching/layer3-spec.md` ("The Edit limit"); glossary: **Edit limit**.

- One constant for every Job (100). Every Application counts, rejected ones included, so the count never goes down. It becomes a per-Job value when tiers arrive (see the backlog item "Job tiers and the Application limit").
- The Requirements save returns a conflict with a message saying why, for any role. Nothing is written.
- The Job payload carries whether the Requirements are locked. Jobs already past the limit are locked as soon as this ships.
- The Settings tab disables editing and shows the reason; the Re-check button still works below and above the limit for Applications that are behind.
- The Layer 2 spec (stories 7 and 8, "edit on any Job status") gets a short note that the Edit limit now bounds them.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A service spec shows a save is allowed at 99 Applications and refused at 100, and that a rejected Application counts
- [ ] A refused save writes no version and leaves the stored list untouched
- [ ] The Job payload's locked flag is correct on both sides of the limit, and no public payload carries it
- [ ] The Settings tab shows the read-only list and the reason, checked in a browser on a Job at the limit
- [ ] `docs/db-schema.md` or the API rules mention the limit where Requirements are described
- [ ] `pnpm lint`, `pnpm check-types` and `pnpm --filter api test` pass
