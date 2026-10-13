'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  addMemberSchema,
  updateMemberSchema,
  type AddMemberInput,
  type AssignableRole,
} from '@repo/shared';
import type { ActionFailure } from '@/lib/action-failure';
import { apiFetch, failureFromResponse } from '@/lib/api';

/**
 * Members Server Actions, calling apps/api/src/companies/memberships.
 * Each one re-validates (anything can call a Server Action) and calls
 * revalidatePath so the cached member and company lists (lib/dal.ts) refresh.
 */

const membersPath = (slug: string, userId?: string) =>
  `/api/companies/${encodeURIComponent(slug)}/members${userId ? `/${encodeURIComponent(userId)}` : ''}`;

/** "Changed by someone else" and similar: shown as a form or toast message. */
const CONFLICT_OR_GONE = {
  403: () => ({ formError: "You don't have permission to do that." }),
  404: () => ({ formError: 'That member is no longer part of this company. Reload the page.' }),
  409: (message: string) => ({ formError: message }),
};

export type AddMemberResult = ActionFailure<'email' | 'role'> & { added?: { name: string } };

export async function addMember(slug: string, input: AddMemberInput): Promise<AddMemberResult> {
  const parsed = addMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const response = await apiFetch(membersPath(slug), {
    method: 'POST',
    body: JSON.stringify(parsed.data),
  });
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (!response.ok) {
    return failureFromResponse(response, ['email', 'role'], {
      // Both are about the email: no account with it, or already a member.
      404: (message) => ({ fieldErrors: { email: [message] } }),
      409: (message) => ({ fieldErrors: { email: [message] } }),
      403: () => ({ formError: "You can't add people with that role." }),
    });
  }

  const added = (await response.json()) as { name: string };
  revalidatePath('/', 'layout');
  return { added: { name: added.name } };
}

export type MemberActionResult = ActionFailure<never> & { ok?: boolean };

export async function changeMemberRole(
  slug: string,
  userId: string,
  role: AssignableRole,
): Promise<MemberActionResult> {
  const parsed = updateMemberSchema.safeParse({ role });
  if (!parsed.success) {
    return { formError: 'Choose a valid role.' };
  }

  const response = await apiFetch(membersPath(slug, userId), {
    method: 'PATCH',
    body: JSON.stringify(parsed.data),
  });
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (!response.ok) {
    return failureFromResponse(response, [], CONFLICT_OR_GONE);
  }

  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Removes a member. When it's you (leaving), you're sent to /dashboard instead. */
export async function removeMember(
  slug: string,
  userId: string,
  { leaving }: { leaving: boolean },
): Promise<MemberActionResult> {
  const response = await apiFetch(membersPath(slug, userId), { method: 'DELETE' });
  if (response.status === 401) {
    redirect('/sign-in');
  }
  if (!response.ok) {
    return failureFromResponse(response, [], CONFLICT_OR_GONE);
  }

  revalidatePath('/', 'layout');
  if (leaving) {
    // You no longer belong to this company; /dashboard picks another one or onboarding.
    redirect('/dashboard');
  }
  return { ok: true };
}
