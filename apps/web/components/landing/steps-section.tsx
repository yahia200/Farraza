import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { CardStack, StackCard } from '@/components/landing/card-stack';
import { cn } from '@/lib/utils';

type Step = {
  title: string;
  text: string;
  image: { src: string; alt: string };
  /** The card's fill and text colors. */
  colorClassName: string;
};

// One React question runs through all four screenshots: posted, made
// auto-reject in the form, answered on a phone, read on the candidate sheet.
const steps: Step[] = [
  {
    title: 'Post a job',
    text: "Create a job, then open it to applicants. Close it once you've hired.",
    image: {
      src: '/landing/jobs-list.webp',
      alt: 'Jobs list with open, draft and closed jobs and a New job button',
    },
    colorClassName: 'bg-primary-200 text-card-foreground dark:text-brand-accent-foreground',
  },
  {
    title: 'Build the form',
    text: "Ask exactly what this job needs: text, choices, file and video uploads, and a CV. Add an auto-reject rule and answers that don't fit go straight to Rejected.",
    image: {
      src: '/landing/form-builder-auto-reject.webp',
      alt: 'Form builder with a React experience question whose "Less than 2 years" option is marked auto-reject',
    },
    colorClassName: 'bg-primary-500/65 backdrop-blur-md text-primary-foreground',
  },
  {
    title: 'Share one link',
    text: 'Every job gets its own public page. Applicants answer one question at a time, on any phone, and attach their CV as they go.',
    image: {
      src: '/landing/apply-on-phone.webp',
      alt: 'Apply page on a phone asking "How long have you worked with React?" with three choices',
    },
    colorClassName: 'bg-brand-accent/65 backdrop-blur-md text-brand-accent-foreground',
  },
  {
    title: 'Move candidates forward',
    text: 'Open any candidate to read their CV and answers, then move them from stage to stage until you hire or reject them. Every move is recorded.',
    image: {
      src: '/landing/candidate-sheet.webp',
      alt: 'Candidate sheet with contact details, a CV with Preview and Download, the answers, and a Move to stage select',
    },
    colorClassName: 'bg-primary-600/65 backdrop-blur-md text-primary-foreground',
  },
];

/**
 * "Four steps to hire": the product walkthrough under the Hero, as a stack of
 * cards that pile up while scrolling (CardStack). The list's ::after adds half
 * a screen after the last card, so the finished stack holds before it leaves.
 */
export function StepsSection() {
  return (
    <section aria-labelledby="landing-steps-heading" className="mx-auto w-full max-w-400">
      <h2
        id="landing-steps-heading"
        className="my-12 pt-26 text-center font-display text-[max(6vw,2.75rem)] leading-[0.85] font-black uppercase"
      >
        four steps to hire
      </h2>
      <CardStack total={steps.length} className="flex flex-col gap-[25vh] after:block after:h-[50svh]">
        {steps.map((step, index) => (
          <StackCard key={step.title} index={index}>
            <Card
              className={cn(
                'grid h-full grid-rows-[auto_minmax(0,1fr)] gap-0 py-0 text-base md:grid-cols-5 md:grid-rows-1',
                step.colorClassName,
              )}
            >
              <div className="flex flex-col gap-2 p-6 md:col-span-2 md:gap-4 md:p-10">
                <span aria-hidden="true" className="font-display text-6xl leading-none md:text-9xl">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="text-xl font-semibold md:text-3xl">{step.title}</h3>
                <p className="max-w-prose">{step.text}</p>
              </div>
              {/* Fills the rest of the card and runs off its right and bottom
                  edges at any width: object-cover crops whichever side
                  overflows, from the top left. */}
              <div className="min-h-0 pl-6 md:col-span-3 md:pt-10 md:pl-0">
                <Image
                  src={step.image.src}
                  alt={step.image.alt}
                  width={1600}
                  height={1200}
                  sizes="(min-width: 768px) 60vw, 100vw"
                  className="size-full rounded-tl-2xl object-cover object-top-left shadow-lg ring-1 ring-black/5"
                />
              </div>
            </Card>
          </StackCard>
        ))}
      </CardStack>
    </section>
  );
}
