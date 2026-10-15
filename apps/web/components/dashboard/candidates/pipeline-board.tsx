import { InboxIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PipelineColumn } from '@/lib/dal';
import { CandidateCard } from './candidate-card';

/**
 * A job's pipeline: one column per stage on desktop, one tab per stage on
 * phones. A Server Component: the cards are links, and the tabs' selected
 * stage is the only state, held inside shadcn's Tabs.
 *
 * Both layouts are in the HTML and CSS picks one at the `md` breakpoint
 * (768px, the same as hooks/use-mobile.ts). Switching in JS (useIsMobile)
 * would render desktop on the server and swap after hydration; see "Keep the
 * sidebar frame out of <Suspense>" in .claude/rules/web.md.
 */
export function PipelineBoard({ columns, basePath }: { columns: PipelineColumn[]; basePath: string }) {
  if (columns.every((column) => column.applications.length === 0)) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <InboxIcon />
          </EmptyMedia>
          <EmptyTitle>No one has applied yet</EmptyTitle>
          <EmptyDescription>Candidates will appear here, in their stage, as they apply.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      {/* `w-0 min-w-full`: the row scrolls inside the page instead of its width (5+ columns) widening the whole layout. */}
      <div className="hidden w-0 min-w-full auto-cols-[minmax(15rem,1fr)] grid-flow-col gap-3 overflow-x-auto md:grid">
        {columns.map((column) => (
          <section key={column.id} aria-labelledby={`stage-${column.id}`} className="flex min-w-0 flex-col gap-3 rounded-2xl bg-muted/50 p-3">
            <header className="flex items-center justify-between gap-2">
              <h2 id={`stage-${column.id}`} className="truncate text-sm font-medium">
                {column.name}
              </h2>
              <Badge variant="secondary">{column.applications.length}</Badge>
            </header>
            <StageCards column={column} basePath={basePath} />
          </section>
        ))}
      </div>

      <Tabs defaultValue={columns[0]?.id} className="md:hidden">
        {/* Six stages don't fit a phone: the list scrolls sideways (the cards below never do). */}
        <TabsList className="w-full justify-start overflow-x-auto">
          {columns.map((column) => (
            <TabsTrigger key={column.id} value={column.id} className="flex-none">
              {column.name}
              <Badge variant="secondary">{column.applications.length}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>
        {columns.map((column) => (
          <TabsContent key={column.id} value={column.id}>
            <StageCards column={column} basePath={basePath} />
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}

function StageCards({ column, basePath }: { column: PipelineColumn; basePath: string }) {
  if (column.applications.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
        No candidates in this stage.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {column.applications.map((card) => (
        <li key={card.id}>
          <CandidateCard card={card} basePath={basePath} />
        </li>
      ))}
    </ul>
  );
}
