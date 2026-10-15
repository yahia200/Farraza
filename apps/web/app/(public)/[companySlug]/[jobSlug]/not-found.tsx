import Link from 'next/link';
import { BriefcaseIcon } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

/** Shown for unknown jobs, and for jobs that are closed or not open yet. */
export default function JobNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl px-4 py-16">
      <Empty className="border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BriefcaseIcon />
          </EmptyMedia>
          <EmptyTitle>This job isn&apos;t accepting applications</EmptyTitle>
          <EmptyDescription>
            The link may be wrong, or the company may have closed this job. Check with the company for its open
            positions.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {/* A link styled as a button: Base UI's Button is only for buttons
              (node_modules/@base-ui/react/docs/react/components/button.md, "Rendering links as buttons"). */}
          <Link href="/" className={buttonVariants({ variant: 'outline' })}>
            Go to Khatwateen
          </Link>
        </EmptyContent>
      </Empty>
    </main>
  );
}
