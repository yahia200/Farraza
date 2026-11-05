# 06: Autofill Preset-keyed Questions

**What to build:** Links and location read from the CV fill the matching Preset-keyed Questions on the apply form, wherever the recruiter put them and whatever they were relabelled. Spec: `.scratch/cv-autofill/spec.md`; ADR-0004; glossary **Preset key**, **Autofill**.

- The reader and notice from ticket 05 apply suggestions for LinkedIn, GitHub, portfolio and location to Questions carrying the matching Preset key, only when that Question's answer is empty.
- A Question with no Preset key (built by hand) is never touched.
- Each value is validated against the Question's own type and limits before it is applied, and the notice and Undo from ticket 05 cover these too.

**Blocked by:** 03, 05.

**Status:** ready-for-agent

- [ ] A form with the four contact Presets gets them filled from a CV that has those links
- [ ] A relabelled or reordered Preset Question is still found and filled
- [ ] A hand-built "LinkedIn" Question with no Preset key is left empty
- [ ] An invalid or over-long suggestion is not applied
- [ ] Undo and the untouched-suggestion tracking from ticket 05 work for these answers
- [ ] Verified in the browser with a sample CV
