# 08: Scores in the card and detail payloads

**What to build:** The API tells the web app what it needs to show and sort scores, and nothing more. Cards and rows carry the overall number and a state; the detail carries a band per Requirement and the state. CV text and passages never leave the server. Spec: `.scratch/candidate-matching/layer3-spec.md` ("Payloads and web"); glossary: **CV text**.

- Each card and table row carries the overall score (used only for sorting, never displayed) and a state: scoring, scored, or not scored with its reason. An Application with no score row reads as no state.
- The detail carries, per Requirement of the version it was scored against, its band (strong, related or weak, from the shared `bandOf`) and the state. Bands are computed on read from the stored scores; no threshold is stored.
- Read the scores for a whole board or list in one query, never one per card, as the ratings and markers already do.
- Members only, interviewers included, like the other read payloads. The public routes return none of it, and a spec pins that.

**Blocked by:** 06 (an Application can be scored).

**Status:** ready-for-agent

- [ ] Card, row and detail payloads carry the new fields and are covered by service specs, including an Application with no row and one not scored
- [ ] The detail never contains CV text, a chunk, or a raw per-Requirement score; the card carries only the overall number
- [ ] One extra query serves a whole board, checked in a spec with a counting fake
- [ ] A spec shows no public route returns a score, a band or a state
- [ ] `docs/db-schema.md` and `.claude/rules/api.md` describe the new payload fields
- [ ] `pnpm lint`, `pnpm check-types` and `pnpm --filter api test` pass
