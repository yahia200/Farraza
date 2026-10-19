'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { resendVerification, type ResendVerificationResult } from '@/app/actions/email-verification';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

/**
 * "Send a new link": asks the API to email a fresh verification link to the
 * signed-in user's address. Used by the dashboard reminder and the verify
 * page. The outcome is shown next to the button (a live region), not as a
 * toast, because the verify page has no <Toaster />.
 */
export function ResendVerificationButton({ label = 'Send a new link' }: { label?: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ResendVerificationResult>();

  function resend() {
    setResult(undefined);
    startTransition(async () => {
      try {
        setResult(await resendVerification());
      } catch {
        // The request itself failed (offline, server down).
        setResult({ status: 'failed', message: 'Check your connection and try again.' });
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={resend}
        disabled={pending || result?.status === 'sent'}
      >
        {pending && <Spinner data-icon="inline-start" />}
        {label}
      </Button>
      <p role="status" className="text-sm text-muted-foreground">
        {result && <ResultMessage result={result} />}
      </p>
    </div>
  );
}

function ResultMessage({ result }: { result: ResendVerificationResult }) {
  switch (result.status) {
    case 'sent':
      return 'Sent. Check your inbox, and your spam folder.';
    case 'already-verified':
      return 'Your address is already verified.';
    case 'signed-out':
      return (
        <>
          <Link href="/sign-in" className="text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>{' '}
          to get a new link.
        </>
      );
    case 'failed':
      return <span className="text-destructive">{result.message}</span>;
  }
}
