'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createJobSchema, updateJobSchema, type CreateJobInput, type UpdateJobInput } from '@repo/shared';
import type { ActionFailure } from '@/lib/action-failure';
import { apiFetch, failureFromResponse } from '@/lib/api';

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
  return { ok: true };
}
