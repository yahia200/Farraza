'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  createNoteSchema,
  createUploadSchema,
  moveApplicationSchema,
  submitApplicationSchema,
  type CreateUploadInput,
  type FieldError,
  type SubmitApplicationInput,
} from '@repo/shared';
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
    case 409:
      // "You've already applied for this job", or a CV that couldn't be attached (with `errors`).
      return body.errors?.length ? { fieldErrors: body.errors } : { formError: message };
    case 429: // ThrottlerGuard: 5 applications per 10 minutes per visitor.
      return { formError: 'Too many attempts. Wait a few minutes and try again.' };
    default:
      return { formError: 'Something went wrong. Please try again.' };
  }
}

export interface CreateUploadResult {
  /** Where to PUT the file, and the id to send with the application. Valid for a few minutes. */
  upload?: { fileId: string; url: string; contentType: string };
  /** One message the upload control shows as it is. */
  formError?: string;
}

/**
 * Starts a CV upload, calling POST /api/public/:companySlug/:jobSlug/uploads
 * (apps/api/src/applications). The browser can't call the API, so the apply form
 * asks this action for a presigned URL, then PUTs the file straight to the bucket.
 * It is an action rather than part of the cached job (lib/public-jobs.ts) because
 * a presigned URL is bound to one object and must never be shared between visitors.
 */
export async function createUpload(
  companySlug: string,
  jobSlug: string,
  input: CreateUploadInput,
): Promise<CreateUploadResult> {
  const parsed = createUploadSchema.safeParse(input);
  if (!parsed.success) {
    return { formError: parsed.error.issues[0]?.message ?? 'Choose your file again.' };
  }

  const response = await apiFetch(
    `/api/public/${encodeURIComponent(companySlug)}/${encodeURIComponent(jobSlug)}/uploads`,
    { method: 'POST', body: JSON.stringify(parsed.data) },
  );
  if (response.ok) {
    return { upload: (await response.json()) as NonNullable<CreateUploadResult['upload']> };
  }

  const body = await readApiError(response);
  const message = Array.isArray(body.message) ? body.message.join(' ') : body.message;
  switch (response.status) {
    case 400: // The file broke the job's rules; the message says which.
      return { formError: body.errors?.[0]?.message ?? message };
    case 404:
      return { formError: 'This job just stopped accepting applications.' };
    case 429: // ThrottlerGuard: 20 uploads per 10 minutes per visitor.
      return { formError: 'Too many uploads. Wait a few minutes and try again.' };
    default:
      return { formError: 'Something went wrong. Please try again.' };
  }
}

// --- Employee actions on an application (apps/api/src/pipeline) ---------------

const applicationPath = (companySlug: string, jobSlug: string, applicationId: string) =>
  `/api/companies/${encodeURIComponent(companySlug)}/jobs/${encodeURIComponent(jobSlug)}` +
  `/applications/${encodeURIComponent(applicationId)}`;

export type FileDownloadResult = ActionFailure<never> & { url?: string };

/**
 * Mints a link that downloads one of an application's files, calling
 * GET .../applications/:id/files/:fileId/download (apps/api/src/pipeline). Every member
 * may, interviewers included. The link is valid for a few minutes, so it is minted on each
 * click and never cached: this is an action rather than part of the cached DAL
 * (lib/dal.ts), and it revalidates nothing because opening a file changes nothing.
 * The ids are checked by the API (ParseUUIDPipe, then the tenant lookup).
 */
export async function getFileDownloadUrl(
  companySlug: string,
  jobSlug: string,
  applicationId: string,
  fileId: string,
): Promise<FileDownloadResult> {
  const response = await apiFetch(
    `${applicationPath(companySlug, jobSlug, applicationId)}/files/${encodeURIComponent(fileId)}/download`,
  );
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (!response.ok) {
    return failureFromResponse(response, [], {
      400: () => ({ formError: 'That file could not be found. Reload the page.' }),
      404: () => ({ formError: 'That file is no longer available. Reload the page.' }),
    });
  }
  const { url } = (await response.json()) as { url: string; expiresInSeconds: number };
  return { url };
}

export type AddNoteResult =ActionFailure<'body'> & { ok?: boolean };

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

/**
 * Employees' pipeline action: moves an application to another stage, calling
 * POST /api/companies/:c/jobs/:j/applications/:id/move (apps/api/src/pipeline).
 * Like the other employee actions it re-validates, returns failures rather
 * than throwing, and revalidates so the private-cached DAL (lib/dal.ts) refetches.
 */

export type MoveApplicationResult = ActionFailure<never> & { ok?: boolean };

export async function moveApplication(
  companySlug: string,
  jobSlug: string,
  applicationId: string,
  stageId: string,
): Promise<MoveApplicationResult> {
  const parsed = moveApplicationSchema.safeParse({ stageId });
  if (!parsed.success) {
    return { formError: 'Choose a stage from this job.' };
  }

  const candidatesPath = `/dashboard/${companySlug}/jobs/${jobSlug}/candidates`;
  const response = await apiFetch(`${applicationPath(companySlug, jobSlug, applicationId)}/move`, {
    method: 'POST',
    body: JSON.stringify(parsed.data),
  });
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (!response.ok) {
    const failure = await failureFromResponse(response, [], {
      403: () => ({ formError: "You don't have permission to move candidates." }),
      404: () => ({ formError: 'That candidate is no longer part of this job. Reload the page.' }),
      // "Already in that stage" or "Someone else just moved this candidate": our view is stale.
      409: (message) => ({ formError: message }),
    });
    if (response.status === 404 || response.status === 409) {
      // Refresh what the user sees: the page then shows where the candidate really is.
      revalidatePath(candidatesPath);
    }
    return failure;
  }

  revalidatePath(candidatesPath);
  return { ok: true };
}
