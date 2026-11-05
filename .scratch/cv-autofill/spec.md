Status: ready-for-agent

# CV autofill and stored CV text

Related: ADR-0006 (`docs/adr/0006-cv-text-extracted-in-the-browser.md`), ADR-0002 (the CV as a built-in form slot), ADR-0004 (Repeating groups and Preset keys), the glossary entries **CV**, **CV text**, **Autofill**, **Preset key**, **Repeating group**, **Entry**, and the design notes in `.scratch/candidate-matching/layers.md` (Layer 2 will read the stored CV text; this spec does not build Layer 2).

## Problem Statement

An applicant who attaches a CV then retypes the same facts into the form: name, email, phone, links, every school and every past job. It is slow, error-prone and costs applications. Separately, the team wants to rank and flag applicants from what their CV says, and today nothing reads a CV: it is an opaque PDF or DOCX that only a person can open.

## Solution

The apply form reads the CV in the applicant's own browser the moment it is picked and fills what it finds into empty answers, so the applicant only checks and corrects. One notice on the CV step says what was filled and offers Undo. The CV text is also sent with the submit and saved, together with a status and what was derived from it, so later screening can use it. Nothing read from a CV is ever shown to a Member; recruiters will only ever see scores, rankings and flags worked out from it later.

## User Stories

1. As an applicant, I want my name, email and phone filled in from my CV, so that I don't retype them.
2. As an applicant, I want my LinkedIn, GitHub or portfolio link filled in from my CV, so that I don't hunt for the URLs.
3. As an applicant, I want my education listed in the form from my CV, so that I only check it.
4. As an applicant, I want my past jobs listed in the form from my CV, so that I only check them.
5. As an applicant, I want filled values to be editable, so that I can fix anything the reading got wrong.
6. As an applicant, I want an answer I already typed never to be overwritten, so that autofill can't undo my work.
7. As an applicant, I want one clear notice saying the form was filled from my CV, so that I know where the values came from.
8. As an applicant, I want an Undo on that notice, so that I can clear every filled value in one click.
9. As an applicant, I want Undo to leave the values I edited myself alone, so that my own work is never discarded.
10. As an applicant, I want to apply normally if my CV can't be read, so that a failed reading never blocks me.
11. As an applicant, I want the reading to start as soon as I pick the file and not delay the upload, so that the form feels fast.
12. As an applicant, I want to replace my CV and have the values I haven't touched refreshed from the new one, so that a wrong upload is cheap to fix.
13. As an applicant, I want my CV never to leave my device for the reading itself, so that I'm not sending it to a third party to fill a form.
14. As an applicant, I want an Education or Experience group I already started left untouched, so that autofill never mixes into my entries.
15. As an applicant with a scanned CV, I want the form to simply stay empty, so that I'm not shown wrong guesses.
16. As an applicant on an old browser, I want the form to work without suggestions, so that I can still apply.
17. As an applicant, I want my email suggestion to be editable like any answer, so that a wrong address is not a dead end.
18. As a recruiter, I want to insert LinkedIn, portfolio and location Questions from Presets, so that autofill can fill them without me building the Questions.
19. As a recruiter, I want a form I built by hand (no Preset keys) to still work, so that autofill never needs me to change my form.
20. As a recruiter, I want relabelled Preset Questions still to be autofilled, so that wording changes don't break it.
21. As a recruiter, I want to see only the applicant's submitted answers, so that nothing guessed from the CV appears as fact.
22. As a recruiter, I want no new fields, columns or markers about autofill anywhere in the dashboard, so that nothing parsed is shown to me.
23. As a company owner, I want CV text and anything derived from it to be visible to no Member, so that unreliable output is never mistaken for a fact about a person.
24. As a product owner, I want the CV text saved with each submitted Application, so that Layer 2 screening can use it without a second upload.
25. As a product owner, I want the saved text to carry a status (readable, unreadable, failed), so that an unreadable CV is never mistaken for a CV that lacks a skill.
26. As a product owner, I want a scanned or empty CV recorded as unreadable, so that a requirement never reads as missing because extraction failed.
27. As a product owner, I want an extractor version stored beside the result, so that improved heuristics can re-run over old text.
28. As a product owner, I want a missing, oversize or unreadable CV text never to fail an application, so that extraction can never cost me a candidate.
29. As a product owner, I want the CV text cut at a fixed length, so that a malicious client can't fill the database with megabytes through a public form.
30. As a product owner, I want the structured result derived on the server from the text alone, so that there is one source of truth and no way for a client-supplied result to disagree with its text.
31. As a developer, I want the heuristics as pure functions in the shared package, so that the browser and the server run identical code and tests need no PDF.
32. As a developer, I want the browser reader isolated behind one small module, so that swapping the PDF or DOCX library touches nothing else.
33. As a developer, I want the PDF and DOCX libraries loaded only when a CV is picked, so that the apply page's first load doesn't grow.
34. As a developer, I want a stored row deleted with its CV file, so that applicant data has one lifetime.
35. As a developer, I want every stored row to carry the company and job, so that tenant isolation works like every other table.
36. As a developer, I want the new Preset keys added append-only, so that published forms keep loading.
37. As a security reviewer, I want no new public read route for CV text, so that the stored text cannot be fetched.
38. As a security reviewer, I want the submit endpoint's existing throttle to remain the only public entry, so that no new anonymous endpoint exists.

## Implementation Decisions

**Shared package (pure logic)**

- A **CV text status**: `readable`, `unreadable` or `failed`. A text shorter than a threshold (100 characters, a placeholder to tune on the sample CVs) is `unreadable`; a reader that errored or timed out is `failed`. The threshold lives in the shared package so the browser and the server apply the same rule.
- A **CV text cap** (placeholder 50,000 characters; see Further Notes on request-size limits). Longer text is cut, never refused.
- An **extractor version**, a plain integer constant bumped whenever a heuristic changes.
- An **extractor**: a pure function from CV text and the form's fields to suggestions. Suggestions are the built-in contact values (name, email, phone), plus an answer per Preset-keyed Question keyed by that Question's key, plus entries for the Education and Experience Repeating groups. It finds Questions by Preset key, never by label or position, and ignores Questions with no Preset key.
- Phase one of the extractor reads contact details and links (email, phone, LinkedIn, GitHub, portfolio, location, name as the first plausible line). Phase two reads Education and Experience entries by section heading and fills only sub-answers it is confident about (degree level, years, date ranges, plain job-title and company lines); the rest stay blank. Suggested phone values are passed through the existing phone normalisation, and suggested values are validated against the Question's own type and limits before being offered, so a suggestion can never be an invalid answer.
- The submit request gains an optional CV text object (`text` and `status`). The schema stays strict, and cuts overlong text rather than rejecting it. The server recomputes `readable` versus `unreadable` from the text, so a client cannot claim a status its text doesn't support; only `failed` is taken from the client.
- **Preset keys (append-only):** `contact.linkedin_url` (url), `contact.portfolio_url` (url), `contact.location` (short_text), and `contact.github_url` (url). No existing key changes.

**Storage**

- A new table, one row per CV file, unique on the file, deleted with the file. Columns: company, job, the file, status, text, the derived structured result (JSON), extractor version, created time. The status is a CHECK-constrained text column like the other enums.
- The row is written in the same transaction as the Application and the CV attach. It is written only when the Application has a CV. An Application with a CV but no CV text sent (a browser that couldn't read) gets a `failed` row with empty text, so "not read" is distinguishable from "no CV".
- The structured result is computed on the server from the stored text using the shared extractor and the Application's own form version's fields, never taken from the client.
- No route reads this table. No Member, Application detail, board, candidate list or public payload carries it. A later Layer 2 slice will add scores or flags, not text.
- The schema change follows the Prisma 8 flow: edit the contract, emit it, apply it to the dev database, commit the generated contract files and migration snapshots, and update the applied-schema doc (table description, the rules the services must enforce, and the "later parse table" note).

**API**

- Submit validates the new field, attaches the CV as today, and writes the CV text row inside the same transaction. A missing, oversize or odd CV text never changes the submit's outcome. When the form's CV setting is off, or no CV was sent, the field is ignored.
- No new public endpoint and no new throttle: the existing per-visitor submit limit is the only entry.

**Web**

- A **reader module**: given the picked file, loads the PDF reader (`unpdf`) or DOCX reader (`mammoth`, raw text from an array buffer) only then, extracts text with a time limit, and returns text and a status. It runs in parallel with the upload and never blocks it, and any failure becomes `failed`.
- The apply form keeps the reader's result and the extractor's suggestions in component state, applies them only to empty answers, and tracks which values are still untouched suggestions so Undo and a CV replacement affect only those. Typed answers are never overwritten.
- One notice on the CV step ("Filled from your CV") with an Undo button; each suggested value is an ordinary editable answer on its own step.
- Groups are filled only when they have no Entries. A filled group respects `maxEntries`.
- The recruiter-side Presets for the four contact keys ship as single-question Presets in the form builder, alongside Education and Experience.
- Submit sends the reader's text and status with the other fields. The submitted answers remain the only thing that counts as an answer.
- Library APIs (`unpdf`, `mammoth`) are used from their installed versions' own documentation and types, read at implementation time; the two libraries were chosen from web search only.

**Docs**

- Update the applied-schema doc, the API and web rules files, and the backlog (the CV autofill item and the Layer 2 text-extraction note). The glossary and ADR-0006 are already written.

## Testing Decisions

A good test checks behaviour through the public function or service, never how it is built inside.

- **Shared (main seam), Vitest next to the code:** the extractor on invented CV text (each contact type, links, a name on the first line, missing values, ambiguous text), Preset-key targeting including relabelled Questions and forms with none, suggestions validated against Question limits, groups-only-when-empty and `maxEntries`, the status rule on both sides of the threshold, the cut at the cap, the request schema (accepts, cuts, ignores an absent field), and that the Preset key catalog only grows (like the existing catalog test). Prior art: the screening-rules and Preset key tests.
- **API service spec, in-memory fake repository:** a submit with a CV stores one row with status, text and extractor version; the structured result equals what the extractor gives for that text; a missing text stores a `failed` row; an oversize text is cut; unreadable text stores `unreadable`; no CV or CV setting off stores nothing; a text never fails a submit; and no public or Member payload contains the text or derived result. Prior art: the applications and jobs service specs.
- **Web, by hand in the browser:** the reader against the owner's sample CVs (PDF and DOCX, several layouts, one scanned), the notice and Undo, replacing and removing the CV, an old-browser or failed read, and no layout shift or blocked submit. No web test runner is added.
- The sample CVs contain personal data: they live in a git-ignored fixtures folder with a README listing what each one is. Committed tests use only invented text.

## Out of Scope

- Any language model, hosted or local, for reading CVs (see ADR-0006's rejected options).
- Server-side reading of PDF or DOCX files.
- Showing CV text, parsed values or autofill markers to any Member, in any screen.
- Layers 2 to 4 of candidate matching: requirements, keyword matching, embeddings, scoring, flags and ranking from CV text.
- Reading scanned PDFs (no OCR); they are recorded as unreadable.
- Non-English or right-to-left CVs.
- Re-running the extractor over old rows (the version column only makes it possible later).
- Cleaning up CV files that were uploaded but never submitted (an existing gap).
- Splitting names, normalising countries, or guessing fields with no Preset key.
- Autofilling file Attachments, or any Question built by hand.

## Further Notes

- **Request size:** the submit goes web app to API through a Server Action, and no explicit body limits are set in either app, so framework defaults apply (believed to be about 100 kB for the API's JSON body and 1 MB for Server Actions; not verified against installed docs). The cap must fit under both, or the limit must be raised for that route. Check this first, because it fixes the cap.
- **Trust:** the stored text is applicant-supplied and can differ from the file a recruiter opens. That is accepted: keyword stuffing is already possible in a CV, and the data is advisory only and must never reject an Application.
- **Assumption not yet confirmed with the owner:** removing the CV behaves like replacing it with nothing (untouched suggestions are cleared, edited values stay).
- **Assumption:** the 100-character threshold and the text cap are placeholders to tune on the sample CVs.

## Suggested slices

1. Shared: CV text status, threshold, cap, extractor version, request schema field, and the contact and links extractor.
2. Shared and web builder: the four contact Preset keys and their single-question Presets.
3. Database and API: the CV text table, submit stores the row atomically, the server derives the structured result, nothing exposed.
4. Web: the reader module and the apply form's contact and Preset-Question autofill, with the notice and Undo.
5. Shared and web: Education and Experience extraction, and group autofill.
6. Web: replacing and removing the CV, failed and old-browser paths.
7. Verification pass against the sample CVs, and the docs sweep.
