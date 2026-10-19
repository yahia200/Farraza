'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { CircleCheckIcon, CircleXIcon } from 'lucide-react';
import { verifyEmail, type VerifyEmailResult } from '@/app/actions/email-verification';
import { ResendVerificationButton } from '@/components/auth/resend-verification-button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

/**
 * Sends the link's token to the API once, after the page loads, and shows the
 * outcome. The token is POSTed from the browser on purpose: mail scanners and
 * link previews fetch the page with GET, and must not use the link up.
 * Pattern: calling a Server Function from useEffect, in
 * node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md.
 * On failure, a signed-in user can ask for a new link here; a signed-out
 * visitor is asked to sign in first (resend needs the session to know whose
 * address to use). `signedIn` comes from the DAL, in the page.
 */
export function VerifyEmailStatus({ token, signedIn }: { token: string; signedIn: boolean }) {
  const [result, setResult] = useState<VerifyEmailResult>();
  const [, startTransition] = useTransition();
  // A link works once. Strict Mode runs effects twice in development, and a
  // second request would answer "invalid link"; the ref survives that re-run.
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    startTransition(async () => {
      try {
        setResult(await verifyEmail({ token }));
      } catch {
        setResult({ ok: false, message: 'Check your connection, then open the link again.' });
      }
    });
  }, [token]);

  if (!result) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        Confirming your email address…
      </p>
    );
  }

  if (result.ok) {
    return (
      <div className="flex flex-col gap-4">
        <Alert>
          <CircleCheckIcon />
          <AlertTitle>Email address confirmed</AlertTitle>
          <AlertDescription>{result.email} is verified. Thanks!</AlertDescription>
        </Alert>
        <Link href="/dashboard" className={buttonVariants()}>
          Continue to your dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Alert variant="destructive">
        <CircleXIcon />
        <AlertTitle>We couldn&apos;t confirm your address</AlertTitle>
        <AlertDescription>
          {result.message} Each link works once and expires after 24 hours.
        </AlertDescription>
      </Alert>
      {signedIn ? (
        <ResendVerificationButton />
      ) : (
        <p className="text-sm text-muted-foreground">
          Need a new link?{' '}
          <Link href="/sign-in" className="text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
          , then open this link again to send one.
        </p>
      )}
    </div>
  );
}
