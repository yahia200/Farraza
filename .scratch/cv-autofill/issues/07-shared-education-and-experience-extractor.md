# 07: Shared: Education and Experience extractor

**What to build:** Best-effort extraction of education and work history from CV text, in `@repo/shared`, so the browser can suggest Entries and the server's derived result includes them. Spec: `.scratch/cv-autofill/spec.md` ("Shared package", phase two); ADR-0004; glossary **Repeating group**, **Entry**, **Preset key**.

- **Sections:** detect Education and Experience by common headings in English CVs (the owner confirmed English only).
- **Entries:** split each section into entries and fill only sub-answers it is confident about: degree level, start and end years, date ranges, plain job-title and company lines. Everything else stays blank; it never guesses a school, title, company or description from messy layout.
- **Targeting:** by the groups' and sub-questions' Preset keys (`education`, `experience` and their children), never by label or position. A form without those groups gets nothing.
- Values are validated against each sub-question's type and limits (years as numbers, dates as dates, options for the degree) and respect `maxEntries`. A fully blank entry is dropped.
- Output is the same suggestion shape the contact extractor uses, so the server's derived result (ticket 04) picks it up with no change.

**Blocked by:** 02.

**Status:** resolved

- [ ] Invented CV text with clear Education and Experience sections yields the right number of entries with their confident sub-answers
- [ ] Text with no recognisable section, or with sections in unusual order or style, yields nothing rather than wrong values
- [ ] Date ranges, "Present", year-only dates and month names are handled; an unparseable date leaves the sub-answer blank
- [ ] `maxEntries` is respected and blank entries are dropped
- [ ] A form with no Education or Experience group produces no group suggestions
- [ ] Tests are Vitest next to the code on invented text, and the package builds and passes
