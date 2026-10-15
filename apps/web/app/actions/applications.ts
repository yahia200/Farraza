'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createNoteSchema, submitApplicationSchema, type FieldError, type SubmitApplicationInput } from '@repo/shared';
import type { ActionFailure } from '@/lib/action-failure';
import { apiFetch, failureFromResponse, readApiError } from '@/lib/api';

/**
 * The public apply form's Server Action, calling
 * POST /api/public/:companySlug/:jobSlug/applications (apps/api/src/applications).
 * Anyone can call it, so it validates again; the API also checks the answers
 * against the job's current form.
 */

export interface ApplyResult {
  ok?: boolean;
  /** Paths are "name", "email", "phone", or a question key. */
  fieldErrors?: FieldError[];
  formError?: string;
}

/** `utm_source` comes from the link, not the applicant: drop it rather than fail the application. */
function cleanSource(source: string | undefined): string | undefined {
  const trimmed = source?.trim();
  return trimmed && trimmed.length <= 100 ? trimmed : undefined;
}

export async function submitApplication(
  companySlug: string,
  jobSlug: string,
  input: SubmitApplicationInput,
): Promise<ApplyResult> {
  const parsed = submitApplicationSchema.safeParse({ ...input, source: cleanSource(input.source) });
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    };
  }

  const response = await apiFetch(
    `/api/public/${encodeURIComponent(companySlug)}/${encodeURIComponent(jobSlug)}/applications`,
    { method: 'POST', body: JSON.stringify(parsed.data) },
  );
  if (response.ok) {
    return { ok: true };
  }

  const body = await readApiError(response);
  const message = Array.isArray(body.message) ? body.message.join(' ') : body.message;
  switch (response.status) {
    case 400:
      // { message, errors: [{ path, message }] } from the validation pipe or parseAnswers.
      return body.errors?.length ? { fieldErrors: body.errors } : { formError: message };
    case 404:
      return { formError: 'This job just stopped accepting applications.' };
    case 409: // "You have already applied for this job."
      return { formError: message };
    case 429: // ThrottlerGuard: 5 applications per 10 minutes per visitor.
      return { formError: 'Too many attempts. Wait a few minutes and try again.' };
    default:
      return { formError: 'Something went wrong. Please try again.' };
  }
}

// --- Employee actions on an application (apps/api/src/pipeline) ---------------

const applicationPath = (companySlug: string, jobSlug: string, applicationId: string) =>
  `/api/companies/${encodeURIComponent(companySlug)}/jobs/${encodeURIComponent(jobSlug)}` +
  `/applications/${encodeURIComponent(applicationId)}`;

export type AddNoteResult = ActionFailure<'body'> & { ok?: boolean };

/**
 * Adds a note to an application (POST .../applications/:id/notes). Every role
 * may, interviewers included. Notes are append-only, so there is nothing to edit
 * or delete. The detail is cached (lib/dal.ts), so success refreshes the
 * candidates page the sheet is open on.
 */
export async function addApplicationNote(
  companySlug: string,
  jobSlug: string,
  applicationId: string,
  body: string,
): Promise<AddNoteResult> {
  const parsed = createNoteSchema.safeParse({ body });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const response = await apiFetch(`${applicationPath(companySlug, jobSlug, applicationId)}/notes`, {
    method: 'POST',
    body: JSON.stringify(parsed.data),
  });
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (!response.ok) {
    return failureFromResponse(response, ['body'], {
      404: () => ({ formError: 'This candidate is no longer part of this job. Reload the page.' }),
    });
  }

  revalidatePath(`/dashboard/${companySlug}/jobs/${jobSlug}/candidates`);
  return { ok: true };
}
