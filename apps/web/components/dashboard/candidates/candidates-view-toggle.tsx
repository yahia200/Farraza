'use client';

import Link from 'next/link';
import { KanbanIcon, TableIcon } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { candidatesHref, type CandidatesView } from './candidates-href';

const VIEWS = [
  { view: 'table', label: 'Table', Icon: TableIcon },
  { view: 'board', label: 'Board', Icon: KanbanIcon },
] as const satisfies readonly { view: CandidatesView; label: string; Icon: unknown }[];

/**
 * Switches the Candidates page between its table and board views. Shadcn Tabs
 * (so it gets the same sliding indicator), but each tab is a Link rendered
 * through Base UI's `render` + `nativeButton={false}`
 * (docs/react/components/tabs.md, "Rendering as links"): the view lives in the
 * URL (?view=) and is rendered by the server, so `value` is controlled by the
 * page's `view` and there are no panels. The indicator moves once the new
 * page arrives. The open candidate (?application=) is kept when switching.
 *
 * The links use `prefetch` (= true): ?view= is URL data the shared App Shell
 * can't include, so true resolves each view before the click, from the board
 * read both views share (02-guides/optimizing-prefetching.md, "Resolve URL data
 * at prefetch time"; 03-api-reference/02-components/link.md, "prefetch").
 * Production only.
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
    <Tabs value={view} aria-label="Candidates view">
      <TabsList>
        {VIEWS.map(({ view: target, label, Icon }) => (
          <TabsTrigger
            key={target}
            value={target}
            nativeButton={false}
            render={
              <Link
                href={candidatesHref(basePath, { view: target, application })}
                scroll={false}
                prefetch
              />
            }
          >
            <Icon />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
