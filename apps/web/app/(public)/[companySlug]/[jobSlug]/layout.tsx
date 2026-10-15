import Link from 'next/link';
import { getPublicJob } from '@/lib/public-jobs';

function getReadableTextColor(brandColor: string | null) {
  if (!brandColor) return '#ffffff';

  const red = Number.parseInt(brandColor.slice(1, 3), 16) / 255;
  const green = Number.parseInt(brandColor.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(brandColor.slice(5, 7), 16) / 255;
  const linearize = (channel: number) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  const luminance = 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue);
  const whiteContrast = 1.05 / (luminance + 0.05);
  const blackContrast = (luminance + 0.05) / 0.05;

  return whiteContrast >= blackContrast ? '#ffffff' : '#000000';
}

type PublicJobLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ companySlug: string; jobSlug: string }>;
};

export default async function PublicJobLayout({ children, params }: PublicJobLayoutProps) {
  const { companySlug, jobSlug } = await params;
  const publicJob = await getPublicJob(companySlug, jobSlug);
  const textColor = getReadableTextColor(publicJob?.company.brandColor ?? null);

  return (
    <div
      data-public-job-layout
      className="flex h-svh flex-col overflow-y-auto bg-muted/30 scrollbar-gutter-stable"
      style={publicJob?.company.brandColor ? { backgroundColor: publicJob.company.brandColor } : undefined}
    >
      <div className="flex-1 flex">{children}</div>
      <footer className="px-4 py-6 text-center text-xs" style={{ color: textColor }}>
        Hiring with{' '}
        <Link href="/" className="font-medium underline-offset-4 hover:underline">
          Khatwateen
        </Link>
      </footer>
    </div>
  );
}