# 08: Autofill Education and Experience groups

**What to build:** Entries read from the CV fill the apply form's Education and Experience Repeating groups, but only when the applicant hasn't started them. Spec: `.scratch/cv-autofill/spec.md` ("Web"); ADR-0004; glossary **Repeating group**, **Entry**, **Autofill**.

- A group with no Entries yet gets one card per suggested Entry, up to its `maxEntries`. A group that already has any Entry is left alone entirely: Autofill never adds to or mixes into what the applicant typed.
- The "Filled from your CV" notice and Undo cover groups too: Undo removes the untouched suggested cards and keeps any the applicant edited.
- Suggested cards are ordinary editable cards; the group step's existing rules (required, blank cards, keyboard handling) are unchanged.

**Blocked by:** 05, 07.

**Status:** resolved

- [ ] A CV with two schools and three jobs fills two Education cards and three Experience cards (within `maxEntries`)
- [ ] A group with an Entry already typed or started is not changed
- [ ] Undo removes untouched suggested cards and keeps edited ones
- [ ] The submitted answers are exactly what `parseAnswers` takes (no client-only format), and a required group still blocks Next when only blank cards remain
- [ ] A CV with nothing recognisable leaves the groups as they were
- [ ] Verified in the browser with a sample CV
