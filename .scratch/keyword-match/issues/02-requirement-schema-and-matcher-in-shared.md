# 02: Requirement schema and matcher in shared

**What to build:** Pure code in `@repo/shared`: the Requirement schema, the list validator with its caps, `matchRequirements` and the `missedMustHave` helper. Spec: `.scratch/keyword-match/spec.md` ("Shared").

- A Requirement is `{ id, text, tier, keywords }`; the list has at most 10 entries, each with 1 to 15 keywords of 1 to 40 characters.
- `matchRequirements` is case-insensitive, whole-word with literal boundaries (not preceded or followed by a letter or digit), no regex, and normalises only a trailing "s" and surrounding punctuation.
- It returns per Requirement id `{ matched, terms }`; any one keyword matches.
- `missedMustHave` is true when a must-have did not match.

**Blocked by:** none.

**Status:** resolved

- [x] "C#", "Node.js" and "C++" match; "Go" does not match "Google"
- [x] Case and trailing "s" are handled; negation is not (documented in a test comment)
- [x] An empty list is valid; a Requirement with no keywords is rejected with a `<path>` error
- [x] Exports added to the shared index and the package builds
- [x] `pnpm --filter @repo/shared test` passes
