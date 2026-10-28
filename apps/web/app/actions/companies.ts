'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  companySettingsFormSchema,
  createCompanySchema,
  type CompanySettingsFormInput,
  type CreateCompanyInput,
} from '@repo/shared';
import { GENERIC_FAILURE_MESSAGE, type ActionFailure } from '@/lib/action-failure';
import { apiFetch, failureFromResponse } from '@/lib/api';
import { expirePublicJob } from '@/lib/public-jobs';

/** Company Server Actions: onboarding and the dashboard's settings page. */

export type CreateCompanyFailure = ActionFailure<'name'>;
export type AddCompanyResult = CreateCompanyFailure & { slug?: string };

/** Onboarding: create the company, then go straight to its dashboard. */
export async function createCompany(input: CreateCompanyInput): Promise<CreateCompanyFailure> {
  const result = await postCompany(input);
  if (!result.slug) {
    return result;
  }
  // redirect() throws, so it stays outside any try/catch.
  redirect(`/dashboard/${result.slug}`);
}

/** "Add company" (step 1 of 2): create it and hand the slug back for step 2. */
export async function addCompany(input: CreateCompanyInput): Promise<AddCompanyResult> {
  return postCompany(input);
}

/** Shared by both: not exported, so it is not callable as a Server Action. */
async function postCompany(input: CreateCompanyInput): Promise<AddCompanyResult> {
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

  const { slug } = (await response.json()) as { slug: string };
  // The cached company list (lib/dal.ts) is now out of date.
  revalidatePath('/', 'layout');
  return { slug };
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
    return { message: GENERIC_FAILURE_MESSAGE };
  }

  const companies = (await response.json()) as unknown[];
  if (companies.length === 0) {
    return { message: "You haven't been added to a company yet. Check again once your admin has added you." };
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

const SETTINGS_FIELDS = ['name', 'logoUrl', 'brandColor'] as const;

export type CompanySettingsResult = ActionFailure<(typeof SETTINGS_FIELDS)[number]> & { saved?: boolean };

/** Saves the settings form. Stays on the page, so success is a result rather than a redirect. */
export async function updateCompanySettings(
  slug: string,
  input: CompanySettingsFormInput,
): Promise<CompanySettingsResult> {
  const parsed = companySettingsFormSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  // The form uses "" for "none"; the API uses null (packages/shared/src/companies.ts).
  const { name, logoUrl, brandColor } = parsed.data;
  const response = await apiFetch(`/api/companies/${encodeURIComponent(slug)}`, {
    method: 'PATCH',
    body: JSON.stringify({ name, logoUrl: logoUrl || null, brandColor: brandColor || null }),
  });
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (!response.ok) {
    return failureFromResponse(response, SETTINGS_FIELDS, {
      403: () => ({ formError: 'Only owners and admins can change company settings.' }),
    });
  }

  // The sidebar's company list (lib/dal.ts) shows the name, logo and color.
  revalidatePath('/', 'layout');
  // So does every public apply page of this company.
  expirePublicJob(slug);
  return { saved: true };
}
