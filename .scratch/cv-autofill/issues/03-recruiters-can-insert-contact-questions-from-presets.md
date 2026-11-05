# 03: Recruiters can insert contact Questions from Presets

**What to build:** A recruiter can add a LinkedIn, GitHub, portfolio or location Question to a form from the builder, and Autofill (tickets 05 and 06) will later recognise it by its Preset key. Spec: `.scratch/cv-autofill/spec.md`; ADR-0004 (Preset keys, append-only); glossary **Preset**, **Preset key**.

- **Keys:** append-only additions to the Preset key catalog: `contact.linkedin_url` (url), `contact.portfolio_url` (url), `contact.location` (short_text), `contact.github_url` (url). No existing key changes.
- **Presets:** four single-question Presets in the form builder, beside Education and Experience, each inserting one Question that carries its key. The Preset definitions (labels, help text) live in the web app, as the existing ones do.
- A key is allowed once per scope, like the others; inserting a second copy of the same Preset is refused or disabled the same way the builder already handles it.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [ ] The four keys exist with their required types, and the catalog test pins them (and that no key was removed or retyped)
- [ ] A recruiter can insert each Preset, relabel it, save the draft and publish; the stored Question keeps its Preset key after relabelling
- [ ] A form saved before this change still loads and edits
- [ ] The public apply form renders the new Questions like any single-answer Question
- [ ] The builder shows the new Presets without disturbing Education and Experience
