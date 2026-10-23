import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ClimbFigure, type HairlinePalette } from '@/components/landing/hairline/climb-figure';
import { cn } from '@/lib/utils';

// Solid primary-500 steps straight on the page: the plates are filled
// primary-500 and nothing paints the box around them. primary-700 marks the
// highlight; the creases are primary-200.
const figurePalette: HairlinePalette = {
  plate: 'var(--primary-50)',
  hi: 'var(--primary-600)',
  edge: 'var(--primary-500)',
  mid: 'var(--primary-300)',
  lo: 'var(--primary-400)',
};

/**
 * The closing call to action, after "More than a pipeline": one card split in
 * two, the heading and the sign-up button on the left and the Climb figure on
 * the right. On phones it stacks with the figure on top. Only the figure is a
 * client component.
 */
export function CtaSection() {
  return (
    <section aria-labelledby="landing-cta-heading" className="mx-auto mt-40 w-full max-w-400">
      <Card className="grid gap-0 py-0 text-base md:grid-cols-2 md:items-center" ghost>
        <div className="order-2 flex flex-col items-start gap-6 p-6 pt-0 md:order-1 md:p-12 xl:p-16">
          <h2
            id="landing-cta-heading"
            className="font-display text-[max(4.5vw,2.5rem)] leading-[0.85] font-black uppercase"
          >
            Your next hire is a few steps away
          </h2>
          <p className="max-w-prose text-lg">
            Create your company, post a job and share its link. Every applicant lands in your
            pipeline, ready to move forward.
          </p>
          <Link href="/sign-up" className={cn(buttonVariants({ size: 'lg' }), 'w-full')}>
            Set up your company
          </Link>
        </div>
        <ClimbFigure
          label="A pawn climbing a flight of five steps, from Applied to Hired"
          palette={figurePalette}
          className="order-1 rounded-r-2xl md:order-2"
        />
      </Card>
    </section>
  );
}
