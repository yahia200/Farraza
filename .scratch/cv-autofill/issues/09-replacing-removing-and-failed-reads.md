# 09: Replacing or removing the CV, and failed reads

**What to build:** The unhappy and changing paths of Autofill all leave the applicant able to apply and never lose their own work. Spec: `.scratch/cv-autofill/spec.md` ("Web", user stories 9, 10, 12, 15, 16); ADR-0006.

- **Replace:** choosing another CV re-runs the reader and refreshes only the values that are still untouched suggestions; anything the applicant edited stays. Stale suggestions from the first CV never survive into the second.
- **Remove:** removing the CV behaves like replacing it with nothing (untouched suggestions are cleared, edited values stay). This is an assumption not yet confirmed with the owner; raise it if it feels wrong in use.
- **Failure:** a reader error, a timeout, a scanned PDF (too little text) and a browser that cannot run the reader each leave the form as it was, show no suggestions and no error that blocks anything, and the submit sends the status (`failed` or `unreadable`) with the text if any.
- A late result from a replaced or removed CV is discarded.

**Blocked by:** 05.

**Status:** ready-for-agent

- [ ] Replacing the CV refreshes untouched suggestions and keeps edited values
- [ ] Removing the CV clears untouched suggestions and keeps edited values
- [ ] A slow read finishing after the CV was replaced or removed changes nothing
- [ ] A scanned PDF and a corrupt file leave the form empty and applying works, with the right status sent
- [ ] A browser that cannot run the reader gets no suggestions, no error, and can still apply
- [ ] Verified in the browser with a good CV, a scanned CV and a renamed non-CV file
