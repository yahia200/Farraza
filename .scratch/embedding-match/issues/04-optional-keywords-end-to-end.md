# 04: Optional keywords, end to end

**What to build:** A manager can save a Requirement with only its sentence. Layer 2 treats a keyword-less Requirement as "not checked": it is not a miss, it never raises "Missing must-have", and the sheet says so. The editor tells the manager what a keyword-less Requirement does, and adds one line of help text: describe the skill, not the level. Spec: `.scratch/candidate-matching/layer3-spec.md` (stories 7 to 10); the Layer 2 spec (`.scratch/keyword-match/spec.md`) is changed by this.

- The Requirement schema accepts an empty keyword list; versions already stored stay valid, and the caps are otherwise unchanged.
- The matcher reports "not checked" for a Requirement with no keywords, and the missed-must-have rule ignores it. An Application checked before this change reads as before.
- The Settings tab editor no longer demands a keyword, shows a note on a keyword-less Requirement (only Layer 3 looks at it, when it is available), and shows the help text about describing the skill and putting years in a Screening rule.
- The sheet's Requirements section shows "Not checked" for such a Requirement. The board card, table row and sheet markers behave as before.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] The schema and matcher tests cover an empty keyword list, "not checked", and a must-have with no keywords never setting the marker
- [x] Saving a Requirement with no keywords succeeds through the API and creates a new version
- [ ] The editor and the sheet show the note and "Not checked", checked in a browser
- [x] Re-check treats a keyword-less Requirement correctly (no marker, no failure)
- [x] The Layer 2 spec gets a short note that keywords are now optional
- [x] `pnpm lint`, `pnpm check-types`, `pnpm --filter @repo/shared test` and `pnpm --filter api test` pass

## Answer

Commit `2bc21cb` on branch `worktree-agent-a5eedb9ff2b58e667`. Built test-first (shared, then API specs, red before green).

Decisions:
- "Not checked" is `matched: null` on `RequirementMatch` (the spec wording), not a new field. Results stored earlier hold a boolean and read as before.
- `missedMustHave` ignores a must-have with no keywords, whether or not a result is stored for it; a Requirement with keywords and no result is still a miss, as before.
- The detail payload reports `matched: null` for a keyword-less Requirement even when no verdict is stored, so the sheet never says "Not matched" for it.
- Re-check needed no code change: it calls `matchRequirements` and `missedMustHave`, which now handle the case (spec in `recheck.service.spec.ts`).
- Editor: the keyword fieldset is titled "Keywords (optional)" with a note when empty; the description box has the help line (skill, not level; years go in a Screening rule); the placeholder "3+ years of TypeScript" was changed because it contradicted that line.

Open items:
- The browser box is unticked; see the steps below.
- The editor note says "Only the match score (when it is available) looks at it": reword if Layer 3 ships under another name.

Needs the owner (browser check): run the API and web apps, open a Job Settings tab, add a Requirement with only a sentence and Save (a new version is created). Confirm the card shows the "No keywords" note and the help line under the description. Submit an Application with a readable CV to that Job and open its sheet: the Requirements section shows "Not checked" with a minus icon, and no "Missing must-have" marker appears on the card, row or sheet even though the Requirement is a must-have. Click Re-check and confirm no error and no marker. Check at 1024px and 375px.
