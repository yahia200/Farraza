# 12: Cutoff testing on real CVs (URGENT before release)

**What to build:** Replace the placeholder strong and weak cutoffs and the instruction wording with values tested on real CVs, so a label never misleads a reviewer. This is the owner's judgement, helped by a repeatable scoring script. Plan: `.scratch/candidate-matching/layer3-embeddings-notes.md` ("URGENT: cutoff testing"); spec open item 1.

- The owner provides 10 to 20 real CVs (kept out of git, see the commit that ignores real CVs) and a few real Requirements. For each Requirement the owner marks each CV as clearly satisfies, clearly does not, or borderline.
- A throwaway script (not committed with real data) scores every CV against every Requirement with the scoring service from ticket 06 and prints the scores per group. Where the groups overlap is recorded, because some will.
- The cutoffs are moved until the labels match the marks as well as they can, and the instruction wording is compared at the same time (the current wording against the variants in the notes). Also test the Requirement list against a matching description on the same CVs if the owner wants that answered.
- The result and its limits are written into the notes file, and the shared constants are updated. If no cutoffs separate the groups well, report that plainly: the labels may need to be dropped or the model changed.

**Blocked by:** 06 (an Application can be scored).

**Status:** resolved (constants applied; one rater and one Job, see the Answer)

- [ ] The owner has marked the CVs for each Requirement
- [ ] Scores per group and the overlap are written into the notes file
- [ ] The strong and weak constants, and the prefix wording, are updated with the reasoning recorded
- [ ] The placeholders in the spec and the backlog item are replaced by the tested values, or marked as failed
- [ ] Any real CV stays out of git (check `git status` before committing)

## Answer

Run on 2026-11-09 with 38 software-developer CVs x 8 keyworded Requirements (304 cells), qwen3-embedding:0.6b, leave-one-CV-out. Ground truth is one rater (Claude, from the text layer), not the owner's marks, so treat it as a first calibration. The CVs and scripts are git-ignored and exist only on the owner's machine (`test/cvs/`).

- Old placeholders (strong 0.65, weak 0.50): balanced accuracy 0.37; 1 of 101 strong cells came out strong.
- Applied: `SCORE_STRONG_MIN = 0.47`, `SCORE_WEAK_MAX = 0.415` in `packages/shared/src/embedding-match.ts`. Leave-one-CV-out balanced accuracy 0.62 (accuracy 0.67); strong minimum 0.47 in all 38 folds, weak maximum 0.40 to 0.42.
- Instruction prefix: kept. Removing it costs about 0.13 balanced accuracy; four other wordings are within noise (AUC 0.854 to 0.864). Chunk size left alone (not a proven win).
- Ranking: Spearman 0.81 against the rater's rank, top 10 overlap 8 of 10.
- Limits: embeddings rank topic, not level (two students rated 2 came out 6th and 7th; QA CVs score strong on an automated-tests Requirement). Not tested: a bigger Qwen3 model, experience-only chunks, more labelled Jobs, the owner's own marks.
