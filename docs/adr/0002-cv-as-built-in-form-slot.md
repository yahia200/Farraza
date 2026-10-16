# CV is a built-in slot on the form version, not a form field

Status: accepted

Every Application can carry a CV, and CVs will later be parsed to autofill the apply form. We model the CV as a dedicated slot on the form version (`cv_mode`: `off | optional | required`), stored as a `files` row with `purpose = 'cv'` and shown as the first step of the apply form. It is not an entry in `fields[]` and never appears in `applications.answers`.

Considered options:

- **An `isCv` flag on an ordinary file question** — one concept instead of two, but "find the CV" becomes a search through JSONB, a form could have zero or several CVs, and its limits (PDF/DOCX, 5 MB) would be recruiter-editable even though a parser depends on them.
- **A job-level toggle** — simple, but forms are versioned and published versions are immutable; a toggle on the job would change what an already-published form asks for.
- **A built-in slot on the form version** — chosen. One predictable place for parsing and for the "one CV per Application" rule, fixed limits, and it versions with the form.

Consequences: the CV is handled by its own code path (apply step, builder card, submit field `cvFileId`) rather than the generic question machinery, and changing `cv_mode` after publishing creates a new form version like any other edit.
