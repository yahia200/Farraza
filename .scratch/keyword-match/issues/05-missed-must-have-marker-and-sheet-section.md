# 05: Missed must-have marker and sheet section

**What to build:** Payloads and UI that show the stored result. Spec: `.scratch/keyword-match/spec.md` ("API", "Web").

- Board and list payloads carry `missedMustHave`; the detail payload carries the per-Requirement results (with each Requirement's text and tier looked up from the referenced version) and a CV state (`readable`, `unreadable`, `failed`, `none`). CV text is never returned.
- A marker on the board card, table row and sheet, visibly distinct from the Screening-rule flag.
- The sheet's Requirements section lists each Requirement with matched or not matched and the terms found; "CV could not be read" for `unreadable` and `failed`; nothing for `none`.
- No filter or sort.

**Blocked by:** 04.

**Status:** resolved

- [x] The marker appears only for a missed must-have, never for a missed nice-to-have
- [x] An unreadable or failed CV never shows a marker or a "not matched" verdict
- [x] No Member or public payload contains CV text (tested)
- [x] Web follows the existing marker and sheet patterns in `.claude/rules/web.md`
- [x] `pnpm lint`, `pnpm check-types` and both test suites pass
