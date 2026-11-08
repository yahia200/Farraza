# 02: Scoring maths in shared

**What to build:** The pure logic of Layer 3 in `@repo/shared`, with tests and no database or model: cut a CV's text into chunks, score an Application's chunk vectors against a Job's Requirement vectors, and turn a score into a band. Spec: `.scratch/candidate-matching/layer3-spec.md` ("Shared").

- Named placeholder constants: chunk size about 400 tokens with 50 tokens of overlap (counted in characters, about 4 per token), a chunker version, the nice-to-have weight (0.1; must-have is 1.0), the strong cutoff (0.65), the weak cutoff (0.50), and the query instruction text. All are labelled placeholders; the cutoffs are tested in ticket 12.
- The chunker cuts overlapping fixed windows and drops blank ones.
- The scorer takes the best dot product over a CV's chunks for each Requirement, and the overall number is the weighted mean over all Requirements. It refuses vectors whose model or length differ (an error result, never a number).
- `bandOf` returns strong, related or weak, and the boundaries are tested. No band or threshold is stored anywhere.
- Rebuild the package so the API sees it (`pnpm --filter @repo/shared build`).

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] The chunker is tested for window size, overlap, a short CV (one chunk), an empty text, and blank windows
- [x] The scorer is tested for best-chunk selection, must-have against nice-to-have weighting, an empty Requirement list, and a refusal on mixed model or length
- [x] `bandOf` is tested exactly at and either side of both cutoffs
- [x] The constants are exported with a comment saying they are placeholders
- [x] `pnpm lint`, `pnpm check-types` and `pnpm --filter @repo/shared test` pass

## Answer

Built test-first in `packages/shared/src/embedding-match.ts` (tests in `embedding-match.test.ts`, 35 cases), exported from `index.ts`, package rebuilt. Commit: see `git log` on branch `worktree-agent-a249fbf6668f9e5ff` (subject `feat(shared): add Layer 3 scoring maths`).

Decisions (the ticket left these open; confirm or change):

- **Window maths.** 400 tokens x 4 characters = 1600-character windows, 200 overlap, so each window starts 1400 after the last. Counted in code points (`Array.from`), so an emoji is never cut in half at a window edge; the cost is negligible at CV sizes. The last window is the one that reaches the end of the text, so no trailing window that only repeats the overlap. A window is dropped when `trim()` is empty; kept chunks are not trimmed. A chunk's index is its position after dropping, which is stable for a given `CHUNKER_VERSION` (value 1).
- **Vector shape.** `EmbeddedVector = { model, vector }`. The length is `vector.length`, not a separate field, so the declared and real length cannot disagree. The API maps its `real[]` rows (which also store `dimensions`) to this.
- **Scorer result.** `{ ok: true, overall, requirements }` or `{ ok: false, reason }`, reason one of `model_mismatch`, `length_mismatch`, `missing_requirement_vector`, `no_chunks`. All vectors compared (the listed Requirements' and every chunk) must share one model and one length; vectors for Requirements not in the list are ignored.
- **Empty Requirement list** is `ok` with `overall: null` and `requirements: {}` (nothing to rank by, and not a failure), not an error. Ticket 06 should store `null`/no score for it.
- **No chunks** with Requirements is a refusal (`no_chunks`), because a best-of-nothing must not turn into a low score. An unreadable CV never reaches the scorer anyway (spec: `not_scored / cv_unreadable`).
- `bandOf`: `>= 0.65` strong, `< 0.50` weak, else related; boundary values tested. `MUST_HAVE_WEIGHT = 1` is an extra exported constant beside `NICE_TO_HAVE_WEIGHT`.
- Not done here (belongs to other tickets): `requirementSchema.keywords` allowing an empty list and `matched: null` (ticket 04), `REQUIREMENT_EDIT_LIMIT` (ticket 05).

Open items: the cutoffs, weights, chunk size and the instruction wording are placeholders until ticket 12 tests them on real CVs. Nothing needs the owner for this ticket.
