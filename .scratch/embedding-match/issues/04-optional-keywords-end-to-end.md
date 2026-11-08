# 04: Optional keywords, end to end

**What to build:** A manager can save a Requirement with only its sentence. Layer 2 treats a keyword-less Requirement as "not checked": it is not a miss, it never raises "Missing must-have", and the sheet says so. The editor tells the manager what a keyword-less Requirement does, and adds one line of help text: describe the skill, not the level. Spec: `.scratch/candidate-matching/layer3-spec.md` (stories 7 to 10); the Layer 2 spec (`.scratch/keyword-match/spec.md`) is changed by this.

- The Requirement schema accepts an empty keyword list; versions already stored stay valid, and the caps are otherwise unchanged.
- The matcher reports "not checked" for a Requirement with no keywords, and the missed-must-have rule ignores it. An Application checked before this change reads as before.
- The Settings tab editor no longer demands a keyword, shows a note on a keyword-less Requirement (only Layer 3 looks at it, when it is available), and shows the help text about describing the skill and putting years in a Screening rule.
- The sheet's Requirements section shows "Not checked" for such a Requirement. The board card, table row and sheet markers behave as before.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The schema and matcher tests cover an empty keyword list, "not checked", and a must-have with no keywords never setting the marker
- [ ] Saving a Requirement with no keywords succeeds through the API and creates a new version
- [ ] The editor and the sheet show the note and "Not checked", checked in a browser
- [ ] Re-check treats a keyword-less Requirement correctly (no marker, no failure)
- [ ] The Layer 2 spec gets a short note that keywords are now optional
- [ ] `pnpm lint`, `pnpm check-types`, `pnpm --filter @repo/shared test` and `pnpm --filter api test` pass
