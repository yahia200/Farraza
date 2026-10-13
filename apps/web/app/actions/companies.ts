'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createCompanySchema, type CreateCompanyInput } from '@repo/shared';
import type { ActionFailure } from '@/lib/action-failure';
import { apiFetch, failureFromResponse } from '@/lib/api';

/** Company Server Actions used by onboarding. */

export type CreateCompanyFailure = ActionFailure<'name'>;

export async function createCompany(input: CreateCompanyInput): Promise<CreateCompanyFailure> {
  // Re-validate: anything can call a Server Action, not only our form.
  const parsed = createCompanySchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const response = await apiFetch('/api/companies', {
    method: 'POST',
    body: JSON.stringify(parsed.data),
  });
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (!response.ok) {
    return failureFromResponse(response, ['name']);
  }

  // The cached company list (lib/dal.ts) is now out of date.
  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

/**
 * For people waiting to be added by an admin. Asks the API directly rather
 * than the private cache, which could still hold the old, empty list.
 */
export async function checkMembership(): Promise<{ message: string }> {
  const response = await apiFetch('/api/companies');
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (!response.ok) {
    return { message: 'Something went wrong. Please try again.' };
  }

  const companies = (await response.json()) as unknown[];
  if (companies.length === 0) {
    return { message: "You haven't been added to a company yet. Check again once your admin has added you." };
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}
