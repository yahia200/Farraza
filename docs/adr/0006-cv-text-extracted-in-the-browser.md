# CV text is read in the browser and stored for the server, never shown

Status: accepted

Autofill suggests answers from the applicant's CV while they fill in the form, and later screening layers need the CV as text. We read the CV in the applicant's browser (PDF with `unpdf`, DOCX with `mammoth`, both loaded only when a CV is picked), run the heuristics from `@repo/shared` there to produce suggestions, and send only the CV text and a status (`readable`, `unreadable`, `failed`) with the submit. The API stores one row per CV file, in the same transaction as the Application, holding the text, the status and an extractor version. It computes the structured result from that text with the same shared heuristics. Members never see the text or anything read from it; they will see only scores, rankings and flags derived from it.

Considered options:

- **Parse on the server, before submit** — a trusted result, but it adds an anonymous endpoint that parses untrusted files on the single Cloud Run instance, needs its own throttle and byte check, and leaves CV text on the server for CVs that are never submitted.
- **Parse on the server, after submit** — trusted, but a second extraction and a server PDF/DOCX library, with nothing for Autofill, which needs the result while the form is open.
- **Parse in the browser, send the text** — chosen. No new anonymous endpoint, no server CPU, parsing starts when the file is picked, and the text is saved atomically with the Application.
- **A language model for structured extraction** — rejected for now: it sends applicant CVs to a third party and costs per applicant. The heuristics can be replaced behind the same text-in, suggestions-out functions later.

Consequences: the stored text is supplied by the applicant and can differ from the file a recruiter opens, so it is advisory only and must never reject an Application. An applicant can already stuff a CV with keywords, so a server parse would not have been much safer. A missing, oversize or unreadable text never fails a submit: it is cut at a cap or saved with a status. Browsers that cannot parse give no suggestions and a "not read" row. The extractor version lets improved heuristics re-run over stored text without a new upload.
