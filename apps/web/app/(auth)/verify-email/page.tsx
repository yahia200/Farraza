import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { VerifyEmailStatus } from '@/components/auth/verify-email-status';
import { getCurrentUserOrNull } from '@/lib/dal';
import { Spinner } from '@/components/ui/spinner';

export const metadata: Metadata = { title: 'Confirm your email · Farraza' };

/**
 * The page verification emails link to: /verify-email?token=…
 * (the API's `emailVerification.url`, apps/api/src/app.module.ts). The token
 * is request data, so it is read inside <Suspense> (cacheComponents), and is
 * used by a POST from the browser, never during this GET. Signed-out visitors
 * can open it too (the link works without a session); only signed-in users are
 * offered a resend, which goes to their account's address.
 */
export default function VerifyEmailPage({ searchParams }: PageProps<'/verify-email'>) {
  return (
    <AuthCard title="Confirm your email" description="Proving the address is yours keeps your account safe.">
      <Suspense fallback={<Spinner />}>
        <VerifyWithToken searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function VerifyWithToken({ searchParams }: Pick<PageProps<'/verify-email'>, 'searchParams'>) {
  // The DAL decides who is viewing (null: signed out, no redirect).
  const [{ token }, user] = await Promise.all([searchParams, getCurrentUserOrNull()]);
  const value = typeof token === 'string' ? token : '';
  // Keyed by token: another link opened in this tab starts a fresh attempt.
  return <VerifyEmailStatus key={value} token={value} signedIn={user !== null} />;
}
