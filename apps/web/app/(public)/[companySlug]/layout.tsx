import type { CSSProperties } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { getReadableTextColor } from '@/lib/brand';
import { getBranding } from '@/lib/public-jobs';

/**
 * The shared frame for every public page of a company — the listing
 * (/{companySlug}) and each apply page (/{companySlug}/{jobSlug}). It themes
 * the whole surface with the company's brand color and adds the Khatwateen
 * footer once, so the pages inside only render their own content.
 *
 * Branding is fetched once here with getBranding (a single cheap call, cached
 * and shared), not by reaching into a job or the jobs listing — the apply page
 * used to pull the entire job just to colour its chrome. The brand color backs
 * the page; `--brand-fg` is the readable text color for anything sitting
 * directly on it (the footer here, the listing header), while cards and the
 * apply form keep their own surface tokens.
 */
export default async function PublicCompanyLayout({
  children,
  params,
}: LayoutProps<'/[companySlug]'>) {
  const { companySlug } = await params;
  // The company slug CHECK in contract.prisma — anything else can't be a
  // company, so skip the fetch (and don't cache a miss) and render unthemed;
  // the page itself calls notFound().
  const branding = /^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/.test(companySlug)
    ? await getBranding(companySlug)
    : null;
  const brandColor = branding?.brandColor ?? null;

  const themeStyle = brandColor
    ? ({ backgroundColor: brandColor, '--brand-fg': getReadableTextColor(brandColor) } as CSSProperties)
    : undefined;

  return (
    <div
      // globals.css keys off this to drop the document's own scrollbar gutter
      // and background, so this branded element is the sole scroller and no
      // white strip shows beside the brand color.
      data-public-layout
      className={cn(
        'flex h-svh flex-col overflow-y-auto scrollbar-gutter-stable',
        !brandColor && 'bg-muted/30',
      )}
      style={themeStyle}
    >
      <div className="flex flex-1">{children}</div>
      <footer
        className={cn('px-4 py-6 text-center text-xs', !brandColor && 'text-muted-foreground')}
        style={brandColor ? { color: 'var(--brand-fg)' } : undefined}
      >
        Hiring with{' '}
        <Link href="/" className="font-medium underline-offset-4 hover:underline">
          Khatwateen
        </Link>
      </footer>
    </div>
  );
}
