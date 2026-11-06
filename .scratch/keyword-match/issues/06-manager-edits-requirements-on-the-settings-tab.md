# 06: Manager edits Requirements on the Settings tab

**What to build:** The Requirements section on the Job's Settings tab. Spec: `.scratch/keyword-match/spec.md` ("Web").

- A list editor for text, tier and keywords, with the caps shown and enforced, saved with the `PUT` from ticket 03.
- Helper text that editing leaves existing results alone until Re-check, and that CV matching never rejects.
- Follows the Screening rules and Rating criteria sections' layout and save pattern.

**Blocked by:** 03.

**Status:** open

- [ ] Add, edit, reorder and remove Requirements; tier toggles; keywords as an editable list
- [ ] The caps are enforced with clear messages from the shared validator
- [ ] Saving an unchanged list does not create a version (no visible change)
- [ ] `pnpm lint`, `pnpm check-types` and both test suites pass
