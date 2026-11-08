# 12: Cutoff testing on real CVs (URGENT before release)

**What to build:** Replace the placeholder strong and weak cutoffs and the instruction wording with values tested on real CVs, so a label never misleads a reviewer. This is the owner's judgement, helped by a repeatable scoring script. Plan: `.scratch/candidate-matching/layer3-embeddings-notes.md` ("URGENT: cutoff testing"); spec open item 1.

- The owner provides 10 to 20 real CVs (kept out of git, see the commit that ignores real CVs) and a few real Requirements. For each Requirement the owner marks each CV as clearly satisfies, clearly does not, or borderline.
- A throwaway script (not committed with real data) scores every CV against every Requirement with the scoring service from ticket 06 and prints the scores per group. Where the groups overlap is recorded, because some will.
- The cutoffs are moved until the labels match the marks as well as they can, and the instruction wording is compared at the same time (the current wording against the variants in the notes). Also test the Requirement list against a matching description on the same CVs if the owner wants that answered.
- The result and its limits are written into the notes file, and the shared constants are updated. If no cutoffs separate the groups well, report that plainly: the labels may need to be dropped or the model changed.

**Blocked by:** 06 (an Application can be scored).

**Status:** ready-for-human

- [ ] The owner has marked the CVs for each Requirement
- [ ] Scores per group and the overlap are written into the notes file
- [ ] The strong and weak constants, and the prefix wording, are updated with the reasoning recorded
- [ ] The placeholders in the spec and the backlog item are replaced by the tested values, or marked as failed
- [ ] Any real CV stays out of git (check `git status` before committing)
