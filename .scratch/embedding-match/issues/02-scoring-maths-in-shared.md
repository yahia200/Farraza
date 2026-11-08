# 02: Scoring maths in shared

**What to build:** The pure logic of Layer 3 in `@repo/shared`, with tests and no database or model: cut a CV's text into chunks, score an Application's chunk vectors against a Job's Requirement vectors, and turn a score into a band. Spec: `.scratch/candidate-matching/layer3-spec.md` ("Shared").

- Named placeholder constants: chunk size about 400 tokens with 50 tokens of overlap (counted in characters, about 4 per token), a chunker version, the nice-to-have weight (0.1; must-have is 1.0), the strong cutoff (0.65), the weak cutoff (0.50), and the query instruction text. All are labelled placeholders; the cutoffs are tested in ticket 12.
- The chunker cuts overlapping fixed windows and drops blank ones.
- The scorer takes the best dot product over a CV's chunks for each Requirement, and the overall number is the weighted mean over all Requirements. It refuses vectors whose model or length differ (an error result, never a number).
- `bandOf` returns strong, related or weak, and the boundaries are tested. No band or threshold is stored anywhere.
- Rebuild the package so the API sees it (`pnpm --filter @repo/shared build`).

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The chunker is tested for window size, overlap, a short CV (one chunk), an empty text, and blank windows
- [ ] The scorer is tested for best-chunk selection, must-have against nice-to-have weighting, an empty Requirement list, and a refusal on mixed model or length
- [ ] `bandOf` is tested exactly at and either side of both cutoffs
- [ ] The constants are exported with a comment saying they are placeholders
- [ ] `pnpm lint`, `pnpm check-types` and `pnpm --filter @repo/shared test` pass
