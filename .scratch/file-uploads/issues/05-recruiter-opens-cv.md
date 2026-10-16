# 05: Recruiter opens a CV from the candidate sheet

**What to build:** On an Application's candidate sheet, members see the **CV** with its name, type and size and a download button. An authenticated endpoint under the company routes lists an Application's files and returns a short-lived presigned GET (existing 300-second TTL) with an attachment disposition and the applicant's original file name. Interviewers have the same access as recruiters; non-members get a 404; a file from another company or Application cannot be fetched. Opening a file writes no history event. See the spec's Implementation Decisions (Recruiter access).

**Blocked by:** 03

**Status:** resolved

- [x] The files list and the download-URL endpoint use the existing application read policy and company membership guard.
- [x] The download URL forces attachment disposition and the original file name; it expires after the existing TTL.
- [x] Requesting a file that belongs to a different Application or company returns 404.
- [x] The candidate sheet shows the CV with name, type, size and a working download button.
- [x] An Application with no CV shows nothing misleading.
- [x] API service tests cover membership, tenant isolation and disposition with in-memory fakes.
- [x] Manually verified: download a CV uploaded through the apply form.

## Comments

Resolved on integration branch `feat/file-uploads`: merge 91aac9d (feat 9a34e06). Review fix 0a8a43e hides the CV section for jobs whose form never asked for a CV.

No `read` action exists on `ApplicationPolicy`, so the endpoints follow `detail`: `CompanyMemberGuard` plus `jobs.get`. **Pending on the live stack:** real download (original name, Content-Disposition from RustFS), and whether Chrome allows a download from http://localhost:9000 started on https://localhost:3000.

Live-stack verification (2026-10-16): CV row shows name, type and size with Preview and Download; the Server Action's presigned GET returns `attachment` with an ASCII fallback and the UTF-8 `filename*` for "Mona Élie – CV (1).pdf" (RustFS honours the response override), the page does not navigate, and the same link returns 403 after its 300 s. The interviewer sees the same files and Download, without the Move control; another company's slug gives 404. Not observed: the browser's save dialog itself (the pane does not show downloads).
