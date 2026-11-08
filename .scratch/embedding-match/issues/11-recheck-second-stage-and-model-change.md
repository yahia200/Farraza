# 11: Re-check second stage and model-change re-embed

**What to build:** The existing Re-check also brings Applications up to date for Layer 3, and a deliberate command re-embeds Applications after the embedding model changes. Spec: `.scratch/candidate-matching/layer3-spec.md` ("Scoring flow"); the Re-check section of `.claude/rules/api.md`.

- Re-check's count and run also cover non-rejected Applications with a readable CV whose score row is missing or behind the Job's current Requirements version (for example Applications that were not scored because the embedder was down). One button, one progress bar, one run per Job; the stage reuses the scoring service from ticket 06.
- With Layer 3 off, Re-check behaves exactly as it does today.
- Below the Edit limit this catches up after a Requirements edit; past it the Requirements cannot change, so the stage only has work after a failure or a model change.
- A model change leaves Applications as "not scored (model changed)". A separate deliberate command (an ops script, not a button) re-embeds them: it is idempotent, chunked, safe to rerun, and reports how many it touched. It never runs by itself.

**Blocked by:** 06 (an Application can be scored).

**Status:** ready-for-agent

- [ ] Service specs with the fake repository and queue: the count includes missing and behind scores, skips rejected and unreadable Applications, and is zero with Layer 3 off
- [ ] A run scores a not-scored Application once the embedder is back, and a restart mid-run only redoes what is missing
- [ ] The re-embed command is tested on a model change: it clears the old vectors for an Application, embeds again, and rerunning it changes nothing
- [ ] A manual run: stop Ollama, submit an Application, start Ollama, click Re-check, see it scored
- [ ] `.claude/rules/api.md` describes the second stage and the command
- [ ] `pnpm lint`, `pnpm check-types` and `pnpm --filter api test` pass
