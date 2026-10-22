import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type FeatureId = 'team-roles' | 'careers-page' | 'pipeline-table';

type Feature = {
  id: FeatureId;
  title: string;
  text: string;
  /** width and height are the file's own pixels, so next/image reserves the right box. */
  image: { src: string; alt: string; width: number; height: number };
};

// What the four steps leave out. The array order is the order on phones (one
// column) and the order the grid auto-places tiles in from md up.
const features: Feature[] = [
  {
    id: 'team-roles',
    title: 'Bring your whole team',
    text: "Add colleagues by email as admins, recruiters or interviewers. Interviewers can read candidates and forms but can't edit jobs or move anyone.",
    image: {
      src: '/landing/team-roles.webp',
      alt: 'Members table listing an owner, two admins, a recruiter and two interviewers',
      width: 1600,
      height: 719,
    },
  },
  {
    id: 'careers-page',
    title: 'A careers page, ready made',
    text: 'Every company gets its own public page listing its open jobs, with your logo and color.',
    image: {
      src: '/landing/careers-page.webp',
      alt: "Careers page on a phone listing a company's open positions",
      width: 900,
      height: 1985,
    },
  },
  {
    id: 'pipeline-table',
    title: 'Board or table, your call',
    text: 'Drag candidates across stages on the board, or sort and filter them in a table.',
    image: {
      src: '/landing/pipeline-table.webp',
      alt: 'Candidates table for a job with Table and Board views and a stage filter',
      width: 1600,
      height: 972,
    },
  },
];

// Spans on the md+ grid, filled in array order:
//   row 1: [ team roles (wide)       ][ careers ]
//   row 2: [ candidates table (wide) ][ (tall)  ]
// Both tables get two columns so their columns stay readable; the phone shot
// gets both rows.
const tilePlacement: Record<FeatureId, string> = {
  'team-roles': 'md:col-span-2',
  'careers-page': 'md:row-span-2',
  'pipeline-table': 'md:col-span-2',
};

/**
 * "More than a pipeline": a bento grid of the features the four steps don't
 * cover. One column on phones; from md up, three columns of rows that are
 * --tile-height tall, each tile placed by tilePlacement. Fully server-rendered.
 */
export function FeaturesSection() {
  return (
    <section aria-labelledby="landing-features-heading" className="mx-auto w-full max-w-400 mt-80">
      <h2
        id="landing-features-heading"
        className="my-12 text-center font-display text-[max(6vw,2.75rem)] leading-[0.85] font-black uppercase"
      >
        More than a pipeline
      </h2>
      <ul className="grid gap-4 [--tile-height:26rem] md:auto-rows-(--tile-height) md:grid-cols-3">
        {features.map((feature) => (
          <li key={feature.id} className={cn('min-h-0', tilePlacement[feature.id])}>
            <Card className="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-0 py-0 text-base">
              <div className="flex flex-col gap-2 p-6 md:p-8">
                <h3 className="text-xl font-semibold md:text-2xl">{feature.title}</h3>
                <p className="max-w-prose text-muted-foreground">{feature.text}</p>
              </div>
              {/* Runs off the tile's right and bottom edges, like the step
                  cards: object-cover crops from the top left. The fixed
                  height on phones keeps tall shots from making long tiles. */}
              <div className="h-72 min-h-0 pl-6 md:h-auto md:pl-8">
                <Image
                  src={feature.image.src}
                  alt={feature.image.alt}
                  width={feature.image.width}
                  height={feature.image.height}
                  sizes="(min-width: 768px) 66vw, 100vw"
                  className="size-full rounded-tl-2xl object-cover object-top-left shadow-lg ring-1 ring-black/5"
                />
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
