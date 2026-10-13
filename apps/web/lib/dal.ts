import 'server-only';
import { redirect } from 'next/navigation';
import { apiFetch } from './api';

/**
 * Data Access Layer: the one place that resolves "who is signed in".
 * Pattern: node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md (Step 1)
 */

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
}

/**
 * The signed-in user, or a redirect to /sign-in.
 * `use cache: private` may read cookies and keeps the result in the browser
 * only. Callers must render inside a <Suspense> boundary.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  'use cache: private';

  const response = await apiFetch('/api/users/me');
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (!response.ok) {
    throw new Error(`Could not load the current user (HTTP ${response.status}).`);
  }

  const user = (await response.json()) as CurrentUser;
  // Expose only what the UI needs.
  return { id: user.id, name: user.name, email: user.email };
}

/** Mirrors CompanyWithRole in apps/api/src/companies/company.ts. */
export interface MyCompany {
  id: string;
  name: string;
  slug: string;
  role: 'owner' | 'admin' | 'recruiter' | 'interviewer';
}

/**
 * The companies the signed-in user belongs to. An empty list means they
 * haven't finished onboarding. Actions that change memberships must call
 * revalidatePath() so this private cache doesn't serve a stale list.
 */
export async function getMyCompanies(): Promise<MyCompany[]> {
  'use cache: private';

  const response = await apiFetch('/api/companies');
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (!response.ok) {
    throw new Error(`Could not load your companies (HTTP ${response.status}).`);
  }

  const companies = (await response.json()) as MyCompany[];
  return companies.map(({ id, name, slug, role }) => ({ id, name, slug, role }));
}
