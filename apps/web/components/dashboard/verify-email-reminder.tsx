import { MailWarningIcon } from 'lucide-react';
import { ResendVerificationButton } from '@/components/auth/resend-verification-button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/**
 * Shown at the top of every dashboard page until the user opens the link
 * emailed at sign-up. Nothing is gated on it yet; it only nudges.
 * The button sits in the description rather than in shadcn's `AlertAction`,
 * which is absolutely positioned and would cover the text on a phone.
 */
export function VerifyEmailReminder({ email }: { email: string }) {
  return (
    <Alert>
      <MailWarningIcon />
      <AlertTitle>Confirm your email address</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <span>
          We sent a link to <span className="font-medium text-foreground">{email}</span>. Open it to
          confirm the address is yours. Can&apos;t find it?
        </span>
        <ResendVerificationButton />
      </AlertDescription>
    </Alert>
  );
}
