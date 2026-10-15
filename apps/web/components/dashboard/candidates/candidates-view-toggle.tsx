import Link from 'next/link';
import { KanbanIcon, TableIcon } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { candidatesHref, type CandidatesView } from './candidates-href';

const VIEWS = [
  { view: 'table', label: 'Table', Icon: TableIcon },
  { view: 'board', label: 'Board', Icon: KanbanIcon },
] as const satisfies readonly { view: CandidatesView; label: string; Icon: unknown }[];

/**
 * Switches the Candidates page between its table and board views. These are
 * links, not a ToggleGroup: the view lives in the URL (?view=) and is rendered
 * by the server, so each option is navigation (aria-current), like JobTabs.
 * The open candidate (?application=) is kept when switching.
 */
export function CandidatesViewToggle({
  basePath,
  view,
  application,
}: {
  basePath: string;
  view: CandidatesView;
  application?: string;
}) {
  return (
    <nav aria-label="Candidates view" className="flex w-fit gap-1 rounded-4xl bg-muted p-1">
      {VIEWS.map(({ view: target, label, Icon }) => {
        const current = target === view;
        return (
          <Link
            key={target}
            href={candidatesHref(basePath, { view: target, application })}
            scroll={false}
            aria-current={current ? 'page' : undefined}
            className={cn(
              buttonVariants({ variant: current ? 'default' : 'ghost', size: 'sm' }),
              !current && 'text-muted-foreground',
            )}
          >
            <Icon data-icon="inline-start" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
