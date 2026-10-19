'use server';

import { revalidatePath } from 'next/cache';
import { verifyEmailSchema, type VerifyEmailInput } from '@repo/shared';
import { apiFetch, readApiError } from '@/lib/api';

/**
 * Email verification Server Actions (API: apps/api/src/auth/email-verification.controller.ts).
 * Like the other auth actions they re-validate with the shared schema, since
 * anything can call a Server Action, and talk to the API from the server.
 * Docs: node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md
 */

export type VerifyEmailResult = { ok: true; email: string } | { ok: false; message: string };

/** Uses the token from a verification link. Called once by the verify page, on load. */
export async function verifyEmail(input: VerifyEmailInput): Promise<VerifyEmailResult> {
  const parsed = verifyEmailSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: 'This link is incomplete. Open it again from the email, or ask for a new one.' };
  }

  const response = await apiFetch('/api/auth/email/verify', {
    method: 'POST',
    body: JSON.stringify(parsed.data),
  });
  if (!response.ok) {
    return { ok: false, message: await messageFor(response) };
  }

  const { email } = (await response.json()) as { email: string };
  // The signed-in user's emailVerified is in the DAL's private cache (the
  // dashboard reminder reads it): drop it.
  revalidatePath('/', 'layout');
  return { ok: true, email };
}

export type ResendVerificationResult =
  | { status: 'sent' }
  | { status: 'already-verified' }
  | { status: 'signed-out' }
  | { status: 'failed'; message: string };

/** "Send the link again", to the signed-in user's current address. */
export async function resendVerification(): Promise<ResendVerificationResult> {
  const response = await apiFetch('/api/auth/email/verification', { method: 'POST' });
  switch (response.status) {
    case 202:
      return { status: 'sent' };
    case 409:
      // Verified meanwhile (another tab, another device): refresh the reminder away.
      revalidatePath('/', 'layout');
      return { status: 'already-verified' };
    case 401:
      return { status: 'signed-out' };
    case 429:
      return { status: 'failed', message: 'You asked for several links already. Wait a few minutes and try again.' };
    default:
      return { status: 'failed', message: "We couldn't send the email. Please try again." };
  }
}

async function messageFor(response: Response): Promise<string> {
  if (response.status === 400) {
    const body = await readApiError(response);
    const message = Array.isArray(body.message) ? body.message.join(' ') : body.message;
    return message || 'This link is invalid or has expired.';
  }
  if (response.status === 429) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  return 'Something went wrong. Please try again.';
}
