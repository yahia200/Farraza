'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cvModeSchema, parseFormFields, type CvMode, type FieldError, type FormFields } from '@repo/shared';
import { apiFetch, readApiError } from '@/lib/api';
import { expirePublicJob } from '@/lib/public-jobs';

/**
 * Application form Server Actions, calling apps/api/src/forms.
 * Field errors come back as the API reports them, with paths relative to the
 * question list ("2.config.options"); the builder maps them onto its inputs.
 */

/** What the builder saves: the questions and the CV setting (ADR-0002). */
export interface FormContent {
  fields: FormFields;
  cvMode: CvMode;
}

export interface FormActionResult {
  ok?: boolean;
  /** Per-question problems, paths relative to the fields array. */
  fieldErrors?: FieldError[];
  formError?: string;
}

const formPath = (companySlug: string, jobSlug: string, publish = false) =>
  `/api/companies/${encodeURIComponent(companySlug)}/jobs/${encodeURIComponent(jobSlug)}/form${publish ? '/publish' : ''}`;

/** Saves the draft (creating it if needed). The API replaces the whole field list and the CV setting. */
export async function saveFormDraft(companySlug: string, jobSlug: string, content: FormContent): Promise<FormActionResult> {
  // Re-validate with the same shared schemas the API uses.
  const parsed = parseFormFields(content.fields);
  if (!parsed.ok) {
    return { fieldErrors: parsed.errors };
  }
  const cvMode = cvModeSchema.safeParse(content.cvMode);
  if (!cvMode.success) {
    return { formError: cvMode.error.issues[0]?.message };
  }

  const response = await apiFetch(formPath(companySlug, jobSlug), {
    method: 'PUT',
    body: JSON.stringify({ fields: parsed.fields, cvMode: cvMode.data }),
  });
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (!response.ok) {
    return toFailure(response);
  }

  revalidatePath('/', 'layout');
  return { ok: true };
}

/**
 * Publishes the draft. When `content` is given (unsaved changes), saves them
 * first, so what you see is what gets published.
 */
export async function publishForm(
  companySlug: string,
  jobSlug: string,
  content: FormContent | null,
): Promise<FormActionResult> {
  if (content) {
    const saved = await saveFormDraft(companySlug, jobSlug, content);
    if (!saved.ok) {
      return saved;
    }
  }

  const response = await apiFetch(formPath(companySlug, jobSlug, true), { method: 'POST' });
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (!response.ok) {
    return toFailure(response);
  }

  // The job header's "Open job" depends on having a published form (lib/dal.ts hasPublishedForm).
  revalidatePath('/', 'layout');
  // Applicants see the new version on the public page.
  expirePublicJob(companySlug, jobSlug);
  return { ok: true };
}

async function toFailure(response: Response): Promise<FormActionResult> {
  const body = await readApiError(response);
  const message = Array.isArray(body.message) ? body.message.join(' ') : body.message;
  switch (response.status) {
    case 400:
      // FormsService returns { message, errors: [{ path, message }] } from parseFormFields.
      return body.errors?.length ? { fieldErrors: body.errors, formError: message } : { formError: message };
    case 403:
      return { formError: "You don't have permission to change this job's form." };
    case 409: // "This draft was just published", "Someone else just started a draft", ...
      return { formError: message };
    default:
      return { formError: 'Something went wrong. Please try again.' };
  }
}
