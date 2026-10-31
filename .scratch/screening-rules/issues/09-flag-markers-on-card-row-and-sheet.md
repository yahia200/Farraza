# 09: Flag markers on card, row and sheet

**What to build:** Reviewers see which Applications are flagged and why. Spec: `.scratch/screening-rules/spec.md` ("Web", user stories 14 to 16).

- A marker on the board card and the table row for an Application with flags. On the board card it sits outside the card's link, as a sibling, like the other interactive card parts (see the trail learning on card actions).
- The candidate sheet lists each flag's reason.
- An auto-rejected Application's sheet shows which rules fired and any flags it also tripped, taken from its events.
- No "flagged only" filter yet.
- Markers are visible to Members only, and never on the apply page.

**Blocked by:** 05.

**Status:** ready-for-agent

- [ ] A flagged Application shows the marker on the card and the row; an unflagged one shows none
- [ ] The sheet lists every reason; renamed questions or edited rules don't change a shown reason
- [ ] An auto-rejected Application shows the rules that fired, and flags too when both applied
- [ ] The marker is accessible (not colour alone) and works in both themes and at phone width
- [ ] Clicking the marker does not trigger the card's link or break the Move control
- [ ] Browser check recorded in the Answer; `.claude/rules/web.md` updated
- [ ] `pnpm lint` and `pnpm check-types` pass
