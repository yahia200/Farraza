'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  type ForgotPasswordInput,
  type ResetPasswordInput,
} from '@repo/shared';
import type { ActionFailure } from '@/lib/action-failure';
import { apiFetch, failureFromResponse, relaySessionCookie } from '@/lib/api';

/**
 * Password reset Server Actions (API: apps/api/src/auth/password-reset.controller.ts).
 * Like the other auth actions they re-validate with the shared schema, since
 * anything can call a Server Action, and talk to the API from the server.
 * Docs: node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md
 */

export type ForgotPasswordFailure = ActionFailure<'email'>;

/**
 * Asks for a reset link. Resolves `undefined` once the API accepted the
 * request, which it does for every valid address: the page then says "check
 * your email" without knowing whether an account exists.
 */
export async function forgotPassword(input: ForgotPasswordInput): Promise<ForgotPasswordFailure | undefined> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const response = await apiFetch('/api/auth/password/forgot', {
    method: 'POST',
    body: JSON.stringify(parsed.data),
  });
  if (!response.ok) {
    return failureFromResponse(response, ['email'], {
      429: () => ({ formError: 'You asked for several links already. Wait a few minutes and try again.' }),
    });
  }
  return undefined;
}

/**
 * The token is not a field anyone types, so an error about it (or an invalid
 * or expired link, a 400 without `errors`) becomes the form-level message.
 */
const RESET_FIELDS = ['password'] as const;

export type ResetPasswordFailure = ActionFailure<(typeof RESET_FIELDS)[number]>;

/** Sets the new password with the link's token; the API signs this browser in. */
export async function resetPassword(input: ResetPasswordInput): Promise<ResetPasswordFailure> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);
    return fieldErrors.password
      ? { fieldErrors: { password: fieldErrors.password } }
      : { formError: fieldErrors.token?.[0] ?? 'Something went wrong. Please try again.' };
  }

  const response = await apiFetch('/api/auth/password/reset', {
    method: 'POST',
    body: JSON.stringify(parsed.data),
  });
  if (!response.ok) {
    return failureFromResponse(response, RESET_FIELDS);
  }

  await relaySessionCookie(response);
  // The reset ended every other session and signed this browser in: drop
  // anything cached for the previous visitor.
  revalidatePath('/', 'layout');
  // redirect() throws, so it stays outside any try/catch.
  redirect('/dashboard');
}
