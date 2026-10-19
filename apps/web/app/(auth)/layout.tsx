/**
 * Shared frame for /sign-in, /sign-up, /verify-email, /forgot-password and
 * /reset-password. `(auth)` is a route group: it doesn't appear in the URL.
 */
export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
