# 05: Recruiter opens a CV from the candidate sheet

**What to build:** On an Application's candidate sheet, members see the **CV** with its name, type and size and a download button. An authenticated endpoint under the company routes lists an Application's files and returns a short-lived presigned GET (existing 300-second TTL) with an attachment disposition and the applicant's original file name. Interviewers have the same access as recruiters; non-members get a 404; a file from another company or Application cannot be fetched. Opening a file writes no history event. See the spec's Implementation Decisions (Recruiter access).

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] The files list and the download-URL endpoint use the existing application read policy and company membership guard.
- [ ] The download URL forces attachment disposition and the original file name; it expires after the existing TTL.
- [ ] Requesting a file that belongs to a different Application or company returns 404.
- [ ] The candidate sheet shows the CV with name, type, size and a working download button.
- [ ] An Application with no CV shows nothing misleading.
- [ ] API service tests cover membership, tenant isolation and disposition with in-memory fakes.
- [ ] Manually verified: download a CV uploaded through the apply form.
