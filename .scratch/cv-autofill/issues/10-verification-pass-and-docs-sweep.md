# 10: Verification pass and docs sweep

**What to build:** Prove CV autofill and stored CV text work on real CVs, tune the placeholders, and bring the docs up to date. Spec: `.scratch/cv-autofill/spec.md`; ADR-0006.

**Needs the owner:** 8 to 10 anonymised sample CVs (PDF and DOCX, different layouts, including one scanned). They contain personal data, so they live in a git-ignored fixtures folder with a README listing what each one is; committed tests use only invented text. This ticket is `ready-for-human` until they are supplied.

- Run every sample through the browser reader by hand; record what is filled, what is wrong and what is missed for contact, links, Education and Experience.
- Tune the unreadable threshold and, if ticket 01 left room, the cap; fix heuristics that misfire (with a new invented-text test for each fix and a bumped extractor version).
- Confirm in the database that each submitted sample stored one row with the right status, and that no Member screen or payload shows any of it.
- Docs sweep: the applied-schema doc (table, rules, the old "later parse table" note), the API and web rules files, the backlog (the CV autofill item and the Layer 2 text-extraction note, so Layer 2 knows the text already exists and is applicant-supplied), and the candidate-matching layers note.

**Blocked by:** 04, 06, 08, 09. Also needs the sample CVs from the owner.

**Status:** ready-for-human

- [ ] Sample CVs are in a git-ignored folder with a README; none is committed
- [ ] Each sample was run through the apply form; the results are recorded and the worst misses are fixed or listed as known limits
- [ ] The threshold and cap are final numbers with a stated reason
- [ ] Each submitted sample stored exactly one CV text row, and no dashboard screen or API payload shows CV text or anything derived from it
- [ ] The docs listed above are updated and agree with the code
- [ ] `pnpm build`, `pnpm lint`, `pnpm --filter @repo/shared test` and `pnpm --filter api test` pass
