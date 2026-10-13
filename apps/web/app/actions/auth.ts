'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { signInSchema, signUpSchema, type SignInInput, type SignUpInput } from '@repo/shared';
import type { ActionFailure } from '@/lib/action-failure';
import { apiFetch, clearSessionCookie, failureFromResponse, relaySessionCookie } from '@/lib/api';

/**
 * Auth Server Actions. They run on the Next.js server, call the API and
 * relay its session cookie to the browser.
 * Docs: node_modules/next/dist/docs/01-app/02-guides/authentication.md
 */

const AUTH_FIELDS = ['name', 'email', 'password'] as const;

/** What a failed action hands back to the form. Success redirects instead. */
export type AuthFailure = ActionFailure<(typeof AUTH_FIELDS)[number]>;

export async function signUp(input: SignUpInput): Promise<AuthFailure> {
  // Re-validate: anything can call a Server Action, not only our form.
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const response = await apiFetch('/api/auth/sign-up', {
    method: 'POST',
    body: JSON.stringify(parsed.data),
  });
  if (!response.ok) {
    return toFailure(response);
  }

  await relaySessionCookie(response);
  // Drop cached data rendered for the previous (signed-out) visitor.
  revalidatePath('/', 'layout');
  // New accounts belong to no company yet. redirect() throws, so it stays outside any try/catch.
  redirect('/onboarding');
}

export async function signIn(input: SignInInput): Promise<AuthFailure> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const response = await apiFetch('/api/auth/sign-in', {
    method: 'POST',
    body: JSON.stringify(parsed.data),
  });
  if (!response.ok) {
    return toFailure(response);
  }

  await relaySessionCookie(response);
  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

export async function signOut(): Promise<void> {
  // 401 means the session had already ended; clear the cookie either way.
  await apiFetch('/api/auth/sign-out', { method: 'POST' });
  await clearSessionCookie();
  revalidatePath('/', 'layout');
  redirect('/sign-in');
}

/** Maps API errors (apps/api/src/auth/) onto the form. */
function toFailure(response: Response): Promise<AuthFailure> {
  return failureFromResponse(response, AUTH_FIELDS, {
    409: (message) => ({ fieldErrors: { email: [message] } }), // email already has an account
    401: (message) => ({ formError: message }), // wrong email or password
  });
}
