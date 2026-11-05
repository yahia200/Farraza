---
title: "CV autofill: the browser reads the CV and Members never see parsed data"
author: Yahia
date: 2026-11-05
branch: main
cost: { minutes: 28, tokens: 163749 }
id: l-149f53d8
scope: repo
status: active
src: agent
touches:
  - ".scratch/cv-autofill/issues/01-confirm-request-size-limits-and-fix-cv-text-cap.md"
  - ".scratch/cv-autofill/issues/02-shared-cv-text-rules-and-contact-extractor.md"
  - ".scratch/cv-autofill/issues/03-recruiters-can-insert-contact-questions-from-presets.md"
  - ".scratch/cv-autofill/issues/04-submit-stores-the-cv-text.md"
  - ".scratch/cv-autofill/issues/05-browser-reads-the-cv-and-fills-contact-details.md"
  - ".scratch/cv-autofill/issues/06-autofill-preset-keyed-questions.md"
  - ".scratch/cv-autofill/issues/07-shared-education-and-experience-extractor.md"
  - ".scratch/cv-autofill/issues/08-autofill-education-and-experience-groups.md"
  - ".scratch/cv-autofill/issues/09-replacing-removing-and-failed-reads.md"
  - ".scratch/cv-autofill/issues/10-verification-pass-and-docs-sweep.md"
---

## Decided
- The owner overruled three of my recommendations while grilling the CV autofill design, so do not re-propose them. Email is autofilled too (editable). The browser sends its extracted CV text with the submit and the server stores it, instead of the server re-parsing the file; the owner's reasoning was that an applicant can already stuff a CV, so a server parse is not meaningfully safer. No LLM for reading CVs for now.
- Members never see CV text or anything read from it, only scores, rankings and flags derived later. This is a standing rule, recorded in GLOSSARY.md (CV text) and ADR-0006.
- Name, email and phone are built-in submit fields, not Questions, so Preset keys cannot attach to them. They are autofilled directly; new contact Preset keys cover only extra Questions (LinkedIn, GitHub, portfolio, location).

## Tried and ruled out
- Server parsing before submit: needs an anonymous endpoint parsing untrusted files on the single Cloud Run instance.
- Server parsing after submit: a second extraction and a server PDF/DOCX library, and nothing for Autofill, which needs the result while the form is open.
- Making name, email and phone Preset-keyed Questions: reworks the submit schema, the one-Candidate-per-email upsert and the duplicate rules.

## Watch out
- The 50,000-character CV text cap in .scratch/cv-autofill/spec.md is a placeholder. The submit goes web to API through a Server Action, no body limits are set in either app, and the framework defaults (believed about 100 kB API, 1 MB Server Actions) were never verified. Ticket 01 settles this before the cap is baked into the shared schema.
- unpdf and mammoth were chosen from web search only; nothing is installed. Read their installed docs before using them (ticket 05).
