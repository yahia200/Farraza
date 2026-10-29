---
title: A never-published job publishes its default form by sending content with the publish call
author: Yahia
date: 2026-10-29
branch: fix/publish-default-form
cost: { minutes: 5, tokens: 83648 }
id: l-98d2ca04
scope: repo
status: active
src: agent
touches:
  - apps/web/components/dashboard/jobs/form-builder/form-builder.tsx
  - apps/api/src/forms/forms.service.ts
  - "apps/web/app/(dashboard)/dashboard/[companySlug]/jobs/[jobSlug]/form/page.tsx"
  - apps/web/app/actions/forms.ts
---

## Decided
In apps/web/components/dashboard/jobs/form-builder/form-builder.tsx, `canPublish` is also true while `status.publishedVersion === null`, and `publish()` passes the form content to `publishForm` whenever `isDirty || !status.hasDraft`. The server action already saves content as a draft before POSTing publish, so no API or action change was needed.

## Tried and ruled out
Creating an empty draft when the job is created, so `hasDraft` is true from the start. It needs an API/schema change and leaves a stray draft row for jobs nobody edits.

## Watch out
`isDirty` compares against `defaultValues`, and a new job's defaults (no questions, optional CV from `DEFAULT_CV_MODE`) come from the page, not a saved draft. So the form is "clean" yet nothing exists on the server. Enabling the button alone is not enough: `publishForm(..., null)` skips the save and the API answers 409 "There is no draft to publish." (apps/api/src/forms/forms.service.ts). Not verified in the browser.
