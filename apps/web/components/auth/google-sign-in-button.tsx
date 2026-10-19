import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Starts "Sign in with Google" at the login Route Handler
 * (app/auth/oidc/[provider]/login/route.ts). A plain <a>, not next/link: the
 * handler must get a full browser navigation (it redirects to Google), and
 * Link's prefetch would start a login (a stored transaction and a cookie) for
 * every visitor who merely sees the button.
 */
export function GoogleSignInButton({ children }: { children: React.ReactNode }) {
  return (
    // The rule mistakes the Route Handler for a page; see the comment above for why not <Link>.
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a href="/auth/oidc/google/login" className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}>
      <GoogleLogo />
      {children}
    </a>
  );
}

/** Google's "G" mark (lucide has no brand icons). */
function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" data-icon="inline-start">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
