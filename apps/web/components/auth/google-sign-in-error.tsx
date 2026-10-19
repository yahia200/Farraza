import { Alert, AlertDescription } from '@/components/ui/alert';
import type { OidcErrorCode } from '@/lib/oidc';

const MESSAGES: Record<OidcErrorCode, string> = {
  'google-account-exists':
    'An account with this email already exists. Sign in with your password, then connect Google from your account.',
  'google-refused': "Google sign-in isn't available for this Google account. Use an account whose email Google has verified.",
  'google-failed': "Google sign-in didn't complete. Please try again.",
  'too-many-attempts': 'Too many attempts. Wait a minute and try again.',
};

/**
 * Why a Google sign-in sent the browser back here: the OIDC Route Handlers
 * (lib/oidc.ts) redirect to /sign-in?error=<code>. Reads searchParams, so the
 * page renders it inside <Suspense> (cacheComponents).
 */
export async function GoogleSignInError({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  const { error } = await searchParams;
  const message = typeof error === 'string' && Object.hasOwn(MESSAGES, error) ? MESSAGES[error as OidcErrorCode] : null;
  if (!message) {
    return null;
  }
  return (
    <Alert variant="destructive" className="mb-4">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
