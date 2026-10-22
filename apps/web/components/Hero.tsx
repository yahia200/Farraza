import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Image from 'next/image';

function Hero() {
  return (
    <section className="relative w-full min-h-svh flex flex-col items-center overflow-hidden">
      <div className="flex-1 flex flex-col items-center justify-center pt-28">
        <h1 className="text-[max(10vw,3.25rem)] leading-[0.8em] *:block font-black text-center uppercase font-display text-foreground">
          <span>From apply to hired</span>
          <span>step by step</span>
        </h1>
        <p className="text-lg text-center max-w-3xl text-foreground">
          Farraza is the applicant tracking system for small teams. Post a job, build the exact
          application form you need, share one public link, and move every candidate through your
          pipeline, all in one place.
        </p>
        {/* Brand-accent primary + white secondary. Solid light fills on the
            primary gradient (a `default` primary button would blend into it). */}
        <div className="flex flex-wrap items-center justify-center gap-3 py-8">
          <Link
            href="/sign-up"
            className={cn(
              buttonVariants({ variant: 'default', size: 'lg' }),
              'px-12',
            )}
          >
            Take a step
          </Link>
        </div>
      </div>

      {/* Product shot anchored at the bottom, fading into the hero background.
          The mask fades the image itself to transparent so the dark bg shows
          through (no overlay needed); -webkit- for Chromium. */}
      <div className="w-full max-w-7xl mask-radial-[120%_100%] mask-radial-from-50% mask-radial-at-top">
        <Image
          src="/pipeline-board.webp"
          alt="Farraza pipeline board moving candidates from Applied to Hired"
          width={2048}
          height={1152}
          preload
          className="w-full rounded-t-xl"
        />
      </div>
    </section>
  );
}

export default Hero;
