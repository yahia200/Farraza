import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { CircleXIcon } from 'lucide-react';
import { AuthCard } from '@/components/auth/auth-card';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export const metadata: Metadata = { title: 'Choose a new password · Khatwateen' };

/**
 * The page reset emails link to: /reset-password?token=… (the API's
 * `passwordReset.url`, apps/api/src/app.module.ts). Opening it uses nothing:
 * the token is POSTed with the new password, so mail scanners and link
 * previews that follow the link can't spend it. The token is request data,
 * so it is read inside <Suspense> (cacheComponents).
 */
export default function ResetPasswordPage({ searchParams }: PageProps<'/reset-password'>) {
  return (
    <AuthCard title="Choose a new password" description="You'll be signed in, and signed out everywhere else.">
      <Suspense fallback={<Spinner />}>
        <ResetWithToken searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function ResetWithToken({ searchParams }: Pick<PageProps<'/reset-password'>, 'searchParams'>) {
  const { token } = await searchParams;
  if (typeof token !== 'string' || token === '') {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="destructive">
          <CircleXIcon />
          <AlertTitle>This link is incomplete</AlertTitle>
          <AlertDescription>Open it again from the email, or ask for a new one.</AlertDescription>
        </Alert>
        <Link href="/forgot-password" className={buttonVariants()}>
          Ask for a new link
        </Link>
      </div>
    );
  }
  // Keyed by token: another link opened in this tab starts a fresh form.
  return <ResetPasswordForm key={token} token={token} />;
}
