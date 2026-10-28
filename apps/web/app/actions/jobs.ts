'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  createJobSchema,
  RELOAD_MESSAGE,
  saveHighlightedQuestionsSchema,
  saveRatingCriteriaSchema,
  updateJobSchema,
  type CreateJobInput,
  type UpdateJobInput,
} from '@repo/shared';
import type { ActionFailure } from '@/lib/action-failure';
import { apiFetch, failureFromResponse } from '@/lib/api';
import { expireCompanyJobs, expirePublicJob } from '@/lib/public-jobs';

/**
 * Jobs Server Actions, calling apps/api/src/jobs. Each re-validates with the
 * shared schemas and calls revalidatePath so the cached job lists (lib/dal.ts) refresh.
 */

const jobsPath = (companySlug: string, jobSlug?: string, action?: 'open' | 'close') =>
  `/api/companies/${encodeURIComponent(companySlug)}/jobs` +
  (jobSlug ? `/${encodeURIComponent(jobSlug)}` : '') +
  (action ? `/${action}` : '');

const JOB_FIELDS = ['title', 'description'] as const;
type JobField = (typeof JOB_FIELDS)[number];

const NO_PERMISSION = { 403: () => ({ formError: "You don't have permission to change jobs." }) };

/** The form sends "" for an empty description; the API stores null. */
const descriptionOrNull = (description: string | null | undefined) => description?.trim() || null;

export type CreateJobResult = ActionFailure<JobField> & { slug?: string };

/** Creates a draft job (with the default stages) and returns its slug. */
export async function createJob(companySlug: string, input: CreateJobInput): Promise<CreateJobResult> {
  const parsed = createJobSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const response = await apiFetch(jobsPath(companySlug), {
    method: 'POST',
    body: JSON.stringify({ title: parsed.data.title, description: descriptionOrNull(parsed.data.description) }),
  });
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (!response.ok) {
    // 409: two jobs got the same address at the same moment.
    return failureFromResponse(response, JOB_FIELDS, { ...NO_PERMISSION, 409: (message) => ({ formError: message }) });
  }

  const { slug } = (await response.json()) as { slug: string };
  revalidatePath('/', 'layout');
  return { slug };
}

export type UpdateJobResult = ActionFailure<JobField> & { saved?: boolean };

export async function updateJob(companySlug: string, jobSlug: string, input: UpdateJobInput): Promise<UpdateJobResult> {
  const parsed = updateJobSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const response = await apiFetch(jobsPath(companySlug, jobSlug), {
    method: 'PATCH',
    body: JSON.stringify({ title: parsed.data.title, description: descriptionOrNull(parsed.data.description) }),
  });
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (!response.ok) {
    return failureFromResponse(response, JOB_FIELDS, NO_PERMISSION);
  }

  revalidatePath('/', 'layout');
  // The public apply page and the company listing both show title/description.
  expirePublicJob(companySlug, jobSlug);
  expireCompanyJobs(companySlug);
  return { saved: true };
}

export type JobStatusResult = ActionFailure<never> & { ok?: boolean };

/** Opens (or reopens) a job. The API refuses until a form is published (409). */
export async function openJob(companySlug: string, jobSlug: string): Promise<JobStatusResult> {
  return changeStatus(companySlug, jobSlug, 'open');
}

export async function closeJob(companySlug: string, jobSlug: string): Promise<JobStatusResult> {
  return changeStatus(companySlug, jobSlug, 'close');
}

async function changeStatus(companySlug: string, jobSlug: string, action: 'open' | 'close'): Promise<JobStatusResult> {
  const response = await apiFetch(jobsPath(companySlug, jobSlug, action), { method: 'POST' });
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (!response.ok) {
    // 409 carries the reason: no published form, already open, or not open.
    return failureFromResponse(response, [], { ...NO_PERMISSION, 409: (message) => ({ formError: message }) });
  }
  revalidatePath('/', 'layout');
  // Opening or closing decides whether the apply page exists and whether the
  // job shows in the company listing.
  expirePublicJob(companySlug, jobSlug);
  expireCompanyJobs(companySlug);
  return { ok: true };
}

export type SaveHighlightedQuestionsResult = ActionFailure<never> & { keys?: string[] };

/**
 * Saves the Job's Highlighted questions, calling
 * PUT .../jobs/:jobSlug/highlighted-questions with the whole new list
 * (apps/api/src/jobs). The picker on the candidates page calls it on every
 * tick, so it returns failures rather than throwing. It revalidates the
 * candidates page, which re-reads the job (the saved keys) and the board (the
 * answers shown), so the list updates without a reload. Applicants never see
 * this choice, so the public job is left alone.
 */
export async function saveHighlightedQuestions(
  companySlug: string,
  jobSlug: string,
  keys: string[],
): Promise<SaveHighlightedQuestionsResult> {
  const parsed = saveHighlightedQuestionsSchema.safeParse({ keys });
  if (!parsed.success) {
    return { formError: parsed.error.issues[0]?.message ?? RELOAD_MESSAGE };
  }

  const candidatesPath = `/dashboard/${companySlug}/jobs/${jobSlug}/candidates`;
  const response = await apiFetch(`${jobsPath(companySlug, jobSlug)}/highlighted-questions`, {
    method: 'PUT',
    body: JSON.stringify(parsed.data),
  });
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (!response.ok) {
    // 400: a key is no longer on the published form (its message says so); 409: no published form.
    const failure = await failureFromResponse(response, [], {
      ...NO_PERMISSION,
      404: () => ({ formError: 'This job no longer exists. Reload the page.' }),
      409: (message) => ({ formError: message }),
    });
    if (response.status === 400 || response.status === 409) {
      // The picker was built from an older form: refresh it so it lists what the form asks now.
      revalidatePath(candidatesPath);
    }
    return failure;
  }

  const saved = (await response.json()) as { keys: string[] };
  revalidatePath(candidatesPath);
  return { keys: saved.keys };
}

export type SaveRatingCriteriaResult = ActionFailure<never> & { keys?: string[] };

/**
 * Saves the Job's rating Criteria, calling PUT .../jobs/:jobSlug/rating-criteria
 * with the whole new list (apps/api/src/jobs). The picker on the candidates
 * page calls it on every tick, so it returns failures rather than throwing.
 * It revalidates the candidates page, which re-reads the job (the saved keys),
 * so the picker and the sheet's Criteria rows follow without a reload.
 * Applicants never see Criteria, so the public job is left alone.
 */
export async function saveRatingCriteria(
  companySlug: string,
  jobSlug: string,
  keys: string[],
): Promise<SaveRatingCriteriaResult> {
  const parsed = saveRatingCriteriaSchema.safeParse({ keys });
  if (!parsed.success) {
    return { formError: parsed.error.issues[0]?.message ?? RELOAD_MESSAGE };
  }

  const candidatesPath = `/dashboard/${companySlug}/jobs/${jobSlug}/candidates`;
  const response = await apiFetch(`${jobsPath(companySlug, jobSlug)}/rating-criteria`, {
    method: 'PUT',
    body: JSON.stringify(parsed.data),
  });
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (!response.ok) {
    // 400 can only come from a stale page or a hand-made request: the catalog is fixed and checked above.
    const failure = await failureFromResponse(response, [], {
      ...NO_PERMISSION,
      404: () => ({ formError: 'This job no longer exists. Reload the page.' }),
    });
    if (response.status === 400) {
      revalidatePath(candidatesPath);
    }
    return failure;
  }

  const saved = (await response.json()) as { keys: string[] };
  revalidatePath(candidatesPath);
  return { keys: saved.keys };
}
