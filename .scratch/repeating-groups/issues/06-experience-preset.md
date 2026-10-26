# 06: Experience preset

**What to build:** Recruiters can add the **Experience** Preset, and it works through the builder, the apply page and the candidate sheet. Spec: `.scratch/repeating-groups/spec.md`; decision record: ADR-0004. Use the glossary terms Preset, Repeating group and Entry.

This ticket tests the claim that a new Preset is data, not a code path. Adding it should need only its definition (group "Work experience", optional, up to 5 Entries; Job title, Company, Start date, End date, "What you did there", as in the spec) and its menu entry; the catalog keys already exist from ticket 02. If you find you need to change the builder card, the apply step, the candidate sheet or the shared rules to make it work, stop and record what you needed and why as a finding in this file under a "## Findings" heading, because it means an earlier ticket's design leaked a Preset-specific assumption.

**Blocked by:** 05.

**Status:** resolved

- [x] The "Presets" group lists Education and Experience; each is greyed out while it is on the form, independently of the other
- [x] Inserting Experience creates the group with fresh ids and its Preset keys; both Presets can be on the same form
- [x] The end-date help text says a blank end date means a current job, and there is no "currently work here" question
- [x] Both Presets together count as two questions toward the form's question limit
- [x] An applicant can add several jobs on the apply page, with the required Job title, Company and Start date enforced per Entry
- [x] The candidate sheet shows the jobs as blocks, with the long "What you did there" answer readable
- [x] Checked in the browser pane through the whole path (insert, save, publish, apply, review) with both Presets on one form; the pane shows no console errors
- [x] Any change outside the Preset definition and menu is recorded under "## Findings" with the reason, or the section states that none was needed
- [x] `pnpm lint` and `pnpm check-types` pass

## Findings

None needed. Adding Experience took only its definition in `apps/web/components/dashboard/jobs/form-builder/presets.ts` (one `experience` const, a small `longText` helper beside the existing `shortText`, and `PRESETS = [education, experience]`). The "Add question" menu already maps over `PRESETS`, so its entry (label "Work experience", `BriefcaseBusinessIcon`) and its greying-out by `presetKey` came with the array element. No change to the builder card, the apply step, the candidate sheet, the shared rules or the catalog (the six Experience keys already existed from ticket 02).

Checked in the browser on a scratch database with both Presets on one form, with no SQL shortcuts:

- The menu greys each Preset out independently (Education alone, then Work experience alone, then both). The two groups count as two toward `MAX_FIELDS`: 48 short-text questions added to them left the trigger enabled at 49 and disabled at 50.
- The first shipped Preset with a long-text sub-question works inside the builder row (shows the type), the apply card (a textarea with "0 / 1,500 characters"; Enter adds a line and does not advance or submit) and the candidate sheet (line breaks and a blank line kept, the long answer wraps in the block).
- Required Job title, Company and Start date are enforced per Entry on the apply page; a blank End date and a blank description are left out of the stored Entry, and a stray blank third card is dropped.
- End date help text reads "Leave blank if this is your current job" There is no "currently work here" question.
