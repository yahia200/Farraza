# 04: Submit stores the CV text

**What to build:** When an applicant submits with a CV, the API saves the CV text, its status and what was derived from it, atomically with the Application, and exposes none of it. Spec: `.scratch/cv-autofill/spec.md` ("Storage", "API"); ADR-0006; glossary **CV text**. The browser does not send the text yet (ticket 05); this ticket is verified through the API service.

- **Table:** one row per CV file, unique on the file, deleted with the file. Columns: company, job, file, status (a CHECK-constrained text column), text, the derived structured result (JSON), extractor version, created time. Every row carries the company and the job.
- **Write:** inside the same transaction as the Application and the CV attach, only when the Application has a CV. A CV with no text sent (a browser that couldn't read) stores a `failed` row with empty text, so "not read" differs from "no CV". Oversize text is cut at the cap; `readable` versus `unreadable` is recomputed from the text; only `failed` is taken from the client. When the form's CV setting is `off`, or no CV was sent, the field is ignored.
- **Derivation:** the structured result is computed on the server by the shared extractor from the stored text, using the Application's own form version's fields, never taken from the client.
- **Never exposed:** no route reads the table, and no Member, detail, board, list or public payload carries the text or the result.
- **Schema flow:** edit the contract, emit it, apply it to the dev database, commit the generated files and migration snapshots, and update the applied-schema doc (the table, the rules the services must enforce, and the "later parse table" note).
- No new endpoint and no new throttle: the existing submit limit is the only public entry.

**Blocked by:** 02.

**Status:** resolved

- [ ] A submit with a CV and a text stores one row with the status, text and extractor version, and the Application is created as before
- [ ] The stored structured result equals the shared extractor's output for that text and that form version
- [ ] A missing text stores a `failed` row; unreadable text stores `unreadable`; oversize text is cut; none of these fails the submit
- [ ] No CV, or CV setting `off`, stores nothing
- [ ] A refused submit (duplicate, validation error, refused file) leaves no row, and a retry works
- [ ] No public route and no Member payload contains the text or the derived result (pinned by a spec, like the rules and ratings leak specs)
- [ ] Deleting the CV file's row removes the CV text row; the applied-schema doc is updated and the contract files are committed
- [ ] Service specs use the real service and the in-memory fake repository, as `applications.service.spec.ts` does
