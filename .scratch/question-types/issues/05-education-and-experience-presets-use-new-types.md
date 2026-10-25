# 05: Education and Experience Presets use the new types

**What to build:** The Education Preset asks its start and end year as numbers, and the Experience Preset asks its start and end date as dates, with the end date optional. Spec: `.scratch/question-types/spec.md`; decision record: ADR-0004 (with its one-time exception note). Use the glossary terms Preset, Preset key and Repeating group.

In `packages/shared/src/preset-keys.ts` retype in place: `education.start_year` and `education.end_year` become `number`, `experience.start_date` and `experience.end_date` become `date`. This breaks the file's append-only rule once, because no form has been published. **Before changing it, confirm with the owner that no form has been published in any environment**; if one has, add new keys instead and leave the old ones, and record that under "## Comments". Update the header comment in `preset-keys.ts` to point at the ADR-0004 note.

In `apps/web/components/dashboard/jobs/form-builder/presets.ts`: Education's years are whole numbers from 1950 to 2100; Experience's start date is required and its end date is optional with the help text it already has ("Leave blank if you still work here."). Drafts in the dev database built from the old text Presets will fail the catalog check; delete or re-insert them by hand, with no migration code.

**Blocked by:** 01, 02, 03, 04.

**Status:** ready-for-agent

- [ ] Owner has confirmed nothing is published anywhere (or the fallback of new keys is used and recorded)
- [ ] The catalog types for the four keys are changed and the header comment points at ADR-0004
- [ ] Education inserts with number year questions (whole numbers, 1950 to 2100); Experience inserts with date questions, the end date optional
- [ ] Old drafts built from the text Presets are removed or re-inserted in the dev database
- [ ] An applicant can fill both Presets on one form, with the right inputs per Entry, and the candidate sheet shows the years and dates correctly
- [ ] Preset-key tests in the shared package assert the new types and a key on the wrong type is still refused
- [ ] Checked in the browser pane through the whole path (insert, save, publish, apply, review) with both Presets on one form; no console errors
- [ ] `docs/db-schema.md` matches (catalog table, Preset definitions, the "Later features" line about the three types) and `.claude/rules/api.md` and `.claude/rules/web.md` describe the retyping
- [ ] `pnpm lint`, `pnpm check-types` and `pnpm --filter @repo/shared test` pass

## Comments

### Owner decision (2026-10-25)

Owner confirmed nothing is published in any environment. Retype the four Preset keys in place (no new keys).
