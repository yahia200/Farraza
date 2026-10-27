import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { Tilt, TiltContent } from "@animate-ui/react/primitives/effects/tilt";

function Hero() {
  return (
    <section className="relative w-full min-h-svh flex flex-col items-center overflow-hidden px-4">
      <div className="flex-1 flex flex-col items-center justify-center pt-28">
        <h1 className="text-[max(10vw,3.25rem)] leading-[0.8em] *:block font-black text-center uppercase font-display text-foreground">
          <span>From apply to hired</span>
          <span>step by step</span>
        </h1>
        <p className="text-lg text-center max-w-3xl text-foreground mt-2 md:mt-0">
          Farraza is the applicant tracking system for small teams. Post a job,
          build the exact application form you need, share one public link, and
          move every candidate through your pipeline, all in one place.
        </p>
        {/* Brand-accent primary + white secondary. Solid light fills on the
            primary gradient (a `default` primary button would blend into it). */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-6 md:pt-8  pb-2 md:pb-3">
          <Link
            href="/sign-up"
            className={cn(
              buttonVariants({ variant: "default", size: "lg" }),
              "px-16",
            )}
          >
            Take a step
          </Link>
        </div>
      </div>

      {/* Product shot anchored at the bottom, fading into the hero background.
          The mask fades the image itself to transparent so the dark bg shows
          through (no overlay needed); -webkit- for Chromium. */}
      <div className="w-full mask-radial-[150%_100%] mask-radial-from-50% mask-radial-to-80% md:mask-radial-to-75% mask-radial-at-top pt-7">
        <Tilt maxTilt={1} transition={{ stiffness: 300, damping: 20, mass: 1 }} className="w-full md:w-11/12 max-w-400 rounded-t-xl mx-auto">
          <TiltContent>
            <Image
              src="/pipeline-board.webp"
              alt="Farraza pipeline board moving candidates from Applied to Hired"
              width={2048}
              height={1152}
              preload
              className="rounded-t-lg lg:rounded-xl xl:rounded-t-2xl"
            />
          </TiltContent>
        </Tilt>
      </div>
    </section>
  );
}

export default Hero;
