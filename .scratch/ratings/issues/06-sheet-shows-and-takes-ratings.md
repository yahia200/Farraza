# 06: The Application sheet shows and takes Ratings

**What to build:** In the Application detail sheet, a Member sees everyone's Ratings and the per-Criterion averages and can give or change their own. Spec: `.scratch/ratings/spec.md` ("Web: Sheet").

- **Own Rating control:** the overall as five buttons (1 to 5), then a row per Criterion the Job currently uses, each also five buttons and each clearable. A change saves at once through a Server Action calling `PUT .../rating`. Check the Base UI docs under `apps/web/node_modules/@base-ui/react/docs/` for a toggle group before picking the component (spec "Confirmed details", item 5: five 1 to 5 buttons).
- **Everyone's Ratings:** a row per Member with name, overall, each Criterion score and the date; Criteria no longer used are marked "no longer used". Show the per-Criterion averages and the Average rating with its count.
- **Data:** the DAL (`lib/dal.ts`) types and mapping for `ratings` and `ratingSummary` from ticket 04; revalidate the sheet and the board after a save.
- An empty state ("No ratings yet") and keyboard and screen-reader access for the buttons.

**Blocked by:** 03, 04.

**Status:** ready-for-agent

- [ ] A Member gives an overall rating, changes it, and sees it saved at once
- [ ] Scoring and clearing a Criterion works; the overall can't be cleared
- [ ] Two accounts see each other's Ratings by name
- [ ] A Criterion the Job dropped shows its old scores marked "no longer used" and offers no new entry
- [ ] An interviewer can rate
- [ ] A Rejected Application can still be rated
- [ ] Phone-width sheet checked in the browser, and what was checked recorded
- [ ] `.claude/rules/web.md` updated
- [ ] `pnpm lint` and `pnpm check-types` pass

## Comments

## Answer
