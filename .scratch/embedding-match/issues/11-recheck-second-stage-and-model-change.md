# 11: Re-check second stage and model-change re-embed

**What to build:** The existing Re-check also brings Applications up to date for Layer 3, and a deliberate command re-embeds Applications after the embedding model changes. Spec: `.scratch/candidate-matching/layer3-spec.md` ("Scoring flow"); the Re-check section of `.claude/rules/api.md`.

- Re-check's count and run also cover non-rejected Applications with a readable CV whose score row is missing or behind the Job's current Requirements version (for example Applications that were not scored because the embedder was down). One button, one progress bar, one run per Job; the stage reuses the scoring service from ticket 06.
- With Layer 3 off, Re-check behaves exactly as it does today.
- Below the Edit limit this catches up after a Requirements edit; past it the Requirements cannot change, so the stage only has work after a failure or a model change.
- A model change leaves Applications as "not scored (model changed)". A separate deliberate command (an ops script, not a button) re-embeds them: it is idempotent, chunked, safe to rerun, and reports how many it touched. It never runs by itself.

**Blocked by:** 06 (an Application can be scored).

**Status:** resolved

- [x] Service specs with the fake repository and queue: the count includes missing and behind scores, skips rejected and unreadable Applications, and is zero with Layer 3 off
- [x] A run scores a not-scored Application once the embedder is back, and a restart mid-run only redoes what is missing
- [x] The re-embed command is tested on a model change: it clears the old vectors for an Application, embeds again, and rerunning it changes nothing
- [ ] A manual run: stop Ollama, submit an Application, start Ollama, click Re-check, see it scored
- [x] `.claude/rules/api.md` describes the second stage and the command
- [x] `pnpm lint`, `pnpm check-types` and `pnpm --filter api test` pass

## Answer

Built test-first on branch `worktree-agent-a2b2c7c2d4f18c255`, on top of tickets 06, 07 and 08.

**Re-check second stage.** With Layer 3 on, `RecheckService.count`, `start` and `run` use `RecheckRepository.countNeedingWithScores` / `findNeedingWithScores` (raw SQL, an extra LEFT JOIN of `application_match_scores`). An Application is selected when its keyword result is missing or behind (as before) or its score is needed: no row, `requirements_version` behind, `pending` for 15 minutes or more (`PENDING_STALE_MINUTES`; ticket 07's worker can leave a row `pending` after a final database error), or `not_scored / embedder_failed`. `model_changed` is left to the command. Each Application counts once, so the count and `processed / total` stay in Applications. `run` does the keyword step, then calls `EmbeddingMatchService.score` inline (nothing is queued, so no second producer beside `MatchScoringQueue`). Layer 3 off, or an empty current Requirements list: the old SQL and loop, unchanged.

**Re-embed command.** `embedding-match/reembed.main.ts` (a Nest standalone context) over `ReembedService` and `ReembedRepository`; `pnpm --filter api build` then `pnpm --filter api reembed [-- --dry-run]`. See `.claude/rules/api.md` for the rules.

**Decisions** (the agent's own; the owner may overrule)
1. One loop over the union of the two selections, not two sequential passes, so the button's count and the progress bar count Applications. Alternative: two passes with unit-based progress (an edit would show "24" for 12 Applications).
2. A cursor (`after` = last id) for the Layer 3 selection, because an Application that ends `embedder_failed` is still selected and the old "finished ones leave the selection" would loop forever while the embedder is down. The cursor resets when the Requirements version changes.
3. A `pending` row is selected only after 15 minutes; a younger one is the submit-time job still working. Alternative: any `pending` row (flickers the count after every submit, doubles work).
4. The command is a standalone Nest context compiled by `nest build`, because the repo's existing one-off scripts (`apps/api/scripts/*.ts`, run with `node --experimental-strip-types`) cannot host Nest decorators or `.js`-suffixed imports. Alternative: a script importing built `dist/` classes by hand (loses DI).
5. The command finds the configured model by embedding one probe text, because `Embedder` does not expose it; it also fails before touching anything if the embedder is down.
6. Rejected Applications are re-embedded too (consistent models in the sort), and `--dry-run` was added (count only).

**Verified**: `npx vitest run` in `apps/api` 618 passed (26 files); `npx tsc --noEmit` clean; `pnpm lint` and `pnpm check-types` pass; `nest build` and `node dist/embedding-match/reembed.main.js` boot, wire and answer "Layer 3 is off" without a database call.

**Not verified / needs the owner**
1. The SQL (`countNeedingWithScores`, `findNeedingWithScores`, `ReembedRepository.findStale` / `countStale`, including `now() - $n::int * interval '1 minute'`) was never run: Postgres was not running here. Run Re-check and `pnpm --filter api reembed -- --dry-run` against the dev database.
2. The manual box: with `EMBEDDING_BASE_URL` and `EMBEDDING_MODEL` set and a Job with a Requirement, stop Ollama, submit an Application (the row stays `pending`, about 2.5 minutes, then `not_scored / embedder_failed`), start Ollama, click Re-check in the Job's Settings, and confirm `select status, reason from application_match_scores order by updated_at desc limit 1;` shows `scored`. For a pending row abandoned by a database error, wait 15 minutes before clicking.
3. Model change: change `EMBEDDING_MODEL`, restart the API, run `pnpm --filter api build && pnpm --filter api reembed -- --dry-run`, then without `--dry-run`, then again (it should find 0).
