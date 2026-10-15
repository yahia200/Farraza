import Link from 'next/link';

/**
 * Pages applicants see (the apply page). No dashboard sidebar and no
 * marketing NavBar: the company's own branding is the focus.
 */
export default function PublicLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <div className="flex-1">{children}</div>
      <footer className="px-4 py-6 text-center text-xs text-muted-foreground">
        Hiring with{' '}
        <Link href="/" className="font-medium underline-offset-4 hover:underline">
          Khatwateen
        </Link>
      </footer>
    </div>
  );
}
