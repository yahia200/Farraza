# 05: Browser reads the CV and fills contact details

**What to build:** When an applicant picks a CV, their browser reads its text in parallel with the upload and fills name, email and phone into the form's built-in fields, with one notice and an Undo. The submit carries the text and status. Spec: `.scratch/cv-autofill/spec.md` ("Web"); ADR-0006; glossary **CV text**, **Autofill**.

- **Reader module:** one small module that, given the picked file, loads the PDF reader (`unpdf`) or the DOCX reader (`mammoth`, raw text from an array buffer) only then, extracts text with a time limit, and returns text and a status. Any failure becomes `failed`. Read each library's installed documentation and types before using it (they were chosen from web search only); report anything that differs.
- **Never blocks:** it runs alongside the presigned upload and never delays Next, Skip or Send.
- **Autofill:** suggestions from the shared extractor are applied only to empty built-in fields. The applicant's typed answers are never overwritten. The app tracks which values are still untouched suggestions.
- **Notice:** one "Filled from your CV" notice on the CV step with an Undo that clears untouched suggestions only. Each filled value stays an ordinary editable answer on its own step.
- **Submit:** sends the CV text and status with the other fields (the shared schema already accepts it; the API stores it once ticket 04 lands).
- The applicant's file is read in the browser only; nothing is sent to a third party.

**Blocked by:** 02.

**Status:** resolved

- [ ] Picking a PDF or DOCX CV fills empty name, email and phone, and shows the notice; the upload and the form stay responsive
- [ ] A value the applicant already typed is never replaced, even if reading finishes after they typed
- [ ] Undo clears the untouched suggestions and keeps anything the applicant edited
- [ ] The libraries load only when a CV is picked (the apply page's first load does not grow)
- [ ] Submit includes the text and status; a read that fails or times out still lets the applicant apply
- [ ] Verified in the browser against at least one PDF and one DOCX sample; suggested values pass the form's own validation
