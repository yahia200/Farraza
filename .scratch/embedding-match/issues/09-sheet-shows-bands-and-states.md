# 09: Sheet shows bands and states

**What to build:** A reviewer opening an Application sees, for each Requirement, Layer 2's verdict and Layer 3's band side by side, and understands when no score exists. Spec: `.scratch/candidate-matching/layer3-spec.md` ("Payloads and web", stories 2 to 6).

- Each Requirement on the sheet shows its Layer 2 verdict (matched with terms, not matched, or not checked) and a band: Strong, Related or Weak. Raw numbers are never shown.
- States: "Scoring…" while pending, and "Not scored" with a plain reason (CV could not be read, scoring failed, model changed). An Application with no state shows nothing, like Layer 2 with no CV.
- Layer 2's "Missing must-have" marker and its behaviour are unchanged; Layer 3 never sets or clears it.
- The wording leaves room for the reality that a band ranks by topic, not by depth. The band labels are driven by the shared constants, which are still placeholders until ticket 12.

**Blocked by:** 04 (optional keywords, which also edits this section), 07 (submit queues scoring), 08 (scores in the payloads).

**Status:** ready-for-agent

- [ ] The sheet shows both layers per Requirement in each state: scored, scoring, each not-scored reason, and no state
- [ ] A must-have missed by Layer 2 but scored Strong shows both, and the marker still shows
- [ ] No raw number or CV passage appears anywhere in the sheet or the page source
- [ ] Checked in a browser against the real API and local Ollama, including a stopped Ollama
- [ ] `apps/web` lint and type checks pass (`pnpm lint`, `pnpm check-types`)
