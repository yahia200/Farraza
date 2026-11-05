# 02: Shared: CV text rules and the contact extractor

**What to build:** The pure logic for CV text in `@repo/shared`, usable by the browser and the API. Spec: `.scratch/cv-autofill/spec.md` ("Implementation Decisions", "Shared package"); ADR-0006; glossary **CV text**, **Autofill**, **Preset key**.

- **CV text status:** `readable`, `unreadable`, `failed`. A text shorter than a threshold (placeholder: 100 characters) is `unreadable`. Only `failed` is taken from the client; the other two are always recomputed from the text.
- **Constants:** the CV text cap (the number settled in ticket 01; longer text is cut, never refused) and an integer extractor version.
- **Request schema:** the submit body gains an optional CV text object (`text`, `status`). It stays strict, cuts overlong text, and is ignored when absent.
- **Contact extractor:** a pure function from CV text and the form's fields to suggestions: name (first plausible line), email, phone (passed through the existing phone normalisation), and links (LinkedIn, GitHub, portfolio) plus location. It finds Questions by Preset key only, never by label or position, and ignores Questions with none. Every suggestion is validated against the target's own type and limits before it is offered.

**Blocked by:** 01 (the cap).

**Status:** ready-for-agent

- [ ] The status rule is correct on both sides of the threshold, and a client cannot claim `readable` for text that is too short
- [ ] Text over the cap is cut and the rest is kept; an absent CV text field is accepted
- [ ] Each contact type is found in invented CV text, including missing values, several candidates for one value, and noisy lines
- [ ] A relabelled Preset Question and a form with no Preset keys behave correctly (found by key; ignored when no key)
- [ ] No suggestion is ever an invalid answer for its Question
- [ ] Tests are Vitest next to the code, on invented text only (no PDF, no personal data); the package builds and `pnpm --filter @repo/shared test` passes
