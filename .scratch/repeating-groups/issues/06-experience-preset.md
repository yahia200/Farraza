# 06: Experience preset

**What to build:** Recruiters can add the **Experience** Preset, and it works through the builder, the apply page and the candidate sheet. Spec: `.scratch/repeating-groups/spec.md`; decision record: ADR-0004. Use the glossary terms Preset, Repeating group and Entry.

This ticket tests the claim that a new Preset is data, not a code path. Adding it should need only its definition (group "Work experience", optional, up to 5 Entries; Job title, Company, Start date, End date, "What you did there", as in the spec) and its menu entry; the catalog keys already exist from ticket 02. If you find you need to change the builder card, the apply step, the candidate sheet or the shared rules to make it work, stop and record what you needed and why as a finding in this file under a "## Findings" heading, because it means an earlier ticket's design leaked a Preset-specific assumption.

**Blocked by:** 05.

**Status:** ready-for-agent

- [ ] The "Presets" group lists Education and Experience; each is greyed out while it is on the form, independently of the other
- [ ] Inserting Experience creates the group with fresh ids and its Preset keys; both Presets can be on the same form
- [ ] The end-date help text says a blank end date means a current job, and there is no "currently work here" question
- [ ] Both Presets together count as two questions toward the form's question limit
- [ ] An applicant can add several jobs on the apply page, with the required Job title, Company and Start date enforced per Entry
- [ ] The candidate sheet shows the jobs as blocks, with the long "What you did there" answer readable
- [ ] Checked in the browser pane through the whole path (insert, save, publish, apply, review) with both Presets on one form; the pane shows no console errors
- [ ] Any change outside the Preset definition and menu is recorded under "## Findings" with the reason, or the section states that none was needed
- [ ] `pnpm lint` and `pnpm check-types` pass
