# 09: Flag markers on card, row and sheet

**What to build:** Reviewers see which Applications are flagged and why. Spec: `.scratch/screening-rules/spec.md` ("Web", user stories 14 to 16).

- A marker on the board card and the table row for an Application with flags. On the board card it sits outside the card's link, as a sibling, like the other interactive card parts (see the trail learning on card actions).
- The candidate sheet lists each flag's reason.
- An auto-rejected Application's sheet shows which rules fired and any flags it also tripped, taken from its events.
- No "flagged only" filter yet.
- Markers are visible to Members only, and never on the apply page.

**Blocked by:** 05.

**Status:** resolved

- [ ] A flagged Application shows the marker on the card and the row; an unflagged one shows none (built; browser check pending)
- [x] The sheet lists every reason; renamed questions or edited rules don't change a shown reason (stored text; by code, not seen in browser)
- [ ] An auto-rejected Application shows the rules that fired, and flags too when both applied (built; browser check pending)
- [ ] The marker is accessible (not colour alone) and works in both themes and at phone width (built; browser check pending)
- [ ] Clicking the marker does not trigger the card's link or break the Move control (sibling of the link; browser check pending)
- [ ] Browser check recorded in the Answer; `.claude/rules/web.md` updated (web.md done; browser check deferred)
- [x] `pnpm lint` and `pnpm check-types` pass

## Answer

Built. `FlagMarker` (`apps/web/components/dashboard/candidates/flag-marker.tsx`) shows on the board card (own row, sibling of the card link, above the Move select) and under the email in the table's Candidate cell. Pure display logic (`screeningDisplay`, `flagMarkerLabel`) is in `packages/shared/src/screening-display.ts` with 7 tests (both event shapes, flags from the column vs the `flagged` event, both outcomes, unreadable data). The sheet shows a warning Alert with every stored reason, the auto-rejected Alert lists the rules that fired with reasons, and the history has a `flagged` line. Pattern followed: Base UI `Tooltip` from `components/ui/tooltip.tsx` (as the Highlighted column header in `columns.tsx`); tooltips are off on touch, so the sheet lists the reasons there. `.claude/rules/web.md` updated.

**Browser check deferred** (the worktree has no `.env`; the orchestrator does it from the main folder), so those boxes stay unticked.

Checked: `pnpm lint`, `pnpm check-types`, shared tests, `tsc --noEmit` in `apps/web`.
